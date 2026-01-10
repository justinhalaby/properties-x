import type { CentrisRentalRaw } from '@/types/centris-rental-raw';
import type { CreateRentalInput } from '@/types/rental';

export interface TransformResult {
  rentalInput: CreateRentalInput;
  warnings: string[];
  errors: string[];
}

/**
 * Transform raw Centris data to standard rental format
 * Parses French text and extracts structured data
 */
export function transformCentrisRawToRental(
  raw: CentrisRentalRaw
): TransformResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Required fields
  const title = raw.raw_data.property_type || 'Rental';

  // Parse numeric fields
  const monthly_rent = parseMonthlyRent(raw.raw_data.price);
  if (!monthly_rent && raw.raw_data.price) {
    warnings.push('Could not parse monthly rent from: ' + raw.raw_data.price);
  }

  const bedrooms = parseBedrooms(raw.raw_data.bedrooms);
  if (!bedrooms && raw.raw_data.bedrooms) {
    warnings.push('Could not parse bedrooms from: ' + raw.raw_data.bedrooms);
  }

  const bathrooms = parseBathrooms(raw.raw_data.bathrooms);
  if (!bathrooms && raw.raw_data.bathrooms) {
    warnings.push('Could not parse bathrooms from: ' + raw.raw_data.bathrooms);
  }

  // Parse coordinates if available
  const latitude = raw.raw_data.latitude ? parseFloat(raw.raw_data.latitude) : null;
  const longitude = raw.raw_data.longitude ? parseFloat(raw.raw_data.longitude) : null;

  // Extract city from address
  const { city, borough } = parseCityFromAddress(raw.raw_data.address);

  return {
    rentalInput: {
      source_name: 'centris',
      source_url: raw.source_url,
      centris_id: raw.centris_id,
      extracted_date: raw.scraped_at,

      // Core fields
      title,
      address: raw.raw_data.address,
      city,
      postal_code: null, // Will be geocoded or from characteristics
      rental_location: borough,

      // Numeric fields
      monthly_rent,
      bedrooms,
      bathrooms,

      // Property type
      unit_type: inferUnitType(raw.raw_data.property_type),

      // Policies and amenities
      pet_policy: extractPetPolicy(raw.raw_data.characteristics),
      amenities: extractAmenities(raw.raw_data.characteristics),

      // Details
      unit_details_raw: buildUnitDetails(raw.raw_data),
      building_details: extractBuildingDetails(raw.raw_data.characteristics),
      description: raw.raw_data.description,

      // Seller (first broker)
      seller_name: raw.raw_data.brokers[0]?.name || null,
      seller_profile_url: raw.raw_data.brokers[0]?.website || null,

      // Coordinates (already have from structured data!)
      latitude,
      longitude,

      // Notes
      notes: buildNotes(raw.raw_data),
    },
    warnings,
    errors,
  };
}

/**
 * Parse monthly rent - could be numeric string or price display
 */
function parseMonthlyRent(price: string | null): number | null {
  if (!price) return null;

  // Remove spaces and non-numeric characters except digits
  const numberStr = price.replace(/[^\d]/g, '');
  const parsed = parseInt(numberStr);

  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse bedrooms from French text
 * Example: "1 chambre" → 1, "2 chambres" → 2
 */
function parseBedrooms(bedroomsRaw: string | null): number | null {
  if (!bedroomsRaw) return null;

  const match = bedroomsRaw.match(/(\d+)/);
  if (!match) return null;

  const parsed = parseInt(match[1]);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse bathrooms from French text
 * Example: "1 salle de bain" → 1, "2 salles de bain" → 2
 */
function parseBathrooms(bathroomsRaw: string | null): number | null {
  if (!bathroomsRaw) return null;

  const match = bathroomsRaw.match(/(\d+)/);
  if (!match) return null;

  const parsed = parseInt(match[1]);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse city and borough from address
 * Example: "123 rue Example, Montréal (Ville-Marie), QC" → { city: "Montreal", borough: "Ville-Marie" }
 */
function parseCityFromAddress(address: string | null): { city: string; borough: string | null } {
  if (!address) {
    return { city: 'Montreal', borough: null };
  }

  // Extract borough from parentheses
  const boroughMatch = address.match(/Montréal\s*\(([^)]+)\)/i);
  if (boroughMatch) {
    return {
      city: 'Montreal',
      borough: boroughMatch[1],
    };
  }

  // Check if address contains Montreal/Montréal
  if (address.match(/montr[ée]al/i)) {
    return {
      city: 'Montreal',
      borough: null,
    };
  }

  return {
    city: 'Montreal', // Default
    borough: null,
  };
}

/**
 * Infer unit type from property type
 */
function inferUnitType(propertyType: string | null): string | null {
  if (!propertyType) return 'apartment';

  const lower = propertyType.toLowerCase();

  if (lower.includes('condo') || lower.includes('appartement')) {
    return 'apartment';
  }

  if (lower.includes('maison') || lower.includes('house')) {
    return 'house';
  }

  if (lower.includes('studio')) {
    return 'studio';
  }

  if (lower.includes('loft')) {
    return 'loft';
  }

  return 'apartment'; // Default
}

/**
 * Extract pet policy from characteristics
 */
function extractPetPolicy(characteristics: Record<string, string>): string[] {
  const policy: string[] = [];

  // Join all values to search
  const text = Object.entries(characteristics)
    .map(([key, value]) => `${key} ${value}`)
    .join(' ')
    .toLowerCase();

  if (text.includes('animaux acceptés') || text.includes('pets allowed') || text.includes('pet friendly')) {
    policy.push('pets_allowed');
  }

  if (text.includes('chat') || text.includes('cat')) {
    policy.push('cat_friendly');
  }

  if (text.includes('chien') || text.includes('dog')) {
    policy.push('dog_friendly');
  }

  return policy;
}

/**
 * Extract and translate amenities from characteristics
 */
function extractAmenities(characteristics: Record<string, string>): string[] {
  const amenities: string[] = [];

  const translations: Record<string, string> = {
    'ascenseur': 'elevator',
    'balcon': 'balcony',
    'piscine': 'pool',
    'gym': 'gym',
    'salle d\'entraînement': 'gym',
    'terrasse': 'terrace',
    'stationnement': 'parking',
    'garage': 'garage',
    'laveuse': 'washer',
    'sécheuse': 'dryer',
    'lave-vaisselle': 'dishwasher',
    'climatisation': 'air_conditioning',
    'chauffage': 'heating',
    'meublé': 'furnished',
  };

  // Search through all characteristics
  for (const [key, value] of Object.entries(characteristics)) {
    const combined = `${key} ${value}`.toLowerCase();

    for (const [french, english] of Object.entries(translations)) {
      if (combined.includes(french)) {
        if (!amenities.includes(english)) {
          amenities.push(english);
        }
      }
    }
  }

  return amenities;
}

/**
 * Build unit details array from raw data
 */
function buildUnitDetails(rawData: CentrisRentalRaw['raw_data']): string[] {
  const details: string[] = [];

  if (rawData.rooms) {
    details.push(rawData.rooms);
  }

  // Add any relevant characteristics
  if (rawData.characteristics['Superficie']) {
    details.push(rawData.characteristics['Superficie']);
  }

  if (rawData.characteristics['Stationnement']) {
    details.push('Stationnement: ' + rawData.characteristics['Stationnement']);
  }

  if (rawData.characteristics['Disponibilité']) {
    details.push('Disponible: ' + rawData.characteristics['Disponibilité']);
  }

  return details;
}

/**
 * Extract building-level details from characteristics
 */
function extractBuildingDetails(characteristics: Record<string, string>): string[] {
  const details: string[] = [];

  // Building-related characteristics
  const buildingKeys = [
    'Type de bâtiment',
    'Année de construction',
    'Nombre d\'étages',
    'Nombre de logements',
  ];

  for (const key of buildingKeys) {
    if (characteristics[key]) {
      details.push(`${key}: ${characteristics[key]}`);
    }
  }

  return details;
}

/**
 * Build notes field with additional info
 */
function buildNotes(rawData: CentrisRentalRaw['raw_data']): string | null {
  const notes: string[] = [];

  // Add all broker information
  if (rawData.brokers.length > 0) {
    notes.push('=== Courtiers ===');
    rawData.brokers.forEach((broker, index) => {
      notes.push(`Courtier ${index + 1}:`);
      if (broker.name) notes.push(`  Nom: ${broker.name}`);
      if (broker.title) notes.push(`  Titre: ${broker.title}`);
      if (broker.agency) notes.push(`  Agence: ${broker.agency}`);
      if (broker.phone) notes.push(`  Téléphone: ${broker.phone}`);
      if (broker.website) notes.push(`  Site web: ${broker.website}`);
      notes.push('');
    });
  }

  // Add Walk Score if available
  if (rawData.walk_score) {
    notes.push(`Walk Score: ${rawData.walk_score}`);
    notes.push('');
  }

  // Add all other characteristics not already used
  const usedKeys = [
    'Stationnement',
    'Disponibilité',
    'Superficie',
    'Type de bâtiment',
    'Année de construction',
    'Nombre d\'étages',
    'Nombre de logements',
  ];

  const otherChars: string[] = [];
  for (const [key, value] of Object.entries(rawData.characteristics)) {
    if (!usedKeys.includes(key)) {
      otherChars.push(`${key}: ${value}`);
    }
  }

  if (otherChars.length > 0) {
    notes.push('=== Autres caractéristiques ===');
    notes.push(...otherChars);
  }

  return notes.length > 0 ? notes.join('\n') : null;
}
