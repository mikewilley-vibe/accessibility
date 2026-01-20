import { NextRequest, NextResponse } from "next/server";
import * as evidenceStore from "@/lib/storage/evidenceStore";
import type { AccessibilityWorkflow } from "@/lib/types/evidence";

export async function GET() {
  try {
    const workflow = evidenceStore.getWorkflow();
    return NextResponse.json(workflow);
  } catch (error) {
    console.error("Error fetching workflow:", error);
    return NextResponse.json({ error: "Failed to fetch workflow" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contentChecklist, developmentChecklist, procurementChecklist } = body;

    const currentWorkflow = evidenceStore.getWorkflow();

    const updatedWorkflow: AccessibilityWorkflow = {
      ...currentWorkflow,
      contentChecklist: contentChecklist || currentWorkflow.contentChecklist,
      developmentChecklist: developmentChecklist || currentWorkflow.developmentChecklist,
      procurementChecklist: procurementChecklist || currentWorkflow.procurementChecklist,
      lastUpdated: new Date().toISOString(),
    };

    evidenceStore.updateWorkflow(updatedWorkflow);
    return NextResponse.json(updatedWorkflow);
  } catch (error) {
    console.error("Error updating workflow:", error);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}
