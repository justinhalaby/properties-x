-- Add centris_id column to rentals table for linking to Centris metadata
ALTER TABLE rentals ADD COLUMN centris_id TEXT UNIQUE;

-- Create index for efficient lookups
CREATE INDEX idx_rentals_centris_id ON rentals(centris_id);

-- Add helpful comment
COMMENT ON COLUMN rentals.centris_id IS 'Centris listing ID for linking to raw data in centris_rentals_metadata';
