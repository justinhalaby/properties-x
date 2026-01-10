-- Backfill raw_data_storage_path for FacebookRentalCurated
UPDATE "FacebookRentalCurated" AS c
SET raw_data_storage_path = m.storage_path
FROM facebook_rentals_metadata AS m
WHERE c.facebook_id = m.facebook_id
  AND c.raw_data_storage_path IS NULL
  AND m.storage_path IS NOT NULL;

-- Backfill raw_data_storage_path for CentrisRentalCurated
UPDATE "CentrisRentalCurated" AS c
SET raw_data_storage_path = m.storage_path
FROM centris_rentals_metadata AS m
WHERE c.centris_id = m.centris_id
  AND c.raw_data_storage_path IS NULL
  AND m.storage_path IS NOT NULL;

-- Backfill raw_data_storage_path for rentals (Facebook)
UPDATE rentals AS r
SET raw_data_storage_path = m.storage_path
FROM facebook_rentals_metadata AS m
WHERE r.facebook_id = m.facebook_id
  AND r.source_name = 'facebook_marketplace'
  AND r.raw_data_storage_path IS NULL
  AND m.storage_path IS NOT NULL;

-- Backfill raw_data_storage_path for rentals (Centris)
UPDATE rentals AS r
SET raw_data_storage_path = m.storage_path
FROM centris_rentals_metadata AS m
WHERE r.centris_id = m.centris_id
  AND r.source_name = 'centris'
  AND r.raw_data_storage_path IS NULL
  AND m.storage_path IS NOT NULL;
