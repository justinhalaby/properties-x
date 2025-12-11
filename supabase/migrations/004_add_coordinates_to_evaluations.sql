-- Add coordinates to property_evaluations table for map display
-- Migration: 004_add_coordinates_to_evaluations

-- Add latitude, longitude, and geocoded_at columns
ALTER TABLE property_evaluations
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8),
ADD COLUMN geocoded_at TIMESTAMP;

-- Add index for coordinate lookups (partial index for better performance)
CREATE INDEX idx_property_evaluations_coords
ON property_evaluations (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN property_evaluations.latitude IS 'Geocoded latitude from full_address using Nominatim API';
COMMENT ON COLUMN property_evaluations.longitude IS 'Geocoded longitude from full_address using Nominatim API';
COMMENT ON COLUMN property_evaluations.geocoded_at IS 'Timestamp when coordinates were geocoded';
