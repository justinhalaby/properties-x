import { NextResponse } from "next/server";
import { QuebecCompanyScraper } from "@/lib/scrapers/quebec-company-scraper";
import { saveCompanyData } from "@/lib/company-registry/save-company-data";

/**
 * POST /api/companies/scrape
 *
 * Scrapes a company from Quebec business registry by name
 *
 * Request: { companyName: string }
 * Response: { success: boolean, data: Company, companyId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName } = body;

    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    console.log(`Starting scrape for company: ${companyName}`);

    // Scrape company data from Quebec registry
    const scraper = new QuebecCompanyScraper();
    const scrapedData = await scraper.scrape({
      searchType: 'name',
      companyName,
    });

    // Save to database
    const companyId = await saveCompanyData(scrapedData);

    return NextResponse.json({
      success: true,
      data: scrapedData,
      companyId,
      message: `Successfully scraped company: ${scrapedData.identification.name}`,
    });

  } catch (error) {
    console.error("Company scrape error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to scrape company",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
