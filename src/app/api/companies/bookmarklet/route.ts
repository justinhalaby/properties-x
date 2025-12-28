import { NextResponse } from "next/server";
import { saveCompanyData } from "@/lib/company-registry/save-company-data";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ScrapedCompanyData, BookmarkletApiResponse } from "@/types/company-registry";

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bookmarklet-Key',
    },
  });
}

export async function POST(request: Request) {
  try {
    // 1. Validate API key
    const apiKey = request.headers.get('X-Bookmarklet-Key');
    if (!apiKey || apiKey !== process.env.BOOKMARKLET_API_KEY) {
      return NextResponse.json<BookmarkletApiResponse>(
        { success: false, message: 'Unauthorized', error: 'Invalid API key' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 2. Parse scraped data from request
    const scrapedData: ScrapedCompanyData = await request.json();

    // 3. Validate required fields
    if (!scrapedData.neq) {
      return NextResponse.json<BookmarkletApiResponse>(
        { success: false, message: 'Missing required field: NEQ', error: 'NEQ is required' },
        {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    if (!scrapedData.identification?.name) {
      return NextResponse.json<BookmarkletApiResponse>(
        { success: false, message: 'Missing required field: company name', error: 'Company name is required' },
        {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // 4. Check for duplicate by NEQ (using service role to bypass RLS)
    const supabase = createServiceRoleClient();
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('neq', scrapedData.neq)
      .single();

    if (existingCompany) {
      return NextResponse.json<BookmarkletApiResponse>(
        {
          success: true,
          companyId: existingCompany.id,
          message: `Company already exists (NEQ: ${scrapedData.neq})`,
          fromCache: true,
        },
        {
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // 5. Save company data using existing save function (with service role client)
    const companyId = await saveCompanyData(scrapedData, supabase);

    // 6. Return success response
    return NextResponse.json<BookmarkletApiResponse>(
      {
        success: true,
        companyId,
        message: `Company ${scrapedData.identification.name} saved successfully`,
      },
      {
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );

  } catch (error) {
    console.error('Bookmarklet API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json<BookmarkletApiResponse>(
      {
        success: false,
        message: 'Failed to save company data',
        error: errorMessage,
      },
      {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}
