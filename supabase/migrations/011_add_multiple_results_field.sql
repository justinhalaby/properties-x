-- Store information about multiple search results
-- Migration: 011_add_multiple_results_field.sql
-- Purpose: Add JSONB column to montreal_evaluation_details to store info about
--          multiple search results when address-based search returns multiple properties

ALTER TABLE montreal_evaluation_details
ADD COLUMN IF NOT EXISTS multiple_results_info JSONB;

-- Create index for queries on multiple_results_info
CREATE INDEX IF NOT EXISTS idx_montreal_eval_multiple_results
  ON montreal_evaluation_details(multiple_results_info)
  WHERE multiple_results_info IS NOT NULL;

-- Add column comment for documentation
COMMENT ON COLUMN montreal_evaluation_details.multiple_results_info IS
  'JSON data about multiple search results when address-based search returns multiple properties (1-10 results). Contains: hasMultiple, count, results array, selectedIndex';
