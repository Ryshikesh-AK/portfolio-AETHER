// Browser test for /admin (Playwright, which is already a dependency of the project root).
// Self-contained like admin-test.js: throwaway server + test-only admin, and it removes everything it creates.
// Run from server/:  node admin-ui-test.js        (CHROMIUM_PATH=/path/to/chrome to use a specific browser)
const assert = require('assert');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const { chromium } = require('playwright');

const USER = 'test-admin';
const PASS = 'test-pass-' + Math.random().toString(36).slice(2);

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), ADMIN_USERNAME: USER, ADMIN_PASSWORD_HASH: bcrypt.hashSync(PASS, 4) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('test server did not start')), 15000);
    child.stdout.on('data', (d) => { if (String(d).includes('Ashi server:')) { clearTimeout(t); resolve(); } });
    child.on('exit', (c) => { clearTimeout(t); reject(new Error('test server exited early: ' + c)); });
  });
  return { base: `http://localhost:${port}`, stop: () => child.kill() };
}

(async () => {
  const server = await startServer();
  const base = server.base;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashi-ui-'));
  const png = path.join(tmp, 'one.png');
  const jpg = path.join(tmp, 'two.jpg');
  const txt = path.join(tmp, 'not-image.txt');
  await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#cc3366' } }).png().toFile(png);
  await sharp({ create: { width: 800, height: 500, channels: 3, background: '#3366cc' } }).jpeg().toFile(jpg);
  fs.writeFileSync(txt, 'hello');

  const api = async (method, p, body, cookie) => {
    const r = await fetch(base + p, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  const projects = async () => (await api('GET', '/api/projects')).body;
  const startCount = (await projects()).length;
  const startOrder = (await projects()).map((p) => p.id);
  const startCats = (await api('GET', '/api/categories')).body;

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/40[1-9]|413|415|Failed to load resource/.test(m.text())) problems.push('console: ' + m.text()); });
  page.on('dialog', (d) => d.accept());

  const rows = () => page.locator('#project-table tbody tr');
  const rowFor = (title) => rows().filter({ has: page.locator('strong', { hasText: new RegExp('^' + title + '$') }) });
  const toast = () => page.locator('#status');

  try {
    // 1. login screen, wrong then right credentials
    await page.goto(base + '/admin');   // no trailing slash: must redirect to /admin/
    await page.waitForSelector('#login-form');
    assert.ok(page.url().endsWith('/admin/'), '1. /admin redirects to /admin/');
    assert.ok(await page.locator('#main-view').isHidden(), '1. dashboard hidden before login');
    await page.fill('[name=username]', USER);
    await page.fill('[name=password]', 'wrong');
    await page.click('#login-form button[type=submit]');
    await page.waitForSelector('#login-error:not([hidden])');
    assert.match(await page.textContent('#login-error'), /Invalid credentials/, '1. wrong password message');
    assert.ok(await page.locator('#main-view').isHidden(), '1. still logged out');
    await page.fill('[name=password]', PASS);
    await page.click('#login-form button[type=submit]');
    await rows().first().waitFor();
    assert.strictEqual(await rows().count(), startCount, '1. all projects listed after login');
    assert.strictEqual(await page.textContent('#whoami'), USER);

    // 2. session survives reload
    await page.reload();
    await rows().first().waitFor();
    assert.strictEqual(await rows().count(), startCount, '2. still logged in after reload');

    // 3. search / category / featured filters; reordering is locked while filtered
    await page.fill('#search', 'swiss');
    const swiss = (await projects()).filter((p) => [p.title, p.slug, p.id, p.meta, p.subtitle, p.heroTitle, p.heroTag].some((v) => v && String(v).toLowerCase().includes('swiss'))).length;
    assert.ok(swiss >= 2 && swiss < startCount, '3. sanity: search term is selective');
    assert.strictEqual(await rows().count(), swiss, '3. search "swiss" matches title/meta/tag');
    assert.ok(await rows().first().locator('.order button').first().isDisabled(), '3. reorder disabled while filtering');
    await page.fill('#search', 'aetheria-os');
    assert.strictEqual(await rows().count(), 1, '3. search by slug');
    await page.fill('#search', '');
    await page.selectOption('#filter-category', 'systems');
    const systems = (await projects()).filter((p) => p.categories.includes('systems')).length;
    assert.strictEqual(await rows().count(), systems, '3. category filter');
    await page.selectOption('#filter-category', '');
    await page.selectOption('#filter-featured', 'yes');
    assert.strictEqual(await rows().count(), 5, '3. featured filter');
    await page.selectOption('#filter-featured', 'no');
    assert.strictEqual(await rows().count(), startCount - 5, '3. not-featured filter');
    await page.selectOption('#filter-featured', '');
    assert.strictEqual(await rows().count(), startCount, '3. filters cleared');

    // 4. create a project with an image
    await page.click('#new-project');
    assert.strictEqual(await page.locator('#category-checks input').count(), startCats.length, '4. category checkboxes');
    await page.fill('#project-form [name=title]', 'UI Test Project');
    await page.fill('#project-form [name=badges]', 'ONE, TWO');
    await page.fill('#project-form [name=desc]', 'Made by the UI test');
    await page.check('#category-checks input[value=telemetry]');
    await page.setInputFiles('#image-file', txt);
    await page.waitForSelector('#dialog-error:not([hidden])');
    assert.match(await page.textContent('#dialog-error'), /JPEG, PNG or WebP/, '4. non-image rejected client-side');
    await page.setInputFiles('#image-file', png);
    await page.waitForFunction(() => document.querySelector('#image-preview').src.startsWith('blob:'));
    assert.match(await page.textContent('#image-status'), /New image selected/, '4. local preview shown before saving');
    await page.click('#project-form button[type=submit]');
    await page.waitForSelector('#project-dialog', { state: 'hidden' });
    await rowFor('UI Test Project').waitFor();
    let mine = (await projects()).find((p) => p.title === 'UI Test Project');
    assert.ok(mine, '4. created via API');
    assert.deepStrictEqual([mine.slug, mine.categories, mine.badges, mine.featured, mine.desc], ['ui-test-project', ['telemetry'], ['ONE', 'TWO'], false, 'Made by the UI test']);
    assert.match(mine.image, /^media\/original\/ui-test-project-[0-9a-f]{16}\.png$/, '4. image uploaded with the save');
    const thumb = rowFor('UI Test Project').locator('img.thumb');
    await thumb.waitFor();
    await page.waitForFunction((t) => { const i = document.querySelector(`tr[data-id="${t}"] img.thumb`); return i && i.complete && i.naturalWidth > 0; }, mine.id);
    assert.ok(mine.thumb.startsWith('media/thumbs/'), '4. thumbnail from the image pipeline');

    // 5. edit + replace image, then preview + delete image
    await rowFor('UI Test Project').getByRole('button', { name: 'Edit' }).click();
    assert.strictEqual(await page.inputValue('#project-form [name=title]'), 'UI Test Project', '5. form prefilled');
    assert.match(await page.textContent('#image-status'), /^Uploaded image/, '5. shows the uploaded image');
    await page.waitForFunction(() => { const i = document.querySelector('#image-preview'); return i.complete && i.naturalWidth > 0; });
    await page.fill('#project-form [name=title]', 'UI Test Renamed');
    await page.check('#project-form [name=featured]');
    await page.setInputFiles('#image-file', jpg);
    await page.click('#project-form button[type=submit]');
    await page.waitForSelector('#project-dialog', { state: 'hidden' });
    await rowFor('UI Test Renamed').waitFor();
    const before = mine;
    mine = (await projects()).find((p) => p.id === before.id);
    assert.strictEqual(mine.title, 'UI Test Renamed'); assert.strictEqual(mine.featured, true);
    assert.notStrictEqual(mine.image, before.image, '5. image replaced');
    assert.match(mine.image, /\.jpg$/);
    assert.strictEqual((await fetch(`${base}/${before.image}`)).status, 404, '5. old upload removed from disk');
    await rowFor('UI Test Renamed').getByRole('button', { name: 'Edit' }).click();
    await page.click('#image-remove');
    await page.waitForFunction(() => document.querySelector('#image-status').textContent === 'No image');
    assert.ok(await page.locator('#image-remove').isHidden(), '5. remove button hides once nothing is uploaded');
    assert.strictEqual((await projects()).find((p) => p.id === mine.id).image, null, '5. image deleted');
    await page.click('#dialog-cancel');

    // 6. featured toggle from the list
    const box = rowFor('UI Test Renamed').locator('input[type=checkbox]');
    assert.ok(await box.isChecked(), '6. starts featured');
    await box.uncheck();
    await page.waitForFunction((id) => !document.querySelector(`tr[data-id="${id}"] input[type=checkbox]`).checked && /no longer featured/.test(document.querySelector('#status').textContent), mine.id);
    assert.strictEqual((await projects()).find((p) => p.id === mine.id).featured, false, '6. toggle saved');

    // 7. ordering: new project is last; move it up one and down again
    assert.strictEqual((await projects()).at(-1).id, mine.id, '7. appended last');
    await rowFor('UI Test Renamed').getByRole('button', { name: /^Move .* up$/ }).click();
    await page.waitForFunction((id) => document.querySelectorAll('#project-table tbody tr')[12].dataset.id === id, mine.id);
    assert.strictEqual((await projects()).at(-2).id, mine.id, '7. moved up');
    await rowFor('UI Test Renamed').getByRole('button', { name: /^Move .* down$/ }).click();
    await page.waitForFunction((id) => document.querySelectorAll('#project-table tbody tr')[13].dataset.id === id, mine.id);
    assert.strictEqual((await projects()).at(-1).id, mine.id, '7. moved back down');
    assert.ok(await rowFor('UI Test Renamed').getByRole('button', { name: /down$/ }).isDisabled(), '7. last row cannot move down');

    // 8. categories tab: add, rename, use, delete
    await page.click('[data-tab=categories]');
    await page.fill('#category-form [name=slug]', 'ui-cat');
    await page.fill('#category-form [name=label]', 'UI CAT');
    await page.click('#category-form button[type=submit]');
    const catRow = page.locator('#category-table tr[data-slug="ui-cat"]');
    await catRow.waitFor();
    await catRow.locator('input').fill('UI CAT 2');
    await catRow.getByRole('button', { name: 'Save' }).click();
    await page.waitForFunction(() => /Category saved/.test(document.querySelector('#status').textContent));
    assert.ok((await api('GET', '/api/categories')).body.some((c) => c.slug === 'ui-cat' && c.label === 'UI CAT 2'), '8. renamed');
    await page.click('[data-tab=projects]');
    await rowFor('UI Test Renamed').getByRole('button', { name: 'Edit' }).click();
    await page.check('#category-checks input[value=ui-cat]');
    await page.click('#project-form button[type=submit]');
    await page.waitForSelector('#project-dialog', { state: 'hidden' });
    assert.deepStrictEqual((await projects()).find((p) => p.id === mine.id).categories, ['telemetry', 'ui-cat'], '8. category assigned');
    await page.click('[data-tab=categories]');
    assert.strictEqual((await catRow.locator('td').nth(2).textContent()), '1', '8. usage count');
    await page.click('#category-form button[type=submit]');   // empty form: blocked by validation, no request
    await catRow.getByRole('button', { name: 'Delete' }).click();
    await page.waitForFunction(() => !document.querySelector('#category-table tr[data-slug="ui-cat"]'));
    assert.deepStrictEqual((await projects()).find((p) => p.id === mine.id).categories, ['telemetry'], '8. removed from project');
    await page.fill('#category-form [name=slug]', 'spatial');   // duplicate -> server error shown
    await page.fill('#category-form [name=label]', 'DUP');
    await page.click('#category-form button[type=submit]');
    await page.waitForFunction(() => /already exists/.test(document.querySelector('#status').textContent));
    assert.ok(await toast().evaluate((n) => n.classList.contains('error')), '8. server errors surface in the status bar');
    await page.click('[data-tab=projects]');

    // 9. duplicate slug error is shown inside the dialog and nothing is lost
    await page.click('#new-project');
    await page.fill('#project-form [name=title]', 'Dupe');
    await page.fill('#project-form [name=slug]', 'aetheria-os');
    await page.click('#project-form button[type=submit]');
    await page.waitForSelector('#dialog-error:not([hidden])');
    assert.match(await page.textContent('#dialog-error'), /slug is already in use/, '9. conflict message');
    assert.ok(await page.locator('#project-dialog').evaluate((d) => d.open), '9. dialog stays open');
    await page.click('#dialog-cancel');

    // 10. delete the project (its upload is gone already; confirm dialog auto-accepted)
    await rowFor('UI Test Renamed').getByRole('button', { name: 'Delete' }).click();
    await page.waitForFunction(() => !document.querySelector('#project-table tbody').textContent.includes('UI Test Renamed'));
    assert.strictEqual((await projects()).length, startCount, '10. deleted');

    // 11. a stored title with markup is shown as text, never as HTML
    const login = await api('POST', '/api/admin/login', { username: USER, password: PASS });
    const evil = await api('POST', '/api/admin/projects', { title: '<img src=x onerror=window.__xss=1>', slug: 'xss-check' }, login.cookie);
    await page.reload();
    await page.locator('#project-table tbody tr').nth(startCount).waitFor();
    assert.strictEqual(await page.evaluate(() => window.__xss), undefined, '11. no markup injection');
    assert.ok((await page.textContent('#project-table')).includes('<img src=x'), '11. shown literally');
    await api('DELETE', `/api/admin/projects/${evil.body.id}`, undefined, login.cookie);

    // 12. logout returns to the login form and really ends the session
    await page.reload();
    await rows().first().waitFor();
    await page.click('#logout-btn');
    await page.waitForSelector('#login-form', { state: 'visible' });
    assert.ok(await page.locator('#main-view').isHidden(), '12. dashboard hidden after logout');
    const me = await page.evaluate(() => fetch('/api/admin/me').then((r) => r.status));
    assert.strictEqual(me, 401, '12. session invalid server-side');

    // 13. an expired/invalid session sends the user back to login instead of failing silently
    await page.fill('[name=username]', USER);
    await page.fill('[name=password]', PASS);
    await page.click('#login-form button[type=submit]');
    await rows().first().waitFor();
    await page.context().clearCookies();
    await page.locator('#project-table tbody tr').first().locator('input[type=checkbox]').click();
    await page.waitForSelector('#login-form', { state: 'visible' });
    assert.match(await page.textContent('#login-error'), /Session expired/, '13. expired session handled');

    assert.deepStrictEqual(problems, [], 'no page errors / unexpected console errors');
    assert.deepStrictEqual((await projects()).map((p) => p.id), startOrder, 'final: project list as found');
    assert.deepStrictEqual((await api('GET', '/api/categories')).body, startCats, 'final: categories as found');
    console.log('All admin UI checks passed');
  } finally {
    // Best-effort cleanup if something failed midway.
    const l = await api('POST', '/api/admin/login', { username: USER, password: PASS });
    for (const p of await projects()) if (!startOrder.includes(p.id)) await api('DELETE', `/api/admin/projects/${p.id}`, undefined, l.cookie);
    for (const c of (await api('GET', '/api/categories')).body) if (!startCats.some((s) => s.slug === c.slug)) await api('DELETE', `/api/admin/categories/${c.slug}`, undefined, l.cookie);
    await browser.close();
    server.stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
