export interface FacebookRentalCurated {
  id: string;
  facebook_id: string;
  source_url: string;
  extracted_date: string;
  scraper_version: string | null;
  title: string;
  address: string | null;
  rental_location: string | null;
  city: string | null;
  postal_code: string | null;
  price: number | null;
  price_currency: string | null;
  price_display: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  unit_type: string | null;
  pet_policy: string[]; // JSONB array
  amenities: string[]; // JSONB array
  unit_details_raw: string[]; // JSONB array
  building_details: string[]; // JSONB array
  image_urls: string[];
  video_urls: string[];
  description: string | null;
  seller_name: string | null;
  seller_profile_url: string | null;
  raw_data_storage_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFacebookRentalCuratedInput {
  facebook_id: string;
  source_url: string;
  extracted_date: string;
  scraper_version?: string;
  title: string;
  address?: string;
  rental_location?: string;
  city?: string;
  postal_code?: string;
  price?: number;
  price_currency?: string;
  price_display?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_footage?: number;
  unit_type?: string;
  pet_policy?: string[];
  amenities?: string[];
  unit_details_raw?: string[];
  building_details?: string[];
  image_urls?: string[];
  video_urls?: string[];
  description?: string;
  seller_name?: string;
  seller_profile_url?: string;
  raw_data_storage_path?: string;
}
