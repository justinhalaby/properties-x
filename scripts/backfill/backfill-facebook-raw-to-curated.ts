/**
 * Facebook Pipeline Stage 1: RAW → CURATED
 * Transforms raw JSON from storage to FacebookRentalCurated table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { transformRawToCurated } from '../../src/lib/transformers/facebook-rental-curated-transformer';
import type { FacebookRentalRaw } from '../../src/types/facebook-rental-raw';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface Stats {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ facebookId: string; error: string }>;
}

async function main() {
  console.log('\n🚀 Facebook: RAW → CURATED Transformation');
  console.log('==========================================\n');

  const stats: Stats = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // Find all metadata records (including those with curated_id to update storage paths)
  const { data: metadataRecords, error: fetchError } = await supabase
    .from('facebook_rentals_metadata')
    .select('*')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Error fetching metadata:', fetchError.message);
    process.exit(1);
  }

  if (!metadataRecords || metadataRecords.length === 0) {
    console.log('✅ No metadata records found\n');
    return;
  }

  stats.total = metadataRecords.length;
  console.log(`Found ${stats.total} metadata records to process\n`);

  for (let i = 0; i < metadataRecords.length; i++) {
    const metadata = metadataRecords[i];
    const progress = `[${i + 1}/${stats.total}]`;

    console.log(`${progress} Processing ${metadata.facebook_id}`);

    try {
      // Download raw JSON from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('facebook-raw-rentals')
        .download(metadata.storage_path);

      if (downloadError || !fileData) {
        stats.failed++;
        const errorMsg = `Storage download failed: ${downloadError?.message}`;
        console.log(`  ❌ ${errorMsg}`);
        stats.errors.push({ facebookId: metadata.facebook_id, error: errorMsg });
        continue;
      }

      const rawJsonText = await fileData.text();
      const rawData: FacebookRentalRaw = JSON.parse(rawJsonText);

      // Transform raw → curated
      const { curatedInput, warnings, errors } = transformRawToCurated(rawData);

      if (errors.length > 0) {
        stats.failed++;
        const errorMsg = errors.join('; ');
        console.log(`  ❌ Transformation errors: ${errorMsg}`);
        stats.errors.push({ facebookId: metadata.facebook_id, error: errorMsg });

        // Update metadata with error
        await supabase
          .from('facebook_rentals_metadata')
          .update({
            transformation_status: 'failed',
            transformation_error: errorMsg,
            transformation_attempts: metadata.transformation_attempts + 1,
          })
          .eq('id', metadata.id);

        continue;
      }

      // Add storage path for traceability
      curatedInput.raw_data_storage_path = metadata.storage_path;

      // Check if curated record exists
      const { data: existingCurated } = await supabase
        .from('FacebookRentalCurated')
        .select('id')
        .eq('facebook_id', metadata.facebook_id)
        .maybeSingle();

      let curated;
      let curatedError;

      if (existingCurated) {
        // Update existing
        const { data, error } = await supabase
          .from('FacebookRentalCurated')
          .update(curatedInput)
          .eq('id', existingCurated.id)
          .select()
          .single();

        curated = data;
        curatedError = error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('FacebookRentalCurated')
          .insert(curatedInput)
          .select()
          .single();

        curated = data;
        curatedError = error;
      }

      if (curatedError || !curated) {
        stats.failed++;
        const errorMsg = `Database error: ${curatedError?.message}`;
        console.log(`  ❌ ${errorMsg}`);
        stats.errors.push({ facebookId: metadata.facebook_id, error: errorMsg });

        await supabase
          .from('facebook_rentals_metadata')
          .update({
            transformation_status: 'failed',
            transformation_error: errorMsg,
            transformation_attempts: metadata.transformation_attempts + 1,
          })
          .eq('id', metadata.id);

        continue;
      }

      // Update metadata with curated_id
      await supabase
        .from('facebook_rentals_metadata')
        .update({ curated_id: curated.id })
        .eq('id', metadata.id);

      stats.succeeded++;
      console.log(`  ✅ Success - Curated ID: ${curated.id}`);

      if (warnings.length > 0) {
        console.log(`     ⚠️  Warnings: ${warnings.join(', ')}`);
      }

    } catch (error) {
      stats.failed++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ ${errorMsg}`);
      stats.errors.push({ facebookId: metadata.facebook_id, error: errorMsg });
    }

    // Small delay
    if (i < metadataRecords.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // Summary
  console.log('\n==========================================');
  console.log('📊 Summary\n');
  console.log(`Total:     ${stats.total}`);
  console.log(`✅ Success: ${stats.succeeded}`);
  console.log(`❌ Failed:  ${stats.failed}`);
  console.log(`⏭️  Skipped: ${stats.skipped}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Failed Records:\n');
    stats.errors.forEach(({ facebookId, error }) => {
      console.log(`${facebookId}: ${error}`);
    });
  }

  console.log('==========================================\n');

  if (stats.failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
