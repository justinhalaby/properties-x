// Types for Quebec business registry company information
// Related to tables: companies, company_shareholders, company_administrators, property_company_links

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface Company {
  id: string;
  created_at: string;
  updated_at: string;
  neq: string;
  company_name: string;
  company_status: string | null;
  domicile_address: string | null;
  domicile_street_number: string | null;
  domicile_street_name: string | null;
  domicile_city: string | null;
  domicile_province: string | null;
  domicile_postal_code: string | null;
  registration_date: string | null;
  status_date: string | null;
  cae_code: string | null;
  cae_description: string | null;
  source_url: string | null;
  scraped_at: string;
  last_verified_at: string | null;
}

export interface CompanyShareholder {
  id: string;
  created_at: string;
  updated_at: string;
  company_id: string;
  shareholder_name: string;
  shareholder_type: 'individual' | 'corporate' | null;
  shareholder_neq: string | null;
  position: number | null;
  is_majority_shareholder: boolean;
  address: string | null;
  street_number: string | null;
  street_name: string | null;
  unit: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  address_publishable: boolean;
  scraped_at: string;
}

export interface CompanyAdministrator {
  id: string;
  created_at: string;
  updated_at: string;
  company_id: string;
  administrator_name: string;
  position_title: string | null;
  position_order: number | null;
  // Domicile address (home address, often "non publiable")
  domicile_address: string | null;
  domicile_street_number: string | null;
  domicile_street_name: string | null;
  domicile_unit: string | null;
  domicile_city: string | null;
  domicile_province: string | null;
  domicile_postal_code: string | null;
  domicile_address_publishable: boolean;
  // Professional address
  professional_address: string | null;
  professional_street_number: string | null;
  professional_street_name: string | null;
  professional_unit: string | null;
  professional_city: string | null;
  professional_province: string | null;
  professional_postal_code: string | null;
  address_publishable: boolean;
  scraped_at: string;
}

export interface PropertyCompanyLink {
  id: string;
  created_at: string;
  matricule: string;
  company_id: string;
  link_confidence: 'exact' | 'fuzzy' | 'manual' | null;
  link_method: 'owner_name_match' | 'manual_addition' | 'auto_detection' | null;
  verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  notes: string | null;
}

// Extended type with relationships
export interface CompanyWithRelations extends Company {
  shareholders: CompanyShareholder[];
  administrators: CompanyAdministrator[];
  property_links?: PropertyCompanyLink[];
}

// ============================================================================
// SCRAPER TYPES
// ============================================================================

export interface QuebecCompanyScrapeOptions {
  searchType: 'neq' | 'name';
  neq?: string;
  companyName?: string;
}

export interface ScrapedShareholderData {
  name: string;
  address: string;
  is_majority: boolean;
  position: number; // 1 = Premier, 2 = Deuxième, etc.
}

export interface ScrapedAdministratorData {
  name: string;
  position_title: string;
  domicile_address: string; // Home address (often "Adresse non publiable")
  professional_address: string; // Business address
  position_order: number;
}

export interface ScrapedCompanyData {
  neq: string;
  identification: {
    name: string;
    status: string;
    domicile_address: string;
    registration_date: string;
    status_date?: string;
  };
  shareholders: ScrapedShareholderData[];
  administrators: ScrapedAdministratorData[];
  economic_activity: {
    cae_code: string;
    cae_description: string;
  };
  source_url: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface ParsedAddress {
  full_address: string;
  street_number: string | null;
  street_name: string | null;
  unit: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  publishable: boolean;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CompanySearchRequest {
  searchType: 'neq' | 'name';
  neq?: string;
  companyName?: string;
}

export interface CompanySearchResponse {
  success: boolean;
  data: ScrapedCompanyData | Company;
  companyId: string;
  fromCache: boolean;
  message?: string;
}

export interface CompanyGetResponse {
  data: CompanyWithRelations;
}

export interface PropertyLinkRequest {
  matricule: string;
  companyId: string;
  linkMethod?: 'manual_addition' | 'owner_name_match' | 'auto_detection';
  linkConfidence?: 'exact' | 'fuzzy' | 'manual';
  notes?: string;
}

export interface PropertyLinkResponse {
  data: PropertyCompanyLink;
}

// ============================================================================
// DATABASE INSERT TYPES
// ============================================================================

export interface CompanyInsert {
  neq: string;
  company_name: string;
  company_status?: string | null;
  domicile_address?: string | null;
  domicile_street_number?: string | null;
  domicile_street_name?: string | null;
  domicile_city?: string | null;
  domicile_province?: string | null;
  domicile_postal_code?: string | null;
  registration_date?: string | null;
  status_date?: string | null;
  cae_code?: string | null;
  cae_description?: string | null;
  source_url?: string | null;
}

export interface ShareholderInsert {
  company_id: string;
  shareholder_name: string;
  shareholder_type?: 'individual' | 'corporate' | null;
  shareholder_neq?: string | null;
  position?: number | null;
  is_majority_shareholder?: boolean;
  address?: string | null;
  street_number?: string | null;
  street_name?: string | null;
  unit?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  address_publishable?: boolean;
}

export interface AdministratorInsert {
  company_id: string;
  administrator_name: string;
  position_title?: string | null;
  position_order?: number | null;
  // Domicile address
  domicile_address?: string | null;
  domicile_street_number?: string | null;
  domicile_street_name?: string | null;
  domicile_unit?: string | null;
  domicile_city?: string | null;
  domicile_province?: string | null;
  domicile_postal_code?: string | null;
  domicile_address_publishable?: boolean;
  // Professional address
  professional_address?: string | null;
  professional_street_number?: string | null;
  professional_street_name?: string | null;
  professional_unit?: string | null;
  professional_city?: string | null;
  professional_province?: string | null;
  professional_postal_code?: string | null;
  address_publishable?: boolean;
}

// ============================================================================
// BOOKMARKLET TYPES
// ============================================================================

export interface BookmarkletApiRequest {
  scrapedData: ScrapedCompanyData;
}

export interface BookmarkletApiResponse {
  success: boolean;
  companyId?: string;
  message: string;
  fromCache?: boolean;
  error?: string;
}
