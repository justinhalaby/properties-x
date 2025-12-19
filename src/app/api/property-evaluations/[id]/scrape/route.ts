import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MontrealEvaluationScraper } from "@/lib/scrapers/montreal-evaluation-scraper";
import type { MontrealEvaluationInsert } from "@/types/montreal-evaluation";

// Helper function to parse French-formatted numbers (with spaces)
function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// POST /api/property-evaluations/[id]/scrape - Scrape a single building by matricule
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matricule } = await params;
    const supabase = await createClient();

    if (!matricule) {
      return NextResponse.json(
        { error: "Missing matricule" },
        { status: 400 }
      );
    }

    // Check if already scraped
    const { data: existing } = await supabase
      .from("montreal_evaluation_details")
      .select("matricule, created_at")
      .eq("matricule", matricule)
      .single();

    if (existing) {
      return NextResponse.json(
        {
          error: "Building already scraped",
          already_scraped: true,
          scraped_at: existing.created_at
        },
        { status: 409 }
      );
    }

    // Scrape the data
    const scraper = new MontrealEvaluationScraper();
    const scrapedData = await scraper.scrape(matricule);

    // Transform scraped data to database format
    const insertData: MontrealEvaluationInsert = {
      matricule: scrapedData.matricule,
      address: scrapedData.identification.address || null,
      arrondissement: scrapedData.identification.arrondissement || null,
      lot_exclusif: scrapedData.identification.lot_exclusif || null,
      lot_commun: scrapedData.identification.lot_commun || null,
      usage_predominant: scrapedData.identification.usage_predominant || null,
      numero_unite_voisinage: scrapedData.identification.numero_unite_voisinage || null,
      numero_compte_foncier: scrapedData.identification.numero_compte_foncier || null,
      owner_name: scrapedData.owner.name || null,
      owner_status: scrapedData.owner.status || null,
      owner_postal_address: scrapedData.owner.postal_address || null,
      owner_registration_date: scrapedData.owner.registration_date || null,
      owner_special_conditions: scrapedData.owner.special_conditions || null,
      land_frontage: parseNumber(scrapedData.land.frontage),
      land_area: parseNumber(scrapedData.land.area),
      building_floors: parseNumber(scrapedData.building.floors),
      building_year: parseNumber(scrapedData.building.year),
      building_floor_area: parseNumber(scrapedData.building.floor_area),
      building_construction_type: scrapedData.building.construction_type || null,
      building_physical_link: scrapedData.building.physical_link || null,
      building_units: parseNumber(scrapedData.building.units),
      building_non_residential_spaces: parseNumber(scrapedData.building.non_residential_spaces),
      building_rental_rooms: parseNumber(scrapedData.building.rental_rooms),
      current_market_date: scrapedData.valuation.current.market_date || null,
      current_land_value: parseNumber(scrapedData.valuation.current.land_value),
      current_building_value: parseNumber(scrapedData.valuation.current.building_value),
      current_total_value: parseNumber(scrapedData.valuation.current.total_value),
      previous_market_date: scrapedData.valuation.previous.market_date || null,
      previous_total_value: parseNumber(scrapedData.valuation.previous.total_value),
      tax_category: scrapedData.fiscal.tax_category || null,
      taxable_value: parseNumber(scrapedData.fiscal.taxable_value),
      non_taxable_value: parseNumber(scrapedData.fiscal.non_taxable_value),
      tax_account_pdfs: scrapedData.tax_pdfs.length > 0 ? scrapedData.tax_pdfs : null,
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
      console.error(`Database insert error:`, insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        matricule: scrapedData.matricule,
        address: scrapedData.identification.address,
        units: scrapedData.building.units,
        value: scrapedData.valuation.current.total_value,
        scraped_at: inserted.created_at,
      },
    });
  } catch (error) {
    console.error("Scraping error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Scraping failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
