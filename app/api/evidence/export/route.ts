import { NextRequest, NextResponse } from "next/server";
import * as evidenceStore from "@/lib/storage/evidenceStore";

// Generate CSV export for remediation plan
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const exportType = searchParams.get("type") || "remediation";

    if (exportType === "remediation") {
      return exportRemediationCsv();
    } else if (exportType === "backlog") {
      return exportBacklogCsv();
    } else if (exportType === "progress") {
      return exportProgressCsv();
    } else if (exportType === "inventory") {
      return exportInventoryCsv();
    }

    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  } catch (error) {
    console.error("Error generating export:", error);
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}

function exportRemediationCsv(): NextResponse {
  const tasks = evidenceStore.getRemediationTasks();

  const headers = [
    "Issue Summary",
    "Recommended Fix",
    "Owner Role",
    "Assigned To",
    "Target Date",
    "Status",
    "Blockers",
    "Notes",
  ];

  const rows = tasks.map((task) => [
    task.issueSummary,
    task.recommendedFix,
    task.ownerRole,
    task.assignedTo || "",
    task.targetDate,
    task.status,
    task.blockers || "",
    task.notes || "",
  ]);

  const csv =
    headers.join(",") +
    "\n" +
    rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=remediation-plan.csv",
    },
  });
}

function exportBacklogCsv(): NextResponse {
  const issues = evidenceStore.getIssues();

  const headers = [
    "Issue Type",
    "Severity",
    "Frequency",
    "Priority Score",
    "Affected User Groups",
    "Recommended Fix",
    "Rationale",
  ];

  const rows = issues.map((issue) => [
    issue.issueType,
    issue.severity,
    issue.frequency,
    issue.score.totalScore.toFixed(2),
    issue.affectedUserGroups.join("; "),
    issue.recommendedFix,
    issue.rationale,
  ]);

  const csv =
    headers.join(",") +
    "\n" +
    rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=prioritized-backlog.csv",
    },
  });
}

function exportProgressCsv(): NextResponse {
  const tasks = evidenceStore.getRemediationTasks();

  const statusGroups: Record<string, number> = {
    "Not Started": 0,
    "In Progress": 0,
    Complete: 0,
    Blocked: 0,
    Deferred: 0,
  };

  tasks.forEach((task) => {
    if (statusGroups.hasOwnProperty(task.status)) {
      statusGroups[task.status]++;
    }
  });

  const total = tasks.length;
  const percentComplete = total > 0 ? ((statusGroups.Complete / total) * 100).toFixed(1) : "0";

  const csv = `Status,Count,Percentage\n${Object.entries(statusGroups)
    .map(([status, count]) => {
      const pct = total > 0 ? (((count as number) / total) * 100).toFixed(1) : "0";
      return `"${status}",${count},${pct}%`;
    })
    .join("\n")}\n\nOverall Progress,${percentComplete}%`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=remediation-progress.csv",
    },
  });
}

function exportInventoryCsv(): NextResponse {
  const assets = evidenceStore.getAssets();
  const scans = evidenceStore.getAllScans();

  const headers = [
    "Asset Name",
    "URL",
    "Type",
    "Environment",
    "Owner",
    "Public Facing",
    "Critical Service",
    "Last Scan Date",
    "Pages Sampled",
    "Issues Found",
  ];

  const rows = assets.map((asset) => {
    const lastScan = scans
      .filter((s) => s.assetId === asset.id)
      .sort((a, b) => new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime())[0];

    return [
      asset.name,
      asset.url,
      asset.type,
      asset.environment,
      asset.owner,
      asset.publicFacing ? "Yes" : "No",
      asset.criticalService ? "Yes" : "No",
      lastScan ? lastScan.scanDate.split("T")[0] : "Never",
      lastScan ? lastScan.pagesSampled : "-",
      lastScan ? lastScan.issuesFound : "-",
    ];
  });

  const csv =
    headers.join(",") +
    "\n" +
    rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=asset-inventory.csv",
    },
  });
}
