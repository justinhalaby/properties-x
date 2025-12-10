import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MontrealEvaluationScraper } from "@/lib/scrapers/montreal-evaluation-scraper";
import type { MontrealEvaluationInsert } from "@/types/montreal-evaluation";

export async function POST(request: Request) {
  try {
    const { matricule } = await request.json();

    if (!matricule) {
      return NextResponse.json(
        { error: "Matricule is required" },
        { status: 400 }
      );
    }

    // Validate matricule format (should be XXXX-XX-XXXX-X-XXX-XXXX)
    const matriculeRegex = /^\d{4}-\d{2}-\d{4}-\d{1}-\d{3}-\d{4}$/;
    if (!matriculeRegex.test(matricule)) {
      return NextResponse.json(
        { error: "Invalid matricule format. Expected: XXXX-XX-XXXX-X-XXX-XXXX" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if already scraped
    const { data: existing } = await supabase
      .from("montreal_evaluation_details")
      .select("*")
      .eq("matricule", matricule)
      .single();

    if (existing) {
      return NextResponse.json({
        data: existing,
        fromCache: true,
        message: "Data already exists in database",
      });
    }

    // Scrape the data
    console.log(`Starting scrape for matricule: ${matricule}`);
    const scraper = new MontrealEvaluationScraper();
    const scrapedData = await scraper.scrape(matricule);

    // Transform scraped data to database format
    const insertData: MontrealEvaluationInsert = {
      matricule: scrapedData.matricule,

      // Identification
      address: scrapedData.identification.address || null,
      arrondissement: scrapedData.identification.arrondissement || null,
      lot_exclusif: scrapedData.identification.lot_exclusif || null,
      lot_commun: scrapedData.identification.lot_commun || null,
      usage_predominant: scrapedData.identification.usage_predominant || null,
      numero_unite_voisinage: scrapedData.identification.numero_unite_voisinage || null,
      numero_compte_foncier: scrapedData.identification.numero_compte_foncier || null,

      // Owner
      owner_name: scrapedData.owner.name || null,
      owner_status: scrapedData.owner.status || null,
      owner_postal_address: scrapedData.owner.postal_address || null,
      owner_registration_date: scrapedData.owner.registration_date || null,
      owner_special_conditions: scrapedData.owner.special_conditions || null,

      // Land
      land_frontage: scrapedData.land.frontage ? parseFloat(scrapedData.land.frontage) : null,
      land_area: scrapedData.land.area ? parseFloat(scrapedData.land.area) : null,

      // Building
      building_floors: scrapedData.building.floors ? parseInt(scrapedData.building.floors) : null,
      building_year: scrapedData.building.year ? parseInt(scrapedData.building.year) : null,
      building_floor_area: scrapedData.building.floor_area ? parseFloat(scrapedData.building.floor_area) : null,
      building_construction_type: scrapedData.building.construction_type || null,
      building_physical_link: scrapedData.building.physical_link || null,
      building_units: scrapedData.building.units ? parseInt(scrapedData.building.units) : null,
      building_non_residential_spaces: scrapedData.building.non_residential_spaces ? parseInt(scrapedData.building.non_residential_spaces) : null,
      building_rental_rooms: scrapedData.building.rental_rooms ? parseInt(scrapedData.building.rental_rooms) : null,

      // Current valuation
      current_market_date: scrapedData.valuation.current.market_date || null,
      current_land_value: scrapedData.valuation.current.land_value ? parseFloat(scrapedData.valuation.current.land_value) : null,
      current_building_value: scrapedData.valuation.current.building_value ? parseFloat(scrapedData.valuation.current.building_value) : null,
      current_total_value: scrapedData.valuation.current.total_value ? parseFloat(scrapedData.valuation.current.total_value) : null,

      // Previous valuation
      previous_market_date: scrapedData.valuation.previous.market_date || null,
      previous_total_value: scrapedData.valuation.previous.total_value ? parseFloat(scrapedData.valuation.previous.total_value) : null,

      // Fiscal
      tax_category: scrapedData.fiscal.tax_category || null,
      taxable_value: scrapedData.fiscal.taxable_value ? parseFloat(scrapedData.fiscal.taxable_value) : null,
      non_taxable_value: scrapedData.fiscal.non_taxable_value ? parseFloat(scrapedData.fiscal.non_taxable_value) : null,

      // Tax PDFs
      tax_account_pdfs: scrapedData.tax_pdfs.length > 0 ? scrapedData.tax_pdfs : null,

      // Metadata
      roll_period: scrapedData.metadata.roll_period || null,
      data_date: scrapedData.metadata.data_date || null,
    };

    // Insert into database
    const { data: inserted, error: insertError } = await supabase
      .from("montreal_evaluation_details")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save data to database", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: inserted,
      fromCache: false,
      message: "Successfully scraped and saved data",
    });

  } catch (error) {
    console.error("Montreal evaluation scraping error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to scrape Montreal evaluation data",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve cached data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matricule = searchParams.get("matricule");

    if (!matricule) {
      return NextResponse.json(
        { error: "Matricule parameter is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("montreal_evaluation_details")
      .select("*")
      .eq("matricule", matricule)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "No data found for this matricule" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data });

  } catch (error) {
    console.error("Montreal evaluation fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Montreal evaluation data" },
      { status: 500 }
    );
  }
}
