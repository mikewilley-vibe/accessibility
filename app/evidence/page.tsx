"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StandardsAdoptionForm } from "@/components/evidence/StandardsAdoptionForm";
import { AssetInventoryForm } from "@/components/evidence/AssetInventoryForm";
import { PrioritizationBacklogView } from "@/components/evidence/PrioritizationBacklogView";
import { RemediationPlanView } from "@/components/evidence/RemediationPlanView";

export default function EvidencePage() {
  const [activeTab, setActiveTab] = useState("standards");
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null);
  const [scanData, setScanData] = useState<any>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = searchParams.get("url");
    const dataStr = searchParams.get("data");
    
    if (url) {
      setWebsiteUrl(url);
    }
    
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        setScanData(data);
        // Auto-register asset and record scan
        registerAssetAndScan(url, data);
      } catch (error) {
        console.error("Error parsing scan data:", error);
      }
    }
  }, [searchParams]);

  async function registerAssetAndScan(url: string | null, data: any) {
    if (!url || !data) return;

    try {
      // Extract hostname for asset name
      const hostname = new URL(url).hostname;
      
      // 1. Register asset
      const assetResponse = await fetch("/api/evidence/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: hostname,
          url: url,
          type: "Website",
          environment: "Production",
          owner: "System",
          publicFacing: true,
          criticalService: false,
        }),
      });

      const asset = await assetResponse.json();
      const assetId = asset.id;

      // 2. Record scan results
      if (assetId) {
        await fetch(`/api/evidence/scans/${assetId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pagesSampled: data.pagesSampledCount || 0,
            totalImages: data.basics?.images?.total || 0,
            missingAltCount: data.issues?.filter((i: any) => i.title.includes("alt text")).length || 0,
            totalControls: data.basics?.controls?.total || 0,
            unlabeledControlsCount: data.issues?.filter((i: any) => i.title.includes("label")).length || 0,
            issuesFound: data.issues?.length || 0,
            overallCoverage: data.coverage || "Good",
            keyFindings: data.summaryBullets || [],
          }),
        });
      }
    } catch (error) {
      console.error("Error registering asset or scan:", error);
    }
  }

  async function handleExport(type: string) {
    try {
      const response = await fetch(`/api/evidence/export?type=${type}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-export.csv`;
      a.click();
    } catch (error) {
      console.error("Error exporting:", error);
    }
  }

  async function handleGenerateBundle() {
    try {
      const response = await fetch("/api/evidence/bundle");
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "compliance-evidence-bundle.json";
      a.click();
    } catch (error) {
      console.error("Error generating bundle:", error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Compliance Program Evidence</h1>
          <p className="text-gray-600">
            Document your accessibility governance, assessment, prioritization, and remediation efforts
          </p>
        </div>

        <div className="mb-6 flex gap-2 flex-wrap">
          <Button onClick={() => handleExport("remediation")} variant="outline" size="sm">
            Export Remediation Plan (CSV)
          </Button>
          <Button onClick={() => handleExport("backlog")} variant="outline" size="sm">
            Export Backlog (CSV)
          </Button>
          <Button onClick={() => handleExport("inventory")} variant="outline" size="sm">
            Export Inventory (CSV)
          </Button>
          <Button onClick={() => handleExport("progress")} variant="outline" size="sm">
            Export Progress (CSV)
          </Button>
          <Button onClick={handleGenerateBundle} variant="outline" size="sm">
            Generate Full Bundle (JSON)
          </Button>
        </div>

        <Separator className="mb-6" />

        <Accordion type="single" collapsible defaultValue="standards" className="space-y-4">
          <AccordionItem value="standards" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="text-left">
                <h2 className="font-semibold">A) Standards & Policy Adoption</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Document accessibility standards your organization has adopted
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 py-4 border-t">
              <StandardsAdoptionForm />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="inventory" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="text-left">
                <h2 className="font-semibold">B) Digital Asset Inventory & Assessment</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Register digital services and track scan history
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 py-4 border-t">
              <AssetInventoryForm defaultUrl={websiteUrl || undefined} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="prioritization" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="text-left">
                <h2 className="font-semibold">C) Prioritization (Impact/Risk/Usage)</h2>
                <p className="text-xs text-gray-500 mt-1">
                  View issues ranked by severity, impact, and frequency
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 py-4 border-t">
              <PrioritizationBacklogView />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="remediation" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="text-left">
                <h2 className="font-semibold">D) Remediation Plan (Ownership + Timelines)</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Assign fixes to owners and track implementation progress
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 py-4 border-t">
              <RemediationPlanView />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="workflow" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="text-left">
                <h2 className="font-semibold">E) Workflow Integration (Ongoing Governance)</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Define accessibility checks for content, development, and procurement
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 py-4 border-t">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Accessibility Workflows</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Content Authoring Checklist</h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>• Include descriptive alt text for all images</div>
                      <div>• Use proper heading hierarchy (H1 → H2 → H3)</div>
                      <div>• Ensure color is not the only method of conveying information</div>
                      <div>• Test with keyboard navigation</div>
                      <div>• Verify form labels are properly associated</div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Development Checklist</h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>• Run automated accessibility tests (Axe, WAVE)</div>
                      <div>• Test keyboard navigation and focus management</div>
                      <div>• Validate HTML semantics and ARIA usage</div>
                      <div>• Test with screen readers (NVDA, JAWS)</div>
                      <div>• Verify color contrast ratios (WCAG AA minimum)</div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Procurement Checklist</h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>• Request VPAT or Accessibility Conformance Report (ACR)</div>
                      <div>• Specify WCAG 2.2 AA compliance requirement in contracts</div>
                      <div>• Include accessibility testing in acceptance criteria</div>
                      <div>• Require accessibility training for vendor staff</div>
                      <div>• Schedule quarterly compliance reviews</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="progress" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="text-left">
                <h2 className="font-semibold">F) Remediation Progress & Evidence</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Track completion rates and demonstrate ongoing compliance efforts
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 py-4 border-t">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Remediation Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600">
                    <p>
                      Remediation progress is tracked through the Remediation Plan above. Update issue statuses to automatically generate progress metrics, trend analysis, and evidence exports.
                    </p>
                    <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
                      <div className="font-semibold mb-2">Evidence Generated:</div>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Standards adopted and adoption date</li>
                        <li>Digital assets inventory with ownership</li>
                        <li>Prioritized issues backlog</li>
                        <li>Remediation plan with assignments</li>
                        <li>Progress metrics and trend analysis</li>
                        <li>Workflow governance documentation</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
