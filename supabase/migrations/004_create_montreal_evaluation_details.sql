-- Create table for detailed Montreal property evaluation data scraped from montreal.ca
CREATE TABLE IF NOT EXISTS montreal_evaluation_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Link to property_evaluations table
  matricule VARCHAR(50) UNIQUE NOT NULL,

  -- Identification section
  address TEXT,
  arrondissement TEXT,
  lot_exclusif TEXT,
  lot_commun TEXT,
  usage_predominant TEXT,
  numero_unite_voisinage TEXT,
  numero_compte_foncier TEXT,

  -- Owner information
  owner_name TEXT,
  owner_status TEXT,
  owner_postal_address TEXT,
  owner_registration_date DATE,
  owner_special_conditions TEXT,

  -- Land characteristics
  land_frontage NUMERIC,
  land_area NUMERIC,

  -- Building characteristics
  building_floors INTEGER,
  building_year INTEGER,
  building_floor_area NUMERIC,
  building_construction_type TEXT,
  building_physical_link TEXT,
  building_units INTEGER,
  building_non_residential_spaces INTEGER,
  building_rental_rooms INTEGER,

  -- Current valuation
  current_market_date DATE,
  current_land_value NUMERIC,
  current_building_value NUMERIC,
  current_total_value NUMERIC,

  -- Previous valuation
  previous_market_date DATE,
  previous_total_value NUMERIC,

  -- Fiscal distribution
  tax_category TEXT,
  taxable_value NUMERIC,
  non_taxable_value NUMERIC,

  -- Tax account links (JSON array of years and PDF URLs)
  tax_account_pdfs JSONB,

  -- Metadata
  roll_period TEXT, -- e.g., "2026-2027-2028"
  data_date DATE, -- Date when the data was current
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create indexes
CREATE INDEX idx_montreal_eval_matricule ON montreal_evaluation_details(matricule);
CREATE INDEX idx_montreal_eval_address ON montreal_evaluation_details(address);
CREATE INDEX idx_montreal_eval_owner ON montreal_evaluation_details(owner_name);
CREATE INDEX idx_montreal_eval_current_value ON montreal_evaluation_details(current_total_value);
CREATE INDEX idx_montreal_eval_scraped_at ON montreal_evaluation_details(scraped_at);

-- Enable Row Level Security
ALTER TABLE montreal_evaluation_details ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON montreal_evaluation_details
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON montreal_evaluation_details
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON montreal_evaluation_details
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Add updated_at trigger
CREATE TRIGGER update_montreal_evaluation_details_updated_at
  BEFORE UPDATE ON montreal_evaluation_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE montreal_evaluation_details IS 'Detailed property evaluation data scraped from montreal.ca by matricule number';
