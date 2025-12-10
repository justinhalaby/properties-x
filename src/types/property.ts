export interface Property {
  id: string;
  created_at: string;
  updated_at: string;
  source_url: string | null;
  source_name: string | null;
  title: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  lot_size: number | null;
  year_built: number | null;
  property_type: PropertyType | null;
  units: number | null; // Number of units for multi-residential
  unit_details: string | null; // Unit breakdown (e.g., "2 x 4½, 1 x 5½")
  mls_number: string | null;
  description: string | null;
  features: string[];
  images: string[];
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  // Financial fields
  potential_revenue: number | null; // Annual potential revenue
  // Évaluation municipale
  municipal_assessment: number | null; // Total
  assessment_land: number | null; // Terrain
  assessment_building: number | null; // Bâtiment
  // Taxes
  taxes: number | null; // Total annual taxes
  taxes_municipal: number | null; // Taxes municipales
  taxes_school: number | null; // Taxes scolaires
  // Expenses (Dépenses)
  expenses: number | null; // Total annual expenses
  expense_electricity: number | null; // Électricité
  expense_heating: number | null; // Mazout/Chauffage
}

export type PropertyType =
  | "single_family"
  | "condo"
  | "duplex"
  | "triplex"
  | "quadruplex"
  | "quintuplex"
  | "plex"
  | "multi_residential"
  | "land"
  | "commercial";

export type SourceName =
  | "centris"
  | "realtor"
  | "duproprio"
  | "remax"
  | "royallepage"
  | "manual"
  | "unknown";

export interface ScrapedProperty {
  source_url: string;
  source_name: SourceName;
  title: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  lot_size: number | null;
  year_built: number | null;
  property_type: PropertyType | null;
  units: number | null;
  unit_details: string | null;
  mls_number: string | null;
  description: string | null;
  features: string[];
  images: string[];
  // Financial fields
  potential_revenue: number | null;
  municipal_assessment: number | null;
  assessment_land: number | null;
  assessment_building: number | null;
  taxes: number | null;
  taxes_municipal: number | null;
  taxes_school: number | null;
  expenses: number | null;
  expense_electricity: number | null;
  expense_heating: number | null;
}

export interface PropertyFilters {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  propertyType?: PropertyType;
  search?: string;
}

export interface CreatePropertyInput {
  source_url?: string;
  source_name?: SourceName;
  title: string;
  address?: string;
  city?: string;
  postal_code?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  lot_size?: number;
  year_built?: number;
  property_type?: PropertyType;
  units?: number;
  unit_details?: string;
  mls_number?: string;
  description?: string;
  features?: string[];
  images?: string[];
  latitude?: number;
  longitude?: number;
  notes?: string;
  // Financial fields
  potential_revenue?: number;
  municipal_assessment?: number;
  assessment_land?: number;
  assessment_building?: number;
  taxes?: number;
  taxes_municipal?: number;
  taxes_school?: number;
  expenses?: number;
  expense_electricity?: number;
  expense_heating?: number;
}

export interface UpdatePropertyInput extends Partial<CreatePropertyInput> {
  id: string;
}
