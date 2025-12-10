"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { Property } from "@/types/property";

interface PropertyCardProps {
  property: Property;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const formatPrice = (price: number | null) => {
    if (!price) return "Price N/A";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const mainImage = property.images?.[0] || "/placeholder-property.jpg";

  return (
    <Link href={`/properties/${property.id}`}>
      <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-secondary overflow-hidden">
          {property.images?.length > 0 ? (
            <img
              src={mainImage}
              alt={property.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <svg
                className="w-16 h-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
          )}

          {/* Property type badge */}
          {property.property_type && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-xs font-medium capitalize">
              {property.property_type.replace("_", " ")}
            </div>
          )}

          {/* Image count */}
          {property.images?.length > 1 && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-xs">
              {property.images.length} photos
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Price */}
          <p className="text-xl font-bold text-primary mb-1">
            {formatPrice(property.price)}
          </p>

          {/* Title */}
          <h3 className="font-semibold text-foreground line-clamp-1 mb-1">
            {property.title}
          </h3>

          {/* Address */}
          {property.address && (
            <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
              {property.address}
              {property.city && `, ${property.city}`}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {property.bedrooms !== null && (
              <div className="flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <span>{property.bedrooms} bed</span>
              </div>
            )}

            {property.bathrooms !== null && (
              <div className="flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>{property.bathrooms} bath</span>
              </div>
            )}

            {property.sqft !== null && (
              <div className="flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
                <span>{property.sqft.toLocaleString()} sqft</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
