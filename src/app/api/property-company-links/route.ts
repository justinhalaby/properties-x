import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PropertyLinkRequest } from "@/types/company-registry";

/**
 * POST /api/property-company-links
 *
 * Creates a link between a property (by matricule) and a company
 *
 * Request body:
 * {
 *   matricule: string,
 *   companyId: string,
 *   linkMethod?: 'owner_name_match' | 'manual_addition' | 'auto_detection',
 *   linkConfidence?: 'exact' | 'fuzzy' | 'manual',
 *   notes?: string
 * }
 *
 * Response:
 * {
 *   data: PropertyCompanyLink
 * }
 */
export async function POST(request: Request) {
  try {
    const body: PropertyLinkRequest = await request.json();
    const {
      matricule,
      companyId,
      linkMethod = 'manual_addition',
      linkConfidence = 'manual',
      notes,
    } = body;

    // Validate required fields
    if (!matricule) {
      return NextResponse.json({ error: "Matricule is required" }, { status: 400 });
    }

    if (!companyId) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify property exists
    const { data: property, error: propertyError } = await supabase
      .from('montreal_evaluation_details')
      .select('matricule, address, owner_name')
      .eq('matricule', matricule)
      .single();

    if (propertyError || !property) {
      return NextResponse.json(
        { error: "Property not found with this matricule" },
        { status: 404 }
      );
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, company_name, neq')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Check if link already exists
    const { data: existingLink } = await supabase
      .from('property_company_links')
      .select('*')
      .eq('matricule', matricule)
      .eq('company_id', companyId)
      .single();

    if (existingLink) {
      return NextResponse.json(
        {
          error: "Link already exists between this property and company",
          data: existingLink,
        },
        { status: 409 }
      );
    }

    // Create the link
    const { data: link, error: linkError } = await supabase
      .from('property_company_links')
      .insert({
        matricule,
        company_id: companyId,
        link_confidence: linkConfidence,
        link_method: linkMethod,
        verified: linkMethod === 'manual_addition', // Manual links are pre-verified
        verified_at: linkMethod === 'manual_addition' ? new Date().toISOString() : null,
        notes,
      })
      .select()
      .single();

    if (linkError) {
      console.error('Failed to create property-company link:', linkError);
      return NextResponse.json(
        {
          error: "Failed to create link",
          details: linkError.message,
        },
        { status: 500 }
      );
    }

    console.log(`✓ Created link: Property ${matricule} → Company ${company.company_name}`);

    return NextResponse.json({
      success: true,
      data: link,
      message: `Successfully linked property to ${company.company_name}`,
    });

  } catch (error) {
    console.error("Property-company link creation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to create property-company link",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/property-company-links?matricule=XXXX
 *
 * Retrieves all company links for a property
 *
 * Query parameters:
 * - matricule: The property matricule
 *
 * Response:
 * {
 *   data: PropertyCompanyLink[]
 * }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matricule = searchParams.get("matricule");
    const companyId = searchParams.get("companyId");

    const supabase = await createClient();

    if (matricule) {
      // Get all companies linked to this property
      const { data, error } = await supabase
        .from('property_company_links')
        .select(`
          *,
          company:companies(*)
        `)
        .eq('matricule', matricule);

      if (error) {
        throw error;
      }

      return NextResponse.json({ data: data || [] });

    } else if (companyId) {
      // Get all properties linked to this company
      const { data, error } = await supabase
        .from('property_company_links')
        .select('*')
        .eq('company_id', companyId);

      if (error) {
        throw error;
      }

      return NextResponse.json({ data: data || [] });

    } else {
      return NextResponse.json(
        { error: "Either matricule or companyId parameter is required" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Property-company links fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to fetch property-company links",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/property-company-links
 *
 * Removes a link between a property and a company
 *
 * Request body:
 * {
 *   matricule: string,
 *   companyId: string
 * }
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { matricule, companyId } = body;

    if (!matricule || !companyId) {
      return NextResponse.json(
        { error: "Both matricule and companyId are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('property_company_links')
      .delete()
      .eq('matricule', matricule)
      .eq('company_id', companyId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Link successfully removed",
    });

  } catch (error) {
    console.error("Property-company link deletion error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to delete property-company link",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
