-- Add is_historical flag and end dates to track historical records

-- Add to shareholders table
ALTER TABLE company_shareholders
ADD COLUMN is_historical BOOLEAN DEFAULT false,
ADD COLUMN date_end DATE; -- Date de la fin

-- Add to administrators table
ALTER TABLE company_administrators
ADD COLUMN is_historical BOOLEAN DEFAULT false,
ADD COLUMN date_start DATE, -- Date du début de la charge
ADD COLUMN date_end DATE; -- Date de la fin de la charge

-- Add to beneficial owners table
ALTER TABLE company_beneficial_owners
ADD COLUMN is_historical BOOLEAN DEFAULT false,
ADD COLUMN date_end DATE; -- Date de la fin du statut

-- Add indexes for querying current vs historical records
CREATE INDEX idx_shareholders_historical ON company_shareholders(company_id, is_historical);
CREATE INDEX idx_administrators_historical ON company_administrators(company_id, is_historical);
CREATE INDEX idx_beneficial_owners_historical ON company_beneficial_owners(company_id, is_historical);

-- Comment
COMMENT ON COLUMN company_shareholders.is_historical IS 'True if this is a historical record (no longer current)';
COMMENT ON COLUMN company_administrators.is_historical IS 'True if this is a historical record (no longer current)';
COMMENT ON COLUMN company_beneficial_owners.is_historical IS 'True if this is a historical record (no longer current)';
