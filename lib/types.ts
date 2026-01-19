export type Severity = "Low" | "Medium" | "High";
export type Effort = "Easy" | "Moderate" | "Complex";
export type Coverage = "Good" | "Partial" | "Limited";

export type Issue = {
  id: string;
  title: string;
  description: string;
  typicalFix: string;
  impact: string;
};

export type PageBasics = {
  finalUrl: string;
  hostname: string;
  title: string | null;
  metaDescription: string | null;
  pathPattern?: string; // e.g., "/news/*"

  links: {
    total: number;
    internal: number;
    external: number;
    sampleInternal: string[]; // first 5
    sampleExternal: string[]; // first 5
  };

  forms: {
    total: number;
    controlsTotal: number; // input/select/textarea
    controlsUnlabeledEstimate: number; // heuristic
  };

  images: {
    total: number;
    missingAlt: number;
  };
};

export type PageMetrics = {
  url: string;
  missingAltCount: number;
  unlabeledControlsCount: number;
};

export type ScanFingerprint = {
  hash: string; // Simple hash of aggregated metrics
  timestamp: string;
  metrics: {
    totalImages: number;
    missingAlt: number;
    totalControls: number;
    unlabeledControls: number;
    totalLinks: number;
  };
};

export type AnalyzeResponse = {
  url: string;
  basics?: PageBasics;
  coverage: Coverage;
  generatedAt: string; // ISO timestamp
  pagesScanned: string[]; // List of URLs that were actually analyzed
  pagesSampledCount: number; // How many pages were sampled
  siteSections?: number; // Number of distinct path patterns found

  summaryBullets: string[];
  severity: { level: Severity; rationale: string };
  effort: { level: Effort; rationale: string };
  whyThisMatters: string;
  affectedUsers: Array<
    "Screen reader users" | "Keyboard-only users" | "Low-vision users" | "Mobile users"
  >;
  issues: Issue[];
  
  // Worst pages ranking
  worstPages?: {
    byMissingAlt: PageMetrics[];
    byUnlabeledControls: PageMetrics[];
  };
  
  // Fingerprint tracking
  currentFingerprint?: ScanFingerprint;
  previousFingerprint?: ScanFingerprint;
  changes?: {
    missingAlt: { before: number; after: number; delta: number };
    unlabeledControls: { before: number; after: number; delta: number };
  };
  
  shareableOutputs: {
    partnerFriendly: string;
    developerHandoff: string;
    executive?: string; // New: simple format
    detailed?: string; // New: full format
    csvExport?: string; // New: CSV format for Smartsheet
    jiraFormat?: string; // New: Jira-compatible format
    standardized?: string; // New: standardized export with issue breakdown
    tylerVirginia?: string; // New: formal Tyler Virginia compliance report
  };
  
  disclaimer: string;
};
