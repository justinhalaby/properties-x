import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/companies
 *
 * Retrieves all companies with their shareholders and administrators
 *
 * Response:
 * {
 *   data: CompanyWithRelations[]
 * }
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: companies, error } = await supabase
      .from('companies')
      .select(`
        *,
        shareholders:company_shareholders(*),
        administrators:company_administrators(*),
        property_links:property_company_links(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch companies:', error);
      throw error;
    }

    return NextResponse.json({
      data: companies || [],
      count: companies?.length || 0
    });

  } catch (error) {
    console.error("Companies fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to fetch companies",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
