import { chromium } from 'playwright';

async function testPlaywrightScraper() {
  const matricule = "9939-13-1353-5-000-0000";
  const [division, secteur, emplacement, cav, batiment, local] = matricule.split("-");

  console.log("\n=== Testing Montreal Scraper with Playwright ===");
  console.log("Matricule:", matricule);
  console.log("Parts:", { division, secteur, emplacement, cav, batiment, local });

  const browser = await chromium.launch({
    headless: false, // Show browser
    slowMo: 1000, // Slow down by 1 second per action
  });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Step 1: Navigate to form
    console.log("\n--- Step 1: Navigate to form page ---");
    await page.goto("https://montreal.ca/role-evaluation-fonciere/matricule");
    console.log("URL:", page.url());
    await page.screenshot({ path: "playwright-step1-form.png" });

    // Step 2: Fill form
    console.log("\n--- Step 2: Fill form fields ---");
    await page.locator('[data-test="division"] input').fill(division);
    await page.locator('[data-test="sector"] input').fill(secteur);
    await page.locator('[data-test="location"] input').fill(emplacement);
    await page.locator('[data-test="cav"] input').fill(cav);
    await page.locator('[data-test="building"] input').fill(batiment);
    await page.locator('[data-test="local"] input').fill(local);

    // Verify values
    const values = await page.evaluate(() => {
      return {
        division: (document.querySelector('[data-test="division"] input') as HTMLInputElement)?.value,
        sector: (document.querySelector('[data-test="sector"] input') as HTMLInputElement)?.value,
        location: (document.querySelector('[data-test="location"] input') as HTMLInputElement)?.value,
        cav: (document.querySelector('[data-test="cav"] input') as HTMLInputElement)?.value,
        building: (document.querySelector('[data-test="building"] input') as HTMLInputElement)?.value,
        local: (document.querySelector('[data-test="local"] input') as HTMLInputElement)?.value,
      };
    });
    console.log("Filled values:", values);
    await page.screenshot({ path: "playwright-step2-filled.png" });

    // Step 3: Submit form
    console.log("\n--- Step 3: Click submit and wait for navigation ---");
    await page.locator('[data-test="submit"]').click();
    await page.waitForURL('**/liste**', { timeout: 30000 }).catch(() => {
      console.log("Did not navigate to /liste page");
    });
    console.log("After submit URL:", page.url());
    await page.screenshot({ path: "playwright-step3-after-submit.png" });

    // Step 4: Check what page we're on
    console.log("\n--- Step 4: Analyze current page ---");
    const pageTitle = await page.locator('h1').textContent();
    console.log("Page title:", pageTitle);

    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.textContent?.trim(),
        dataTest: btn.getAttribute('data-test'),
        visible: btn.offsetParent !== null
      }));
    });
    console.log("Buttons on page:", JSON.stringify(buttons, null, 2));

    // Step 5: If we're on the results list page, click Soumettre
    if (page.url().includes('/liste')) {
      console.log("\n--- Step 5: We're on results list! Click Soumettre ---");
      await page.locator('button:has-text("Soumettre")').click();
      await page.waitForURL('**/resultat**', { timeout: 30000 });
      console.log("After clicking Soumettre URL:", page.url());
      await page.screenshot({ path: "playwright-step5-details.png" });

      const detailsTitle = await page.locator('h1').textContent();
      console.log("Details page title:", detailsTitle);
    } else {
      console.log("\n--- ERROR: Not on results list page! ---");
      console.log("Current URL:", page.url());
    }

    console.log("\n=== Browser will stay open for 30 seconds for inspection ===");
    await page.waitForTimeout(30000);

    await browser.close();
  } catch (error) {
    console.error("\n!!! Error:", error);
    await browser.close();
  }
}

testPlaywrightScraper();
