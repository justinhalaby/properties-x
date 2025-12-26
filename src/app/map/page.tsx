"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MapFiltersPanel, type MapFilters } from "@/components/map/map-filters";
import { createClient } from "@/lib/supabase/client";
import type { Property } from "@/types/property";
import type { PropertyEvaluation } from "@/types/property-evaluation";
import type { ScrapingZone } from "@/types/scraping-zone";

// Dynamic import for Leaflet map (no SSR)
const PropertiesMap = dynamic(
  () => import("@/components/map/properties-map").then((mod) => mod.PropertiesMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-secondary flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    ),
  }
);

export default function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [evaluations, setEvaluations] = useState<PropertyEvaluation[]>([]);
  const [zoneBuildings, setZoneBuildings] = useState<PropertyEvaluation[]>([]);
  const [zone, setZone] = useState<ScrapingZone | null>(null);
  const [selectedPropertyMatricule, setSelectedPropertyMatricule] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MapFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const zoneId = searchParams.get('zone');
    const propertyMatricule = searchParams.get('property');

    if (zoneId) {
      fetchZoneData(zoneId);
    } else if (propertyMatricule) {
      setSelectedPropertyMatricule(propertyMatricule);
      fetchData();
    } else {
      setZone(null);
      setZoneBuildings([]);
      setSelectedPropertyMatricule(null);
      fetchData();
    }
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams.get('zone')) {
      fetchData();
    }
  }, [filters]);

  const fetchZoneData = async (zoneId: string) => {
    setLoading(true);
    try {
      // Fetch zone details and buildings
      const [zoneRes, buildingsRes] = await Promise.all([
        fetch(`/api/zones/${zoneId}`),
        fetch(`/api/zones/${zoneId}/properties?limit=10000`),
      ]);

      const [zoneData, buildingsData] = await Promise.all([
        zoneRes.json(),
        buildingsRes.json(),
      ]);

      if (zoneRes.ok) {
        setZone(zoneData.data);
      }

      if (buildingsRes.ok) {
        // Zone buildings already have is_scraped from the API, but we need scraped_at
        const enriched = await enrichEvaluationsWithScrapedStatus(buildingsData.data || []);
        setZoneBuildings(enriched);
      }

      // Also check if there's a selected property
      const propertyMatricule = searchParams.get('property');
      if (propertyMatricule) {
        setSelectedPropertyMatricule(propertyMatricule);
      }
    } catch (error) {
      console.error("Failed to fetch zone data:", error);
    } finally {
      setLoading(false);
    }
  };

  const enrichEvaluationsWithScrapedStatus = async (evaluations: PropertyEvaluation[]) => {
    if (evaluations.length === 0) return evaluations;

    const supabase = await createClient();
    const matricules = evaluations.map((e) => e.matricule83).filter(Boolean);

    if (matricules.length === 0) return evaluations;

    // Fetch scraped details
    const { data: scrapedDetails } = await supabase
      .from("montreal_evaluation_details")
      .select("matricule, created_at")
      .in("matricule", matricules);

    const scrapedMap = new Map(
      scrapedDetails?.map((s) => [s.matricule, s.created_at]) || []
    );

    // Add scraped status to evaluations
    return evaluations.map((e) => ({
      ...e,
      is_scraped: scrapedMap.has(e.matricule83),
      scraped_at: scrapedMap.get(e.matricule83) || null,
    }));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Only fetch evaluations if filters are applied
      const hasFilters = Object.keys(filters).length > 0;

      if (!hasFilters) {
        // No filters = no evaluations shown
        setEvaluations([]);
        const propertiesRes = await fetch("/api/properties");
        const propertiesData = await propertiesRes.json();
        if (propertiesRes.ok) {
          setProperties(propertiesData.data || []);
        }
        setLoading(false);
        return;
      }

      // Build query params for evaluations
      const params = new URLSearchParams({
        hasCoordinates: "true",
        limit: "10000",
      });

      if (filters.minUnits) params.append("minLogements", filters.minUnits.toString());
      if (filters.maxUnits) params.append("maxLogements", filters.maxUnits.toString());
      if (filters.minYear) params.append("minYear", filters.minYear.toString());
      if (filters.maxYear) params.append("maxYear", filters.maxYear.toString());
      if (filters.category) params.append("categorie", filters.category);
      if (filters.search) params.append("search", filters.search);

      // Fetch both properties and evaluations in parallel
      const [propertiesRes, evaluationsRes] = await Promise.all([
        fetch("/api/properties"),
        fetch(`/api/property-evaluations?${params.toString()}`),
      ]);

      const [propertiesData, evaluationsData] = await Promise.all([
        propertiesRes.json(),
        evaluationsRes.json(),
      ]);

      if (propertiesRes.ok) {
        setProperties(propertiesData.data || []);
      }

      if (evaluationsRes.ok) {
        const enriched = await enrichEvaluationsWithScrapedStatus(evaluationsData.data || []);
        setEvaluations(enriched);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePropertyClick = (property: Property) => {
    router.push(`/properties/${property.id}`);
  };

  const handleScrapeSingle = async (matricule: string) => {
    try {
      const res = await fetch(`/api/property-evaluations/${matricule}/scrape`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        // Refresh the data to show updated scrape status
        const zoneId = searchParams.get('zone');
        if (zoneId) {
          await fetchZoneData(zoneId);
        } else {
          await fetchData();
        }
        return { success: true, data: data.data };
      } else if (data.already_scraped) {
        return { success: false, already_scraped: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Failed to scrape building:", error);
      return { success: false, error: "Failed to scrape building" };
    }
  };

  const handleApplyFilters = (newFilters: MapFilters) => {
    setFilters(newFilters);
    setFiltersOpen(false);
  };

  const propertiesWithLocation = properties.filter(
    (p) => p.latitude != null && p.longitude != null
  );

  const evaluationsWithLocation = zone
    ? zoneBuildings.filter((e) => e.latitude != null && e.longitude != null)
    : evaluations.filter((e) => e.latitude != null && e.longitude != null);

  // Filter to selected property if specified
  const displayEvaluations = selectedPropertyMatricule && !zone
    ? evaluationsWithLocation.filter((e) => e.matricule83 === selectedPropertyMatricule)
    : evaluationsWithLocation;

  const totalOnMap = propertiesWithLocation.length + displayEvaluations.length;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}

      {/* Map Stats Bar */}
      <div className="border-b border-border bg-card px-4 py-2 flex-shrink-0">
        <div className="container mx-auto flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {zone ? (
              <>
                <span className="text-muted-foreground">
                  Zone:{" "}
                  <span className="text-foreground font-medium">{zone.name}</span>
                </span>
                <span className="text-muted-foreground">
                  Showing{" "}
                  <span className="text-foreground font-medium">
                    {displayEvaluations.length.toLocaleString()}
                  </span>{" "}
                  {selectedPropertyMatricule ? "selected building" : "buildings"}
                </span>
              </>
            ) : selectedPropertyMatricule ? (
              <span className="text-muted-foreground">
                Showing selected building
              </span>
            ) : (
              <>
                <span className="text-muted-foreground">
                  Showing{" "}
                  <span className="text-foreground font-medium">
                    {totalOnMap.toLocaleString()}
                  </span>{" "}
                  locations on map
                </span>
                <span className="text-muted-foreground">
                  ({propertiesWithLocation.length} properties, {displayEvaluations.length} evaluations)
                </span>
              </>
            )}
          </div>
          {(zone || selectedPropertyMatricule) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/map')}
            >
              Clear Selection
            </Button>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {/* Filter Panel */}
        <MapFiltersPanel
          onApplyFilters={handleApplyFilters}
          isOpen={filtersOpen}
          onToggle={() => setFiltersOpen(!filtersOpen)}
        />

        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : totalOnMap === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <svg
              className="w-16 h-16 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="text-lg mb-2">
              {Object.keys(filters).length > 0
                ? "No evaluations match your filters"
                : "Use filters to display buildings on the map"}
            </p>
            <p className="text-sm mb-4">
              {Object.keys(filters).length > 0
                ? "Try adjusting your filter criteria"
                : "Click the Filters button to select buildings by units, year, category, or address"}
            </p>
            {Object.keys(filters).length > 0 ? (
              <Button onClick={() => handleApplyFilters({})}>Clear Filters</Button>
            ) : (
              <Button onClick={() => setFiltersOpen(true)}>Open Filters</Button>
            )}
          </div>
        ) : (
          <PropertiesMap
            properties={zone ? [] : propertiesWithLocation}
            evaluations={displayEvaluations}
            onPropertyClick={handlePropertyClick}
            onScrapeSingle={handleScrapeSingle}
            highlightedMatricule={selectedPropertyMatricule}
            zoneBounds={zone ? {
              minLat: zone.min_lat,
              maxLat: zone.max_lat,
              minLng: zone.min_lng,
              maxLng: zone.max_lng,
            } : undefined}
          />
        )}
      </div>
    </div>
  );
}
