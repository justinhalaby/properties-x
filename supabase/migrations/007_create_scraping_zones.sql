-- Create table for user-defined scraping zones
-- Migration: 007_create_scraping_zones

CREATE TABLE scraping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Zone metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Bounding box coordinates
  min_lat DECIMAL(10, 8) NOT NULL,
  max_lat DECIMAL(10, 8) NOT NULL,
  min_lng DECIMAL(11, 8) NOT NULL,
  max_lng DECIMAL(11, 8) NOT NULL,

  -- Statistics (computed/cached)
  total_properties INTEGER DEFAULT 0,
  scraped_count INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMPTZ,

  -- Scraping configuration
  target_limit INTEGER,

  -- Constraints
  CONSTRAINT valid_latitude_range CHECK (
    min_lat >= -90 AND max_lat <= 90 AND min_lat < max_lat
  ),
  CONSTRAINT valid_longitude_range CHECK (
    min_lng >= -180 AND max_lng <= 180 AND min_lng < max_lng
  )
);

-- Indexes
CREATE INDEX idx_scraping_zones_bounds ON scraping_zones (
  min_lat, max_lat, min_lng, max_lng
);

CREATE INDEX idx_scraping_zones_last_scraped ON scraping_zones (last_scraped_at)
  WHERE last_scraped_at IS NOT NULL;

-- RLS Policies
ALTER TABLE scraping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to scraping zones"
  ON scraping_zones FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert for scraping zones"
  ON scraping_zones FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update for scraping zones"
  ON scraping_zones FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete for scraping zones"
  ON scraping_zones FOR DELETE USING (true);

-- Updated_at trigger
CREATE TRIGGER update_scraping_zones_updated_at
  BEFORE UPDATE ON scraping_zones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE scraping_zones IS
  'User-defined rectangular zones for batch scraping Montreal properties';

COMMENT ON COLUMN scraping_zones.total_properties IS
  'Total number of properties within zone bounds (from property_evaluations)';

COMMENT ON COLUMN scraping_zones.scraped_count IS
  'Number of properties already scraped within this zone';

COMMENT ON COLUMN scraping_zones.min_lat IS 'Minimum latitude of bounding box';
COMMENT ON COLUMN scraping_zones.max_lat IS 'Maximum latitude of bounding box';
COMMENT ON COLUMN scraping_zones.min_lng IS 'Minimum longitude of bounding box';
COMMENT ON COLUMN scraping_zones.max_lng IS 'Maximum longitude of bounding box';
COMMENT ON COLUMN scraping_zones.target_limit IS 'Default maximum properties to scrape per run';
