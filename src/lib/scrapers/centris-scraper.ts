import { BaseScraper } from "./base-scraper";
import type { SourceName, PropertyType } from "@/types/property";

export class CentrisScraper extends BaseScraper {
  readonly sourceName: SourceName = "centris";
  readonly urlPattern = /centris\.ca/i;

  protected extractTitle(): string {
    const $ = this.$!;

    // Try og:title first as it often contains property type and address
    const ogTitle = $('meta[property="og:title"]').attr("content");
    if (ogTitle && !ogTitle.toLowerCase().includes("centris")) {
      return this.cleanText(ogTitle) || "Untitled Property";
    }

    // Try h1 but filter out agent names (usually contain "Courtier" or are very short)
    const h1Text = $("h1").first().text();
    if (h1Text && h1Text.length > 20 && !h1Text.toLowerCase().includes("courtier")) {
      return this.cleanText(h1Text) || "Untitled Property";
    }

    // Extract from URL pattern: ~type~city/id
    const bodyText = $("body").text();
    // Look for property type pattern in page
    const typeMatch = bodyText.match(/(multifamilial|duplex|triplex|quadruplex|quintuplex|maison|condo)/i);
    const type = typeMatch ? typeMatch[1] : "Property";

    return `${type.charAt(0).toUpperCase() + type.slice(1)} - ${this.extractCity() || "Montreal"}`;
  }

  protected extractAddress(): string | null {
    const $ = this.$!;

    // Try structured data first
    let address =
      $('[itemprop="streetAddress"]').text() ||
      $(".address-container .address").text() ||
      $(".listing-address").text();

    if (address) return this.cleanText(address);

    // Search in body for Montreal address patterns
    const bodyText = $("body").text();
    // Match patterns like "1234 rue/avenue/boulevard Name"
    const addressMatch = bodyText.match(/(\d{1,5}\s+(?:rue|avenue|av\.|boul\.|boulevard|chemin|ch\.|place|pl\.)\s+[A-Za-zÀ-ÿ\-\s]+?)(?:,|\s+Montréal|\s+Montreal|\s+H\d)/i);
    if (addressMatch) {
      return this.cleanText(addressMatch[1]);
    }

    return null;
  }

  protected extractCity(): string | null {
    const $ = this.$!;

    let city =
      $('[itemprop="addressLocality"]').text() ||
      $(".address-container .city").text();

    if (city) return this.cleanText(city);

    // Extract from URL or body text
    const bodyText = $("body").text();
    // Common Montreal boroughs
    const boroughs = ["côte-des-neiges", "notre-dame-de-grâce", "ndg", "plateau", "rosemont", "villeray", "ahuntsic", "verdun", "lasalle", "lachine", "outremont", "westmount", "ville-marie", "hochelaga", "mercier"];
    for (const borough of boroughs) {
      if (bodyText.toLowerCase().includes(borough)) {
        return "Montreal";
      }
    }

    return "Montreal"; // Default for Centris Quebec listings
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

  protected extractUnits(): number | null {
    const $ = this.$!;

    // Look for number of units/logements in characteristic rows
    let unitsText = "";
    $(".carac-value, .property-characteristic-value, [class*='characteristic'] span").each((_, el) => {
      const label = $(el).prev().text().toLowerCase();
      const text = $(el).text();
      if (label.includes("logement") || label.includes("unit")) {
        unitsText = text;
        return false; // break
      }
    });

    // Also try data-label approach
    if (!unitsText) {
      unitsText =
        $('[data-label="Number of units"]').text() ||
        $('[data-label="Nombre de logements"]').text() ||
        $('[data-label="Units"]').text() ||
        $('[data-label="Logements"]').text();
    }

    const match = unitsText.match(/(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }

    // Try to infer from property type in title
    const title = this.extractTitle().toLowerCase();
    if (title.includes("duplex") || title.includes("2-plex")) return 2;
    if (title.includes("triplex") || title.includes("3-plex")) return 3;
    if (title.includes("quadruplex") || title.includes("4-plex")) return 4;
    if (title.includes("quintuplex") || title.includes("5-plex")) return 5;

    // Check for "X logements" pattern in title or description
    const bodyText = $("body").text();
    const logementMatch = bodyText.match(/(\d+)\s*(?:logements?|units?|appartements?)/i);
    if (logementMatch) {
      return parseInt(logementMatch[1]);
    }

    return null;
  }

  protected extractUnitDetails(): string | null {
    const $ = this.$!;
    const unitDetails: string[] = [];

    // Look for unit breakdown table or list (e.g., "2 x 4½, 1 x 5½")
    $(".unit-table tr, .units-list li, [class*='unit'] li, .logement-item").each((_, el) => {
      const text = this.cleanText($(el).text());
      if (text && (text.includes("½") || text.match(/\d+\s*x\s*\d/i) || text.match(/\d+\s*pièces?/i))) {
        unitDetails.push(text);
      }
    });

    if (unitDetails.length > 0) {
      return unitDetails.join(", ");
    }

    // Try to find unit breakdown in characteristics section
    const bodyText = $("body").text();
    // Match patterns like "2 x 4½" or "1 x 5½" or "3½, 4½, 5½"
    const unitPatterns = bodyText.match(/(\d+\s*x\s*\d+½?|\d+½)/gi);
    if (unitPatterns && unitPatterns.length > 0) {
      // Filter out common non-unit patterns (like dimensions)
      const filteredPatterns = unitPatterns.filter(p => p.includes("½") || p.match(/^\d+\s*x\s*[3-9]/));
      if (filteredPatterns.length > 0) {
        return [...new Set(filteredPatterns)].join(", ");
      }
    }

    return null;
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

  protected extractPotentialRevenue(): number | null {
    const $ = this.$!;

    // Look for revenue/revenus in financial section
    let revenueText = "";
    $(".financial-info, .revenue-info, [class*='financial'], [class*='revenue']").each((_, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes("revenu") || text.includes("revenue") || text.includes("potentiel")) {
        revenueText = $(el).text();
        return false;
      }
    });

    // Also search in characteristic rows
    $(".carac-value, .property-characteristic-value, [class*='teaser'] div").each((_, el) => {
      const label = $(el).prev().text().toLowerCase();
      const labelParent = $(el).parent().text().toLowerCase();
      if (label.includes("revenu") || labelParent.includes("revenu potentiel") ||
          label.includes("income") || labelParent.includes("potential income")) {
        revenueText = $(el).text();
        return false;
      }
    });

    // Search in body text for revenue pattern
    if (!revenueText) {
      const bodyText = $("body").text();
      const revenueMatch = bodyText.match(/(?:revenus?\s*(?:potentiels?|annuels?)?|potential\s*(?:revenue|income))\s*:?\s*\$?\s*([\d\s,]+)/i);
      if (revenueMatch) {
        return this.parsePrice(revenueMatch[1]);
      }
    }

    return this.parsePrice(revenueText);
  }

  protected extractMunicipalAssessment(): number | null {
    const $ = this.$!;

    // Look for Total in Évaluation municipale table
    let total: number | null = null;
    $(".financial-details-table").each((_, table) => {
      const tableText = $(table).text();
      if (/[ÉE]valuation\s*municipale/i.test(tableText)) {
        $(table).find(".financial-details-table-total td.text-right, tfoot td.text-right").each((_, cell) => {
          const parsed = this.parsePrice($(cell).text());
          if (parsed && parsed > 0) {
            total = parsed;
            return false;
          }
        });
      }
    });

    if (total) return total;

    // Fallback: search in body text
    const bodyText = $("body").text();
    const assessmentMatch = bodyText.match(/(?:évaluation\s*municipale|municipal\s*assessment)[^\d]*Total[^\d]*([\d\s,]+)\s*\$/i);
    if (assessmentMatch) {
      return this.parsePrice(assessmentMatch[1]);
    }

    return null;
  }

  protected extractTaxes(): number | null {
    const $ = this.$!;

    // Look for Total in yearly Taxes table
    let total: number | null = null;
    $(".financial-details-table-yearly").each((_, table) => {
      const tableText = $(table).text();
      // Find Taxes table (contains Municipales or Scolaires)
      if (/Taxes/i.test(tableText) && /Municipales|Scolaires/i.test(tableText)) {
        $(table).find(".financial-details-table-total td.text-right, tfoot td.text-right").each((_, cell) => {
          const parsed = this.parsePrice($(cell).text());
          if (parsed && parsed > 0) {
            total = parsed;
            return false;
          }
        });
        if (total) return false;
      }
    });

    if (total) return total;

    // Fallback: search in body for yearly taxes total
    const bodyText = $("body").text();
    const taxMatch = bodyText.match(/Taxes[^\d]*Total[^\d]*([\d\s,]+)\s*\$/i);
    if (taxMatch) {
      return this.parsePrice(taxMatch[1]);
    }

    return null;
  }

  protected extractExpenses(): number | null {
    const $ = this.$!;

    // Look for Total in yearly Dépenses table (contains Mazout or Électricité)
    let total: number | null = null;
    $(".financial-details-table-yearly").each((_, table) => {
      const tableText = $(table).text();
      // Find expenses table (contains Mazout or Électricité but not Taxes)
      if (((/Mazout|[ÉE]lectricit[ée]/i.test(tableText)) && !/Taxes/i.test(tableText))) {
        $(table).find(".financial-details-table-total td.text-right, tfoot td.text-right").each((_, cell) => {
          const parsed = this.parsePrice($(cell).text());
          if (parsed && parsed > 0) {
            total = parsed;
            return false;
          }
        });
        if (total) return false;
      }
    });

    if (total) return total;

    // Fallback: search in body for expenses total
    const bodyText = $("body").text();
    const expenseMatch = bodyText.match(/(?:D[ée]penses|Expenses)[^\d]*Total[^\d]*([\d\s,]+)\s*\$/i);
    if (expenseMatch) {
      return this.parsePrice(expenseMatch[1]);
    }

    return null;
  }

  // Helper to extract value from financial table row
  private extractFinancialValue(labelPattern: RegExp): number | null {
    const $ = this.$!;
    let value: number | null = null;

    // Look in financial-details tables (prefer yearly)
    $(".financial-details-table-yearly tr, .financial-details-table tr").each((_, row) => {
      const rowText = $(row).text();
      if (labelPattern.test(rowText)) {
        const valueCell = $(row).find("td.text-right, td:last-child").text();
        const parsed = this.parsePrice(valueCell);
        if (parsed && parsed > 0) {
          value = parsed;
          return false; // break
        }
      }
    });

    // Fallback: search in body text with pattern "Label ... $Value"
    if (!value) {
      const html = $.html();
      // Pattern: label followed by value with $ sign on same or next line
      const patterns = html.match(new RegExp(labelPattern.source + '[\\s\\S]*?([\\d\\s\\xa0,]+)\\s*\\$', 'i'));
      if (patterns && patterns[1]) {
        value = this.parsePrice(patterns[1].replace(/\xa0/g, ' '));
      }
    }

    return value;
  }

  protected extractAssessmentLand(): number | null {
    return this.extractFinancialValue(/Terrain/i);
  }

  protected extractAssessmentBuilding(): number | null {
    return this.extractFinancialValue(/B[âa]timent/i);
  }

  protected extractTaxesMunicipal(): number | null {
    // Look for yearly value (higher number)
    const $ = this.$!;
    let yearlyValue: number | null = null;

    $(".financial-details-table-yearly tr").each((_, row) => {
      const rowText = $(row).text();
      if (/Municipales/i.test(rowText)) {
        const valueCell = $(row).find("td.text-right, td:last-child").text();
        const parsed = this.parsePrice(valueCell);
        if (parsed && parsed > 0) {
          yearlyValue = parsed;
          return false;
        }
      }
    });

    return yearlyValue || this.extractFinancialValue(/Municipales/i);
  }

  protected extractTaxesSchool(): number | null {
    const $ = this.$!;
    let yearlyValue: number | null = null;

    $(".financial-details-table-yearly tr").each((_, row) => {
      const rowText = $(row).text();
      if (/Scolaires/i.test(rowText)) {
        const valueCell = $(row).find("td.text-right, td:last-child").text();
        const parsed = this.parsePrice(valueCell);
        if (parsed && parsed > 0) {
          yearlyValue = parsed;
          return false;
        }
      }
    });

    return yearlyValue || this.extractFinancialValue(/Scolaires/i);
  }

  protected extractExpenseElectricity(): number | null {
    const $ = this.$!;
    let yearlyValue: number | null = null;

    // Look for Électricité in yearly expenses table
    $(".financial-details-table-yearly tr").each((_, row) => {
      const rowText = $(row).text();
      if (/[ÉE]lectricit[ée]/i.test(rowText)) {
        const valueCell = $(row).find("td.text-right, td:last-child").text();
        const parsed = this.parsePrice(valueCell);
        if (parsed && parsed > 0) {
          yearlyValue = parsed;
          return false;
        }
      }
    });

    return yearlyValue || this.extractFinancialValue(/[ÉE]lectricit[ée]/i);
  }

  protected extractExpenseHeating(): number | null {
    const $ = this.$!;
    let yearlyValue: number | null = null;

    // Look for Mazout/Chauffage in yearly expenses table
    $(".financial-details-table-yearly tr").each((_, row) => {
      const rowText = $(row).text();
      if (/Mazout|Chauffage|Gaz/i.test(rowText)) {
        const valueCell = $(row).find("td.text-right, td:last-child").text();
        const parsed = this.parsePrice(valueCell);
        if (parsed && parsed > 0) {
          yearlyValue = parsed;
          return false;
        }
      }
    });

    return yearlyValue || this.extractFinancialValue(/Mazout|Chauffage/i);
  }
}
