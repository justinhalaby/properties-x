"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JsonPasteInput } from "@/components/rental/json-paste-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FacebookRental } from "@/types/rental";
import Link from "next/link";

type Mode = "paste" | "preview";

export default function AddRentalPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("paste");
  const [parsedRental, setParsedRental] = useState<FacebookRental | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleParsed = (rental: FacebookRental) => {
    setParsedRental(rental);
    setError(null);
    setMode("preview");
  };

  const handleError = (errorMsg: string) => {
    setError(errorMsg);
    setWarnings([]);
  };

  const handleSave = async () => {
    if (!parsedRental) return;

    setIsSaving(true);
    setError(null);
    setWarnings([]);

    try {
      const response = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedRental),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to save rental");
        return;
      }

      if (result.warnings && result.warnings.length > 0) {
        setWarnings(result.warnings);
      }

      // Redirect to detail page
      router.push(`/rentals/${result.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rental");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackToEdit = () => {
    setMode("paste");
    setError(null);
    setWarnings([]);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Add Rental</h1>
        <Link href="/rentals">
          <Button variant="outline">Back to Rentals</Button>
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Warnings Alert */}
      {warnings.length > 0 && (
        <Alert className="mb-6 border-yellow-500">
          <AlertDescription>
            <p className="font-semibold mb-2">Warnings:</p>
            <ul className="list-disc pl-4 space-y-1">
              {warnings.map((warning, i) => (
                <li key={i} className="text-sm">{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Paste Mode */}
      {mode === "paste" && (
        <Card>
          <CardHeader>
            <CardTitle>Import from Facebook Marketplace</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonPasteInput onParsed={handleParsed} onError={handleError} />
          </CardContent>
        </Card>
      )}

      {/* Preview Mode */}
      {mode === "preview" && parsedRental && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Review Rental Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <p className="text-sm text-muted-foreground">Title</p>
                <p className="font-semibold">{parsedRental.title}</p>
              </div>

              {/* Price */}
              <div>
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="text-lg font-bold text-primary">{parsedRental.price}</p>
              </div>

              {/* Address */}
              {parsedRental.address && (
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p>{parsedRental.address}</p>
                </div>
              )}

              {/* Location */}
              {parsedRental.rentalLocation && (
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p>{parsedRental.rentalLocation}</p>
                </div>
              )}

              {/* Unit Details */}
              {parsedRental.unitDetails && parsedRental.unitDetails.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Unit Details</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {parsedRental.unitDetails.map((detail, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-secondary rounded text-xs"
                      >
                        {detail}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Building Details */}
              {parsedRental.buildingDetails && parsedRental.buildingDetails.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Building Details</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {parsedRental.buildingDetails.map((detail, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-secondary rounded text-xs"
                      >
                        {detail}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {parsedRental.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{parsedRental.description}</p>
                </div>
              )}

              {/* Media Count */}
              <div className="grid grid-cols-2 gap-4">
                {parsedRental.media?.images && (
                  <div>
                    <p className="text-sm text-muted-foreground">Images</p>
                    <p className="font-semibold">{parsedRental.media.images.length}</p>
                  </div>
                )}
                {parsedRental.media?.videos && (
                  <div>
                    <p className="text-sm text-muted-foreground">Videos</p>
                    <p className="font-semibold">{parsedRental.media.videos.length}</p>
                  </div>
                )}
              </div>

              {/* Seller Info */}
              {parsedRental.sellerInfo && (
                <div>
                  <p className="text-sm text-muted-foreground">Seller</p>
                  <p>{parsedRental.sellerInfo.name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={handleBackToEdit}
              variant="outline"
              className="flex-1"
              disabled={isSaving}
            >
              Edit JSON
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Rental"}
            </Button>
          </div>

          {isSaving && (
            <Alert>
              <AlertDescription>
                Processing rental data, downloading media, and geocoding address. This may take a moment...
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
