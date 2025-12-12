// CSV column names as they appear in the dataset
export interface PropertyEvaluationCSV {
  ID_UEV: string;
  CIVIQUE_DEBUT: string;
  CIVIQUE_FIN: string;
  NOM_RUE: string;
  SUITE_DEBUT: string;
  MUNICIPALITE: string;
  ETAGE_HORS_SOL: string;
  NOMBRE_LOGEMENT: string;
  ANNEE_CONSTRUCTION: string;
  CODE_UTILISATION: string;
  LETTRE_DEBUT: string;
  LETTRE_FIN: string;
  LIBELLE_UTILISATION: string;
  CATEGORIE_UEF: string;
  MATRICULE83: string;
  SUPERFICIE_TERRAIN: string;
  SUPERFICIE_BATIMENT: string;
  NO_ARROND_ILE_CUM: string;
}

// Database row type
export interface PropertyEvaluation {
  id_uev: number;
  matricule83: string;
  civique_debut: number | null;
  civique_fin: number | null;
  lettre_debut: string | null;
  lettre_fin: string | null;
  nom_rue: string;
  suite_debut: string | null;
  municipalite: string | null;
  no_arrond_ile_cum: string | null;
  etage_hors_sol: number | null;
  nombre_logement: number | null;
  annee_construction: number | null;
  code_utilisation: number | null;
  libelle_utilisation: string;
  categorie_uef: string;
  superficie_terrain: number | null;
  superficie_batiment: number | null;
  clean_address: string;
  full_address: string;
  latitude?: number | null; // Geocoded coordinates
  longitude?: number | null;
  geocoded_at?: string | null;
  show_on_map?: boolean; // Manually control map visibility
  created_at: string;
  updated_at: string;
  scraped_at?: string | null; // From montreal_evaluation_details join
}

// Insert type (omits generated columns and timestamps)
export interface PropertyEvaluationInsert {
  id_uev: number;
  matricule83: string;
  civique_debut?: number | null;
  civique_fin?: number | null;
  lettre_debut?: string | null;
  lettre_fin?: string | null;
  nom_rue: string;
  suite_debut?: string | null;
  municipalite?: string | null;
  no_arrond_ile_cum?: string | null;
  etage_hors_sol?: number | null;
  nombre_logement?: number | null;
  annee_construction?: number | null;
  code_utilisation?: number | null;
  libelle_utilisation: string;
  categorie_uef: string;
  superficie_terrain?: number | null;
  superficie_batiment?: number | null;
  latitude?: number | null; // Geocoded coordinates
  longitude?: number | null;
  geocoded_at?: string | null;
  show_on_map?: boolean;
}

// Filter types for API
export interface PropertyEvaluationFilters {
  search?: string; // Full-text search on addresses
  municipalite?: string; // Municipality code
  arrondissement?: string; // District code
  categorie?: string; // "Condominium" or "Régulier"
  usageCode?: number; // Usage code
  minYear?: number; // Construction year range
  maxYear?: number;
  minLogements?: number; // Number of units range
  maxLogements?: number;
  minEtages?: number; // Floor count range
  maxEtages?: number;
  minTerrainArea?: number; // Land area range (m²)
  maxTerrainArea?: number;
  minBatimentArea?: number; // Building area range (m²)
  maxBatimentArea?: number;
  page?: number; // Pagination
  limit?: number; // Results per page (default: 50)
}

// API response types
export interface PropertyEvaluationListResponse {
  data: PropertyEvaluation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Utility type for usage categories (common values)
export type UsageCategory =
  | "Logement"
  | "Stationnement intérieur (condo)"
  | "Stationnement extérieur (condo)"
  | "Immeuble commercial"
  | "Terrain vague"
  | "Autre";
