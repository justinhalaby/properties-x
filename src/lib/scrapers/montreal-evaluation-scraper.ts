import { firefox, Browser, Page } from "playwright";
import type { ScrapedMontrealData, TaxAccountPDF } from "@/types/montreal-evaluation";

export class MontrealEvaluationScraper {
  private browser: Browser | null = null;

  private splitMatricule(matricule: string): string[] {
    const parts = matricule.split("-");
    if (parts.length !== 6) {
      throw new Error(`Invalid matricule format: ${matricule}`);
    }
    return parts;
  }

  async scrape(matricule: string): Promise<ScrapedMontrealData> {
    try {
      this.browser = await firefox.launch({
        headless: true,
        slowMo: 500,
      });

      const page = await this.browser.newPage();
      await page.setViewportSize({ width: 1920, height: 1080 });

      await page.setExtraHTTPHeaders({
        'Accept-Language': 'fr-FR,fr;q=0.9',
      });

      page.on('dialog', async dialog => {
        await dialog.dismiss();
      });

      await page.goto("https://montreal.ca/role-evaluation-fonciere/matricule", {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      await page.evaluate(() => {
        const modal = document.querySelector('.modal');
        if (modal) modal.remove();
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.remove();
      });

      const [division, secteur, emplacement, cav, batiment, local] =
        this.splitMatricule(matricule);

      await page.waitForSelector('[data-test="division"] input');

      await page.locator('[data-test="division"] input').fill(division);
      await page.locator('[data-test="sector"] input').fill(secteur);
      await page.locator('[data-test="location"] input').fill(emplacement);
      await page.locator('[data-test="cav"] input').fill(cav);
      await page.locator('[data-test="building"] input').fill(batiment);
      await page.locator('[data-test="local"] input').fill(local);

      await page.waitForTimeout(1000);

      await page.evaluate(() => {
        const alert = document.querySelector('.alert-danger');
        if (alert) {
          alert.remove();
        }
      });

      await page.locator('[data-test="submit"]').click();
      await page.waitForURL('**/liste**', { timeout: 30000 });

      await page.locator('[data-test="button"]').click();
      await page.waitForURL('**/resultat**', { timeout: 30000 });

      await page.waitForSelector('#identification', { timeout: 10000 });
      await page.waitForTimeout(2000);

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

  private async scrapeIdentification(page: Page) {
    const getText = async (label: string): Promise<string> => {
      const items = await page.locator('#identification ~ ul li').all();
      for (const item of items) {
        const text = await item.textContent();
        if (text && text.includes(label)) {
          const divs = await item.locator('div').all();
          for (const div of divs) {
            const divText = await div.textContent();
            if (divText && divText.trim() && divText !== label && !divText.includes(label)) {
              return divText.trim();
            }
          }
        }
      }
      return "";
    };

    return {
      address: await getText("Adresse"),
      arrondissement: await getText("Arrondissement"),
      lot_exclusif: await getText("Numéro de lot"),
      lot_commun: "",
      usage_predominant: await getText("Utilisation prédominante"),
      numero_unite_voisinage: await getText("Numéro d'unité de voisinage"),
      numero_compte_foncier: await getText("Numéro de compte foncier"),
    };
  }

  private async scrapeOwner(page: Page) {
    const getText = async (label: string): Promise<string> => {
      const items = await page.locator('#proprietaires ~ ul li').all();
      for (const item of items) {
        const text = await item.textContent();
        if (text && text.includes(label)) {
          const divs = await item.locator('div').all();
          for (const div of divs) {
            const divText = await div.textContent();
            if (divText && divText.trim() && divText !== label && !divText.includes(label)) {
              return divText.trim();
            }
          }
        }
      }
      return "";
    };

    return {
      name: await getText("Nom"),
      status: "",
      postal_address: await getText("Adresse postale"),
      registration_date: await getText("Date d'inscription au rôle"),
      special_conditions: "",
    };
  }

  private async scrapeLand(page: Page) {
    const h3s = await page.locator('h3').all();
    let terrainUl = null;

    for (const h3 of h3s) {
      const text = await h3.textContent();
      if (text && text.includes("Caractéristiques du terrain")) {
        const nextEl = page.locator('h3').filter({ hasText: "Caractéristiques du terrain" }).locator('xpath=following-sibling::ul[1]');
        if (await nextEl.count() > 0) {
          terrainUl = nextEl;
          break;
        }
      }
    }

    if (!terrainUl) return { frontage: "", area: "" };

    const getText = async (label: string): Promise<string> => {
      const items = await terrainUl.locator('li').all();
      for (const item of items) {
        const text = await item.textContent();
        if (text && text.includes(label)) {
          const divs = await item.locator('div').all();
          for (const div of divs) {
            const divText = await div.textContent();
            if (divText && divText.trim() && divText !== label && !divText.includes(label)) {
              return divText.trim();
            }
          }
        }
      }
      return "";
    };

    return {
      frontage: await getText("Mesure frontale"),
      area: await getText("Superficie"),
    };
  }

  private async scrapeBuilding(page: Page) {
    const h3s = await page.locator('h3').all();
    let buildingUl = null;

    for (const h3 of h3s) {
      const text = await h3.textContent();
      if (text && text.includes("Caractéristiques du bâtiment")) {
        const nextEl = page.locator('h3').filter({ hasText: "Caractéristiques du bâtiment" }).locator('xpath=following-sibling::ul[1]');
        if (await nextEl.count() > 0) {
          buildingUl = nextEl;
          break;
        }
      }
    }

    if (!buildingUl) return {
      floors: "",
      year: "",
      floor_area: "",
      construction_type: "",
      physical_link: "",
      units: "",
      non_residential_spaces: "",
      rental_rooms: "",
    };

    const getText = async (label: string): Promise<string> => {
      const items = await buildingUl.locator('li').all();
      for (const item of items) {
        const text = await item.textContent();
        if (text && text.includes(label)) {
          const divs = await item.locator('div').all();
          for (const div of divs) {
            const divText = await div.textContent();
            if (divText && divText.trim() && divText !== label && !divText.includes(label)) {
              return divText.trim();
            }
          }
        }
      }
      return "";
    };

    return {
      floors: await getText("Nombre d'étages"),
      year: await getText("Année de construction"),
      floor_area: await getText("Aire d'étages"),
      construction_type: "",
      physical_link: await getText("Lien physique"),
      units: await getText("Nombre de logements"),
      non_residential_spaces: await getText("Nombre de locaux non résidentiels"),
      rental_rooms: await getText("Nombre de chambres locatives"),
    };
  }

  private async scrapeValuation(page: Page) {
    const h3s = await page.locator('h3').all();
    let currentUl = null;
    let previousUl = null;

    for (const h3 of h3s) {
      const text = await h3.textContent();
      if (text && text.includes("Rôle courant")) {
        const nextEl = page.locator('h3').filter({ hasText: "Rôle courant" }).locator('xpath=following-sibling::ul[1]');
        if (await nextEl.count() > 0) {
          currentUl = nextEl;
        }
      }
      if (text && text.includes("Rôle antérieur")) {
        const nextEl = page.locator('h3').filter({ hasText: "Rôle antérieur" }).locator('xpath=following-sibling::ul[1]');
        if (await nextEl.count() > 0) {
          previousUl = nextEl;
        }
      }
    }

    const getText = async (ul: any, label: string): Promise<string> => {
      if (!ul) return "";
      const items = await ul.locator('li').all();
      for (const item of items) {
        const text = await item.textContent();
        if (text && text.includes(label)) {
          const divs = await item.locator('div').all();
          for (const div of divs) {
            const divText = await div.textContent();
            if (divText && divText.trim() && divText !== label && !divText.includes(label)) {
              return divText.trim();
            }
          }
        }
      }
      return "";
    };

    return {
      current: {
        market_date: await getText(currentUl, "Date de référence au marché"),
        land_value: await getText(currentUl, "Valeur du terrain"),
        building_value: await getText(currentUl, "Valeur du bâtiment"),
        total_value: await getText(currentUl, "Valeur de l'immeuble"),
      },
      previous: {
        market_date: await getText(previousUl, "Date de référence au marché"),
        total_value: await getText(previousUl, "Valeur de l'immeuble au rôle antérieur"),
      },
    };
  }

  private async scrapeFiscal(page: Page) {
    const getText = async (label: string): Promise<string> => {
      const items = await page.locator('#repartition ~ ul li').all();
      for (const item of items) {
        const text = await item.textContent();
        if (text && text.includes(label)) {
          const divs = await item.locator('div').all();
          for (const div of divs) {
            const divText = await div.textContent();
            if (divText && divText.trim() && divText !== label && !divText.includes(label)) {
              return divText.trim();
            }
          }
        }
      }
      return "";
    };

    const table = page.locator('table').first();
    const caption = await table.locator('caption').textContent().catch(() => "");

    return {
      tax_category: caption ? caption.trim() : "",
      taxable_value: await getText("Valeur imposable"),
      non_taxable_value: await getText("Valeur non imposable"),
    };
  }

  private async scrapeMetadata(page: Page) {
    const strongs = await page.locator('strong').all();
    let roll_period = "";

    for (const strong of strongs) {
      const text = await strong.textContent();
      if (text && text.match(/\d{4}-\d{4}-\d{4}/)) {
        roll_period = text.trim();
        break;
      }
    }

    return {
      roll_period,
      data_date: "",
    };
  }
}
