import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/companies/[id]/properties
 *
 * Automatically matches properties to a company by comparing the company name
 * with the owner_name field in montreal_evaluation_details.
 *
 * Uses fuzzy matching logic to catch variations like:
 * - "GESTION INOBEL INC." vs "GESTION INOBEL"
 * - Different punctuation and spacing
 *
 * Response:
 * {
 *   data: Property[],
 *   count: number
 * }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 1. Fetch the company to get its name
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', id)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // 2. Normalize company name for matching
    const normalizedCompanyName = normalizeName(company.company_name);

    // 3. Fetch all properties with owner names from montreal_evaluation_details
    const { data: evaluationProperties, error: propertiesError } = await supabase
      .from('montreal_evaluation_details')
      .select('*')
      .not('owner_name', 'is', null);

    if (propertiesError) {
      throw propertiesError;
    }

    // 4. Filter properties that match the company name
    const matchedEvaluations = (evaluationProperties || [])
      .map(property => {
        const matchType = matchNames(normalizedCompanyName, property.owner_name || '');
        return matchType ? { ...property, matchType } : null;
      })
      .filter(Boolean);

    // 5. Get coordinates from property_evaluations table for matched properties
    const matricules = matchedEvaluations.map(p => p.matricule);

    if (matricules.length === 0) {
      return NextResponse.json({
        data: [],
        count: 0
      });
    }

    const { data: propertyEvaluations } = await supabase
      .from('property_evaluations')
      .select('matricule83, latitude, longitude')
      .in('matricule83', matricules);

    // Create a map of matricule to coordinates
    const matriculeToCoordinatesMap = new Map(
      (propertyEvaluations || []).map(p => [
        p.matricule83,
        { latitude: p.latitude, longitude: p.longitude }
      ])
    );

    // 6. Try to fetch corresponding property IDs from the properties table
    const { data: propertiesWithIds } = await supabase
      .from('properties')
      .select('id, matricule')
      .in('matricule', matricules);

    // Create a map of matricule to property ID
    const matriculeToIdMap = new Map(
      (propertiesWithIds || []).map(p => [p.matricule, p.id])
    );

    // 7. Add property ID and coordinates to matched properties
    const matchedProperties = matchedEvaluations.map(property => {
      const coords = matriculeToCoordinatesMap.get(property.matricule);
      return {
        ...property,
        property_id: matriculeToIdMap.get(property.matricule) || null,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
      };
    });

    return NextResponse.json({
      data: matchedProperties,
      count: matchedProperties.length
    });

  } catch (error) {
    console.error("Properties matching error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to match properties",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Normalizes a company/owner name for comparison
 * - Converts to lowercase
 * - Removes extra spaces
 * - Removes common punctuation
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .trim();
}

/**
 * Checks if two names match
 * Returns confidence level: 'exact', 'fuzzy', or null
 */
function matchNames(companyName: string, ownerName: string): 'exact' | 'fuzzy' | null {
  const normalizedCompany = normalizeName(companyName);
  const normalizedOwner = normalizeName(ownerName);

  // Exact match
  if (normalizedCompany === normalizedOwner) {
    return 'exact';
  }

  // Fuzzy match: owner name contains company name or vice versa
  // This helps match variations like "GESTION INOBEL INC." vs "GESTION INOBEL"
  if (normalizedOwner.includes(normalizedCompany) || normalizedCompany.includes(normalizedOwner)) {
    // Only consider it fuzzy if the match is substantial (at least 80% of the shorter name)
    const shorterLength = Math.min(normalizedCompany.length, normalizedOwner.length);
    const longerLength = Math.max(normalizedCompany.length, normalizedOwner.length);

    if (shorterLength / longerLength >= 0.8) {
      return 'fuzzy';
    }
  }

  return null;
}
