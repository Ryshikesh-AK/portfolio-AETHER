const express = require('express');

// Admin write endpoints for projects and categories. Everything here lives under /api/admin/*,
// which auth.js already guards with a session check (this module must be mounted after auth).
// Reads reuse the public GET /api/projects and /api/categories; image upload/replace/delete
// reuse the existing /api/projects/:id/image routes (media.js).

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// API field -> [DB column, max length]
const TEXT = {
  title: ['title', 200], meta: ['meta', 200], subtitle: ['subtitle', 200], year: ['year', 20],
  deliverables: ['deliverables', 1000], tech: ['tech', 500], desc: ['description', 5000],
  alt: ['alt', 300], heroTitle: ['hero_title', 200], heroTag: ['hero_tag', 200]
};
const FIELDS = new Set([...Object.keys(TEXT), 'slug', 'categories', 'badges', 'featured', 'showPhoto', 'showVideo', 'showGraphic']);

class Invalid extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

module.exports = (app, db, removeMedia) => {
  const json = express.json({ limit: '64kb' });
  const parseJson = (req, res, next) => json(req, res, (err) => (err ? res.status(400).json({ error: 'Invalid JSON' }) : next()));

  // Wraps a handler: thrown Invalid -> its status, SQLite unique violation -> 409, anything else -> 500.
  const wrap = (fn) => (req, res) => {
    try { fn(req, res); } catch (e) {
      if (e instanceof Invalid) return res.status(e.status).json({ error: e.message });
      if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Already exists' });
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  };

  const projectById = db.prepare('SELECT * FROM projects WHERE id = ?');
  const categorySlugs = () => new Set(db.prepare('SELECT slug FROM categories').all().map((r) => r.slug));

  // Validates a request body into { column: value } for the projects table.
  function parseProject(body, { create }) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Invalid('Send a JSON object');
    for (const k of Object.keys(body)) if (!FIELDS.has(k)) throw new Invalid(`Unknown field: ${k}`);
    const out = {};

    for (const [key, [col, max]] of Object.entries(TEXT)) {
      if (!(key in body)) continue;
      const v = body[key];
      if (v !== null && typeof v !== 'string') throw new Invalid(`${key} must be text`);
      const t = v === null ? '' : v.trim();
      if (t.length > max) throw new Invalid(`${key} is too long (max ${max})`);
      if (key === 'title' && !t) throw new Invalid('title is required');
      out[col] = t || null;
    }
    if (create && !out.title) throw new Invalid('title is required');

    if ('slug' in body) {
      if (typeof body.slug !== 'string' || !SLUG.test(body.slug) || body.slug.length > 60) {
        throw new Invalid('slug must be lowercase letters, numbers and single hyphens (max 60)');
      }
      out.slug = body.slug;
    } else if (create) {
      out.slug = slugify(out.title).slice(0, 60);
      if (!out.slug) throw new Invalid('Could not derive a slug from the title; provide one');
    }

    if ('categories' in body) {
      if (!Array.isArray(body.categories) || body.categories.some((c) => typeof c !== 'string')) throw new Invalid('categories must be an array of slugs');
      const known = categorySlugs();
      const bad = body.categories.find((c) => !known.has(c));
      if (bad !== undefined) throw new Invalid(`Unknown category: ${bad}`);
      out.categories = JSON.stringify([...new Set(body.categories)]);
    }
    if ('badges' in body) {
      if (!Array.isArray(body.badges) || body.badges.some((b) => typeof b !== 'string')) throw new Invalid('badges must be an array of text');
      const list = body.badges.map((b) => b.trim()).filter(Boolean);
      if (list.length > 10 || list.some((b) => b.length > 60)) throw new Invalid('badges: at most 10, each up to 60 characters');
      out.badges = JSON.stringify(list);
    }
    if ('featured' in body) {
      if (typeof body.featured !== 'boolean') throw new Invalid('featured must be true or false');
      out.featured = body.featured ? 1 : 0;
    }
    if ('showPhoto' in body) {
      if (typeof body.showPhoto !== 'boolean') throw new Invalid('showPhoto must be true or false');
      out.show_photo = body.showPhoto ? 1 : 0;
    }
    if ('showVideo' in body) {
      if (typeof body.showVideo !== 'boolean') throw new Invalid('showVideo must be true or false');
      out.show_video = body.showVideo ? 1 : 0;
    }
    if ('showGraphic' in body) {
      if (typeof body.showGraphic !== 'boolean') throw new Invalid('showGraphic must be true or false');
      out.show_graphic = body.showGraphic ? 1 : 0;
    }
    return out;
  }

  // A slug is also accepted as a lookup key by the public API (id OR slug), so it must not
  // collide with another project's slug or id.
  function assertSlugFree(slug, exceptId) {
    const clash = db.prepare('SELECT id FROM projects WHERE (slug = ? OR id = ?) AND id != ?').get(slug, slug, exceptId);
    if (clash) throw new Invalid('That slug is already in use', 409);
  }

  // ---- projects -------------------------------------------------------------------------

  // Fixed path first, so it is never read as an :id.
  app.put('/api/admin/projects/order', parseJson, wrap((req, res) => {
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string')) throw new Invalid('ids must be an array of project ids');
    const all = db.prepare('SELECT id FROM projects').all().map((r) => r.id);
    const same = ids.length === all.length && new Set(ids).size === ids.length && ids.every((i) => all.includes(i));
    if (!same) throw new Invalid('ids must list every project exactly once; reload and try again', 409);
    const set = db.prepare('UPDATE projects SET sort_order = ? WHERE id = ?');
    db.transaction(() => ids.forEach((id, i) => set.run(i, id)))();
    res.json({ ok: true });
  }));

  app.post('/api/admin/projects', parseJson, wrap((req, res) => {
    const v = parseProject(req.body, { create: true });
    const id = db.transaction(() => {
      // Existing ids are short numeric strings ('1'..'13'); keep counting up from the highest.
      const max = db.prepare('SELECT id FROM projects').all().reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      const newId = String(max + 1);
      assertSlugFree(v.slug, newId);
      const order = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM projects').get().n;
      db.prepare(`INSERT INTO projects (id, slug, title, meta, subtitle, categories, year, deliverables, tech,
                                        description, featured, hero_title, hero_tag, badges, alt, sort_order,
                                        show_photo, show_video, show_graphic)
                  VALUES (@id, @slug, @title, @meta, @subtitle, @categories, @year, @deliverables, @tech,
                          @description, @featured, @hero_title, @hero_tag, @badges, @alt, @sort_order,
                          @show_photo, @show_video, @show_graphic)`).run({
        meta: null, subtitle: null, year: null, deliverables: null, tech: null, description: null,
        hero_title: null, hero_tag: null, alt: null, categories: '[]', badges: '[]', featured: 0,
        show_photo: 1, show_video: 1, show_graphic: 1,
        ...v, id: newId, sort_order: order
      });
      return newId;
    })();
    res.status(201).json({ id });
  }));

  app.patch('/api/admin/projects/:id', parseJson, wrap((req, res) => {
    const row = projectById.get(req.params.id);
    if (!row) throw new Invalid('Project not found', 404);
    const v = parseProject(req.body, { create: false });
    const cols = Object.keys(v);
    if (!cols.length) throw new Invalid('Nothing to update');
    if (v.slug) assertSlugFree(v.slug, row.id);
    db.prepare(`UPDATE projects SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`).run({ ...v, id: row.id });
    res.json({ id: row.id });
  }));

  app.delete('/api/admin/projects/:id', wrap((req, res) => {
    const row = projectById.get(req.params.id);
    if (!row) throw new Invalid('Project not found', 404);
    db.prepare('DELETE FROM projects WHERE id = ?').run(row.id);
    removeMedia(row.image);   // only ever removes uploaded files; bundled assets are never touched
    removeMedia(row.thumb);
    res.json({ ok: true });
  }));

  // ---- categories -----------------------------------------------------------------------

  const parseLabel = (v) => {
    if (typeof v !== 'string' || !v.trim() || v.trim().length > 40) throw new Invalid('label is required (max 40 characters)');
    return v.trim();
  };

  app.post('/api/admin/categories', parseJson, wrap((req, res) => {
    const { slug, label } = req.body || {};
    if (typeof slug !== 'string' || !SLUG.test(slug) || slug.length > 30) throw new Invalid('slug must be lowercase letters, numbers and single hyphens (max 30)');
    const clean = parseLabel(label);
    if (db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(slug)) throw new Invalid('That category already exists', 409);
    const order = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories').get().n;
    db.prepare('INSERT INTO categories (slug, label, sort_order) VALUES (?, ?, ?)').run(slug, clean, order);
    res.status(201).json({ slug, label: clean });
  }));

  app.patch('/api/admin/categories/:slug', parseJson, wrap((req, res) => {
    const label = parseLabel((req.body || {}).label);
    const r = db.prepare('UPDATE categories SET label = ? WHERE slug = ?').run(label, req.params.slug);
    if (!r.changes) throw new Invalid('Category not found', 404);
    res.json({ slug: req.params.slug, label });
  }));

  // Deleting a category also removes it from every project that uses it.
  app.delete('/api/admin/categories/:slug', wrap((req, res) => {
    const slug = req.params.slug;
    if (!db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(slug)) throw new Invalid('Category not found', 404);
    let updated = 0;
    db.transaction(() => {
      const set = db.prepare('UPDATE projects SET categories = ? WHERE id = ?');
      for (const p of db.prepare('SELECT id, categories FROM projects').all()) {
        const list = JSON.parse(p.categories);
        if (!list.includes(slug)) continue;
        set.run(JSON.stringify(list.filter((c) => c !== slug)), p.id);
        updated++;
      }
      db.prepare('DELETE FROM categories WHERE slug = ?').run(slug);
    })();
    res.json({ ok: true, projectsUpdated: updated });
  }));
};
