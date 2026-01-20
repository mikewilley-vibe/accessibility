/**
 * Local Storage for Compliance Program Evidence
 * Uses JSON file storage (persisted to a data directory)
 */

import fs from "fs";
import path from "path";
import type {
  StandardsAdoption,
  DigitalAsset,
  ScanResult,
  PrioritizedIssue,
  RemediationTask,
  AccessibilityWorkflow,
  ProgramDatabase,
} from "@/lib/types/evidence";

const DATA_DIR = path.join(process.cwd(), "data");
const PROGRAM_FILE = path.join(DATA_DIR, "program.json");

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load database from disk
export function loadDatabase(): ProgramDatabase {
  ensureDataDir();
  
  if (!fs.existsSync(PROGRAM_FILE)) {
    return getDefaultDatabase();
  }
  
  try {
    const content = fs.readFileSync(PROGRAM_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error loading database:", error);
    return getDefaultDatabase();
  }
}

// Save database to disk
export function saveDatabase(db: ProgramDatabase): void {
  ensureDataDir();
  fs.writeFileSync(PROGRAM_FILE, JSON.stringify(db, null, 2), "utf-8");
}

// Default empty database
function getDefaultDatabase(): ProgramDatabase {
  return {
    organization: {
      id: "org-default",
      organizationName: "My Organization",
      adoptedStandards: [],
      adoptionDate: new Date().toISOString().split("T")[0],
      policyStatement: "",
      lastUpdated: new Date().toISOString(),
    },
    assets: [],
    scans: [],
    issues: [],
    remediationTasks: [],
    workflow: {
      id: "workflow-default",
      organizationId: "org-default",
      contentChecklist: [],
      developmentChecklist: [],
      procurementChecklist: [],
      lastUpdated: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Standards Adoption APIs
// ============================================================================

export function updateStandardsAdoption(standards: StandardsAdoption): void {
  const db = loadDatabase();
  db.organization = standards;
  saveDatabase(db);
}

export function getStandardsAdoption(): StandardsAdoption {
  const db = loadDatabase();
  return db.organization;
}

// ============================================================================
// Asset APIs
// ============================================================================

export function addAsset(asset: DigitalAsset): void {
  const db = loadDatabase();
  db.assets.push(asset);
  saveDatabase(db);
}

export function updateAsset(asset: DigitalAsset): void {
  const db = loadDatabase();
  const idx = db.assets.findIndex((a) => a.id === asset.id);
  if (idx >= 0) {
    db.assets[idx] = asset;
    saveDatabase(db);
  }
}

export function deleteAsset(assetId: string): void {
  const db = loadDatabase();
  db.assets = db.assets.filter((a) => a.id !== assetId);
  saveDatabase(db);
}

export function getAssets(): DigitalAsset[] {
  const db = loadDatabase();
  return db.assets;
}

export function getAssetById(assetId: string): DigitalAsset | undefined {
  const db = loadDatabase();
  return db.assets.find((a) => a.id === assetId);
}

// ============================================================================
// Scan Results APIs
// ============================================================================

export function addScanResult(scan: ScanResult): void {
  const db = loadDatabase();
  db.scans.push(scan);
  saveDatabase(db);
}

export function getScansByAssetId(assetId: string): ScanResult[] {
  const db = loadDatabase();
  return db.scans.filter((s) => s.assetId === assetId).sort((a, b) => new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime());
}

export function getAllScans(): ScanResult[] {
  const db = loadDatabase();
  return db.scans;
}

// ============================================================================
// Issues / Prioritization APIs
// ============================================================================

export function addIssue(issue: PrioritizedIssue): void {
  const db = loadDatabase();
  db.issues.push(issue);
  saveDatabase(db);
}

export function updateIssue(issue: PrioritizedIssue): void {
  const db = loadDatabase();
  const idx = db.issues.findIndex((i) => i.id === issue.id);
  if (idx >= 0) {
    db.issues[idx] = issue;
    saveDatabase(db);
  }
}

export function getIssues(): PrioritizedIssue[] {
  const db = loadDatabase();
  return db.issues.sort((a, b) => b.score.totalScore - a.score.totalScore);
}

export function getIssueById(issueId: string): PrioritizedIssue | undefined {
  const db = loadDatabase();
  return db.issues.find((i) => i.id === issueId);
}

// ============================================================================
// Remediation Task APIs
// ============================================================================

export function addRemediationTask(task: RemediationTask): void {
  const db = loadDatabase();
  db.remediationTasks.push(task);
  saveDatabase(db);
}

export function updateRemediationTask(task: RemediationTask): void {
  const db = loadDatabase();
  const idx = db.remediationTasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    db.remediationTasks[idx] = task;
    saveDatabase(db);
  }
}

export function getRemediationTasks(): RemediationTask[] {
  const db = loadDatabase();
  return db.remediationTasks;
}

export function getRemediationTasksByStatus(status: string): RemediationTask[] {
  const db = loadDatabase();
  return db.remediationTasks.filter((t) => t.status === status);
}

// ============================================================================
// Workflow APIs
// ============================================================================

export function updateWorkflow(workflow: AccessibilityWorkflow): void {
  const db = loadDatabase();
  db.workflow = workflow;
  saveDatabase(db);
}

export function getWorkflow(): AccessibilityWorkflow {
  const db = loadDatabase();
  return db.workflow;
}
