import { NextResponse } from "next/server";
import * as evidenceStore from "@/lib/storage/evidenceStore";
import type {
  ComplianceProgramEvidence,
  RemediationMetrics,
  AssetInventory,
} from "@/lib/types/evidence";

export async function GET() {
  try {
    const standards = evidenceStore.getStandardsAdoption();
    const assets = evidenceStore.getAssets();
    const scans = evidenceStore.getAllScans();
    const issues = evidenceStore.getIssues();
    const tasks = evidenceStore.getRemediationTasks();
    const workflow = evidenceStore.getWorkflow();

    // Build asset inventory
    const assetInventory: AssetInventory = {
      id: `inv-${Date.now()}`,
      organizationId: standards.id,
      assets,
      scans,
      lastUpdated: new Date().toISOString(),
    };

    // Calculate metrics
    const metrics: RemediationMetrics = {
      generatedAt: new Date().toISOString(),
      totalIssues: issues.length,
      openIssues: tasks.filter((t) => t.status === "Not Started").length,
      inProgressCount: tasks.filter((t) => t.status === "In Progress").length,
      completedCount: tasks.filter((t) => t.status === "Complete").length,
      blockedCount: tasks.filter((t) => t.status === "Blocked").length,
      deferredCount: tasks.filter((t) => t.status === "Deferred").length,
      onTimeCount: tasks.filter((t) => {
        if (t.status === "Complete" && t.completionDate && t.targetDate) {
          return new Date(t.completionDate) <= new Date(t.targetDate);
        }
        return false;
      }).length,
      overdueCount: tasks.filter((t) => {
        if (t.status !== "Complete" && t.targetDate) {
          return new Date(t.targetDate) < new Date();
        }
        return false;
      }).length,
      percentComplete: tasks.length > 0 ? (tasks.filter((t) => t.status === "Complete").length / tasks.length) * 100 : 0,
    };

    // Build evidence bundle
    const evidence: ComplianceProgramEvidence = {
      organizationId: standards.id,
      organizationName: standards.organizationName,
      generatedAt: new Date().toISOString(),
      evidenceType: "Full Program",
      standardsAdoption: standards,
      assetInventory,
      prioritizationBacklog: {
        id: `backlog-${Date.now()}`,
        organizationId: standards.id,
        generatedAt: new Date().toISOString(),
        issues,
      },
      remediationPlan: {
        id: `plan-${Date.now()}`,
        organizationId: standards.id,
        backlogId: `backlog-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        tasks,
        defaultTimelinesByGrade: {
          Critical: 7,
          High: 14,
          Medium: 30,
          Low: 60,
        },
      },
      accessibilityWorkflow: workflow,
      remediationMetrics: metrics,
    };

    return NextResponse.json(evidence);
  } catch (error) {
    console.error("Error generating evidence bundle:", error);
    return NextResponse.json(
      { error: "Failed to generate evidence bundle" },
      { status: 500 }
    );
  }
}
