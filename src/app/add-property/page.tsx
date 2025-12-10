"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UrlInput } from "@/components/scraper/url-input";
import { ScrapePreview } from "@/components/scraper/scrape-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import type { ScrapedProperty, CreatePropertyInput } from "@/types/property";

type Mode = "url" | "preview" | "manual";

export default function AddPropertyPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("url");
  const [scrapedProperty, setScrapedProperty] = useState<ScrapedProperty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Manual form state
  const [manualProperty, setManualProperty] = useState<CreatePropertyInput>({
    title: "",
    source_name: "manual",
  });

  const handleScraped = (property: ScrapedProperty) => {
    setScrapedProperty(property);
    setError(null);
    setMode("preview");
  };

  const handleScrapeError = (errorMessage: string) => {
    setError(errorMessage);
    setScrapedProperty(null);
  };

  const handleSave = async (property: CreatePropertyInput) => {
    setSaving(true);
    setError(null);

    try {
      // Auto-geocode if address exists
      if (property.address && !property.latitude) {
        try {
          const geoResponse = await fetch("/api/geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address: property.address,
              city: property.city,
              postalCode: property.postal_code,
            }),
          });

          if (geoResponse.ok) {
            const geoResult = await geoResponse.json();
            property.latitude = geoResult.data.latitude;
            property.longitude = geoResult.data.longitude;
          }
        } catch {
          // Geocoding failed, continue without coordinates
        }
      }

      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(property),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save property");
      }

      router.push(`/properties/${result.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save property");
    } finally {
      setSaving(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualProperty.title.trim()) {
      setError("Title is required");
      return;
    }
    await handleSave(manualProperty);
  };

  const updateManualField = <K extends keyof CreatePropertyInput>(
    field: K,
    value: CreatePropertyInput[K]
  ) => {
    setManualProperty((prev) => ({ ...prev, [field]: value }));
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
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                My Properties
              </Link>
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
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold mt-2">Add Property</h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive">{error}</p>
            {mode === "url" && (
              <button
                onClick={() => {
                  setMode("manual");
                  setError(null);
                }}
                className="text-sm text-primary hover:underline mt-2"
              >
                Try manual entry instead
              </button>
            )}
          </div>
        )}

        {/* Mode Tabs */}
        {mode !== "preview" && (
          <div className="flex gap-2 mb-6">
            <Button
              variant={mode === "url" ? "primary" : "ghost"}
              onClick={() => {
                setMode("url");
                setError(null);
              }}
            >
              Add by URL
            </Button>
            <Button
              variant={mode === "manual" ? "primary" : "ghost"}
              onClick={() => {
                setMode("manual");
                setError(null);
              }}
            >
              Manual Entry
            </Button>
          </div>
        )}

        {/* URL Mode */}
        {mode === "url" && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Paste Listing URL</h2>
              <p className="text-sm text-muted-foreground">
                We&apos;ll extract the property details automatically
              </p>
            </CardHeader>
            <CardContent>
              <UrlInput onScraped={handleScraped} onError={handleScrapeError} />
            </CardContent>
          </Card>
        )}

        {/* Preview Mode */}
        {mode === "preview" && scrapedProperty && (
          <ScrapePreview
            property={scrapedProperty}
            onSave={handleSave}
            onCancel={() => {
              setMode("url");
              setScrapedProperty(null);
            }}
          />
        )}

        {/* Manual Mode */}
        {mode === "manual" && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Enter Property Details</h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <Input
                  label="Title *"
                  value={manualProperty.title}
                  onChange={(e) => updateManualField("title", e.target.value)}
                  placeholder="e.g., Beautiful 3-bedroom condo in Plateau"
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Price"
                    type="number"
                    value={manualProperty.price || ""}
                    onChange={(e) =>
                      updateManualField(
                        "price",
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                    placeholder="e.g., 500000"
                  />

                  <Input
                    label="Units"
                    type="number"
                    value={manualProperty.units ?? ""}
                    onChange={(e) =>
                      updateManualField(
                        "units",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    placeholder="For multi-residential"
                  />

                  <Input
                    label="Address"
                    value={manualProperty.address || ""}
                    onChange={(e) =>
                      updateManualField("address", e.target.value || undefined)
                    }
                    placeholder="e.g., 123 Rue Saint-Denis"
                  />

                  <Input
                    label="City"
                    value={manualProperty.city || ""}
                    onChange={(e) =>
                      updateManualField("city", e.target.value || undefined)
                    }
                    placeholder="e.g., Montreal"
                  />

                  <Input
                    label="Postal Code"
                    value={manualProperty.postal_code || ""}
                    onChange={(e) =>
                      updateManualField("postal_code", e.target.value || undefined)
                    }
                    placeholder="e.g., H2X 1Y6"
                  />

                  <Input
                    label="Bedrooms"
                    type="number"
                    value={manualProperty.bedrooms ?? ""}
                    onChange={(e) =>
                      updateManualField(
                        "bedrooms",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                  />

                  <Input
                    label="Bathrooms"
                    type="number"
                    step="0.5"
                    value={manualProperty.bathrooms ?? ""}
                    onChange={(e) =>
                      updateManualField(
                        "bathrooms",
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                  />

                  <Input
                    label="Square Feet"
                    type="number"
                    value={manualProperty.sqft ?? ""}
                    onChange={(e) =>
                      updateManualField(
                        "sqft",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                  />

                  <Input
                    label="Year Built"
                    type="number"
                    value={manualProperty.year_built ?? ""}
                    onChange={(e) =>
                      updateManualField(
                        "year_built",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Link href="/">
                    <Button variant="ghost" type="button">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" loading={saving}>
                    Save Property
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
