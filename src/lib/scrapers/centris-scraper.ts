import { BaseScraper } from "./base-scraper";
import type { SourceName, PropertyType } from "@/types/property";

export class CentrisScraper extends BaseScraper {
  readonly sourceName: SourceName = "centris";
  readonly urlPattern = /centris\.ca/i;

  protected extractTitle(): string {
    const $ = this.$!;

    // Try multiple selectors for title
    const title =
      $('h1[itemprop="name"]').text() ||
      $(".listing-title").text() ||
      $("h1").first().text() ||
      $('meta[property="og:title"]').attr("content") ||
      "Untitled Property";

    return this.cleanText(title) || "Untitled Property";
  }

  protected extractAddress(): string | null {
    const $ = this.$!;

    const address =
      $('[itemprop="streetAddress"]').text() ||
      $(".address-container .address").text() ||
      $(".listing-address").text();

    return this.cleanText(address);
  }

  protected extractCity(): string | null {
    const $ = this.$!;

    const city =
      $('[itemprop="addressLocality"]').text() ||
      $(".address-container .city").text();

    return this.cleanText(city);
  }

  protected extractPostalCode(): string | null {
    const $ = this.$!;

    const postalCode =
      $('[itemprop="postalCode"]').text() ||
      $(".address-container .postal-code").text();

    return this.cleanText(postalCode);
  }

  protected extractPrice(): number | null {
    const $ = this.$!;

    const priceText =
      $('[itemprop="price"]').attr("content") ||
      $('[itemprop="price"]').text() ||
      $(".price").first().text() ||
      $(".listing-price").text();

    return this.parsePrice(priceText);
  }

  protected extractBedrooms(): number | null {
    const $ = this.$!;

    // Look for bedroom count in various places
    const bedroomText =
      $('[data-label="Bedrooms"]').text() ||
      $(".cac").text() || // "chambres à coucher"
      $(".bedrooms").text();

    const match = bedroomText.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  protected extractBathrooms(): number | null {
    const $ = this.$!;

    const bathroomText =
      $('[data-label="Bathrooms"]').text() ||
      $(".sdb").text() || // "salles de bain"
      $(".bathrooms").text();

    const match = bathroomText.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  protected extractSqft(): number | null {
    const $ = this.$!;

    // Look for square footage - Centris often uses metric (m²)
    const areaText =
      $('[data-label="Living area"]').text() ||
      $('[data-label="Superficie habitable"]').text() ||
      $(".living-area").text();

    // Check if it's in square meters and convert
    if (areaText.includes("m²") || areaText.includes("m2")) {
      const sqm = this.parseNumber(areaText);
      return sqm ? Math.round(sqm * 10.764) : null; // Convert m² to sqft
    }

    return this.parseNumber(areaText);
  }

  protected extractLotSize(): number | null {
    const $ = this.$!;

    const lotText =
      $('[data-label="Lot dimensions"]').text() ||
      $('[data-label="Dimensions du terrain"]').text() ||
      $(".lot-size").text();

    // Parse lot dimensions (e.g., "50 x 100" or "5000 sqft")
    const sqftMatch = lotText.match(/([\d,]+)\s*(?:sq\.?\s*ft|pi2|sqft)/i);
    if (sqftMatch) {
      return this.parseNumber(sqftMatch[1]);
    }

    // Handle "width x depth" format
    const dimMatch = lotText.match(/([\d.]+)\s*x\s*([\d.]+)/i);
    if (dimMatch) {
      const width = parseFloat(dimMatch[1]);
      const depth = parseFloat(dimMatch[2]);
      return Math.round(width * depth);
    }

    return null;
  }

  protected extractYearBuilt(): number | null {
    const $ = this.$!;

    const yearText =
      $('[data-label="Year built"]').text() ||
      $('[data-label="Année de construction"]').text() ||
      $(".year-built").text();

    const match = yearText.match(/(\d{4})/);
    return match ? parseInt(match[1]) : null;
  }

  protected extractPropertyType(): PropertyType | null {
    const $ = this.$!;

    const typeText =
      $('[data-label="Property type"]').text() ||
      $('[data-label="Type de propriété"]').text() ||
      $(".property-type").text() ||
      this.extractTitle();

    return this.inferPropertyType(typeText);
  }

  protected extractMlsNumber(): string | null {
    const $ = this.$!;

    const mlsText =
      $('[data-label="MLS"]').text() ||
      $('[data-label="Centris No."]').text() ||
      $(".mls-number").text();

    const match = mlsText.match(/(\d+)/);
    return match ? match[1] : null;
  }

  protected extractDescription(): string | null {
    const $ = this.$!;

    const description =
      $('[itemprop="description"]').text() ||
      $(".description-text").text() ||
      $(".listing-description").text();

    return this.cleanText(description);
  }

  protected extractFeatures(): string[] {
    const $ = this.$!;
    const features: string[] = [];

    // Look for feature lists
    $(".feature-list li, .characteristics li, .amenities li").each((_, el) => {
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

    // Look for gallery images
    $('img[itemprop="image"], .gallery img, .photo-gallery img, .carousel img').each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && !src.includes("placeholder") && !src.includes("logo")) {
        // Make sure URL is absolute
        if (src.startsWith("http")) {
          images.push(src);
        } else if (src.startsWith("//")) {
          images.push(`https:${src}`);
        }
      }
    });

    // Also check for og:image
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage && !images.includes(ogImage)) {
      images.unshift(ogImage);
    }

    return [...new Set(images)]; // Remove duplicates
  }
}
