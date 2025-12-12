-- Add show_on_map column to property_evaluations
-- Allows manual control over which evaluations appear on the map
-- Created: 2025-12-11

ALTER TABLE property_evaluations
ADD COLUMN show_on_map BOOLEAN DEFAULT false;

-- Create index for map queries
CREATE INDEX idx_property_evaluations_show_on_map
ON property_evaluations (show_on_map)
WHERE show_on_map = true;

-- Comment
COMMENT ON COLUMN property_evaluations.show_on_map IS
    'Whether this evaluation should be displayed on the map view (manually controlled)';
