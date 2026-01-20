import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import * as evidenceStore from "@/lib/storage/evidenceStore";
import type { RemediationTask, RemediationStatus, OwnerRole } from "@/lib/types/evidence";

export async function GET() {
  try {
    const tasks = evidenceStore.getRemediationTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      issueId,
      issueSummary,
      recommendedFix,
      ownerRole,
      assignedTo,
      targetDate,
      status,
      blockers,
      notes,
    } = body;

    if (!issueId || !issueSummary || !recommendedFix || !ownerRole || !targetDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const task: RemediationTask = {
      id: uuidv4(),
      issueId,
      issueSummary,
      recommendedFix,
      ownerRole: ownerRole as OwnerRole,
      assignedTo,
      targetDate,
      status: (status || "Not Started") as RemediationStatus,
      blockers,
      notes,
      statusChangedAt: new Date().toISOString(),
    };

    evidenceStore.addRemediationTask(task);
    return NextResponse.json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const task = body as RemediationTask;

    if (!task.id) {
      return NextResponse.json(
        { error: "Missing task ID" },
        { status: 400 }
      );
    }

    evidenceStore.updateRemediationTask(task);
    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}
