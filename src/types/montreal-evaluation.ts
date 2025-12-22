// Types for detailed Montreal property evaluation data from montreal.ca

// New interfaces for address-based scraping
export interface AddressSearchParams {
  streetNumber: number;
  streetName: string;
}

export interface MultipleResultsInfo {
  hasMultiple: boolean;
  count?: number;
  results?: Array<{
    address: string;
    arrondissement?: string;
    neighborhood?: string;
  }>;
  selectedIndex?: number;
}

export interface MontrealEvaluationDetails {
  id: string;
  created_at: string;
  updated_at: string;

  // Link to property_evaluations
  matricule: string;

  // Identification
  address: string | null;
  arrondissement: string | null;
  lot_exclusif: string | null;
  lot_commun: string | null;
  usage_predominant: string | null;
  numero_unite_voisinage: string | null;
  numero_compte_foncier: string | null;

  // Owner information
  owner_name: string | null;
  owner_status: string | null;
  owner_postal_address: string | null;
  owner_registration_date: string | null;
  owner_special_conditions: string | null;

  // Land characteristics
  land_frontage: number | null;
  land_area: number | null;

  // Building characteristics
  building_floors: number | null;
  building_year: number | null;
  building_floor_area: number | null;
  building_construction_type: string | null;
  building_physical_link: string | null;
  building_units: number | null;
  building_non_residential_spaces: number | null;
  building_rental_rooms: number | null;

  // Current valuation
  current_market_date: string | null;
  current_land_value: number | null;
  current_building_value: number | null;
  current_total_value: number | null;

  // Previous valuation
  previous_market_date: string | null;
  previous_total_value: number | null;

  // Fiscal distribution
  tax_category: string | null;
  taxable_value: number | null;
  non_taxable_value: number | null;

  // Tax account PDFs
  tax_account_pdfs: TaxAccountPDF[] | null;

  // Metadata
  roll_period: string | null;
  data_date: string | null;
  scraped_at: string;

  // Multiple results info (for address-based scraping)
  multiple_results_info: MultipleResultsInfo | null;
}

export interface TaxAccountPDF {
  year: number;
  url: string;
}

export interface MontrealEvaluationInsert {
  matricule: string;
  address?: string | null;
  arrondissement?: string | null;
  lot_exclusif?: string | null;
  lot_commun?: string | null;
  usage_predominant?: string | null;
  numero_unite_voisinage?: string | null;
  numero_compte_foncier?: string | null;
  owner_name?: string | null;
  owner_status?: string | null;
  owner_postal_address?: string | null;
  owner_registration_date?: string | null;
  owner_special_conditions?: string | null;
  land_frontage?: number | null;
  land_area?: number | null;
  building_floors?: number | null;
  building_year?: number | null;
  building_floor_area?: number | null;
  building_construction_type?: string | null;
  building_physical_link?: string | null;
  building_units?: number | null;
  building_non_residential_spaces?: number | null;
  building_rental_rooms?: number | null;
  current_market_date?: string | null;
  current_land_value?: number | null;
  current_building_value?: number | null;
  current_total_value?: number | null;
  previous_market_date?: string | null;
  previous_total_value?: number | null;
  tax_category?: string | null;
  taxable_value?: number | null;
  non_taxable_value?: number | null;
  tax_account_pdfs?: TaxAccountPDF[] | null;
  roll_period?: string | null;
  data_date?: string | null;
}

export interface ScrapedMontrealData {
  matricule: string;
  identification: {
    address: string;
    arrondissement: string;
    lot_exclusif: string;
    lot_commun: string;
    usage_predominant: string;
    numero_unite_voisinage: string;
    numero_compte_foncier: string;
  };
  owner: {
    name: string;
    status: string;
    postal_address: string;
    registration_date: string;
    special_conditions: string;
  };
  land: {
    frontage: string;
    area: string;
  };
  building: {
    floors: string;
    year: string;
    floor_area: string;
    construction_type: string;
    physical_link: string;
    units: string;
    non_residential_spaces: string;
    rental_rooms: string;
  };
  valuation: {
    current: {
      market_date: string;
      land_value: string;
      building_value: string;
      total_value: string;
    };
    previous: {
      market_date: string;
      total_value: string;
    };
  };
  fiscal: {
    tax_category: string;
    taxable_value: string;
    non_taxable_value: string;
  };
  tax_pdfs: TaxAccountPDF[];
  metadata: {
    roll_period: string;
    data_date: string;
  };
  searchMethod: 'matricule' | 'address';
}
