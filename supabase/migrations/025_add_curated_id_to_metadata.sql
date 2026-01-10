-- Add curated_id column to centris_rentals_metadata to link to CentrisRentalCurated
ALTER TABLE centris_rentals_metadata
ADD COLUMN curated_id UUID REFERENCES "CentrisRentalCurated"(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_centris_rentals_metadata_curated_id
ON centris_rentals_metadata(curated_id);
