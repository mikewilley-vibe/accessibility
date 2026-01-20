"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, Table, TableCell, TableRow } from "docx";

import type { AnalyzeResponse, Severity, Effort } from "@/lib/types";

const LOADING_MESSAGES = [
  "Reviewing page structure…",
  "Checking contrast and labels…",
  "Looking for keyboard and screen reader blockers…",
  "Summarizing findings in plain English…",
];

function severityBadgeVariant(level: Severity): "default" | "secondary" | "destructive" {
  if (level === "High") return "destructive";
  if (level === "Medium") return "default";
  return "secondary";
}

function effortBadgeVariant(level: Effort): "default" | "secondary" | "destructive" {
  if (level === "Complex") return "destructive";
  if (level === "Moderate") return "default";
  return "secondary";
}

function generateReportText(data: AnalyzeResponse): string {
  const lines = [
    `Accessibility Analysis Report`,
    `URL: ${data.url}`,
    ``,
    `SUMMARY`,
    ...data.summaryBullets.map((b) => `• ${b}`),
    ``,
    `SEVERITY: ${data.severity.level}`,
    data.severity.rationale,
    ``,
    `FIX EFFORT: ${data.effort.level}`,
    data.effort.rationale,
    ``,
    `WHY THIS MATTERS`,
    data.whyThisMatters,
    ``,
    `AFFECTED USERS`,
    ...data.affectedUsers.map((u) => `• ${u}`),
    ``,
    `ISSUES`,
    ...data.issues.flatMap((issue) => [
      ``,
      `${issue.title}`,
      `Description: ${issue.description}`,
      `Impact: ${issue.impact}`,
      `Typical Fix: ${issue.typicalFix}`,
    ]),
    ``,
    `DISCLAIMER`,
    data.disclaimer,
  ];
  return lines.join("\n");
}

function generateReportJSON(data: AnalyzeResponse): string {
  return JSON.stringify(data, null, 2);
}

export default function HomePage() {
  const [urls, setUrls] = React.useState<string>("");
  const [statusText, setStatusText] = React.useState(LOADING_MESSAGES[0]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<AnalyzeResponse[]>([]);
  const [displayMode, setDisplayMode] = React.useState<"executive" | "detailed">("executive");

  // Rotate loading messages while loading
  React.useEffect(() => {
    if (!loading) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setStatusText(LOADING_MESSAGES[i]);
    }, 900);
    return () => clearInterval(t);
  }, [loading]);

async function textToWordDocument(text: string): Promise<Blob> {
  const TITLE = "ACCESSIBILITY COMPLIANCE REPORT";
  const SUBTITLE = "Virginia Section 508 & VITA IT Compliance";

  // Insert a zero-width space after ":" so Word won't auto-detect as a hyperlink.
  // (Looks identical to humans, prevents blue hyperlink styling.)
  const deLinkify = (s: string) => s.replace(/https?:\/\//g, (m) => m.replace("://", ":\u200B//"));

  const makeRun = (t: string) =>
    new TextRun({
      text: deLinkify(t),
      color: "000000", // force black
    });

  const isDivider = (s: string) =>
    /^[═╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬─│┌┐└┘├┤┬┴┼\-=*_]{3,}$/.test(s) ||
    /^={3,}$/.test(s) || /^-{3,}$/.test(s) || /^\*{3,}$/.test(s) || /^_{3,}$/.test(s);

  const isAllCaps = (s: string) => s.length > 3 && s === s.toUpperCase();
  const isNumberedAllCaps = (s: string) => /^\d+\.\s+/.test(s) && isAllCaps(s.replace(/^\d+\.\s+/, ""));
  const isPhase = (s: string) => /^PHASE\s+\d+:/i.test(s);
  const isBullet = (s: string) => /^[•\-◦]\s+/.test(s);
  const isKeyValue = (s: string) => /^([^:]{2,60}):\s*(.+)$/.test(s);

  // 1) Split lines
  let lines = text.split("\n").map((l) => l.trimEnd());

  // 2) Remove ANY occurrences of TITLE/SUBTITLE anywhere in the body
  //    (Your sample input has them twice at the top)  [oai_citation:2‡accessibility-compliance-report-1768927521901.docx](sediment://file_00000000732c71fdb9c50bdd1bd41485)
  lines = lines.filter((l) => {
    const t = l.trim();
    if (!t) return true;
    return t !== TITLE && t !== SUBTITLE;
  });

  const paragraphs: Paragraph[] = [];

  // 3) Add title page ONCE
  paragraphs.push(new Paragraph({ text: "", spacing: { after: 350 } }));

  paragraphs.push(
    new Paragraph({
      children: [makeRun(TITLE)],
      heading: HeadingLevel.TITLE,
      alignment: "center",
      spacing: { before: 100, after: 150 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [makeRun(SUBTITLE)],
      alignment: "center",
      spacing: { after: 350 },
    })
  );

  paragraphs.push(new Paragraph({ text: "", spacing: { after: 150 } }));

  // 4) Body content with hierarchy
  for (const raw of lines) {
    const trimmed = raw.trim();

    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 80 } }));
      continue;
    }
    if (isDivider(trimmed)) continue;

    // Numbered section headers => H1
    if (isNumberedAllCaps(trimmed)) {
      paragraphs.push(
        new Paragraph({
          children: [makeRun(trimmed)],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 220, after: 120 },
        })
      );
      continue;
    }

    // All-caps groupings under numbered titles => H2 (subtitles)
    if (isAllCaps(trimmed) && (trimmed.endsWith(":") || trimmed.length >= 6)) {
      paragraphs.push(
        new Paragraph({
          children: [makeRun(trimmed)],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 80 },
        })
      );
      continue;
    }

    // Phase lines => H3
    if (isPhase(trimmed)) {
      paragraphs.push(
        new Paragraph({
          children: [makeRun(trimmed)],
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 150, after: 60 },
        })
      );
      continue;
    }

    // Bullets
    if (isBullet(trimmed)) {
      const bulletText = trimmed.replace(/^[•\-◦]\s+/, "");
      paragraphs.push(
        new Paragraph({
          children: [makeRun(bulletText)],
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
      continue;
    }

    // Key/value => bullet with regular text
    if (isKeyValue(trimmed)) {
      const match = trimmed.match(/^([^:]{2,60}):\s*(.+)$/);
      const label = match?.[1]?.trim() ?? "";
      const value = match?.[2]?.trim() ?? "";
      paragraphs.push(
        new Paragraph({
          children: [makeRun(`${label}: ${value}`)],
          bullet: { level: 0 },
          spacing: { after: 50 },
        })
      );
      continue;
    }

    // Regular paragraph
    paragraphs.push(
      new Paragraph({
        children: [makeRun(trimmed)],
        spacing: { after: 90 },
      })
    );
  }

  // 5) Explicitly force heading styles to black (prevents theme-blue headings)
  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { color: "000000" },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { color: "000000" },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { color: "000000" },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { color: "000000" },
        },
      ],
    },
    sections: [{ children: paragraphs }],
  });

  return await Packer.toBlob(doc);
}

  async function onDownloadReport(format: "executive" | "partner" | "developer" | "csv" | "jira" | "standardized" | "tylerVirginia" | "json", dataIndex: number = 0) {
    if (!results || results.length === 0 || !results[dataIndex]) return;
    const data = results[dataIndex];

    let content = "";
    let filename = "";

    switch (format) {
      case "executive":
        content = data.shareableOutputs.executive || "";
        filename = `accessibility-report-executive-${Date.now()}.docx`;
        break;
      case "partner":
        content = data.shareableOutputs.partnerFriendly;
        filename = `accessibility-report-partner-${Date.now()}.docx`;
        break;
      case "developer":
        content = data.shareableOutputs.developerHandoff;
        filename = `accessibility-report-developer-${Date.now()}.docx`;
        break;
      case "csv":
        content = data.shareableOutputs.csvExport || "";
        filename = `accessibility-report-${Date.now()}.csv`;
        break;
      case "jira":
        content = data.shareableOutputs.jiraFormat || "";
        filename = `accessibility-report-jira-${Date.now()}.docx`;
        break;
      case "standardized":
        content = data.shareableOutputs.standardized || "";
        filename = `accessibility-report-standardized-${Date.now()}.docx`;
        break;
      case "tylerVirginia":
        content = data.shareableOutputs.tylerVirginia || "";
        filename = `accessibility-compliance-report-${Date.now()}.docx`;
        break;
      case "json":
        content = JSON.stringify(data, null, 2);
        filename = `accessibility-report-${Date.now()}.json`;
        break;
    }

    if (!content) {
      alert(`No content available for ${format} format`);
      return;
    }

    let blob: Blob;
    
    // Generate Word documents for text-based formats
    if (["executive", "partner", "developer", "jira", "standardized", "tylerVirginia"].includes(format)) {
      blob = await textToWordDocument(content);
    } else {
      // CSV and JSON as plain text
      const mimeType = format === "csv" ? "text/csv" : "application/json";
      blob = new Blob([content], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults([]);

    const urlList = urls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urlList.length === 0) {
      setError("Paste at least one URL to analyze.");
      return;
    }

    setLoading(true);
    const analyzedResults: AnalyzeResponse[] = [];

    for (let i = 0; i < urlList.length; i++) {
      try {
        const trimmed = urlList[i];
        const normalized = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
        new URL(normalized);

        setStatusText(`Analyzing ${i + 1} of ${urlList.length}…`);

        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalized }),
        });

        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "Request failed");
        }

        const json = (await res.json()) as AnalyzeResponse;
        analyzedResults.push(json);
      } catch (err: any) {
        setError(`Error analyzing URL ${i + 1}: ${err?.message ?? "Something went wrong."}`);
        setLoading(false);
        return;
      }
    }

    setResults(analyzedResults);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight text-slate-900">Accessibly</span>
            <span className="text-sm text-slate-500">Section 508 & VITA compliance checker.</span>
          </div>
          <a href="/evidence">
            <Button variant="outline" size="sm">
              Compliance Evidence
            </Button>
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-10">
        {/* HERO */}
        <div className="mx-auto max-w-2xl">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-2xl tracking-tight">
                Check Section 508 and VITA compliance — without reading standards.
              </CardTitle>
              <CardDescription className="text-base">
                Paste a Virginia government website URL to get a plain-English assessment of Section 508 (Rehabilitation Act) and VITA accessibility standard compliance gaps, who they impact, and how hard they are to fix.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <form onSubmit={onAnalyze} className="space-y-3">
                <div className="flex flex-col gap-3">
                  <textarea
                    id="url-input"
                    name="urls"
                    value={urls}
                    onChange={(e) => setUrls(e.target.value)}
                    placeholder="https://example.gov&#10;https://another.gov&#10;example.org"
                    className="h-32 rounded-md border border-slate-200 px-3 py-2 font-mono text-sm"
                    aria-label="Website URLs (one per line)"
                  />
                  <Button type="submit" className="h-11 w-full sm:w-40" disabled={loading}>
                    {loading ? "Analyzing…" : "Analyze sites"}
                  </Button>
                </div>

                <div className="flex flex-col gap-1 text-xs text-slate-500">
                  <span>Enter one URL per line.</span>
                  <span>This does not perform a full audit.</span>
                  <span>Results are high-level and explanatory.</span>
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
              </form>

              {loading ? (
                <div className="rounded-2xl border bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                    <p className="text-sm text-slate-700">{statusText}</p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* RESULTS */}
        {results && results.length > 0 ? (
          <div className="mx-auto mt-10 max-w-3xl space-y-8">
            {results.map((data, index) => (
          <div key={index} className="space-y-6 border-b pb-8 last:border-b-0">
            {/* Coverage Badge + Display Mode Toggle + Action Buttons */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Report</h2>
                <div className="flex items-center gap-2">
                  <Badge variant={data.coverage === "Good" ? "secondary" : data.coverage === "Partial" ? "default" : "destructive"}>
                    Coverage: {data.coverage}
                  </Badge>
                  {data.siteSections && (
                    <Badge variant="outline">
                      {data.siteSections} sections
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Tyler Report Button (Visible) */}
              <div className="flex justify-center">
                <Button
                  onClick={() => onDownloadReport("tylerVirginia", index)}
                  variant="outline"
                  size="sm"
                  className="font-semibold"
                >
                  📋 Tyler Compliance Report
                </Button>
              </div>
              
              {/* Other Export Buttons (Hidden) */}
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-600 hover:text-slate-900">More export formats</summary>
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Button
                      onClick={() => onDownloadReport("standardized", index)}
                      variant="outline"
                      size="sm"
                    >
                      ↓ Standardized Report
                    </Button>
                    <Button
                      onClick={() => onDownloadReport("executive", index)}
                      variant="outline"
                      size="sm"
                    >
                      ↓ Executive Summary
                    </Button>
                    <Button
                      onClick={() => onDownloadReport("partner", index)}
                      variant="outline"
                      size="sm"
                    >
                      ↓ Partner-Friendly
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Button
                      onClick={() => onDownloadReport("developer", index)}
                      variant="outline"
                      size="sm"
                    >
                      ↓ Dev Handoff
                    </Button>
                    <Button
                      onClick={() => onDownloadReport("csv", index)}
                      variant="outline"
                      size="sm"
                    >
                      ↓ CSV Export
                    </Button>
                    <Button
                      onClick={() => onDownloadReport("jira", index)}
                      variant="outline"
                      size="sm"
                    >
                      ↓ Jira Format
                    </Button>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      onClick={() => onDownloadReport("json", index)}
                      variant="outline"
                      size="sm"
                    >
                      ↓ Full JSON
                    </Button>
                  </div>
                </div>
              </details>
              
              {/* Display Mode Toggle */}
              <div className="flex gap-2 border-t pt-3 justify-center">
                <Button
                  onClick={() => setDisplayMode("executive")}
                  variant={displayMode === "executive" ? "default" : "ghost"}
                  size="sm"
                  className="h-8"
                >
                  Executive View
                </Button>
                <Button
                  onClick={() => setDisplayMode("detailed")}
                  variant={displayMode === "detailed" ? "default" : "ghost"}
                  size="sm"
                  className="h-8"
                >
                  Detailed View
                </Button>
              </div>
            </div>

            {/* Summary */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Accessibility Summary</CardTitle>
                <CardDescription>Plain-English highlights for PMs and partners.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {displayMode === "executive" && (
                  <div className="space-y-3 border-b pb-3">
                    <div className="text-sm font-semibold text-slate-900">Quick Stats:</div>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 text-xs">
                      <div className="rounded bg-blue-50 p-2">
                        <div className="text-slate-600">Total Issues</div>
                        <div className="text-xl font-bold text-blue-700">{data.issues.length}</div>
                      </div>
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-600">Severity</div>
                        <div className="font-bold text-slate-900">{data.severity.level}</div>
                      </div>
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-600">Pages Scanned</div>
                        <div className="text-lg font-bold text-slate-900">{data.pagesSampledCount}</div>
                      </div>
                      <div className="rounded bg-slate-50 p-2">
                        <div className="text-slate-600">Fix Effort</div>
                        <div className="font-bold text-slate-900">{data.effort.level}</div>
                      </div>
                    </div>
                  </div>
                )}
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-800">
                  {data.summaryBullets.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Severity + Effort */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Overall Severity</CardTitle>
                  <CardDescription>How likely these issues block real users.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant={severityBadgeVariant(data.severity.level)} className="text-sm">
                    {data.severity.level}
                  </Badge>
                  <p className="text-sm text-slate-700">{data.severity.rationale}</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Estimated Fix Effort</CardTitle>
                  <CardDescription>Rough remediation complexity.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant={effortBadgeVariant(data.effort.level)} className="text-sm">
                    {data.effort.level}
                  </Badge>
                  <p className="text-sm text-slate-700">{data.effort.rationale}</p>
                </CardContent>
              </Card>
            </div>

            {/* Issues breakdown */}
            {displayMode === "detailed" ? (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Issues breakdown</CardTitle>
                <CardDescription>What's happening and typical fixes.</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {data.issues.map((issue) => (
                    <AccordionItem key={issue.id} value={issue.id}>
                      <AccordionTrigger className="text-left">
                        {issue.title}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 text-sm text-slate-800">
                          <p>{issue.description}</p>
                          <p className="text-slate-700">
                            <span className="font-medium text-slate-900">Impact:</span>{" "}
                            {issue.impact}
                          </p>
                          <p className="text-slate-700">
                            <span className="font-medium text-slate-900">Typical fix:</span>{" "}
                            {issue.typicalFix}
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                <p className="mt-4 text-xs text-slate-500">{data.disclaimer}</p>
              </CardContent>
            </Card>
            ) : (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Issues Summary</CardTitle>
                <CardDescription>Key findings</CardDescription>
              </CardHeader>
              <CardContent>
                {data.issues.length === 0 ? (
                  <p className="text-sm text-slate-800">✓ No major accessibility issues detected</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-900">{data.issues.length} issue type(s) found:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {data.issues.map((issue) => (
                        <li key={issue.id} className="text-sm text-slate-700">{issue.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-4 text-xs text-slate-500">{data.disclaimer}</p>
              </CardContent>
            </Card>
            )}

            {/* Why this matters + affected users */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Why this matters</CardTitle>
                <CardDescription>Framed for non-technical stakeholders.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-800">{data.whyThisMatters}</p>

                <Separator />

                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-900">Who is affected</div>
                  <div className="flex flex-wrap gap-2">
                    {data.affectedUsers.map((u) => (
                      <Badge key={u} variant="secondary" className="text-sm">
                        {u}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fingerprint Tracking (if previous scan exists) */}
            {displayMode === "detailed" && data.changes && (
              <Card className="rounded-2xl border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base text-blue-900">Progress Tracking</CardTitle>
                  <CardDescription className="text-blue-800">Changes since last scan</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-white p-3">
                      <div className="text-sm font-medium text-slate-900">Missing Alt Text</div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">{data.changes.missingAlt.after}</span>
                        <span className={`text-sm font-medium ${data.changes.missingAlt.delta < 0 ? "text-green-600" : data.changes.missingAlt.delta > 0 ? "text-red-600" : "text-slate-600"}`}>
                          {data.changes.missingAlt.delta > 0 ? "+" : ""}{data.changes.missingAlt.delta} from {data.changes.missingAlt.before}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <div className="text-sm font-medium text-slate-900">Unlabeled Controls</div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">{data.changes.unlabeledControls.after}</span>
                        <span className={`text-sm font-medium ${data.changes.unlabeledControls.delta < 0 ? "text-green-600" : data.changes.unlabeledControls.delta > 0 ? "text-red-600" : "text-slate-600"}`}>
                          {data.changes.unlabeledControls.delta > 0 ? "+" : ""}{data.changes.unlabeledControls.delta} from {data.changes.unlabeledControls.before}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Worst Pages Rankings */}
            {displayMode === "detailed" && ((data.worstPages?.byMissingAlt?.length ?? 0 > 0) || (data.worstPages?.byUnlabeledControls?.length ?? 0 > 0)) ? (
              <div className="grid gap-4 md:grid-cols-2">
                {(data.worstPages?.byMissingAlt?.length ?? 0) > 0 && (
                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-base">Pages with Most Missing Alt Text</CardTitle>
                      <CardDescription>Start remediation here</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {data.worstPages?.byMissingAlt.map((page, idx) => (
                          <li key={idx} className="flex items-start justify-between rounded-lg border bg-slate-50 p-2 text-sm">
                            <a href={page.url} target="_blank" rel="noopener noreferrer" className="flex-1 break-all text-blue-600 hover:underline">
                              {new URL(page.url).pathname}
                            </a>
                            <Badge variant="secondary" className="ml-2 shrink-0">
                              {page.missingAltCount}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                {(data.worstPages?.byUnlabeledControls?.length ?? 0) > 0 && (
                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-base">Pages with Most Unlabeled Controls</CardTitle>
                      <CardDescription>Form controls need labels</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {data.worstPages?.byUnlabeledControls.map((page, idx) => (
                          <li key={idx} className="flex items-start justify-between rounded-lg border bg-slate-50 p-2 text-sm">
                            <a href={page.url} target="_blank" rel="noopener noreferrer" className="flex-1 break-all text-blue-600 hover:underline">
                              {new URL(page.url).pathname}
                            </a>
                            <Badge variant="secondary" className="ml-2 shrink-0">
                              {page.unlabeledControlsCount}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}

            {/* Issues breakdown */}
            {displayMode === "detailed" ? (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Issues breakdown</CardTitle>
                <CardDescription>What's happening and typical fixes.</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {data.issues.map((issue) => (
                    <AccordionItem key={issue.id} value={issue.id}>
                      <AccordionTrigger className="text-left">
                        {issue.title}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 text-sm text-slate-800">
                          <p>{issue.description}</p>
                          <p className="text-slate-700">
                            <span className="font-medium text-slate-900">Impact:</span>{" "}
                            {issue.impact}
                          </p>
                          <p className="text-slate-700">
                            <span className="font-medium text-slate-900">Typical fix:</span>{" "}
                            {issue.typicalFix}
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                <p className="mt-4 text-xs text-slate-500">{data.disclaimer}</p>
              </CardContent>
            </Card>
            ) : (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Issues Summary</CardTitle>
                <CardDescription>Key findings</CardDescription>
              </CardHeader>
              <CardContent>
                {data.issues.length === 0 ? (
                  <p className="text-sm text-slate-800">✓ No major accessibility issues detected</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-900">{data.issues.length} issue type(s) found:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {data.issues.map((issue) => (
                        <li key={issue.id} className="text-sm text-slate-700">{issue.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-4 text-xs text-slate-500">{data.disclaimer}</p>
              </CardContent>
            </Card>
            )}

            {/* Sample Links */}
            {displayMode === "detailed" && ((data.basics?.links.sampleInternal.length ?? 0 > 0) || (data.basics?.links.sampleExternal.length ?? 0 > 0)) ? (
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Sample Links Found</CardTitle>
                  <CardDescription>First internal and external links detected on the site.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.basics?.links.sampleInternal && data.basics.links.sampleInternal.length > 0 && (
                    <div>
                      <div className="mb-2 text-sm font-medium text-slate-900">Internal Links</div>
                      <ul className="space-y-1">
                        {data.basics.links.sampleInternal.map((link, idx) => (
                          <li key={idx} className="break-all text-xs text-slate-600">
                            <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {new URL(link).pathname || link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {data.basics?.links.sampleExternal && data.basics.links.sampleExternal.length > 0 && (
                    <div>
                      <div className="mb-2 text-sm font-medium text-slate-900">External Links</div>
                      <ul className="space-y-1">
                        {data.basics.links.sampleExternal.map((link, idx) => (
                          <li key={idx} className="break-all text-xs text-slate-600">
                            <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {new URL(link).hostname}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {/* Pages Scanned */}
            {displayMode === "detailed" && data.pagesScanned && data.pagesScanned.length > 0 && (
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Pages Analyzed ({data.pagesSampledCount})</CardTitle>
                  <CardDescription>These pages were sampled to generate this report.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {data.pagesScanned.map((page, idx) => (
                      <li key={idx} className="break-all text-xs text-slate-600">
                        <a href={page} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {new URL(page).pathname || new URL(page).hostname}
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
            ))}
          </div>
        ) : null}

        {/* Footer */}
        <footer className="mx-auto mt-16 max-w-5xl px-4 pb-10 text-xs text-slate-500">
          Built to help Virginia agencies understand and achieve Section 508 and VITA accessibility compliance.
        </footer>
      </section>
    </main>
  );
}
