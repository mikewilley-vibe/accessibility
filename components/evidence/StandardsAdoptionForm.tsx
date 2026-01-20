"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { StandardsAdoption, AccessibilityStandard } from "@/lib/types/evidence";

export function StandardsAdoptionForm() {
  const [standards, setStandards] = useState<StandardsAdoption | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [policyStatement, setPolicyStatement] = useState("");
  const [selectedStandards, setSelectedStandards] = useState<AccessibilityStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const availableStandards: AccessibilityStandard[] = ["WCAG 2.2 A/AA", "Section 508", "VITA"];

  useEffect(() => {
    fetchStandards();
  }, []);

  async function fetchStandards() {
    try {
      setLoading(true);
      const response = await fetch("/api/evidence/standards");
      const data = await response.json();
      setStandards(data);
      setOrganizationName(data.organizationName || "");
      setPolicyStatement(data.policyStatement || "");
      setSelectedStandards(data.adoptedStandards || []);
    } catch (error) {
      console.error("Error fetching standards:", error);
      setMessage("Error loading standards");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!organizationName.trim() || selectedStandards.length === 0) {
      setMessage("Please enter organization name and select at least one standard");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/evidence/standards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          adoptedStandards: selectedStandards,
          policyStatement,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save standards");
      }

      const data = await response.json();
      setStandards(data);
      setMessage("Standards saved successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error saving standards:", error);
      setMessage("Error saving standards");
    } finally {
      setSaving(false);
    }
  }

  function toggleStandard(standard: AccessibilityStandard) {
    if (selectedStandards.includes(standard)) {
      setSelectedStandards(selectedStandards.filter((s) => s !== standard));
    } else {
      setSelectedStandards([...selectedStandards, standard]);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Standards & Policy Adoption</CardTitle>
        <CardDescription>
          Document your organization's commitment to accessibility standards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Organization Name</label>
          <Input
            placeholder="e.g., State Council of Higher Education"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">Select Standards to Adopt</label>
          <div className="space-y-2">
            {availableStandards.map((standard) => (
              <div key={standard} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`standard-${standard}`}
                  checked={selectedStandards.includes(standard)}
                  onChange={() => toggleStandard(standard)}
                  className="h-4 w-4"
                />
                <label htmlFor={`standard-${standard}`} className="text-sm cursor-pointer">
                  {standard}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Policy Statement</label>
          <textarea
            placeholder="Document your organization's commitment to accessibility. Example: 'We are committed to ensuring our digital services are accessible to all users with disabilities in accordance with WCAG 2.2 AA standards...'"
            value={policyStatement}
            onChange={(e) => setPolicyStatement(e.target.value)}
            className="w-full min-h-24 p-2 border rounded text-sm"
          />
        </div>

        {standards && (
          <div className="bg-blue-50 p-3 rounded text-sm">
            <div className="font-semibold mb-1">Current Status:</div>
            <div>Adoption Date: {standards.adoptionDate}</div>
            <div className="mt-1">
              Standards:{" "}
              {standards.adoptedStandards.length > 0 ? (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {standards.adoptedStandards.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500">None yet</span>
              )}
            </div>
          </div>
        )}

        {message && (
          <div
            className={`p-2 rounded text-sm ${
              message.includes("success") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
            {message}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Standards"}
        </Button>
      </CardContent>
    </Card>
  );
}
