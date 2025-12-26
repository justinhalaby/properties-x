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

    // Get all scraped companies to check which owners have been scraped
    const { data: companies } = await supabase
      .from('companies')
      .select('id, company_name');

    // Create a map of company names to IDs for quick lookup
    const companyMap = new Map();
    companies?.forEach((company) => {
      // Normalize company name for matching (lowercase, trim)
      const normalizedName = company.company_name.toLowerCase().trim();
      companyMap.set(normalizedName, company.id);
    });

    // Create a map to group by owner_name and count properties
    const ownerMap = new Map();

    owners?.forEach((owner) => {
      const key = owner.owner_name;
      if (!ownerMap.has(key)) {
        const normalizedOwnerName = owner.owner_name.toLowerCase().trim();
        const companyId = companyMap.get(normalizedOwnerName);

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
