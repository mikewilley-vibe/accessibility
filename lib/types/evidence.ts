/**
 * Compliance Program Evidence Types
 * Structures for managing accessibility governance, assessment, and remediation tracking
 */

// ============================================================================
// A) Standards & Policy Adoption
// ============================================================================

export type AccessibilityStandard = "WCAG 2.2 A/AA" | "Section 508" | "VITA";

export type StandardsAdoption = {
  id: string;
  organizationName: string;
  adoptedStandards: AccessibilityStandard[];
  adoptionDate: string; // ISO date
  policyStatement: string; // Free-text policy commitment
  reviewDate?: string; // Last review date
  lastUpdated: string; // ISO timestamp
};

// ============================================================================
// B) Digital Asset Inventory & Assessment
// ============================================================================

export type AssetEnvironment = "Production" | "Staging" | "Development";
export type AssetType = "Website" | "Web Application" | "Mobile App" | "Document Portal";

export type DigitalAsset = {
  id: string;
  name: string;
  url: string;
  type: AssetType;
  environment: AssetEnvironment;
  owner: string; // Person/team responsible
  publicFacing: boolean; // Citizen-accessible?
  description?: string;
  criticalService?: boolean; // Essential service?
  createdAt: string;
  lastUpdated: string;
};

export type ScanResult = {
  id: string;
  assetId: string;
  scanDate: string; // ISO timestamp
  pagesSampled: number;
  pagesTotal?: number;
  totalImages: number;
  missingAltCount: number;
  totalControls: number;
  unlabeledControlsCount: number;
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;
  issuesFound: number;
  criticalIssues: number;
  scanDurationMs: number;
  overallCoverage: "Good" | "Partial" | "Limited";
  keyFindings: string[]; // 3-5 bullet points
  scanHash?: string; // Fingerprint for change detection
};

export type AssetInventory = {
  id: string;
  organizationId: string;
  assets: DigitalAsset[];
  scans: ScanResult[];
  lastUpdated: string;
};

// ============================================================================
// C) Prioritization (Impact/Risk/Usage)
// ============================================================================

export type ImpactLevel = "Critical" | "High" | "Medium" | "Low";
export type UsageLevel = "High" | "Medium" | "Low";

export type PrioritizationScore = {
  publicImpact: number; // 1-5
  complianceRisk: number; // 1-5
  usageFrequency: number; // 1-5
  affectedUsers: number; // estimated count
  totalScore: number;
};

export type PrioritizedIssue = {
  id: string;
  issueType: string; // e.g., "Missing alt text", "Unlabeled form control"
  affectedAssets: string[]; // Asset IDs
  severity: ImpactLevel;
  frequency: number; // # of occurrences
  affectedUserGroups: string[]; // "Screen readers", "Keyboard users", etc.
  score: PrioritizationScore;
  rationale: string; // Explain why this is prioritized
  recommendedFix: string;
};

export type PrioritizationBacklog = {
  id: string;
  organizationId: string;
  generatedAt: string;
  issues: PrioritizedIssue[];
};

// ============================================================================
// D) Remediation Plan
// ============================================================================

export type OwnerRole = "Content" | "Development" | "UX/Design" | "Vendor" | "QA";
export type RemediationStatus = "Not Started" | "In Progress" | "Blocked" | "Complete" | "Deferred";

export type RemediationTask = {
  id: string;
  issueId: string;
  issueSummary: string;
  recommendedFix: string;
  ownerRole: OwnerRole;
  assignedTo?: string; // Name/email
  targetDate: string; // ISO date
  status: RemediationStatus;
  startDate?: string;
  completionDate?: string;
  blockers?: string;
  notes?: string;
  statusChangedAt?: string;
};

export type RemediationPlan = {
  id: string;
  organizationId: string;
  backlogId: string;
  generatedAt: string;
  tasks: RemediationTask[];
  defaultTimelinesByGrade: Record<ImpactLevel, number>; // days to resolve
};

// ============================================================================
// E) Workflow Integration (Governance)
// ============================================================================

export type ContentChecklistItem = {
  id: string;
  check: string;
  description: string;
};

export type DevelopmentChecklistItem = {
  id: string;
  check: string;
  description: string;
};

export type ProcurementChecklistItem = {
  id: string;
  check: string;
  description: string;
};

export type AccessibilityWorkflow = {
  id: string;
  organizationId: string;
  contentChecklist: ContentChecklistItem[];
  developmentChecklist: DevelopmentChecklistItem[];
  procurementChecklist: ProcurementChecklistItem[];
  lastUpdated: string;
};

// ============================================================================
// F) Remediation Progress Tracking
// ============================================================================

export type RemediationMetrics = {
  generatedAt: string;
  totalIssues: number;
  openIssues: number;
  inProgressCount: number;
  completedCount: number;
  blockedCount: number;
  deferredCount: number;
  onTimeCount: number;
  overdueCount: number;
  percentComplete: number;
  trendVsPreviousScan?: {
    previousScanDate: string;
    previousIssueCount: number;
    issuesDelta: number; // positive = more issues, negative = fewer
  };
};

// ============================================================================
// Unified Program Evidence Bundle
// ============================================================================

export type ComplianceProgramEvidence = {
  organizationId: string;
  organizationName: string;
  generatedAt: string;
  evidenceType: "Full Program" | "Update";

  standardsAdoption: StandardsAdoption;
  assetInventory: AssetInventory;
  prioritizationBacklog: PrioritizationBacklog;
  remediationPlan: RemediationPlan;
  accessibilityWorkflow: AccessibilityWorkflow;
  remediationMetrics: RemediationMetrics;
};

// ============================================================================
// Storage/Database models
// ============================================================================

export type ProgramDatabase = {
  organization: StandardsAdoption;
  assets: DigitalAsset[];
  scans: ScanResult[];
  issues: PrioritizedIssue[];
  remediationTasks: RemediationTask[];
  workflow: AccessibilityWorkflow;
};
