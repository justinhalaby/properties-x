"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface MapFilters {
  minUnits?: number;
  maxUnits?: number;
  minYear?: number;
  maxYear?: number;
  category?: string;
  search?: string;
}

interface MapFiltersProps {
  onApplyFilters: (filters: MapFilters) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function MapFiltersPanel({ onApplyFilters, isOpen, onToggle }: MapFiltersProps) {
  const [minUnits, setMinUnits] = useState<string>("");
  const [maxUnits, setMaxUnits] = useState<string>("");
  const [minYear, setMinYear] = useState<string>("");
  const [maxYear, setMaxYear] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const handleApply = () => {
    const filters: MapFilters = {};

    if (minUnits) filters.minUnits = parseInt(minUnits);
    if (maxUnits) filters.maxUnits = parseInt(maxUnits);
    if (minYear) filters.minYear = parseInt(minYear);
    if (maxYear) filters.maxYear = parseInt(maxYear);
    if (category) filters.category = category;
    if (search) filters.search = search;

    onApplyFilters(filters);
  };

  const handleClear = () => {
    setMinUnits("");
    setMaxUnits("");
    setMinYear("");
    setMaxYear("");
    setCategory("");
    setSearch("");
    onApplyFilters({});
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-4 left-4 z-[1000] bg-card border border-border rounded-lg px-4 py-2 shadow-lg hover:bg-muted transition-colors flex items-center gap-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        <span className="font-medium">Filters</span>
      </button>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-[1000] bg-card border border-border rounded-lg shadow-lg w-80 max-h-[calc(100vh-120px)] overflow-y-auto">
      <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Map Filters</h3>
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Search */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Search Address
          </label>
          <Input
            type="text"
            placeholder="e.g., Saint-Laurent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Number of Units */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Number of Units
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={minUnits}
              onChange={(e) => setMinUnits(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Max"
              value={maxUnits}
              onChange={(e) => setMaxUnits(e.target.value)}
            />
          </div>
        </div>

        {/* Construction Year */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Construction Year
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Min (e.g., 1900)"
              value={minYear}
              onChange={(e) => setMinYear(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Max (e.g., 2024)"
              value={maxYear}
              onChange={(e) => setMaxYear(e.target.value)}
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Categories</option>
            <option value="Condominium">Condominium</option>
            <option value="Régulier">Régulier</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleApply} className="flex-1">
            Apply Filters
          </Button>
          <Button onClick={handleClear} variant="outline">
            Clear
          </Button>
        </div>

        {/* Quick Filters */}
        <div className="pt-2 border-t border-border">
          <p className="text-sm font-medium text-foreground mb-2">Quick Filters</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setMinUnits("5");
                setMaxUnits("");
              }}
            >
              5+ Units
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setMinUnits("10");
                setMaxUnits("");
              }}
            >
              10+ Units
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setMinUnits("20");
                setMaxUnits("");
              }}
            >
              20+ Units
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setMinYear("2000");
                setMaxYear("");
              }}
            >
              Built 2000+
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setMinYear("");
                setMaxYear("1950");
              }}
            >
              Pre-1950
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
