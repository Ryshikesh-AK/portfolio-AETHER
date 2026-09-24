const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { categories, hero, works, photography, videography, site } = require('./seed-data');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'ashi.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  slug       TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  meta         TEXT,
  subtitle     TEXT,
  categories   TEXT NOT NULL DEFAULT '[]',   -- JSON array of category slugs
  year         TEXT,
  deliverables TEXT,
  tech         TEXT,
  description  TEXT,
  image        TEXT,
  thumb        TEXT,
  featured     INTEGER NOT NULL DEFAULT 0,   -- 1 = shown in the works grid
  hero_slot    INTEGER UNIQUE,               -- index into the hero scatter cards
  hero_title   TEXT,
  hero_tag     TEXT,
  badges       TEXT NOT NULL DEFAULT '[]',   -- JSON array
  alt          TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  show_photo   INTEGER NOT NULL DEFAULT 1,
  show_video   INTEGER NOT NULL DEFAULT 1,
  show_graphic INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS site (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                        -- JSON
);
`);

// Migration helper for existing databases: ensure new columns exist
try { db.exec(`ALTER TABLE projects ADD COLUMN show_photo INTEGER NOT NULL DEFAULT 1`); } catch (e) {}
try { db.exec(`ALTER TABLE projects ADD COLUMN show_video INTEGER NOT NULL DEFAULT 1`); } catch (e) {}
try { db.exec(`ALTER TABLE projects ADD COLUMN show_graphic INTEGER NOT NULL DEFAULT 1`); } catch (e) {}


const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function seed() {
  const addCat = db.prepare('INSERT OR IGNORE INTO categories (slug, label, sort_order) VALUES (?, ?, ?)');
  const addSite = db.prepare('INSERT OR IGNORE INTO site (key, value) VALUES (?, ?)');
  const addProject = db.prepare(`
    INSERT OR IGNORE INTO projects
      (id, slug, title, meta, subtitle, categories, year, deliverables, tech, description,
       image, thumb, featured, hero_slot, hero_title, hero_tag, badges, alt, sort_order)
    VALUES
      (@id, @slug, @title, @meta, @subtitle, @categories, @year, @deliverables, @tech, @description,
       @image, @thumb, @featured, @hero_slot, @hero_title, @hero_tag, @badges, @alt, @sort_order)`);

  categories.forEach((c, i) => addCat.run(c.slug, c.label, i));
  Object.entries(site).forEach(([k, v]) => addSite.run(k, JSON.stringify(v)));

  // Works cards, joined with the hero card that shares their image.
  const claimed = new Set();
  works.forEach((w, i) => {
    const h = hero[w.heroSlot];
    claimed.add(w.heroSlot);
    addProject.run({
      id: w.id, slug: slugify(w.title), title: w.title, meta: w.meta, subtitle: w.subtitle,
      categories: JSON.stringify(w.categories), year: w.year, deliverables: w.deliverables,
      tech: w.tech, description: w.desc, image: w.image, thumb: h.src, featured: 1,
      hero_slot: w.heroSlot, hero_title: h.title, hero_tag: h.tag,
      badges: JSON.stringify(w.badges), alt: w.alt, sort_order: i
    });
  });

  // Hero-only cards: no works data exists for them, so only hero fields are set.
  // Their image is the same file the hero card already uses (the "thumb" is a full-size copy).
  hero.forEach((h, slot) => {
    if (claimed.has(slot)) return;
    addProject.run({
      id: h.id, slug: slugify(h.title), title: h.title, meta: null, subtitle: null,
      categories: '[]', year: null, deliverables: null, tech: null, description: null,
      image: h.src, thumb: h.src, featured: 0,
      hero_slot: slot, hero_title: h.title, hero_tag: h.tag,
      badges: '[]', alt: null, sort_order: works.length + slot
    });
  });

  // Photography showcase cards
  (photography || []).forEach((p, i) => {
    addProject.run({
      id: p.id, slug: slugify(p.title), title: p.title, meta: p.meta, subtitle: p.subtitle,
      categories: JSON.stringify(p.categories), year: p.year, deliverables: p.deliverables,
      tech: p.tech, description: p.desc, image: p.image, thumb: p.image, featured: 0,
      hero_slot: null, hero_title: null, hero_tag: null,
      badges: JSON.stringify(p.badges), alt: p.alt, sort_order: works.length + hero.length + i
    });
  });

  // Videography showcase cards
  (videography || []).forEach((v, i) => {
    addProject.run({
      id: v.id, slug: slugify(v.title), title: v.title, meta: v.meta, subtitle: v.subtitle,
      categories: JSON.stringify(v.categories), year: v.year, deliverables: v.deliverables,
      tech: v.tech, description: v.desc, image: v.image, thumb: v.image, featured: 0,
      hero_slot: null, hero_title: null, hero_tag: null,
      badges: JSON.stringify(v.badges), alt: v.alt, sort_order: works.length + hero.length + (photography ? photography.length : 0) + i
    });
  });
}

// Seed once, on an empty database.
if (db.prepare('SELECT COUNT(*) AS n FROM projects').get().n === 0) {
  db.transaction(seed)();
} else {
  // Sync missing categories and photography/videography items into the existing database
  db.transaction(() => {
    const addCat = db.prepare('INSERT OR IGNORE INTO categories (slug, label, sort_order) VALUES (?, ?, ?)');
    const addProject = db.prepare(`
      INSERT OR IGNORE INTO projects
        (id, slug, title, meta, subtitle, categories, year, deliverables, tech, description,
         image, thumb, featured, hero_slot, hero_title, hero_tag, badges, alt, sort_order)
      VALUES
        (@id, @slug, @title, @meta, @subtitle, @categories, @year, @deliverables, @tech, @description,
         @image, @thumb, @featured, @hero_slot, @hero_title, @hero_tag, @badges, @alt, @sort_order)`);

    categories.forEach((c, i) => addCat.run(c.slug, c.label, i));

    (photography || []).forEach((p, i) => {
      addProject.run({
        id: p.id, slug: slugify(p.title), title: p.title, meta: p.meta, subtitle: p.subtitle,
        categories: JSON.stringify(p.categories), year: p.year, deliverables: p.deliverables,
        tech: p.tech, description: p.desc, image: p.image, thumb: p.image, featured: 0,
        hero_slot: null, hero_title: null, hero_tag: null,
        badges: JSON.stringify(p.badges), alt: p.alt, sort_order: 20 + i
      });
    });

    (videography || []).forEach((v, i) => {
      addProject.run({
        id: v.id, slug: slugify(v.title), title: v.title, meta: v.meta, subtitle: v.subtitle,
        categories: JSON.stringify(v.categories), year: v.year, deliverables: v.deliverables,
        tech: v.tech, description: v.desc, image: v.image, thumb: v.image, featured: 0,
        hero_slot: null, hero_title: null, hero_tag: null,
        badges: JSON.stringify(v.badges), alt: v.alt, sort_order: 30 + i
      });
    });
  })();
}

module.exports = db;
