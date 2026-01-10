-- Create CentrisRentalCurated table for staging cleaned Centris data
CREATE TABLE "CentrisRentalCurated" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    centris_id TEXT NOT NULL UNIQUE,
    source_url TEXT NOT NULL,

    -- Metadata
    scraped_at TIMESTAMPTZ NOT NULL,
    scraper_version TEXT,

    -- Property
    property_type TEXT,
    address TEXT,

    -- Price (3 fields)
    price DECIMAL(10, 2),
    price_currency TEXT DEFAULT 'CAD',
    price_display TEXT,

    -- Location
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Rooms
    rooms INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),

    -- Extracted characteristics
    square_footage INTEGER,
    year_of_construction INTEGER,
    parking INTEGER,

    -- Media
    image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Other
    description TEXT,
    walk_score TEXT,

    -- Broker
    broker_name TEXT,
    broker_url TEXT,

    -- Remaining characteristics
    characteristics JSONB DEFAULT '{}'::JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_price CHECK (price IS NULL OR price >= 0),
    CONSTRAINT valid_year CHECK (year_of_construction IS NULL OR
        (year_of_construction >= 1600 AND year_of_construction <= 2100))
);

-- Indexes
CREATE INDEX idx_centris_rental_curated_centris_id ON "CentrisRentalCurated"(centris_id);
CREATE INDEX idx_centris_rental_curated_scraped_at ON "CentrisRentalCurated"(scraped_at DESC);
CREATE INDEX idx_centris_rental_curated_price ON "CentrisRentalCurated"(price);
CREATE INDEX idx_centris_rental_curated_bedrooms ON "CentrisRentalCurated"(bedrooms);

-- RLS
ALTER TABLE "CentrisRentalCurated" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON "CentrisRentalCurated" FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_centris_rental_curated_updated_at
    BEFORE UPDATE ON "CentrisRentalCurated"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
