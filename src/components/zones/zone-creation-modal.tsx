"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ZoneBounds } from "@/types/scraping-zone";

interface ZoneCreationModalProps {
  bounds: ZoneBounds;
  onSave: (data: { name: string; description: string; targetLimit: number }) => Promise<void>;
  onCancel: () => void;
}

export function ZoneCreationModal({
  bounds,
  onSave,
  onCancel,
}: ZoneCreationModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetLimit, setTargetLimit] = useState(50);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({ name, description, targetLimit });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Save Scraping Zone</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Zone Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Downtown East"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Zone purpose or notes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Default Scraping Limit
            </label>
            <Input
              type="number"
              value={targetLimit}
              onChange={(e) => setTargetLimit(parseInt(e.target.value) || 50)}
              min={1}
              max={1000}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Max properties to scrape per run (can be changed later)
            </p>
          </div>

          <div className="bg-secondary p-3 rounded text-sm">
            <div className="font-medium mb-2">Zone Bounds:</div>
            <div className="space-y-1 text-xs text-muted-foreground font-mono">
              <div>Lat: {bounds.minLat.toFixed(6)} to {bounds.maxLat.toFixed(6)}</div>
              <div>Lng: {bounds.minLng.toFixed(6)} to {bounds.maxLng.toFixed(6)}</div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : "Save Zone"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
