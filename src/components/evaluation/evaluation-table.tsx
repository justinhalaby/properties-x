"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type {
  PropertyEvaluation,
  PropertyEvaluationListResponse,
} from "@/types/property-evaluation";

interface EvaluationTableProps {
  evaluations: PropertyEvaluation[];
  loading: boolean;
  pagination: PropertyEvaluationListResponse | null;
  onPageChange: (page: number) => void;
}

export function EvaluationTable({
  evaluations,
  loading,
  pagination,
  onPageChange,
}: EvaluationTableProps) {
  const [scrapingMatricules, setScrapingMatricules] = useState<Set<string>>(new Set());
  const [scrapedMatricules, setScrapedMatricules] = useState<Set<string>>(new Set());
  const [geocodingIds, setGeocodingIds] = useState<Set<number>>(new Set());

  const handleScrape = async (matricule: string) => {
    setScrapingMatricules(prev => new Set(prev).add(matricule));

    try {
      const response = await fetch("/api/montreal-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricule }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to scrape");
      }

      setScrapedMatricules(prev => new Set(prev).add(matricule));
      alert(result.fromCache ? "Data loaded from database" : "Successfully scraped and saved!");
    } catch (error) {
      console.error("Scraping error:", error);
      alert(error instanceof Error ? error.message : "Failed to scrape property details");
    } finally {
      setScrapingMatricules(prev => {
        const newSet = new Set(prev);
        newSet.delete(matricule);
        return newSet;
      });
    }
  };

  const handleGeocode = async (id_uev: number) => {
    setGeocodingIds(prev => new Set(prev).add(id_uev));

    try {
      const response = await fetch("/api/property-evaluations/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_uev }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.data.cached ? "Coordinates loaded from cache" : "Successfully geocoded! View on map.");
        // Optionally refresh page to show on map
        window.location.reload();
      } else {
        alert(`Failed to geocode: ${result.error}`);
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      alert("Failed to geocode address");
    } finally {
      setGeocodingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id_uev);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <div className="text-center py-12 bg-card border border-border rounded-xl">
        <p className="text-muted-foreground">
          No property evaluations found. Try adjusting your filters.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto bg-card border border-border rounded-xl">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Address
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Matricule
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Usage
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Year
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Units
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Floors
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Areas (m²)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Last Scraped
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {evaluations.map((evaluation) => (
              <tr
                key={evaluation.id_uev}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">
                    {evaluation.clean_address}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                  {evaluation.matricule83 || "-"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      evaluation.categorie_uef === "Condominium"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {evaluation.categorie_uef}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {evaluation.libelle_utilisation}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {evaluation.annee_construction === 9999
                    ? "Unknown"
                    : evaluation.annee_construction || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {evaluation.nombre_logement || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {evaluation.etage_hors_sol || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {evaluation.superficie_terrain
                    ? `${evaluation.superficie_terrain.toLocaleString()}`
                    : "-"}
                  {" / "}
                  {evaluation.superficie_batiment
                    ? `${evaluation.superficie_batiment.toLocaleString()}`
                    : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {evaluation.scraped_at
                    ? new Date(evaluation.scraped_at).toLocaleDateString("en-CA")
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 items-center">
                    {!evaluation.scraped_at && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={scrapingMatricules.has(evaluation.matricule83 || "") || !evaluation.matricule83}
                        onClick={() => evaluation.matricule83 && handleScrape(evaluation.matricule83)}
                        className="min-w-[100px]"
                      >
                        {scrapingMatricules.has(evaluation.matricule83 || "") ? (
                          <>Scraping...</>
                        ) : (
                          <>Scrape</>
                        )}
                      </Button>
                    )}
                    {!evaluation.latitude && !evaluation.longitude && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={geocodingIds.has(evaluation.id_uev)}
                        onClick={() => handleGeocode(evaluation.id_uev)}
                        className="min-w-[100px]"
                      >
                        {geocodingIds.has(evaluation.id_uev) ? (
                          <>Geocoding...</>
                        ) : (
                          <>Add to Map</>
                        )}
                      </Button>
                    )}
                    {evaluation.matricule83 && (
                      <Link href={`/buildings/${evaluation.matricule83}`}>
                        <Button size="sm" variant="secondary">
                          View
                        </Button>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {evaluations.map((evaluation) => (
          <div
            key={evaluation.id_uev}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="font-medium text-foreground mb-2">
              {evaluation.clean_address}
            </div>
            <div className="text-xs text-muted-foreground font-mono mb-2">
              Matricule: {evaluation.matricule83 || "-"}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant={
                  evaluation.categorie_uef === "Condominium"
                    ? "default"
                    : "secondary"
                }
              >
                {evaluation.categorie_uef}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {evaluation.libelle_utilisation}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Year:</span>{" "}
                {evaluation.annee_construction === 9999
                  ? "Unknown"
                  : evaluation.annee_construction || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">Units:</span>{" "}
                {evaluation.nombre_logement || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">Floors:</span>{" "}
                {evaluation.etage_hors_sol || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">Land:</span>{" "}
                {evaluation.superficie_terrain
                  ? `${evaluation.superficie_terrain.toLocaleString()} m²`
                  : "-"}
              </div>
              <div>
                <span className="text-muted-foreground">Last Scraped:</span>{" "}
                {evaluation.scraped_at
                  ? new Date(evaluation.scraped_at).toLocaleDateString("en-CA")
                  : "-"}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {!evaluation.scraped_at && (
                <Button
                  size="sm"
                  variant="default"
                  disabled={scrapingMatricules.has(evaluation.matricule83 || "") || !evaluation.matricule83}
                  onClick={() => evaluation.matricule83 && handleScrape(evaluation.matricule83)}
                  className="flex-1"
                >
                  {scrapingMatricules.has(evaluation.matricule83 || "") ? (
                    <>Scraping...</>
                  ) : (
                    <>Scrape</>
                  )}
                </Button>
              )}
              {!evaluation.latitude && !evaluation.longitude && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={geocodingIds.has(evaluation.id_uev)}
                  onClick={() => handleGeocode(evaluation.id_uev)}
                  className="flex-1"
                >
                  {geocodingIds.has(evaluation.id_uev) ? (
                    <>Geocoding...</>
                  ) : (
                    <>Add to Map</>
                  )}
                </Button>
              )}
              {evaluation.matricule83 && (
                <Link href={`/buildings/${evaluation.matricule83}`} className={!evaluation.scraped_at && !evaluation.latitude && !evaluation.longitude ? "" : "flex-1"}>
                  <Button size="sm" variant={evaluation.scraped_at ? "default" : "outline"} className="w-full">
                    View
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit + 1).toLocaleString()} to{" "}
            {Math.min(
              pagination.page * pagination.limit,
              pagination.total
            ).toLocaleString()}{" "}
            of {pagination.total.toLocaleString()} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages.toLocaleString()}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
