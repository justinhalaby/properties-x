/**
 * Utility functions for cleaning Montreal street names for address-based scraping
 */

// Common French street prefixes to remove
const STREET_PREFIXES = [
  'Rue',
  'Avenue',
  'Boulevard',
  'Av.',
  'Boul.',
  'Ch.',
  'Chemin',
] as const;

/**
 * Clean a street name for montreal.ca address-based search
 *
 * Rules:
 * - Remove prefix words: Rue, Avenue, Boulevard, Av., Boul., Ch., Chemin
 * - Remove everything after opening parenthesis
 * - Trim whitespace
 *
 * @example
 * cleanStreetName("Rue Saint-Denis (St-Denis)") // "Saint-Denis"
 * cleanStreetName("Boulevard René-Lévesque") // "René-Lévesque"
 * cleanStreetName("Avenue du Parc") // "du Parc"
 * cleanStreetName("Av. du Parc") // "du Parc"
 */
export function cleanStreetName(nomRue: string): string {
  if (!nomRue || typeof nomRue !== 'string') {
    return '';
  }

  let cleaned = nomRue;

  // Remove street type prefix (case insensitive)
  const prefixPattern = new RegExp(
    `^(${STREET_PREFIXES.join('|')})\\s+`,
    'i'
  );
  cleaned = cleaned.replace(prefixPattern, '');

  // Remove parenthetical content and everything after
  cleaned = cleaned.replace(/\s*\([^)]*\).*$/, '');

  return cleaned.trim();
}

/**
 * Extract the parenthetical alternate name if it exists
 *
 * @example
 * extractAlternateName("Rue Saint-Denis (St-Denis)") // "St-Denis"
 * extractAlternateName("Boulevard René-Lévesque") // null
 */
export function extractAlternateName(nomRue: string): string | null {
  if (!nomRue) return null;

  const match = nomRue.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : null;
}

/**
 * Validate if a street name is suitable for address-based scraping
 * Returns true if street name has enough information
 *
 * @example
 * isValidForAddressScraping(123, "Rue Saint-Denis") // true
 * isValidForAddressScraping(null, "Rue Saint-Denis") // false
 * isValidForAddressScraping(123, null) // false
 * isValidForAddressScraping(123, "Rue A") // false (too short after cleaning)
 */
export function isValidForAddressScraping(
  civiqueDebut: number | null,
  nomRue: string | null
): boolean {
  if (!civiqueDebut || civiqueDebut <= 0) {
    return false;
  }

  if (!nomRue || nomRue.trim().length === 0) {
    return false;
  }

  const cleaned = cleanStreetName(nomRue);

  // After cleaning, must have at least 2 characters
  return cleaned.length >= 2;
}

/**
 * Get all street prefixes (for testing/validation)
 */
export function getStreetPrefixes(): readonly string[] {
  return STREET_PREFIXES;
}
