import type { AnalyzeResponse } from "./types";

/**
 * System prompt for Claude to analyze accessibility issues
 * Instructs the model to think like a UX accessibility expert
 * and return structured JSON matching AnalyzeResponse format
 * Focuses on Virginia Section 508 and VITA standards compliance
 */
export const ACCESSIBILITY_SYSTEM_PROMPT = `You are an expert accessibility consultant helping Virginia government agencies understand Section 508 (Rehabilitation Act) and VITA accessibility standards compliance in plain English.

Your job is to analyze web content and identify accessibility barriers that violate Section 508 and VITA standards, then explain them in a way that resonates with Product Managers and government stakeholders.

Virginia Section 508 Standards cover:
- Electronic and information technology must be accessible to people with disabilities
- Applies to all state agencies and contractors

VITA Standards focus on:
- Keyboard navigation and keyboard access
- Screen reader compatibility and ARIA labels
- Color contrast ratios (WCAG AA minimum)
- Form labels and error messages
- Alternative text for images
- Heading hierarchy and semantic HTML
- Focus indicators and tab order
- Compatibility with assistive technologies

Guidelines:
- Use plain language, reference Section 508 and VITA where relevant
- Focus on impact: who is affected and compliance risk
- Be specific about typical fixes (1-2 sentences)
- Severity reflects compliance violation severity
- Effort reflects typical remediation scope
- Always return valid JSON matching the expected schema

Think about real users:
- Screen reader users (blind, low vision)
- Keyboard-only users (motor disabilities, power users)
- Low-vision users (zoomed in, high contrast)
- Mobile users (often the same barriers apply)`;

/**
 * User prompt template for analyzing a specific URL
 * Focuses on Section 508 and VITA compliance violations
 */
export function createAnalysisPrompt(htmlContent: string): string {
  return `Analyze this HTML content for Section 508 (Rehabilitation Act) and VITA accessibility standard violations.

Focus on these compliance areas:
1. Form labels and ARIA - Do form controls have programmatic labels?
2. Alternative text - Do images have meaningful alt text?
3. Color contrast - Is text readable (minimum WCAG AA 4.5:1 for normal text)?
4. Keyboard navigation - Are all interactive elements keyboard accessible?
5. Heading hierarchy - Is semantic HTML structure present?
6. Focus indicators - Are focus states visible?
7. Error messages - Are form errors descriptive and associated with fields?
8. Semantic HTML - Are lists, buttons, links used correctly?
9. Skip links - Can users skip repetitive navigation?
10. ARIA attributes - Are they used correctly where needed?

HTML Content:
\`\`\`html
${htmlContent}
\`\`\`

Return ONLY valid JSON (no markdown, no explanation) matching this exact schema:
{
  "url": "string (the analyzed URL)",
  "summaryBullets": ["string (3-5 plain-English bullets about Section 508/VITA compliance gaps)"],
  "severity": {
    "level": "Low" | "Medium" | "High",
    "rationale": "string (1-2 sentences on compliance risk - reference Section 508/VITA where applicable)"
  },
  "effort": {
    "level": "Easy" | "Moderate" | "Complex",
    "rationale": "string (1-2 sentences on typical fix scope)"
  },
  "whyThisMatters": "string (2-3 sentences on compliance obligation and user impact)",
  "affectedUsers": ["Screen reader users" | "Keyboard-only users" | "Low-vision users" | "Mobile users"],
  "issues": [
    {
      "id": "string (unique identifier)",
      "title": "string (Section 508/VITA standard reference with plain-English title)",
      "description": "string (what compliance gap exists)",
      "impact": "string (who is affected and why)",
      "typicalFix": "string (1 sentence on how to fix)"
    }
  ],
  "disclaimer": "string (caveat about scope and recommendation for full Section 508 audit)"
}`;
}

/**
 * JSON Schema for response validation
 * Use this to validate LLM output before sending to UI
 */
export const ANALYZE_RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: {
    url: { type: "string" },
    summaryBullets: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 5,
    },
    severity: {
      type: "object",
      properties: {
        level: { enum: ["Low", "Medium", "High"] },
        rationale: { type: "string" },
      },
      required: ["level", "rationale"],
    },
    effort: {
      type: "object",
      properties: {
        level: { enum: ["Easy", "Moderate", "Complex"] },
        rationale: { type: "string" },
      },
      required: ["level", "rationale"],
    },
    whyThisMatters: { type: "string" },
    affectedUsers: {
      type: "array",
      items: {
        enum: ["Screen reader users", "Keyboard-only users", "Low-vision users", "Mobile users"],
      },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          impact: { type: "string" },
          typicalFix: { type: "string" },
        },
        required: ["id", "title", "description", "impact", "typicalFix"],
      },
    },
    disclaimer: { type: "string" },
  },
  required: [
    "url",
    "summaryBullets",
    "severity",
    "effort",
    "whyThisMatters",
    "affectedUsers",
    "issues",
    "disclaimer",
  ],
};

/**
 * Validates an AnalyzeResponse object against the schema
 * Returns validation errors or null if valid
 */
export function validateAnalyzeResponse(data: unknown): string[] {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return ["Response must be an object"];
  }

  const obj = data as Record<string, unknown>;

  // Check required fields
  const requiredFields = [
    "url",
    "summaryBullets",
    "severity",
    "effort",
    "whyThisMatters",
    "affectedUsers",
    "issues",
    "disclaimer",
  ];

  for (const field of requiredFields) {
    if (!(field in obj)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Type checks
  if (typeof obj.url !== "string") errors.push("url must be a string");
  if (!Array.isArray(obj.summaryBullets))
    errors.push("summaryBullets must be an array");
  if (typeof obj.whyThisMatters !== "string")
    errors.push("whyThisMatters must be a string");
  if (!Array.isArray(obj.affectedUsers))
    errors.push("affectedUsers must be an array");
  if (!Array.isArray(obj.issues)) errors.push("issues must be an array");
  if (typeof obj.disclaimer !== "string")
    errors.push("disclaimer must be a string");

  // Severity checks
  if (obj.severity && typeof obj.severity === "object") {
    const sev = obj.severity as Record<string, unknown>;
    if (!["Low", "Medium", "High"].includes(sev.level as string)) {
      errors.push(
        `severity.level must be "Low", "Medium", or "High", got: ${sev.level}`
      );
    }
    if (typeof sev.rationale !== "string")
      errors.push("severity.rationale must be a string");
  } else {
    errors.push("severity must be an object with level and rationale");
  }

  // Effort checks
  if (obj.effort && typeof obj.effort === "object") {
    const eff = obj.effort as Record<string, unknown>;
    if (!["Easy", "Moderate", "Complex"].includes(eff.level as string)) {
      errors.push(
        `effort.level must be "Easy", "Moderate", or "Complex", got: ${eff.level}`
      );
    }
    if (typeof eff.rationale !== "string")
      errors.push("effort.rationale must be a string");
  } else {
    errors.push("effort must be an object with level and rationale");
  }

  return errors;
}
