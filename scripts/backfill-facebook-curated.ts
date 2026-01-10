import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface Rental {
  id: string;
  facebook_id: string | null;
  source_url: string | null;
  title: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  rental_location: string | null;
  monthly_rent: number | null;
  price_display: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  unit_type: string | null;
  pet_policy: any;
  amenities: any;
  unit_details_raw: any;
  building_details: any;
  description: string | null;
  seller_name: string | null;
  seller_profile_url: string | null;
  images: string[];
  videos: string[];
  created_at: string;
}

interface FacebookRentalRaw {
  facebook_id: string;
  source_url: string;
  extracted_date: string;
  scraper_version: string;
  raw_data: {
    extractedDate: string;
    id: string;
    url: string;
    title: string;
    price: string;
    address: string;
    buildingDetails: string[];
    unitDetails: string[];
    rentalLocation: string;
    description: string;
    sellerInfo: {
      name: string;
      profileUrl: string;
    };
    media: {
      images: string[];
      videos: string[];
    };
  };
}

/**
 * Reconstruct unitDetails from rental fields
 */
function reconstructUnitDetails(rental: Rental): string[] {
  const details: string[] = [];

  if (rental.bedrooms !== null) {
    details.push(`${rental.bedrooms} bed${rental.bedrooms !== 1 ? 's' : ''}`);
  }
  if (rental.bathrooms !== null) {
    details.push(`${rental.bathrooms} bath${rental.bathrooms !== 1 ? 's' : ''}`);
  }
  if (rental.unit_type) {
    details.push(rental.unit_type);
  }
  if (rental.amenities && Array.isArray(rental.amenities) && rental.amenities.length > 0) {
    details.push(...rental.amenities);
  }
  // Add any existing unit_details_raw if available
  if (rental.unit_details_raw && Array.isArray(rental.unit_details_raw)) {
    // Merge but avoid duplicates
    for (const detail of rental.unit_details_raw) {
      if (!details.includes(detail)) {
        details.push(detail);
      }
    }
  }

  return details;
}

/**
 * Phase 1: Export existing Facebook rentals to raw JSON
 */
async function phase1ExportToRawJson() {
  console.log('\n=== Phase 1: Export to Raw JSON ===\n');

  // Get all Facebook rentals
  const { data: existingRentals, error: fetchError } = await supabase
    .from('rentals')
    .select('*')
    .eq('source_name', 'facebook_marketplace')
    .not('facebook_id', 'is', null);

  if (fetchError) {
    console.error('Error fetching rentals:', fetchError);
    return { success: 0, failed: 0 };
  }

  if (!existingRentals || existingRentals.length === 0) {
    console.log('No Facebook rentals found to backfill');
    return { success: 0, failed: 0 };
  }

  console.log(`Found ${existingRentals.length} Facebook rentals to backfill\n`);

  let successCount = 0;
  let failedCount = 0;

  for (const rental of existingRentals as Rental[]) {
    try {
      const facebookId = rental.facebook_id!;

      // Check if already backfilled
      const { data: existingMetadata } = await supabase
        .from('facebook_rentals_metadata')
        .select('id')
        .eq('facebook_id', facebookId)
        .maybeSingle();

      if (existingMetadata) {
        console.log(`⏭️  Skipping ${facebookId} - already exists in metadata`);
        continue;
      }

      // Reconstruct FacebookRentalRaw JSON
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      const rawJson: FacebookRentalRaw = {
        facebook_id: facebookId,
        source_url: rental.source_url || '',
        extracted_date: rental.created_at,
        scraper_version: 'backfill-v1',
        raw_data: {
          extractedDate: rental.created_at,
          id: facebookId,
          url: rental.source_url || '',
          title: rental.title,
          price: rental.price_display || (rental.monthly_rent ? `CA$${rental.monthly_rent} / Month` : ''),
          address: rental.address || '',
          buildingDetails: Array.isArray(rental.building_details) ? rental.building_details : [],
          unitDetails: reconstructUnitDetails(rental),
          rentalLocation: rental.rental_location || (rental.city ? `${rental.city}, QC` : ''),
          description: rental.description || '',
          sellerInfo: {
            name: rental.seller_name || '',
            profileUrl: rental.seller_profile_url || ''
          },
          media: {
            images: [], // Can't reconstruct CDN URLs
            videos: []
          }
        }
      };

      const rawJsonStr = JSON.stringify(rawJson, null, 2);
      const storagePath = `${year}/${month}/${facebookId}.json`;

      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('facebook-raw-rentals')
        .upload(storagePath, rawJsonStr, {
          contentType: 'application/json',
          upsert: false,
        });

      if (uploadError) {
        console.error(`❌ Failed to upload ${facebookId}:`, uploadError.message);
        failedCount++;
        continue;
      }

      // Create metadata record
      const { error: metadataError } = await supabase
        .from('facebook_rentals_metadata')
        .insert({
          facebook_id: facebookId,
          source_url: rental.source_url,
          storage_path: storagePath,
          raw_data_size_bytes: new Blob([rawJsonStr]).size,
          scrape_status: 'backfilled',
          transformation_status: 'pending',
          rental_id: rental.id,
          images: rental.images || [],
          videos: rental.videos || [],
          title_preview: rental.title?.substring(0, 100) || null,
          price_preview: rental.price_display || null,
          address_preview: rental.address || null,
        });

      if (metadataError) {
        console.error(`❌ Failed to create metadata for ${facebookId}:`, metadataError.message);
        failedCount++;
        continue;
      }

      console.log(`✅ Exported ${facebookId} to ${storagePath}`);
      successCount++;

    } catch (error) {
      console.error(`❌ Error processing rental ${rental.id}:`, error);
      failedCount++;
    }
  }

  console.log(`\n📊 Phase 1 Summary: ${successCount} success, ${failedCount} failed\n`);
  return { success: successCount, failed: failedCount };
}

/**
 * Phase 2: Transform through pipeline
 */
async function phase2TransformThroughPipeline() {
  console.log('\n=== Phase 2: Transform Through Pipeline ===\n');

  // Find all metadata records without curated_id
  const { data: metadataRecords, error: fetchError } = await supabase
    .from('facebook_rentals_metadata')
    .select('*')
    .is('curated_id', null)
    .eq('scrape_status', 'backfilled');

  if (fetchError) {
    console.error('Error fetching metadata:', fetchError);
    return { success: 0, failed: 0 };
  }

  if (!metadataRecords || metadataRecords.length === 0) {
    console.log('No pending transformations found');
    return { success: 0, failed: 0 };
  }

  console.log(`Found ${metadataRecords.length} records to transform\n`);

  let successCount = 0;
  let failedCount = 0;

  // Get the API base URL (use localhost for local development)
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  for (const record of metadataRecords) {
    try {
      const facebookId = record.facebook_id;

      // Call transform API with force=true
      const response = await fetch(`${apiBaseUrl}/api/facebook-rentals/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facebookId,
          force: true
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`❌ Transform failed for ${facebookId}:`, error.error || response.statusText);
        failedCount++;
        continue;
      }

      const result = await response.json();
      console.log(`✅ Transformed ${facebookId} - curated: ${result.curated?.id}, rental: ${result.rental?.id}`);

      if (result.warnings && result.warnings.length > 0) {
        console.log(`   ⚠️  Warnings: ${result.warnings.join(', ')}`);
      }

      successCount++;

    } catch (error) {
      console.error(`❌ Error transforming ${record.facebook_id}:`, error);
      failedCount++;
    }
  }

  console.log(`\n📊 Phase 2 Summary: ${successCount} success, ${failedCount} failed\n`);
  return { success: successCount, failed: failedCount };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Facebook Rentals Backfill Script');
  console.log('============================================\n');

  // Phase 1: Export to raw JSON
  const phase1Results = await phase1ExportToRawJson();

  // Phase 2: Transform through pipeline
  const phase2Results = await phase2TransformThroughPipeline();

  // Final summary
  console.log('\n============================================');
  console.log('🎉 Backfill Complete!');
  console.log(`\nPhase 1 (Export): ${phase1Results.success} success, ${phase1Results.failed} failed`);
  console.log(`Phase 2 (Transform): ${phase2Results.success} success, ${phase2Results.failed} failed`);
  console.log('\n============================================\n');
}

main().catch(console.error);
