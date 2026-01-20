"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PrioritizedIssue } from "@/lib/types/evidence";

export function PrioritizationBacklogView() {
  const [issues, setIssues] = useState<PrioritizedIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIssues();
  }, []);

  async function fetchIssues() {
    try {
      const response = await fetch("/api/evidence/issues");
      const data = await response.json();
      // Sort by score descending
      data.sort((a: PrioritizedIssue, b: PrioritizedIssue) => b.score.totalScore - a.score.totalScore);
      setIssues(data);
    } catch (error) {
      console.error("Error fetching issues:", error);
    } finally {
      setLoading(false);
    }
  }

  function severityBadge(severity: string) {
    const colors: Record<string, string> = {
      Critical: "bg-red-100 text-red-800",
      High: "bg-orange-100 text-orange-800",
      Medium: "bg-yellow-100 text-yellow-800",
      Low: "bg-green-100 text-green-800",
    };
    return <Badge className={`text-xs ${colors[severity] || ""}`}>{severity}</Badge>;
  }

  if (loading) {
    return <div>Loading issues...</div>;
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Prioritized Issues Backlog</CardTitle>
        <CardDescription>
          Issues ranked by public impact, compliance risk, and usage frequency
        </CardDescription>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No issues documented yet</div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue, idx) => (
              <div key={issue.id} className="border p-3 rounded">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">#{idx + 1}</span>
                      <span className="font-semibold">{issue.issueType}</span>
                      {severityBadge(issue.severity)}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">{issue.rationale}</div>
                    <div className="text-sm mb-2">
                      <span className="font-medium">Recommended Fix:</span> {issue.recommendedFix}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {issue.affectedUserGroups.map((group) => (
                        <Badge key={group} variant="outline" className="text-xs">
                          {group}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-semibold text-blue-600">
                      Score: {issue.score.totalScore.toFixed(1)}/5
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Freq: {issue.frequency}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
