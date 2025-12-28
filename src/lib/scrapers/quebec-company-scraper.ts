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
      // Get Bright Data credentials from environment
      const brightDataEnabled = !!(
        process.env.BRIGHTDATA_PROXY_HOST &&
        process.env.BRIGHTDATA_PROXY_USERNAME &&
        process.env.BRIGHTDATA_PROXY_PASSWORD
      );

      if (!brightDataEnabled) {
        console.warn('⚠️  Bright Data not configured');
        console.warn('   Cloudflare bypass will not work automatically');
        console.warn('   You may need to complete manual verification');
      }

      if (brightDataEnabled) {
        // Connect to Bright Data's Scraping Browser via CDP
        const auth = `${process.env.BRIGHTDATA_PROXY_USERNAME}:${process.env.BRIGHTDATA_PROXY_PASSWORD}`;
        const cdpUrl = `wss://${auth}@${process.env.BRIGHTDATA_PROXY_HOST}:${process.env.BRIGHTDATA_PROXY_PORT}?brd_block_robots=0`;

        console.log('✓ Connecting to Bright Data Scraping Browser for Cloudflare bypass');
        this.browser = await chromium.connectOverCDP(cdpUrl);
      } else {
        // Fallback to local browser
        this.browser = await chromium.launch({
          headless: false,
          slowMo: 500,
        });
      }

      const page = await this.browser.newPage();
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Only set headers for local browser (not allowed with remote Bright Data browser)
      if (!brightDataEnabled) {
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'fr-FR,fr;q=0.9',
        });
      }

      // Handle any dialogs
      page.on('dialog', async (dialog) => {
        await dialog.dismiss();
      });

      console.log(`Starting search with ${options.searchType}: ${options.neq || options.companyName}`);

      if (brightDataEnabled) {
        // Navigate via Bright Data - automatic Cloudflare bypass
        console.log('🌐 Navigating via Bright Data (Cloudflare bypass enabled)...');
        await page.goto(QUEBEC_REGISTRY_URL, {
          waitUntil: "networkidle",
          timeout: 60000,
        });
        console.log('✓ Page loaded successfully');
        const title = await page.title();
        console.log(`Page title: ${title}`);
      } else {
        // Navigate with manual Cloudflare handling
        await page.goto(QUEBEC_REGISTRY_URL, {
          waitUntil: "networkidle",
          timeout: 30000,
        });

        // Wait for Cloudflare challenge to complete
        console.log('⏳ Waiting for Cloudflare verification...');
        await page.waitForTimeout(5000);

        // Check if we're still on Cloudflare challenge page
        const pageContent = await page.textContent('body');
        if (pageContent && pageContent.includes('Cloudflare')) {
          console.log('🔒 Cloudflare detected, waiting for manual verification...');
          console.log('   Please complete the verification in the browser window');
          await page.waitForTimeout(30000);
        }
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
   * Uses the same DOM extraction logic as the bookmarklet
   */
  private async scrapeNEQ(page: Page): Promise<string> {
    return await page.evaluate(() => {
      function getFieldValue(root: Document | Element, labelText: string): string {
        const labels = root.querySelectorAll('.kx-display-label');
        for (let i = 0; i < labels.length; i++) {
          const label = labels[i];
          const text = (label.textContent || '').trim();
          const regex = new RegExp('^' + labelText.replace(/[()]/g, '\\$&') + '$', 'i');

          if (regex.test(text)) {
            let sibling = label.nextElementSibling;
            while (sibling) {
              if (sibling.classList && sibling.classList.contains('kx-display-field')) {
                return (sibling.textContent || '').trim();
              }
              sibling = sibling.nextElementSibling;
            }
          }
        }
        return '';
      }

      const neq = getFieldValue(document, "Numéro d'entreprise du Québec (NEQ)");
      if (neq) return neq;

      const bodyText = document.body.textContent || '';
      const neqMatch = bodyText.match(/\b(\d{10})\b/);
      return neqMatch ? neqMatch[1] : '';
    });
  }

  /**
   * Extracts company identification information
   * Uses the same DOM extraction logic as the bookmarklet
   */
  private async scrapeIdentification(page: Page): Promise<{
    name: string;
    status: string;
    domicile_address: string;
    registration_date: string;
    status_date?: string;
  }> {
    return await page.evaluate(() => {
      function getFieldValue(root: Document | Element, labelText: string): string {
        const labels = root.querySelectorAll('.kx-display-label');
        for (let i = 0; i < labels.length; i++) {
          const label = labels[i];
          const text = (label.textContent || '').trim();
          const regex = new RegExp('^' + labelText.replace(/[()]/g, '\\$&') + '$', 'i');

          if (regex.test(text)) {
            let sibling = label.nextElementSibling;
            while (sibling) {
              if (sibling.classList && sibling.classList.contains('kx-display-field')) {
                return (sibling.textContent || '').trim();
              }
              sibling = sibling.nextElementSibling;
            }
          }
        }
        return '';
      }

      return {
        name: getFieldValue(document, 'Nom'),
        status: getFieldValue(document, 'Statut'),
        domicile_address: getFieldValue(document, 'Adresse'),
        registration_date: getFieldValue(document, "Date d'immatriculation"),
        status_date: getFieldValue(document, "Date de mise à jour du statut") || undefined,
      };
    });
  }

  /**
   * Extracts shareholders (Actionnaires) from the details page
   * Uses the same DOM extraction logic as the bookmarklet
   */
  private async scrapeShareholders(page: Page): Promise<ScrapedShareholderData[]> {
    const shareholders = await page.evaluate(() => {
      function getFieldValue(root: Document | Element, labelText: string): string {
        const labels = root.querySelectorAll('.kx-display-label');
        for (let i = 0; i < labels.length; i++) {
          const label = labels[i];
          const text = (label.textContent || '').trim();
          const regex = new RegExp('^' + labelText.replace(/[()]/g, '\\$&') + '$', 'i');

          if (regex.test(text)) {
            let sibling = label.nextElementSibling;
            while (sibling) {
              if (sibling.classList && sibling.classList.contains('kx-display-field')) {
                return (sibling.textContent || '').trim();
              }
              sibling = sibling.nextElementSibling;
            }
          }
        }
        return '';
      }

      const shareholders: any[] = [];
      const positions = [
        'Premier actionnaire',
        'Deuxième actionnaire',
        'Troisième actionnaire',
        'Quatrième actionnaire',
        'Cinquième actionnaire',
      ];

      const allLists = document.querySelectorAll('ul.kx-synthese');
      for (let i = 0; i < allLists.length; i++) {
        const list = allLists[i];
        const firstLabel = list.querySelector('.kx-display-label');
        if (!firstLabel) continue;

        const text = firstLabel.textContent?.trim() || '';
        for (let j = 0; j < positions.length; j++) {
          if (text.includes(positions[j])) {
            const lastName = getFieldValue(list, 'Nom de famille');
            const firstName = getFieldValue(list, 'Prénom');
            const address = getFieldValue(list, 'Adresse du domicile');
            const isMajority = list.textContent?.includes('majoritaire') || false;

            if (lastName || firstName) {
              shareholders.push({
                name: (firstName + ' ' + lastName).trim(),
                address: address || '',
                is_majority: isMajority,
                position: j + 1,
              });
            }
            break;
          }
        }
      }

      return shareholders;
    });

    shareholders.forEach((shareholder, i) => {
      console.log(`  Found shareholder ${i + 1}: ${shareholder.name}`);
    });

    return shareholders;
  }

  /**
   * Extracts administrators from the details page
   * Uses the same DOM extraction logic as the bookmarklet
   */
  private async scrapeAdministrators(page: Page): Promise<ScrapedAdministratorData[]> {
    const administrators = await page.evaluate(() => {
      function getFieldValue(root: Document | Element, labelText: string): string {
        const labels = root.querySelectorAll('.kx-display-label');
        for (let i = 0; i < labels.length; i++) {
          const label = labels[i];
          const text = (label.textContent || '').trim();
          const regex = new RegExp('^' + labelText.replace(/[()]/g, '\\$&') + '$', 'i');

          if (regex.test(text)) {
            let sibling = label.nextElementSibling;
            while (sibling) {
              if (sibling.classList && sibling.classList.contains('kx-display-field')) {
                return (sibling.textContent || '').trim();
              }
              sibling = sibling.nextElementSibling;
            }
          }
        }
        return '';
      }

      const administrators: any[] = [];
      let foundAdminSection = false;
      const allLists = document.querySelectorAll('ul.kx-synthese');

      for (let i = 0; i < allLists.length; i++) {
        const list = allLists[i];
        const labels = list.querySelectorAll('.kx-display-label');

        let hasNomDeFamille = false;
        let hasFonctions = false;

        for (let j = 0; j < labels.length; j++) {
          const labelText = labels[j].textContent?.trim() || '';
          if (labelText === 'Nom de famille') hasNomDeFamille = true;
          if (labelText === 'Fonctions actuelles') hasFonctions = true;
        }

        if (hasNomDeFamille && hasFonctions) {
          foundAdminSection = true;
          const lastName = getFieldValue(list, 'Nom de famille');
          const firstName = getFieldValue(list, 'Prénom');
          const position = getFieldValue(list, 'Fonctions actuelles');
          const domicileAddress = getFieldValue(list, 'Adresse du domicile');

          if (lastName) {
            const fullName = (firstName + ' ' + lastName).trim();
            const cleanDomicile = domicileAddress && domicileAddress.toLowerCase().includes('non publiable')
              ? ''
              : domicileAddress || '';

            administrators.push({
              name: fullName,
              position_title: position || '',
              domicile_address: cleanDomicile,
              professional_address: '',
              position_order: administrators.length + 1,
            });
          }
        }

        if (foundAdminSection && !hasNomDeFamille) {
          break;
        }
      }

      return administrators;
    });

    administrators.forEach((admin, i) => {
      console.log(`  Found administrator ${i + 1}: ${admin.name} (${admin.position_title})`);
    });

    return administrators;
  }

  /**
   * Extracts economic activity information
   * Uses the same DOM extraction logic as the bookmarklet
   */
  private async scrapeEconomicActivity(page: Page): Promise<{
    cae_code: string;
    cae_description: string;
  }> {
    return await page.evaluate(() => {
      function getFieldValue(root: Document | Element, labelText: string): string {
        const labels = root.querySelectorAll('.kx-display-label');
        for (let i = 0; i < labels.length; i++) {
          const label = labels[i];
          const text = (label.textContent || '').trim();
          const regex = new RegExp('^' + labelText.replace(/[()]/g, '\\$&') + '$', 'i');

          if (regex.test(text)) {
            let sibling = label.nextElementSibling;
            while (sibling) {
              if (sibling.classList && sibling.classList.contains('kx-display-field')) {
                return (sibling.textContent || '').trim();
              }
              sibling = sibling.nextElementSibling;
            }
          }
        }
        return '';
      }

      const caeCode = getFieldValue(document, "Code d'activité économique (CAE)");
      const caeDescription = getFieldValue(document, 'Activité');

      return {
        cae_code: caeCode || '',
        cae_description: caeDescription || '',
      };
    });
  }
}
