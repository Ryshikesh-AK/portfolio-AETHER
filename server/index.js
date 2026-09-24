const fs = require('fs');
const path = require('path');

// Optional server/.env (real environment variables take precedence over it).
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);

const express = require('express');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..');

const app = express();
app.disable('x-powered-by');

app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ ok: true, db: 'up', time: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ ok: false, db: 'down' });
  }
});

require('./api')(app, db);
// requireAdmin protects /api/admin/* automatically and is passed to the (non-/api/admin) image routes.
const { requireAdmin } = require('./auth')(app, db);
const media = require('./media');
media(app, db, requireAdmin);
require('./admin-api')(app, db, media.removeMedia);   // must come after auth: lives under /api/admin

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Allowlist only: index.html + the public frontend folders (and /media below).
// Everything else in the project root (server/, package.json, *.js tooling, *.md, db) is never served.
const sendIndex = (req, res) => res.sendFile(path.join(ROOT, 'index.html'));
app.get(['/', '/index.html'], sendIndex);
for (const dir of ['assets', 'scripts', 'styles']) {
  app.use('/' + dir, express.static(path.join(ROOT, dir), { dotfiles: 'deny' }));
}

// Public gallery (static page + script + vendored three.js). Reads only the public
// GET /api/projects and /api/categories endpoints already registered above — no new
// backend logic. Isolated from the homepage: its own folder, own stylesheet, own script.
app.use('/gallery', express.static(path.join(ROOT, 'gallery'), { dotfiles: 'deny' }));

// Admin dashboard (static page + script). It holds no secrets: every data call it makes needs a session.
app.use('/admin', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'; base-uri 'none'"
  });
  next();
}, express.static(path.join(__dirname, 'admin'), { dotfiles: 'deny' }));

// Uploaded media. Filenames are unique and never reused, so they can be cached hard.
app.use('/media', express.static(path.join(__dirname, 'media'), {
  index: false,
  dotfiles: 'deny',
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));

app.use((req, res) => res.status(404).type('text').send('Not found'));

const server = app.listen(PORT, () => console.log(`Ashi server: http://localhost:${PORT}`));

const shutdown = () => { server.close(() => { db.close(); process.exit(0); }); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
