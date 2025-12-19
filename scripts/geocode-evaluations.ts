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
const RATE_LIMIT_MS = 1000; // Nominatim limit: 1 request per second
const MAX_RETRIES = 1; // Maximum number of retries per address
const MAX_QUERY_RETRIES = 5;
const MIN_RETRY_DELAY_MS = 10000; // 10 seconds
const MAX_RETRY_DELAY_MS = 20000; // 20 seconds
const GEOCODING_API = "google"; // API provider used for geocoding

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("   Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set");
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

function getRandomRetryDelay(): number {
  return Math.floor(Math.random() * (MAX_RETRY_DELAY_MS - MIN_RETRY_DELAY_MS + 1)) + MIN_RETRY_DELAY_MS;
}

async function getEvaluationsToGeocode(batchSize: number, offset: number): Promise<Evaluation[]> {
  const MAX_QUERY_RETRIES = 5;
  const RETRY_DELAY_MS = 10000;

  for (let attempt = 1; attempt <= MAX_QUERY_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase
        .from("property_evaluations")
        .select("id_uev, full_address, latitude, longitude, nombre_logement")
        .is("latitude", null)
        .is("longitude", null)
        .eq("categorie_uef", "Régulier")
        .gte("nombre_logement", 10)
        .order("id_uev", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error: any) {
      if (attempt < MAX_QUERY_RETRIES) {
        console.warn(`   ⚠️  Failed to fetch evaluations (attempt ${attempt}/${MAX_QUERY_RETRIES}). Retrying in ${RETRY_DELAY_MS / 1000}s... Error: ${error.message}`);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw new Error(`Failed to fetch evaluations after ${MAX_QUERY_RETRIES} attempts: ${error.message}`);
      }
    }
  }

  return [];
}

async function geocodeEvaluation(evaluation: Evaluation): Promise<{ latitude: number; longitude: number } | null> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await geocodeAddress(evaluation.full_address);

      if (!result) {
        if (attempt < MAX_RETRIES) {
          const retryDelay = getRandomRetryDelay();
          console.log(`   ⚠️  No results (attempt ${attempt}/${MAX_RETRIES}), retrying in ${(retryDelay/1000).toFixed(1)}s...`);
          await sleep(retryDelay);
          continue;
        } else {
          console.log(`   ⚠️  No results for: ${evaluation.full_address} (all ${MAX_RETRIES} attempts failed)`);
          return null;
        }
      }

      if (attempt > 1) {
        console.log(`   ✅ Success on attempt ${attempt}/${MAX_RETRIES}`);
      }

      return {
        latitude: result.latitude,
        longitude: result.longitude,
      };
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        const retryDelay = getRandomRetryDelay();
        console.log(`   ⚠️  Error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${(retryDelay/1000).toFixed(1)}s...`);
        await sleep(retryDelay);
      } else {
        console.error(`   ❌ Error geocoding ${evaluation.full_address} after ${MAX_RETRIES} attempts:`, error);
      }
    }
  }

  return null;
}

async function updateEvaluationCoordinates(
  id_uev: number,
  latitude: number,
  longitude: number,
  geocodingApi: string
): Promise<boolean> {
  if (isDryRun) {
    console.log(`   [DRY RUN] Would update id_uev=${id_uev} with lat=${latitude}, lon=${longitude}, api=${geocodingApi}`);
    return true;
  }

  const { error } = await supabase
    .from("property_evaluations")
    .update({
      latitude,
      longitude,
      geocoded_at: new Date().toISOString(),
      geocoding_api: geocodingApi,
    })
    .eq("id_uev", id_uev);

  if (error) {
    console.error(`   ❌ Failed to update id_uev=${id_uev}:`, error.message);
    return false;
  }

  return true;
}

async function updateGeocodingAttempt(
  id_uev: number,
  geocodingApi: string
): Promise<boolean> {
  if (isDryRun) {
    console.log(`   [DRY RUN] Would update id_uev=${id_uev} with failed attempt using api=${geocodingApi}`);
    return true;
  }

  const { error } = await supabase
    .from("property_evaluations")
    .update({
      geocoding_api: geocodingApi,
    })
    .eq("id_uev", id_uev);

  if (error) {
    console.error(`   ❌ Failed to update geocoding attempt for id_uev=${id_uev}:`, error.message);
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
          coords.longitude,
          GEOCODING_API
        );

        if (success) {
          console.log(`${progress} ✅ Success: lat=${coords.latitude.toFixed(6)}, lon=${coords.longitude.toFixed(6)}`);
          successCount++;
        } else {
          failCount++;
        }
      } else {
        // Track failed geocoding attempt
        await updateGeocodingAttempt(evaluation.id_uev, GEOCODING_API);
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

  // Check if there are still null records remaining
  const { count: remainingNullCount } = await supabase
    .from("property_evaluations")
    .select("id_uev", { count: "exact", head: true })
    .is("latitude", null)
    .is("longitude", null);

  if (remainingNullCount !== null && remainingNullCount > 0) {
    console.log(`\n⚠️  Remaining records with null coordinates: ${remainingNullCount}`);
    console.log(`   Run the script again to retry failed geocoding attempts.`);
  } else if (remainingNullCount === 0) {
    console.log(`\n🎉 All property evaluations have been geocoded!`);
  }

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
