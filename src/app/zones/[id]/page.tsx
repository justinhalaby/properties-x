"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ScrapingZone } from "@/types/scraping-zone";

const ZoneBuildingsMap = dynamic(
  () => import("@/components/map/zone-buildings-map").then((mod) => ({ default: mod.ZoneBuildingsMap })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><p>Loading map...</p></div> }
);

export default function ZoneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [zone, setZone] = useState<ScrapingZone | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrapingLimit, setScrapingLimit] = useState(50);
  const [triggeringJob, setTriggeringJob] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [showOnlyUnscraped, setShowOnlyUnscraped] = useState(false);
  const [scrapingMatricule, setScrapingMatricule] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    fetchZoneDetails();
    fetchProperties();
  }, [resolvedParams.id]);

  useEffect(() => {
    fetchProperties();
  }, [showOnlyUnscraped]);

  const fetchZoneDetails = async () => {
    try {
      const [zoneRes, statsRes] = await Promise.all([
        fetch(`/api/zones/${resolvedParams.id}`),
        fetch(`/api/zones/${resolvedParams.id}/stats`),
      ]);

      const zoneData = await zoneRes.json();
      const statsData = await statsRes.json();

      setZone(statsData.zone || zoneData.data);
      setScrapingLimit(zoneData.data?.target_limit || 50);
    } catch (error) {
      console.error("Failed to fetch zone:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    setPropertiesLoading(true);
    try {
      const params = new URLSearchParams();
      if (showOnlyUnscraped) {
        params.set("onlyUnscraped", "true");
      }

      const res = await fetch(`/api/zones/${resolvedParams.id}/properties?${params}`);
      const data = await res.json();

      if (res.ok) {
        setProperties(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch properties:", error);
    } finally {
      setPropertiesLoading(false);
    }
  };

  const handleTriggerScraping = async () => {
    setTriggeringJob(true);
    try {
      const res = await fetch(`/api/zones/${resolvedParams.id}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: scrapingLimit }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.already_complete) {
          alert("All properties in this zone have already been scraped!");
        } else {
          alert(
            `Scraping job created!\n\nTo start scraping, run this command in your terminal:\n\n${data.command}\n\nThis will scrape ${data.to_scrape} properties.`
          );
        }
        await fetchZoneDetails();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to trigger scraping:", error);
      alert("Failed to create scraping job. Please try again.");
    } finally {
      setTriggeringJob(false);
    }
  };

  const handleScrapeSingle = async (matricule: string) => {
    if (!confirm("Scrape this building now? This will take about 2-3 seconds.")) {
      return;
    }

    setScrapingMatricule(matricule);
    try {
      const res = await fetch(`/api/zones/${resolvedParams.id}/scrape-single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricule }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`Successfully scraped!\n\nAddress: ${data.data.address}\nUnits: ${data.data.units}\nValue: ${data.data.value}`);
        await Promise.all([fetchZoneDetails(), fetchProperties()]);
      } else if (data.already_scraped) {
        alert("This building has already been scraped.");
        await fetchProperties();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to scrape building:", error);
      alert("Failed to scrape building. Please try again.");
    } finally {
      setScrapingMatricule(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading zone...</p>
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8">
          <p className="text-muted-foreground mb-4">Zone not found</p>
          <Button onClick={() => router.push("/zones")}>Back to Zones</Button>
        </Card>
      </div>
    );
  }

  const percentComplete = zone.total_properties
    ? (zone.scraped_count / zone.total_properties) * 100
    : 0;

  const remaining = zone.total_properties - zone.scraped_count;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold">properties-x</Link>
            <nav className="flex items-center gap-4">
              <Link href="/zones" className="text-muted-foreground hover:text-foreground">
                Back to Zones
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{zone.name}</h1>
            {zone.description && (
              <p className="text-muted-foreground">{zone.description}</p>
            )}
          </div>
          <Button
            onClick={() => router.push(`/map?zone=${zone.id}`)}
            variant="outline"
          >
            View Zone on Map
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="font-bold mb-4">Zone Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Properties:</span>
                <span className="font-medium">{zone.total_properties}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scraped:</span>
                <span className="font-medium text-green-600">
                  {zone.scraped_count}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining:</span>
                <span className="font-medium">{remaining}</span>
              </div>
              <div className="pt-3 border-t">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Progress:</span>
                  <span className="font-medium">{percentComplete.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-4">Zone Bounds</h3>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min Latitude:</span>
                <span>{zone.min_lat.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Latitude:</span>
                <span>{zone.max_lat.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min Longitude:</span>
                <span>{zone.min_lng.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Longitude:</span>
                <span>{zone.max_lng.toFixed(6)}</span>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 mb-8">
          <h3 className="font-bold mb-4">Start Scraping</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Number of properties to scrape:
              </label>
              <Input
                type="number"
                value={scrapingLimit}
                onChange={(e) => setScrapingLimit(parseInt(e.target.value) || 1)}
                min={1}
                max={remaining}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {remaining} properties remaining to scrape
              </p>
            </div>

            <Button
              onClick={handleTriggerScraping}
              disabled={triggeringJob || remaining === 0}
              className="w-full"
            >
              {triggeringJob ? "Creating Job..." : "Create Scraping Job"}
            </Button>

            <div className="bg-secondary p-4 rounded text-sm">
              <p className="font-medium mb-2">Note:</p>
              <p className="text-muted-foreground">
                Clicking "Create Scraping Job" will create a job record. To actually
                run the scraper, you'll need to execute the provided command in your
                terminal. This ensures scraping runs in a controlled environment with
                proper rate limiting (90-180 second delays between requests).
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Buildings in Zone</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyUnscraped}
                  onChange={(e) => setShowOnlyUnscraped(e.target.checked)}
                  className="rounded"
                />
                <span>Show only unscraped</span>
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              >
                {viewMode === 'list' ? 'Map View' : 'List View'}
              </Button>
            </div>
          </div>

          {propertiesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading buildings...
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {showOnlyUnscraped
                ? "No unscraped buildings found in this zone"
                : "No buildings found in this zone"}
            </div>
          ) : viewMode === 'map' ? (
            <div className="h-[600px] border border-border rounded-lg overflow-hidden">
              <ZoneBuildingsMap
                zone={zone}
                properties={properties}
                onPropertyClick={(property) => {
                  // Scroll to property in list
                  setViewMode('list');
                  setTimeout(() => {
                    const element = document.getElementById(`property-${property.matricule83}`);
                    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }}
              />
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {properties.map((property, index) => (
                <div
                  key={property.matricule83 || index}
                  id={`property-${property.matricule83}`}
                  className="border border-border rounded-lg p-4 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">
                        {property.clean_address || property.adresse_complete || "Address unavailable"}
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Units:</span>{" "}
                          {property.nombre_logement || "N/A"}
                        </div>
                        <div>
                          <span className="font-medium">Value:</span>{" "}
                          {property.valeur_totale
                            ? new Intl.NumberFormat("en-CA", {
                                style: "currency",
                                currency: "CAD",
                                maximumFractionDigits: 0,
                              }).format(property.valeur_totale)
                            : "N/A"}
                        </div>
                        <div>
                          <span className="font-medium">Year:</span>{" "}
                          {property.annee_construction || "N/A"}
                        </div>
                        <div>
                          <span className="font-medium">Category:</span>{" "}
                          {property.categorie_unite_evaluation || "N/A"}
                        </div>
                      </div>
                      {property.matricule83 && (
                        <div className="text-xs text-muted-foreground mt-2 font-mono">
                          Matricule: {property.matricule83}
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex flex-col gap-2">
                      {property.is_scraped ? (
                        <span className="px-2 py-1 bg-green-600/20 text-green-600 text-xs rounded-full text-center">
                          Scraped
                        </span>
                      ) : (
                        <>
                          <span className="px-2 py-1 bg-yellow-600/20 text-yellow-600 text-xs rounded-full text-center">
                            Not scraped
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handleScrapeSingle(property.matricule83)}
                            disabled={scrapingMatricule === property.matricule83}
                            className="text-xs"
                          >
                            {scrapingMatricule === property.matricule83 ? "Scraping..." : "Scrape Now"}
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/map?zone=${zone.id}&property=${property.matricule83}`)}
                        className="text-xs"
                      >
                        View on Map
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 text-sm text-muted-foreground">
            Showing {properties.length} {showOnlyUnscraped ? "unscraped " : ""}
            {properties.length === 1 ? "building" : "buildings"}
          </div>
        </Card>
      </div>
    </div>
  );
}
