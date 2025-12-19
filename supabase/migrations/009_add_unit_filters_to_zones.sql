-- Add unit filtering to scraping zones
-- Migration: 009_add_unit_filters_to_zones

ALTER TABLE scraping_zones
  ADD COLUMN min_units INTEGER DEFAULT 3,
  ADD COLUMN max_units INTEGER,
  ADD CONSTRAINT valid_units_range CHECK (
    min_units >= 0 AND (max_units IS NULL OR max_units >= min_units)
  );

COMMENT ON COLUMN scraping_zones.min_units IS 'Minimum number of units to include in zone scraping (default: 3)';
COMMENT ON COLUMN scraping_zones.max_units IS 'Maximum number of units to include in zone scraping (NULL = no limit)';
