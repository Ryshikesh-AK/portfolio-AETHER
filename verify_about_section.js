const { chromium } = require('playwright');

async function verifyAbout() {
  console.log('=== VERIFYING STUDIO / ABOUT ME SECTION ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('[Browser ERROR]', msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.error('[Page ERROR]', err.message);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click Studio nav link to trigger natural smooth scroll with scroll-margin-top
  await page.click('a[href="#studio"]');
  await page.waitForTimeout(1800);

  // Take full viewport screenshot centered on Studio section
  await page.screenshot({ path: 'verify_about_viewport.png' });
  console.log('Viewport screenshot saved to verify_about_viewport.png');

  // Check photo loaded
  const photoStats = await page.evaluate(() => {
    const img = document.querySelector('.about-photo');
    const heading = document.querySelector('.about-heading');
    const bio = document.querySelector('.about-bio-paragraph');
    const skillTags = Array.from(document.querySelectorAll('.skill-tag')).map(el => el.textContent.trim());
    const pillars = Array.from(document.querySelectorAll('.pillar-card')).map(el => el.querySelector('.pillar-title')?.textContent.trim());

    return {
      photoExists: !!img,
      photoSrc: img?.getAttribute('src'),
      photoLoaded: img ? (img.complete && img.naturalWidth > 0) : false,
      photoNaturalWidth: img?.naturalWidth,
      photoNaturalHeight: img?.naturalHeight,
      headingText: heading?.textContent.replace(/\s+/g, ' ').trim(),
      bioText: bio?.textContent.trim(),
      skillTags,
      pillarsCount: pillars.length,
      pillars
    };
  });

  console.log('Studio / About stats:', JSON.stringify(photoStats, null, 2));

  // Take screenshot of #studio
  await studioSec.screenshot({ path: 'verify_about_studio.png' });
  console.log('Screenshot saved to verify_about_studio.png');

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error('FAILED with console errors:', consoleErrors);
    process.exit(1);
  } else if (!photoStats.photoLoaded) {
    console.error('FAILED: Photo not loaded!');
    process.exit(1);
  } else {
    console.log('SUCCESS: All checks passed!');
  }
}

verifyAbout().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
