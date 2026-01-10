import { FacebookRentalRaw } from '@/types/facebook-rental-raw';
import { CreateFacebookRentalCuratedInput } from '@/types/facebook-rental-curated';

/**
 * Transform raw FacebookRental JSON → FacebookRentalCurated
 * Stage 1 of the two-stage pipeline
 */
export function transformRawToCurated(
  raw: FacebookRentalRaw
): {
  curatedInput: CreateFacebookRentalCuratedInput;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  const rawData = raw.raw_data;

  // Validate required fields
  if (!rawData.title) {
    errors.push('Title is required');
  }

  // Parse price
  const price = parseRentPrice(rawData.price);
  if (!price && rawData.price) {
    warnings.push(`Could not parse price: ${rawData.price}`);
  }

  // Parse bedrooms/bathrooms
  const { bedrooms, bathrooms } = parseBedroomsBathrooms(rawData.unitDetails);

  // Parse square footage
  const squareFootage = parseSquareFootage(rawData.unitDetails);

  // Parse location
  const { city, postalCode } = parseLocation(rawData.rentalLocation);

  // Categorize unit details
  const { unitType, petPolicy, amenities } = categorizeUnitDetails(rawData.unitDetails);

  const curatedInput: CreateFacebookRentalCuratedInput = {
    facebook_id: raw.facebook_id,
    source_url: raw.source_url,
    extracted_date: raw.extracted_date,
    scraper_version: raw.scraper_version,
    title: rawData.title,
    address: rawData.address || undefined,
    rental_location: rawData.rentalLocation || undefined,
    city,
    postal_code: postalCode,
    price,
    price_currency: 'CAD',
    price_display: rawData.price || undefined,
    bedrooms,
    bathrooms,
    square_footage: squareFootage,
    unit_type: unitType,
    pet_policy: petPolicy,
    amenities,
    unit_details_raw: rawData.unitDetails,
    building_details: rawData.buildingDetails,
    image_urls: rawData.media.images,
    video_urls: rawData.media.videos,
    description: rawData.description || undefined,
    seller_name: rawData.sellerInfo.name || undefined,
    seller_profile_url: rawData.sellerInfo.profileUrl || undefined,
  };

  return { curatedInput, warnings, errors };
}

/**
 * Extract numeric rent from "CA$2,175 / Month" format
 */
function parseRentPrice(priceString: string): number | undefined {
  if (!priceString) return undefined;

  // Remove currency symbols, commas, and extract number
  const match = priceString.match(/[\d,]+/);
  if (!match) {
    return undefined;
  }

  const cleaned = match[0].replace(/,/g, '');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

/**
 * Extract bedrooms/bathrooms from unitDetails array
 * Looks for patterns like "2 beds · 1 bath" or "3 bed" or "1.5 bath"
 */
function parseBedroomsBathrooms(
  unitDetails: string[]
): { bedrooms?: number; bathrooms?: number } {
  let bedrooms: number | undefined;
  let bathrooms: number | undefined;

  for (const detail of unitDetails) {
    const lower = detail.toLowerCase();

    // Match "X beds" or "X bed"
    const bedMatch = lower.match(/(\d+)\s*beds?\b/);
    if (bedMatch && !bedrooms) {
      bedrooms = parseInt(bedMatch[1]);
    }

    // Match "X baths" or "X bath" or "X.X bath"
    const bathMatch = lower.match(/(\d+(?:\.\d+)?)\s*baths?\b/);
    if (bathMatch && !bathrooms) {
      bathrooms = parseFloat(bathMatch[1]);
    }
  }

  return { bedrooms, bathrooms };
}

/**
 * Extract square footage from unitDetails array
 * Looks for patterns like "800 square feet" or "1200 sq ft"
 */
function parseSquareFootage(unitDetails: string[]): number | undefined {
  for (const detail of unitDetails) {
    const lower = detail.toLowerCase();

    // Match "X square feet" or "X sq ft" or "X sq. ft."
    const match = lower.match(/(\d+(?:,\d+)?)\s*(?:square\s*feet|sq\.?\s*ft\.?)/);
    if (match) {
      const cleaned = match[1].replace(/,/g, '');
      const parsed = parseInt(cleaned, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

/**
 * Parse location string "Montréal, QC, H2S 2Z5" into components
 */
function parseLocation(
  location: string
): { city?: string; postalCode?: string } {
  if (!location) return {};

  const parts = location.split(',').map(p => p.trim());

  // Last part might be postal code (Canadian format: A1A 1A1)
  const postalCodeMatch = parts[parts.length - 1]?.match(/[A-Z]\d[A-Z]\s*\d[A-Z]\d/i);
  const postalCode = postalCodeMatch ? postalCodeMatch[0].toUpperCase() : undefined;

  // First part is typically the city
  const city = parts[0] || undefined;

  return { city, postalCode };
}

/**
 * Categorize unit details into structured fields
 */
function categorizeUnitDetails(unitDetails: string[]): {
  unitType?: string;
  petPolicy: string[];
  amenities: string[];
} {
  const petPolicy: string[] = [];
  const amenities: string[] = [];
  let unitType: string | undefined;

  // Known unit types
  const unitTypes = ['apartment', 'house', 'condo', 'townhouse', 'studio', 'loft'];

  // Known pet policies
  const petPolicies = ['cat friendly', 'dog friendly', 'cats ok', 'dogs ok', 'pet friendly'];

  for (const detail of unitDetails) {
    const lower = detail.toLowerCase();

    // Check for unit type
    const matchedType = unitTypes.find(type => lower.includes(type));
    if (matchedType && !unitType) {
      unitType = matchedType;
      continue;
    }

    // Check for pet policy
    const matchedPet = petPolicies.find(policy => lower.includes(policy));
    if (matchedPet) {
      // Normalize to snake_case
      if (lower.includes('cat')) petPolicy.push('cat_friendly');
      if (lower.includes('dog')) petPolicy.push('dog_friendly');
      continue;
    }

    // Skip bedroom/bathroom/square footage info (already parsed separately)
    if (lower.includes('bed') || lower.includes('bath') || lower.match(/square\s*feet|sq\.?\s*ft\.?/)) {
      continue;
    }

    // Everything else goes to amenities
    amenities.push(detail);
  }

  return {
    unitType,
    petPolicy: [...new Set(petPolicy)], // Remove duplicates
    amenities,
  };
}
