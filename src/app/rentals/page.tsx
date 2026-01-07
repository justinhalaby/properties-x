"use client";

import { useEffect, useState } from "react";
import { RentalGrid } from "@/components/rental/rental-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { Rental } from "@/types/rental";

export default function RentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchRentals();
  }, []);

  const fetchRentals = async (searchTerm?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);

      const response = await fetch(`/api/rentals?${params}`);
      const result = await response.json();
      setRentals(result.data || []);
    } catch (error) {
      console.error("Error fetching rentals:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRentals(search);
  };

  // Calculate stats
  const stats = {
    total: rentals.length,
    avgRent: rentals.length > 0
      ? Math.round(
          rentals.reduce((sum, r) => sum + (r.monthly_rent || 0), 0) / rentals.filter(r => r.monthly_rent).length
        )
      : 0,
    withLocation: rentals.filter((r) => r.latitude && r.longitude).length,
    petFriendly: rentals.filter((r) => r.pet_policy.length > 0).length,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Rentals</h1>
        <Link href="/add-rental">
          <Button>Add Rental</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Rentals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Rent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats.avgRent > 0
                ? new Intl.NumberFormat("en-CA", {
                    style: "currency",
                    currency: "CAD",
                    maximumFractionDigits: 0,
                  }).format(stats.avgRent)
                : "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              With Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.withLocation}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pet Friendly
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.petFriendly}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Search rentals by title, address, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">Search</Button>
          {search && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("");
                fetchRentals();
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </form>

      {/* Grid */}
      <RentalGrid
        rentals={rentals}
        loading={loading}
        emptyMessage={search ? "No rentals match your search" : "No rentals found. Add your first rental to get started!"}
      />
    </div>
  );
}
