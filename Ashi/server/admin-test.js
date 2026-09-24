// Self-contained: starts a throwaway server on a free port with a test-only admin (random password),
// exercises the admin write API and the (now admin-only) image routes, then restores everything it
// touched (test project/category deleted, project order restored, media folders back to how they were).
const assert = require('assert');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');

const USER = 'test-admin';
const PASS = 'test-pass-' + Math.random().toString(36).slice(2);
const MEDIA = ['original', 'thumbs'].map((d) => path.join(__dirname, 'media', d));
const mediaCount = () => MEDIA.reduce((n, d) => n + fs.readdirSync(d).length, 0);

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

async function start(env) {
  const port = await freePort();
  const child = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: { ...process.env, ADMIN_USERNAME: '', ADMIN_PASSWORD_HASH: '', SESSION_TTL_HOURS: '', COOKIE_SECURE: '', NODE_ENV: 'development', PORT: String(port), ...env },
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
  const s = await start({ ADMIN_USERNAME: USER, ADMIN_PASSWORD_HASH: bcrypt.hashSync(PASS, 4) });
  let cookie = '';
  const call = async (method, p, body, opts = {}) => {
    const headers = { ...(cookie && !opts.anon ? { Cookie: cookie } : {}) };
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const r = await fetch(s.base + p, { method, headers, body: payload });
    return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
  };
  const projects = async () => (await call('GET', '/api/projects')).body;
  const categories = async () => (await call('GET', '/api/categories')).body;
  const imageForm = async (w, h, fmt = 'png') => {
    const f = new FormData();
    f.append('image', new Blob([await sharp({ create: { width: w, height: h, channels: 3, background: '#336699' } })[fmt]().toBuffer()], { type: 'image/' + fmt }), 'x.' + fmt);
    return f;
  };

  const startProjects = await projects();
  const startOrder = startProjects.map((p) => p.id);
  const startCats = await categories();
  const startMedia = mediaCount();
  let createdId = null;
  let createdCat = null;

  try {
    // 1. the dashboard page is served, with security headers; it holds no data
    let r = await fetch(s.base + '/admin/');
    assert.strictEqual(r.status, 200, '1. /admin/ served');
    assert.match(await r.text(), /Ashi admin/);
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/, '1. CSP header');
    assert.strictEqual(r.headers.get('x-frame-options'), 'DENY');
    for (const f of ['admin.js', 'admin.css']) assert.strictEqual((await fetch(`${s.base}/admin/${f}`)).status, 200, '1. ' + f);
    assert.strictEqual((await fetch(s.base + '/admin/../server/db.js')).status, 404, '1. server source not exposed');

    // 2. every write is refused without a session (admin API and image routes)
    const anon = { anon: true };
    const denied = [
      ['POST', '/api/admin/projects', { title: 'x' }], ['PATCH', '/api/admin/projects/1', { featured: true }],
      ['DELETE', '/api/admin/projects/1'], ['PUT', '/api/admin/projects/order', { ids: [] }],
      ['POST', '/api/admin/categories', { slug: 'x', label: 'X' }], ['PATCH', '/api/admin/categories/spatial', { label: 'X' }],
      ['DELETE', '/api/admin/categories/spatial'],
      ['POST', '/api/projects/13/image', await imageForm(50, 50)], ['PUT', '/api/projects/13/image', await imageForm(50, 50)],
      ['DELETE', '/api/projects/13/image']
    ];
    for (const [m, p, b] of denied) assert.strictEqual((await call(m, p, b, anon)).status, 401, `2. ${m} ${p} needs a session`);
    assert.strictEqual((await projects()).length, startProjects.length, '2. nothing changed');
    assert.strictEqual((await call('GET', '/api/projects', undefined, anon)).status, 200, '2. public GET stays open');

    // 3. login
    r = await call('POST', '/api/admin/login', { username: USER, password: PASS });
    assert.strictEqual(r.status, 200, '3. login');
    cookie = r.headers.get('set-cookie').split(';')[0];

    // 4. create: validation, then success
    for (const [body, status, why] of [
      [{}, 400, 'missing title'], [{ title: '  ' }, 400, 'blank title'], [{ title: 'T', bogus: 1 }, 400, 'unknown field'],
      [{ title: 'T', slug: 'Bad Slug' }, 400, 'bad slug'], [{ title: 'T', categories: ['nope'] }, 400, 'unknown category'],
      [{ title: 'T', featured: 'yes' }, 400, 'non-boolean featured'], [{ title: 'T', badges: 'a' }, 400, 'badges not array'],
      [{ title: 'T', slug: '1' }, 409, 'slug equal to an existing id'], [{ title: 'T', slug: 'aetheria-os' }, 409, 'duplicate slug']
    ]) assert.strictEqual((await call('POST', '/api/admin/projects', body)).status, status, '4. ' + why);
    r = await call('POST', '/api/admin/projects', { title: '  Admin Test Project  ', categories: ['spatial', 'spatial'], badges: [' A ', '', 'B'], meta: 'M', desc: 'D' });
    const maxPrior = startProjects.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
    const expectedId = String(maxPrior + 1);
    createdId = r.body.id;
    assert.strictEqual(createdId, expectedId, '4. ids continue from the highest existing id');
    let p = (await projects()).find((x) => x.id === createdId);
    assert.deepStrictEqual(
      { title: p.title, slug: p.slug, categories: p.categories, badges: p.badges, meta: p.meta, desc: p.desc, featured: p.featured, heroSlot: p.heroSlot, image: p.image },
      { title: 'Admin Test Project', slug: 'admin-test-project', categories: ['spatial'], badges: ['A', 'B'], meta: 'M', desc: 'D', featured: false, heroSlot: null, image: null },
      '4. stored trimmed/deduped, slug derived');
    assert.strictEqual((await projects()).at(-1).id, createdId, '4. appended at the end of the order');

    // 5. update + featured toggle (PATCH is partial)
    assert.strictEqual((await call('PATCH', `/api/admin/projects/${createdId}`, {})).status, 400, '5. empty patch');
    assert.strictEqual((await call('PATCH', '/api/admin/projects/999', { title: 'x' })).status, 404, '5. unknown id');
    assert.strictEqual((await call('PATCH', `/api/admin/projects/${createdId}`, { slug: 'aetheria-os' })).status, 409, '5. slug taken');
    assert.strictEqual((await call('PATCH', `/api/admin/projects/${createdId}`, { title: '' })).status, 400, '5. title cannot be blanked');
    assert.strictEqual((await call('PATCH', `/api/admin/projects/${createdId}`, { featured: true })).status, 200, '5. feature');
    r = await call('PATCH', `/api/admin/projects/${createdId}`, { title: 'Renamed', slug: 'renamed-test', meta: '', categories: ['spatial', 'systems'], heroTitle: 'HT', heroTag: 'HG' });
    assert.strictEqual(r.status, 200, '5. update');
    p = (await projects()).find((x) => x.id === createdId);
    assert.deepStrictEqual(
      { title: p.title, slug: p.slug, meta: p.meta, categories: p.categories, featured: p.featured, desc: p.desc, heroTitle: p.heroTitle, heroTag: p.heroTag },
      { title: 'Renamed', slug: 'renamed-test', meta: null, categories: ['spatial', 'systems'], featured: true, desc: 'D', heroTitle: 'HT', heroTag: 'HG' },
      '5. only sent fields changed');
    assert.strictEqual((await call('GET', '/api/projects/renamed-test')).body.id, createdId, '5. new slug resolves');

    // 6. images through the existing routes, now with a session
    r = await call('POST', `/api/projects/${createdId}/image`, await imageForm(1000, 1500));
    assert.strictEqual(r.status, 201, '6. upload');
    const first = r.body;
    assert.strictEqual(mediaCount(), startMedia + 2, '6. two files written');
    assert.strictEqual((await fetch(`${s.base}/${first.thumb}`)).status, 200, '6. thumb served');
    assert.strictEqual((await call('POST', `/api/projects/${createdId}/image`, await imageForm(50, 50))).status, 409, '6. second POST refused');
    r = await call('PUT', `/api/projects/${createdId}/image`, await imageForm(800, 600, 'jpeg'));
    assert.strictEqual(r.status, 200, '6. replace');
    assert.strictEqual(mediaCount(), startMedia + 2, '6. no orphans after replace');
    assert.strictEqual((await fetch(`${s.base}/${first.image}`)).status, 404, '6. old file gone');
    r = await call('DELETE', `/api/projects/${createdId}/image`);
    assert.strictEqual(r.status, 200, '6. delete image');
    assert.strictEqual(mediaCount(), startMedia, '6. files removed');
    assert.strictEqual((await projects()).find((x) => x.id === createdId).image, null, '6. new project has no fallback image');
    assert.strictEqual((await call('DELETE', `/api/projects/${createdId}/image`)).status, 404, '6. nothing left to delete');

    // 7. ordering
    const ids = (await projects()).map((x) => x.id);
    const swapped = [...ids]; [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    assert.strictEqual((await call('PUT', '/api/admin/projects/order', { ids: swapped })).status, 200, '7. reorder');
    assert.deepStrictEqual((await projects()).map((x) => x.id), swapped, '7. GET reflects the new order');
    for (const bad of [{}, { ids: 'x' }, { ids: swapped.slice(1) }, { ids: [...swapped.slice(1), swapped[1]] }, { ids: [...swapped.slice(1), 'zzz'] }]) {
      assert.ok([400, 409].includes((await call('PUT', '/api/admin/projects/order', bad)).status), '7. bad order payload refused');
    }
    assert.deepStrictEqual((await projects()).map((x) => x.id), swapped, '7. refused payloads changed nothing');
    assert.strictEqual((await call('PUT', '/api/admin/projects/order', { ids })).status, 200, '7. restore order');

    // 8. categories
    for (const [body, status] of [[{ slug: 'Bad', label: 'X' }, 400], [{ slug: 'ok-cat' }, 400], [{ slug: 'spatial', label: 'X' }, 409]]) {
      assert.strictEqual((await call('POST', '/api/admin/categories', body)).status, status, '8. category validation');
    }
    r = await call('POST', '/api/admin/categories', { slug: 'admin-test-cat', label: ' TEST CAT ' });
    assert.strictEqual(r.status, 201, '8. add category');
    createdCat = 'admin-test-cat';
    assert.deepStrictEqual((await categories()).at(-1), { slug: 'admin-test-cat', label: 'TEST CAT' }, '8. appended, trimmed');
    assert.strictEqual((await call('PATCH', '/api/admin/categories/admin-test-cat', { label: 'RENAMED' })).status, 200, '8. rename');
    assert.strictEqual((await call('PATCH', '/api/admin/categories/nope', { label: 'X' })).status, 404, '8. rename unknown');
    assert.strictEqual((await call('PATCH', `/api/admin/projects/${createdId}`, { categories: ['spatial', 'admin-test-cat'] })).status, 200, '8. assign');
    r = await call('DELETE', '/api/admin/categories/admin-test-cat');
    assert.deepStrictEqual(r.body, { ok: true, projectsUpdated: 1 }, '8. delete reports affected projects');
    createdCat = null;
    assert.deepStrictEqual((await projects()).find((x) => x.id === createdId).categories, ['spatial'], '8. removed from projects');
    assert.deepStrictEqual(await categories(), startCats, '8. categories back to start');
    assert.strictEqual((await call('DELETE', '/api/admin/categories/admin-test-cat')).status, 404, '8. delete unknown');

    // 9. delete project cleans up its uploaded files, never bundled assets
    assert.strictEqual((await call('POST', `/api/projects/${createdId}/image`, await imageForm(300, 200))).status, 201);
    assert.strictEqual(mediaCount(), startMedia + 2);
    assert.strictEqual((await call('DELETE', `/api/admin/projects/${createdId}`)).status, 200, '9. delete project');
    createdId = null;
    assert.strictEqual(mediaCount(), startMedia, '9. uploaded files removed with the project');
    assert.strictEqual((await call('DELETE', `/api/admin/projects/${expectedId}`)).status, 404, '9. already gone');
    const bundled = startProjects.find((x) => x.id === '13');
    assert.ok(fs.existsSync(path.join(__dirname, '..', bundled.thumb)), '9. bundled assets untouched');

    // 10. logout kills the session
    assert.strictEqual((await call('POST', '/api/admin/logout')).status, 200);
    assert.strictEqual((await call('POST', '/api/admin/categories', { slug: 'zz', label: 'ZZ' })).status, 401, '10. session gone');
    cookie = '';

    assert.deepStrictEqual((await projects()).map((x) => x.id), startOrder, 'final: project order as found');
    console.log('All admin API checks passed');
  } finally {
    // Best-effort cleanup if an assertion failed midway.
    if (createdId || createdCat) {
      const l = await call('POST', '/api/admin/login', { username: USER, password: PASS }, { anon: true });
      cookie = l.headers.get('set-cookie').split(';')[0];
      if (createdId) { await call('DELETE', `/api/admin/projects/${createdId}`); }
      if (createdCat) { await call('DELETE', `/api/admin/categories/${createdCat}`); }
    }
    s.stop();
  }
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
