import { MontrealEvaluationScraper } from '../src/lib/scrapers/montreal-evaluation-scraper';

async function test() {
  console.log('\n🦊 Testing with Firefox browser...\n');
  console.log('📋 Matricule: 9939-13-1353-5-000-0000\n');

  const scraper = new MontrealEvaluationScraper();

  try {
    const data = await scraper.scrape("9939-13-1353-5-000-0000");
    console.log('\n✅ SUCCESS!\n');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

test();
