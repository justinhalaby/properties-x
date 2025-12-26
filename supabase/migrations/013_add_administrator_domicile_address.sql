-- ============================================================================
-- Migration: Add domicile address fields to company_administrators table
-- Description: Administrators have both home address (domicile) and
--              professional address. This migration adds the domicile fields.
-- ============================================================================

-- Add domicile address columns to company_administrators
ALTER TABLE company_administrators
ADD COLUMN IF NOT EXISTS domicile_address TEXT,
ADD COLUMN IF NOT EXISTS domicile_street_number TEXT,
ADD COLUMN IF NOT EXISTS domicile_street_name TEXT,
ADD COLUMN IF NOT EXISTS domicile_unit TEXT,
ADD COLUMN IF NOT EXISTS domicile_city TEXT,
ADD COLUMN IF NOT EXISTS domicile_province TEXT,
ADD COLUMN IF NOT EXISTS domicile_postal_code TEXT,
ADD COLUMN IF NOT EXISTS domicile_address_publishable BOOLEAN DEFAULT true;

-- Add comment to clarify the difference between addresses
COMMENT ON COLUMN company_administrators.domicile_address IS 'Home address of the administrator (Adresse du domicile) - often marked as "non publiable"';
COMMENT ON COLUMN company_administrators.professional_address IS 'Professional/business address (Adresse professionnelle)';
COMMENT ON COLUMN company_administrators.domicile_address_publishable IS 'Whether the domicile address is publishable (false if "non publiable")';
COMMENT ON COLUMN company_administrators.address_publishable IS 'Whether the professional address is publishable (false if "non publiable")';
