import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { CentrisScraperResult } from '@/types/centris-rental-raw';

/**
 * Scraper for Centris.ca rental listings
 * URL pattern: centris.ca with ~a-louer~ (French for "for rent")
 *
 * Returns raw data in Centris-native format (minimal transformation)
 * Matches the structure from consoleScrape/centris-rentals.js
 */
export class CentrisRentalScraper {
  readonly sourceName = 'centris';
  readonly urlPattern = /centris\.ca.*~a-louer~/i;

  private $: CheerioAPI | null = null;

  canHandle(url: string): boolean {
    return this.urlPattern.test(url);
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-CA,fr;q=0.9,en-CA;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Main scrape method using actual Centris page structure
   */
  async scrape(url: string): Promise<CentrisScraperResult> {
    const html = await this.fetchHtml(url);
    this.$ = cheerio.load(html);

    const centrisId = this.extractCentrisId(url);

    return {
      centris_id: centrisId,
      source_url: url,

      // Basic info
      listing_id: this.extractListingId(),
      property_type: this.extractPropertyType(),
      address: this.extractAddress(),

      // Price
      price: this.extractPrice(),
      price_currency: this.extractPriceCurrency(),
      price_display: this.extractPriceDisplay(),

      // Coordinates
      latitude: this.extractLatitude(),
      longitude: this.extractLongitude(),

      // Room info
      rooms: this.extractRooms(),
      bedrooms: this.extractBedrooms(),
      bathrooms: this.extractBathrooms(),

      // Characteristics
      characteristics: this.extractCharacteristics(),

      // Description
      description: this.extractDescription(),

      // Walk Score
      walk_score: this.extractWalkScore(),

      // Images
      images: this.extractImages(),
      images_high_res: this.extractImagesHighRes(),

      // Brokers
      brokers: this.extractBrokers(),

      html_snippet: html.substring(0, 5000),
    };
  }

  private extractCentrisId(url: string): string {
    const match = url.match(/\/(\d+)(?:\?|$)/);
    if (!match) {
      throw new Error('Could not extract Centris ID from URL: ' + url);
    }
    return match[1];
  }

  private extractListingId(): string | null {
    const $ = this.$!;
    return $('#ListingId').text().trim() ||
           $('#ListingDisplayId').text().trim() ||
           null;
  }

  private extractPropertyType(): string | null {
    const $ = this.$!;
    const text = $('[data-id="PageTitle"]').text().trim();
    if (!text) return null;

    // Remove duplicates (sometimes the title appears twice)
    const parts = text.split(/(?=[A-Z])/);
    const unique = [...new Set(parts)];
    return unique.join('').trim();
  }

  private extractAddress(): string | null {
    const $ = this.$!;
    const text = $('h2[itemprop="address"]').text().trim();
    if (!text) return null;

    // Remove duplicates and extra whitespace
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    // Take first unique line
    return lines[0] || null;
  }

  private extractPrice(): string | null {
    const $ = this.$!;
    return $('meta[itemprop="price"]').attr('content') || null;
  }

  private extractPriceCurrency(): string | null {
    const $ = this.$!;
    return $('meta[itemprop="priceCurrency"]').attr('content') || null;
  }

  private extractPriceDisplay(): string | null {
    const $ = this.$!;
    return $('.price .text-nowrap').text().trim() || null;
  }

  private extractLatitude(): string | null {
    const $ = this.$!;
    return $('meta[itemprop="latitude"]').attr('content') || null;
  }

  private extractLongitude(): string | null {
    const $ = this.$!;
    return $('meta[itemprop="longitude"]').attr('content') || null;
  }

  private extractRooms(): string | null {
    const $ = this.$!;
    return $('.teaser .piece').text().trim() || null;
  }

  private extractBedrooms(): string | null {
    const $ = this.$!;
    return $('.teaser .cac').text().trim() || null;
  }

  private extractBathrooms(): string | null {
    const $ = this.$!;
    return $('.teaser .sdb').text().trim() || null;
  }

  private extractCharacteristics(): Record<string, string> {
    const $ = this.$!;
    const characteristics: Record<string, string> = {};

    $('.carac-container').each((_, container) => {
      const title = $(container).find('.carac-title').text().trim();
      const value = $(container).find('.carac-value span').text().trim();
      if (title && value) {
        characteristics[title] = value;
      }
    });

    return characteristics;
  }

  private extractDescription(): string | null {
    const $ = this.$!;
    return $('[itemprop="description"]').text().trim() || null;
  }

  private extractWalkScore(): string | null {
    const $ = this.$!;
    return $('.walkscore span').text().trim() || null;
  }

  private extractImages(): string[] {
    const $ = this.$!;
    const images: string[] = [];

    // Try to extract from photo data attribute
    const photoData = $('#property-roomvo-data');
    if (photoData.length) {
      const photoUrls = photoData.attr('data-photo-urls');
      if (photoUrls) {
        return photoUrls.split(',').map(url => url.trim());
      }
    }

    // Fallback: extract from visible images
    $('.summary-photos img').each((_, img) => {
      const src = $(img).attr('src');
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });

    return images;
  }

  private extractImagesHighRes(): string[] {
    const images = this.extractImages();
    // Replace thumbnail size with larger size
    return images.map(url => url.replace(/w=\d+&h=\d+/, 'w=1024&h=768'));
  }

  private extractBrokers(): Array<{
    name: string | null;
    title: string | null;
    phone: string | null;
    agency: string | null;
    photo: string | null;
    website: string | null;
  }> {
    const $ = this.$!;
    const brokers: Array<{
      name: string | null;
      title: string | null;
      phone: string | null;
      agency: string | null;
      photo: string | null;
      website: string | null;
    }> = [];

    $('.property-summary-item__brokers-content .broker-info').each((_, broker) => {
      const $broker = $(broker);
      const brokerData = {
        name: $broker.find('[itemprop="name"]').text().trim() || null,
        title: $broker.find('[itemprop="jobTitle"]').text().trim() || null,
        phone: $broker.find('[itemprop="telephone"]').text().trim() || null,
        agency: $broker.find('[itemprop="legalName"]').text().trim() || null,
        photo: $broker.find('.broker-info-broker-image').attr('src') || null,
        website: $broker.find('a[target="_blank"]').attr('href') || null,
      };

      if (brokerData.name) {
        brokers.push(brokerData);
      }
    });

    return brokers;
  }
}
