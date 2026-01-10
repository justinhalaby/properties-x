-- Create table for tracking Centris rental scraping metadata
-- Raw JSON data is stored in Supabase Storage (centris-raw bucket)
-- This table contains lightweight metadata for querying and transformation tracking

CREATE TABLE centris_rentals_metadata (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    centris_id TEXT NOT NULL UNIQUE, -- From URL (e.g., "19013486")
    source_url TEXT NOT NULL,

    -- Storage reference
    storage_path TEXT NOT NULL, -- Path in Supabase Storage: "centris-raw/{YYYY}/{MM}/{centris_id}.json"
    raw_data_size_bytes INTEGER, -- Size of JSON file for monitoring

    -- Scraping metadata
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scrape_status TEXT NOT NULL DEFAULT 'success', -- 'success', 'partial', 'failed'
    scrape_error TEXT,
    scrape_duration_ms INTEGER,

    -- Quick preview (for listing without fetching storage)
    title_preview TEXT, -- First 100 chars of title
    price_preview TEXT, -- e.g., "1 900 $ /mois"
    address_preview TEXT,

    -- Transformation tracking
    transformation_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed', 'skipped'
    transformed_at TIMESTAMPTZ,
    transformation_error TEXT,
    transformation_attempts INTEGER DEFAULT 0,
    rental_id UUID REFERENCES rentals(id) ON DELETE SET NULL, -- Link to final rental

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_scrape_status CHECK (scrape_status IN ('success', 'partial', 'failed')),
    CONSTRAINT valid_transformation_status CHECK (transformation_status IN ('pending', 'success', 'failed', 'skipped'))
);

-- Indexes for efficient querying
CREATE INDEX idx_centris_rentals_metadata_scraped_at ON centris_rentals_metadata(scraped_at DESC);
CREATE INDEX idx_centris_rentals_metadata_transformation_status ON centris_rentals_metadata(transformation_status);
CREATE INDEX idx_centris_rentals_metadata_rental_id ON centris_rentals_metadata(rental_id);
CREATE INDEX idx_centris_rentals_metadata_pending ON centris_rentals_metadata(scraped_at DESC)
    WHERE transformation_status = 'pending';

-- Enable Row Level Security
ALTER TABLE centris_rentals_metadata ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all operations" ON centris_rentals_metadata FOR ALL USING (true) WITH CHECK (true);

-- Add helpful comments
COMMENT ON TABLE centris_rentals_metadata IS 'Metadata for Centris rental scraping. Raw JSON stored in centris-raw Storage bucket.';
COMMENT ON COLUMN centris_rentals_metadata.centris_id IS 'Unique listing ID from Centris URL';
COMMENT ON COLUMN centris_rentals_metadata.storage_path IS 'Path to raw JSON in centris-raw bucket using date-based partitioning: {YYYY}/{MM}/{centris_id}.json';
COMMENT ON COLUMN centris_rentals_metadata.transformation_status IS 'Tracks whether raw data has been transformed to rentals table';
COMMENT ON COLUMN centris_rentals_metadata.rental_id IS 'Links to final rental record after transformation';
