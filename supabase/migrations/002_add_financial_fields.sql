-- Add financial and unit detail fields for multi-residential properties

-- Units
ALTER TABLE properties ADD COLUMN IF NOT EXISTS units INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS unit_details TEXT;

-- Potential revenue
ALTER TABLE properties ADD COLUMN IF NOT EXISTS potential_revenue DECIMAL(12, 2);

-- Évaluation municipale (Municipal Assessment)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS municipal_assessment DECIMAL(12, 2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS assessment_land DECIMAL(12, 2); -- Terrain
ALTER TABLE properties ADD COLUMN IF NOT EXISTS assessment_building DECIMAL(12, 2); -- Bâtiment

-- Taxes
ALTER TABLE properties ADD COLUMN IF NOT EXISTS taxes DECIMAL(10, 2); -- Total
ALTER TABLE properties ADD COLUMN IF NOT EXISTS taxes_municipal DECIMAL(10, 2); -- Municipales
ALTER TABLE properties ADD COLUMN IF NOT EXISTS taxes_school DECIMAL(10, 2); -- Scolaires

-- Dépenses (Expenses)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS expenses DECIMAL(10, 2); -- Total
ALTER TABLE properties ADD COLUMN IF NOT EXISTS expense_electricity DECIMAL(10, 2); -- Électricité
ALTER TABLE properties ADD COLUMN IF NOT EXISTS expense_heating DECIMAL(10, 2); -- Mazout/Chauffage
