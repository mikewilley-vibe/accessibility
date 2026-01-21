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
  console.log("===== POST /api/evidence/standards START =====");
  
  try {
    console.log("1. Parsing request body...");
    const body = await request.json();
    console.log("2. Body received:", JSON.stringify(body).substring(0, 200));
    
    const { organizationName, adoptedStandards, policyStatement } = body;
    console.log("3. Destructured:", { organizationName, adoptedStandardsLength: adoptedStandards?.length, policyStatement });

    if (!organizationName?.trim() || !adoptedStandards?.length) {
      console.log("4. Validation failed - missing required fields");
      return NextResponse.json(
        { error: "Missing organization name or standards" },
        { status: 400 }
      );
    }

    console.log("5. Creating standards object...");
    const standards: StandardsAdoption = {
      id: uuidv4(),
      organizationName: organizationName.trim(),
      adoptedStandards: adoptedStandards as AccessibilityStandard[],
      adoptionDate: new Date().toISOString().split("T")[0],
      policyStatement: policyStatement?.trim() || "",
      lastUpdated: new Date().toISOString(),
    };
    
    console.log("6. Calling evidenceStore.updateStandardsAdoption...");
    evidenceStore.updateStandardsAdoption(standards);
    console.log("7. Successfully saved!");

    return NextResponse.json(standards);
  } catch (error) {
    console.error("ERROR in POST /api/evidence/standards:");
    console.error("Type:", error?.constructor?.name);
    console.error("Message:", error instanceof Error ? error.message : String(error));
    console.error("Full error:", error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error",
        type: error?.constructor?.name
      },
      { status: 500 }
    );
  }
}
