const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');

const COOKIE = 'ashi_admin';
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const MAX_FAILS = 5;                 // failed logins per IP ...
const LOCK_MS = 15 * 60 * 1000;      // ... before a 15 minute lockout

const sha256 = (s) => crypto.createHash('sha256').update(s).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha256(a), sha256(b));

// Sessions are opaque random tokens kept server-side in SQLite (only their SHA-256 is stored)
// and sent to the browser in an HttpOnly cookie. Credentials come from environment variables only.
module.exports = (app, db) => {
  const username = process.env.ADMIN_USERNAME || '';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';   // bcrypt hash, never the password
  const configured = username !== '' && BCRYPT_HASH.test(passwordHash);
  if (!configured) {
    console.warn('Admin login disabled: set ADMIN_USERNAME and a bcrypt ADMIN_PASSWORD_HASH (see .env.example)');
  }

  const ttlMs = (Number(process.env.SESSION_TTL_HOURS) || 12) * 3600 * 1000;
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';
  const attrs = `; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
  const setCookie = (res, value, maxAgeSec) => res.setHeader('Set-Cookie', `${COOKIE}=${value}${attrs}; Max-Age=${maxAgeSec}`);
  const tokenFrom = (req) => {
    const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`).exec(req.headers.cookie || '');
    return m && /^[A-Za-z0-9_-]{43}$/.test(m[1]) ? m[1] : null;
  };

  db.exec(`CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    username   TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`);
  const findSession = db.prepare('SELECT username FROM admin_sessions WHERE token_hash = ? AND expires_at > ?');
  const addSession = db.prepare('INSERT INTO admin_sessions (token_hash, username, expires_at) VALUES (?, ?, ?)');
  const dropSession = db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?');
  const dropExpired = db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?');

  // Use on any admin-only route. Everything under /api/admin/* is already covered (see below).
  const requireAdmin = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = tokenFrom(req);
    const session = token && findSession.get(sha256(token).toString('hex'), Date.now());
    if (!session) return res.status(401).json({ error: 'Authentication required' });
    req.admin = { username: session.username };
    next();
  };

  const fails = new Map();   // ip -> { n, until }
  const ipOf = (req) => req.socket.remoteAddress || 'unknown';
  const lockedOut = (ip) => {
    const f = fails.get(ip);
    if (f && f.until <= Date.now()) fails.delete(ip);
    return !!f && f.n >= MAX_FAILS && f.until > Date.now();
  };

  const json = express.json({ limit: '2kb' });
  const parseJson = (req, res, next) => json(req, res, (err) => (err ? res.status(400).json({ error: 'Invalid JSON' }) : next()));

  app.post('/api/admin/login', parseJson, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const { username: u, password: p } = req.body || {};
    if (typeof u !== 'string' || typeof p !== 'string' || !u || !p || u.length > 100 || p.length > 128) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (!configured) return res.status(503).json({ error: 'Admin login is not configured' });

    const ip = ipOf(req);
    if (lockedOut(ip)) return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });

    // Always run bcrypt so a wrong username costs the same as a wrong password.
    const passOk = await bcrypt.compare(p, passwordHash);
    if (!(safeEqual(u, username) && passOk)) {
      const f = fails.get(ip) || { n: 0, until: 0 };
      fails.set(ip, { n: f.n + 1, until: Date.now() + LOCK_MS });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    fails.delete(ip);

    const token = crypto.randomBytes(32).toString('base64url');
    dropExpired.run(Date.now());
    addSession.run(sha256(token).toString('hex'), username, Date.now() + ttlMs);
    setCookie(res, token, Math.floor(ttlMs / 1000));
    res.json({ ok: true, user: { username } });
  });

  app.post('/api/admin/logout', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = tokenFrom(req);
    if (token) dropSession.run(sha256(token).toString('hex'));
    setCookie(res, '', 0);
    res.json({ ok: true });
  });

  // Everything registered under /api/admin after this line requires a valid session.
  app.use('/api/admin', requireAdmin);
  app.get('/api/admin/me', (req, res) => res.json({ user: req.admin }));

  return { requireAdmin };
};
