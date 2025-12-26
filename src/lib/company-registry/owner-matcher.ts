import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/types/company-registry";

/**
 * Detects if an owner name appears to be a corporation based on Quebec business indicators
 *
 * @param ownerName - The name to check
 * @returns true if the name contains corporate indicators
 */
export function detectCorporateOwner(ownerName: string): boolean {
  if (!ownerName) return false;

  const lowerName = ownerName.toLowerCase();

  // Quebec and Canadian corporate indicators
  const corporateIndicators = [
    'inc.',
    'inc',
    'ltée',
    'limitée',
    'corp.',
    'corporation',
    's.e.c.', // Société en commandite
    's.e.n.c.', // Société en nom collectif
    's.e.n.c.r.l.', // Société en nom collectif à responsabilité limitée
    'enr.', // Enregistrée
    'cie',
    'compagnie',
    'société',
    'entreprise',
    'gestion',
    'immobilier',
    'immeuble',
    'immeubles',
    'holdings',
    'investissement',
    'placement',
  ];

  return corporateIndicators.some((indicator) => lowerName.includes(indicator));
}

/**
 * Extracts NEQ from shareholder/owner names if present
 * Some corporate shareholders have their NEQ in the name
 *
 * @param name - The shareholder/owner name
 * @returns NEQ if found, null otherwise
 */
export function extractNEQFromName(name: string): string | null {
  if (!name) return null;

  // Quebec NEQ format: 10 digits (e.g., 1172105943)
  const neqMatch = name.match(/\b(\d{10})\b/);
  if (neqMatch) {
    return neqMatch[1];
  }

  // Sometimes written with spaces: "117 210 5943"
  const neqWithSpaces = name.match(/\b(\d{3})\s+(\d{3})\s+(\d{4})\b/);
  if (neqWithSpaces) {
    return neqWithSpaces[1] + neqWithSpaces[2] + neqWithSpaces[3];
  }

  return null;
}

/**
 * Determines if a shareholder name represents an individual or corporate entity
 *
 * @param shareholderName - The shareholder name to classify
 * @returns 'individual' or 'corporate'
 */
export function classifyShareholderType(
  shareholderName: string
): 'individual' | 'corporate' {
  if (detectCorporateOwner(shareholderName)) {
    return 'corporate';
  }

  // Additional heuristics for corporate entities
  // All caps might indicate a company name
  const hasMultipleCaps = (shareholderName.match(/[A-Z]/g) || []).length > 3;

  // Presence of numbers often indicates corporate
  const hasNumbers = /\d/.test(shareholderName);

  if (hasMultipleCaps || hasNumbers) {
    return 'corporate';
  }

  // Check for common individual name patterns (First Last, Last, First, etc.)
  const commaCount = (shareholderName.match(/,/g) || []).length;
  if (commaCount === 1) {
    // Likely "Last, First" format for individuals
    return 'individual';
  }

  // Default to corporate if uncertain (safer for our use case)
  return 'corporate';
}

/**
 * Finds potential company matches in the database for a given owner name
 *
 * @param ownerName - The owner name to search for
 * @returns Array of companies with match type ('exact' or 'fuzzy')
 */
export async function findPotentialCompanyMatches(
  ownerName: string
): Promise<Array<Company & { matchType: 'exact' | 'fuzzy' }>> {
  const supabase = await createClient();

  // Exact match (case-insensitive)
  const { data: exactMatch } = await supabase
    .from('companies')
    .select('*')
    .ilike('company_name', ownerName)
    .limit(1);

  if (exactMatch && exactMatch.length > 0) {
    return exactMatch.map((company) => ({ ...company, matchType: 'exact' as const }));
  }

  // Fuzzy match using full-text search
  const searchQuery = ownerName
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .join(' | '); // OR search

  const { data: fuzzyMatches } = await supabase
    .from('companies')
    .select('*')
    .or(`company_name.ilike.%${ownerName}%,neq.eq.${extractNEQFromName(ownerName)}`)
    .limit(5);

  return (fuzzyMatches || []).map((company) => ({ ...company, matchType: 'fuzzy' as const }));
}

/**
 * Suggests company links for a property based on owner name matching
 *
 * @param matricule - The property matricule
 * @returns Array of suggested companies with confidence levels
 */
export async function suggestCompanyLinks(
  matricule: string
): Promise<Array<{ company: Company; confidence: 'high' | 'medium'; matchType: string }>> {
  const supabase = await createClient();

  // Get property owner name
  const { data: property } = await supabase
    .from('montreal_evaluation_details')
    .select('owner_name')
    .eq('matricule', matricule)
    .single();

  if (!property?.owner_name) {
    return [];
  }

  // Check if corporate
  if (!detectCorporateOwner(property.owner_name)) {
    return [];
  }

  // Find matches
  const matches = await findPotentialCompanyMatches(property.owner_name);

  return matches.map((match) => ({
    company: match,
    confidence: match.matchType === 'exact' ? ('high' as const) : ('medium' as const),
    matchType: match.matchType,
  }));
}

/**
 * Normalizes company name for better matching
 * Removes common suffixes and standardizes format
 *
 * @param companyName - The company name to normalize
 * @returns Normalized name
 */
export function normalizeCompanyName(companyName: string): string {
  let normalized = companyName.toLowerCase().trim();

  // Remove common suffixes
  const suffixes = [
    'inc.',
    'inc',
    'ltée',
    'limitée',
    'corp.',
    'corporation',
    's.e.c.',
    'enr.',
  ];

  suffixes.forEach((suffix) => {
    const regex = new RegExp(`\\s*${suffix.replace('.', '\\.')}\\s*$`, 'i');
    normalized = normalized.replace(regex, '').trim();
  });

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

/**
 * Compares two company names for similarity
 *
 * @param name1 - First company name
 * @param name2 - Second company name
 * @returns Similarity score from 0 to 1
 */
export function compareCompanyNames(name1: string, name2: string): number {
  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);

  // Exact match
  if (norm1 === norm2) {
    return 1.0;
  }

  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 0.8;
  }

  // Word overlap similarity
  const words1 = new Set(norm1.split(/\s+/));
  const words2 = new Set(norm2.split(/\s+/));

  const intersection = new Set([...words1].filter((word) => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}
