-- Add table for ultimate beneficial owners (bénéficiaires ultimes)

CREATE TABLE IF NOT EXISTS company_beneficial_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Relationship to company
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Beneficial owner identification
  owner_name TEXT NOT NULL, -- First name + last name
  first_name TEXT,
  last_name TEXT,
  other_names TEXT, -- "Autres noms utilisés"

  -- Status details
  status_start_date DATE, -- "Date du début du statut"
  applicable_situations TEXT, -- "Situations applicables au bénéficiaire ultime"

  -- Address (both full text and parsed components)
  domicile_address TEXT, -- "Adresse du domicile"
  street_number TEXT,
  street_name TEXT,
  unit TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  address_publishable BOOLEAN DEFAULT true, -- false if "non publiable"

  -- Order/position
  position_order INTEGER, -- For sorting

  -- Metadata
  scraped_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indexes for beneficial_owners table
CREATE INDEX idx_beneficial_owners_company ON company_beneficial_owners(company_id);
CREATE INDEX idx_beneficial_owners_name ON company_beneficial_owners(owner_name);
CREATE INDEX idx_beneficial_owners_last_name ON company_beneficial_owners(last_name);

-- Enable RLS
ALTER TABLE company_beneficial_owners ENABLE ROW LEVEL SECURITY;

-- Beneficial owners policies
CREATE POLICY "Enable read access for all users" ON company_beneficial_owners
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON company_beneficial_owners
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON company_beneficial_owners
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Add updated_at trigger
CREATE TRIGGER update_beneficial_owners_updated_at
  BEFORE UPDATE ON company_beneficial_owners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment
COMMENT ON TABLE company_beneficial_owners IS 'Ultimate beneficial owners (Bénéficiaires ultimes) of companies from Quebec Enterprise Registry';
