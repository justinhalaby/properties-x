-- Add images column to centris_rentals_metadata to store downloaded image paths
-- Images are downloaded during scrape/import step, not transformation step

ALTER TABLE centris_rentals_metadata
ADD COLUMN images TEXT[] DEFAULT '{}';

COMMENT ON COLUMN centris_rentals_metadata.images IS 'Array of storage paths to downloaded images (e.g., ["rentals/centris/temp/{centris_id}/image-0.jpg"])';
