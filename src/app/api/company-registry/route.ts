import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { QuebecCompanyScraper } from "@/lib/scrapers/quebec-company-scraper";
import { saveCompanyData } from "@/lib/company-registry/save-company-data";
import type {
  CompanySearchRequest,
  QuebecCompanyScrapeOptions,
} from "@/types/company-registry";

/**
 * POST /api/company-registry
 *
 * Scrapes company data from the Quebec Enterprise Registry
 *
 * Request body:
 * {
 *   searchType: 'neq' | 'name',
 *   neq?: string,  // Required if searchType is 'neq'
 *   companyName?: string  // Required if searchType is 'name'
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: ScrapedCompanyData,
 *   companyId: string,
 *   fromCache: boolean
 * }
 */
export async function POST(request: Request) {
  try {
    const body: CompanySearchRequest = await request.json();
    const { searchType, neq, companyName } = body;

    // Validate input
    if (searchType === 'neq' && !neq) {
      return NextResponse.json(
        { error: "NEQ is required when searchType is 'neq'" },
        { status: 400 }
      );
    }

    if (searchType === 'name' && !companyName) {
      return NextResponse.json(
        { error: "Company name is required when searchType is 'name'" },
        { status: 400 }
      );
    }

    if (!['neq', 'name'].includes(searchType)) {
      return NextResponse.json(
        { error: "searchType must be 'neq' or 'name'" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if already scraped (by NEQ if available)
    if (neq) {
      // Validate NEQ format (10 digits)
      if (!/^\d{10}$/.test(neq)) {
        return NextResponse.json(
          { error: "Invalid NEQ format. Expected 10 digits (e.g., 1172105943)" },
          { status: 400 }
        );
      }

      const { data: existing } = await supabase
        .from('companies')
        .select(`
          *,
          shareholders:company_shareholders(*),
          administrators:company_administrators(*)
        `)
        .eq('neq', neq)
        .single();

      if (existing) {
        console.log(`Found existing company in cache: ${existing.company_name}`);
        return NextResponse.json({
          success: true,
          data: existing,
          companyId: existing.id,
          fromCache: true,
          message: "Company data already exists in database",
        });
      }
    }

    // Scrape the company
    console.log(`Starting scrape: ${searchType} = ${neq || companyName}`);

    const scrapeOptions: QuebecCompanyScrapeOptions = {
      searchType,
      neq,
      companyName,
    };

    const scraper = new QuebecCompanyScraper();
    const scrapedData = await scraper.scrape(scrapeOptions);

    // Save to database
    console.log(`Saving scraped data for: ${scrapedData.identification.name}`);
    const companyId = await saveCompanyData(scrapedData);

    // Fetch the saved data with relations
    const { data: savedCompany } = await supabase
      .from('companies')
      .select(`
        *,
        shareholders:company_shareholders(*),
        administrators:company_administrators(*)
      `)
      .eq('id', companyId)
      .single();

    return NextResponse.json({
      success: true,
      data: savedCompany,
      companyId,
      fromCache: false,
      message: "Successfully scraped and saved company data",
    });

  } catch (error) {
    console.error("Company registry scraping error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to scrape company data",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/company-registry?neq=XXXXXXXXXX
 *
 * Retrieves cached company data from the database
 *
 * Query parameters:
 * - neq: The company NEQ (10 digits)
 *
 * Response:
 * {
 *   data: CompanyWithRelations
 * }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const neq = searchParams.get("neq");

    if (!neq) {
      return NextResponse.json(
        { error: "NEQ parameter is required" },
        { status: 400 }
      );
    }

    // Validate NEQ format
    if (!/^\d{10}$/.test(neq)) {
      return NextResponse.json(
        { error: "Invalid NEQ format. Expected 10 digits" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('companies')
      .select(`
        *,
        shareholders:company_shareholders(*),
        administrators:company_administrators(*),
        property_links:property_company_links(*)
      `)
      .eq('neq', neq)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "No company found with this NEQ" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data });

  } catch (error) {
    console.error("Company registry fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to fetch company data",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
