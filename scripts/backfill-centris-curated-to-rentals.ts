/**
 * Centris Pipeline Stage 2: CURATED → RENTALS
 * Transforms CentrisRentalCurated records to rentals table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { transformCuratedToRental } from '../src/lib/transformers/centris-rental-transformer';
import { geocodeAddress } from '../src/lib/geocoding/nominatim';
import type { CentrisRentalCurated } from '../src/types/centris-rental-curated';

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
  errors: Array<{ centrisId: string; error: string }>;
}

async function main() {
  console.log('\n🚀 Centris: CURATED → RENTALS Transformation');
  console.log('==============================================\n');

  const stats: Stats = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // Find all metadata records with curated data (including those with rental_id to update storage paths)
  const { data: metadataRecords, error: fetchError } = await supabase
    .from('centris_rentals_metadata')
    .select('*')
    .not('curated_id', 'is', null)
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Error fetching metadata:', fetchError.message);
    process.exit(1);
  }

  if (!metadataRecords || metadataRecords.length === 0) {
    console.log('✅ No metadata records with curated data found\n');
    return;
  }

  stats.total = metadataRecords.length;
  console.log(`Found ${stats.total} metadata records to process\n`);

  for (let i = 0; i < metadataRecords.length; i++) {
    const metadata = metadataRecords[i];
    const progress = `[${i + 1}/${stats.total}]`;

    console.log(`${progress} Processing ${metadata.centris_id}`);

    try {
      // Fetch curated record
      const { data: curated, error: curatedError } = await supabase
        .from('CentrisRentalCurated')
        .select('*')
        .eq('id', metadata.curated_id)
        .single();

      if (curatedError || !curated) {
        stats.failed++;
        const errorMsg = `Curated record not found: ${curatedError?.message}`;
        console.log(`  ❌ ${errorMsg}`);
        stats.errors.push({ centrisId: metadata.centris_id, error: errorMsg });
        continue;
      }

      // Transform curated → rental
      const { rentalInput, warnings, errors } = transformCuratedToRental(curated as CentrisRentalCurated);

      if (errors.length > 0) {
        stats.failed++;
        const errorMsg = errors.join('; ');
        console.log(`  ❌ Transformation errors: ${errorMsg}`);
        stats.errors.push({ centrisId: metadata.centris_id, error: errorMsg });

        await supabase
          .from('centris_rentals_metadata')
          .update({
            transformation_status: 'failed',
            transformation_error: errorMsg,
            transformation_attempts: metadata.transformation_attempts + 1,
          })
          .eq('id', metadata.id);

        continue;
      }

      // Geocode if needed (Centris curated should have lat/lng already)
      if (!rentalInput.latitude && !rentalInput.longitude && rentalInput.address) {
        try {
          const coords = await geocodeAddress(
            rentalInput.address,
            rentalInput.city || undefined,
            rentalInput.postal_code || undefined
          );

          if (coords) {
            rentalInput.latitude = coords.latitude;
            rentalInput.longitude = coords.longitude;
          } else {
            warnings.push('Could not geocode address');
          }
        } catch (geoError) {
          console.log(`     ⚠️  Geocoding failed`);
          warnings.push('Geocoding failed');
        }
      }

      // Use already-downloaded images from metadata
      const imageStoragePaths = metadata.images || [];

      // Prepare rental data
      const rentalData = {
        ...rentalInput,
        images: imageStoragePaths,
        geocoded_at: rentalInput.latitude ? new Date().toISOString() : null,
        raw_data_storage_path: metadata.storage_path,
      };

      // Check if rental exists
      const { data: existingRental } = await supabase
        .from('rentals')
        .select('id')
        .eq('centris_id', metadata.centris_id)
        .maybeSingle();

      let rental;
      let rentalError;

      if (existingRental) {
        // Update existing
        const { data, error } = await supabase
          .from('rentals')
          .update(rentalData)
          .eq('id', existingRental.id)
          .select()
          .single();

        rental = data;
        rentalError = error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('rentals')
          .insert(rentalData)
          .select()
          .single();

        rental = data;
        rentalError = error;
      }

      if (rentalError || !rental) {
        stats.failed++;
        const errorMsg = `Database error: ${rentalError?.message}`;
        console.log(`  ❌ ${errorMsg}`);
        stats.errors.push({ centrisId: metadata.centris_id, error: errorMsg });

        await supabase
          .from('centris_rentals_metadata')
          .update({
            transformation_status: 'failed',
            transformation_error: errorMsg,
            transformation_attempts: metadata.transformation_attempts + 1,
          })
          .eq('id', metadata.id);

        continue;
      }

      // Update metadata with rental_id
      await supabase
        .from('centris_rentals_metadata')
        .update({
          rental_id: rental.id,
          transformation_status: 'success',
          transformed_at: new Date().toISOString(),
        })
        .eq('id', metadata.id);

      stats.succeeded++;
      console.log(`  ✅ Success - Rental ID: ${rental.id}`);

      if (warnings.length > 0) {
        console.log(`     ⚠️  Warnings: ${warnings.join(', ')}`);
      }

    } catch (error) {
      stats.failed++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ ${errorMsg}`);
      stats.errors.push({ centrisId: metadata.centris_id, error: errorMsg });
    }

    // Small delay
    if (i < metadataRecords.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Summary
  console.log('\n==============================================');
  console.log('📊 Summary\n');
  console.log(`Total:     ${stats.total}`);
  console.log(`✅ Success: ${stats.succeeded}`);
  console.log(`❌ Failed:  ${stats.failed}`);
  console.log(`⏭️  Skipped: ${stats.skipped}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Failed Records:\n');
    stats.errors.forEach(({ centrisId, error }) => {
      console.log(`${centrisId}: ${error}`);
    });
  }

  console.log('==============================================\n');

  if (stats.failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
