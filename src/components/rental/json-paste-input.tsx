"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { validateFacebookRentalJson } from "@/lib/parsers/facebook-rental-parser";
import type { FacebookRental } from "@/types/rental";

export function JsonPasteInput({
  onParsed,
  onError,
}: {
  onParsed: (rental: FacebookRental) => void;
  onError: (error: string) => void;
}) {
  const [jsonInput, setJsonInput] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  const handleParse = () => {
    setIsParsing(true);
    try {
      const parsed = JSON.parse(jsonInput);

      if (!validateFacebookRentalJson(parsed)) {
        throw new Error("Invalid Facebook Marketplace JSON format. Please check your data and try again.");
      }

      onParsed(parsed as FacebookRental);
    } catch (err) {
      if (err instanceof SyntaxError) {
        onError("Invalid JSON format. Please check for syntax errors.");
      } else {
        onError(err instanceof Error ? err.message : "Failed to parse JSON");
      }
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Paste Facebook Marketplace JSON
        </label>
        <Textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='{"extractedDate": "...", "id": "...", "title": "...", ...}'
          rows={15}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Paste the JSON output from the Facebook Marketplace scraper (fb-rental.js)
        </p>
      </div>
      <Button
        onClick={handleParse}
        disabled={!jsonInput.trim() || isParsing}
        className="w-full"
      >
        {isParsing ? "Parsing..." : "Parse JSON"}
      </Button>
    </div>
  );
}
