"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

const OwnerPropertiesMap = dynamic(
  () => import("@/components/map/owner-properties-map").then((mod) => ({ default: mod.OwnerPropertiesMap })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><p>Loading map...</p></div> }
);

interface PropertyWithCoords {
  matricule: string;
  address: string;
  current_total_value: number | null;
  latitude: number;
  longitude: number;
  [key: string]: any;
}

export default function OwnerPropertiesPage() {
  const params = useParams();
  const ownerName = decodeURIComponent(params.ownerName as string);

  const [properties, setProperties] = useState<PropertyWithCoords[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  useEffect(() => {
    fetchProperties();
  }, [ownerName]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/owners/${encodeURIComponent(ownerName)}/properties`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch properties');
      }

      setProperties(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "N/A";
    return `${value.toLocaleString("en-CA")} $`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-400">Loading properties...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-900/20 border border-red-900 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/companies">
          <Button variant="outline" size="sm">← Back to Owners</Button>
        </Link>
        <h1 className="text-3xl font-bold text-white mt-4 mb-2">
          Properties owned by {ownerName}
        </h1>
        <p className="text-gray-400">
          {properties.length} {properties.length === 1 ? 'property' : 'properties'} with coordinates
        </p>
      </div>

      {/* View Toggle */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={viewMode === 'map' ? 'primary' : 'outline'}
          onClick={() => setViewMode('map')}
          size="sm"
        >
          Map View
        </Button>
        <Button
          variant={viewMode === 'list' ? 'primary' : 'outline'}
          onClick={() => setViewMode('list')}
          size="sm"
        >
          List View
        </Button>
      </div>

      {properties.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No properties with coordinates found for this owner</p>
        </div>
      ) : viewMode === 'map' ? (
        <div className="bg-gray-800 rounded-lg overflow-hidden" style={{ height: '600px' }}>
          <OwnerPropertiesMap properties={properties} ownerName={ownerName} />
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Matricule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {properties.map((property) => (
                  <tr key={property.matricule} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div className="text-sm text-white">{property.address}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm text-gray-300">{property.matricule}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300">
                        {formatCurrency(property.current_total_value)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/buildings/${property.matricule}`}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
