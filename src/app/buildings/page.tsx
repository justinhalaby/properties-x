"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EvaluationFilters } from "@/components/evaluation/evaluation-filters";
import { EvaluationTable } from "@/components/evaluation/evaluation-table";
import { EvaluationStats } from "@/components/evaluation/evaluation-stats";
import type {
  PropertyEvaluation,
  PropertyEvaluationFilters,
  PropertyEvaluationListResponse,
} from "@/types/property-evaluation";

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<PropertyEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PropertyEvaluationFilters>({
    page: 1,
    limit: 50,
  });
  const [response, setResponse] =
    useState<PropertyEvaluationListResponse | null>(null);

  useEffect(() => {
    fetchBuildings();
  }, [filters]);

  const fetchBuildings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, value.toString());
        }
      });

      const res = await fetch(`/api/property-evaluations?${params}`);
      const data: PropertyEvaluationListResponse = await res.json();

      setResponse(data);
      setBuildings(data.data || []);
    } catch (error) {
      console.error("Failed to fetch buildings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: PropertyEvaluationFilters) => {
    setFilters(newFilters);
  };

  const handleReset = () => {
    setFilters({ page: 1, limit: 50 });
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
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
                My Properties
              </Link>
              <Link
                href="/map"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Map View
              </Link>
              <Link
                href="/buildings"
                className="text-foreground font-medium"
              >
                Buildings
              </Link>
              <Link href="/add-property">
                <Button size="sm">Add Property</Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
            Montreal Buildings
          </h1>
          <p className="text-muted-foreground">
            Browse 512,000+ buildings and addresses from the Montreal urban
            community
          </p>
        </div>

        {/* Stats */}
        <EvaluationStats total={response?.total || 0} />

        {/* Filters */}
        <EvaluationFilters
          filters={filters}
          onChange={handleFiltersChange}
          onReset={handleReset}
        />

        {/* Results Table */}
        <EvaluationTable
          evaluations={buildings}
          loading={loading}
          pagination={response}
          onPageChange={handlePageChange}
        />
      </main>
    </div>
  );
}
