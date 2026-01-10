"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Step = "scrape" | "transform";

interface ScrapeResult {
  metadataId: string;
  facebookId: string;
  storagePath: string;
  message: string;
  preview?: {
    title: string | null;
    price: string | null;
    address: string | null;
  };
  imageCount?: number;
  videoCount?: number;
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

export function FacebookRentalImport() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("scrape");
  const [jsonText, setJsonText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Existing listing modal state
  const [showExistingModal, setShowExistingModal] = useState(false);
  const [existingRental, setExistingRental] = useState<{
    id: string;
    title: string;
    address: string | null;
    monthly_rent: number | null;
    created_at: string;
  } | null>(null);

  const handlePasteJson = async () => {
    if (!jsonText.trim()) {
      setError("Please paste JSON data from the console scraper");
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

      // Validate required fields (handle both new and old formats)
      const isNewFormat = 'facebook_id' in jsonData && 'raw_data' in jsonData;

      if (isNewFormat) {
        // New format validation
        if (!jsonData.facebook_id) {
          setError("JSON must contain 'facebook_id' field (Facebook listing ID)");
          return;
        }

        if (!jsonData.source_url) {
          setError("JSON must contain 'source_url' field");
          return;
        }

        if (!jsonData.raw_data) {
          setError("JSON must contain 'raw_data' field");
          return;
        }

        if (!jsonData.raw_data.title) {
          setError("JSON raw_data must contain 'title' field");
          return;
        }
      } else {
        // Old format validation
        if (!jsonData.id) {
          setError("JSON must contain 'id' field (Facebook listing ID)");
          return;
        }

        if (!jsonData.url) {
          setError("JSON must contain 'url' field");
          return;
        }

        if (!jsonData.title) {
          setError("JSON must contain 'title' field");
          return;
        }
      }

      // Call scrape-json endpoint
      const response = await fetch("/api/facebook-rentals/scrape-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonData }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to import JSON data");
        return;
      }

      setScrapeResult(result);

      // If already exists and transformed, show modal instead of auto-redirect
      if (result.alreadyExists && result.status === "success" && result.rentalId) {
        // Fetch rental details to show in modal
        const rentalResponse = await fetch(`/api/rentals/${result.rentalId}`);
        if (rentalResponse.ok) {
          const rentalData = await rentalResponse.json();
          setExistingRental({
            id: rentalData.data.id,
            title: rentalData.data.title,
            address: rentalData.data.address,
            monthly_rent: rentalData.data.monthly_rent,
            created_at: rentalData.data.created_at,
          });
          setShowExistingModal(true);
        }
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
      setError(err instanceof Error ? err.message : "Failed to import JSON data");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransform = async (forceRetransform = false) => {
    if (!scrapeResult) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/facebook-rentals/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facebookId: scrapeResult.facebookId,
          force: forceRetransform
        }),
      });

      const result = await response.json();

      // Handle already transformed (409) when not forcing
      if (response.status === 409 && result.alreadyTransformed) {
        setExistingRental(result.existingRental);
        setShowExistingModal(true);
        return;
      }

      if (!response.ok) {
        setError(result.error || "Failed to transform rental");
        return;
      }

      // Success! Extract warnings if any
      if (result.warnings && result.warnings.length > 0) {
        setWarnings(result.warnings);
      }

      // Redirect to rental details page
      router.push(`/rentals/${result.rental.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transform rental");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewExisting = () => {
    if (existingRental) {
      router.push(`/rentals/${existingRental.id}`);
    }
  };

  const handleForceTransform = async () => {
    setShowExistingModal(false);
    await handleTransform(true);
  };

  const resetForm = () => {
    setStep("scrape");
    setJsonText("");
    setScrapeResult(null);
    setError(null);
    setWarnings([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Facebook Marketplace Rental</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "scrape" && (
            <>
              <div>
                <Label htmlFor="json-data">Paste JSON from Console Scraper</Label>
                <Textarea
                  id="json-data"
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder={`{\n  "id": "123456789",\n  "url": "https://www.facebook.com/marketplace/item/...",\n  "title": "...",\n  ...\n}`}
                  className="min-h-[200px] font-mono text-sm"
                  disabled={isProcessing}
                />
                <p className="text-sm text-gray-500 mt-2">
                  Run the console scraper on a Facebook Marketplace rental listing page, then paste the JSON output here.
                </p>
              </div>

              <Button
                onClick={handlePasteJson}
                disabled={isProcessing || !jsonText.trim()}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <LoadingSpinner className="mr-2" />
                    Importing...
                  </>
                ) : (
                  "Import JSON"
                )}
              </Button>
            </>
          )}

          {step === "transform" && scrapeResult && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Import Successful!</strong>
                  <div className="mt-2 space-y-1">
                    {scrapeResult.preview?.title && (
                      <div>Title: {scrapeResult.preview.title}</div>
                    )}
                    {scrapeResult.preview?.price && (
                      <div>Price: {scrapeResult.preview.price}</div>
                    )}
                    {scrapeResult.preview?.address && (
                      <div>Address: {scrapeResult.preview.address}</div>
                    )}
                    {scrapeResult.imageCount !== undefined && (
                      <div>Images downloaded: {scrapeResult.imageCount}</div>
                    )}
                    {scrapeResult.videoCount !== undefined && scrapeResult.videoCount > 0 && (
                      <div>Videos downloaded: {scrapeResult.videoCount}</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleTransform(false)}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <LoadingSpinner className="mr-2" />
                      Transforming...
                    </>
                  ) : (
                    "Transform to Rental"
                  )}
                </Button>
                <Button
                  onClick={resetForm}
                  variant="outline"
                  disabled={isProcessing}
                >
                  Import Another
                </Button>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {warnings.length > 0 && (
            <Accordion type="single" collapsible className="mt-4">
              <AccordionItem value="warnings">
                <AccordionTrigger>
                  {warnings.length} Warning{warnings.length !== 1 ? "s" : ""}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc list-inside space-y-1">
                    {warnings.map((warning, index) => (
                      <li key={index} className="text-sm text-yellow-700">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Existing Listing Modal */}
      <Dialog open={showExistingModal} onOpenChange={setShowExistingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Listing Already Exists</DialogTitle>
            <DialogDescription>
              This Facebook Marketplace listing has already been imported and transformed.
            </DialogDescription>
          </DialogHeader>

          {existingRental && (
            <div className="space-y-2 py-4">
              <div>
                <strong>Title:</strong> {existingRental.title}
              </div>
              {existingRental.address && (
                <div>
                  <strong>Address:</strong> {existingRental.address}
                </div>
              )}
              {existingRental.monthly_rent && (
                <div>
                  <strong>Monthly Rent:</strong> ${existingRental.monthly_rent}
                </div>
              )}
              <div>
                <strong>Created:</strong>{" "}
                {new Date(existingRental.created_at).toLocaleDateString()}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExistingModal(false)}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={handleViewExisting}>
              View Existing
            </Button>
            <Button onClick={handleForceTransform}>
              Re-Transform
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong>Step 1:</strong> Open a Facebook Marketplace rental listing in your browser
          </div>
          <div>
            <strong>Step 2:</strong> Open the browser console (F12 or Cmd+Option+I on Mac)
          </div>
          <div>
            <strong>Step 3:</strong> Run the console scraper script (consoleScrape/fb-rentals-v2.js)
          </div>
          <div>
            <strong>Step 4:</strong> Copy the JSON output from the console
          </div>
          <div>
            <strong>Step 5:</strong> Paste the JSON above and click "Import JSON"
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="font-semibold text-blue-900 mb-1">Console Scraper Script:</p>
            <code className="text-xs text-blue-800">
              consoleScrape/fb-rentals-v2.js
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
