import { NextResponse } from "next/server";
import { MontrealEvaluationScraper } from "@/lib/scrapers/montreal-evaluation-scraper";
import { createClient } from "@/lib/supabase/server";
import type { MontrealEvaluationInsert } from "@/types/montreal-evaluation";

// Parse numbers from French format
function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// POST /api/scrape-montreal
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matricule, saveToDatabase = false } = body;

    if (!matricule) {
      return NextResponse.json(
        { error: "Matricule is required" },
        { status: 400 }
      );
    }

    console.log(`🔍 Starting scrape for matricule: ${matricule}`);

    // Check if already scraped
    if (saveToDatabase) {
      const supabase = await createClient();
      const { data: existing } = await supabase
        .from("montreal_evaluation_details")
        .select("matricule")
        .eq("matricule", matricule)
        .single();

      if (existing) {
        return NextResponse.json(
          {
            message: "Property already scraped",
            already_exists: true,
            matricule,
          },
          { status: 200 }
        );
      }
    }

    // Scrape the property
    const scraper = new MontrealEvaluationScraper();
    const scrapedData = await scraper.scrape(matricule);

    console.log(`✅ Successfully scraped: ${scrapedData.identification.address}`);

    // Save to database if requested
    if (saveToDatabase) {
      const supabase = await createClient();

      const insertData: MontrealEvaluationInsert = {
        matricule: scrapedData.matricule,
        address: scrapedData.identification.address || null,
        arrondissement: scrapedData.identification.arrondissement || null,
        lot_exclusif: scrapedData.identification.lot_exclusif || null,
        lot_commun: scrapedData.identification.lot_commun || null,
        usage_predominant: scrapedData.identification.usage_predominant || null,
        numero_unite_voisinage:
          scrapedData.identification.numero_unite_voisinage || null,
        numero_compte_foncier:
          scrapedData.identification.numero_compte_foncier || null,
        owner_name: scrapedData.owner.name || null,
        owner_status: scrapedData.owner.status || null,
        owner_postal_address: scrapedData.owner.postal_address || null,
        owner_registration_date: scrapedData.owner.registration_date || null,
        owner_special_conditions:
          scrapedData.owner.special_conditions || null,
        land_frontage: parseNumber(scrapedData.land.frontage),
        land_area: parseNumber(scrapedData.land.area),
        building_floors: parseNumber(scrapedData.building.floors),
        building_year: parseNumber(scrapedData.building.year),
        building_floor_area: parseNumber(scrapedData.building.floor_area),
        building_construction_type:
          scrapedData.building.construction_type || null,
        building_physical_link: scrapedData.building.physical_link || null,
        building_units: parseNumber(scrapedData.building.units),
        building_non_residential_spaces: parseNumber(
          scrapedData.building.non_residential_spaces
        ),
        building_rental_rooms: parseNumber(scrapedData.building.rental_rooms),
        current_market_date: scrapedData.valuation.current.market_date || null,
        current_land_value: parseNumber(
          scrapedData.valuation.current.land_value
        ),
        current_building_value: parseNumber(
          scrapedData.valuation.current.building_value
        ),
        current_total_value: parseNumber(
          scrapedData.valuation.current.total_value
        ),
        previous_market_date:
          scrapedData.valuation.previous.market_date || null,
        previous_total_value: parseNumber(
          scrapedData.valuation.previous.total_value
        ),
        tax_category: scrapedData.fiscal.tax_category || null,
        taxable_value: parseNumber(scrapedData.fiscal.taxable_value),
        non_taxable_value: parseNumber(scrapedData.fiscal.non_taxable_value),
        tax_account_pdfs:
          scrapedData.tax_pdfs.length > 0 ? scrapedData.tax_pdfs : null,
        roll_period: scrapedData.metadata.roll_period || null,
        data_date: scrapedData.metadata.data_date || null,
      };

      const { error: insertError } = await supabase
        .from("montreal_evaluation_details")
        .insert(insertData as any);

      if (insertError) {
        console.error("❌ Database insert error:", insertError.message);
        return NextResponse.json(
          { error: "Failed to save to database", details: insertError.message },
          { status: 500 }
        );
      }

      console.log("💾 Saved to database");
    }

    return NextResponse.json({
      success: true,
      data: scrapedData,
      saved_to_database: saveToDatabase,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Scraping error:", errorMessage);

    return NextResponse.json(
      {
        error: "Failed to scrape property",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// GET /api/scrape-montreal?matricule=XXX&save=true
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matricule = searchParams.get("matricule");
    const save = searchParams.get("save") === "true";

    if (!matricule) {
      return NextResponse.json(
        { error: "Matricule query parameter is required" },
        { status: 400 }
      );
    }

    // Forward to POST handler
    return POST(
      new Request(request.url, {
        method: "POST",
        body: JSON.stringify({ matricule, saveToDatabase: save }),
      })
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Invalid request", details: errorMessage },
      { status: 400 }
    );
  }
}
