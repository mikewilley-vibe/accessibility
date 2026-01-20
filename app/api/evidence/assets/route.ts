import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import * as evidenceStore from "@/lib/storage/evidenceStore";
import type { DigitalAsset, AssetEnvironment, AssetType } from "@/lib/types/evidence";

export async function GET() {
  try {
    const assets = evidenceStore.getAssets();
    return NextResponse.json(assets);
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, type, environment, owner, publicFacing, description, criticalService } = body;

    if (!name || !url || !type || !environment || !owner) {
      return NextResponse.json(
        { error: "Missing required fields: name, url, type, environment, owner" },
        { status: 400 }
      );
    }

    const asset: DigitalAsset = {
      id: uuidv4(),
      name,
      url,
      type: type as AssetType,
      environment: environment as AssetEnvironment,
      owner,
      publicFacing: publicFacing !== false,
      description,
      criticalService: criticalService === true,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    evidenceStore.addAsset(asset);
    return NextResponse.json(asset);
  } catch (error) {
    console.error("Error creating asset:", error);
    return NextResponse.json(
      { error: "Failed to create asset" },
      { status: 500 }
    );
  }
}
