import { chromium, Browser, Page } from "playwright";
import type { ScrapedMontrealData, TaxAccountPDF } from "@/types/montreal-evaluation";

export class MontrealEvaluationScraper {
  private browser: Browser | null = null;

  /**
   * Split matricule into component parts
   * Format: "9739-83-9737-8-001-0431"
   * Returns: [division, secteur, emplacement, cav, batiment, local]
   */
  private splitMatricule(matricule: string): string[] {
    const parts = matricule.split("-");
    if (parts.length !== 6) {
      throw new Error(`Invalid matricule format: ${matricule}`);
    }
    return parts;
  }

  /**
   * Main scraping function
   */
  async scrape(matricule: string): Promise<ScrapedMontrealData> {
    try {
      // Launch browser
      this.browser = await chromium.launch({
        headless: false,
        slowMo: 500,
      });

      const page = await this.browser.newPage();
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Navigate to the form page
      await page.goto("https://montreal.ca/role-evaluation-fonciere/matricule", {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Split matricule into parts
      const [division, secteur, emplacement, cav, batiment, local] =
        this.splitMatricule(matricule);

      // Wait for form to be fully loaded
      await page.waitForSelector('[data-test="division"] input');

      // Fill in the form using Playwright's fill method
      await page.locator('[data-test="division"] input').fill(division);
      await page.locator('[data-test="sector"] input').fill(secteur);
      await page.locator('[data-test="location"] input').fill(emplacement);
      await page.locator('[data-test="cav"] input').fill(cav);
      await page.locator('[data-test="building"] input').fill(batiment);
      await page.locator('[data-test="local"] input').fill(local);

      // Wait for form validation to complete
      await page.waitForTimeout(1000);

      // Remove any stale error banners that might block submission
      await page.evaluate(() => {
        const alert = document.querySelector('.alert-danger');
        if (alert) {
          alert.remove();
        }
      });

      // Submit the form
      await page.locator('[data-test="submit"]').click();
      await page.waitForURL('**/liste**', { timeout: 30000 });

      // Click the Soumettre button on the results list
      await page.locator('[data-test="button"]').click();
      await page.waitForURL('**/resultat**', { timeout: 30000 });

      // Now scrape all the data from the results page
      const scrapedData: ScrapedMontrealData = {
        matricule,
        identification: await this.scrapeIdentification(page),
        owner: await this.scrapeOwner(page),
        land: await this.scrapeLand(page),
        building: await this.scrapeBuilding(page),
        valuation: await this.scrapeValuation(page),
        fiscal: await this.scrapeFiscal(page),
        tax_pdfs: [],
        metadata: await this.scrapeMetadata(page),
      };

      return scrapedData;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  // Scraping methods for each section
  private async scrapeIdentification(page: Page) {
    return await page.evaluate(() => {
      const getText = (label: string): string => {
        const items = Array.from(document.querySelectorAll('#identification ~ ul li'));
        const item = items.find(li => li.textContent?.includes(label));
        if (!item) return "";

        const divs = item.querySelectorAll('div');
        // Try div[1] first, if it's the same as the label, try other divs
        const div1Text = divs[1]?.textContent?.trim() || "";
        if (div1Text && div1Text !== label && !div1Text.includes(label)) {
          return div1Text;
        }

        // If div[1] is the label, the value might be in div[0] or div[2]
        const div0Text = divs[0]?.textContent?.trim() || "";
        if (div0Text && div0Text !== label && !div0Text.includes(label)) {
          return div0Text;
        }

        const div2Text = divs[2]?.textContent?.trim() || "";
        if (div2Text && div2Text !== label && !div2Text.includes(label)) {
          return div2Text;
        }

        return "";
      };

      return {
        address: getText("Adresse"),
        arrondissement: getText("Arrondissement"),
        lot_exclusif: getText("Numéro de lot"),
        lot_commun: "",
        usage_predominant: getText("Utilisation prédominante"),
        numero_unite_voisinage: getText("Numéro d'unité de voisinage"),
        numero_compte_foncier: getText("Numéro de compte foncier"),
      };
    });
  }

  private async scrapeOwner(page: Page) {
    return await page.evaluate(() => {
      const getText = (label: string): string => {
        const items = Array.from(document.querySelectorAll('#proprietaires ~ ul li'));
        const item = items.find(li => li.textContent?.includes(label));
        if (!item) return "";

        const divs = item.querySelectorAll('div');
        // Try div[1] first, if it's the same as the label, try other divs
        const div1Text = divs[1]?.textContent?.trim() || "";
        if (div1Text && div1Text !== label && !div1Text.includes(label)) {
          return div1Text;
        }

        // If div[1] is the label, the value might be in div[0] or div[2]
        const div0Text = divs[0]?.textContent?.trim() || "";
        if (div0Text && div0Text !== label && !div0Text.includes(label)) {
          return div0Text;
        }

        const div2Text = divs[2]?.textContent?.trim() || "";
        if (div2Text && div2Text !== label && !div2Text.includes(label)) {
          return div2Text;
        }

        return "";
      };

      return {
        name: getText("Nom"),
        status: "",
        postal_address: getText("Adresse postale"),
        registration_date: getText("Date d'inscription au rôle"),
        special_conditions: "",
      };
    });
  }

  private async scrapeLand(page: Page) {
    return await page.evaluate(() => {
      const h3Elements = Array.from(document.querySelectorAll('h3'));
      const terrainH3 = h3Elements.find(h3 => h3.textContent?.includes("Caractéristiques du terrain"));
      if (!terrainH3) return { frontage: "", area: "" };

      const ul = terrainH3.nextElementSibling;
      if (!ul) return { frontage: "", area: "" };

      const getText = (label: string): string => {
        const items = Array.from(ul.querySelectorAll('li'));
        const item = items.find(li => li.textContent?.includes(label));
        if (!item) return "";

        const divs = item.querySelectorAll('div');
        // Try div[1] first, if it's the same as the label, try other divs
        const div1Text = divs[1]?.textContent?.trim() || "";
        if (div1Text && div1Text !== label && !div1Text.includes(label)) {
          return div1Text;
        }

        const div0Text = divs[0]?.textContent?.trim() || "";
        if (div0Text && div0Text !== label && !div0Text.includes(label)) {
          return div0Text;
        }

        const div2Text = divs[2]?.textContent?.trim() || "";
        if (div2Text && div2Text !== label && !div2Text.includes(label)) {
          return div2Text;
        }

        return "";
      };

      return {
        frontage: getText("Mesure frontale"),
        area: getText("Superficie"),
      };
    });
  }

  private async scrapeBuilding(page: Page) {
    return await page.evaluate(() => {
      const h3Elements = Array.from(document.querySelectorAll('h3'));
      const buildingH3 = h3Elements.find(h3 => h3.textContent?.includes("Caractéristiques du bâtiment"));
      if (!buildingH3) return {
        floors: "",
        year: "",
        floor_area: "",
        construction_type: "",
        physical_link: "",
        units: "",
        non_residential_spaces: "",
        rental_rooms: "",
      };

      const ul = buildingH3.nextElementSibling;
      if (!ul) return {
        floors: "",
        year: "",
        floor_area: "",
        construction_type: "",
        physical_link: "",
        units: "",
        non_residential_spaces: "",
        rental_rooms: "",
      };

      const getText = (label: string): string => {
        const items = Array.from(ul.querySelectorAll('li'));
        const item = items.find(li => li.textContent?.includes(label));
        if (!item) return "";

        const divs = item.querySelectorAll('div');
        // Try div[1] first, if it's the same as the label, try other divs
        const div1Text = divs[1]?.textContent?.trim() || "";
        if (div1Text && div1Text !== label && !div1Text.includes(label)) {
          return div1Text;
        }

        const div0Text = divs[0]?.textContent?.trim() || "";
        if (div0Text && div0Text !== label && !div0Text.includes(label)) {
          return div0Text;
        }

        const div2Text = divs[2]?.textContent?.trim() || "";
        if (div2Text && div2Text !== label && !div2Text.includes(label)) {
          return div2Text;
        }

        return "";
      };

      return {
        floors: getText("Nombre d'étages"),
        year: getText("Année de construction"),
        floor_area: getText("Aire d'étages"),
        construction_type: "",
        physical_link: getText("Lien physique"),
        units: getText("Nombre de logements"),
        non_residential_spaces: getText("Nombre de locaux non résidentiels"),
        rental_rooms: getText("Nombre de chambres locatives"),
      };
    });
  }

  private async scrapeValuation(page: Page) {
    return await page.evaluate(() => {
      // Find all h3 elements and locate the valuation section
      const allH3 = Array.from(document.querySelectorAll('h3'));
      let currentUl: Element | null = null;
      let previousUl: Element | null = null;

      // Find "Rôle courant" section
      const currentH3 = allH3.find(h3 => h3.textContent?.includes("Rôle courant"));
      if (currentH3) {
        currentUl = currentH3.nextElementSibling;
      }

      // Find "Rôle antérieur" section
      const previousH3 = allH3.find(h3 => h3.textContent?.includes("Rôle antérieur"));
      if (previousH3) {
        previousUl = previousH3.nextElementSibling;
      }

      const getText = (ul: Element | null, label: string): string => {
        if (!ul) return "";
        const items = Array.from(ul.querySelectorAll('li'));
        const item = items.find(li => li.textContent?.includes(label));
        if (!item) return "";

        const divs = item.querySelectorAll('div');
        // Try div[1] first, if it's the same as the label, try other divs
        const div1Text = divs[1]?.textContent?.trim() || "";
        if (div1Text && div1Text !== label && !div1Text.includes(label)) {
          return div1Text;
        }

        const div0Text = divs[0]?.textContent?.trim() || "";
        if (div0Text && div0Text !== label && !div0Text.includes(label)) {
          return div0Text;
        }

        const div2Text = divs[2]?.textContent?.trim() || "";
        if (div2Text && div2Text !== label && !div2Text.includes(label)) {
          return div2Text;
        }

        return "";
      };

      // Current role
      const current = {
        market_date: getText(currentUl, "Date de référence au marché"),
        land_value: getText(currentUl, "Valeur du terrain"),
        building_value: getText(currentUl, "Valeur du bâtiment"),
        total_value: getText(currentUl, "Valeur de l'immeuble"),
      };

      // Previous role
      const previous = {
        market_date: getText(previousUl, "Date de référence au marché"),
        total_value: getText(previousUl, "Valeur de l'immeuble au rôle antérieur"),
      };

      return {
        current,
        previous,
      };
    });
  }

  private async scrapeFiscal(page: Page) {
    return await page.evaluate(() => {
      const getText = (label: string): string => {
        const items = Array.from(document.querySelectorAll('#repartition ~ ul li'));
        const item = items.find(li => li.textContent?.includes(label));
        if (!item) return "";

        const divs = item.querySelectorAll('div');
        // Try div[1] first, if it's the same as the label, try other divs
        const div1Text = divs[1]?.textContent?.trim() || "";
        if (div1Text && div1Text !== label && !div1Text.includes(label)) {
          return div1Text;
        }

        const div0Text = divs[0]?.textContent?.trim() || "";
        if (div0Text && div0Text !== label && !div0Text.includes(label)) {
          return div0Text;
        }

        const div2Text = divs[2]?.textContent?.trim() || "";
        if (div2Text && div2Text !== label && !div2Text.includes(label)) {
          return div2Text;
        }

        return "";
      };

      const table = document.querySelector('table');
      const categorie = table?.caption?.textContent?.trim() || "";

      return {
        tax_category: categorie,
        taxable_value: getText("Valeur imposable"),
        non_taxable_value: getText("Valeur non imposable"),
      };
    });
  }

  private async scrapeMetadata(page: Page) {
    return await page.evaluate(() => {
      const strongElements = Array.from(document.querySelectorAll('strong'));
      const roleElement = strongElements.find(el => el.textContent?.match(/\d{4}-\d{4}-\d{4}/));
      const roll_period = roleElement?.textContent?.trim() || "";

      return {
        roll_period,
        data_date: "",
      };
    });
  }
}
