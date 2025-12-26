import { chromium, Browser, Page } from "playwright";
import type {
  QuebecCompanyScrapeOptions,
  ScrapedCompanyData,
  ScrapedShareholderData,
  ScrapedAdministratorData,
} from "@/types/company-registry";

const QUEBEC_REGISTRY_URL =
  "https://www.registreentreprises.gouv.qc.ca/REQNA/GR/GR03/GR03A71.RechercheRegistre.MVC/GR03A71";

export class QuebecCompanyScraper {
  private browser: Browser | null = null;

  /**
   * Main scrape method - searches for a company and extracts all data
   */
  async scrape(options: QuebecCompanyScrapeOptions): Promise<ScrapedCompanyData> {
    try {
      this.browser = await chromium.launch({
        headless: false,
        slowMo: 500, // Human-like behavior
      });

      const page = await this.browser.newPage();
      await page.setViewportSize({ width: 1920, height: 1080 });

      await page.setExtraHTTPHeaders({
        'Accept-Language': 'fr-FR,fr;q=0.9',
      });

      // Handle any dialogs
      page.on('dialog', async (dialog) => {
        await dialog.dismiss();
      });

      console.log(`Starting search with ${options.searchType}: ${options.neq || options.companyName}`);

      // Navigate to search page
      await page.goto(QUEBEC_REGISTRY_URL, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Wait for Cloudflare challenge to complete
      console.log('⏳ Waiting for Cloudflare verification...');
      await page.waitForTimeout(5000); // Give Cloudflare time to complete

      // Check if we're still on Cloudflare challenge page
      const pageContent = await page.textContent('body');
      if (pageContent && pageContent.includes('Cloudflare')) {
        console.log('🔒 Cloudflare detected, waiting for manual verification...');
        console.log('   Please complete the verification in the browser window');

        // Wait up to 30 seconds for user to complete verification
        await page.waitForTimeout(30000);
      }

      // Remove any modals
      await page.evaluate(() => {
        const modal = document.querySelector('.modal');
        if (modal) modal.remove();
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.remove();
      });

      // Perform search
      await this.searchCompany(page, options);

      // Wait for results page
      await page.waitForTimeout(2000);

      // Select the active company (Statut: Immatriculée)
      await this.selectActiveCompany(page);

      // Wait for details page to load
      await page.waitForTimeout(2000);

      // Extract all data from the company details page
      const scrapedData: ScrapedCompanyData = {
        neq: await this.scrapeNEQ(page),
        identification: await this.scrapeIdentification(page),
        shareholders: await this.scrapeShareholders(page),
        administrators: await this.scrapeAdministrators(page),
        economic_activity: await this.scrapeEconomicActivity(page),
        source_url: page.url(),
      };

      console.log(`✓ Successfully scraped company: ${scrapedData.identification.name}`);
      console.log(`  - ${scrapedData.shareholders.length} shareholder(s)`);
      console.log(`  - ${scrapedData.administrators.length} administrator(s)`);

      return scrapedData;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  /**
   * Searches for a company by NEQ or name
   */
  private async searchCompany(page: Page, options: QuebecCompanyScrapeOptions): Promise<void> {
    const randomSleep = () => Math.floor(Math.random() * (500 - 100 + 1)) + 100;

    // Wait for search form
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });

    // Fill in the search query
    const searchValue = options.searchType === 'neq' ? options.neq! : options.companyName!;

    console.log(`Filling search field with: ${searchValue}`);

    // Find and fill the search input
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill(searchValue);
    await page.waitForTimeout(randomSleep());

    // Accept terms if checkbox is present
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.count() > 0) {
      await checkbox.check();
      await page.waitForTimeout(randomSleep());
    }

    // Submit search
    const submitButton = page.locator('button:has-text("Rechercher")').first();
    await submitButton.click();

    console.log('Search submitted, waiting for results...');
  }

  /**
   * Selects the first active company from search results (Statut: Immatriculée)
   */
  private async selectActiveCompany(page: Page): Promise<void> {
    await page.waitForTimeout(2000);

    // Look for results - the page shows company cards/links
    // Try to find a "Consulter" button or link for an active company

    // Check if we have results
    const hasResults = await page.locator('text=/Statut\\s+de\\s+l.entreprise/i').count();

    if (hasResults === 0) {
      throw new Error("No results found for this search");
    }

    console.log(`Found ${hasResults} result(s)`);

    // Find all company result sections and look for "Immatriculée" status
    const resultSections = await page.locator('text=/Statut\\s+de\\s+l.entreprise/i').all();

    for (let i = 0; i < resultSections.length; i++) {
      // Get the parent container for this result
      const section = resultSections[i];
      const container = section.locator('xpath=ancestor::*[contains(@class, "") or position()=1]').first();

      // Check if this result has "Immatriculée" status
      const text = await container.textContent();
      if (text && text.includes('Immatriculée')) {
        console.log(`Found active company at position ${i + 1}`);

        // Find and click the "Consulter" button in this section
        const consultButton = container.locator('button:has-text("Consulter")').or(container.locator('a:has-text("Consulter")')).first();

        if (await consultButton.count() > 0) {
          await consultButton.click();
          console.log('Clicked Consulter button');
          await page.waitForTimeout(2000);
          return;
        }
      }
    }

    throw new Error("No active (Immatriculée) company found in results");
  }

  /**
   * Extracts the NEQ from the details page
   */
  private async scrapeNEQ(page: Page): Promise<string> {
    // Look for NEQ in the identification section
    const neqText = await page.locator('text=/Numéro\\s+d.entreprise\\s+du\\s+Québec/i').locator('xpath=following-sibling::*[1]').textContent().catch(() => '');

    if (neqText && neqText.trim()) {
      return neqText.trim();
    }

    // Fallback: extract from page content using regex
    const pageText = await page.textContent('body');
    const neqMatch = pageText?.match(/\b(\d{10})\b/);
    if (neqMatch) {
      return neqMatch[1];
    }

    throw new Error("Could not find NEQ on page");
  }

  /**
   * Extracts company identification information
   */
  private async scrapeIdentification(page: Page): Promise<{
    name: string;
    status: string;
    domicile_address: string;
    registration_date: string;
    status_date?: string;
  }> {
    const getText = async (label: string): Promise<string> => {
      try {
        const labelElement = page.locator(`text=/^${label}/i`).first();
        const value = await labelElement.locator('xpath=following-sibling::*[1]').textContent();
        return value?.trim() || '';
      } catch {
        return '';
      }
    };

    return {
      name: await getText('Nom'),
      status: await getText('Statut'),
      domicile_address: await getText('Adresse'),
      registration_date: await getText("Date d'immatriculation"),
      status_date: await getText("Date de mise à jour du statut"),
    };
  }

  /**
   * Extracts shareholders (Actionnaires) from the details page
   * Handles variable number of shareholders dynamically
   */
  private async scrapeShareholders(page: Page): Promise<ScrapedShareholderData[]> {
    const shareholders: ScrapedShareholderData[] = [];

    // Find the shareholders section heading
    const shareholdersHeading = page.locator('text=/^Actionnaires$/i').first();

    if (await shareholdersHeading.count() === 0) {
      console.log('No shareholders section found');
      return [];
    }

    // Get all content after the "Actionnaires" heading
    // Look for patterns like "Premier actionnaire", "Deuxième actionnaire", etc.
    const positions = [
      'Premier actionnaire',
      'Deuxième actionnaire',
      'Troisième actionnaire',
      'Quatrième actionnaire',
      'Cinquième actionnaire',
    ];

    for (let i = 0; i < positions.length; i++) {
      const positionLabel = positions[i];
      const positionElement = page.locator(`text=/^${positionLabel}/i`).first();

      if (await positionElement.count() === 0) {
        break; // No more shareholders
      }

      // Extract name and address for this shareholder
      const container = positionElement.locator('xpath=ancestor::*[contains(@class, "") or position()=1]').first();

      const name = await this.extractFieldValue(container, 'Nom');
      const address = await this.extractFieldValue(container, 'Adresse du domicile');
      const majorityText = await container.textContent();
      const isMajority = majorityText ? majorityText.includes('majoritaire') : false;

      if (name) {
        shareholders.push({
          name,
          address: address || '',
          is_majority: isMajority,
          position: i + 1,
        });

        console.log(`  Found shareholder ${i + 1}: ${name}`);
      }
    }

    return shareholders;
  }

  /**
   * Extracts administrators from the details page
   * Handles variable number of administrators dynamically
   */
  private async scrapeAdministrators(page: Page): Promise<ScrapedAdministratorData[]> {
    const administrators: ScrapedAdministratorData[] = [];

    // Find the administrators section
    const adminHeading = page.locator('text=/Administrateurs$/i').first();

    if (await adminHeading.count() === 0) {
      console.log('No administrators section found');
      return [];
    }

    // Look for list items or sections with administrator data
    // Administrators usually have: Name, Position, Domicile Address, Professional Address

    // Try to find all administrator entries (they usually have a lastName/firstName pattern)
    const nameLabels = await page.locator('text=/^Nom de famille$/i').all();

    for (let i = 0; i < nameLabels.length; i++) {
      const container = nameLabels[i].locator('xpath=ancestor::*[contains(@class, "") or position()=2]').first();

      const lastName = await this.extractFieldValue(container, 'Nom de famille');
      const firstName = await this.extractFieldValue(container, 'Prénom');
      const position = await this.extractFieldValue(container, 'Fonctions actuelles');
      const domicileAddress = await this.extractFieldValue(container, 'Adresse du domicile');
      const professionalAddress = await this.extractFieldValue(container, 'Adresse professionnelle');

      if (lastName) {
        const fullName = `${firstName} ${lastName}`.trim();

        // Clean up addresses - if "non publiable", store as empty string
        const cleanDomicile = domicileAddress && domicileAddress.toLowerCase().includes('non publiable')
          ? ''
          : (domicileAddress || '');
        const cleanProfessional = professionalAddress && professionalAddress.toLowerCase().includes('non publiable')
          ? ''
          : (professionalAddress || '');

        administrators.push({
          name: fullName,
          position_title: position || '',
          domicile_address: cleanDomicile,
          professional_address: cleanProfessional,
          position_order: i + 1,
        });

        console.log(`  Found administrator ${i + 1}: ${fullName} (${position})`);
      }
    }

    return administrators;
  }

  /**
   * Extracts economic activity information
   */
  private async scrapeEconomicActivity(page: Page): Promise<{
    cae_code: string;
    cae_description: string;
  }> {
    const caeCode = await this.extractFieldValue(page, "Code d'activité économique");
    const caeDescription = await this.extractFieldValue(page, 'Activité');

    return {
      cae_code: caeCode || '',
      cae_description: caeDescription || '',
    };
  }

  /**
   * Helper to extract field value by label
   */
  private async extractFieldValue(container: any, label: string): Promise<string> {
    try {
      const labelElement = container.locator(`text=/^${label}/i`).first();
      const value = await labelElement.locator('xpath=following-sibling::*[1]').textContent();
      return value?.trim() || '';
    } catch {
      return '';
    }
  }
}
