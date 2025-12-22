-- Add columns for address-based scraping
-- Migration: 010_add_address_scraping_columns.sql
-- Purpose: Add clean_street_name and neighborhood columns to property_evaluations table
--          to support address-based scraping on montreal.ca

-- Add new columns
ALTER TABLE property_evaluations
ADD COLUMN IF NOT EXISTS clean_street_name TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT;

-- Backfill clean_street_name from existing nom_rue
-- Logic: Remove prefix words (Rue, Avenue, Boulevard, Av., Boul., Ch., Chemin) and everything after (
-- Example: "Rue Saint-Denis (St-Denis)" → "Saint-Denis"
-- Example: "Boulevard René-Lévesque (Dorchester)" → "René-Lévesque"
UPDATE property_evaluations
SET clean_street_name = (
  SELECT TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        nom_rue,
        '^(Rue|Avenue|Boulevard|Av\.|Boul\.|Ch\.|Chemin)\s+',
        '',
        'i'
      ),
      '\s*\([^)]*\).*$',
      '',
      'g'
    )
  )
)
WHERE clean_street_name IS NULL;

-- Create indexes for address-based lookups
CREATE INDEX IF NOT EXISTS idx_property_evals_clean_street
  ON property_evaluations(clean_street_name)
  WHERE clean_street_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_evals_neighborhood
  ON property_evaluations(neighborhood)
  WHERE neighborhood IS NOT NULL;

-- Composite index for address + neighborhood matching
CREATE INDEX IF NOT EXISTS idx_property_evals_address_neighborhood
  ON property_evaluations(civique_debut, clean_street_name, neighborhood)
  WHERE civique_debut IS NOT NULL AND clean_street_name IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN property_evaluations.clean_street_name IS
  'Street name cleaned for address-based scraping (without prefix words like Rue/Avenue and without parenthetical content)';

COMMENT ON COLUMN property_evaluations.neighborhood IS
  'Neighborhood name for disambiguating multiple properties on same street (to be populated later)';
