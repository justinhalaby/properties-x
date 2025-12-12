/**
 * Batch Geocoding Script for Property Evaluations
 *
 * This script geocodes all property evaluations in the database that don't have coordinates.
 * It respects Google Maps API rate limit of 2000 requests per minute.
 *
 * Usage:
 *   npx tsx scripts/geocode-evaluations.ts [--limit=100] [--dry-run]
 *
 * Options:
 *   --limit=N    Only geocode N evaluations (default: all unprocessed)
 *   --dry-run    Don't actually update the database
 *
 * The script automatically skips already geocoded entries and processes all remaining
 * entries in batches until complete.
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

const BATCH_SIZE = 100; // Process 100 records per batch
const RATE_LIMIT_MS = 30; // 2000 requests/minute = ~33.33 requests/sec = 30ms delay

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

async function getEvaluationsToGeocode(batchSize: number, offset: number): Promise<Evaluation[]> {
  let query = supabase
    .from("property_evaluations")
    .select("id_uev, full_address, latitude, longitude, nombre_logement");


  // Always skip already geocoded entries
  query = query.is("latitude", null).is("longitude", null);

  query = query
    .order("id_uev", { ascending: true })
    .range(offset, offset + batchSize - 1);

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

  let totalSuccessCount = 0;
  let totalFailCount = 0;
  let totalProcessed = 0;
  let offset = 0;
  let batchNumber = 1;

  // If user specified a limit, use it; otherwise process all
  const userLimit = limit ? parseInt(limit) : undefined;

  console.log("🚀 Starting geocoding process...");
  console.log(`   Rate limit: ${RATE_LIMIT_MS}ms between requests (~${Math.floor(60000 / RATE_LIMIT_MS)} requests/minute)\n`);

  while (true) {
    // If user specified a limit, calculate remaining records to fetch
    const recordsToFetch = userLimit
      ? Math.min(BATCH_SIZE, userLimit - totalProcessed)
      : BATCH_SIZE;

    if (userLimit && totalProcessed >= userLimit) {
      console.log(`\n⚠️  Reached user-specified limit of ${userLimit} evaluations`);
      break;
    }

    console.log(`📊 Fetching batch ${batchNumber} (offset: ${offset})...`);
    const evaluations = await getEvaluationsToGeocode(recordsToFetch, offset);

    if (evaluations.length === 0) {
      console.log("✅ No more unprocessed evaluations found!");
      break;
    }

    console.log(`   Processing ${evaluations.length} evaluations\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < evaluations.length; i++) {
      const evaluation = evaluations[i];
      const globalProgress = totalProcessed + i + 1;
      const progress = `[Batch ${batchNumber}, ${i + 1}/${evaluations.length}] [Total: ${globalProgress}]`;

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
      if (i < evaluations.length - 1 || evaluations.length === BATCH_SIZE) {
        await sleep(RATE_LIMIT_MS);
      }
    }

    totalSuccessCount += successCount;
    totalFailCount += failCount;
    totalProcessed += evaluations.length;

    console.log(`\n   Batch ${batchNumber} Summary: ✅ ${successCount} succeeded, ❌ ${failCount} failed\n`);

    // Move to next batch
    offset += evaluations.length;
    batchNumber++;

    // If we got fewer results than requested, we've reached the end
    if (evaluations.length < recordsToFetch) {
      console.log("✅ Processed all available evaluations!");
      break;
    }
  }

  // Final Summary
  console.log("\n📈 Final Geocoding Summary");
  console.log("==========================");
  console.log(`✅ Successful: ${totalSuccessCount}`);
  console.log(`❌ Failed:     ${totalFailCount}`);
  console.log(`📊 Total:      ${totalProcessed}`);
  console.log(`📦 Batches:    ${batchNumber - 1}`);

  if (!isDryRun && totalSuccessCount > 0) {
    console.log(`\n✨ Successfully geocoded ${totalSuccessCount} evaluations!`);
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
