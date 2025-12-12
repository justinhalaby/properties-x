/**
 * Batch Geocoding Script for Property Evaluations
 *
 * This script geocodes all property evaluations in the database that don't have coordinates.
 * It respects Nominatim's rate limit of 1 request per second.
 *
 * Usage:
 *   npx tsx scripts/geocode-evaluations.ts [--limit=100] [--dry-run]
 *
 * Options:
 *   --limit=N    Only geocode N evaluations (default: all)
 *   --dry-run    Don't actually update the database
 *   --continue   Continue from where it left off (skip already geocoded)
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { geocodeAddress } from "../src/lib/geocoding/google";

// Load environment variables from .env.local
config({ path: ".env.local" });

// Parse command line arguments
const args = process.argv.slice(2);
const limit = args.find(arg => arg.startsWith("--limit="))?.split("=")[1];
const isDryRun = args.includes("--dry-run");
const shouldContinue = args.includes("--continue");

const BATCH_SIZE = 10;
const RATE_LIMIT_MS = 100; // Google allows 50 requests/sec, using 10/sec to be safe

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("   Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set");
  process.exit(1);
}

if (!process.env.GOOGLE_MAPS_API_KEY) {
  console.error("❌ Missing GOOGLE_MAPS_API_KEY environment variable");
  console.error("   Get your API key from: https://console.cloud.google.com/apis/credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Evaluation {
  id_uev: number;
  full_address: string;
  latitude: number | null;
  longitude: number | null;
  nombre_logement: number | null;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getEvaluationsToGeocode(limit?: number): Promise<Evaluation[]> {
  let query = supabase
    .from("property_evaluations")
    .select("id_uev, full_address, latitude, longitude, nombre_logement");

  // Only buildings with 10+ units
  query = query.gte("nombre_logement", 10);

  if (shouldContinue) {
    query = query.is("latitude", null).is("longitude", null);
  }

  query = query.order("id_uev", { ascending: true });

  if (limit) {
    query = query.limit(limit);
  } else {
    query = query.limit(1000); // Reasonable default batch
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch evaluations: ${error.message}`);
  }

  return data || [];
}

async function geocodeEvaluation(evaluation: Evaluation): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const result = await geocodeAddress(evaluation.full_address);

    if (!result) {
      console.log(`   ⚠️  No results for: ${evaluation.full_address}`);
      return null;
    }

    return {
      latitude: result.latitude,
      longitude: result.longitude,
    };
  } catch (error) {
    console.error(`   ❌ Error geocoding ${evaluation.full_address}:`, error);
    return null;
  }
}

async function updateEvaluationCoordinates(
  id_uev: number,
  latitude: number,
  longitude: number
): Promise<boolean> {
  if (isDryRun) {
    console.log(`   [DRY RUN] Would update id_uev=${id_uev} with lat=${latitude}, lon=${longitude}`);
    return true;
  }

  const { error } = await supabase
    .from("property_evaluations")
    .update({
      latitude,
      longitude,
      geocoded_at: new Date().toISOString(),
    })
    .eq("id_uev", id_uev);

  if (error) {
    console.error(`   ❌ Failed to update id_uev=${id_uev}:`, error.message);
    return false;
  }

  return true;
}

async function main() {
  console.log("🌍 Property Evaluations Batch Geocoder");
  console.log("=====================================\n");

  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  // Get evaluations to geocode
  console.log("📊 Fetching evaluations to geocode...");
  const evaluations = await getEvaluationsToGeocode(limit ? parseInt(limit) : undefined);

  console.log(`   Found ${evaluations.length} evaluations to geocode\n`);

  if (evaluations.length === 0) {
    console.log("✅ All evaluations already geocoded!");
    return;
  }

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  console.log("🚀 Starting geocoding...\n");

  for (let i = 0; i < evaluations.length; i++) {
    const evaluation = evaluations[i];
    const progress = `[${i + 1}/${evaluations.length}]`;

    // Skip if already geocoded (unless --continue flag)
    if (evaluation.latitude && evaluation.longitude && shouldContinue) {
      console.log(`${progress} ⏭️  Skipping (already geocoded): ${evaluation.full_address}`);
      skipCount++;
      continue;
    }

    console.log(`${progress} 🔍 Geocoding: ${evaluation.full_address}`);

    const coords = await geocodeEvaluation(evaluation);

    if (coords) {
      const success = await updateEvaluationCoordinates(
        evaluation.id_uev,
        coords.latitude,
        coords.longitude
      );

      if (success) {
        console.log(`${progress} ✅ Success: lat=${coords.latitude.toFixed(6)}, lon=${coords.longitude.toFixed(6)}`);
        successCount++;
      } else {
        failCount++;
      }
    } else {
      failCount++;
    }

    // Rate limiting - wait between requests
    if (i < evaluations.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  // Summary
  console.log("\n📈 Geocoding Summary");
  console.log("===================");
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed:     ${failCount}`);
  if (skipCount > 0) {
    console.log(`⏭️  Skipped:    ${skipCount}`);
  }
  console.log(`📊 Total:      ${evaluations.length}`);

  if (!isDryRun && successCount > 0) {
    console.log(`\n✨ Successfully geocoded ${successCount} evaluations!`);
  }
}

// Run the script
main()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
