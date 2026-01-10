// Full database record
export interface Rental {
  id: string;
  created_at: string;
  updated_at: string;
  source_url: string | null;
  source_name: string | null;
  facebook_id: string | null;
  centris_id: string | null; // Centris listing ID for linking to raw data
  raw_data_storage_path: string | null; // Path to raw JSON in storage bucket
  extracted_date: string | null;
  title: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  rental_location: string | null;
  monthly_rent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  unit_type: string | null;
  pet_policy: string[];
  amenities: string[];
  unit_details_raw: string[];
  building_details: string[];
  description: string | null;
  seller_name: string | null;
  seller_profile_url: string | null;
  images: string[]; // Supabase Storage paths (e.g., ["facebook/uuid/image-0.jpg"])
  videos: string[]; // Supabase Storage paths (e.g., ["facebook/uuid/video-0.mp4"])
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
  notes: string | null;
}

// Facebook Marketplace JSON format (source-specific)
// NOTE: Future sources (Kijiji, Craigslist) will have their own interfaces
export interface FacebookRental {
  extractedDate: string;
  id: string;
  url: string;
  title: string;
  price: string; // "CA$2,175 / Month"
  address: string;
  buildingDetails: string[];
  unitDetails: string[];
  rentalLocation: string; // "Montréal, QC, H2S 2Z5"
  description: string;
  sellerInfo: {
    name: string;
    profileUrl: string;
  };
  media: {
    images: string[];
    videos: string[];
  };
}

// API input format
export interface CreateRentalInput {
  source_url?: string;
  source_name?: string;
  facebook_id?: string;
  centris_id?: string;
  extracted_date?: string;
  title: string;
  address?: string;
  city?: string;
  postal_code?: string;
  rental_location?: string;
  monthly_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  square_footage?: number;
  unit_type?: string;
  pet_policy?: string[];
  amenities?: string[];
  unit_details_raw?: string[];
  building_details?: string[];
  description?: string;
  seller_name?: string;
  seller_profile_url?: string;
  images?: string[];
  videos?: string[];
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface UpdateRentalInput extends Partial<CreateRentalInput> {
  id: string;
}

export interface RentalFilters {
  city?: string;
  minRent?: number;
  maxRent?: number;
  bedrooms?: number;
  petFriendly?: boolean;
  search?: string;
}

// Result of parsing Facebook JSON
export interface ParsedFacebookRental {
  input: CreateRentalInput;
  warnings: string[];
  errors: string[];
}
