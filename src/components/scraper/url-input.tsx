"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScrapedProperty } from "@/types/property";

interface UrlInputProps {
  onScraped: (property: ScrapedProperty) => void;
  onError: (error: string) => void;
}

export function UrlInput({ onScraped, onError }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleScrape = async () => {
    if (!url.trim()) {
      onError("Please enter a URL");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        onError(result.error || "Failed to scrape property");
        return;
      }

      onScraped(result.data);
    } catch {
      onError("Failed to connect to scraping service");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="url"
            placeholder="Paste property listing URL (Centris, Realtor.ca, etc.)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) {
                handleScrape();
              }
            }}
            disabled={loading}
          />
        </div>
        <Button onClick={handleScrape} loading={loading} disabled={loading}>
          {loading ? "Analyzing..." : "Analyze"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Supported sites: Centris.ca, Realtor.ca, DuProprio.com, ReMax.ca,
        RoyalLePage.ca
      </p>
    </div>
  );
}
