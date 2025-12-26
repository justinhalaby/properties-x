import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Initialize Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Normalizes a company/owner name for comparison
 * - Converts to lowercase
 * - Removes extra spaces
 * - Removes common punctuation
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .trim();
}

/**
 * Checks if two names match
 * Returns confidence level: 'exact' or null
 */
function matchNames(companyName: string, ownerName: string): 'exact' | 'fuzzy' | null {
  const normalizedCompany = normalizeName(companyName);
  const normalizedOwner = normalizeName(ownerName);

  // Exact match
  if (normalizedCompany === normalizedOwner) {
    return 'exact';
  }

  // Fuzzy match: owner name contains company name or vice versa
  // This helps match variations like "GESTION INOBEL INC." vs "GESTION INOBEL"
  if (normalizedOwner.includes(normalizedCompany) || normalizedCompany.includes(normalizedOwner)) {
    // Only consider it fuzzy if the match is substantial (at least 80% of the shorter name)
    const shorterLength = Math.min(normalizedCompany.length, normalizedOwner.length);
    const longerLength = Math.max(normalizedCompany.length, normalizedOwner.length);

    if (shorterLength / longerLength >= 0.8) {
      return 'fuzzy';
    }
  }

  return null;
}

async function autoLinkCompaniesToProperties() {
  console.log('🔗 Starting automatic company-to-property linking...\n');

  // 1. Fetch all companies
  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('id, company_name, neq');

  if (companiesError) {
    throw new Error(`Failed to fetch companies: ${companiesError.message}`);
  }

  console.log(`Found ${companies.length} companies\n`);

  // 2. Fetch all properties
  const { data: properties, error: propertiesError } = await supabase
    .from('montreal_evaluation_details')
    .select('matricule, owner_name, address');

  if (propertiesError) {
    throw new Error(`Failed to fetch properties: ${propertiesError.message}`);
  }

  console.log(`Found ${properties.length} properties\n`);

  let totalLinks = 0;
  let exactMatches = 0;
  let fuzzyMatches = 0;
  let skippedExisting = 0;

  // 3. For each company, find matching properties
  for (const company of companies) {
    console.log(`\n📋 Processing: ${company.company_name} (NEQ: ${company.neq})`);

    let companyLinks = 0;

    for (const property of properties) {
      if (!property.owner_name) continue;

      const matchType = matchNames(company.company_name, property.owner_name);

      if (matchType) {
        // Check if link already exists
        const { data: existingLink } = await supabase
          .from('property_company_links')
          .select('id')
          .eq('matricule', property.matricule)
          .eq('company_id', company.id)
          .single();

        if (existingLink) {
          skippedExisting++;
          continue;
        }

        // Create the link
        const { error: linkError } = await supabase
          .from('property_company_links')
          .insert({
            matricule: property.matricule,
            company_id: company.id,
            link_confidence: matchType,
            link_method: 'auto_detection',
            verified: matchType === 'exact', // Auto-verify exact matches
            verified_at: matchType === 'exact' ? new Date().toISOString() : null,
            notes: `Auto-linked based on owner name match (${matchType})`,
          });

        if (linkError) {
          console.error(`  ❌ Failed to link ${property.matricule}:`, linkError.message);
          continue;
        }

        console.log(`  ✅ Linked property ${property.matricule} (${property.address})`);
        console.log(`     Owner: ${property.owner_name}`);
        console.log(`     Match: ${matchType}`);

        companyLinks++;
        totalLinks++;

        if (matchType === 'exact') exactMatches++;
        if (matchType === 'fuzzy') fuzzyMatches++;
      }
    }

    if (companyLinks === 0) {
      console.log(`  ℹ️  No matching properties found`);
    } else {
      console.log(`  📊 Created ${companyLinks} link(s) for this company`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Auto-linking complete!\n');
  console.log(`Total links created: ${totalLinks}`);
  console.log(`  - Exact matches: ${exactMatches} (auto-verified)`);
  console.log(`  - Fuzzy matches: ${fuzzyMatches} (require manual verification)`);
  console.log(`  - Skipped (already linked): ${skippedExisting}`);
  console.log('='.repeat(60) + '\n');
}

// Run the auto-linking
autoLinkCompaniesToProperties()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
