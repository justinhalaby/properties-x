import { CentrisScraper } from "./centris-scraper";
import { GenericScraper } from "./generic-scraper";
import type { BaseScraper } from "./base-scraper";
import type { SourceName } from "@/types/property";

// Register all scrapers here
const scrapers: BaseScraper[] = [
  new CentrisScraper(),
  // Add more scrapers as they are implemented:
  // new RealtorScraper(),
  // new DuProprioScraper(),
  // new RemaxScraper(),
  // new RoyalLePageScraper(),
];

const genericScraper = new GenericScraper();

export function getScraperForUrl(url: string): BaseScraper {
  const scraper = scrapers.find((s) => s.canHandle(url));
  return scraper ?? genericScraper;
}

export function detectSource(url: string): SourceName {
  const scraper = scrapers.find((s) => s.canHandle(url));
  return scraper?.sourceName ?? "unknown";
}

export { BaseScraper } from "./base-scraper";
export { CentrisScraper } from "./centris-scraper";
export { CentrisRentalScraper } from "./centris-rental-scraper";
export { GenericScraper } from "./generic-scraper";
