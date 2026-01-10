/**
 * CentrisRentalCurated - Intermediate staging table for cleaned Centris data
 * This table stores parsed, cleaned Centris-specific fields before transformation to the generic rentals table
 */

export interface CentrisRentalCurated {
  id: string;
  centris_id: string;
  source_url: string;
  scraped_at: string;
  scraper_version: string | null;
  property_type: string | null;
  address: string | null;
  price: number | null;
  price_currency: string | null;
  price_display: string | null;
  latitude: number | null;
  longitude: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  year_of_construction: number | null;
  parking: number | null;
  image_urls: string[];
  description: string | null;
  walk_score: string | null;
  broker_name: string | null;
  broker_url: string | null;
  characteristics: Record<string, string>;
  raw_data_storage_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCentrisRentalCuratedInput {
  centris_id: string;
  source_url: string;
  scraped_at: string;
  scraper_version?: string;
  property_type?: string;
  address?: string;
  price?: number;
  price_currency?: string;
  price_display?: string;
  latitude?: number;
  longitude?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  square_footage?: number;
  year_of_construction?: number;
  parking?: number;
  image_urls?: string[];
  description?: string;
  walk_score?: string;
  broker_name?: string;
  broker_url?: string;
  characteristics?: Record<string, string>;
  raw_data_storage_path?: string;
}
