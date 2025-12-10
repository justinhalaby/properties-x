"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PropertyGrid } from "@/components/property/property-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Property } from "@/types/property";

export default function Dashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async (searchTerm?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) {
        params.set("search", searchTerm);
      }

      const response = await fetch(`/api/properties?${params}`);
      const result = await response.json();

      if (response.ok) {
        setProperties(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch properties:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProperties(search);
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
                href="/map"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Map View
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Total Properties</p>
            <p className="text-2xl font-bold">{properties.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat("en-CA", {
                style: "currency",
                currency: "CAD",
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(
                properties.reduce((sum, p) => sum + (p.price || 0), 0)
              )}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">With Location</p>
            <p className="text-2xl font-bold">
              {properties.filter((p) => p.latitude && p.longitude).length}
            </p>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2 max-w-xl">
            <Input
              type="text"
              placeholder="Search by title, address, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit">Search</Button>
          </div>
        </form>

        {/* Properties Grid */}
        <PropertyGrid
          properties={properties}
          loading={loading}
          emptyMessage="No properties yet. Add your first property to get started!"
        />
      </main>
    </div>
  );
}
