-- Montreal Property Evaluations Table
-- Imports data from uniteevaluationfonciere.csv (512K+ records)
-- Created: 2025-12-10

CREATE TABLE property_evaluations (
    -- Primary identifiers
    id_uev INTEGER PRIMARY KEY,
    matricule83 TEXT NOT NULL,

    -- Address components
    civique_debut INTEGER,
    civique_fin INTEGER,
    lettre_debut TEXT,
    lettre_fin TEXT,
    nom_rue TEXT NOT NULL,
    suite_debut TEXT,
    municipalite TEXT,
    no_arrond_ile_cum TEXT,

    -- Property characteristics
    etage_hors_sol INTEGER,
    nombre_logement INTEGER,
    annee_construction INTEGER,

    -- Property classification
    code_utilisation INTEGER,
    libelle_utilisation TEXT NOT NULL,
    categorie_uef TEXT NOT NULL,

    -- Areas (in square meters)
    superficie_terrain INTEGER,
    superficie_batiment INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_civique_debut CHECK (civique_debut IS NULL OR civique_debut > 0),
    CONSTRAINT valid_civique_fin CHECK (civique_fin IS NULL OR civique_fin > 0),
    CONSTRAINT valid_etages CHECK (etage_hors_sol IS NULL OR etage_hors_sol >= 0),
    CONSTRAINT valid_logements CHECK (nombre_logement IS NULL OR nombre_logement >= 0),
    CONSTRAINT valid_annee CHECK (annee_construction IS NULL OR annee_construction >= 1600),
    CONSTRAINT valid_terrain CHECK (superficie_terrain IS NULL OR superficie_terrain >= 0),
    CONSTRAINT valid_batiment CHECK (superficie_batiment IS NULL OR superficie_batiment >= 0)
);

-- Generated columns for clean addresses
ALTER TABLE property_evaluations
ADD COLUMN clean_address TEXT GENERATED ALWAYS AS (
    CASE
        WHEN civique_debut = civique_fin OR civique_fin IS NULL THEN
            COALESCE(civique_debut::text, '') ||
            COALESCE(lettre_debut, '') ||
            COALESCE(' ' || suite_debut, '') ||
            CASE WHEN civique_debut IS NOT NULL THEN ' ' ELSE '' END ||
            REGEXP_REPLACE(nom_rue, '\s+\([^)]+\)', '', 'g')
        ELSE
            COALESCE(civique_debut::text || '-' || civique_fin::text, '') ||
            ' ' || REGEXP_REPLACE(nom_rue, '\s+\([^)]+\)', '', 'g')
    END
) STORED;

ALTER TABLE property_evaluations
ADD COLUMN full_address TEXT GENERATED ALWAYS AS (
    CASE
        WHEN civique_debut = civique_fin OR civique_fin IS NULL THEN
            COALESCE(civique_debut::text, '') ||
            COALESCE(lettre_debut, '') ||
            COALESCE(' ' || suite_debut, '') ||
            CASE WHEN civique_debut IS NOT NULL THEN ' ' ELSE '' END ||
            REGEXP_REPLACE(nom_rue, '\s+\([^)]+\)', '', 'g')
        ELSE
            COALESCE(civique_debut::text || '-' || civique_fin::text, '') ||
            ' ' || REGEXP_REPLACE(nom_rue, '\s+\([^)]+\)', '', 'g')
    END || ', Montréal, QC'
) STORED;

-- Indexes for common queries and filters

-- Primary lookup indexes
CREATE INDEX idx_property_evals_address_fts ON property_evaluations
    USING gin(to_tsvector('french', clean_address));

CREATE INDEX idx_property_evals_nom_rue ON property_evaluations(nom_rue);
CREATE INDEX idx_property_evals_municipalite ON property_evaluations(municipalite)
    WHERE municipalite IS NOT NULL;
CREATE INDEX idx_property_evals_arrond ON property_evaluations(no_arrond_ile_cum)
    WHERE no_arrond_ile_cum IS NOT NULL;

-- Filter indexes
CREATE INDEX idx_property_evals_annee ON property_evaluations(annee_construction)
    WHERE annee_construction IS NOT NULL AND annee_construction != 9999;

CREATE INDEX idx_property_evals_logements ON property_evaluations(nombre_logement)
    WHERE nombre_logement IS NOT NULL;

CREATE INDEX idx_property_evals_etages ON property_evaluations(etage_hors_sol)
    WHERE etage_hors_sol IS NOT NULL;

CREATE INDEX idx_property_evals_usage ON property_evaluations(code_utilisation)
    WHERE code_utilisation IS NOT NULL;

CREATE INDEX idx_property_evals_categorie ON property_evaluations(categorie_uef);

-- Area indexes with nulls handling
CREATE INDEX idx_property_evals_terrain ON property_evaluations(superficie_terrain)
    WHERE superficie_terrain IS NOT NULL;

CREATE INDEX idx_property_evals_batiment ON property_evaluations(superficie_batiment)
    WHERE superficie_batiment IS NOT NULL;

-- Composite index for common filter combinations
CREATE INDEX idx_property_evals_composite ON property_evaluations(
    municipalite, categorie_uef, nombre_logement
) WHERE municipalite IS NOT NULL;

-- RLS Policies
ALTER TABLE property_evaluations ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to property evaluations"
    ON property_evaluations
    FOR SELECT
    USING (true);

-- Allow authenticated insert for admin imports
CREATE POLICY "Allow authenticated insert for admin imports"
    ON property_evaluations
    FOR INSERT
    WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_property_evaluations_updated_at
    BEFORE UPDATE ON property_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE property_evaluations IS
    'Montreal property evaluation data from CSV import. Contains 512K+ records from the urban community evaluation roll.';

COMMENT ON COLUMN property_evaluations.id_uev IS
    'Unique evaluation unit identifier';

COMMENT ON COLUMN property_evaluations.matricule83 IS
    'Property tax roll number (matricule fiscal)';

COMMENT ON COLUMN property_evaluations.clean_address IS
    'Formatted address without municipality codes (generated column)';

COMMENT ON COLUMN property_evaluations.full_address IS
    'Complete address with city and province (generated column)';
