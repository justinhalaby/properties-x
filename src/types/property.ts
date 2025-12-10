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
  mls_number: string | null;
  description: string | null;
  features: string[];
  images: string[];
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
}

export type PropertyType =
  | "single_family"
  | "condo"
  | "duplex"
  | "triplex"
  | "plex"
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
  mls_number: string | null;
  description: string | null;
  features: string[];
  images: string[];
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
  mls_number?: string;
  description?: string;
  features?: string[];
  images?: string[];
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface UpdatePropertyInput extends Partial<CreatePropertyInput> {
  id: string;
}
