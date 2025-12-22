#!/usr/bin/env tsx

/**
 * Debug script for testing property evaluation scraping
 * Usage: npx tsx scripts/debug-scrape.ts <matricule>
 * Example: npx tsx scripts/debug-scrape.ts 9839-17-8236-3-000-0000
 */

const matricule = process.argv[2];

if (!matricule) {
  console.error('❌ Error: Matricule ID is required');
  console.log('\nUsage: npx tsx scripts/debug-scrape.ts <matricule>');
  console.log('Example: npx tsx scripts/debug-scrape.ts 9839-17-8236-3-000-0000');
  process.exit(1);
}

const API_URL = 'http://localhost:3000';

async function debugScrape() {
  console.log('🔍 Debug Scraping Tool');
  console.log('='.repeat(50));
  console.log(`📋 Matricule: ${matricule}`);
  console.log(`🌐 API URL: ${API_URL}`);
  console.log('='.repeat(50));
  console.log('');

  try {
    console.log('⏳ Checking if already scraped...');
    const checkResponse = await fetch(
      `${API_URL}/api/property-evaluations/${matricule}/scrape`,
      {
        method: 'GET',
      }
    );

    if (checkResponse.status === 409) {
      const data = await checkResponse.json();
      console.log('✅ Already scraped!');
      console.log('📅 Scraped at:', data.scraped_at);
      console.log('\n💡 Tip: Check the montreal_evaluation_details table in Supabase');
      return;
    }

    console.log('📡 Starting scrape...');
    console.log('');

    const scrapeResponse = await fetch(
      `${API_URL}/api/property-evaluations/${matricule}/scrape`,
      {
        method: 'POST',
      }
    );

    console.log(`📊 Response Status: ${scrapeResponse.status} ${scrapeResponse.statusText}`);
    console.log('');

    const responseText = await scrapeResponse.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Failed to parse JSON response');
      console.log('Raw response:');
      console.log(responseText);
      return;
    }

    if (!scrapeResponse.ok) {
      console.error('❌ Scraping Failed');
      console.log('');
      console.log('Error Details:');
      console.log(JSON.stringify(data, null, 2));

      if (data.error) {
        console.log('');
        console.log('🔴 Error:', data.error);
      }

      if (data.details) {
        console.log('');
        console.log('📋 Details:');
        console.log(JSON.stringify(data.details, null, 2));
      }

      return;
    }

    console.log('✅ Scraping Successful!');
    console.log('');
    console.log('📦 Response Data:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    if (data.data) {
      console.log('📍 Building Information:');
      console.log(`   Matricule: ${data.data.matricule}`);
      console.log(`   Address: ${data.data.address}`);
      console.log(`   Units: ${data.data.units}`);
      console.log(`   Value: ${data.data.value}`);
      console.log(`   Search Method: ${data.data.search_method}`);
      console.log(`   Scraped At: ${data.data.scraped_at}`);
    }

  } catch (error) {
    console.error('❌ Unexpected Error:');
    console.error(error);

    if (error instanceof Error) {
      console.log('');
      console.log('Error Message:', error.message);
      console.log('Stack Trace:');
      console.log(error.stack);
    }
  }
}

debugScrape();
