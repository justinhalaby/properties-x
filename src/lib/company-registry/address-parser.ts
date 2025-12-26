import type { ParsedAddress } from "@/types/company-registry";

/**
 * Parses Quebec addresses from the business registry format
 *
 * Examples:
 * - "355 rue des Récollets Montréal (Québec) H2Y1V9 Canada"
 * - "20-110 BOUL. de Mortagne Boucherville (Québec) J4B5M7 Canada"
 * - "900-1800 av. McGill College Montréal (Québec) H3A3J6 Canada"
 * - "Adresse non publiable" or "non publiable"
 * - "Aucune adresse"
 */
export function parseAddress(fullAddress: string): ParsedAddress {
  if (!fullAddress || fullAddress.trim() === '') {
    return {
      full_address: '',
      street_number: null,
      street_name: null,
      unit: null,
      city: null,
      province: null,
      postal_code: null,
      publishable: true,
    };
  }

  const trimmed = fullAddress.trim();

  // Check for non-publishable addresses
  if (
    trimmed.toLowerCase().includes('non publiable') ||
    trimmed.toLowerCase().includes('aucune adresse')
  ) {
    return {
      full_address: trimmed,
      street_number: null,
      street_name: null,
      unit: null,
      city: null,
      province: null,
      postal_code: null,
      publishable: false,
    };
  }

  // Initialize result with full address
  const result: ParsedAddress = {
    full_address: trimmed,
    street_number: null,
    street_name: null,
    unit: null,
    city: null,
    province: null,
    postal_code: null,
    publishable: true,
  };

  // Extract postal code (Quebec format: A1A1A1 or A1A 1A1)
  const postalCodeMatch = trimmed.match(/([A-Z]\d[A-Z]\s?\d[A-Z]\d)/i);
  if (postalCodeMatch) {
    result.postal_code = postalCodeMatch[1].replace(/\s/g, '').toUpperCase();
  }

  // Extract province (usually in parentheses: "(Québec)" or "(Quebec)")
  const provinceMatch = trimmed.match(/\(([^)]+)\)/);
  if (provinceMatch) {
    result.province = provinceMatch[1].trim();
  }

  // Try to parse the street address portion
  // Pattern: [unit-]number street_type street_name city ...
  // Examples:
  // "355 rue des Récollets Montréal..."
  // "20-110 BOUL. de Mortagne Boucherville..."
  // "900-1800 av. McGill College Montréal..."

  // Remove postal code and province parts for easier parsing
  let addressPart = trimmed;
  if (postalCodeMatch) {
    addressPart = addressPart.replace(postalCodeMatch[0], '').trim();
  }
  if (provinceMatch) {
    addressPart = addressPart.replace(provinceMatch[0], '').trim();
  }
  // Remove "Canada" if present
  addressPart = addressPart.replace(/\s+Canada\s*$/i, '').trim();

  // Split by whitespace to parse components
  const parts = addressPart.split(/\s+/);

  if (parts.length > 0) {
    // First part should be the street number (possibly with unit)
    const firstPart = parts[0];

    // Check for unit-number format (e.g., "20-110", "900-1800", "3-3141")
    const unitNumberMatch = firstPart.match(/^(\d+)-(\d+)$/);
    if (unitNumberMatch) {
      result.unit = unitNumberMatch[1];
      result.street_number = unitNumberMatch[2];
    } else if (/^\d+$/.test(firstPart)) {
      // Just a number
      result.street_number = firstPart;
    }

    // Find street type indicators (rue, av., boul., etc.)
    const streetTypeIndex = parts.findIndex((part) =>
      /^(rue|av\.|avenue|boul\.|boulevard|ch\.|chemin|montée|rang)/i.test(part)
    );

    if (streetTypeIndex > 0) {
      // Everything from street type to city is the street name
      // City is typically capitalized and appears after street name

      // Common Quebec street types for reference
      const streetTypes = ['rue', 'av.', 'avenue', 'boul.', 'boulevard', 'ch.', 'chemin'];

      // Try to find where the city starts
      // Cities are usually capitalized words that come after street name
      let cityStartIndex = -1;
      for (let i = streetTypeIndex + 1; i < parts.length; i++) {
        const part = parts[i];
        // City likely starts with capital letter and is not a street suffix (like "des", "de", "du")
        if (
          /^[A-Z]/.test(part) &&
          !['des', 'de', 'du', 'la', 'le', 'les'].includes(part.toLowerCase())
        ) {
          cityStartIndex = i;
          break;
        }
      }

      if (cityStartIndex > streetTypeIndex) {
        // Street name is between street type and city
        const streetNameParts = parts.slice(streetTypeIndex, cityStartIndex);
        result.street_name = streetNameParts.join(' ');

        // City is from cityStartIndex to end
        const cityParts = parts.slice(cityStartIndex);
        result.city = cityParts.join(' ');
      } else {
        // Can't reliably detect city, put everything in street name
        result.street_name = parts.slice(streetTypeIndex).join(' ');
      }
    }
  }

  return result;
}

/**
 * Normalize address for comparison (case-insensitive, remove accents, etc.)
 */
export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, ' ') // Replace special chars with space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Compare two addresses for similarity
 */
export function addressesSimilar(address1: string, address2: string): boolean {
  const norm1 = normalizeAddress(address1);
  const norm2 = normalizeAddress(address2);

  // Exact match after normalization
  if (norm1 === norm2) {
    return true;
  }

  // Check if one contains the other (for partial matches)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return true;
  }

  return false;
}
