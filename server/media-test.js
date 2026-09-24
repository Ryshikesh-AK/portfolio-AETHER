// Usage: start the server (npm start), then:
//   TEST_ADMIN_USER=... TEST_ADMIN_PASS=... npm run test:media     (your real admin login: image writes need a session)
// Exercises upload (POST), replace (PUT) and delete (DELETE) on hero-only project 13, then restores it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BASE = process.env.BASE || 'http://localhost:3000';
const ID = '13';
const DIRS = ['original', 'thumbs'].map((d) => path.join(__dirname, 'media', d));
const count = () => DIRS.reduce((n, d) => n + fs.readdirSync(d).length, 0);
const exists = (rel) => fetch(`${BASE}/${rel}`).then((r) => r.status === 200);

let cookie = '';
const send = async (method, file, type, name = 'image') => {
  const form = new FormData();
  if (file) form.append(name, new Blob([file], { type }), 'whatever name.png');
  const r = await fetch(`${BASE}/api/projects/${ID}/image`, { method, headers: cookie ? { Cookie: cookie } : {}, body: method === 'DELETE' ? undefined : form });
  return { status: r.status, body: await r.json() };
};
const project = () => fetch(`${BASE}/api/projects/${ID}`).then((r) => r.json());
const make = (w, h, c, fmt) => sharp({ create: { width: w, height: h, channels: 3, background: c } })[fmt]().toBuffer();

(async () => {
  const { TEST_ADMIN_USER: u, TEST_ADMIN_PASS: p } = process.env;
  assert.ok(u && p, 'set TEST_ADMIN_USER and TEST_ADMIN_PASS (image routes are admin-only)');
  const anon = await send('POST', await make(10, 10, '#000000', 'png'), 'image/png');
  assert.strictEqual(anon.status, 401, 'image POST without a session -> 401');
  const login = await fetch(`${BASE}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
  assert.strictEqual(login.status, 200, 'admin login');
  cookie = login.headers.get('set-cookie').split(';')[0];

  const before = await project();
  const start = count();

  // --- upload (portrait PNG) ---
  const png = await make(1000, 1500, '#ff0000', 'png');
  let r = await send('POST', png, 'image/png');
  assert.strictEqual(r.status, 201, 'POST 201');
  const first = r.body;
  assert.match(first.image, /^media\/original\/botanical-grid-[0-9a-f]{16}\.png$/);
  assert.match(first.thumb, /^media\/thumbs\/botanical-grid-[0-9a-f]{16}\.jpg$/);
  assert.ok(Buffer.from(await (await fetch(`${BASE}/${first.image}`)).arrayBuffer()).equals(png), 'original served byte-identical');
  const tm = await sharp(Buffer.from(await (await fetch(`${BASE}/${first.thumb}`)).arrayBuffer())).metadata();
  assert.deepStrictEqual([tm.format, tm.width, tm.height], ['jpeg', 570, 356], 'thumb is 570x356 jpeg (cropped, not stretched)');
  const p1 = await project();
  assert.strictEqual(p1.image, first.image); assert.strictEqual(p1.thumb, first.thumb);
  assert.strictEqual(count(), start + 2, 'one original + one thumb written');

  // --- POST again is refused ---
  r = await send('POST', png, 'image/png');
  assert.strictEqual(r.status, 409, 'second POST 409');

  // --- replace (JPEG) ---
  const jpg = await make(800, 600, '#0000ff', 'jpeg');
  r = await send('PUT', jpg, 'image/jpeg');
  assert.strictEqual(r.status, 200, 'PUT 200');
  assert.notStrictEqual(r.body.image, first.image);
  assert.match(r.body.image, /\.jpg$/);
  assert.ok(await exists(r.body.image) && await exists(r.body.thumb), 'new files served');
  assert.ok(!(await exists(first.image)) && !(await exists(first.thumb)), 'old files deleted');
  assert.strictEqual(count(), start + 2, 'no orphans after replace');
  const second = r.body;

  // --- validation (each must leave the current image untouched) ---
  r = await send('PUT', Buffer.from('not an image'), 'image/png');
  assert.strictEqual(r.status, 415, 'fake png rejected by content check');
  r = await send('PUT', jpg, 'text/plain');
  assert.strictEqual(r.status, 415, 'wrong mime rejected');
  r = await send('PUT', Buffer.alloc(11 * 1024 * 1024, 1), 'image/png');
  assert.strictEqual(r.status, 413, 'over 10 MB rejected');
  r = await send('PUT', null);
  assert.strictEqual(r.status, 400, 'missing file rejected');
  r = await send('PUT', jpg, 'image/jpeg', 'wrongfield');
  assert.strictEqual(r.status, 400, 'wrong field name rejected');
  const bad = await fetch(`${BASE}/api/projects/nope/image`, { method: 'PUT', headers: { Cookie: cookie }, body: new FormData() });
  assert.strictEqual(bad.status, 404, 'unknown project');
  const p2 = await project();
  assert.strictEqual(p2.image, second.image, 'image unchanged after rejected uploads');
  assert.strictEqual(count(), start + 2, 'rejected uploads left no files');

  // --- delete: files removed, project falls back to bundled paths ---
  r = await send('DELETE');
  assert.strictEqual(r.status, 200, 'DELETE 200');
  assert.ok(!(await exists(second.image)) && !(await exists(second.thumb)), 'files deleted');
  assert.strictEqual(count(), start, 'media folders back to start');
  const p3 = await project();
  assert.strictEqual(p3.image, before.image); assert.strictEqual(p3.thumb, before.thumb);
  assert.ok(fs.existsSync(path.join(__dirname, '..', before.thumb)), 'bundled asset untouched');
  r = await send('DELETE');
  assert.strictEqual(r.status, 404, 'second DELETE 404');

  console.log('All image upload / replace / delete checks passed');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
