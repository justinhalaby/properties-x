"use client";

import { useState } from "react";
import { FacebookRentalImport } from "@/components/rental/facebook-rental-import";
import { CentrisRentalImport } from "@/components/rental/centris-rental-import";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type ImportSource = "facebook" | "centris";

export default function AddRentalPage() {
  const [importSource, setImportSource] = useState<ImportSource>("facebook");

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Add Rental</h1>
        <Link href="/rentals">
          <Button variant="outline">Back to Rentals</Button>
        </Link>
      </div>

      {/* Import Source Selector */}
      <div className="flex gap-2 mb-6">
        <Button
          onClick={() => setImportSource("facebook")}
          variant={importSource === "facebook" ? "default" : "outline"}
          className="flex-1"
        >
          Facebook JSON
        </Button>
        <Button
          onClick={() => setImportSource("centris")}
          variant={importSource === "centris" ? "default" : "outline"}
          className="flex-1"
        >
          Centris URL
        </Button>
      </div>

      {/* Facebook Import Mode */}
      {importSource === "facebook" && <FacebookRentalImport />}

      {/* Centris Import Mode */}
      {importSource === "centris" && <CentrisRentalImport />}
    </div>
  );
}
