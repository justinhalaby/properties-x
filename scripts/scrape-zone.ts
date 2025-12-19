import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { MontrealEvaluationScraper } from "../src/lib/scrapers/montreal-evaluation-scraper";
import type { MontrealEvaluationInsert } from "../src/types/montreal-evaluation";

// Load environment variables
config({ path: ".env.local" });

// Parse command line args
const args = process.argv.slice(2);
const zoneIdArg = args.find((arg) => arg.startsWith("--zone-id="));
const jobIdArg = args.find((arg) => arg.startsWith("--job-id="));
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const minUnitsArg = args.find((arg) => arg.startsWith("--min-units="));

const zoneId = zoneIdArg?.split("=")[1];
const jobId = jobIdArg?.split("=")[1];
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : null;
const minUnits = minUnitsArg ? parseInt(minUnitsArg.split("=")[1]) : 3;

if (!zoneId && !jobId) {
  console.error("Usage: npm run scrape:zone -- --zone-id=<zone-id> [--limit=50] [--min-units=3]");
  console.error("   OR: npm run scrape:zone -- --job-id=<job-id>");
  process.exit(1);
}

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials in environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse numbers from French format
function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Random delay between requests (90-180 seconds)
async function randomDelay() {
  const minSeconds = 90;
  const maxSeconds = 180;
  const delayMs = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
  const delaySeconds = (delayMs / 1000).toFixed(1);

  console.log(`\n⏳ Waiting ${delaySeconds} seconds before next request...\n`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function scrapeProperty(matricule: string, index: number, total: number) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🏢 Scraping property ${index + 1}/${total}`);
  console.log(`📋 Matricule: ${matricule}`);
  console.log(`${"=".repeat(80)}\n`);

  try {
    // Check if already scraped
    const { data: existing } = await supabase
      .from("montreal_evaluation_details")
      .select("matricule")
      .eq("matricule", matricule)
      .single();

    if (existing) {
      console.log(`⚠️  Already scraped, skipping...`);
      return { success: true, skipped: true };
    }

    // Scrape
    const scraper = new MontrealEvaluationScraper();
    const scrapedData = await scraper.scrape(matricule);

    // Transform data
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

    // Insert
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
  let currentZoneId = zoneId;
  let scrapingLimit = limit;

  // If job ID provided, fetch job details
  if (jobId) {
    console.log(`📋 Loading job ${jobId}...\n`);
    const { data: job, error: jobError } = await supabase
      .from("zone_scraping_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("❌ Job not found");
      process.exit(1);
    }

    currentZoneId = job.zone_id;
    scrapingLimit = job.requested_limit;

    // Update job status to running
    await supabase
      .from("zone_scraping_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);
  }

  if (!currentZoneId) {
    console.error("❌ No zone ID provided");
    process.exit(1);
  }

  console.log("\n🚀 Starting zone scraping");
  console.log(`📍 Zone ID: ${currentZoneId}\n`);

  // Get zone
  const { data: zone, error: zoneError } = await supabase
    .from("scraping_zones")
    .select("*")
    .eq("id", currentZoneId)
    .single();

  if (zoneError || !zone) {
    console.error("❌ Zone not found");
    process.exit(1);
  }

  console.log(`📋 Zone: ${zone.name}`);
  console.log(`📊 Bounds: Lat ${zone.min_lat} to ${zone.max_lat}, Lng ${zone.min_lng} to ${zone.max_lng}`);
  console.log(`🏢 Unit Filter: ${zone.min_units || 0}${zone.max_units ? ` to ${zone.max_units}` : '+'} units\n`);

  // Get properties in zone with unit filters
  let propertiesQuery = supabase
    .from("property_evaluations")
    .select("matricule83, clean_address, nombre_logement")
    .gte("latitude", zone.min_lat)
    .lte("latitude", zone.max_lat)
    .gte("longitude", zone.min_lng)
    .lte("longitude", zone.max_lng)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  // Apply unit filters from zone configuration
  if (zone.min_units != null) {
    propertiesQuery = propertiesQuery.gte("nombre_logement", zone.min_units);
  }
  if (zone.max_units != null) {
    propertiesQuery = propertiesQuery.lte("nombre_logement", zone.max_units);
  }

  const { data: properties } = await propertiesQuery;

  if (!properties || properties.length === 0) {
    console.log("✅ No properties found in zone");
    return;
  }

  console.log(`📋 Found ${properties.length} properties in zone`);
  console.log("🔍 Filtering out already scraped properties...\n");

  // Filter out scraped
  const matricules = properties.map((p) => p.matricule83).filter(Boolean);
  const { data: scraped } = await supabase
    .from("montreal_evaluation_details")
    .select("matricule")
    .in("matricule", matricules);

  const scrapedSet = new Set(scraped?.map((s) => s.matricule) || []);
  const unscraped = properties.filter((p) => !scrapedSet.has(p.matricule83));

  console.log(`✨ Found ${unscraped.length} unscraped properties\n`);

  if (unscraped.length === 0) {
    console.log("✅ All properties already scraped!");
    return;
  }

  // Apply limit
  const toScrape = scrapingLimit
    ? unscraped.slice(0, scrapingLimit)
    : unscraped;

  console.log(`🎯 Will scrape ${toScrape.length} properties`);
  console.log("\n📋 Properties to scrape:");
  toScrape.slice(0, 10).forEach((prop, i) => {
    console.log(
      `   ${i + 1}. ${prop.clean_address} (${prop.nombre_logement} units) - ${prop.matricule83}`
    );
  });
  if (toScrape.length > 10) {
    console.log(`   ... and ${toScrape.length - 10} more`);
  }

  // Stats
  const stats = {
    total: toScrape.length,
    successful: 0,
    failed: 0,
    skipped: 0,
  };

  // Scrape each
  for (let i = 0; i < toScrape.length; i++) {
    const property = toScrape[i];
    const result = await scrapeProperty(property.matricule83, i, toScrape.length);

    if (result.success) {
      if (result.skipped) {
        stats.skipped++;
      } else {
        stats.successful++;
      }
    } else {
      stats.failed++;
    }

    // Update job progress if job ID provided
    if (jobId) {
      await supabase
        .from("zone_scraping_jobs")
        .update({
          scraped_count: stats.successful + stats.skipped,
          failed_count: stats.failed,
        })
        .eq("id", jobId);
    }

    // Wait before next (except last)
    if (i < toScrape.length - 1) {
      await randomDelay();
    }
  }

  // Update zone stats
  const { count: newScrapedCount } = await supabase
    .from("montreal_evaluation_details")
    .select("*", { count: "exact", head: true })
    .in("matricule", matricules);

  await supabase
    .from("scraping_zones")
    .update({
      scraped_count: newScrapedCount || 0,
      last_scraped_at: new Date().toISOString(),
    })
    .eq("id", currentZoneId);

  // Update job if job ID provided
  if (jobId) {
    await supabase
      .from("zone_scraping_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: stats,
      })
      .eq("id", jobId);
  }

  // Final summary
  console.log(`\n${"=".repeat(80)}`);
  console.log("📊 SCRAPING COMPLETE");
  console.log("=".repeat(80));
  console.log(`Total properties: ${stats.total}`);
  console.log(`✅ Successful: ${stats.successful}`);
  console.log(`⚠️  Skipped: ${stats.skipped}`);
  console.log(`❌ Failed: ${stats.failed}`);
  console.log(`${"=".repeat(80)}\n`);
}

// Run
main()
  .then(() => {
    console.log("✨ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
