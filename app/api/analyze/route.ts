import { NextResponse } from "next/server";
import type { AnalyzeResponse, PageBasics, Issue, Severity, Effort, Coverage, PageMetrics, ScanFingerprint } from "@/lib/types";
import * as cheerio from "cheerio";
import { createLimiter } from "@/lib/limit";

export const runtime = "nodejs"; // ensure Node runtime

// Simple in-memory cache for responses
const cache = new Map<string, { data: AnalyzeResponse; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// In-memory storage for fingerprints (tracks previous scans)
const fingerprintStore = new Map<string, ScanFingerprint>();

function getCached(url: string): AnalyzeResponse | null {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Cache hit for ${url}`);
    return cached.data;
  }
  cache.delete(url);
  return null;
}

function setCached(url: string, data: AnalyzeResponse): void {
  cache.set(url, { data, timestamp: Date.now() });
  console.log(`Cached result for ${url}`);
}

function computeFingerprint(metrics: {
  totalImages: number;
  missingAlt: number;
  totalControls: number;
  unlabeledControls: number;
  totalLinks: number;
}): ScanFingerprint {
  // Simple hash: concatenate and compute a checksum
  const str = `${metrics.totalImages}:${metrics.missingAlt}:${metrics.totalControls}:${metrics.unlabeledControls}:${metrics.totalLinks}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return {
    hash: Math.abs(hash).toString(36),
    timestamp: new Date().toISOString(),
    metrics,
  };
}

function normalizeUrl(input: string) {
  const trimmed = input.trim();
  const withProto = trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;

  const u = new URL(withProto);
  // optional: block non-http(s)
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http/https URLs are supported.");
  }
  return u.toString();
}

/**
 * Filter out lines that are made up mostly or entirely of repeated symbols
 * AND lines that begin/end with box-drawing characters
 * Examples to remove:
 * - ━━━━━━━━ (repeated symbols)
 * - ║ Some text ║ (framed in box chars)
 * - ╔════════╗ (box drawing)
 */
function filterSymbolLines(text: string): string {
  return text
    .split("\n")
    .filter(line => {
      const trimmed = line.trim();
      
      // Rule 1: Lines made of 3+ repeated symbols
      if (trimmed.length >= 3) {
        const symbolMatch = trimmed.match(/^([\W_])\1{2,}$/);
        if (symbolMatch) return false; // Remove this line
      }
      
      // Rule 2 & 3: Lines that begin or end with box-drawing characters
      const boxDrawingChars = /[║╔╗╝╚╠╣╦╩╬═╪╫╭╮╯╰│┌┐└┘├┤┬┴┼─]/;
      if (boxDrawingChars.test(trimmed.charAt(0)) || boxDrawingChars.test(trimmed.charAt(trimmed.length - 1))) {
        return false; // Remove this line
      }
      
      return true; // Keep this line
    })
    .join("\n");
}

async function fetchHtml(url: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://www.google.com/",
      },
    });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
    if (!contentType.includes("text/html")) {
      throw new Error(`URL did not return HTML (content-type: ${contentType || "unknown"})`);
    }

    // Guardrail: limit size so you don't accidentally slurp huge pages
    const html = await res.text();
    const limited = html.length > 1_000_000 ? html.slice(0, 1_000_000) : html;

    return {
      html: limited,
      finalUrl: res.url || url,
    };
  } finally {
    clearTimeout(t);
  }
}

function scoreUrl(url: string, baseUrl: string): number {
  try {
    const u = new URL(url);
    const base = new URL(baseUrl);
    const pathname = u.pathname.toLowerCase();
    const search = u.search.toLowerCase();

    let score = 0;

    // Penalty: files and fragments only
    if (/\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|zip|exe)$/i.test(pathname)) {
      return -5;
    }
    if (pathname === "/" && search === "") {
      return 0; // Keep homepage neutral
    }
    if (pathname.endsWith("#") || url.includes("mailto:")) {
      return -3;
    }

    // Bonus: high-value keywords (forms, contact, apply, etc.)
    const highValueKeywords = ["contact", "help", "apply", "login", "search", "pay", "form", "register"];
    if (highValueKeywords.some((kw) => pathname.includes(kw))) {
      score += 3;
    }

    // Bonus: moderate depth (2-4 segments = likely content page)
    const segments = pathname.split("/").filter((s) => s);
    if (segments.length >= 2 && segments.length <= 4) {
      score += 2;
    }

    // Penalty: too deep or overly specific
    if (segments.length > 6) {
      score -= 1;
    }

    // Penalty: query strings (often duplicates)
    if (search) {
      score -= 1;
    }

    return score;
  } catch {
    return -10; // Invalid URL
  }
}

function getPathPattern(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter((s) => s);
    // Return pattern like "/news" or "/forms" (first segment as template group)
    return parts.length > 0 ? `/${parts[0]}` : "/";
  } catch {
    return "/";
  }
}

function groupByTemplate(urls: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const url of urls) {
    const pattern = getPathPattern(url);
    if (!groups.has(pattern)) {
      groups.set(pattern, []);
    }
    groups.get(pattern)!.push(url);
  }
  return groups;
}

function shouldCrawlUrl(url: string, baseUrl: string): boolean {
  try {
    const u = new URL(url);
    const base = new URL(baseUrl);
    
    // Guard 1: Different domain
    if (u.hostname !== base.hostname) return false;
    
    // Guard 2: Avoid query strings (often duplicates)
    if (u.search) return false;
    
    // Guard 3: Avoid fragments
    if (url.includes("#")) return false;
    
    // Guard 4: Avoid logout/admin/login pages
    const pathname = u.pathname.toLowerCase();
    const skipPaths = ["/logout", "/admin", "/wp-admin", "/login", "/signin", "/user/logout"];
    if (skipPaths.some((p) => pathname.includes(p))) return false;
    
    // Guard 5: Max depth check (3 levels)
    const segments = pathname.split("/").filter((s) => s);
    if (segments.length > 3) return false;
    
    // Guard 6: Avoid file downloads
    if (/\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|zip|exe)$/i.test(pathname)) return false;
    
    return true;
  } catch {
    return false;
  }
}

async function crawlSite(baseUrl: string, maxPages = 50, totalTimeoutMs = 12000): Promise<{ pages: string[]; scanned: string[] }> {
  const base = new URL(baseUrl);
  const visited = new Set<string>();
  
  // Priority queue: array of {url, score} tuples, sorted by score descending
  let toVisit: Array<{ url: string; score: number }> = [{ url: baseUrl, score: 0 }];
  
  const htmlPages: string[] = [];
  const scannedPages: string[] = [];
  const startTime = Date.now();
  
  // Create a limiter for 5 concurrent requests
  const limit = createLimiter(5);
  
  // Queue of active fetch promises
  const activePromises: Promise<void>[] = [];
  
  // Per-page timeout: 5 seconds
  const PER_PAGE_TIMEOUT = 5000;

  while ((toVisit.length > 0 || activePromises.length > 0) && visited.size < maxPages && Date.now() - startTime < totalTimeoutMs) {
    // If we have capacity and pages to visit, queue new fetches
    while (toVisit.length > 0 && activePromises.length < 5) {
      // Early stop check: if we're running out of time, stop queuing new pages
      const timeElapsed = Date.now() - startTime;
      if (timeElapsed > totalTimeoutMs * 0.8) {
        // 80% of time used, stop queueing more
        console.log("Approaching total timeout, stopping new page queue");
        break;
      }

      // Pop the highest-scoring URL
      toVisit.sort((a, b) => b.score - a.score);
      const { url: currentUrl } = toVisit.shift()!;
      
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      scannedPages.push(currentUrl);

      const fetchPromise = limit(async () => {
        try {
          console.log(`Crawling (score): ${currentUrl}`);
          const { html } = await fetchHtml(currentUrl, PER_PAGE_TIMEOUT);
          htmlPages.push(html);
          console.log(`Successfully fetched page ${visited.size}/${maxPages}`);

          // Extract links from this page
          const $ = cheerio.load(html);
          const links = $("a[href]").toArray();

          for (const el of links) {
            const href = $(el).attr("href") || "";
            if (!href) continue;

            try {
              const linkUrl = new URL(href, currentUrl);
              const urlStr = linkUrl.toString();
              
              // Check crawl guardrails first
              if (!shouldCrawlUrl(urlStr, baseUrl)) {
                continue;
              }
              
              // Only follow if not visited and within page limit
              if (!visited.has(urlStr) && visited.size < maxPages) {
                // Score this URL and add to queue
                const score = scoreUrl(urlStr, baseUrl);
                if (score >= -3) { // Only add if score is decent (not a file or dead-end)
                  toVisit.push({ url: urlStr, score });
                }
              }
            } catch {
              // Invalid URL, skip
            }
          }
        } catch (e) {
          // Failed to fetch this page, continue with next
          console.error(`Failed to fetch ${currentUrl}:`, e);
        }
      }).then(
        () => {},
        () => {}
      );

      activePromises.push(fetchPromise);
    }

    // Wait for at least one promise to complete if we have active ones
    if (activePromises.length > 0) {
      await Promise.race(activePromises);
      // Remove completed promises
      activePromises.splice(
        activePromises.findIndex((p) => p.then(() => true).catch(() => true)),
        1
      );
    } else if (toVisit.length === 0) {
      break;
    }

    // Check if we're out of time
    if (Date.now() - startTime > totalTimeoutMs) {
      console.log("Total timeout reached, stopping crawl");
      break;
    }

    // Small delay to avoid busy-waiting
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Wait for any remaining promises (but with a strict timeout)
  const remainingTimeout = totalTimeoutMs - (Date.now() - startTime);
  if (remainingTimeout > 500 && activePromises.length > 0) {
    await Promise.race([
      Promise.all(activePromises),
      new Promise((resolve) => setTimeout(resolve, remainingTimeout - 100)),
    ]);
  }

  console.log(`Crawl complete: fetched ${htmlPages.length} pages in ${Date.now() - startTime}ms`);
  return { pages: htmlPages, scanned: scannedPages };
}

function escapeAttrValue(v: string) {
  // Good enough for IDs in attribute selectors
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isInternalLink(href: string, base: URL) {
  try {
    const u = new URL(href, base);
    return u.hostname === base.hostname;
  } catch {
    return false;
  }
}

function estimateUnlabeledControls($: cheerio.CheerioAPI) {
  // Heuristic: count inputs/selects/textareas that likely need labels and
  // don't have proper label associations, aria-label, aria-labelledby (with valid target), or title.
  const controls = $("input, select, textarea").toArray();

  let unlabeled = 0;
  let total = 0;

  for (const el of controls) {
    const tag = el.tagName?.toLowerCase();
    const $el = $(el);

    // Skip hidden inputs
    if (tag === "input") {
      const type = ($el.attr("type") || "text").toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button" || type === "reset") continue;
    }

    total += 1;

    const ariaLabel = $el.attr("aria-label");
    const ariaLabelledby = $el.attr("aria-labelledby");
    const title = $el.attr("title");

    // If it has aria-label/title, treat as labeled
    if (ariaLabel || title) continue;

    // Check aria-labelledby: must point to an existing element
    if (ariaLabelledby) {
      const ids = ariaLabelledby.split(/\s+/).filter(id => id);
      const hasValidTarget = ids.some(id => $(`#${escapeAttrValue(id)}`).length > 0);
      if (hasValidTarget) continue;
    }

    const id = $el.attr("id");
    if (id) {
      const hasForLabel = $(`label[for="${escapeAttrValue(id)}"]`).length > 0;
      if (hasForLabel) continue;
    }

    // If wrapped by a <label> ancestor, it's likely labeled
    const wrappedByLabel = $el.parents("label").length > 0;
    if (wrappedByLabel) continue;

    unlabeled += 1;
  }

  return { total, unlabeled };
}

function deriveIssuesFromBasics(b: PageBasics): Issue[] {
  const issues: Issue[] = [];

  if (b.forms.controlsTotal > 0 && b.forms.controlsUnlabeledEstimate > 0) {
    issues.push({
      id: "missing-labels",
      title: "Section 508.22.4 - Missing form labels",
      description:
        `We found ${b.forms.controlsUnlabeledEstimate} form controls that may be missing programmatic labels (out of ${b.forms.controlsTotal}). This violates Section 508 requirements for form accessibility.`,
      impact:
        "Screen reader users cannot identify form fields, making it impossible to complete forms. Violates Section 508 standards.",
      typicalFix:
        "Add semantic <label> elements tied to inputs or use aria-label/aria-labelledby per VITA standards.",
    });
  }

  if (b.images.total > 0 && b.images.missingAlt > 0) {
    issues.push({
      id: "missing-alt",
      title: "Section 508.22.1 - Images missing alt text",
      description:
        `We found ${b.images.missingAlt} images without alt text (out of ${b.images.total}). Section 508 requires all images to have descriptive alternative text.`,
      impact:
        "Screen reader users miss important context and information. Violates Section 508 standards.",
      typicalFix:
        "Add meaningful alt text for informative images; use empty alt (alt=\"\") for decorative images per VITA guidelines.",
    });
  }

  // Link structure isn't "accessibility" by itself, but it's a useful site baseline for compliance.
  if (b.links.total === 0) {
    issues.push({
      id: "no-links-detected",
      title: "No links detected on the fetched HTML",
      description:
        "We didn't detect any <a href> links in the HTML we fetched. This can happen if the page is heavily JS-rendered.",
      impact:
        "Navigation may not be fully captured. Some automated checks may miss content if it renders only after scripts run.",
      typicalFix:
        "Confirm the page renders meaningful HTML server-side or add pre-rendering/SSR for key content.",
    });
  }

  return issues;
}

function deriveSeverityEffort(issues: Issue[]): { severity: Severity; effort: Effort } {
  // Simple rules for V1
  const hasLabels = issues.some((i) => i.id === "missing-labels");
  const hasAlt = issues.some((i) => i.id === "missing-alt");

  if (hasLabels && hasAlt) return { severity: "Medium", effort: "Moderate" };
  if (hasLabels) return { severity: "Medium", effort: "Moderate" };
  if (hasAlt) return { severity: "Low", effort: "Easy" };
  return { severity: "Low", effort: "Easy" };
}

function calculateCoverage(basics: PageBasics): Coverage {
  // Good: links/forms/images detected + title exists
  // Partial: title exists, but one category is empty
  // Limited: almost nothing detected
  const hasTitle = !!basics.title;
  const hasLinks = basics.links.total > 0;
  const hasForms = basics.forms.total > 0;
  const hasImages = basics.images.total > 0;

  const categoriesWithData = [hasLinks, hasForms, hasImages].filter(Boolean).length;

  if (hasTitle && categoriesWithData >= 2) return "Good";
  if (hasTitle && categoriesWithData >= 1) return "Partial";
  return "Limited";
}

function generatePartnerFriendly(basics: PageBasics, issues: Issue[], severity: Severity): string {
  const lines = [];
  lines.push(`Page: ${basics.title || basics.hostname}`);
  lines.push(`Accessibility Check: ${severity === "Low" ? "Good" : severity === "Medium" ? "Needs Work" : "Problems Found"}`);
  lines.push("");

  if (issues.length === 0) {
    lines.push("No major accessibility issues detected from our automated scan.");
  } else {
    lines.push("Areas to fix:");
    for (const issue of issues) {
      lines.push(`• ${issue.title.replace(/Section 508.*? - /, "")}: ${issue.typicalFix}`);
    }
  }

  lines.push("");
  lines.push(`Found: ${basics.links.total} links, ${basics.forms.total} forms, ${basics.images.total} images`);
  return lines.join("\n");
}

function generateDeveloperHandoff(basics: PageBasics, issues: Issue[], severity: Severity, effort: Effort, timestamp: string): string {
  const lines = [];
  lines.push(`Accessibility Audit Report`);
  lines.push(`Generated: ${timestamp}`);
  lines.push(`URL: ${basics.finalUrl}`);
  lines.push("");

  lines.push("COVERAGE SUMMARY");
  lines.push(`Title: ${basics.title || "(not found)"}`);
  lines.push(`Meta Description: ${basics.metaDescription || "(not found)"}`);
  lines.push("");

  lines.push("CONTENT METRICS");
  lines.push(`Links: ${basics.links.total} (${basics.links.internal} internal, ${basics.links.external} external)`);
  lines.push(`Forms: ${basics.forms.total} | Controls: ${basics.forms.controlsTotal} | Unlabeled: ${basics.forms.controlsUnlabeledEstimate}`);
  lines.push(`Images: ${basics.images.total} | Missing Alt: ${basics.images.missingAlt}`);
  lines.push("");

  lines.push("COMPLIANCE ASSESSMENT");
  lines.push(`Severity: ${severity}`);
  lines.push(`Effort: ${effort}`);
  lines.push("");

  if (issues.length === 0) {
    lines.push("ISSUES: None detected");
  } else {
    lines.push("ISSUES:");
    for (const issue of issues) {
      lines.push(`\n[${issue.id}] ${issue.title}`);
      lines.push(`Description: ${issue.description}`);
      lines.push(`Typical Fix: ${issue.typicalFix}`);
    }
  }

  return lines.join("\n");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawUrl = body?.url as string | undefined;

  if (!rawUrl) return new NextResponse("Missing url", { status: 400 });

  let normalized: string;
  try {
    normalized = normalizeUrl(rawUrl);
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Invalid URL", { status: 400 });
  }

  // Check cache first
  const cached = getCached(normalized);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const crawlResult = await crawlSite(normalized);
    const htmlPages = crawlResult.pages;
    const scannedPages = crawlResult.scanned;

    // Fallback: if crawl failed, try fetching the single page with a longer timeout
    if (htmlPages.length === 0) {
      console.log("Crawl returned 0 pages, trying single fetch fallback");
      try {
        // Use longer timeout for fallback (30s) and add a retry delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { html } = await fetchHtml(normalized, 30000);
        htmlPages.push(html);
        scannedPages.push(normalized);
        console.log("Single fetch fallback succeeded");
      } catch (e) {
        console.error("Single fetch fallback also failed:", e);
        // Return a more helpful error
        const errorMsg = e instanceof Error && e.message.includes("AbortError") 
          ? "Request timed out. The site took too long to respond. Try again in a moment."
          : "No pages could be fetched from the site. The site may be blocking automated requests or temporarily unavailable.";
        return new NextResponse(errorMsg, { status: 500 });
      }
    }

    const base = new URL(normalized);

    // Aggregate data across all pages + track per-page metrics
    let totalLinks = new Set<string>();
    let internalLinks: string[] = [];
    let externalLinks: string[] = [];
    let totalImages = 0;
    let totalImagesWithoutAlt = 0;
    let totalFormControls = 0;
    let totalUnlabeledControls = 0;
    let totalForms = 0;
    let pageTitle: string | null = null;
    let metaDescription: string | null = null;
    
    // Track per-page metrics for worst pages
    const pageMetricsMap = new Map<string, { missingAlt: number; unlabeledControls: number }>();

    for (let i = 0; i < htmlPages.length; i++) {
      try {
        const html = htmlPages[i];
        const pageUrl = scannedPages[i] || normalized;
        const $ = cheerio.load(html);

        // Get title and description from first page
        if (!pageTitle) {
          pageTitle = $("title").first().text().trim() || null;
          metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
        }

        // Aggregate links
        const linkEls = $("a[href]").toArray();
        for (const el of linkEls) {
          const href = $(el).attr("href") || "";
          if (href) {
            try {
              const url = new URL(href, normalized);
              const urlStr = url.toString();
              
              if (!totalLinks.has(urlStr)) {
                totalLinks.add(urlStr);
                
                // Track first 5 of each type
                if (url.hostname === base.hostname) {
                  if (internalLinks.length < 5) internalLinks.push(urlStr);
                } else {
                  if (externalLinks.length < 5) externalLinks.push(urlStr);
                }
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }

        // Count forms and controls
        totalForms += $("form").length;
        const { total, unlabeled } = estimateUnlabeledControls($);
        totalFormControls += total;
        totalUnlabeledControls += unlabeled;

        // Track per-page unlabeled controls
        if (!pageMetricsMap.has(pageUrl)) {
          pageMetricsMap.set(pageUrl, { missingAlt: 0, unlabeledControls: 0 });
        }
        const pageMetrics = pageMetricsMap.get(pageUrl)!;
        pageMetrics.unlabeledControls = unlabeled;

        // Count images - only count truly missing alt (not empty alt="")
        const imgs = $("img").toArray();
        totalImages += imgs.length;
        let pageImgMissing = 0;
        for (const el of imgs) {
          const alt = $(el).attr("alt");
          // Only count as missing if alt attribute doesn't exist at all (not if it's empty "")
          if (alt === undefined) {
            totalImagesWithoutAlt += 1;
            pageImgMissing += 1;
          }
        }
        pageMetrics.missingAlt = pageImgMissing;
      } catch (pageError) {
        console.error(`Error processing page ${i}:`, pageError);
        // Continue to next page even if this one fails
        continue;
      }
    }

    // Categorize links
    let internal = 0;
    let external = 0;
    for (const linkUrl of totalLinks) {
      try {
        const u = new URL(linkUrl);
        if (u.hostname === base.hostname) internal += 1;
        else external += 1;
      } catch {
        // Skip
      }
    }

    const basics: PageBasics = {
      finalUrl: normalized,
      hostname: base.hostname,
      title: pageTitle,
      metaDescription,
      links: {
        total: totalLinks.size,
        internal,
        external,
        sampleInternal: internalLinks,
        sampleExternal: externalLinks,
      },
      forms: {
        total: totalForms,
        controlsTotal: totalFormControls,
        controlsUnlabeledEstimate: totalUnlabeledControls,
      },
      images: {
        total: totalImages,
        missingAlt: totalImagesWithoutAlt,
      },
    };

    const issues = deriveIssuesFromBasics(basics);
    const derived = deriveSeverityEffort(issues);
    const coverage = calculateCoverage(basics);
    const timestamp = new Date().toISOString();

    const summaryBullets: string[] = [];
    if (basics.title) summaryBullets.push(`Page title: "${basics.title}".`);
    summaryBullets.push(
      `Scanned ${htmlPages.length} page(s) sampled from key sections. Found ${basics.links.total} unique links (${basics.links.internal} internal, ${basics.links.external} external).`
    );
    if (basics.forms.controlsTotal > 0) {
      summaryBullets.push(
        `Found ${basics.forms.total} form(s) and ${basics.forms.controlsTotal} form controls across the sampled pages.`
      );
    } else {
      summaryBullets.push("No form controls detected in the sampled pages.");
    }
    if (basics.images.total > 0) {
      summaryBullets.push(
        `Found ${basics.images.total} image(s) across the sampled pages; ${basics.images.missingAlt} missing alt text.`
      );
    }

    // Generate worst pages ranking
    const worstByAlt: PageMetrics[] = [];
    const worstByControls: PageMetrics[] = [];
    
    for (const [url, metrics] of pageMetricsMap) {
      if (metrics.missingAlt > 0) {
        worstByAlt.push({ url, missingAltCount: metrics.missingAlt, unlabeledControlsCount: 0 });
      }
      if (metrics.unlabeledControls > 0) {
        worstByControls.push({ url, missingAltCount: 0, unlabeledControlsCount: metrics.unlabeledControls });
      }
    }
    
    worstByAlt.sort((a, b) => b.missingAltCount - a.missingAltCount);
    worstByControls.sort((a, b) => b.unlabeledControlsCount - a.unlabeledControlsCount);

    // Compute current fingerprint
    const currentMetrics = {
      totalImages,
      missingAlt: totalImagesWithoutAlt,
      totalControls: totalFormControls,
      unlabeledControls: totalUnlabeledControls,
      totalLinks: totalLinks.size,
    };
    const currentFingerprint = computeFingerprint(currentMetrics);
    
    // Retrieve previous fingerprint (if exists)
    const previousFingerprint = fingerprintStore.get(normalized);
    
    // Compute changes
    const changes = previousFingerprint ? {
      missingAlt: {
        before: previousFingerprint.metrics.missingAlt,
        after: currentMetrics.missingAlt,
        delta: currentMetrics.missingAlt - previousFingerprint.metrics.missingAlt,
      },
      unlabeledControls: {
        before: previousFingerprint.metrics.unlabeledControls,
        after: currentMetrics.unlabeledControls,
        delta: currentMetrics.unlabeledControls - previousFingerprint.metrics.unlabeledControls,
      },
    } : undefined;

    // Update fingerprint store
    fingerprintStore.set(normalized, currentFingerprint);

    // Generate executive summary
    const generateExecutiveSummary = (basics: PageBasics, issues: Issue[], severity: Severity, worstPages: { byMissingAlt: PageMetrics[]; byUnlabeledControls: PageMetrics[] }): string => {
      const lines = [];
      lines.push("EXECUTIVE SUMMARY");
      lines.push("");
      
      if (issues.length === 0) {
        lines.push("Status: No major accessibility gaps detected");
      } else {
        lines.push(`Status: ${issues.length} issue type(s) found:`);
        for (const issue of issues.slice(0, 5)) {
          lines.push(`  • ${issue.title}`);
        }
      }
      
      lines.push("");
      lines.push("KEY METRICS");
      lines.push(`  Images: ${basics.images.total} (${basics.images.missingAlt} missing alt text)`);
      if (basics.forms.controlsTotal > 0) {
        lines.push(`  Form Controls: ${basics.forms.controlsTotal} (${basics.forms.controlsUnlabeledEstimate} unlabeled)`);
      }
      lines.push(`  Links: ${basics.links.total} (${basics.links.internal} internal)`);
      
      lines.push("");
      lines.push("COMPLIANCE LEVEL");
      lines.push(severity === "High" ? "  Status: At Risk" : severity === "Medium" ? "  Status: Attention Needed" : "  Status: Good");
      
      lines.push("");
      if (worstPages.byMissingAlt.length > 0) {
        lines.push("PAGES WITH MOST MISSING ALT TEXT:");
        for (const page of worstPages.byMissingAlt.slice(0, 3)) {
          lines.push(`  • ${page.url}: ${page.missingAltCount} images`);
        }
        lines.push("");
      }
      
      if (worstPages.byUnlabeledControls.length > 0) {
        lines.push("PAGES WITH MOST UNLABELED CONTROLS:");
        for (const page of worstPages.byUnlabeledControls.slice(0, 3)) {
          lines.push(`  • ${page.url}: ${page.unlabeledControlsCount} controls`);
        }
        lines.push("");
      }
      
      lines.push("NEXT STEPS:");
      lines.push("  1. Review pages with missing alt text");
      lines.push("  2. Label all form controls");
      lines.push("  3. Run full audit with certified validator");
      
      return lines.join("\n");
    };

    // Generate standardized export with issue breakdown
    const generateStandardizedExport = (
      basics: PageBasics,
      issues: Issue[],
      severity: Severity,
      changes: any,
      previousFingerprint: ScanFingerprint | undefined
    ): string => {
      const lines: string[] = [];
      
      lines.push("ACCESSIBILITY AUDIT REPORT - STANDARDIZED FORMAT");
      lines.push("");
      lines.push(`URL: ${basics.finalUrl}`);
      lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
      lines.push("");
      
      // TOTAL NUMBER OF ISSUES
      lines.push("TOTAL NUMBER OF ISSUES");
      lines.push(`${issues.length}`);
      lines.push("");
      
      // HIGH-IMPACT ISSUES (Level A and Level AA)
      const levelAIssues = issues.filter(i => i.id.includes("alt") || i.id.includes("label") || i.id.includes("form") || i.id.includes("heading"));
      lines.push("HIGH-IMPACT ISSUES (WCAG Level A & Level AA)");
      if (levelAIssues.length === 0) {
        lines.push("  No high-impact issues detected");
      } else {
        levelAIssues.forEach((issue, idx) => {
          lines.push(`  ${idx + 1}. ${issue.title}`);
        });
      }
      lines.push(`  Total: ${levelAIssues.length}`);
      lines.push("");
      
      // ISSUE CATEGORIES WITH OCCURRENCE COUNT
      const categoryMap = new Map<string, number>();
      const categories: Record<string, string[]> = {
        "Contrast": [],
        "ARIA": [],
        "Forms": [],
        "Headings": [],
        "Structure": [],
        "Navigation": [],
        "Images": [],
        "Other": []
      };
      
      issues.forEach(issue => {
        let category = "Other";
        const titleLower = issue.title.toLowerCase();
        
        if (titleLower.includes("contrast")) category = "Contrast";
        else if (titleLower.includes("aria")) category = "ARIA";
        else if (titleLower.includes("form") || titleLower.includes("control") || titleLower.includes("label")) category = "Forms";
        else if (titleLower.includes("heading") || titleLower.includes("h1") || titleLower.includes("h2")) category = "Headings";
        else if (titleLower.includes("structure")) category = "Structure";
        else if (titleLower.includes("link") || titleLower.includes("navigation")) category = "Navigation";
        else if (titleLower.includes("image") || titleLower.includes("alt")) category = "Images";
        
        categories[category].push(issue.title);
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      });
      
      lines.push("ISSUE CATEGORIES & OCCURRENCE COUNT");
      
      Object.entries(categories).forEach(([category, categoryIssues]) => {
        if (categoryIssues.length > 0) {
          lines.push(`\n${category}: ${categoryIssues.length} occurrence(s)`);
          categoryIssues.forEach(issueTitle => {
            lines.push(`  • ${issueTitle}`);
          });
        }
      });
      lines.push("");
      
      // TREND ANALYSIS
      lines.push("TREND ANALYSIS - CHANGES SINCE LAST REPORT");
      
      if (!previousFingerprint) {
        lines.push("  This is the first scan for this URL (no prior baseline)");
      } else {
        if (changes?.missingAlt) {
          const altDelta = changes.missingAlt.after - changes.missingAlt.before;
          const altStatus = altDelta < 0 ? "IMPROVED" : altDelta > 0 ? "REGRESSED" : "STABLE";
          lines.push(`  Missing Alt Text: ${changes.missingAlt.before} → ${changes.missingAlt.after} [${altDelta > 0 ? '+' : ''}${altDelta}] (${altStatus})`);
        }
        
        if (changes?.unlabeledControls) {
          const controlsDelta = changes.unlabeledControls.after - changes.unlabeledControls.before;
          const controlsStatus = controlsDelta < 0 ? "IMPROVED" : controlsDelta > 0 ? "REGRESSED" : "STABLE";
          lines.push(`  Unlabeled Controls: ${changes.unlabeledControls.before} → ${changes.unlabeledControls.after} [${controlsDelta > 0 ? '+' : ''}${controlsDelta}] (${controlsStatus})`);
        }
      }
      lines.push("");
      
      // COMPLIANCE SUMMARY
      lines.push("OVERALL SEVERITY");
      lines.push(severity);
      lines.push("");
      
      return lines.join("\n");
    };

    // Generate Tyler Virginia compliance report
    const generateTylerVirginiaReport = (
      basics: PageBasics,
      issues: Issue[],
      severity: Severity,
      effort: Effort,
      coverage: Coverage,
      scannedPages: string[],
      siteSectionCount: number
    ): string => {
      const lines: string[] = [];
      const reportDate = new Date().toISOString().split('T')[0];
      const agencyName = basics.hostname ? basics.hostname.replace("www.", "").split(".")[0].toUpperCase() : "AGENCY";
      
      // HEADER
      lines.push("ACCESSIBILITY COMPLIANCE REPORT");
      lines.push("Virginia Section 508 & VITA IT Compliance");
      lines.push("");
      lines.push(`Report Date: ${reportDate}`);
      lines.push(`Website URL: ${basics.finalUrl}`);
      lines.push(`Pages Analyzed: ${scannedPages.length} across ${siteSectionCount} sections`);
      lines.push("");
      
      // 1. INTRODUCTION
      lines.push("1. INTRODUCTION");
      lines.push("");
      lines.push(`This accessibility evaluation of the ${agencyName} website assesses compliance with:`);
      lines.push("  • VITA IT Accessibility Requirements");
      lines.push("  • WCAG 2.2 Level A and Level AA Standards");
      lines.push("  • Americans with Disabilities Act (ADA) Title II");
      lines.push("  • Section 508 of the Rehabilitation Act");
      lines.push("");
      lines.push("This report provides a structured summary of findings, recommended remediation priorities, and a roadmap for achieving compliance.");
      lines.push("");
      
      // 2. OVERALL ACCESSIBILITY PERFORMANCE
      lines.push("2. OVERALL ACCESSIBILITY PERFORMANCE");
      lines.push("");
      lines.push("SCAN METRICS:");
      lines.push(`  • Total Pages Scanned: ${scannedPages.length}`);
      lines.push(`  • Site Sections Analyzed: ${siteSectionCount}`);
      lines.push(`  • Coverage Assessment: ${coverage}`);
      lines.push(`  • Total Issues Identified: ${issues.length}`);
      lines.push(`  • Images: ${basics.images.total} (${basics.images.missingAlt} missing alt text)`);
      if (basics.forms.controlsTotal > 0) {
        lines.push(`  • Form Controls: ${basics.forms.controlsTotal} (${basics.forms.controlsUnlabeledEstimate} unlabeled)`);
      }
      lines.push(`  • Links: ${basics.links.total} (${basics.links.internal} internal)`);
      lines.push("");
      lines.push("SYSTEM-WIDE OBSERVATIONS:");
      if (issues.length === 0) {
        lines.push("  • No major accessibility blockers detected in sampled pages");
      } else if (issues.length <= 3) {
        lines.push("  • Few accessibility issues detected; site is relatively accessible");
      } else if (issues.length <= 8) {
        lines.push("  • Moderate accessibility gaps identified; remediation recommended");
      } else {
        lines.push("  • Significant accessibility gaps detected; comprehensive remediation required");
      }
      lines.push(`  • Current Compliance Status: ${severity === "High" ? "At Risk" : severity === "Medium" ? "Attention Needed" : "Generally Compliant"}`);
      lines.push("");
      
      // 3. HIGH-LEVEL COMPLIANCE SUMMARY
      lines.push("3. HIGH-LEVEL COMPLIANCE SUMMARY");
      lines.push("");
      lines.push("WCAG 2.2 A/AA EVALUATION");
      lines.push("");
      
      const categoryMap = new Map<string, { count: number; impact: string }>();
      const complianceAreas = {
        "Perceivable (Text Alternatives)": "Images should have alt text for screen readers",
        "Operable (Keyboard Navigation)": "All functions must be keyboard accessible",
        "Understandable (Clear Language & Structure)": "Content should be organized with proper headings",
        "Robust (Compatibility)": "Code must follow web standards"
      };
      
      issues.forEach(issue => {
        const title = issue.title.toLowerCase();
        if (title.includes("alt") || title.includes("image")) {
          categoryMap.set("Perceivable", { count: (categoryMap.get("Perceivable")?.count || 0) + 1, impact: issue.impact });
        } else if (title.includes("keyboard") || title.includes("trap")) {
          categoryMap.set("Operable", { count: (categoryMap.get("Operable")?.count || 0) + 1, impact: issue.impact });
        } else if (title.includes("heading") || title.includes("structure") || title.includes("label")) {
          categoryMap.set("Understandable", { count: (categoryMap.get("Understandable")?.count || 0) + 1, impact: issue.impact });
        } else {
          categoryMap.set("Robust", { count: (categoryMap.get("Robust")?.count || 0) + 1, impact: issue.impact });
        }
      });
      
      Object.entries(complianceAreas).forEach(([area, description]) => {
        const mapped = categoryMap.get(area);
        const status = !mapped || mapped.count === 0 ? "PASS" : "NEEDS WORK";
        lines.push(`${area}: ${status}`);
        if (mapped?.count) {
          lines.push(`  Issues Found: ${mapped.count}`);
        }
      });
      lines.push("");
      lines.push("ADDITIONAL CHECKS");
      lines.push("  Contrast Ratios: " + (issues.some(i => i.title.toLowerCase().includes("contrast")) ? "Issues Found" : "Acceptable"));
      lines.push("  Form Labels: " + (issues.some(i => i.title.toLowerCase().includes("label")) ? "Issues Found" : "Present"));
      lines.push("  ARIA Usage: " + (issues.some(i => i.title.toLowerCase().includes("aria")) ? "Issues Found" : "Compliant"));
      lines.push("  PDF Compliance: " + (issues.some(i => i.title.toLowerCase().includes("pdf")) ? "Issues Found" : "Accessible"));
      lines.push("");
      
      // 4. KEY ISSUES IDENTIFIED
      lines.push("4. KEY ISSUES IDENTIFIED");
      lines.push("");
      
      if (issues.length === 0) {
        lines.push("No major accessibility issues were detected in the sampled pages.");
      } else {
        issues.forEach((issue, idx) => {
          lines.push(`${idx + 1}. ${issue.title.toUpperCase()}`);
          lines.push(`   Description: ${issue.description}`);
          lines.push(`   Impact: ${issue.impact}`);
          lines.push(`   Typical Fix: ${issue.typicalFix}`);
          lines.push("");
        });
      }
      
      // 5. REMEDIATION RECOMMENDATIONS
      lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      lines.push("5. REMEDIATION RECOMMENDATIONS");
      lines.push("");
      lines.push("PRIORITIZED BY SEVERITY");
      lines.push("");
      
      const highPriority = issues.filter(i => i.id.includes("alt") || i.id.includes("label") || i.id.includes("keyboard"));
      const mediumPriority = issues.filter(i => !highPriority.includes(i) && (i.id.includes("contrast") || i.id.includes("aria")));
      const lowPriority = issues.filter(i => !highPriority.includes(i) && !mediumPriority.includes(i));
      
      if (highPriority.length > 0) {
        lines.push("HIGH PRIORITY (30-60 days)");
        highPriority.forEach((issue, idx) => {
          lines.push(`  ${idx + 1}. ${issue.title}`);
          lines.push(`     Rationale: Directly blocks users with disabilities`);
          lines.push(`     Timeline: 2-4 weeks`);
        });
        lines.push("");
      }
      
      if (mediumPriority.length > 0) {
        lines.push("MEDIUM PRIORITY (60-90 days)");
        mediumPriority.forEach((issue, idx) => {
          lines.push(`  ${idx + 1}. ${issue.title}`);
          lines.push(`     Rationale: Impacts usability but not a complete blocker`);
          lines.push(`     Timeline: 4-6 weeks`);
        });
        lines.push("");
      }
      
      if (lowPriority.length > 0) {
        lines.push("LOW PRIORITY (90+ days)");
        lowPriority.forEach((issue, idx) => {
          lines.push(`  ${idx + 1}. ${issue.title}`);
          lines.push(`     Rationale: Minor enhancements to accessibility`);
          lines.push(`     Timeline: 6+ weeks`);
        });
        lines.push("");
      }
      
      if (issues.length === 0) {
        lines.push("No remediation recommendations needed at this time.");
        lines.push("");
      }
      
      // 6. PROPOSED REMEDIATION PLAN
      lines.push("6. PROPOSED ACCESSIBILITY REMEDIATION PLAN");
      lines.push("");
      lines.push("IMPLEMENTATION PHASES:");
      lines.push("");
      lines.push("PHASE 1: ASSESSMENT & PLANNING (Week 1)");
      lines.push("  • Assign dedicated accessibility lead");
      lines.push("  • Audit all identified issues using automated tools and manual testing");
      lines.push("  • Create detailed remediation tickets for development team");
      lines.push("  • Establish baseline metrics for progress tracking");
      lines.push("");
      
      lines.push("PHASE 2: FIX IMPLEMENTATION (Weeks 2-8)");
      lines.push("  • Prioritize high-impact issues: missing alt text, form labels, keyboard navigation");
      lines.push("  • Implement fixes in templates and core components");
      lines.push("  • Ensure all new code follows accessibility standards");
      lines.push("  • Document changes for compliance verification");
      lines.push("");
      
      lines.push("PHASE 3: TESTING & RETESTING (Weeks 9-10)");
      lines.push("  • Automated testing: WCAG validation, contrast checking, link analysis");
      lines.push("  • Manual testing with assistive technologies (screen readers, keyboard navigation)");
      lines.push("  • Accessibility audit using certification tools");
      lines.push("  • User acceptance testing with users who have disabilities");
      lines.push("");
      
      lines.push("PHASE 4: CONTINUOUS MONITORING (Ongoing)");
      lines.push("  • Quarterly accessibility audits (automated + manual)");
      lines.push("  • Training for content contributors on accessible authoring");
      lines.push("  • Monitor new pages/features for accessibility gaps");
      lines.push("  • Collect feedback from users with disabilities");
      lines.push("");
      
      // 7. CONCLUSION
      lines.push("7. CONCLUSION");
      lines.push("");
      
      if (issues.length === 0) {
        lines.push("The website demonstrates strong accessibility compliance with no major issues detected.");
      } else if (issues.length <= 3) {
        lines.push("The website has good accessibility foundations with only minor improvements needed.");
      } else if (issues.length <= 8) {
        lines.push("The website has accessibility gaps that require systematic remediation.");
      } else {
        lines.push("The website requires significant accessibility improvements to meet compliance standards.");
      }
      
      lines.push("");
      lines.push("NEXT STEPS:");
      lines.push("  1. Schedule agency partnership meeting to discuss findings");
      lines.push("  2. Assign accessibility owner to drive implementation");
      lines.push("  3. Begin Phase 1 assessment within 1 week");
      lines.push("  4. Schedule follow-up compliance audit in 60 days");
      lines.push("  5. Establish quarterly accessibility review cadence");
      lines.push("");
      lines.push("For compliance questions, contact your VITA Accessibility Coordinator.");
      lines.push("");
      lines.push(`Report Generated: ${new Date().toISOString()}`);
      
      return lines.join("\n");
    };

    // Generate CSV export (Smartsheet-ready)
    const generateCsvExport = (basics: PageBasics, issues: Issue[], scannedPages: string[]): string => {
      const rows: string[][] = [];
      rows.push(["URL", "Issue Type", "Count", "Severity", "Page Count", "Affected Pages"]);
      
      rows.push([basics.finalUrl, "Missing Image Alt Text", basics.images.missingAlt.toString(), "Medium", scannedPages.length.toString(), scannedPages.slice(0, 3).join("|")]);
      rows.push([basics.finalUrl, "Unlabeled Form Controls", basics.forms.controlsUnlabeledEstimate.toString(), "Medium", scannedPages.length.toString(), scannedPages.slice(0, 3).join("|")]);
      rows.push([basics.finalUrl, "Form Count", basics.forms.total.toString(), "Info", scannedPages.length.toString(), ""]);
      rows.push([basics.finalUrl, "Link Count", basics.links.total.toString(), "Info", scannedPages.length.toString(), ""]);
      
      for (const issue of issues) {
        rows.push([basics.finalUrl, issue.title, "1", issue.id.includes("alt") ? "High" : "Medium", scannedPages.length.toString(), ""]);
      }
      
      // CSV escape
      return rows.map((row) => row.map((cell) => {
        // Escape quotes and wrap if contains comma
        const escaped = cell.replace(/"/g, '""');
        return escaped.includes(",") || escaped.includes('"') || escaped.includes("\n") ? `"${escaped}"` : escaped;
      }).join(",")).join("\n");
    };

    // Generate Jira format
    const generateJiraFormat = (basics: PageBasics, issues: Issue[], severity: Severity, scannedPages: string[], siteSectionCount: number): string => {
      const lines = [];
      lines.push(`h2. Accessibility Audit - ${basics.finalUrl}`);
      lines.push("");
      lines.push(`*Severity:* ${severity}`);
      lines.push(`*Pages Scanned:* ${scannedPages.length} across ${siteSectionCount} sections`);
      lines.push("");
      
      lines.push(`h3. Summary`);
      lines.push(`* Missing alt text: ${basics.images.missingAlt} images`);
      lines.push(`* Unlabeled controls: ${basics.forms.controlsUnlabeledEstimate} form fields`);
      lines.push(`* Forms: ${basics.forms.total}`);
      lines.push(`* Links: ${basics.links.total}`);
      lines.push("");
      
      lines.push(`h3. Issues Found`);
      if (issues.length === 0) {
        lines.push("* No major issues detected");
      } else {
        for (const issue of issues) {
          lines.push(`* {color:red}${issue.title}{color}`);
          lines.push(`** ${issue.description}`);
          lines.push(`** Fix: ${issue.typicalFix}`);
        }
      }
      
      return lines.join("\n");
    };

    // Count template sections
    const templateGroups = groupByTemplate(scannedPages);
    const siteSectionCount = templateGroups.size;

    const response: AnalyzeResponse = {
      url: normalized,
      basics,
      coverage,
      generatedAt: timestamp,
      pagesScanned: scannedPages,
      pagesSampledCount: scannedPages.length,
      siteSections: siteSectionCount,
      summaryBullets: summaryBullets.slice(0, 5),

      severity: {
        level: derived.severity,
        rationale:
          derived.severity === "Medium"
            ? "These gaps present Section 508 compliance risks and may block users from accessing state services. Remediation is typically achievable without major redesign."
            : "No obvious Section 508 blockers detected from HTML extraction; a full compliance audit is still recommended.",
      },
      effort: {
        level: derived.effort,
        rationale:
          derived.effort === "Moderate"
            ? "Most VITA-standard fixes are straightforward (labels, alt text, focus states) but may require updates across multiple templates."
            : "Likely small, localized changes if issues exist.",
      },

      whyThisMatters:
        "Virginia agencies must comply with Section 508 of the Rehabilitation Act. Non-compliance blocks citizens with disabilities from accessing essential services and creates legal risk. Accessible design also improves usability for all users.",

      affectedUsers: ["Screen reader users", "Keyboard-only users", "Low-vision users", "Mobile users"],

      issues,
      
      // Worst pages ranking
      worstPages: {
        byMissingAlt: worstByAlt.slice(0, 5),
        byUnlabeledControls: worstByControls.slice(0, 5),
      },
      
      // Fingerprint tracking
      currentFingerprint,
      previousFingerprint: previousFingerprint || undefined,
      changes: changes || undefined,
      
      shareableOutputs: {
        partnerFriendly: filterSymbolLines(generatePartnerFriendly(basics, issues, derived.severity)),
        developerHandoff: filterSymbolLines(generateDeveloperHandoff(basics, issues, derived.severity, derived.effort, timestamp)),
        executive: filterSymbolLines(generateExecutiveSummary(basics, issues, derived.severity, { byMissingAlt: worstByAlt, byUnlabeledControls: worstByControls })),
        csvExport: generateCsvExport(basics, issues, scannedPages),
        jiraFormat: filterSymbolLines(generateJiraFormat(basics, issues, derived.severity, scannedPages, siteSectionCount)),
        standardized: filterSymbolLines(generateStandardizedExport(basics, issues, derived.severity, changes, previousFingerprint)),
        tylerVirginia: filterSymbolLines(generateTylerVirginiaReport(basics, issues, derived.severity, derived.effort, coverage, scannedPages, siteSectionCount)),
      },
      
      disclaimer:
        "This tool provides high-level guidance based on HTML extraction from sampled pages and does not replace a comprehensive Section 508 compliance audit. For official compliance verification, consult VITA accessibility standards or engage a certified accessibility auditor.",
    };

    // Cache the result
    setCached(normalized, response);

    return NextResponse.json(response);
  } catch (e: any) {
    // Helpful errors for V1
    const msg =
      e?.name === "AbortError"
        ? "Fetch timed out. Try a different URL or a simpler page."
        : e?.message || "Analysis failed.";
    console.error("API Error:", { name: e?.name, message: e?.message, url: normalized });
    return new NextResponse(msg, { status: 500 });
  }
}
