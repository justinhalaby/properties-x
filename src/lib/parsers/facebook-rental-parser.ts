import type { FacebookRental, CreateRentalInput, ParsedFacebookRental } from '@/types/rental';
import type { FacebookRentalRaw } from '@/types/facebook-rental-raw';

/**
 * Unwrap FacebookRentalRaw format to FacebookRental format
 * Handles both new (wrapped) and old (flat) formats
 */
function unwrapFacebookRentalJson(data: any): FacebookRental {
  // Check if it's the new format (with facebook_id and raw_data wrapper)
  const isNewFormat = 'facebook_id' in data && 'raw_data' in data;

  if (isNewFormat) {
    const wrapped = data as FacebookRentalRaw;
    // Return the raw_data content as FacebookRental
    return wrapped.raw_data as FacebookRental;
  }

  // Already in flat format
  return data as FacebookRental;
}

/**
 * Parses Facebook Marketplace rental JSON into database format
 */
export function parseFacebookRental(json: FacebookRental | FacebookRentalRaw): ParsedFacebookRental {
  // Unwrap if needed
  const rental = unwrapFacebookRentalJson(json);
  const warnings: string[] = [];
  const errors: string[] = [];

  // Parse monthly rent from "CA$2,175 / Month"
  const monthlyRent = parseRentPrice(rental.price, warnings);

  // Parse bedrooms and bathrooms from unitDetails
  const { bedrooms, bathrooms } = parseBedroomsBathrooms(rental.unitDetails, warnings);

  // Parse location components from "Montréal, QC, H2S 2Z5"
  const { city, postalCode } = parseLocation(rental.rentalLocation, warnings);

  // Categorize unit details into structured fields
  const { unitType, petPolicy, amenities } = categorizeUnitDetails(rental.unitDetails);

  // Build the input object
  const input: CreateRentalInput = {
    source_url: rental.url,
    source_name: 'facebook_marketplace',
    facebook_id: rental.id,
    extracted_date: rental.extractedDate,
    title: rental.title,
    address: rental.address || undefined,
    city: city,
    postal_code: postalCode,
    rental_location: rental.rentalLocation,
    monthly_rent: monthlyRent,
    bedrooms: bedrooms,
    bathrooms: bathrooms,
    unit_type: unitType,
    pet_policy: petPolicy,
    amenities: amenities,
    unit_details_raw: rental.unitDetails,
    building_details: rental.buildingDetails,
    description: rental.description || undefined,
    seller_name: rental.sellerInfo?.name || undefined,
    seller_profile_url: rental.sellerInfo?.profileUrl || undefined,
    // Images and videos will be processed separately after rental creation
    images: [],
    videos: [],
  };

  // Validation
  if (!input.title) {
    errors.push('Title is required');
  }
  if (!input.facebook_id) {
    warnings.push('No Facebook ID found - duplicate detection disabled');
  }

  return { input, warnings, errors };
}

/**
 * Extract numeric rent from "CA$2,175 / Month" format
 */
function parseRentPrice(priceString: string, warnings: string[]): number | undefined {
  if (!priceString) return undefined;

  // Remove currency symbols, commas, and extract number
  const match = priceString.match(/[\d,]+/);
  if (!match) {
    warnings.push(`Could not parse rent price: "${priceString}"`);
    return undefined;
  }

  const cleaned = match[0].replace(/,/g, '');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    warnings.push(`Invalid rent price: "${priceString}"`);
    return undefined;
  }

  return parsed;
}

/**
 * Extract bedrooms/bathrooms from unitDetails array
 * Looks for patterns like "2 beds · 1 bath" or "3 bed" or "1.5 bath"
 */
function parseBedroomsBathrooms(
  unitDetails: string[],
  warnings: string[]
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

  if (!bedrooms) {
    warnings.push('Could not extract bedroom count from unit details');
  }
  if (!bathrooms) {
    warnings.push('Could not extract bathroom count from unit details');
  }

  return { bedrooms, bathrooms };
}

/**
 * Parse location string "Montréal, QC, H2S 2Z5" into components
 */
function parseLocation(
  location: string,
  warnings: string[]
): { city?: string; postalCode?: string } {
  if (!location) return {};

  const parts = location.split(',').map(p => p.trim());

  // Last part might be postal code (Canadian format: A1A 1A1)
  const postalCodeMatch = parts[parts.length - 1]?.match(/[A-Z]\d[A-Z]\s*\d[A-Z]\d/i);
  const postalCode = postalCodeMatch ? postalCodeMatch[0].toUpperCase() : undefined;

  // First part is typically the city
  const city = parts[0] || undefined;

  if (!city) {
    warnings.push('Could not parse city from rental location');
  }

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

    // Skip bedroom/bathroom info (already parsed separately)
    if (lower.includes('bed') || lower.includes('bath')) {
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

/**
 * Validate JSON structure before parsing
 * Supports both old flat format and new FacebookRentalRaw format
 */
export function validateFacebookRentalJson(data: unknown): data is FacebookRental {
  if (typeof data !== 'object' || data === null) return false;

  const obj = data as Record<string, unknown>;

  // Check if it's the new format (with facebook_id and raw_data wrapper)
  const isNewFormat = 'facebook_id' in obj && 'raw_data' in obj;

  if (isNewFormat) {
    // Validate new format structure
    if (typeof obj.raw_data !== 'object' || obj.raw_data === null) return false;

    const rawData = obj.raw_data as Record<string, unknown>;

    // Required fields in raw_data
    if (typeof rawData.title !== 'string') return false;
    if (typeof rawData.price !== 'string') return false;

    // Optional but structured fields
    if (rawData.unitDetails && !Array.isArray(rawData.unitDetails)) return false;
    if (rawData.buildingDetails && !Array.isArray(rawData.buildingDetails)) return false;

    return true;
  }

  // Validate old flat format
  // Required fields
  if (typeof obj.title !== 'string') return false;
  if (typeof obj.price !== 'string') return false;

  // Optional but structured fields
  if (obj.unitDetails && !Array.isArray(obj.unitDetails)) return false;
  if (obj.buildingDetails && !Array.isArray(obj.buildingDetails)) return false;

  return true;
}
