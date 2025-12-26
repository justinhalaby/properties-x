import { firefox } from "playwright";

async function debugScraper() {
  const browser = await firefox.launch({
    headless: false,
    slowMo: 1000,
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  console.log('🌐 Navigating to Quebec registry...');
  await page.goto("https://www.registreentreprises.gouv.qc.ca/REQNA/GR/GR03/GR03A71.RechercheRegistre.MVC/GR03A71", {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  // Remove modals
  await page.evaluate(() => {
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
  });

  await page.waitForTimeout(2000);

  console.log('📝 Looking for form elements...');

  // Find all input fields
  const inputs = await page.locator('input').all();
  console.log(`Found ${inputs.length} input fields:`);
  for (let i = 0; i < Math.min(inputs.length, 5); i++) {
    const type = await inputs[i].getAttribute('type');
    const name = await inputs[i].getAttribute('name');
    const id = await inputs[i].getAttribute('id');
    const placeholder = await inputs[i].getAttribute('placeholder');
    console.log(`  Input ${i+1}: type="${type}" name="${name}" id="${id}" placeholder="${placeholder}"`);
  }

  // Find all buttons
  const buttons = await page.locator('button').all();
  console.log(`\nFound ${buttons.length} buttons:`);
  for (let i = 0; i < Math.min(buttons.length, 5); i++) {
    const text = await buttons[i].textContent();
    console.log(`  Button ${i+1}: "${text?.trim()}"`);
  }

  // Fill in the NEQ
  console.log('\n🔍 Trying to search for NEQ: 1172105943');

  const textInput = page.locator('input[type="text"]').first();
  await textInput.fill('1172105943');
  await page.waitForTimeout(1000);

  // Check for checkbox
  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.count() > 0) {
    console.log('✓ Checking terms checkbox');
    await checkbox.check();
    await page.waitForTimeout(500);
  }

  // Take screenshot before search
  await page.screenshot({ path: 'debug-before-search.png' });
  console.log('📸 Screenshot saved: debug-before-search.png');

  // Click search button
  const searchButton = page.locator('button:has-text("Rechercher")').first();
  if (await searchButton.count() > 0) {
    console.log('🔘 Clicking search button...');
    await searchButton.click();
    await page.waitForTimeout(3000);
  } else {
    console.log('❌ Search button not found');
  }

  // Take screenshot after search
  await page.screenshot({ path: 'debug-after-search.png' });
  console.log('📸 Screenshot saved: debug-after-search.png');

  // Check what's on the page now
  const pageText = await page.textContent('body');
  console.log('\n📄 Page content sample (first 500 chars):');
  console.log(pageText?.substring(0, 500));

  // Look for results
  const hasResults = await page.locator('text=/Statut\\s+de\\s+l.entreprise/i').count();
  console.log(`\n🔍 Found ${hasResults} status label(s)`);

  if (hasResults > 0) {
    console.log('✓ Results found!');

    // Look for "Consulter" buttons
    const consultButtons = await page.locator('button:has-text("Consulter"), a:has-text("Consulter")').all();
    console.log(`Found ${consultButtons.length} Consulter button(s)`);
  } else {
    console.log('❌ No results found - checking for error messages');

    // Check for error or "no results" messages
    const bodyText = await page.textContent('body');
    if (bodyText?.includes('résultat')) {
      console.log('Found "résultat" text');
      const resultText = bodyText.match(/.{0,100}résultat.{0,100}/i);
      console.log(`Context: ${resultText?.[0]}`);
    }
  }

  console.log('\n⏸️  Pausing for manual inspection...');
  console.log('   Check the browser window and screenshots');
  console.log('   Press Ctrl+C to exit when done');

  // Keep browser open for manual inspection
  await page.waitForTimeout(300000); // 5 minutes

  await browser.close();
}

debugScraper().catch(console.error);
