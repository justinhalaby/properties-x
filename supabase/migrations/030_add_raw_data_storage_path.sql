-- Add raw_data_storage_path to FacebookRentalCurated
ALTER TABLE "FacebookRentalCurated"
ADD COLUMN IF NOT EXISTS raw_data_storage_path TEXT;

-- Add raw_data_storage_path to CentrisRentalCurated
ALTER TABLE "CentrisRentalCurated"
ADD COLUMN IF NOT EXISTS raw_data_storage_path TEXT;

-- Add raw_data_storage_path to rentals
ALTER TABLE rentals
ADD COLUMN IF NOT EXISTS raw_data_storage_path TEXT;

-- Add indexes for lookups
CREATE INDEX IF NOT EXISTS idx_facebook_rental_curated_storage_path
ON "FacebookRentalCurated"(raw_data_storage_path);

CREATE INDEX IF NOT EXISTS idx_centris_rental_curated_storage_path
ON "CentrisRentalCurated"(raw_data_storage_path);

CREATE INDEX IF NOT EXISTS idx_rentals_storage_path
ON rentals(raw_data_storage_path);

-- Add comments
COMMENT ON COLUMN "FacebookRentalCurated".raw_data_storage_path IS 'Path to raw JSON in facebook-raw-rentals bucket (e.g., "2026/01/123456789.json")';
COMMENT ON COLUMN "CentrisRentalCurated".raw_data_storage_path IS 'Path to raw JSON in centris-raw-rentals bucket (e.g., "2026/01/28522506.json")';
COMMENT ON COLUMN rentals.raw_data_storage_path IS 'Path to raw JSON in storage bucket for traceability';
