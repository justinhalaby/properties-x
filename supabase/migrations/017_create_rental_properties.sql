-- Migration: Create rental_properties table
-- Description: Add support for rental property listings (separate from sale properties)
-- Date: 2026-01-06

CREATE TABLE rental_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Source tracking
  source_url TEXT,
  source_name TEXT, -- 'facebook_marketplace', 'kijiji', 'craigslist', 'manual', etc.

  -- Basic info
  title TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,

  -- Rental pricing
  monthly_rent DECIMAL(10, 2),

  -- Property details
  bedrooms INTEGER,
  bathrooms DECIMAL(3, 1),
  sqft INTEGER,

  -- Rental-specific fields
  lease_term TEXT, -- e.g., "12 months", "1 year", "month-to-month"
  available_date DATE,
  utilities_included TEXT, -- e.g., "electricity, water, heating"
  pets_allowed BOOLEAN,
  parking_included BOOLEAN,
  parking_spots INTEGER,
  furnished BOOLEAN,
  smoking_allowed BOOLEAN,

  -- Content
  description TEXT,
  features JSONB DEFAULT '[]'::JSONB,
  images TEXT[] DEFAULT '{}',

  -- Location (for map display)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Additional info
  notes TEXT,

  -- Seller information (for Facebook Marketplace, etc.)
  seller_name TEXT,
  seller_profile_url TEXT,
  listing_time TEXT -- e.g., "over a week ago", "2 days ago"
);

-- Indexes for common queries
CREATE INDEX idx_rental_properties_city ON rental_properties(city);
CREATE INDEX idx_rental_properties_monthly_rent ON rental_properties(monthly_rent);
CREATE INDEX idx_rental_properties_available_date ON rental_properties(available_date);
CREATE INDEX idx_rental_properties_created_at ON rental_properties(created_at);
CREATE INDEX idx_rental_properties_bedrooms ON rental_properties(bedrooms);
CREATE INDEX idx_rental_properties_source_name ON rental_properties(source_name);

-- Auto-update trigger for updated_at
CREATE TRIGGER set_rental_properties_updated_at
  BEFORE UPDATE ON rental_properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE rental_properties ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust policies based on your auth requirements)
CREATE POLICY "Allow all operations on rental_properties"
  ON rental_properties
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE rental_properties IS 'Stores rental property listings from various sources (Facebook Marketplace, Kijiji, manual entry, etc.)';
COMMENT ON COLUMN rental_properties.monthly_rent IS 'Monthly rent in CAD';
COMMENT ON COLUMN rental_properties.lease_term IS 'Lease duration (e.g., "12 months", "month-to-month")';
COMMENT ON COLUMN rental_properties.utilities_included IS 'Comma-separated list of included utilities';
COMMENT ON COLUMN rental_properties.seller_name IS 'Name of the person/company listing the rental';
COMMENT ON COLUMN rental_properties.seller_profile_url IS 'Link to seller profile (Facebook, etc.)';
COMMENT ON COLUMN rental_properties.listing_time IS 'How long ago the listing was posted';
