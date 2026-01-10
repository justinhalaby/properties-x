// Metadata table interface for tracking Centris rental scraping
// Raw JSON data is stored in Supabase Storage (centris-raw bucket)
export interface CentrisRentalMetadata {
  // Primary identification
  id: string;
  centris_id: string; // e.g., "19013486"
  source_url: string;

  // Storage reference
  storage_path: string; // e.g., "2026/01/19013486.json"
  raw_data_size_bytes: number | null;

  // Scraping metadata
  scraped_at: string;
  scrape_status: 'success' | 'partial' | 'failed';
  scrape_error: string | null;
  scrape_duration_ms: number | null;

  // Quick preview (for listing without fetching storage)
  title_preview: string | null;
  price_preview: string | null;
  address_preview: string | null;

  // Transformation tracking
  transformation_status: 'pending' | 'success' | 'failed' | 'skipped';
  transformed_at: string | null;
  transformation_error: string | null;
  transformation_attempts: number;
  rental_id: string | null; // Links to rentals table

  // Timestamps
  created_at: string;
  updated_at: string;
}

// Raw data structure stored in Supabase Storage as JSON
// Location: centris-raw/{YYYY}/{MM}/{centris_id}.json
export interface CentrisRentalRaw {
  centris_id: string;
  source_url: string;
  scraped_at: string;
  scraper_version: string;
  raw_data: {
    // Basic info
    listing_id: string | null;
    property_type: string | null;
    address: string | null;

    // Price
    price: string | null; // Numeric value
    price_currency: string | null; // e.g., "CAD"
    price_display: string | null; // e.g., "1 900 $ /mois"

    // Coordinates (from structured data)
    latitude: string | null;
    longitude: string | null;

    // Room info
    rooms: string | null; // e.g., "3 pièces"
    bedrooms: string | null; // e.g., "1 chambre"
    bathrooms: string | null; // e.g., "1 salle de bain"

    // Characteristics (key-value pairs)
    characteristics: Record<string, string>;

    // Description
    description: string | null;

    // Walk Score
    walk_score: string | null;

    // Images
    images: string[]; // Standard resolution
    images_high_res: string[]; // High resolution versions

    // Brokers (multiple possible)
    brokers: Array<{
      name: string | null;
      title: string | null;
      phone: string | null;
      agency: string | null;
      photo: string | null;
      website: string | null;
    }>;
  };
  html_snippet?: string; // First 5000 chars for debugging
}

// Result of scraping (before saving to storage)
export interface CentrisScraperResult {
  centris_id: string;
  source_url: string;
  listing_id: string | null;
  property_type: string | null;
  address: string | null;
  price: string | null;
  price_currency: string | null;
  price_display: string | null;
  latitude: string | null;
  longitude: string | null;
  rooms: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  characteristics: Record<string, string>;
  description: string | null;
  walk_score: string | null;
  images: string[];
  images_high_res: string[];
  brokers: Array<{
    name: string | null;
    title: string | null;
    phone: string | null;
    agency: string | null;
    photo: string | null;
    website: string | null;
  }>;
  html_snippet?: string;
}
