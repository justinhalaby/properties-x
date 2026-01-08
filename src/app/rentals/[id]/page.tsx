"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Rental } from "@/types/rental";
import Link from "next/link";

// Dynamic import for map (no SSR)
const PropertyMap = dynamic(
  () => import("@/components/map/property-map").then((mod) => mod.PropertyMap),
  { ssr: false }
);

export default function RentalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchRental();
    }
  }, [params.id]);

  useEffect(() => {
    // Convert storage paths to public URLs
    if (rental) {
      const supabase = createClient();

      if (rental.images?.length > 0) {
        const urls = rental.images.map((path) => {
          const { data } = supabase.storage.from("rentals").getPublicUrl(path);
          return data.publicUrl;
        });
        setImageUrls(urls);
      }

      if (rental.videos?.length > 0) {
        const urls = rental.videos.map((path) => {
          const { data } = supabase.storage.from("rentals").getPublicUrl(path);
          return data.publicUrl;
        });
        setVideoUrls(urls);
      }
    }
  }, [rental]);

  const fetchRental = async () => {
    try {
      const response = await fetch(`/api/rentals/${params.id}`);
      const result = await response.json();

      if (response.ok) {
        setRental(result.data);
      } else {
        console.error("Failed to fetch rental:", result.error);
      }
    } catch (error) {
      console.error("Error fetching rental:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this rental? This action cannot be undone.")) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/rentals/${params.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/rentals");
      } else {
        const result = await response.json();
        alert(`Failed to delete rental: ${result.error}`);
      }
    } catch (error) {
      alert("Failed to delete rental");
    } finally {
      setDeleting(false);
    }
  };

  const formatRent = (rent: number | null) => {
    if (!rent) return "Rent N/A";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(rent) + "/mo";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Rental not found</p>
            <div className="flex justify-center mt-4">
              <Link href="/rentals">
                <Button>Back to Rentals</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/rentals">
          <Button variant="outline">← Back to Rentals</Button>
        </Link>
        {rental.extracted_date && (
          <div className="text-sm text-muted-foreground">
            Extracted: {formatDate(rental.extracted_date)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Media Gallery - Videos first, then images, all same size, 4 per row */}
          {(videoUrls.length > 0 || imageUrls.length > 0) && (
            <div className="grid grid-cols-4 gap-3">
              {/* Videos first */}
              {videoUrls.map((url, i) => (
                <div key={`video-${i}`} className="relative aspect-square bg-secondary overflow-hidden rounded-lg">
                  <video
                    src={url}
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {/* Then images */}
              {imageUrls.map((url, i) => (
                <div key={`image-${i}`} className="relative aspect-square bg-secondary overflow-hidden rounded-lg">
                  <img
                    src={url}
                    alt={`${rental.title} ${i + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          {rental.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{rental.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Map */}
          {rental.latitude && rental.longitude && (
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] rounded-lg overflow-hidden">
                  <PropertyMap
                    latitude={rental.latitude}
                    longitude={rental.longitude}
                    title={rental.title}
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
                {formatRent(rental.monthly_rent)}
              </p>
              <h1 className="text-2xl font-bold mb-2">{rental.title}</h1>
              {rental.address && (
                <p className="text-muted-foreground mb-4">{rental.address}</p>
              )}
              {rental.rental_location && (
                <p className="text-sm text-muted-foreground">{rental.rental_location}</p>
              )}
            </CardContent>
          </Card>

          {/* Combined Unit & Building Details */}
          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rental.bedrooms !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bedrooms</span>
                  <span className="font-semibold">{rental.bedrooms}</span>
                </div>
              )}
              {rental.bathrooms !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bathrooms</span>
                  <span className="font-semibold">{rental.bathrooms}</span>
                </div>
              )}
              {rental.unit_type && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-semibold capitalize">{rental.unit_type}</span>
                </div>
              )}
              {rental.pet_policy.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pet Policy</span>
                  <span className="font-semibold">
                    {rental.pet_policy.map((p) => p.replace("_", " ")).join(", ")}
                  </span>
                </div>
              )}

              {/* Building Details */}
              {rental.building_details.length > 0 && (
                <>
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm font-semibold text-muted-foreground mb-2">Building Features</p>
                  </div>
                  <ul className="space-y-2">
                    {rental.building_details.map((detail, i) => (
                      <li key={i} className="flex items-start text-sm">
                        <span className="mr-2 text-muted-foreground">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Amenities */}
              {rental.amenities.length > 0 && (
                <>
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm font-semibold text-muted-foreground mb-2">Amenities</p>
                  </div>
                  <ul className="grid grid-cols-2 gap-2">
                    {rental.amenities.map((amenity, i) => (
                      <li key={i} className="flex items-start text-sm">
                        <span className="mr-2 text-muted-foreground">•</span>
                        <span>{amenity}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          {/* Combined Seller & Source Info */}
          {(rental.seller_name || rental.source_url) && (
            <Card>
              <CardHeader>
                <CardTitle>Listing Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Seller */}
                {rental.seller_name && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Seller</p>
                    <p className="font-semibold">{rental.seller_name}</p>
                    {rental.seller_profile_url && (
                      <a
                        href={rental.seller_profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View Profile
                      </a>
                    )}
                  </div>
                )}

                {/* Source */}
                {rental.source_url && (
                  <div className={rental.seller_name ? "border-t pt-4" : ""}>
                    <p className="text-sm text-muted-foreground mb-1">Source</p>
                    <p className="text-sm font-semibold mb-2">
                      {rental.source_name || "Unknown"}
                    </p>
                    <a
                      href={rental.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                    >
                      View Original Listing
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={handleDelete}
                variant="destructive"
                className="w-full"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Rental"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
