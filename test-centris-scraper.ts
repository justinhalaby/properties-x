import { CentrisRentalScraper } from './src/lib/scrapers/centris-rental-scraper';

async function testScraper() {
  const url = 'https://www.centris.ca/fr/condo-appartement~a-louer~montreal-cote-des-neiges-notre-dame-de-grace/16164131?nocontext=true&uc=0';

  console.log('🏠 Testing Centris Rental Scraper');
  console.log('URL:', url);
  console.log('');

  const scraper = new CentrisRentalScraper();

  if (!scraper.canHandle(url)) {
    console.error('❌ Scraper cannot handle this URL');
    return;
  }

  console.log('✅ URL pattern matches');
  console.log('');

  try {
    console.log('📥 Fetching and scraping...');
    const result = await scraper.scrape(url);

    console.log('✅ Scraping successful!');
    console.log('');
    console.log('=== SCRAPED DATA ===');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('=== SUMMARY ===');
    console.log('Centris ID:', result.centris_id);
    console.log('Listing ID:', result.listing_id);
    console.log('Property Type:', result.property_type);
    console.log('Address:', result.address);
    console.log('Price:', result.price_display || result.price);
    console.log('Coordinates:', result.latitude, result.longitude);
    console.log('Bedrooms:', result.bedrooms);
    console.log('Bathrooms:', result.bathrooms);
    console.log('Rooms:', result.rooms);
    console.log('Description Length:', result.description?.length || 0);
    console.log('Walk Score:', result.walk_score);
    console.log('Images:', result.images.length);
    console.log('High-Res Images:', result.images_high_res.length);
    console.log('Brokers:', result.brokers.length);
    console.log('Characteristics:', Object.keys(result.characteristics).length);
    console.log('');
    console.log('=== BROKERS ===');
    result.brokers.forEach((broker, i) => {
      console.log(`Broker ${i + 1}:`);
      console.log('  Name:', broker.name);
      console.log('  Title:', broker.title);
      console.log('  Agency:', broker.agency);
      console.log('  Phone:', broker.phone);
      console.log('  Website:', broker.website);
      console.log('');
    });

    console.log('=== CHARACTERISTICS ===');
    Object.entries(result.characteristics).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });

  } catch (error: any) {
    console.error('❌ Scraping failed:', error.message);
    console.error(error);
  }
}

testScraper();
