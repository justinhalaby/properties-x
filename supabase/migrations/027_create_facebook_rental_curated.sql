-- Create FacebookRentalCurated table
CREATE TABLE "FacebookRentalCurated" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id TEXT NOT NULL UNIQUE,
    source_url TEXT NOT NULL,

    -- Metadata
    extracted_date TIMESTAMPTZ NOT NULL,
    scraper_version TEXT,

    -- Property details
    title TEXT NOT NULL,
    address TEXT,
    rental_location TEXT,
    city TEXT,
    postal_code TEXT,

    -- Price
    price DECIMAL(10, 2),
    price_currency TEXT DEFAULT 'CAD',
    price_display TEXT,

    -- Rooms
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    square_footage INTEGER,

    -- Categorized details
    unit_type TEXT,
    pet_policy JSONB DEFAULT '[]'::JSONB,
    amenities JSONB DEFAULT '[]'::JSONB,
    unit_details_raw JSONB DEFAULT '[]'::JSONB,
    building_details JSONB DEFAULT '[]'::JSONB,

    -- Media (original URLs)
    image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    video_urls TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Other
    description TEXT,
    seller_name TEXT,
    seller_profile_url TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_price CHECK (price IS NULL OR price >= 0),
    CONSTRAINT valid_bedrooms CHECK (bedrooms IS NULL OR bedrooms >= 0),
    CONSTRAINT valid_bathrooms CHECK (bathrooms IS NULL OR bathrooms >= 0)
);

-- Indexes
CREATE INDEX idx_facebook_rental_curated_facebook_id ON "FacebookRentalCurated"(facebook_id);
CREATE INDEX idx_facebook_rental_curated_extracted_date ON "FacebookRentalCurated"(extracted_date DESC);
CREATE INDEX idx_facebook_rental_curated_price ON "FacebookRentalCurated"(price);
CREATE INDEX idx_facebook_rental_curated_bedrooms ON "FacebookRentalCurated"(bedrooms);
CREATE INDEX idx_facebook_rental_curated_square_footage ON "FacebookRentalCurated"(square_footage);
CREATE INDEX idx_facebook_rental_curated_city ON "FacebookRentalCurated"(city);

-- RLS
ALTER TABLE "FacebookRentalCurated" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON "FacebookRentalCurated" FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_facebook_rental_curated_updated_at
    BEFORE UPDATE ON "FacebookRentalCurated"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
