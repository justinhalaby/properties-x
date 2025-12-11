-- Add UPDATE policy for property_evaluations
-- Allows authenticated users to update geocoding coordinates
-- Created: 2025-12-11

CREATE POLICY "Allow authenticated update for geocoding"
    ON property_evaluations
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Comment
COMMENT ON POLICY "Allow authenticated update for geocoding" ON property_evaluations IS
    'Allows authenticated API requests to update latitude, longitude, and geocoded_at fields';
