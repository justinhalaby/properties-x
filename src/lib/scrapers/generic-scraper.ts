import { BaseScraper } from "./base-scraper";
import type { SourceName, PropertyType } from "@/types/property";

export class GenericScraper extends BaseScraper {
  readonly sourceName: SourceName = "unknown";
  readonly urlPattern = /.*/; // Matches anything

  protected extractTitle(): string {
    const $ = this.$!;

    // Try common title patterns
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="title"]').attr("content") ||
      $("h1").first().text() ||
      $("title").text() ||
      "Untitled Property";

    return this.cleanText(title) || "Untitled Property";
  }

  protected extractAddress(): string | null {
    const $ = this.$!;

    // Try common address patterns
    const address =
      $('[itemprop="streetAddress"]').text() ||
      $('[class*="address"]').first().text() ||
      $('[id*="address"]').first().text();

    return this.cleanText(address);
  }

  protected extractCity(): string | null {
    const $ = this.$!;

    const city =
      $('[itemprop="addressLocality"]').text() ||
      $('[class*="city"]').first().text();

    return this.cleanText(city);
  }

  protected extractPostalCode(): string | null {
    const $ = this.$!;

    const postalCode = $('[itemprop="postalCode"]').text();
    if (postalCode) return this.cleanText(postalCode);

    // Try to find Canadian postal code pattern in page
    const bodyText = $("body").text();
    const postalMatch = bodyText.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/i);
    return postalMatch ? postalMatch[0].toUpperCase() : null;
  }

  protected extractPrice(): number | null {
    const $ = this.$!;

    // Try common price patterns
    const priceText =
      $('[itemprop="price"]').attr("content") ||
      $('[itemprop="price"]').text() ||
      $('[class*="price"]').first().text() ||
      $('meta[property="product:price:amount"]').attr("content");

    return this.parsePrice(priceText);
  }

  protected extractBedrooms(): number | null {
    const $ = this.$!;

    // Look for bedroom indicators
    const bedroomText =
      $('[class*="bedroom"]').first().text() ||
      $('[class*="bed"]').first().text();

    const match = bedroomText.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  protected extractBathrooms(): number | null {
    const $ = this.$!;

    const bathroomText =
      $('[class*="bathroom"]').first().text() ||
      $('[class*="bath"]').first().text();

    const match = bathroomText.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  protected extractSqft(): number | null {
    const $ = this.$!;

    const areaText =
      $('[class*="sqft"]').first().text() ||
      $('[class*="area"]').first().text() ||
      $('[class*="size"]').first().text();

    return this.parseNumber(areaText);
  }

  protected extractLotSize(): number | null {
    const $ = this.$!;

    const lotText = $('[class*="lot"]').first().text();
    return this.parseNumber(lotText);
  }

  protected extractYearBuilt(): number | null {
    const $ = this.$!;

    const yearText = $('[class*="year"]').first().text();
    const match = yearText.match(/(\d{4})/);
    return match ? parseInt(match[1]) : null;
  }

  protected extractPropertyType(): PropertyType | null {
    const $ = this.$!;

    const typeText =
      $('[class*="property-type"]').first().text() ||
      $('[class*="type"]').first().text() ||
      this.extractTitle();

    return this.inferPropertyType(typeText);
  }

  protected extractMlsNumber(): string | null {
    const $ = this.$!;

    const mlsText =
      $('[class*="mls"]').first().text() ||
      $('[class*="listing-id"]').first().text();

    const match = mlsText.match(/(\d+)/);
    return match ? match[1] : null;
  }

  protected extractDescription(): string | null {
    const $ = this.$!;

    const description =
      $('[itemprop="description"]').text() ||
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      $('[class*="description"]').first().text();

    return this.cleanText(description);
  }

  protected extractFeatures(): string[] {
    const $ = this.$!;
    const features: string[] = [];

    $('[class*="feature"] li, [class*="amenit"] li').each((_, el) => {
      const text = this.cleanText($(el).text());
      if (text) {
        features.push(text);
      }
    });

    return features;
  }

  protected extractImages(): string[] {
    const $ = this.$!;
    const images: string[] = [];

    // Get og:image first
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      images.push(ogImage);
    }

    // Look for gallery/carousel images
    $('[class*="gallery"] img, [class*="carousel"] img, [class*="slider"] img').each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && src.startsWith("http") && !src.includes("placeholder") && !src.includes("logo")) {
        images.push(src);
      }
    });

    return [...new Set(images)].slice(0, 20); // Limit to 20 images
  }
}
