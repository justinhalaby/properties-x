"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

type ImportMode = "url" | "json";
type Step = "scrape" | "transform";

interface ScrapeResult {
  metadataId: string;
  centrisId: string;
  storagePath: string;
  message: string;
  preview?: {
    title: string | null;
    price: string | null;
    address: string | null;
  };
  imageCount?: number;
  alreadyExists?: boolean;
  status?: string;
  rentalId?: string;
}

interface TransformResult {
  rental: {
    id: string;
    title: string;
    address: string | null;
    monthly_rent: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    images: string[];
  };
  warnings?: string[];
  message: string;
}

export function CentrisRentalImport() {
  const router = useRouter();
  const [importMode, setImportMode] = useState<ImportMode>("url");
  const [step, setStep] = useState<Step>("scrape");
  const [url, setUrl] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleScrapeUrl = async () => {
    if (!url.trim()) {
      setError("Please enter a Centris URL");
      return;
    }

    // Validate URL pattern
    if (!url.match(/centris\.ca.*~a-louer~/i)) {
      setError("Invalid Centris rental URL. Must contain '~a-louer~' (for rent)");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setScrapeResult(null);

    try {
      const response = await fetch("/api/centris-rentals/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to scrape listing");
        return;
      }

      setScrapeResult(result);

      // If already exists and transformed, redirect to rental
      if (result.alreadyExists && result.status === "success" && result.rentalId) {
        router.push(`/rentals/${result.rentalId}`);
        return;
      }

      // If already exists but pending, move to transform step
      if (result.alreadyExists && result.status === "pending") {
        setStep("transform");
        return;
      }

      // Move to transform step for new scrape
      setStep("transform");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scrape listing");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteJson = async () => {
    if (!jsonText.trim()) {
      setError("Please paste JSON data");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setScrapeResult(null);

    try {
      // Parse JSON
      let jsonData;
      try {
        jsonData = JSON.parse(jsonText);
      } catch (parseError) {
        setError("Invalid JSON format. Please check your JSON and try again.");
        return;
      }

      // Validate required fields (support both new and legacy formats)
      const hasCentrisId = jsonData.centris_id || jsonData.listingId || jsonData.raw_data?.centris_id;
      const hasSourceUrl = jsonData.source_url || jsonData.sourceUrl || jsonData.raw_data?.source_url;

      if (!hasCentrisId) {
        setError("JSON must contain centris_id or listingId field");
        return;
      }

      if (!hasSourceUrl) {
        setError("JSON must contain source_url or sourceUrl field");
        return;
      }

      // Submit to API
      const response = await fetch("/api/centris-rentals/scrape-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonData }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to import JSON");
        return;
      }

      setScrapeResult(result);

      // If already exists and transformed, redirect to rental
      if (result.alreadyExists && result.status === "success" && result.rentalId) {
        router.push(`/rentals/${result.rentalId}`);
        return;
      }

      // If already exists but pending, move to transform step
      if (result.alreadyExists && result.status === "pending") {
        setStep("transform");
        return;
      }

      // Move to transform step
      setStep("transform");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import JSON");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransform = async () => {
    if (!scrapeResult) return;

    setIsProcessing(true);
    setError(null);
    setWarnings([]);

    try {
      const response = await fetch("/api/centris-rentals/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centrisId: scrapeResult.centrisId }),
      });

      const result: TransformResult = await response.json();

      if (!response.ok) {
        setError(result.message || "Failed to transform rental");
        return;
      }

      if (result.warnings && result.warnings.length > 0) {
        setWarnings(result.warnings);
      }

      // Redirect to rental detail page
      router.push(`/rentals/${result.rental.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transform rental");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackToScrape = () => {
    setStep("scrape");
    setScrapeResult(null);
    setError(null);
    setWarnings([]);
  };

  const handleModeChange = (mode: ImportMode) => {
    setImportMode(mode);
    setError(null);
    setWarnings([]);
    setUrl("");
    setJsonText("");
    setScrapeResult(null);
    setStep("scrape");
  };

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Warnings Alert */}
      {warnings.length > 0 && (
        <Alert className="border-yellow-500">
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

      {/* Step 1: Import (URL or JSON) */}
      {step === "scrape" && (
        <Card>
          <CardHeader>
            <CardTitle>Import from Centris.ca</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Selector */}
            <div className="flex gap-2">
              <Button
                onClick={() => handleModeChange("url")}
                variant={importMode === "url" ? "default" : "outline"}
                className="flex-1"
                disabled={isProcessing}
              >
                URL
              </Button>
              <Button
                onClick={() => handleModeChange("json")}
                variant={importMode === "json" ? "default" : "outline"}
                className="flex-1"
                disabled={isProcessing}
              >
                JSON Paste
              </Button>
            </div>

            {/* URL Mode */}
            {importMode === "url" && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Enter a Centris rental listing URL (must contain ~a-louer~)
                </p>
                <Input
                  type="url"
                  placeholder="https://www.centris.ca/fr/condo-appartement~a-louer~montreal-..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isProcessing}
                  className="mb-3"
                />
                <p className="text-xs text-muted-foreground mb-4">
                  Example: https://www.centris.ca/fr/condo-appartement~a-louer~montreal-cote-des-neiges-notre-dame-de-grace/16164131
                </p>

                <Button
                  onClick={handleScrapeUrl}
                  disabled={isProcessing || !url.trim()}
                  className="w-full"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Scraping listing...
                    </span>
                  ) : (
                    "Scrape Listing"
                  )}
                </Button>

                {isProcessing && (
                  <Alert className="mt-4">
                    <AlertDescription>
                      Fetching listing data, downloading images to storage... This may take a few seconds.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* JSON Mode */}
            {importMode === "json" && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Paste JSON data from the browser console script
                </p>
                <Textarea
                  placeholder='{"listingId": "19013486", "sourceUrl": "https://...", "propertyType": "Condo...", ...}'
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  disabled={isProcessing}
                  className="font-mono text-xs mb-3 min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground mb-4">
                  Run the console script on a Centris page, then paste the JSON output here.
                  Supports both new format (centris_id, source_url) and legacy format (listingId, sourceUrl).
                </p>

                <Button
                  onClick={handlePasteJson}
                  disabled={isProcessing || !jsonText.trim()}
                  className="w-full"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Importing JSON...
                    </span>
                  ) : (
                    "Import JSON"
                  )}
                </Button>

                {isProcessing && (
                  <Alert className="mt-4">
                    <AlertDescription>
                      Validating JSON, downloading images to storage... This may take a few seconds.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Transform */}
      {step === "transform" && scrapeResult && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Review Scraped Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-secondary p-4 rounded space-y-3">
                {scrapeResult.preview?.title && (
                  <div>
                    <p className="text-xs text-muted-foreground">Title</p>
                    <p className="font-semibold">{scrapeResult.preview.title}</p>
                  </div>
                )}

                {scrapeResult.preview?.price && (
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="text-lg font-bold text-primary">
                      {scrapeResult.preview.price}
                    </p>
                  </div>
                )}

                {scrapeResult.preview?.address && (
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="text-sm">{scrapeResult.preview.address}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground">Centris ID</p>
                  <p className="text-sm font-mono">{scrapeResult.centrisId}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Import Method</p>
                  <p className="text-sm capitalize">{importMode}</p>
                </div>

                {scrapeResult.imageCount !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Images Downloaded</p>
                    <p className="text-sm font-semibold">{scrapeResult.imageCount}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm">
                    {scrapeResult.alreadyExists ? (
                      <span className="text-yellow-600">Already imported - pending transformation</span>
                    ) : (
                      <span className="text-green-600">Imported successfully</span>
                    )}
                  </p>
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  The listing data and images have been saved. Click "Transform to Rental" to:
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    <li>Parse and normalize the data</li>
                    <li>Geocode the address (if needed)</li>
                    <li>Create rental record in database</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={handleBackToScrape}
              variant="outline"
              className="flex-1"
              disabled={isProcessing}
            >
              Import Another
            </Button>
            <Button
              onClick={handleTransform}
              className="flex-1"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Transforming...
                </span>
              ) : (
                "Transform to Rental"
              )}
            </Button>
          </div>

          {isProcessing && (
            <Alert>
              <AlertDescription>
                Transforming data and creating rental record...
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
