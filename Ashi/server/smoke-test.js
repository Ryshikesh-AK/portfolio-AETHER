// Usage: start the server (npm start), then: npm test   (BASE=http://host:port to override)
const assert = require('assert');
const BASE = process.env.BASE || 'http://localhost:3000';
const get = async (p) => {
  const r = await fetch(BASE + p);
  return { status: r.status, body: await r.json() };
};
const FIELDS = ['id', 'slug', 'title', 'meta', 'subtitle', 'categories', 'year', 'deliverables',
                'tech', 'desc', 'image', 'thumb', 'featured', 'heroSlot'];

(async () => {
  let r = await get('/api/health');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.ok, true);

  r = await get('/api/projects');
  assert.strictEqual(r.status, 200);
  const projects = r.body;
  assert.ok(projects.length >= 19, 'at least 19 projects');
  projects.forEach((p) => FIELDS.forEach((f) => assert.ok(f in p, `project ${p.id} missing ${f}`)));
  assert.strictEqual(projects.filter((p) => p.featured).length, 5, '5 featured works');
  assert.deepStrictEqual(projects.map((p) => p.heroSlot).filter((s) => s !== null).sort((a, b) => a - b), [...Array(13).keys()], 'heroSlots 0..12');
  assert.strictEqual(new Set(projects.map((p) => p.slug)).size, projects.length, 'unique slugs');

  r = await get('/api/projects/1');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.title, 'AETHERIA OS');
  assert.deepStrictEqual(r.body.categories, ['spatial', 'systems']);

  r = await get('/api/projects/aetheria-os');
  assert.strictEqual(r.status, 200, 'lookup by slug');
  assert.strictEqual(r.body.id, '1');

  r = await get('/api/projects/does-not-exist');
  assert.strictEqual(r.status, 404);

  r = await get('/api/categories');
  assert.strictEqual(r.status, 200);
  const slugs = r.body.map((c) => c.slug);
  ['spatial', 'telemetry', 'identity', 'systems', 'photography', 'architecture', 'editorial', 'analog', 'videography', 'cinematic', 'commercial', 'experimental'].forEach((s) => assert.ok(slugs.includes(s), `missing category ${s}`));

  r = await get('/api/site');
  assert.strictEqual(r.status, 200);
  ['meta', 'hero', 'ticker', 'about', 'works', 'contact'].forEach((k) => assert.ok(k in r.body, `site.${k}`));
  assert.strictEqual(r.body.about.skills.length, 8);
  assert.strictEqual(r.body.about.pillars.length, 4);

  console.log('All GET endpoint checks passed');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
