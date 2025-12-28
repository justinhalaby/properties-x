import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/owners
 *
 * Retrieves all distinct owners from montreal_evaluation_details
 *
 * Response:
 * {
 *   data: Owner[]
 * }
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get distinct owners with their property counts
    const { data: owners, error } = await supabase
      .from('montreal_evaluation_details')
      .select('owner_name, owner_status, owner_postal_address')
      .not('owner_name', 'is', null)
      .order('owner_name');

    if (error) {
      console.error('Failed to fetch owners:', error);
      throw error;
    }

    // Normalize string for fuzzy matching: lowercase, remove accents, remove extra spaces, remove punctuation
    const normalizeForMatching = (str: string): string => {
      let normalized = str
        .toLowerCase()
        .trim()
        .normalize('NFD') // Decompose accented characters
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize spaces
        .replace(/\b([a-z])\s+([a-z])\s+([a-z])\b/g, '$1$2$3') // L L C → LLC
        .replace(/\b([a-z])\s+([a-z])\b/g, '$1$2'); // L L → LL

      // Remove common French/English articles and prefixes
      const articlesToRemove = ['les ', 'la ', 'le ', 'the ', 'l '];
      for (const article of articlesToRemove) {
        if (normalized.startsWith(article)) {
          normalized = normalized.substring(article.length);
          break;
        }
      }

      return normalized;
    };

    // Fuzzy match company names (contains or very similar)
    const findMatchingCompany = (ownerName: string, companies: any[]): string | null => {
      const normalizedOwner = normalizeForMatching(ownerName);

      // First try exact match
      for (const company of companies) {
        const normalizedCompany = normalizeForMatching(company.company_name);
        if (normalizedOwner === normalizedCompany) {
          return company.id;
        }
      }

      // Then try contains match (either direction)
      for (const company of companies) {
        const normalizedCompany = normalizeForMatching(company.company_name);

        // Check if owner name contains company name or vice versa
        if (normalizedOwner.includes(normalizedCompany) ||
            normalizedCompany.includes(normalizedOwner)) {
          // Additional check: length difference should not be too large (within 30%)
          const lengthRatio = Math.min(normalizedOwner.length, normalizedCompany.length) /
                             Math.max(normalizedOwner.length, normalizedCompany.length);
          if (lengthRatio > 0.7) {
            return company.id;
          }
        }
      }

      return null;
    };

    // Get all scraped companies to check which owners have been scraped
    const { data: companies } = await supabase
      .from('companies')
      .select('id, company_name');

    // Create a map to group by owner_name and count properties
    const ownerMap = new Map();

    owners?.forEach((owner) => {
      const key = owner.owner_name;
      if (!ownerMap.has(key)) {
        const companyId = findMatchingCompany(owner.owner_name, companies || []);

        ownerMap.set(key, {
          owner_name: owner.owner_name,
          owner_status: owner.owner_status,
          owner_postal_address: owner.owner_postal_address,
          property_count: 1,
          company_id: companyId || null,
          is_scraped: !!companyId,
        });
      } else {
        ownerMap.get(key).property_count += 1;
      }
    });

    // Convert map to array and sort by property count descending
    const distinctOwners = Array.from(ownerMap.values())
      .sort((a, b) => b.property_count - a.property_count);

    return NextResponse.json({
      data: distinctOwners,
      count: distinctOwners.length
    });

  } catch (error) {
    console.error("Owners fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to fetch owners",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
