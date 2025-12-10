import { chromium } from 'playwright';

async function testPlaywrightScraper() {
  const matricule = "9939-13-1353-5-000-0000";
  const [division, secteur, emplacement, cav, batiment, local] = matricule.split("-");

  console.log("\n=== Testing Montreal Scraper with Playwright ===");
  console.log("Matricule:", matricule);
  console.log("Parts:", { division, secteur, emplacement, cav, batiment, local });

  const browser = await chromium.launch({
    headless: false, // Show browser
    slowMo: 500, // Slow down by 500ms per action
  });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Step 1: Navigate to form
    console.log("\n--- Step 1: Navigate to form page ---");
    await page.goto("https://montreal.ca/role-evaluation-fonciere/matricule");
    console.log("URL:", page.url());
    await page.screenshot({ path: "debug-step1-form.png" });

    // Step 2: Fill form
    console.log("\n--- Step 2: Fill form fields ---");

    // Wait for form to be fully loaded
    await page.waitForSelector('[data-test="division"] input');

    await page.locator('[data-test="division"] input').fill(division);
    await page.locator('[data-test="sector"] input').fill(secteur);
    await page.locator('[data-test="location"] input').fill(emplacement);
    await page.locator('[data-test="cav"] input').fill(cav);
    await page.locator('[data-test="building"] input').fill(batiment);
    await page.locator('[data-test="local"] input').fill(local);

    // Wait a bit after filling all fields
    await page.waitForTimeout(1000);

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
    await page.screenshot({ path: "debug-step2-filled.png" });

    // Step 3: Submit form
    console.log("\n--- Step 3: Click submit and wait for navigation ---");

    // Check submit button state
    const submitButtonState = await page.evaluate(() => {
      const button = document.querySelector('[data-test="submit"]') as HTMLButtonElement;
      return {
        exists: !!button,
        disabled: button?.disabled,
        textContent: button?.textContent?.trim(),
      };
    });
    console.log("Submit button state:", submitButtonState);

    // Check for validation errors
    const validationErrors = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[class*="error"], [class*="Error"], [role="alert"]')).map(el => el.textContent?.trim());
    });
    console.log("Validation errors:", validationErrors);

    // Try clicking and waiting separately
    await page.locator('[data-test="submit"]').click();
    console.log("Clicked submit button");

    // Wait a bit for navigation to start
    await page.waitForTimeout(2000);
    console.log("Current URL after 2s:", page.url());

    try {
      await page.waitForURL('**/liste**', { timeout: 10000 });
      console.log("Successfully navigated to liste page!");
    } catch (e) {
      console.log("Failed to navigate to liste page");
      console.log("Current URL:", page.url());

      // Take screenshot
      await page.screenshot({ path: "debug-step3-failed.png" });

      // Check for errors
      const pageContent = await page.evaluate(() => {
        return {
          title: document.title,
          h1: document.querySelector('h1')?.textContent,
          errors: Array.from(document.querySelectorAll('[class*="error"], [class*="Error"]')).map(el => el.textContent),
        };
      });
      console.log("Page content:", pageContent);
    }

    console.log("\n=== Waiting 10 seconds for inspection ==");
    await page.waitForTimeout(10000);

    await browser.close();
  } catch (error) {
    console.error("\n!!! Error:", error);
    await browser.close();
  }
}

testPlaywrightScraper();
