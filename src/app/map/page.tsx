"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch both properties and evaluations in parallel
      const [propertiesRes, evaluationsRes] = await Promise.all([
        fetch("/api/properties"),
        fetch("/api/property-evaluations?hasCoordinates=true&limit=1000"),
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
            <p className="text-lg mb-2">No properties with location data</p>
            <p className="text-sm mb-4">
              Add properties with addresses to see them on the map
            </p>
            <Link href="/add-property">
              <Button>Add Property</Button>
            </Link>
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
