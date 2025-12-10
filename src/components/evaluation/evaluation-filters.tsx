"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { PropertyEvaluationFilters } from "@/types/property-evaluation";

interface EvaluationFiltersProps {
  filters: PropertyEvaluationFilters;
  onChange: (filters: PropertyEvaluationFilters) => void;
  onReset: () => void;
}

export function EvaluationFilters({
  filters,
  onChange,
  onReset,
}: EvaluationFiltersProps) {
  const [localFilters, setLocalFilters] =
    useState<PropertyEvaluationFilters>(filters);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (key: keyof PropertyEvaluationFilters, value: any) => {
    setLocalFilters({ ...localFilters, [key]: value });
  };

  const handleApply = () => {
    onChange({ ...localFilters, page: 1 }); // Reset to page 1 when filtering
  };

  const handleReset = () => {
    setLocalFilters({});
    onReset();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Filters</h2>

      {/* Search */}
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search by address or street name..."
          value={localFilters.search || ""}
          onChange={(e) => handleChange("search", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
        />
      </div>

      {/* Quick Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <Select
          label="Category"
          value={localFilters.categorie || ""}
          onChange={(e) => handleChange("categorie", e.target.value || undefined)}
        >
          <option value="">All Categories</option>
          <option value="Condominium">Condominium</option>
          <option value="Régulier">Régulier</option>
        </Select>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Min Units
          </label>
          <Input
            type="number"
            placeholder="Min"
            min="0"
            value={localFilters.minLogements || ""}
            onChange={(e) =>
              handleChange(
                "minLogements",
                e.target.value ? parseInt(e.target.value) : undefined
              )
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Max Units
          </label>
          <Input
            type="number"
            placeholder="Max"
            min="0"
            value={localFilters.maxLogements || ""}
            onChange={(e) =>
              handleChange(
                "maxLogements",
                e.target.value ? parseInt(e.target.value) : undefined
              )
            }
          />
        </div>
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        {showAdvanced ? "▼" : "▶"} Advanced Filters
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 border-t border-border pt-4">
          {/* Construction Year */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Min Year Built
            </label>
            <Input
              type="number"
              placeholder="e.g., 1980"
              min="1600"
              max="2100"
              value={localFilters.minYear || ""}
              onChange={(e) =>
                handleChange(
                  "minYear",
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Max Year Built
            </label>
            <Input
              type="number"
              placeholder="e.g., 2020"
              min="1600"
              max="2100"
              value={localFilters.maxYear || ""}
              onChange={(e) =>
                handleChange(
                  "maxYear",
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
            />
          </div>

          {/* Floors */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Min Floors
            </label>
            <Input
              type="number"
              placeholder="Min"
              min="0"
              value={localFilters.minEtages || ""}
              onChange={(e) =>
                handleChange(
                  "minEtages",
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Max Floors
            </label>
            <Input
              type="number"
              placeholder="Max"
              min="0"
              value={localFilters.maxEtages || ""}
              onChange={(e) =>
                handleChange(
                  "maxEtages",
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
            />
          </div>

          {/* Land Area (m²) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Min Land Area (m²)
            </label>
            <Input
              type="number"
              placeholder="Min"
              min="0"
              value={localFilters.minTerrainArea || ""}
              onChange={(e) =>
                handleChange(
                  "minTerrainArea",
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Max Land Area (m²)
            </label>
            <Input
              type="number"
              placeholder="Max"
              min="0"
              value={localFilters.maxTerrainArea || ""}
              onChange={(e) =>
                handleChange(
                  "maxTerrainArea",
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
            />
          </div>

          {/* Building Area (m²) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Min Building Area (m²)
            </label>
            <Input
              type="number"
              placeholder="Min"
              min="0"
              value={localFilters.minBatimentArea || ""}
              onChange={(e) =>
                handleChange(
                  "minBatimentArea",
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Max Building Area (m²)
            </label>
            <Input
              type="number"
              placeholder="Max"
              min="0"
              value={localFilters.maxBatimentArea || ""}
              onChange={(e) =>
                handleChange(
                  "maxBatimentArea",
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={handleApply}>Apply Filters</Button>
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
