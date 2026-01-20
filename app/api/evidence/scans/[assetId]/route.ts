import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import * as evidenceStore from "@/lib/storage/evidenceStore";
import type { ScanResult } from "@/lib/types/evidence";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;
    const scans = evidenceStore.getScansByAssetId(assetId);
    return NextResponse.json(scans);
  } catch (error) {
    console.error("Error fetching scans:", error);
    return NextResponse.json({ error: "Failed to fetch scans" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;
    const body = await request.json();

    const {
      pagesSampled,
      pagesTotal,
      totalImages,
      missingAltCount,
      totalControls,
      unlabeledControlsCount,
      totalLinks,
      internalLinks,
      externalLinks,
      issuesFound,
      criticalIssues,
      scanDurationMs,
      overallCoverage,
      keyFindings,
    } = body;

    const scan: ScanResult = {
      id: uuidv4(),
      assetId,
      scanDate: new Date().toISOString(),
      pagesSampled,
      pagesTotal,
      totalImages,
      missingAltCount,
      totalControls,
      unlabeledControlsCount,
      totalLinks,
      internalLinks,
      externalLinks,
      issuesFound,
      criticalIssues,
      scanDurationMs,
      overallCoverage,
      keyFindings,
    };

    evidenceStore.addScanResult(scan);
    return NextResponse.json(scan);
  } catch (error) {
    console.error("Error creating scan:", error);
    return NextResponse.json(
      { error: "Failed to create scan" },
      { status: 500 }
    );
  }
}
