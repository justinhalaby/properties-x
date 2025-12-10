import * as cheerio from "cheerio";
import type { ScrapedProperty, SourceName, PropertyType } from "@/types/property";
import { getHeaders } from "@/lib/utils/user-agents";

export abstract class BaseScraper {
  protected $: cheerio.CheerioAPI | null = null;

  abstract readonly sourceName: SourceName;
  abstract readonly urlPattern: RegExp;

  canHandle(url: string): boolean {
    return this.urlPattern.test(url);
  }

  async scrape(url: string): Promise<ScrapedProperty> {
    const html = await this.fetchHtml(url);
    this.$ = cheerio.load(html);

    return {
      source_url: url,
      source_name: this.sourceName,
      title: this.extractTitle(),
      address: this.extractAddress(),
      city: this.extractCity(),
      postal_code: this.extractPostalCode(),
      price: this.extractPrice(),
      bedrooms: this.extractBedrooms(),
      bathrooms: this.extractBathrooms(),
      sqft: this.extractSqft(),
      lot_size: this.extractLotSize(),
      year_built: this.extractYearBuilt(),
      property_type: this.extractPropertyType(),
      units: this.extractUnits(),
      unit_details: this.extractUnitDetails(),
      mls_number: this.extractMlsNumber(),
      description: this.extractDescription(),
      features: this.extractFeatures(),
      images: this.extractImages(),
      potential_revenue: this.extractPotentialRevenue(),
      municipal_assessment: this.extractMunicipalAssessment(),
      assessment_land: this.extractAssessmentLand(),
      assessment_building: this.extractAssessmentBuilding(),
      taxes: this.extractTaxes(),
      taxes_municipal: this.extractTaxesMunicipal(),
      taxes_school: this.extractTaxesSchool(),
      expenses: this.extractExpenses(),
      expense_electricity: this.extractExpenseElectricity(),
      expense_heating: this.extractExpenseHeating(),
    };
  }

  protected async fetchHtml(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: getHeaders("fr"),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  // Helper methods for parsing
  protected parsePrice(text: string | undefined): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^0-9.,]/g, "").replace(",", "");
    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
  }

  protected parseNumber(text: string | undefined): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^0-9.,]/g, "").replace(",", "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  protected cleanText(text: string | undefined): string | null {
    if (!text) return null;
    return text.trim().replace(/\s+/g, " ") || null;
  }

  protected inferPropertyType(text: string): PropertyType | null {
    const lower = text.toLowerCase();

    // Multi-residential / revenue properties
    if (lower.includes("multifamilial") || lower.includes("multi-familial") || lower.includes("multi-residential") || lower.includes("multiresidential") || lower.includes("immeuble de rapport") || lower.includes("immeuble à revenus")) {
      return "multi_residential";
    }
    if (lower.includes("quintuplex") || lower.includes("5-plex") || lower.includes("5 plex")) {
      return "quintuplex";
    }
    if (lower.includes("quadruplex") || lower.includes("4-plex") || lower.includes("4 plex")) {
      return "quadruplex";
    }
    if (lower.includes("triplex") || lower.includes("3-plex") || lower.includes("3 plex")) {
      return "triplex";
    }
    if (lower.includes("duplex") || lower.includes("2-plex") || lower.includes("2 plex")) {
      return "duplex";
    }
    if (lower.includes("plex") || lower.includes("multiplex") || lower.includes("revenue")) {
      return "plex";
    }
    if (lower.includes("condo") || lower.includes("appartement") || lower.includes("apartment")) {
      return "condo";
    }
    if (lower.includes("terrain") || lower.includes("land") || lower.includes("lot")) {
      return "land";
    }
    if (lower.includes("commercial") || lower.includes("bureau") || lower.includes("office")) {
      return "commercial";
    }
    if (lower.includes("maison") || lower.includes("house") || lower.includes("detached") || lower.includes("unifamiliale")) {
      return "single_family";
    }

    return null;
  }

  // Abstract methods - each scraper must implement
  protected abstract extractTitle(): string;
  protected abstract extractAddress(): string | null;
  protected abstract extractCity(): string | null;
  protected abstract extractPostalCode(): string | null;
  protected abstract extractPrice(): number | null;
  protected abstract extractBedrooms(): number | null;
  protected abstract extractBathrooms(): number | null;
  protected abstract extractSqft(): number | null;
  protected abstract extractLotSize(): number | null;
  protected abstract extractYearBuilt(): number | null;
  protected abstract extractPropertyType(): PropertyType | null;
  protected abstract extractUnits(): number | null;
  protected abstract extractUnitDetails(): string | null;
  protected abstract extractMlsNumber(): string | null;
  protected abstract extractDescription(): string | null;
  protected abstract extractFeatures(): string[];
  protected abstract extractImages(): string[];
  // Financial data extraction
  protected abstract extractPotentialRevenue(): number | null;
  protected abstract extractMunicipalAssessment(): number | null;
  protected abstract extractAssessmentLand(): number | null;
  protected abstract extractAssessmentBuilding(): number | null;
  protected abstract extractTaxes(): number | null;
  protected abstract extractTaxesMunicipal(): number | null;
  protected abstract extractTaxesSchool(): number | null;
  protected abstract extractExpenses(): number | null;
  protected abstract extractExpenseElectricity(): number | null;
  protected abstract extractExpenseHeating(): number | null;
}
