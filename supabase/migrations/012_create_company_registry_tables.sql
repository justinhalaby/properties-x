-- Create tables for Quebec business registry company information
-- This enables tracking of company ownership structures, shareholders, and administrators

-- ============================================================================
-- 1. COMPANIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Quebec Enterprise Registry identifiers
  neq VARCHAR(10) UNIQUE NOT NULL, -- Numéro d'entreprise du Québec

  -- Company identification
  company_name TEXT NOT NULL,
  company_status TEXT, -- e.g., "Immatriculée", "Radiée"

  -- Domicile address (both full text and parsed components)
  domicile_address TEXT,
  domicile_street_number TEXT,
  domicile_street_name TEXT,
  domicile_city TEXT,
  domicile_province TEXT,
  domicile_postal_code TEXT,

  -- Registration dates
  registration_date DATE, -- Date d'immatriculation
  status_date DATE, -- Date when status was last updated

  -- Economic activity
  cae_code TEXT, -- Code d'activité économique
  cae_description TEXT, -- Activity description

  -- Metadata
  source_url TEXT, -- URL of the registry page
  scraped_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  last_verified_at TIMESTAMPTZ -- Last time data was re-scraped
);

-- Indexes for companies table
CREATE INDEX idx_companies_neq ON companies(neq);
CREATE INDEX idx_companies_name ON companies(company_name);
CREATE INDEX idx_companies_status ON companies(company_status);
CREATE INDEX idx_companies_scraped_at ON companies(scraped_at DESC);

-- Full-text search index
CREATE INDEX idx_companies_search ON companies USING gin(
  to_tsvector('french', coalesce(company_name, '') || ' ' || coalesce(neq, ''))
);

-- ============================================================================
-- 2. COMPANY SHAREHOLDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_shareholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Relationship to company
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Shareholder identification
  shareholder_name TEXT NOT NULL, -- Can be individual or company name
  shareholder_type TEXT, -- 'individual' or 'corporate'
  shareholder_neq VARCHAR(10), -- If shareholder is a company (for future linking)

  -- Order from registry (Premier actionnaire = 1, Deuxième = 2, etc.)
  position INTEGER,

  -- Ownership details
  is_majority_shareholder BOOLEAN DEFAULT false, -- Actionnaire majoritaire

  -- Address (both full text and parsed components)
  address TEXT, -- Full address
  street_number TEXT,
  street_name TEXT,
  unit TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  address_publishable BOOLEAN DEFAULT true, -- false if "non publiable"

  -- Metadata
  scraped_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indexes for shareholders table
CREATE INDEX idx_shareholders_company ON company_shareholders(company_id);
CREATE INDEX idx_shareholders_name ON company_shareholders(shareholder_name);
CREATE INDEX idx_shareholders_neq ON company_shareholders(shareholder_neq) WHERE shareholder_neq IS NOT NULL;
CREATE INDEX idx_shareholders_type ON company_shareholders(shareholder_type);

-- ============================================================================
-- 3. COMPANY ADMINISTRATORS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_administrators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Relationship to company
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Administrator identification
  administrator_name TEXT NOT NULL,

  -- Position
  position_title TEXT, -- "Président", "Vice-président", "Secrétaire", etc.
  position_order INTEGER, -- For sorting (1, 2, 3...)

  -- Professional address (separate from personal)
  professional_address TEXT, -- Full professional address
  professional_street_number TEXT,
  professional_street_name TEXT,
  professional_unit TEXT,
  professional_city TEXT,
  professional_province TEXT,
  professional_postal_code TEXT,
  address_publishable BOOLEAN DEFAULT true, -- false if "non publiable"

  -- Metadata
  scraped_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indexes for administrators table
CREATE INDEX idx_administrators_company ON company_administrators(company_id);
CREATE INDEX idx_administrators_name ON company_administrators(administrator_name);
CREATE INDEX idx_administrators_position ON company_administrators(position_title);

-- ============================================================================
-- 4. PROPERTY COMPANY LINKS TABLE (Junction Table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_company_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Relationships
  matricule VARCHAR(50) NOT NULL, -- Links to montreal_evaluation_details
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Link metadata
  link_confidence TEXT, -- 'exact', 'fuzzy', 'manual'
  link_method TEXT, -- 'owner_name_match', 'manual_addition', 'auto_detection'
  verified BOOLEAN DEFAULT false, -- User verified
  verified_at TIMESTAMPTZ,
  verified_by TEXT, -- User ID or system

  -- Notes
  notes TEXT,

  -- Ensure unique combination of property and company
  UNIQUE(matricule, company_id)
);

-- Indexes for property_company_links table
CREATE INDEX idx_property_links_matricule ON property_company_links(matricule);
CREATE INDEX idx_property_links_company ON property_company_links(company_id);
CREATE INDEX idx_property_links_verified ON property_company_links(verified);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_company_links ENABLE ROW LEVEL SECURITY;

-- Companies policies
CREATE POLICY "Enable read access for all users" ON companies
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON companies
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON companies
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Shareholders policies
CREATE POLICY "Enable read access for all users" ON company_shareholders
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON company_shareholders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON company_shareholders
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Administrators policies
CREATE POLICY "Enable read access for all users" ON company_administrators
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON company_administrators
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON company_administrators
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Property company links policies
CREATE POLICY "Enable read access for all users" ON property_company_links
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON property_company_links
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON property_company_links
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Add updated_at trigger for companies
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for shareholders
CREATE TRIGGER update_shareholders_updated_at
  BEFORE UPDATE ON company_shareholders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for administrators
CREATE TRIGGER update_administrators_updated_at
  BEFORE UPDATE ON company_administrators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE companies IS 'Company information from the Quebec Enterprise Registry (registreentreprises.gouv.qc.ca)';
COMMENT ON TABLE company_shareholders IS 'Shareholders (Actionnaires) of companies with addresses and majority status';
COMMENT ON TABLE company_administrators IS 'Administrators (Administrateurs) of companies with positions and professional addresses';
COMMENT ON TABLE property_company_links IS 'Links between properties (matricule) and companies for ownership tracking';
