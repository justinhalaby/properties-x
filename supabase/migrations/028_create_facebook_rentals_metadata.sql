-- Create facebook_rentals_metadata table
CREATE TABLE facebook_rentals_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facebook_id TEXT NOT NULL UNIQUE,
    source_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    raw_data_size_bytes INTEGER,

    -- Scraping status
    scrape_status TEXT NOT NULL DEFAULT 'pending',
    scrape_duration_ms INTEGER,
    scrape_error TEXT,

    -- Transformation status
    transformation_status TEXT NOT NULL DEFAULT 'pending',
    transformation_error TEXT,
    transformation_attempts INTEGER NOT NULL DEFAULT 0,
    transformed_at TIMESTAMPTZ,

    -- Foreign keys
    curated_id UUID REFERENCES "FacebookRentalCurated"(id) ON DELETE SET NULL,
    rental_id UUID REFERENCES rentals(id) ON DELETE SET NULL,

    -- Preview data
    title_preview TEXT,
    price_preview TEXT,
    address_preview TEXT,

    -- Media storage paths
    images TEXT[] DEFAULT '{}'::TEXT[],
    videos TEXT[] DEFAULT '{}'::TEXT[],

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_scrape_status CHECK (scrape_status IN ('pending', 'success', 'partial', 'failed', 'backfilled')),
    CONSTRAINT valid_transformation_status CHECK (transformation_status IN ('pending', 'success', 'failed', 'skipped'))
);

-- Indexes
CREATE INDEX idx_facebook_rentals_metadata_facebook_id ON facebook_rentals_metadata(facebook_id);
CREATE INDEX idx_facebook_rentals_metadata_transformation_status ON facebook_rentals_metadata(transformation_status);
CREATE INDEX idx_facebook_rentals_metadata_scrape_status ON facebook_rentals_metadata(scrape_status);
CREATE INDEX idx_facebook_rentals_metadata_curated_id ON facebook_rentals_metadata(curated_id);
CREATE INDEX idx_facebook_rentals_metadata_rental_id ON facebook_rentals_metadata(rental_id);

-- RLS
ALTER TABLE facebook_rentals_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON facebook_rentals_metadata FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_facebook_rentals_metadata_updated_at
    BEFORE UPDATE ON facebook_rentals_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
