"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ScrapingZone } from "@/types/scraping-zone";

interface ZonesListProps {
  zones: ScrapingZone[];
  onView: (zone: ScrapingZone) => void;
  onDelete: (zoneId: string) => void;
}

export function ZonesList({ zones, onView, onDelete }: ZonesListProps) {
  if (zones.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="text-muted-foreground">
          <p className="text-lg mb-2">No zones created yet</p>
          <p className="text-sm">Click "Draw New Zone" to get started</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {zones.map((zone) => {
        const percentComplete = zone.total_properties
          ? (zone.scraped_count / zone.total_properties) * 100
          : 0;

        return (
          <Card key={zone.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-lg">{zone.name}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(zone.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Delete
              </Button>
            </div>

            {zone.description && (
              <p className="text-sm text-muted-foreground mb-4">
                {zone.description}
              </p>
            )}

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Properties:</span>
                <span className="font-medium">{zone.total_properties}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Scraped:</span>
                <span className="font-medium text-green-600">
                  {zone.scraped_count}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining:</span>
                <span className="font-medium">
                  {zone.total_properties - zone.scraped_count}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{percentComplete.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>

            {zone.last_scraped_at && (
              <p className="text-xs text-muted-foreground mb-4">
                Last scraped: {new Date(zone.last_scraped_at).toLocaleDateString()}
              </p>
            )}

            <Button onClick={() => onView(zone)} className="w-full">
              View Zone
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
