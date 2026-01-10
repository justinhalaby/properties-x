/**
 * Check CentrisRentalCurated table and test transformation
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

async function main() {
  console.log('\n=== Checking CentrisRentalCurated Table ===\n');

  // 1. Check if table exists
  const { data: tables, error: tableError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .like('table_name', '%centris%');

  if (tableError) {
    console.error('Error checking tables:', tableError);
  } else {
    console.log('Centris-related tables:');
    tables?.forEach((t) => console.log(`  - ${t.table_name}`));
  }

  // 2. Check if CentrisRentalCurated table exists and is accessible
  const { data: curatedCheck, error: curatedError } = await supabase
    .from('CentrisRentalCurated')
    .select('count')
    .limit(1);

  console.log('\nCentrisRentalCurated table status:');
  if (curatedError) {
    console.error('  ❌ Table not accessible:', curatedError.message);
    console.log('\n⚠️  Migration 024 may not be applied yet.');
    console.log('   Apply it using: npx supabase db push');
    console.log('   Or manually in Supabase SQL editor.');
  } else {
    console.log('  ✅ Table exists and is accessible');
  }

  // 3. Count curated records
  const { count: curatedCount, error: countError } = await supabase
    .from('CentrisRentalCurated')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`  📊 Total curated records: ${curatedCount || 0}`);
  }

  // 4. Check metadata table for curated_id column
  const { data: metadataColumns, error: colError } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'centris_rentals_metadata');

  console.log('\ncentris_rentals_metadata columns:');
  if (colError) {
    console.error('  Error:', colError.message);
  } else {
    const hasCuratedId = metadataColumns?.some(c => c.column_name === 'curated_id');
    console.log(`  ${hasCuratedId ? '✅' : '❌'} curated_id column ${hasCuratedId ? 'exists' : 'missing'}`);
    if (!hasCuratedId) {
      console.log('\n⚠️  Migration 025 may not be applied yet.');
    }
  }

  // 5. Check for metadata records to transform
  const { data: metadata, error: metaError } = await supabase
    .from('centris_rentals_metadata')
    .select('centris_id, scrape_status, transformation_status, curated_id, rental_id')
    .limit(5);

  console.log('\nRecent metadata records:');
  if (metaError) {
    console.error('  Error:', metaError.message);
  } else if (!metadata || metadata.length === 0) {
    console.log('  No metadata records found');
  } else {
    console.log(`  Found ${metadata.length} records (showing first 5):\n`);
    metadata.forEach((m) => {
      console.log(`  Centris ID: ${m.centris_id}`);
      console.log(`    Scrape: ${m.scrape_status}`);
      console.log(`    Transform: ${m.transformation_status}`);
      console.log(`    Curated ID: ${m.curated_id || 'null'}`);
      console.log(`    Rental ID: ${m.rental_id || 'null'}`);
      console.log('');
    });

    // 6. Suggest transformation
    const needsTransform = metadata.find(
      (m) => m.scrape_status === 'success' && !m.curated_id
    );

    if (needsTransform) {
      console.log('\n💡 Suggestion:');
      console.log('   You have scraped data that needs transformation.');
      console.log(`   Test the transform API with: ${needsTransform.centris_id}`);
      console.log('\n   curl -X POST http://localhost:3000/api/centris-rentals/transform \\');
      console.log('     -H "Content-Type: application/json" \\');
      console.log(`     -d '{"centrisId": "${needsTransform.centris_id}"}'`);
    }
  }

  console.log('\n=== Check Complete ===\n');
}

main().catch(console.error);
