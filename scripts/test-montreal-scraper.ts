import { MontrealEvaluationScraper } from "../src/lib/scrapers/montreal-evaluation-scraper";

async function testScraper() {
  const testMatricule = "9939-13-1353-5-000-0000"; // Example matricule

  console.log("🧪 Testing Montreal Evaluation Scraper");
  console.log("📋 Matricule:", testMatricule);
  console.log("⏳ Starting scrape...\n");

  try {
    const scraper = new MontrealEvaluationScraper();
    const result = await scraper.scrape(testMatricule);

    console.log("✅ Scraping successful!");
    console.log("\n📊 Results:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Scraping failed!");
    console.error("Error:", error);

    if (error instanceof Error) {
      console.error("\nError message:", error.message);
      console.error("\nStack trace:", error.stack);
    }
  }
}

testScraper();
