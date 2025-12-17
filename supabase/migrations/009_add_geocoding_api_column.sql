-- Add geocoding API tracking column to property_evaluations
-- Migration: 009_add_geocoding_api_column
-- This tracks which API was used for geocoding attempts (even on failure)

-- Add geocoding_api column
ALTER TABLE property_evaluations
ADD COLUMN geocoding_api TEXT;

-- Add index for filtering by API
CREATE INDEX idx_property_evaluations_geocoding_api
ON property_evaluations (geocoding_api)
WHERE geocoding_api IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN property_evaluations.geocoding_api IS 'Geocoding API provider used for the last geocoding attempt (e.g., "nominatim", "google"). Set even on failed attempts.';
