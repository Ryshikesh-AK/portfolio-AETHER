// Browser test for /gallery (Playwright). Self-contained: starts a throwaway server on a free
// port (no admin credentials needed — the gallery only reads the public API) and asserts against
// the seeded data, so it needs no cleanup of its own.
const assert = require('assert');
const net = require('net');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), ADMIN_USERNAME: '', ADMIN_PASSWORD_HASH: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('test server did not start')), 15000);
    child.stdout.on('data', (d) => { if (String(d).includes('Ashi server:')) { clearTimeout(t); resolve(); } });
    child.on('exit', (c) => { clearTimeout(t); reject(new Error('test server exited early: ' + c)); });
  });
  return { base: `http://localhost:${port}`, stop: () => child.kill() };
}

const noOverflow = async (page) => {
  const [sw, iw] = await Promise.all([page.evaluate(() => document.documentElement.scrollWidth), page.evaluate(() => window.innerWidth)]);
  assert.ok(sw <= iw, `no horizontal overflow (scrollWidth ${sw} <= innerWidth ${iw})`);
};

(async () => {
  const server = await startServer();
  const base = server.base;
  const projects = await fetch(`${base}/api/projects`).then((r) => r.json());
  const categories = await fetch(`${base}/api/categories`).then((r) => r.json());

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const problems = [];
  const track = (page) => {
    page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console: ' + m.text()); });
  };

  try {
    // ---- desktop ----
    const desktop = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    track(desktop);
    await desktop.goto(base + '/gallery/', { waitUntil: 'networkidle' });

    await desktop.waitForSelector('.project-card');
    assert.strictEqual(await desktop.locator('.project-card').count(), projects.length, 'desktop: every project rendered');
    assert.strictEqual(await desktop.locator('.filter-pill').count(), categories.length + 1, 'desktop: ALL + one pill per category');
    await desktop.waitForFunction(() => document.querySelector('.project-card').classList.contains('in-view'));
    assert.ok(await desktop.locator('.card-media img').first().getAttribute('loading'), 'desktop: images are lazy-loaded');

    // theme: Pale Butter background, black hard-offset borders/shadows, sharp corners
    const theme = await desktop.evaluate(() => {
      const body = getComputedStyle(document.body);
      const card = getComputedStyle(document.querySelector('.project-card'));
      return { bg: body.backgroundColor, border: card.borderTopWidth + ' ' + card.borderTopColor, shadow: card.boxShadow, radius: card.borderRadius };
    });
    assert.strictEqual(theme.bg, 'rgb(246, 239, 166)', 'desktop: Pale Butter background');
    assert.match(theme.border, /4px rgb\(0, 0, 0\)/, 'desktop: thick black card border');
    assert.match(theme.shadow, /rgb\(0, 0, 0\) -?\d+px -?\d+px 0px 0px/, 'desktop: hard black shadow with zero blur/spread');
    assert.strictEqual(theme.radius, '0px', 'desktop: sharp corners');

    // filtering: a real category narrows the grid; ALL restores it
    const cat = categories[0];
    const expected = projects.filter((p) => p.categories.includes(cat.slug)).length;
    await desktop.click(`.filter-pill[data-category="${cat.slug}"]`);
    await desktop.waitForTimeout(150);
    let visible = await desktop.locator('.project-card:not([hidden])').count();
    assert.strictEqual(visible, expected, `desktop: filtering by ${cat.slug} shows only its projects`);
    await desktop.click('.filter-pill[data-category=""]');
    await desktop.waitForTimeout(150);
    assert.strictEqual(await desktop.locator('.project-card:not([hidden])').count(), projects.length, 'desktop: ALL restores every card');

    // an empty-result category shows the empty state, not a blank grid
    await desktop.evaluate(() => {
      const bar = document.querySelector('.filter-bar');
      const btn = document.createElement('button');
      btn.className = 'filter-pill'; btn.dataset.category = '__no_such_category__'; btn.textContent = 'NONE';
      bar.appendChild(btn); btn.click();
    });
    await desktop.waitForTimeout(150);
    assert.strictEqual(await desktop.locator('.project-card:not([hidden])').count(), 0, 'desktop: no matches');
    assert.ok(await desktop.locator('.empty-state').isVisible(), 'desktop: empty state shown');
    await desktop.click('.filter-pill[data-category=""]');
    await desktop.waitForTimeout(150);

    // click-through to detail view
    const first = projects[0];
    await desktop.locator(`.project-card[data-id="${first.id}"]`).click();
    await desktop.waitForSelector('.detail-backdrop.open');
    assert.strictEqual(await desktop.textContent('#detail-title'), first.title, 'desktop: detail shows the clicked project');
    await desktop.waitForFunction((y) => document.querySelector('#detail-year').textContent === y, first.year || '—');
    assert.match(await desktop.getAttribute('#detail-image', 'src') || '', /\/(assets|media)\//, 'desktop: detail image resolved to an absolute path');
    // Escape closes it
    await desktop.keyboard.press('Escape');
    await desktop.waitForSelector('.detail-backdrop', { state: 'hidden' });

    // backdrop click also closes it
    await desktop.locator(`.project-card[data-id="${first.id}"]`).click();
    await desktop.waitForSelector('.detail-backdrop.open');
    await desktop.locator('.detail-backdrop').click({ position: { x: 5, y: 5 } });
    await desktop.waitForSelector('.detail-backdrop', { state: 'hidden' });

    await noOverflow(desktop);
    assert.ok(await desktop.locator('.centerpiece-stage').isHidden(), 'desktop: no mobile centerpiece');
    await desktop.close();

    // ---- mobile ----
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    track(mobile);
    await mobile.goto(base + '/gallery/', { waitUntil: 'networkidle' });
    await mobile.waitForSelector('.project-card');
    await mobile.waitForTimeout(500);   // let the centerpiece render a frame

    await noOverflow(mobile);
    assert.ok(await mobile.locator('.centerpiece-stage').isVisible(), 'mobile: centerpiece stage visible');
    const canvasBox = await mobile.locator('#centerpiece-canvas').boundingBox();
    assert.ok(canvasBox && canvasBox.width > 100 && canvasBox.height > 100, 'mobile: centerpiece has a meaningful size');
    // the canvas sits within the viewport with no overflow of its own
    assert.ok(canvasBox.x >= 0 && canvasBox.x + canvasBox.width <= 390, 'mobile: centerpiece stays inside the viewport');
    // it actually drew something (not a blank/transparent canvas)
    const hasPixels = await mobile.evaluate(() => {
      const c = document.getElementById('centerpiece-canvas');
      const probe = document.createElement('canvas');
      probe.width = c.width; probe.height = c.height;
      probe.getContext('2d').drawImage(c, 0, 0);
      const data = probe.getContext('2d').getImageData(0, 0, probe.width, probe.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
      return false;
    });
    assert.ok(hasPixels, 'mobile: centerpiece rendered non-transparent pixels');

    // cards form two strips clear of the centerpiece: every card's box sits left of the
    // centerpiece's left edge or right of its right edge (no overlap).
    const cpBox = canvasBox;
    const cardBoxes = await mobile.locator('.project-card:not([hidden])').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })));
    assert.ok(cardBoxes.length > 4, 'mobile: cards rendered');
    const overlapping = cardBoxes.filter((r) => r.right > cpBox.x && r.left < cpBox.x + cpBox.width && r.bottom > cpBox.y && r.top < cpBox.y + cpBox.height);
    assert.strictEqual(overlapping.length, 0, 'mobile: no card overlaps the centerpiece');
    const leftCol = cardBoxes.filter((r) => r.right <= cpBox.x + 4);
    const rightCol = cardBoxes.filter((r) => r.left >= cpBox.x + cpBox.width - 4);
    assert.ok(leftCol.length > 0 && rightCol.length > 0, 'mobile: cards split into a left strip and a right strip');

    // filtering + detail view work on mobile too
    await mobile.click(`.filter-pill[data-category="${cat.slug}"]`);
    await mobile.waitForTimeout(150);
    visible = await mobile.locator('.project-card:not([hidden])').count();
    assert.strictEqual(visible, expected, 'mobile: filtering works');
    await mobile.click('.filter-pill[data-category=""]');
    await mobile.waitForTimeout(150);

    await mobile.locator(`.project-card[data-id="${first.id}"]`).click();
    await mobile.waitForSelector('.detail-backdrop.open');
    assert.strictEqual(await mobile.textContent('#detail-title'), first.title, 'mobile: detail view opens');
    await noOverflow(mobile);
    await mobile.keyboard.press('Escape');
    await mobile.waitForSelector('.detail-backdrop', { state: 'hidden' });

    // centerpiece is actually animating: two pixel snapshots of the canvas differ over time
    const frame = () => mobile.evaluate(() => document.getElementById('centerpiece-canvas').toDataURL());
    const fA = await frame();
    await mobile.waitForTimeout(500);
    const fB = await frame();
    assert.notStrictEqual(fA, fB, 'mobile: centerpiece is animating (frames differ over time)');

    await mobile.close();

    assert.deepStrictEqual(problems, [], 'no page errors / unexpected console errors on either viewport');
    console.log('All gallery UI checks passed');
  } finally {
    await browser.close();
    server.stop();
  }
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
