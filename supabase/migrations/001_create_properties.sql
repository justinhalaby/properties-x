-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create properties table
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Source information
    source_url TEXT,
    source_name TEXT, -- 'centris', 'realtor', 'duproprio', 'remax', 'royallepage', 'manual'

    -- Basic information
    title TEXT NOT NULL,
    address TEXT,
    city TEXT,
    postal_code TEXT,

    -- Property details
    price DECIMAL(12, 2),
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    sqft INTEGER,
    lot_size INTEGER, -- in sqft
    year_built INTEGER,
    property_type TEXT, -- 'single_family', 'condo', 'duplex', 'triplex', 'quadruplex', 'quintuplex', 'plex', 'multi_residential', 'land', 'commercial'
    units INTEGER, -- Number of units for multi-residential properties
    mls_number TEXT,

    -- Extended information
    description TEXT,
    features JSONB DEFAULT '[]'::JSONB, -- Array of feature strings
    images TEXT[] DEFAULT '{}', -- Array of image URLs

    -- Geolocation
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- User notes
    notes TEXT,

    -- Constraints
    CONSTRAINT valid_price CHECK (price IS NULL OR price >= 0),
    CONSTRAINT valid_bedrooms CHECK (bedrooms IS NULL OR bedrooms >= 0),
    CONSTRAINT valid_bathrooms CHECK (bathrooms IS NULL OR bathrooms >= 0),
    CONSTRAINT valid_sqft CHECK (sqft IS NULL OR sqft >= 0)
);

-- Create index for common queries
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_property_type ON properties(property_type);
CREATE INDEX idx_properties_created_at ON properties(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER update_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (optional for future auth)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Default policy: allow all operations (adjust for auth later)
CREATE POLICY "Allow all operations" ON properties
    FOR ALL USING (true) WITH CHECK (true);
