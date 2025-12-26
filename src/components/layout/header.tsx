"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="border-b border-border bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-foreground">
            properties-x
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              href="/map"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Map View
            </Link>
            <Link
              href="/zones"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Zones
            </Link>
            <Link
              href="/buildings"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Buildings
            </Link>
            <Link
              href="/companies"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Companies
            </Link>
            <Link href="/add-property">
              <Button size="sm">Add Property</Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
