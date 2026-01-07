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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/rentals">
          <Button variant="outline">← Back to Rentals</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Image */}
          {imageUrls.length > 0 && (
            <div className="relative aspect-[16/10] bg-secondary overflow-hidden rounded-xl">
              <img
                src={imageUrls[0]}
                alt={rental.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Additional Images */}
          {imageUrls.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {imageUrls.slice(1).map((url, i) => (
                <div key={i} className="relative aspect-square bg-secondary overflow-hidden rounded">
                  <img
                    src={url}
                    alt={`${rental.title} ${i + 2}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Videos */}
          {videoUrls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Videos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {videoUrls.map((url, i) => (
                  <video
                    key={i}
                    src={url}
                    controls
                    className="w-full rounded-lg"
                  />
                ))}
              </CardContent>
            </Card>
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

          {/* Amenities */}
          {rental.amenities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Amenities</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-2 gap-2">
                  {rental.amenities.map((amenity, i) => (
                    <li key={i} className="flex items-center text-sm">
                      <span className="mr-2">•</span>
                      {amenity}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Building Details */}
          {rental.building_details.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Building Details</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-2 gap-2">
                  {rental.building_details.map((detail, i) => (
                    <li key={i} className="flex items-center text-sm">
                      <span className="mr-2">•</span>
                      {detail}
                    </li>
                  ))}
                </ul>
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

          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
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
            </CardContent>
          </Card>

          {/* Seller Info */}
          {rental.seller_name && (
            <Card>
              <CardHeader>
                <CardTitle>Seller</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}

          {/* Source Info */}
          {rental.source_url && (
            <Card>
              <CardHeader>
                <CardTitle>Source</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
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
