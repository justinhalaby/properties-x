import { createClient } from "@supabase/supabase-js";
import { MontrealEvaluationScraper } from "../src/lib/scrapers/montreal-evaluation-scraper";
import type { MontrealEvaluationInsert } from "../src/types/montreal-evaluation";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to parse French-formatted numbers (with spaces)
function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Random delay between 30-60 seconds
async function randomDelay() {
  const minSeconds = 60;
  const maxSeconds = 120;
  const delayMs = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
  const delaySeconds = (delayMs / 1000).toFixed(1);

  console.log(`\n⏳ Waiting ${delaySeconds} seconds before next request...\n`);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

async function scrapeProperty(matricule: string, index: number, total: number) {
  const separator = "=".repeat(80);
  console.log(`\n${separator}`);
  console.log(`🏢 Scraping property ${index + 1}/${total}`);
  console.log(`📋 Matricule: ${matricule}`);
  console.log(`${separator}\n`);

  try {
    // Check if already scraped (safety check)
    const { data: existing } = await supabase
      .from("montreal_evaluation_details")
      .select("matricule")
      .eq("matricule", matricule)
      .single();

    if (existing) {
      console.log(`⚠️  Already scraped, skipping...`);
      return { success: true, skipped: true };
    }

    // Scrape the data
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
      land_frontage: parseNumber(scrapedData.land.frontage),
      land_area: parseNumber(scrapedData.land.area),

      // Building
      building_floors: parseNumber(scrapedData.building.floors),
      building_year: parseNumber(scrapedData.building.year),
      building_floor_area: parseNumber(scrapedData.building.floor_area),
      building_construction_type: scrapedData.building.construction_type || null,
      building_physical_link: scrapedData.building.physical_link || null,
      building_units: parseNumber(scrapedData.building.units),
      building_non_residential_spaces: parseNumber(scrapedData.building.non_residential_spaces),
      building_rental_rooms: parseNumber(scrapedData.building.rental_rooms),

      // Current valuation
      current_market_date: scrapedData.valuation.current.market_date || null,
      current_land_value: parseNumber(scrapedData.valuation.current.land_value),
      current_building_value: parseNumber(scrapedData.valuation.current.building_value),
      current_total_value: parseNumber(scrapedData.valuation.current.total_value),

      // Previous valuation
      previous_market_date: scrapedData.valuation.previous.market_date || null,
      previous_total_value: parseNumber(scrapedData.valuation.previous.total_value),

      // Fiscal
      tax_category: scrapedData.fiscal.tax_category || null,
      taxable_value: parseNumber(scrapedData.fiscal.taxable_value),
      non_taxable_value: parseNumber(scrapedData.fiscal.non_taxable_value),

      // Tax PDFs
      tax_account_pdfs: scrapedData.tax_pdfs.length > 0 ? scrapedData.tax_pdfs : null,

      // Metadata
      roll_period: scrapedData.metadata.roll_period || null,
      data_date: scrapedData.metadata.data_date || null,
    };

    // Insert into database
    const { error: insertError } = await supabase
      .from("montreal_evaluation_details")
      .insert(insertData);

    if (insertError) {
      console.error(`❌ Database insert error:`, insertError.message);
      return { success: false, error: insertError.message };
    }

    console.log(`✅ Successfully scraped and saved`);
    console.log(`   Address: ${scrapedData.identification.address}`);
    console.log(`   Units: ${scrapedData.building.units}`);
    console.log(`   Value: ${scrapedData.valuation.current.total_value}`);

    return { success: true, skipped: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Scraping error:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function main() {
  const unitsThreshold = 30;
  console.log("\n🚀 Starting large property scraper");
  console.log(`📊 Looking for properties with ${unitsThreshold}+ units that haven't been scraped...\n`);

  // Query for properties with 10+ units that haven't been scraped
  const { data: properties, error } = await supabase
    .from("property_evaluations")
    .select("matricule83, nombre_logement, clean_address")
    .gte("nombre_logement", unitsThreshold)
    .not("matricule83", "is", null)
    .limit(100);

  if (error) {
    console.error("❌ Database query error:", error);
    process.exit(1);
  }

  if (!properties || properties.length === 0) {
    console.log("✅ No properties found with 10+ units");
    return;
  }

  console.log(`📋 Found ${properties.length} properties with 25+ units`);
  console.log("🔍 Filtering out already scraped properties...\n");

  // Filter out already scraped properties
  const unscrapedProperties = [];
  for (const prop of properties) {
    const { data: existing } = await supabase
      .from("montreal_evaluation_details")
      .select("matricule")
      .eq("matricule", prop.matricule83)
      .single();

    if (!existing) {
      unscrapedProperties.push(prop);
    }
  }

  console.log(`✨ Found ${unscrapedProperties.length} unscraped properties\n`);

  if (unscrapedProperties.length === 0) {
    console.log("✅ All properties with 10+ units have already been scraped!");
    return;
  }

  // Summary of what we're about to scrape
  console.log("📋 Properties to scrape:");
  unscrapedProperties.slice(0, 10).forEach((prop, i) => {
    console.log(`   ${i + 1}. ${prop.clean_address} (${prop.nombre_logement} units) - ${prop.matricule83}`);
  });
  if (unscrapedProperties.length > 10) {
    console.log(`   ... and ${unscrapedProperties.length - 10} more`);
  }

  // Stats tracking
  const stats = {
    total: unscrapedProperties.length,
    successful: 0,
    failed: 0,
    skipped: 0,
  };

  // Scrape each property
  for (let i = 0; i < unscrapedProperties.length; i++) {
    const property = unscrapedProperties[i];

    const result = await scrapeProperty(property.matricule83, i, unscrapedProperties.length);

    if (result.success) {
      if (result.skipped) {
        stats.skipped++;
      } else {
        stats.successful++;
      }
    } else {
      stats.failed++;
    }

    // Wait before next request (except for the last one)
    if (i < unscrapedProperties.length - 1) {
      await randomDelay();
    }
  }

  // Final summary
  const separator = "=".repeat(80);
  console.log(`\n${separator}`);
  console.log("📊 SCRAPING COMPLETE");
  console.log(separator);
  console.log(`Total properties: ${stats.total}`);
  console.log(`✅ Successful: ${stats.successful}`);
  console.log(`⚠️  Skipped: ${stats.skipped}`);
  console.log(`❌ Failed: ${stats.failed}`);
  console.log(`${separator}\n`);
}

// Run the script
main()
  .then(() => {
    console.log("✨ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
