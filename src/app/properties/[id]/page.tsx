"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Property } from "@/types/property";

// Dynamic import for Leaflet map (no SSR)
const PropertyMap = dynamic(
  () => import("@/components/map/property-map").then((mod) => mod.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[300px] bg-secondary rounded-lg flex items-center justify-center">
        <LoadingSpinner />
      </div>
    ),
  }
);

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProperty();
  }, [params.id]);

  const fetchProperty = async () => {
    try {
      const response = await fetch(`/api/properties/${params.id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Property not found");
      }

      setProperty(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load property");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this property?")) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/properties/${params.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete property");
      }

      router.push("/");
    } catch {
      alert("Failed to delete property");
    } finally {
      setDeleting(false);
    }
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "Price N/A";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <Link href="/" className="text-xl font-bold text-foreground">
              properties-x
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">{error || "Property not found"}</p>
            <Link href="/">
              <Button>Back to Dashboard</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
              <Link href="/map" className="text-muted-foreground hover:text-foreground">
                Map View
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
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            {property.images.length > 0 && (
              <div className="aspect-[16/9] bg-secondary rounded-xl overflow-hidden">
                <img
                  src={property.images[0]}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {property.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {property.images.slice(1, 6).map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`${property.title} ${i + 2}`}
                    className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                  />
                ))}
                {property.images.length > 6 && (
                  <div className="w-24 h-24 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-sm text-muted-foreground">
                      +{property.images.length - 6}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {property.description && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Description</h2>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {property.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Features */}
            {property.features.length > 0 && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Features</h2>
                </CardHeader>
                <CardContent>
                  <ul className="grid grid-cols-2 gap-2">
                    {property.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-muted-foreground">
                        <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Map */}
            {property.latitude && property.longitude && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Location</h2>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[300px]">
                    <PropertyMap
                      latitude={property.latitude}
                      longitude={property.longitude}
                      title={property.title}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Price Card */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-3xl font-bold text-primary mb-2">
                  {formatPrice(property.price)}
                </p>
                <h1 className="text-xl font-semibold mb-2">{property.title}</h1>
                {property.address && (
                  <p className="text-muted-foreground">
                    {property.address}
                    {property.city && `, ${property.city}`}
                    {property.postal_code && ` ${property.postal_code}`}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Details Card */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Property Details</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                {property.property_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="capitalize">{property.property_type.replace("_", " ")}</span>
                  </div>
                )}
                {property.units != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Units</span>
                    <span>{property.units}</span>
                  </div>
                )}
                {property.unit_details && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit Breakdown</span>
                    <span className="text-right">{property.unit_details}</span>
                  </div>
                )}
                {property.bedrooms != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bedrooms</span>
                    <span>{property.bedrooms}</span>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bathrooms</span>
                    <span>{property.bathrooms}</span>
                  </div>
                )}
                {property.sqft != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Square Feet</span>
                    <span>{property.sqft.toLocaleString()}</span>
                  </div>
                )}
                {property.lot_size != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lot Size</span>
                    <span>{property.lot_size.toLocaleString()} sqft</span>
                  </div>
                )}
                {property.year_built != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Year Built</span>
                    <span>{property.year_built}</span>
                  </div>
                )}
                {property.mls_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MLS #</span>
                    <span>{property.mls_number}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Financial Details */}
            {(property.potential_revenue != null || property.municipal_assessment != null || property.taxes != null || property.expenses != null) && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Financial Details</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  {property.potential_revenue != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Potential Revenue</span>
                      <span className="text-primary font-medium">{formatPrice(property.potential_revenue)}/yr</span>
                    </div>
                  )}

                  {/* Municipal Assessment */}
                  {(property.municipal_assessment != null || property.assessment_land != null || property.assessment_building != null) && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Évaluation municipale</span>
                      <div className="pl-3 space-y-1 text-sm">
                        {property.assessment_land != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Terrain</span>
                            <span>{formatPrice(property.assessment_land)}</span>
                          </div>
                        )}
                        {property.assessment_building != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bâtiment</span>
                            <span>{formatPrice(property.assessment_building)}</span>
                          </div>
                        )}
                        {property.municipal_assessment != null && (
                          <div className="flex justify-between font-medium border-t border-border pt-1 mt-1">
                            <span className="text-muted-foreground">Total</span>
                            <span>{formatPrice(property.municipal_assessment)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Taxes */}
                  {(property.taxes != null || property.taxes_municipal != null || property.taxes_school != null) && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Taxes</span>
                      <div className="pl-3 space-y-1 text-sm">
                        {property.taxes_municipal != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Municipales</span>
                            <span>{formatPrice(property.taxes_municipal)}/yr</span>
                          </div>
                        )}
                        {property.taxes_school != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Scolaires</span>
                            <span>{formatPrice(property.taxes_school)}/yr</span>
                          </div>
                        )}
                        {property.taxes != null && (
                          <div className="flex justify-between font-medium border-t border-border pt-1 mt-1">
                            <span className="text-muted-foreground">Total</span>
                            <span>{formatPrice(property.taxes)}/yr</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Expenses */}
                  {(property.expenses != null || property.expense_electricity != null || property.expense_heating != null) && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Dépenses</span>
                      <div className="pl-3 space-y-1 text-sm">
                        {property.expense_electricity != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Électricité</span>
                            <span>{formatPrice(property.expense_electricity)}/yr</span>
                          </div>
                        )}
                        {property.expense_heating != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Mazout/Chauffage</span>
                            <span>{formatPrice(property.expense_heating)}/yr</span>
                          </div>
                        )}
                        {property.expenses != null && (
                          <div className="flex justify-between font-medium border-t border-border pt-1 mt-1">
                            <span className="text-muted-foreground">Total</span>
                            <span>{formatPrice(property.expenses)}/yr</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Source */}
            {property.source_url && (
              <Card>
                <CardContent className="pt-6">
                  <a
                    href={property.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    View Original Listing →
                  </a>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardContent className="pt-6 space-y-2">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDelete}
                  loading={deleting}
                >
                  Delete Property
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
