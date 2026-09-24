const toProject = (r) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  meta: r.meta,
  subtitle: r.subtitle,
  categories: JSON.parse(r.categories),
  year: r.year,
  deliverables: r.deliverables,
  tech: r.tech,
  desc: r.description,
  image: r.image,
  thumb: r.thumb,
  featured: !!r.featured,
  heroSlot: r.hero_slot,
  heroTitle: r.hero_title,
  heroTag: r.hero_tag,
  badges: JSON.parse(r.badges),
  alt: r.alt,
  showPhoto: r.show_photo !== undefined ? !!r.show_photo : true,
  showVideo: r.show_video !== undefined ? !!r.show_video : true,
  showGraphic: r.show_graphic !== undefined ? !!r.show_graphic : true
});

module.exports = (app, db) => {
  app.get('/api/projects', (req, res) => {
    const rows = db.prepare('SELECT * FROM projects ORDER BY sort_order').all();
    res.json(rows.map(toProject));
  });

  // :id accepts the project id or its slug.
  app.get('/api/projects/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM projects WHERE id = ? OR slug = ?').get(req.params.id, req.params.id);
    if (!row) return res.status(404).json({ error: 'Project not found' });
    res.json(toProject(row));
  });

  app.get('/api/categories', (req, res) => {
    res.json(db.prepare('SELECT slug, label FROM categories ORDER BY sort_order').all());
  });

  app.get('/api/site', (req, res) => {
    const out = {};
    for (const r of db.prepare('SELECT key, value FROM site').all()) out[r.key] = JSON.parse(r.value);
    res.json(out);
  });
};
