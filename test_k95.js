const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log('Navigating to https://k95.it/en...');
  const res = await page.goto('https://k95.it/en', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Status:', res.status());
  console.log('Title:', await page.title());
  
  // Find navigation links
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      href: a.href,
      text: a.innerText.trim()
    })).filter(l => l.href && l.href.includes('k95.it'));
  });
  console.log('Discovered links count:', links.length);
  console.log('Sample links:', links.slice(0, 15));
  
  await browser.close();
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
