import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import * as evidenceStore from "@/lib/storage/evidenceStore";
import type { PrioritizedIssue, PrioritizationScore, ImpactLevel } from "@/lib/types/evidence";

export async function GET() {
  try {
    const issues = evidenceStore.getIssues();
    return NextResponse.json(issues);
  } catch (error) {
    console.error("Error fetching issues:", error);
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      issueType,
      affectedAssets,
      severity,
      frequency,
      affectedUserGroups,
      publicImpact,
      complianceRisk,
      usageFrequency,
      affectedUsers,
      rationale,
      recommendedFix,
    } = body;

    if (!issueType || !affectedAssets || !severity) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const score: PrioritizationScore = {
      publicImpact,
      complianceRisk,
      usageFrequency,
      affectedUsers,
      totalScore: (publicImpact + complianceRisk + usageFrequency) / 3,
    };

    const issue: PrioritizedIssue = {
      id: uuidv4(),
      issueType,
      affectedAssets,
      severity: severity as ImpactLevel,
      frequency,
      affectedUserGroups,
      score,
      rationale,
      recommendedFix,
    };

    evidenceStore.addIssue(issue);
    return NextResponse.json(issue);
  } catch (error) {
    console.error("Error creating issue:", error);
    return NextResponse.json(
      { error: "Failed to create issue" },
      { status: 500 }
    );
  }
}
