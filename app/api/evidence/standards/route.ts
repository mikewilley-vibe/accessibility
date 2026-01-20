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
    const { organizationName, adoptedStandards, policyStatement } = body;

    if (!organizationName || !adoptedStandards || adoptedStandards.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate standards
    const validStandards = ["WCAG 2.2 A/AA", "Section 508", "VITA"];
    for (const std of adoptedStandards) {
      if (!validStandards.includes(std)) {
        return NextResponse.json(
          { error: `Invalid standard: ${std}` },
          { status: 400 }
        );
      }
    }

    const standards: StandardsAdoption = {
      id: uuidv4(),
      organizationName,
      adoptedStandards: adoptedStandards as AccessibilityStandard[],
      adoptionDate: new Date().toISOString().split("T")[0],
      policyStatement,
      lastUpdated: new Date().toISOString(),
    };

    evidenceStore.updateStandardsAdoption(standards);

    return NextResponse.json(standards);
  } catch (error) {
    console.error("Error updating standards:", error);
    return NextResponse.json(
      { error: "Failed to update standards" },
      { status: 500 }
    );
  }
}
