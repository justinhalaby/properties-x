-- Create rentals table
CREATE TABLE rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Source information (future-proof for multiple sources)
    source_url TEXT,
    source_name TEXT DEFAULT 'facebook_marketplace', -- 'facebook_marketplace', 'kijiji', 'craigslist', etc.
    facebook_id TEXT UNIQUE, -- Facebook-specific ID for duplicate detection
    extracted_date TIMESTAMPTZ,

    -- Basic information
    title TEXT NOT NULL,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    rental_location TEXT,

    -- Rental details
    monthly_rent DECIMAL(10, 2),
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),

    -- Unit details
    unit_type TEXT,
    pet_policy JSONB DEFAULT '[]'::JSONB,
    amenities JSONB DEFAULT '[]'::JSONB,
    unit_details_raw JSONB DEFAULT '[]'::JSONB,

    -- Building details
    building_details JSONB DEFAULT '[]'::JSONB,

    -- Description & seller
    description TEXT,
    seller_name TEXT,
    seller_profile_url TEXT,

    -- Media (Supabase Storage paths with source prefix)
    images TEXT[] DEFAULT '{}',
    videos TEXT[] DEFAULT '{}',

    -- Geolocation
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    geocoded_at TIMESTAMPTZ,

    -- User notes
    notes TEXT,

    -- Constraints
    CONSTRAINT valid_monthly_rent CHECK (monthly_rent IS NULL OR monthly_rent >= 0),
    CONSTRAINT valid_bedrooms CHECK (bedrooms IS NULL OR bedrooms >= 0),
    CONSTRAINT valid_bathrooms CHECK (bathrooms IS NULL OR bathrooms >= 0)
);

-- Indexes for common queries
CREATE INDEX idx_rentals_city ON rentals(city);
CREATE INDEX idx_rentals_monthly_rent ON rentals(monthly_rent);
CREATE INDEX idx_rentals_bedrooms ON rentals(bedrooms);
CREATE INDEX idx_rentals_created_at ON rentals(created_at DESC);
CREATE INDEX idx_rentals_facebook_id ON rentals(facebook_id);
CREATE INDEX idx_rentals_postal_code ON rentals(postal_code);

-- Geospatial index for map queries
CREATE INDEX idx_rentals_location ON rentals(latitude, longitude);

-- Updated_at trigger (reuse existing function)
CREATE TRIGGER update_rentals_updated_at
    BEFORE UPDATE ON rentals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations" ON rentals
    FOR ALL USING (true) WITH CHECK (true);
