"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { DigitalAsset } from "@/lib/types/evidence";

export function AssetInventoryForm() {
  const [assets, setAssets] = useState<DigitalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    type: "Website",
    environment: "Production",
    owner: "",
    publicFacing: true,
    criticalService: false,
  });

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    try {
      const response = await fetch("/api/evidence/assets");
      const data = await response.json();
      setAssets(data);
    } catch (error) {
      console.error("Error fetching assets:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAsset() {
    if (!formData.name.trim() || !formData.url.trim() || !formData.owner.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const response = await fetch("/api/evidence/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newAsset = await response.json();
        setAssets([...assets, newAsset]);
        setFormData({
          name: "",
          url: "",
          type: "Website",
          environment: "Production",
          owner: "",
          publicFacing: true,
          criticalService: false,
        });
        setShowForm(false);
      }
    } catch (error) {
      console.error("Error adding asset:", error);
    }
  }

  if (loading) {
    return <div>Loading assets...</div>;
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Digital Asset Inventory</CardTitle>
        <CardDescription>Register and track all digital services for accessibility assessment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="w-full">
            + Add New Asset
          </Button>
        )}

        {showForm && (
          <div className="border p-4 rounded space-y-3">
            <Input
              placeholder="Asset Name (e.g., Main Website)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              placeholder="URL (e.g., https://example.gov)"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="border rounded p-2 text-sm"
              >
                <option>Website</option>
                <option>Web Application</option>
                <option>Mobile App</option>
                <option>Document Portal</option>
              </select>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="border rounded p-2 text-sm"
              >
                <option>Production</option>
                <option>Staging</option>
                <option>Development</option>
              </select>
            </div>
            <Input
              placeholder="Owner (person/team)"
              value={formData.owner}
              onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
            />
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={formData.publicFacing}
                  onChange={(e) => setFormData({ ...formData, publicFacing: e.target.checked })}
                />
                Public Facing
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={formData.criticalService}
                  onChange={(e) => setFormData({ ...formData, criticalService: e.target.checked })}
                />
                Critical Service
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddAsset} className="flex-1">
                Save Asset
              </Button>
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {assets.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No assets registered yet</div>
          ) : (
            assets.map((asset) => (
              <div key={asset.id} className="border p-3 rounded text-sm">
                <div className="font-semibold">{asset.name}</div>
                <div className="text-gray-600 text-xs mt-1">{asset.url}</div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {asset.type}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {asset.environment}
                  </Badge>
                  {asset.publicFacing && <Badge className="text-xs">Public</Badge>}
                  {asset.criticalService && <Badge variant="destructive" className="text-xs">Critical</Badge>}
                </div>
                <div className="text-xs text-gray-500 mt-2">Owner: {asset.owner}</div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
