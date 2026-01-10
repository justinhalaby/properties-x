/**
 * Backfill CentrisRentalCurated table
 * Transforms all existing Centris raw data that doesn't have a curated record yet
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BackfillStats {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ centrisId: string; error: string }>;
}

async function backfillCuratedRecords() {
  console.log('\n=== Backfilling CentrisRentalCurated Table ===\n');

  const stats: BackfillStats = {
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // 1. Find all metadata records without curated_id
  console.log('Finding records to backfill...\n');

  const { data: metadataRecords, error: fetchError } = await supabase
    .from('centris_rentals_metadata')
    .select('id, centris_id, transformation_status, curated_id, rental_id')
    .is('curated_id', null)
    .eq('scrape_status', 'success')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Error fetching metadata:', fetchError.message);
    process.exit(1);
  }

  if (!metadataRecords || metadataRecords.length === 0) {
    console.log('✅ No records to backfill - all records already have curated data\n');
    return;
  }

  stats.total = metadataRecords.length;

  console.log(`Found ${stats.total} records to backfill\n`);
  console.log('Starting backfill process...\n');

  // 2. Process each record
  for (let i = 0; i < metadataRecords.length; i++) {
    const record = metadataRecords[i];
    stats.processed++;

    const progress = `[${stats.processed}/${stats.total}]`;
    console.log(`${progress} Processing Centris ID: ${record.centris_id}`);

    try {
      // Call the transform API endpoint
      const response = await fetch('http://localhost:3000/api/centris-rentals/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centrisId: record.centris_id,
          force: true, // Force transformation even if rental exists
        }),
      });

      const result = await response.json();

      if (response.ok) {
        stats.succeeded++;
        console.log(`  ✅ Success - ${result.message}`);

        // Show curated and rental IDs
        if (result.curated?.id) {
          console.log(`     Curated ID: ${result.curated.id}`);
        }
        if (result.rental?.id) {
          console.log(`     Rental ID: ${result.rental.id}`);
        }

        // Show warnings if any
        if (result.warnings && result.warnings.length > 0) {
          console.log(`     ⚠️  Warnings: ${result.warnings.join(', ')}`);
        }
      } else {
        stats.failed++;
        const errorMsg = result.error || result.message || 'Unknown error';
        console.log(`  ❌ Failed - ${errorMsg}`);
        stats.errors.push({
          centrisId: record.centris_id,
          error: errorMsg,
        });
      }
    } catch (error) {
      stats.failed++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ Error - ${errorMsg}`);
      stats.errors.push({
        centrisId: record.centris_id,
        error: errorMsg,
      });
    }

    console.log(''); // Empty line for readability

    // Add small delay to avoid overwhelming the API
    if (i < metadataRecords.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // 3. Print summary
  console.log('\n=== Backfill Summary ===\n');
  console.log(`Total records:     ${stats.total}`);
  console.log(`Processed:         ${stats.processed}`);
  console.log(`✅ Succeeded:      ${stats.succeeded}`);
  console.log(`❌ Failed:         ${stats.failed}`);
  console.log(`⏭️  Skipped:        ${stats.skipped}`);

  if (stats.errors.length > 0) {
    console.log('\n=== Failed Records ===\n');
    stats.errors.forEach(({ centrisId, error }) => {
      console.log(`Centris ID: ${centrisId}`);
      console.log(`  Error: ${error}\n`);
    });
  }

  // 4. Verify final state
  console.log('\n=== Verification ===\n');

  const { count: remainingCount } = await supabase
    .from('centris_rentals_metadata')
    .select('*', { count: 'exact', head: true })
    .is('curated_id', null)
    .eq('scrape_status', 'success');

  console.log(`Records still without curated_id: ${remainingCount || 0}\n`);

  const { count: curatedCount } = await supabase
    .from('CentrisRentalCurated')
    .select('*', { count: 'exact', head: true });

  console.log(`Total CentrisRentalCurated records: ${curatedCount || 0}\n`);

  console.log('=== Backfill Complete ===\n');

  if (stats.failed > 0) {
    console.log('⚠️  Some records failed to backfill. Check the errors above.');
    process.exit(1);
  }
}

// Run the backfill
backfillCuratedRecords().catch((error) => {
  console.error('\n❌ Backfill failed:', error);
  process.exit(1);
});
