"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BuildingDetail {
  id: string;
  matricule: string;
  address: string;
  arrondissement: string | null;
  lot_exclusif: string | null;
  lot_commun: string | null;
  usage_predominant: string | null;
  numero_unite_voisinage: string | null;
  numero_compte_foncier: string | null;
  owner_name: string | null;
  owner_status: string | null;
  owner_postal_address: string | null;
  owner_registration_date: string | null;
  owner_special_conditions: string | null;
  land_frontage: number | null;
  land_area: number | null;
  building_floors: number | null;
  building_year: number | null;
  building_floor_area: number | null;
  building_construction_type: string | null;
  building_physical_link: string | null;
  building_units: number | null;
  building_non_residential_spaces: number | null;
  building_rental_rooms: number | null;
  current_market_date: string | null;
  current_land_value: number | null;
  current_building_value: number | null;
  current_total_value: number | null;
  previous_market_date: string | null;
  previous_total_value: number | null;
  tax_category: string | null;
  taxable_value: number | null;
  non_taxable_value: number | null;
  roll_period: string | null;
  scraped_at: string;
}

export default function BuildingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matricule = params.matricule as string;
  const [building, setBuilding] = useState<BuildingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBuilding();
  }, [matricule]);

  const fetchBuilding = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/montreal-evaluation?matricule=${matricule}`);
      const result = await response.json();

      if (result.data) {
        setBuilding(result.data);
      } else {
        setError("Building not found");
      }
    } catch (err) {
      setError("Failed to load building data");
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async () => {
    try {
      setScraping(true);
      setError(null);
      const response = await fetch("/api/montreal-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricule }),
      });

      const result = await response.json();

      if (response.ok) {
        setBuilding(result.data);
        alert(result.fromCache ? "Data loaded from cache" : "Successfully scraped new data!");
      } else {
        setError(result.error || "Failed to scrape data");
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      setError("Failed to scrape building data");
      alert("Failed to scrape building data");
    } finally {
      setScraping(false);
    }
  };

  const formatNumber = (value: number | null) => {
    if (value === null) return "N/A";
    return value.toLocaleString("en-CA");
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "N/A";
    return `${formatNumber(value)} $`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-CA");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <p>Loading building details...</p>
        </div>
      </div>
    );
  }

  if (error && !building) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Link href="/buildings">
              <Button variant="outline" size="sm">← Back to Buildings</Button>
            </Link>
          </div>
          <Card className="p-8 bg-gray-900 border-gray-800">
            <h1 className="text-2xl font-bold mb-4">Building Not Found</h1>
            <p className="mb-4">Matricule: {matricule}</p>
            <p className="text-gray-400 mb-6">This building hasn't been scraped yet.</p>
            <Button onClick={handleScrape} disabled={scraping}>
              {scraping ? "Scraping..." : "Scrape Building Data"}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!building) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/buildings">
              <Button variant="outline" size="sm">← Back to Buildings</Button>
            </Link>
          </div>
          <Button onClick={handleScrape} disabled={scraping} variant="outline" size="sm">
            {scraping ? "Scraping..." : "Refresh Data"}
          </Button>
        </div>

        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-bold">{building.address}</h1>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(building.address + ', Montreal, QC')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              View on Google Maps
            </a>
          </div>
          <p className="text-gray-400 font-mono text-sm">Matricule: {building.matricule}</p>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Identification */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-blue-400">Identification</h2>
            <div className="space-y-3">
              <DetailRow label="Address" value={building.address} />
              <DetailRow label="Arrondissement" value={building.arrondissement} />
              <DetailRow label="Lot exclusif" value={building.lot_exclusif} />
              <DetailRow label="Lot commun" value={building.lot_commun} />
              <DetailRow label="Usage" value={building.usage_predominant} />
              <DetailRow label="Unité de voisinage" value={building.numero_unite_voisinage} />
              <DetailRow label="Compte foncier" value={building.numero_compte_foncier} />
            </div>
          </Card>

          {/* Owner */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-green-400">Owner</h2>
            <div className="space-y-3">
              <DetailRow label="Name" value={building.owner_name} />
              <DetailRow label="Status" value={building.owner_status} />
              <DetailRow label="Postal Address" value={building.owner_postal_address} />
              <DetailRow label="Registration Date" value={formatDate(building.owner_registration_date)} />
              <DetailRow label="Special Conditions" value={building.owner_special_conditions} />
            </div>
          </Card>

          {/* Land */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">Land</h2>
            <div className="space-y-3">
              <DetailRow label="Frontage" value={building.land_frontage ? `${formatNumber(building.land_frontage)} m` : null} />
              <DetailRow label="Area" value={building.land_area ? `${formatNumber(building.land_area)} m²` : null} />
            </div>
          </Card>

          {/* Building */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-purple-400">Building</h2>
            <div className="space-y-3">
              <DetailRow label="Floors" value={building.building_floors} />
              <DetailRow label="Year Built" value={building.building_year} />
              <DetailRow label="Floor Area" value={building.building_floor_area ? `${formatNumber(building.building_floor_area)} m²` : null} />
              <DetailRow label="Construction Type" value={building.building_construction_type} />
              <DetailRow label="Physical Link" value={building.building_physical_link} />
              <DetailRow label="Units" value={building.building_units} />
              <DetailRow label="Non-Residential Spaces" value={building.building_non_residential_spaces} />
              <DetailRow label="Rental Rooms" value={building.building_rental_rooms} />
            </div>
          </Card>

          {/* Current Valuation */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">Current Valuation</h2>
            <div className="space-y-3">
              <DetailRow label="Market Date" value={building.current_market_date} />
              <DetailRow label="Land Value" value={formatCurrency(building.current_land_value)} className="font-semibold" />
              <DetailRow label="Building Value" value={formatCurrency(building.current_building_value)} className="font-semibold" />
              <DetailRow
                label="Total Value"
                value={formatCurrency(building.current_total_value)}
                className="font-bold text-lg text-cyan-300"
              />
            </div>
          </Card>

          {/* Previous Valuation */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-orange-400">Previous Valuation</h2>
            <div className="space-y-3">
              <DetailRow label="Market Date" value={building.previous_market_date} />
              <DetailRow
                label="Total Value"
                value={formatCurrency(building.previous_total_value)}
                className="font-semibold"
              />
              {building.current_total_value && building.previous_total_value && (
                <DetailRow
                  label="Change"
                  value={`${((building.current_total_value - building.previous_total_value) / building.previous_total_value * 100).toFixed(1)}%`}
                  className={
                    building.current_total_value > building.previous_total_value
                      ? "text-green-400 font-semibold"
                      : "text-red-400 font-semibold"
                  }
                />
              )}
            </div>
          </Card>

          {/* Fiscal */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-pink-400">Fiscal</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-gray-400">Category</span>
                <Badge variant="outline">{building.tax_category || "N/A"}</Badge>
              </div>
              <DetailRow label="Taxable Value" value={formatCurrency(building.taxable_value)} />
              <DetailRow label="Non-Taxable Value" value={formatCurrency(building.non_taxable_value)} />
            </div>
          </Card>

          {/* Metadata */}
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-gray-400">Metadata</h2>
            <div className="space-y-3">
              <DetailRow label="Roll Period" value={building.roll_period} />
              <DetailRow label="Scraped At" value={formatDate(building.scraped_at)} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  className = ""
}: {
  label: string;
  value: string | number | null;
  className?: string;
}) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-gray-400">{label}</span>
      <span className={`text-right ${className}`}>
        {value ?? "N/A"}
      </span>
    </div>
  );
}
