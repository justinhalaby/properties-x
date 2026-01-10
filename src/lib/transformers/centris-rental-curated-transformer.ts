import type { CentrisRentalRaw } from '@/types/centris-rental-raw';
import type { CreateCentrisRentalCuratedInput } from '@/types/centris-rental-curated';

export interface CuratedTransformResult {
  curatedInput: CreateCentrisRentalCuratedInput;
  warnings: string[];
  errors: string[];
}

/**
 * Transform raw Centris data to curated format
 * Parses French text and extracts structured, cleaned data
 */
export function transformRawToCurated(
  raw: CentrisRentalRaw
): CuratedTransformResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const rawData = raw.raw_data;

  // Parse numeric price
  const price = parsePrice(rawData.price);
  if (!price && rawData.price) {
    warnings.push(`Could not parse price from: ${rawData.price}`);
  }

  // Parse room counts
  const rooms = parseRooms(rawData.rooms);
  if (!rooms && rawData.rooms) {
    warnings.push(`Could not parse rooms from: ${rawData.rooms}`);
  }

  const bedrooms = parseBedrooms(rawData.bedrooms);
  if (!bedrooms && rawData.bedrooms) {
    warnings.push(`Could not parse bedrooms from: ${rawData.bedrooms}`);
  }

  const bathrooms = parseBathrooms(rawData.bathrooms);
  if (!bathrooms && rawData.bathrooms) {
    warnings.push(`Could not parse bathrooms from: ${rawData.bathrooms}`);
  }

  // Parse coordinates
  const latitude = rawData.latitude ? parseFloat(rawData.latitude) : null;
  const longitude = rawData.longitude ? parseFloat(rawData.longitude) : null;

  // Extract image URLs (prefer high res if available)
  const image_urls = extractImageUrls(raw);

  // Extract and parse characteristics
  const {
    square_footage,
    year_of_construction,
    parking,
    remaining,
  } = extractCharacteristics(rawData.characteristics, warnings);

  // Get first broker
  const firstBroker = rawData.brokers[0];

  return {
    curatedInput: {
      centris_id: raw.centris_id,
      source_url: raw.source_url,
      scraped_at: raw.scraped_at,
      scraper_version: raw.scraper_version,

      // Property
      property_type: rawData.property_type,
      address: rawData.address,

      // Price
      price,
      price_currency: rawData.price_currency || 'CAD',
      price_display: rawData.price_display,

      // Location
      latitude,
      longitude,

      // Rooms
      rooms,
      bedrooms,
      bathrooms,

      // Extracted characteristics
      square_footage,
      year_of_construction,
      parking,

      // Media
      image_urls,

      // Other
      description: rawData.description,
      walk_score: rawData.walk_score,

      // Broker (first only)
      broker_name: firstBroker?.name || null,
      broker_url: firstBroker?.website || null,

      // Remaining characteristics
      characteristics: remaining,
    },
    warnings,
    errors,
  };
}

/**
 * Parse numeric price from string
 * Example: "1900" → 1900, "1 900" → 1900
 */
function parsePrice(price: string | null): number | null {
  if (!price) return null;

  // Remove spaces and non-numeric characters except decimal point
  const numberStr = price.replace(/[^\d.]/g, '');
  const parsed = parseFloat(numberStr);

  return isNaN(parsed) || parsed <= 0 ? null : parsed;
}

/**
 * Parse rooms from French text
 * Example: "3 pièces" → 3, "4½ pièces" → 4
 */
function parseRooms(rooms: string | null): number | null {
  if (!rooms) return null;

  const match = rooms.match(/(\d+)/);
  if (!match) return null;

  const parsed = parseInt(match[1]);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse bedrooms from French text
 * Example: "1 chambre" → 1, "2 chambres" → 2
 */
function parseBedrooms(bedrooms: string | null): number | null {
  if (!bedrooms) return null;

  const match = bedrooms.match(/(\d+)/);
  if (!match) return null;

  const parsed = parseInt(match[1]);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse bathrooms from French text
 * Example: "1 salle de bain" → 1, "1.5 salle de bain" → 1.5, "2 salles de bain" → 2
 */
function parseBathrooms(bathrooms: string | null): number | null {
  if (!bathrooms) return null;

  // Match integers or decimals (1, 1.5, 2, etc.)
  const match = bathrooms.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const parsed = parseFloat(match[1]);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Extract image URLs from raw data
 * Prefer high-res images if available, otherwise use standard
 */
function extractImageUrls(raw: CentrisRentalRaw): string[] {
  const rawData = raw.raw_data;

  // Use high-res images if available, otherwise standard
  if (rawData.images_high_res && rawData.images_high_res.length > 0) {
    return rawData.images_high_res;
  }

  return rawData.images || [];
}

/**
 * Extract and parse specific characteristics, return remaining ones
 */
function extractCharacteristics(
  characteristics: Record<string, string>,
  warnings: string[]
): {
  square_footage: number | null;
  year_of_construction: number | null;
  parking: number | null;
  remaining: Record<string, string>;
} {
  let square_footage: number | null = null;
  let year_of_construction: number | null = null;
  let parking: number | null = null;
  const remaining: Record<string, string> = {};

  // Keys to extract
  const extractedKeys = new Set<string>();

  for (const [key, value] of Object.entries(characteristics)) {
    // Square footage (Superficie)
    if (key === 'Superficie' || key.toLowerCase().includes('superficie')) {
      square_footage = parseSquareFootage(value);
      if (!square_footage && value) {
        warnings.push(`Could not parse square footage from: ${value}`);
      }
      extractedKeys.add(key);
      continue;
    }

    // Year of construction
    if (
      key === 'Année de construction' ||
      key.toLowerCase().includes('année') ||
      key.toLowerCase().includes('construction')
    ) {
      year_of_construction = parseYearOfConstruction(value);
      if (!year_of_construction && value) {
        warnings.push(`Could not parse year of construction from: ${value}`);
      }
      extractedKeys.add(key);
      continue;
    }

    // Parking
    if (key === 'Stationnement' || key.toLowerCase().includes('stationnement')) {
      parking = parseParking(value);
      // Don't warn if parking is null - it might be descriptive text
      extractedKeys.add(key);
      continue;
    }

    // All other characteristics go into remaining
    remaining[key] = value;
  }

  return {
    square_footage,
    year_of_construction,
    parking,
    remaining,
  };
}

/**
 * Parse square footage and convert sq m to sq ft
 * Example: "500 sq ft" → 500, "46 sq m" → 495, "46 m²" → 495
 */
function parseSquareFootage(superficie: string): number | null {
  if (!superficie) return null;

  // Extract numeric value
  const match = superficie.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (isNaN(value)) return null;

  // Check if it's in square meters and convert to square feet
  const lowerText = superficie.toLowerCase();
  if (lowerText.includes('sq m') || lowerText.includes('m²') || lowerText.includes('m2')) {
    // Convert sq m to sq ft (1 sq m = 10.764 sq ft)
    return Math.round(value * 10.764);
  }

  // Otherwise assume it's already in sq ft
  return Math.round(value);
}

/**
 * Parse year of construction
 * Example: "2015" → 2015, "Année de construction: 2015" → 2015
 */
function parseYearOfConstruction(year: string): number | null {
  if (!year) return null;

  // Extract 4-digit year
  const match = year.match(/\b(19\d{2}|20\d{2})\b/);
  if (!match) return null;

  const parsed = parseInt(match[1]);

  // Validate year range (1600 to 2100)
  if (isNaN(parsed) || parsed < 1600 || parsed > 2100) {
    return null;
  }

  return parsed;
}

/**
 * Parse parking count from text
 * Example: "1 espace" → 1, "2 espaces" → 2, "Intérieur" → NULL
 */
function parseParking(parking: string): number | null {
  if (!parking) return null;

  // Try to extract a number
  const match = parking.match(/(\d+)/);
  if (!match) return null; // Descriptive text like "Intérieur"

  const parsed = parseInt(match[1]);
  return isNaN(parsed) ? null : parsed;
}
