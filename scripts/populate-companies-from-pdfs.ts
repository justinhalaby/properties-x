import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import type { ScrapedCompanyData } from '@/types/company-registry';
import { saveCompanyData } from '@/lib/company-registry/save-company-data';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Initialize Supabase client with service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
}

if (!supabaseServiceKey) {
  console.error('⚠️  SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  console.error('   This script needs the service role key to bypass Row Level Security.');
  console.error('   You can find it in your Supabase dashboard under Settings > API');
  console.error('   Add it to .env.local as: SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Company 1: 9518-5369 Québec inc. (Mazzone)
 * From: /Users/justinhalaby/Downloads/Mazzone 1 administrateur 1 proprietaire.pdf
 */
const mazzoneCompany: ScrapedCompanyData = {
  neq: '1179920146',
  identification: {
    name: '9518-5369 Québec inc.',
    status: 'Immatriculée',
    domicile_address: '1231 av. Bernard Montréal (Québec) H2V1V7 Canada',
    registration_date: '2024-06-11',
    status_date: '2024-06-11',
  },
  shareholders: [
    {
      name: '9284-4695 Québec Inc.',
      address: '1231 av. Bernard Montréal (Québec) H2V1V7 Canada',
      is_majority: true,
      position: 1,
    },
  ],
  administrators: [
    {
      name: 'Agostino Mazzone',
      position_title: 'Président, Secrétaire',
      domicile_address: '',
      professional_address: '1231 av. Bernard Montréal (Québec) H2V1V7 Canada',
      position_order: 1,
    },
  ],
  economic_activity: {
    cae_code: '7599',
    cae_description: 'Autres exploitants immobiliers',
  },
  source_url: 'https://www.registreentreprises.gouv.qc.ca/REQNA/GR/GR03/GR03A71.RechercheRegistre.MVC/GR03A71',
};

/**
 * Company 2: GESTION INOBEL INC.
 * From: /Users/justinhalaby/Downloads/Bcp de monde et admin.pdf
 */
const inobelCompany: ScrapedCompanyData = {
  neq: '1172105943',
  identification: {
    name: 'GESTION INOBEL INC.',
    status: 'Immatriculée',
    domicile_address: '355 rue des Récollets Montréal (Québec) H2Y1V9 Canada',
    registration_date: '2016-08-31',
    status_date: '2016-08-31',
  },
  shareholders: [
    {
      name: '156009 Canada inc.',
      address: '355 rue des Récollets Montréal (Québec) H2Y1V9 Canada',
      is_majority: false,
      position: 1,
    },
    {
      name: 'Immoben Montréal s.e.c.',
      address: '900-1800 av. McGill College Montréal (Québec) H3A3J6 Canada',
      is_majority: false,
      position: 2,
    },
    {
      name: 'Gestion EGL inc.',
      address: '20-110 BOUL. de Mortagne Boucherville (Québec) J4B5M7 Canada',
      is_majority: false,
      position: 3,
    },
  ],
  administrators: [
    {
      name: 'André Nault',
      position_title: 'Président',
      domicile_address: '',
      professional_address: '355 rue des Récollets Montréal (Québec) H2Y1V9 Canada',
      position_order: 1,
    },
    {
      name: 'Pierre Leblanc',
      position_title: 'Vice-président',
      domicile_address: '',
      professional_address: '20-110 boul. de Mortagne Boucherville (Québec) J4B5M7 Canada',
      position_order: 2,
    },
    {
      name: 'Jean-Pierre Tremblay',
      position_title: 'Vice-président',
      domicile_address: '',
      professional_address: '401-2170 boul. René-Lévesque O Montréal (Québec) H3H2T8 Canada',
      position_order: 3,
    },
  ],
  economic_activity: {
    cae_code: '7511',
    cae_description: 'Exploitants de bâtiments résidentiels et de logements',
  },
  source_url: 'https://www.registreentreprises.gouv.qc.ca/REQNA/GR/GR03/GR03A71.RechercheRegistre.MVC/GR03A71',
};

async function populateCompanies() {
  console.log('🚀 Starting company data population from PDFs...\n');

  const companies = [
    { name: 'Mazzone Company', data: mazzoneCompany },
    { name: 'GESTION INOBEL INC.', data: inobelCompany },
  ];

  for (const { name, data } of companies) {
    console.log(`\n📋 Processing: ${name} (NEQ: ${data.neq})`);

    // Check if company already exists
    const { data: existing } = await supabase
      .from('companies')
      .select('id, company_name')
      .eq('neq', data.neq)
      .single();

    if (existing) {
      console.log(`  ⏭️  Company already exists: ${existing.company_name} (${existing.id})`);
      console.log(`     Skipping insertion.`);
      continue;
    }

    try {
      // Save company data (pass supabase client to avoid Next.js cookies issue)
      const companyId = await saveCompanyData(data, supabase);

      console.log(`  ✅ Successfully saved: ${data.identification.name}`);
      console.log(`     Company ID: ${companyId}`);
      console.log(`     Shareholders: ${data.shareholders.length}`);
      console.log(`     Administrators: ${data.administrators.length}`);

      // Display shareholders
      data.shareholders.forEach((s, idx) => {
        console.log(`       ${idx + 1}. ${s.name} ${s.is_majority ? '(Majority)' : ''}`);
      });

      // Display administrators
      data.administrators.forEach((a, idx) => {
        console.log(`       ${idx + 1}. ${a.name} - ${a.position_title}`);
      });

    } catch (error) {
      console.error(`  ❌ Failed to save ${name}:`, error);
      if (error instanceof Error) {
        console.error(`     Error: ${error.message}`);
      }
    }
  }

  console.log('\n✨ Company population complete!\n');
}

// Run the population
populateCompanies()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
