"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MapFiltersPanel, type MapFilters } from "@/components/map/map-filters";
import type { Property } from "@/types/property";
import type { PropertyEvaluation } from "@/types/property-evaluation";

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
  const [properties, setProperties] = useState<Property[]>([]);
  const [evaluations, setEvaluations] = useState<PropertyEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MapFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filters]);

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
        setEvaluations(evaluationsData.data || []);
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

  const handleApplyFilters = (newFilters: MapFilters) => {
    setFilters(newFilters);
    setFiltersOpen(false);
  };

  const propertiesWithLocation = properties.filter(
    (p) => p.latitude != null && p.longitude != null
  );

  const evaluationsWithLocation = evaluations.filter(
    (e) => e.latitude != null && e.longitude != null
  );

  const totalOnMap = propertiesWithLocation.length + evaluationsWithLocation.length;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-foreground">
              properties-x
            </Link>

            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Grid View
              </Link>
              <Link
                href="/zones"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Zones
              </Link>
              <Link
                href="/buildings"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Evaluations
              </Link>
              <Link href="/add-property">
                <Button size="sm">Add Property</Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Map Stats Bar */}
      <div className="border-b border-border bg-card px-4 py-2 flex-shrink-0">
        <div className="container mx-auto flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Showing{" "}
            <span className="text-foreground font-medium">
              {totalOnMap.toLocaleString()}
            </span>{" "}
            locations on map
          </span>
          <span className="text-muted-foreground">
            ({propertiesWithLocation.length} properties, {evaluationsWithLocation.length} evaluations)
          </span>
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
            properties={propertiesWithLocation}
            evaluations={evaluationsWithLocation}
            onPropertyClick={handlePropertyClick}
          />
        )}
      </div>
    </div>
  );
}
