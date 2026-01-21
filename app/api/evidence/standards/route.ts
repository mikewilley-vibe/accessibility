import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import * as evidenceStore from "@/lib/storage/evidenceStore";
import type { StandardsAdoption, AccessibilityStandard } from "@/lib/types/evidence";

export async function GET() {
  try {
    const standards = evidenceStore.getStandardsAdoption();
    return NextResponse.json(standards);
  } catch (error) {
    console.error("Error fetching standards:", error);
    return NextResponse.json({ error: "Failed to fetch standards" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("POST /api/evidence/standards - received body:", body);
    
    const { organizationName, adoptedStandards, policyStatement } = body;

    if (!organizationName || !adoptedStandards || adoptedStandards.length === 0) {
      console.warn("Missing required fields:", { organizationName, adoptedStandards });
      return NextResponse.json(
        { error: "Missing required fields: organizationName and adoptedStandards required" },
        { status: 400 }
      );
    }

    // Validate standards
    const validStandards = ["WCAG 2.2 A/AA", "Section 508", "VITA"];
    for (const std of adoptedStandards) {
      if (!validStandards.includes(std)) {
        console.warn("Invalid standard received:", std);
        return NextResponse.json(
          { error: `Invalid standard: ${std}. Must be one of: ${validStandards.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const standards: StandardsAdoption = {
      id: uuidv4(),
      organizationName,
      adoptedStandards: adoptedStandards as AccessibilityStandard[],
      adoptionDate: new Date().toISOString().split("T")[0],
      policyStatement: policyStatement || "",
      lastUpdated: new Date().toISOString(),
    };

    console.log("Updating standards with:", standards);
    console.log("About to call evidenceStore.updateStandardsAdoption");
    
    evidenceStore.updateStandardsAdoption(standards);
    
    console.log("Standards saved successfully to file system");

    return NextResponse.json(standards, { status: 200 });
  } catch (error) {
    console.error("=== CATCH BLOCK ERROR ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error updating standards:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error message extracted:", errorMessage);
    console.error("Full error object:", { error, errorMessage });
    console.error("===========================");
    return NextResponse.json(
      { error: `Failed to update standards: ${errorMessage}` },
      { status: 500 }
    );
  }
}
