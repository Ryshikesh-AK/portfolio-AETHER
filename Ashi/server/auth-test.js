// Self-contained: starts throwaway server instances on free ports with a test-only admin
// (its own random password, hashed with bcrypt). Your real .env / credentials are never used.
const assert = require('assert');
const net = require('net');
const { spawn } = require('child_process');
const bcrypt = require('bcryptjs');

const USER = 'test-admin';
const PASS = 'test-pass-' + Math.random().toString(36).slice(2);

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

async function start(env) {
  const port = await freePort();
  const child = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: { ...process.env, ADMIN_USERNAME: '', ADMIN_PASSWORD_HASH: '', SESSION_TTL_HOURS: '', COOKIE_SECURE: '', PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('test server did not start')), 15000);
    child.stdout.on('data', (d) => { if (String(d).includes('Ashi server:')) { clearTimeout(t); resolve(); } });
    child.on('exit', (c) => { clearTimeout(t); reject(new Error('test server exited early: ' + c)); });
  });
  return { base: `http://localhost:${port}`, stop: () => child.kill() };
}

const call = async (base, method, path, { body, cookie } = {}) => {
  const r = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: r.status, body: await r.json().catch(() => null), setCookie: r.headers.get('set-cookie') };
};
const login = (base, username, password) => call(base, 'POST', '/api/admin/login', { body: { username, password } });

(async () => {
  const hash = bcrypt.hashSync(PASS, 4);   // low cost only to keep the test fast
  assert.match(hash, /^\$2[aby]\$/, 'bcrypt hash');

  // ---- configured server (production => Secure cookie) ----
  const s = await start({ NODE_ENV: 'production', ADMIN_USERNAME: USER, ADMIN_PASSWORD_HASH: hash });
  try {
    // 1. unauthenticated admin requests are rejected
    let r = await call(s.base, 'GET', '/api/admin/me');
    assert.strictEqual(r.status, 401, '1. /me without a session -> 401');
    r = await call(s.base, 'GET', '/api/admin/anything');
    assert.strictEqual(r.status, 401, '1. any /api/admin/* route is guarded');
    r = await call(s.base, 'GET', '/api/admin/me', { cookie: 'ashi_admin=' + 'A'.repeat(43) });
    assert.strictEqual(r.status, 401, '1. forged cookie -> 401');

    // 3. invalid logins are rejected (and set no cookie)
    for (const [u, p] of [[USER, 'wrong-password'], ['wrong-user', PASS]]) {
      r = await login(s.base, u, p);
      assert.strictEqual(r.status, 401, '3. bad credentials -> 401');
      assert.strictEqual(r.body.error, 'Invalid credentials');
      assert.strictEqual(r.setCookie, null, '3. no cookie on failure');
    }
    r = await call(s.base, 'POST', '/api/admin/login', { body: { username: USER } });
    assert.strictEqual(r.status, 400, '3. missing password -> 400');

    // 2. valid login succeeds, cookie is HttpOnly + Secure + SameSite=Strict
    r = await login(s.base, USER, PASS);
    assert.strictEqual(r.status, 200, '2. valid login -> 200');
    assert.deepStrictEqual(r.body, { ok: true, user: { username: USER } });
    assert.match(r.setCookie, /^ashi_admin=[A-Za-z0-9_-]{43};/);
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(r.setCookie.includes(flag), 'cookie flag ' + flag);
    assert.ok(!JSON.stringify(r.body).includes(PASS) && !JSON.stringify(r.body).includes(hash), 'no password/hash in response');
    const cookie = r.setCookie.split(';')[0];

    // 4. authenticated request succeeds
    r = await call(s.base, 'GET', '/api/admin/me', { cookie });
    assert.strictEqual(r.status, 200, '4. /me with session -> 200');
    assert.deepStrictEqual(r.body, { user: { username: USER } });

    // public API is untouched
    r = await call(s.base, 'GET', '/api/projects');
    assert.strictEqual(r.status, 200, 'public GET still open');

    // 5. logout invalidates the session server-side
    r = await call(s.base, 'POST', '/api/admin/logout', { cookie });
    assert.strictEqual(r.status, 200, '5. logout -> 200');
    assert.ok(/Max-Age=0/.test(r.setCookie), '5. cookie cleared');
    r = await call(s.base, 'GET', '/api/admin/me', { cookie });
    assert.strictEqual(r.status, 401, '5. old cookie no longer works');
  } finally { s.stop(); }

  // ---- no credentials configured: login disabled ----
  let u = await start({});
  try {
    const r = await login(u.base, USER, PASS);
    assert.strictEqual(r.status, 503, 'unconfigured -> 503');
    assert.strictEqual((await call(u.base, 'GET', '/api/admin/me')).status, 401);
  } finally { u.stop(); }

  // ---- a plaintext password in ADMIN_PASSWORD_HASH is refused ----
  u = await start({ ADMIN_USERNAME: USER, ADMIN_PASSWORD_HASH: PASS });
  try {
    assert.strictEqual((await login(u.base, USER, PASS)).status, 503, 'plaintext "hash" refused');
  } finally { u.stop(); }

  console.log('All admin auth checks passed');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
