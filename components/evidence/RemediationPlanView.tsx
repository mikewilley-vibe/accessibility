"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RemediationTask } from "@/lib/types/evidence";

export function RemediationPlanView() {
  const [tasks, setTasks] = useState<RemediationTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      const response = await fetch("/api/evidence/remediation");
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
    try {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        const updated: RemediationTask = {
          ...task,
          status: newStatus as any,
          statusChangedAt: new Date().toISOString(),
          startDate:
            newStatus === "In Progress" && !task.startDate
              ? new Date().toISOString()
              : task.startDate,
          completionDate: newStatus === "Complete" ? new Date().toISOString() : task.completionDate,
        };

        const response = await fetch("/api/evidence/remediation", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });

        if (response.ok) {
          setTasks(tasks.map((t) => (t.id === taskId ? updated : t)));
        }
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  }

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      "Not Started": "bg-gray-100 text-gray-800",
      "In Progress": "bg-blue-100 text-blue-800",
      Complete: "bg-green-100 text-green-800",
      Blocked: "bg-red-100 text-red-800",
      Deferred: "bg-yellow-100 text-yellow-800",
    };
    return <Badge className={`text-xs cursor-pointer ${colors[status] || ""}`}>{status}</Badge>;
  }

  if (loading) {
    return <div>Loading tasks...</div>;
  }

  const statusStats = {
    "Not Started": tasks.filter((t) => t.status === "Not Started").length,
    "In Progress": tasks.filter((t) => t.status === "In Progress").length,
    Complete: tasks.filter((t) => t.status === "Complete").length,
    Blocked: tasks.filter((t) => t.status === "Blocked").length,
    Deferred: tasks.filter((t) => t.status === "Deferred").length,
  };

  const percentComplete = tasks.length > 0 ? Math.round((statusStats.Complete / tasks.length) * 100) : 0;

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Remediation Plan</CardTitle>
        <CardDescription>Track accessibility fix implementation with ownership and timelines</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-5 gap-2 text-sm">
          <div className="border rounded p-2 text-center">
            <div className="font-semibold text-lg">{statusStats["Not Started"]}</div>
            <div className="text-xs text-gray-600">Not Started</div>
          </div>
          <div className="border rounded p-2 text-center">
            <div className="font-semibold text-lg">{statusStats["In Progress"]}</div>
            <div className="text-xs text-gray-600">In Progress</div>
          </div>
          <div className="border rounded p-2 text-center">
            <div className="font-semibold text-lg">{statusStats.Complete}</div>
            <div className="text-xs text-gray-600">Complete</div>
          </div>
          <div className="border rounded p-2 text-center">
            <div className="font-semibold text-lg">{statusStats.Blocked}</div>
            <div className="text-xs text-gray-600">Blocked</div>
          </div>
          <div className="border rounded p-2 text-center">
            <div className="font-bold text-lg text-green-600">{percentComplete}%</div>
            <div className="text-xs text-gray-600">Complete</div>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No remediation tasks yet</div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="border p-3 rounded text-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold">{task.issueSummary}</div>
                    <div className="text-gray-600 text-xs mt-1">{task.recommendedFix}</div>
                  </div>
                  <div className="ml-3 text-right">
                    <div className="text-xs text-gray-500 mb-1">Target: {task.targetDate}</div>
                    <select
                      value={task.status}
                      onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                      className="text-xs border rounded p-1"
                    >
                      <option>Not Started</option>
                      <option>In Progress</option>
                      <option>Complete</option>
                      <option>Blocked</option>
                      <option>Deferred</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline">{task.ownerRole}</Badge>
                  {task.assignedTo && <Badge variant="outline">{task.assignedTo}</Badge>}
                  {task.blockers && <Badge variant="destructive">Blocked: {task.blockers}</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
