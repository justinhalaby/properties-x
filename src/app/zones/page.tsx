"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { ZonesList } from "@/components/zones/zones-list";
import { ZoneCreationModal } from "@/components/zones/zone-creation-modal";
import type { ScrapingZone, ZoneBounds } from "@/types/scraping-zone";
import type { PropertyEvaluation } from "@/types/property-evaluation";

const ZoneDrawingMap = dynamic(
  () => import("@/components/map/zone-drawing-map").then((mod) => ({ default: mod.ZoneDrawingMap })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><p>Loading map...</p></div> }
);

export default function ZonesPage() {
  const router = useRouter();
  const [zones, setZones] = useState<ScrapingZone[]>([]);
  const [evaluations, setEvaluations] = useState<PropertyEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawingMode, setDrawingMode] = useState(false);
  const [pendingZone, setPendingZone] = useState<ZoneBounds | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    fetchZones();
    fetchSampleEvaluations();
  }, []);

  const fetchZones = async () => {
    try {
      const res = await fetch("/api/zones");
      const data = await res.json();
      setZones(data.data || []);
    } catch (error) {
      console.error("Failed to fetch zones:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSampleEvaluations = async () => {
    try {
      const res = await fetch("/api/property-evaluations?hasCoordinates=true&limit=1000");
      const data = await res.json();
      setEvaluations(data.data || []);
    } catch (error) {
      console.error("Failed to fetch evaluations:", error);
    }
  };

  const handleZoneDrawn = (bounds: ZoneBounds) => {
    setPendingZone(bounds);
    setDrawingMode(false);
  };

  const handleSaveZone = async (data: {
    name: string;
    description: string;
    targetLimit: number;
    minUnits: number;
    maxUnits: number | null;
  }) => {
    if (!pendingZone) return;

    try {
      const res = await fetch("/api/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          target_limit: data.targetLimit,
          min_units: data.minUnits,
          max_units: data.maxUnits,
          min_lat: pendingZone.minLat,
          max_lat: pendingZone.maxLat,
          min_lng: pendingZone.minLng,
          max_lng: pendingZone.maxLng,
        }),
      });

      if (res.ok) {
        setPendingZone(null);
        await fetchZones();
      } else {
        const error = await res.json();
        alert(`Failed to save zone: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to save zone:", error);
      alert("Failed to save zone. Please try again.");
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("Are you sure you want to delete this zone?")) return;

    try {
      const res = await fetch(`/api/zones/${zoneId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchZones();
      } else {
        const error = await res.json();
        alert(`Failed to delete zone: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to delete zone:", error);
      alert("Failed to delete zone. Please try again.");
    }
  };

  const handleViewZone = (zone: ScrapingZone) => {
    router.push(`/zones/${zone.id}`);
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Scraping Zones</h1>
            <p className="text-muted-foreground">
              Define zones on the map to batch scrape Montreal properties
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
            >
              {viewMode === 'list' ? 'Map View' : 'List View'}
            </Button>
            <Button
              onClick={() => {
                setViewMode('map');
                setDrawingMode(true);
              }}
            >
              Draw New Zone
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Loading zones...</p>
          </div>
        ) : viewMode === 'list' ? (
          <ZonesList
            zones={zones}
            onView={handleViewZone}
            onDelete={handleDeleteZone}
          />
        ) : (
          <div className="h-[600px] border border-border rounded-lg overflow-hidden">
            <ZoneDrawingMap
              evaluations={evaluations}
              zones={zones}
              drawingEnabled={drawingMode}
              onZoneDrawn={handleZoneDrawn}
              onZoneClick={handleViewZone}
            />
          </div>
        )}
      </div>

      {pendingZone && (
        <ZoneCreationModal
          bounds={pendingZone}
          onSave={handleSaveZone}
          onCancel={() => setPendingZone(null)}
        />
      )}
    </>
  );
}
