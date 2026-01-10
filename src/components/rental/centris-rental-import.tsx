"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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

interface BatchResult {
  url: string;
  status: 'success' | 'failed';
  rentalId?: string;
  error?: string;
  warnings?: string[];
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

  // Batch processing state
  const [batchMode, setBatchMode] = useState(false);
  const [urlsText, setUrlsText] = useState('');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isDelaying, setIsDelaying] = useState(false);

  // Existing listing modal state
  const [showExistingModal, setShowExistingModal] = useState(false);
  const [existingRental, setExistingRental] = useState<{
    id: string;
    title: string;
    address: string | null;
    monthly_rent: number | null;
    created_at: string;
  } | null>(null);

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

      // Move to transform step
      setStep("transform");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import JSON");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransform = async (forceRetransform = false) => {
    if (!scrapeResult) return;

    setIsProcessing(true);
    setError(null);
    setWarnings([]);

    try {
      const response = await fetch("/api/centris-rentals/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centrisId: scrapeResult.centrisId,
          force: forceRetransform
        }),
      });

      const result: any = await response.json();

      // Check if already transformed (409 Conflict)
      if (response.status === 409 && result.alreadyTransformed) {
        setExistingRental(result.existingRental);
        setShowExistingModal(true);
        setIsProcessing(false);
        return;
      }

      if (!response.ok) {
        setError(result.error || result.message || "Failed to transform rental");
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

  const handleForceTransform = async () => {
    setShowExistingModal(false);
    await handleTransform(true);
  };

  const handleViewExisting = () => {
    if (existingRental) {
      router.push(`/rentals/${existingRental.id}`);
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

  const handleBatchProcess = async () => {
    // 1. Parse URLs from textarea (split by newline, trim, filter empty)
    const urls = urlsText
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) {
      setError('No valid URLs found');
      return;
    }

    // 2. Validate all URLs
    const invalidUrls = urls.filter(url => !url.match(/centris\.ca.*~a-louer~/i));
    if (invalidUrls.length > 0) {
      setError(`Invalid Centris rental URLs found:\n${invalidUrls.join('\n')}`);
      return;
    }

    // 3. Initialize state
    setIsBatchProcessing(true);
    setCancelRequested(false);
    setBatchProgress({ current: 0, total: urls.length });
    setBatchResults([]);
    setError(null);

    // 4. Process each URL sequentially
    for (let i = 0; i < urls.length; i++) {
      // Check for cancellation
      if (cancelRequested) {
        setError('Batch processing cancelled by user');
        break;
      }

      const url = urls[i];
      setCurrentUrl(url);
      setBatchProgress({ current: i + 1, total: urls.length });

      try {
        // Step 1: Scrape
        const scrapeResponse = await fetch('/api/centris-rentals/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });

        const scrapeResult = await scrapeResponse.json();

        if (!scrapeResponse.ok) {
          throw new Error(scrapeResult.error || 'Scraping failed');
        }

        // Handle duplicate case
        if (scrapeResult.alreadyExists && scrapeResult.status === 'success') {
          setBatchResults(prev => [...prev, {
            url,
            status: 'success',
            rentalId: scrapeResult.rentalId,
            warnings: ['Listing already exists'],
          }]);
          // Delay before next URL (except after last URL)
          if (i < urls.length - 1) {
            const randomDelay = Math.floor(Math.random() * 41) + 20; // Random 20-60 seconds
            setIsDelaying(true);
            setCountdown(randomDelay);

            for (let remaining = randomDelay; remaining > 0; remaining--) {
              if (cancelRequested) break;
              setCountdown(remaining);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

            setIsDelaying(false);
            setCountdown(0);
          }
          continue;
        }

        // Step 2: Transform
        const transformResponse = await fetch('/api/centris-rentals/transform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ centrisId: scrapeResult.centrisId }),
        });

        const transformResult = await transformResponse.json();

        if (!transformResponse.ok) {
          throw new Error(transformResult.message || 'Transformation failed');
        }

        // Success!
        setBatchResults(prev => [...prev, {
          url,
          status: 'success',
          rentalId: transformResult.rental.id,
          warnings: transformResult.warnings,
        }]);

      } catch (error) {
        // Error handling - continue with next URL
        console.error(`Error processing ${url}:`, error);
        setBatchResults(prev => [...prev, {
          url,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        }]);
      }

      // Delay before next URL (except after last URL)
      if (i < urls.length - 1) {
        const randomDelay = Math.floor(Math.random() * 41) + 20; // Random 20-60 seconds
        setIsDelaying(true);
        setCountdown(randomDelay);

        for (let remaining = randomDelay; remaining > 0; remaining--) {
          if (cancelRequested) break;
          setCountdown(remaining);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setIsDelaying(false);
        setCountdown(0);
      }
    }

    // 5. Cleanup
    setIsBatchProcessing(false);
    setCurrentUrl('');
    setIsDelaying(false);
    setCountdown(0);
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

      {/* Batch Mode Toggle */}
      {step === "scrape" && (
        <Card>
          <CardHeader>
            <CardTitle>Import Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                onClick={() => setBatchMode(false)}
                variant={!batchMode ? "default" : "outline"}
                className="flex-1"
                disabled={isProcessing || isBatchProcessing}
              >
                Single URL
              </Button>
              <Button
                onClick={() => setBatchMode(true)}
                variant={batchMode ? "default" : "outline"}
                className="flex-1"
                disabled={isProcessing || isBatchProcessing}
              >
                Batch URLs
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Import (URL or JSON) - Single Mode */}
      {step === "scrape" && !batchMode && (
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

      {/* Batch Mode UI */}
      {step === "scrape" && batchMode && (
        <div className="space-y-6">
          {/* Batch Input Section */}
          {!isBatchProcessing && batchResults.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Batch Process Multiple URLs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* URL Input */}
                <div>
                  <Label>Centris Rental URLs (one per line)</Label>
                  <Textarea
                    placeholder="https://www.centris.ca/.../19013486&#10;https://www.centris.ca/.../19013487&#10;https://www.centris.ca/.../19013488"
                    rows={10}
                    value={urlsText}
                    onChange={(e) => setUrlsText(e.target.value)}
                    className="font-mono text-xs mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Paste Centris rental URLs (must contain ~a-louer~), one per line. A random delay between 20-60 seconds will be applied between each URL.
                  </p>
                </div>

                {/* Start Button */}
                <Button
                  onClick={handleBatchProcess}
                  disabled={!urlsText.trim()}
                  className="w-full"
                >
                  Start Batch Processing
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Progress Tracker */}
          {isBatchProcessing && (
            <Card>
              <CardHeader>
                <CardTitle>Processing...</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Progress:</span>
                    <span className="font-semibold">
                      {batchProgress.current} of {batchProgress.total}
                    </span>
                  </div>
                  <Progress
                    value={(batchProgress.current / batchProgress.total) * 100}
                  />
                  {currentUrl && !isDelaying && (
                    <p className="text-sm text-muted-foreground">
                      Currently processing: {currentUrl}
                    </p>
                  )}
                  {isDelaying && countdown > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <p>Waiting before next URL...</p>
                      <p className="text-lg font-semibold text-primary mt-1">
                        {countdown} second{countdown !== 1 ? 's' : ''} remaining
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  variant="destructive"
                  onClick={() => setCancelRequested(true)}
                  className="w-full"
                >
                  Cancel Batch
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Results Summary */}
          {batchResults.length > 0 && !isBatchProcessing && (
            <Card>
              <CardHeader>
                <CardTitle>Batch Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded">
                    <p className="text-2xl font-bold text-green-600">
                      {batchResults.filter(r => r.status === 'success').length}
                    </p>
                    <p className="text-sm text-green-700">Successful</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded">
                    <p className="text-2xl font-bold text-red-600">
                      {batchResults.filter(r => r.status === 'failed').length}
                    </p>
                    <p className="text-sm text-red-700">Failed</p>
                  </div>
                </div>

                <Accordion type="single" collapsible>
                  {batchResults.map((result, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger>
                        {result.status === 'success' ? '✅' : '❌'} {result.url}
                      </AccordionTrigger>
                      <AccordionContent>
                        {result.status === 'success' ? (
                          <div className="space-y-2">
                            <Link
                              href={`/rentals/${result.rentalId}`}
                              className="text-primary underline hover:text-primary/80"
                            >
                              View Rental →
                            </Link>
                            {result.warnings && result.warnings.length > 0 && (
                              <div className="mt-2">
                                <p className="text-sm font-semibold">Warnings:</p>
                                <ul className="list-disc pl-4 text-sm">
                                  {result.warnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-destructive">{result.error}</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                <Button
                  onClick={() => {
                    setBatchResults([]);
                    setUrlsText('');
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Process Another Batch
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
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
              onClick={() => handleTransform()}
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

      {/* Existing Listing Modal */}
      <Dialog open={showExistingModal} onOpenChange={setShowExistingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Listing Already Exists</DialogTitle>
            <DialogDescription>
              This Centris listing has already been imported and transformed into a rental record.
            </DialogDescription>
          </DialogHeader>

          {existingRental && (
            <div className="space-y-3 py-4">
              <div>
                <p className="text-sm font-medium">Title</p>
                <p className="text-sm text-muted-foreground">{existingRental.title}</p>
              </div>

              {existingRental.address && (
                <div>
                  <p className="text-sm font-medium">Address</p>
                  <p className="text-sm text-muted-foreground">{existingRental.address}</p>
                </div>
              )}

              {existingRental.monthly_rent && (
                <div>
                  <p className="text-sm font-medium">Rent</p>
                  <p className="text-sm text-muted-foreground">
                    ${existingRental.monthly_rent.toLocaleString()}/mo
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(existingRental.created_at).toLocaleDateString()}
                </p>
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  Re-transforming will create a new curated record and update the existing rental.
                  This is useful if the raw data has been updated or if you need to fix parsing issues.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExistingModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleViewExisting}
            >
              View Existing
            </Button>
            <Button
              onClick={handleForceTransform}
              variant="default"
            >
              Re-Transform
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
