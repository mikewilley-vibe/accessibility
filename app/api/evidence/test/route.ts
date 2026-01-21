import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), "data");
    const programFile = path.join(dataDir, "program.json");
    
    console.log("Test endpoint called");
    console.log("Current working directory:", process.cwd());
    console.log("Data directory:", dataDir);
    console.log("Program file:", programFile);
    
    // Check if data directory exists
    const dataDirExists = fs.existsSync(dataDir);
    console.log("Data directory exists:", dataDirExists);
    
    // Check if program.json exists
    const programFileExists = fs.existsSync(programFile);
    console.log("Program file exists:", programFileExists);
    
    // Try to read it
    if (programFileExists) {
      const content = fs.readFileSync(programFile, "utf-8");
      const parsed = JSON.parse(content);
      console.log("Program file readable, contains keys:", Object.keys(parsed));
    }
    
    // Try to write a test file
    const testFile = path.join(dataDir, "test.json");
    fs.writeFileSync(testFile, JSON.stringify({ test: true }), "utf-8");
    console.log("Test file write succeeded");
    
    // Clean up
    fs.unlinkSync(testFile);
    console.log("Test file cleanup succeeded");
    
    return NextResponse.json({ 
      status: "ok",
      cwd: process.cwd(),
      dataDirExists,
      programFileExists,
      canWrite: true
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    return NextResponse.json(
      { 
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
