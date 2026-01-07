"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Rental } from "@/types/rental";

export function RentalCard({ rental }: { rental: Rental }) {
  const [imageUrl, setImageUrl] = useState<string>("/placeholder-property.jpg");

  useEffect(() => {
    // Get public URL from Supabase Storage
    if (rental.images?.[0]) {
      const supabase = createClient();
      const { data } = supabase.storage.from('rentals').getPublicUrl(rental.images[0]);
      setImageUrl(data.publicUrl);
    }
  }, [rental.images]);

  const formatRent = (rent: number | null) => {
    if (!rent) return "Rent N/A";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(rent) + "/mo";
  };

  return (
    <Link href={`/rentals/${rental.id}`}>
      <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
        {/* Image with badges */}
        <div className="relative aspect-[4/3] bg-secondary overflow-hidden">
          <img
            src={imageUrl}
            alt={rental.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />

          {rental.unit_type && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-xs capitalize">
              {rental.unit_type}
            </div>
          )}

          {rental.pet_policy.length > 0 && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/80 backdrop-blur-sm rounded text-xs text-white">
              Pet Friendly
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4">
          <p className="text-xl font-bold text-primary mb-1">{formatRent(rental.monthly_rent)}</p>
          <h3 className="font-semibold line-clamp-1 mb-1">{rental.title}</h3>
          {rental.address && (
            <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{rental.address}</p>
          )}

          <div className="flex gap-4 text-sm text-muted-foreground">
            {rental.bedrooms !== null && <span>{rental.bedrooms} bed{rental.bedrooms !== 1 ? 's' : ''}</span>}
            {rental.bathrooms !== null && <span>{rental.bathrooms} bath{rental.bathrooms !== 1 ? 's' : ''}</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
