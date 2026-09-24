const { chromium } = require('playwright');
const path = require('path');

async function auditSiteTheme() {
  console.log('--- Auditing Site Theme Across All Sections ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Wait for intro to complete (6.8s + buffer)
  await page.waitForTimeout(7000);

  // 1. Hero
  await page.screenshot({ path: 'audit_butter_01_hero.png' });
  console.log('Captured Hero');

  // 2. Scroll to Works
  await page.evaluate(() => {
    const works = document.getElementById('works');
    if (works) works.scrollIntoView();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'audit_butter_02_works.png' });
  console.log('Captured Works');

  // 3. Scroll to Studio
  await page.evaluate(() => {
    const studio = document.getElementById('studio');
    if (studio) studio.scrollIntoView();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'audit_butter_03_studio.png' });
  console.log('Captured Studio');

  // 4. Scroll to Contact / Footer
  await page.evaluate(() => {
    const contact = document.getElementById('contact');
    if (contact) contact.scrollIntoView();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'audit_butter_04_contact.png' });
  console.log('Captured Contact');

  console.log('Console Errors:', errors);
  await browser.close();
}

auditSiteTheme().catch(console.error);
