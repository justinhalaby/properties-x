"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import type { ScrapedProperty, CreatePropertyInput } from "@/types/property";

interface ScrapePreviewProps {
  property: ScrapedProperty;
  onSave: (property: CreatePropertyInput) => Promise<void>;
  onCancel: () => void;
}

export function ScrapePreview({ property, onSave, onCancel }: ScrapePreviewProps) {
  const [editedProperty, setEditedProperty] = useState<CreatePropertyInput>({
    ...property,
  });
  const [saving, setSaving] = useState(false);

  const updateField = <K extends keyof CreatePropertyInput>(
    field: K,
    value: CreatePropertyInput[K]
  ) => {
    setEditedProperty((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editedProperty);
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price: number | undefined | null) => {
    if (!price) return "";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Preview Scraped Property</h3>
            <p className="text-sm text-muted-foreground">
              Review and edit the details before saving
            </p>
          </div>
          {property.source_name !== "unknown" && (
            <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded capitalize">
              {property.source_name}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Images preview */}
        {property.images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {property.images.slice(0, 5).map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Property ${i + 1}`}
                className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
              />
            ))}
            {property.images.length > 5 && (
              <div className="w-24 h-24 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-sm text-muted-foreground">
                  +{property.images.length - 5} more
                </span>
              </div>
            )}
          </div>
        )}

        {/* Editable fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Title"
            value={editedProperty.title || ""}
            onChange={(e) => updateField("title", e.target.value)}
          />

          <Input
            label="Price"
            type="number"
            value={editedProperty.price || ""}
            onChange={(e) =>
              updateField("price", e.target.value ? parseFloat(e.target.value) : undefined)
            }
            placeholder={formatPrice(property.price)}
          />

          <Input
            label="Units"
            type="number"
            value={editedProperty.units ?? ""}
            onChange={(e) =>
              updateField("units", e.target.value ? parseInt(e.target.value) : undefined)
            }
            placeholder="For multi-residential"
          />

          <Input
            label="Unit Details"
            value={editedProperty.unit_details || ""}
            onChange={(e) => updateField("unit_details", e.target.value || undefined)}
            placeholder="e.g., 2 x 4½, 1 x 5½"
          />

          <Input
            label="Address"
            value={editedProperty.address || ""}
            onChange={(e) => updateField("address", e.target.value || undefined)}
          />

          <Input
            label="City"
            value={editedProperty.city || ""}
            onChange={(e) => updateField("city", e.target.value || undefined)}
          />

          <Input
            label="Bedrooms"
            type="number"
            value={editedProperty.bedrooms ?? ""}
            onChange={(e) =>
              updateField("bedrooms", e.target.value ? parseInt(e.target.value) : undefined)
            }
          />

          <Input
            label="Bathrooms"
            type="number"
            step="0.5"
            value={editedProperty.bathrooms ?? ""}
            onChange={(e) =>
              updateField("bathrooms", e.target.value ? parseFloat(e.target.value) : undefined)
            }
          />

          <Input
            label="Square Feet"
            type="number"
            value={editedProperty.sqft ?? ""}
            onChange={(e) =>
              updateField("sqft", e.target.value ? parseInt(e.target.value) : undefined)
            }
          />

          <Input
            label="Year Built"
            type="number"
            value={editedProperty.year_built ?? ""}
            onChange={(e) =>
              updateField("year_built", e.target.value ? parseInt(e.target.value) : undefined)
            }
          />

          <Input
            label="Potential Revenue"
            type="number"
            value={editedProperty.potential_revenue ?? ""}
            onChange={(e) =>
              updateField("potential_revenue", e.target.value ? parseFloat(e.target.value) : undefined)
            }
            placeholder="Annual revenue"
          />
        </div>

        {/* Financial Details Section */}
        <div className="space-y-4 pt-2">
          <h4 className="text-sm font-medium text-foreground">Évaluation municipale</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Terrain"
              type="number"
              value={editedProperty.assessment_land ?? ""}
              onChange={(e) =>
                updateField("assessment_land", e.target.value ? parseFloat(e.target.value) : undefined)
              }
            />
            <Input
              label="Bâtiment"
              type="number"
              value={editedProperty.assessment_building ?? ""}
              onChange={(e) =>
                updateField("assessment_building", e.target.value ? parseFloat(e.target.value) : undefined)
              }
            />
            <Input
              label="Total"
              type="number"
              value={editedProperty.municipal_assessment ?? ""}
              onChange={(e) =>
                updateField("municipal_assessment", e.target.value ? parseFloat(e.target.value) : undefined)
              }
            />
          </div>

          <h4 className="text-sm font-medium text-foreground">Taxes</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Municipales"
              type="number"
              value={editedProperty.taxes_municipal ?? ""}
              onChange={(e) =>
                updateField("taxes_municipal", e.target.value ? parseFloat(e.target.value) : undefined)
              }
            />
            <Input
              label="Scolaires"
              type="number"
              value={editedProperty.taxes_school ?? ""}
              onChange={(e) =>
                updateField("taxes_school", e.target.value ? parseFloat(e.target.value) : undefined)
              }
            />
            <Input
              label="Total"
              type="number"
              value={editedProperty.taxes ?? ""}
              onChange={(e) =>
                updateField("taxes", e.target.value ? parseFloat(e.target.value) : undefined)
              }
            />
          </div>

          <h4 className="text-sm font-medium text-foreground">Dépenses</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Électricité"
              type="number"
              value={editedProperty.expense_electricity ?? ""}
              onChange={(e) =>
                updateField("expense_electricity", e.target.value ? parseFloat(e.target.value) : undefined)
              }
            />
            <Input
              label="Mazout/Chauffage"
              type="number"
              value={editedProperty.expense_heating ?? ""}
              onChange={(e) =>
                updateField("expense_heating", e.target.value ? parseFloat(e.target.value) : undefined)
              }
            />
            <Input
              label="Total"
              type="number"
              value={editedProperty.expenses ?? ""}
              onChange={(e) =>
                updateField("expenses", e.target.value ? parseFloat(e.target.value) : undefined)
              }
            />
          </div>
        </div>

        {/* Description */}
        {property.description && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Description
            </label>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {property.description}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={saving}>
          Save Property
        </Button>
      </CardFooter>
    </Card>
  );
}
