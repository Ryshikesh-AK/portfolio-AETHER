const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const { hero, works } = require('./seed-data');

const ORIGINAL_DIR = path.join(__dirname, 'media', 'original');
const THUMBS_DIR = path.join(__dirname, 'media', 'thumbs');
fs.mkdirSync(ORIGINAL_DIR, { recursive: true });
fs.mkdirSync(THUMBS_DIR, { recursive: true });

const MAX_BYTES = 10 * 1024 * 1024;
const THUMB_W = 570;   // 2x the 285x178 hero card; "cover" crop also fixes portrait stretching
const THUMB_H = 356;
const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp' };
const MIME_OK = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SHARP_OPTS = { limitInputPixels: 50e6 };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => MIME_OK.has(file.mimetype)
    ? cb(null, true)
    : cb(Object.assign(new Error('Only JPEG, PNG or WebP images are allowed'), { status: 415 }))
}).single('image');

const receive = (req, res, next) => upload(req, res, (err) => {
  if (err) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(err.status || (tooBig ? 413 : 400)).json({ error: tooBig ? 'Image exceeds 10 MB' : err.message });
  }
  if (!req.file) return res.status(400).json({ error: 'Send the file in a multipart field named "image"' });
  next();
});

// DB paths look like "media/original/x.jpg" (relative, like the existing "assets/images/..." paths).
const isUploaded = (p) => typeof p === 'string' && p.startsWith('media/');
const absPath = (rel) => path.resolve(__dirname, rel);

// Only ever deletes files that sit directly inside media/original or media/thumbs.
// Bundled assets (assets/images/**) and anything else are never touched.
function removeMedia(rel) {
  if (!isUploaded(rel)) return;
  const abs = absPath(rel);
  const dir = path.dirname(abs);
  if (dir !== ORIGINAL_DIR && dir !== THUMBS_DIR) return;
  try { fs.unlinkSync(abs); } catch (e) { if (e.code !== 'ENOENT') console.warn('media delete failed:', e.message); }
}

// Bundled image paths a project falls back to when its upload is removed.
function defaultsFor(id) {
  const w = works.find((x) => x.id === id);
  if (w) return { image: w.image, thumb: hero[w.heroSlot].src };
  const h = hero.find((x) => x.id === id);
  return h ? { image: h.src, thumb: h.src } : { image: null, thumb: null };
}

module.exports = (app, db, requireAdmin) => {
  // Uploading, replacing and deleting images changes the site, so these routes are admin-only.
  if (typeof requireAdmin !== 'function') throw new Error('media routes need the requireAdmin middleware');
  const getImages = db.prepare('SELECT image, thumb FROM projects WHERE id = ?');
  const setImages = db.prepare('UPDATE projects SET image = ?, thumb = ? WHERE id = ?');

  const findProject = (req, res, next) => {
    const row = db.prepare('SELECT id, slug FROM projects WHERE id = ? OR slug = ?').get(req.params.id, req.params.id);
    if (!row) return res.status(404).json({ error: 'Project not found' });
    req.project = row;
    next();
  };

  const noUploadYet = (req, res, next) =>
    isUploaded(getImages.get(req.project.id).image)
      ? res.status(409).json({ error: 'Project already has an uploaded image; use PUT to replace it' })
      : next();

  async function save(req, res) {
    const { id, slug } = req.project;

    let format = null;
    try { format = (await sharp(req.file.buffer, SHARP_OPTS).metadata()).format; } catch (e) { /* not an image */ }
    if (!EXT[format]) return res.status(415).json({ error: 'File is not a valid JPEG, PNG or WebP image' });

    const base = (String(slug).replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'project') + '-' + crypto.randomBytes(8).toString('hex');
    const image = `media/original/${base}.${EXT[format]}`;
    const thumb = `media/thumbs/${base}.jpg`;

    try {
      await sharp(req.file.buffer, SHARP_OPTS).rotate()
        .resize(THUMB_W, THUMB_H, { fit: 'cover' })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 82 })
        .toFile(absPath(thumb));
      await fs.promises.writeFile(absPath(image), req.file.buffer, { flag: 'wx' });
    } catch (e) {
      removeMedia(image); removeMedia(thumb);
      return res.status(422).json({ error: 'Could not process image' });
    }

    // Read old paths + swap in the new ones synchronously, so nothing can interleave.
    const old = getImages.get(id);
    if (!old) { removeMedia(image); removeMedia(thumb); return res.status(404).json({ error: 'Project not found' }); }
    setImages.run(image, thumb, id);
    removeMedia(old.image);
    removeMedia(old.thumb);

    res.status(req.method === 'POST' ? 201 : 200).json({ id, image, thumb });
  }

  const handle = (fn) => (req, res) => fn(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  });

  const route = '/api/projects/:id/image';
  app.post(route, requireAdmin, findProject, noUploadYet, receive, handle(save));
  app.put(route, requireAdmin, findProject, receive, handle(save));
  app.delete(route, requireAdmin, findProject, (req, res) => {
    const { id } = req.project;
    const cur = getImages.get(id);
    if (!isUploaded(cur.image) && !isUploaded(cur.thumb)) return res.status(404).json({ error: 'Project has no uploaded image' });
    const d = defaultsFor(id);
    setImages.run(d.image, d.thumb, id);
    removeMedia(cur.image);
    removeMedia(cur.thumb);
    res.json({ id, image: d.image, thumb: d.thumb });
  });
};

// Shared with the admin API so deleting a project cleans up its uploaded files the same way.
module.exports.removeMedia = removeMedia;
