// Ashi admin dashboard. Plain JS, no build step. It only calls existing server endpoints:
//   auth        POST /api/admin/login, POST /api/admin/logout, GET /api/admin/me
//   read        GET /api/projects, GET /api/categories            (public API)
//   write       /api/admin/projects*, /api/admin/categories*     (admin-api.js)
//   images      POST | PUT | DELETE /api/projects/:id/image      (media.js)
// All data is rendered with textContent / DOM APIs (never innerHTML), so stored text can't inject markup.
(() => {
  'use strict';

  const LOGIN = '/api/admin/login';
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_IMAGE = 10 * 1024 * 1024;

  const $ = (sel, root = document) => root.querySelector(sel);
  const state = { projects: [], categories: [], editing: null };

  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (typeof v === 'boolean' && k in n) n[k] = v;
      else if (v != null && v !== false) n.setAttribute(k, v);
    }
    n.append(...kids.filter((x) => x != null && x !== false));
    return n;
  };

  // Stored paths look like "assets/images/x.jpeg" or "media/original/x.jpg"; make them absolute and URL-safe.
  const urlOf = (p) => '/' + p.split('/').map(encodeURIComponent).join('/');
  const isUploaded = (p) => !!p && typeof p.image === 'string' && p.image.startsWith('media/');

  // ---- messages -------------------------------------------------------------------------
  let statusTimer;
  function notify(text, kind = 'ok') {
    const s = $('#status');
    s.textContent = text;
    s.className = 'msg ' + kind;
    s.hidden = false;
    clearTimeout(statusTimer);
    if (kind === 'ok') statusTimer = setTimeout(() => { s.hidden = true; }, 4000);
  }
  function dialogError(text) {
    const d = $('#dialog-error');
    d.textContent = text || '';
    d.hidden = !text;
  }

  // ---- api ------------------------------------------------------------------------------
  async function api(method, url, body) {
    const opts = { method, credentials: 'same-origin', cache: 'no-store', headers: {} };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => null);
    if (r.status === 401 && url !== LOGIN) {
      showLogin('Session expired. Please log in again.');
      throw Object.assign(new Error('Session expired'), { handled: true });
    }
    if (!r.ok) throw new Error((data && data.error) || `Request failed (${r.status})`);
    return data;
  }
  // Wraps a UI action: errors become a status message.
  const run = (fn) => async (...args) => {
    try { await fn(...args); } catch (e) { if (!e.handled) notify(e.message, 'error'); }
  };

  // ---- login / logout -------------------------------------------------------------------
  function showLogin(message) {
    const dlg = $('#project-dialog');
    if (dlg.open) dlg.close();
    $('#main-view').hidden = true;
    $('#login-view').hidden = false;
    const err = $('#login-error');
    err.textContent = message || '';
    err.hidden = !message;
    $('#login-form').elements.password.value = '';
  }

  async function showMain(user) {
    $('#login-view').hidden = true;
    $('#main-view').hidden = false;
    $('#whoami').textContent = user.username;
    await load();
  }

  $('#login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target.elements;
    let user;
    try {
      user = (await api('POST', LOGIN, { username: f.username.value, password: f.password.value })).user;
    } catch (e) {
      const err = $('#login-error');
      err.textContent = e.message;
      err.hidden = false;
      return;
    }
    $('#login-error').hidden = true;
    await run(() => showMain(user))();
  });

  $('#logout-btn').addEventListener('click', run(async () => {
    await api('POST', '/api/admin/logout');
    showLogin();
  }));

  // ---- data -----------------------------------------------------------------------------
  async function load() {
    const [projects, categories] = await Promise.all([api('GET', '/api/projects'), api('GET', '/api/categories')]);
    state.projects = projects;
    state.categories = categories;
    renderFilters();
    renderProjects();
    renderCategories();
    renderMapping();
  }

  // ---- tabs -----------------------------------------------------------------------------
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === b));
    $('#tab-projects').hidden = b.dataset.tab !== 'projects';
    $('#tab-categories').hidden = b.dataset.tab !== 'categories';
    const mappingTab = $('#tab-mapping');
    if (mappingTab) mappingTab.hidden = b.dataset.tab !== 'mapping';
  }));

  // ---- section groupings ----------------------------------------------------------------
  const SECTION_DEFS = [
    { title: 'Works', cls: 'works', slugs: ['spatial', 'telemetry', 'identity', 'systems'] },
    { title: 'Photography', cls: 'photo', slugs: ['photography', 'architecture', 'editorial', 'analog'] },
    { title: 'Videography', cls: 'video', slugs: ['videography', 'cinematic', 'commercial', 'experimental'] }
  ];

  function sectionFor(slug) {
    for (const s of SECTION_DEFS) {
      if (s.slugs.includes(slug)) return s;
    }
    return { title: 'Custom', cls: 'other' };
  }

  // ---- projects list --------------------------------------------------------------------
  function renderFilters() {
    const sel = $('#filter-category');
    const keep = sel.value;

    const assigned = new Set();
    const optgroups = SECTION_DEFS.map((g) => {
      const cats = state.categories.filter((c) => g.slugs.includes(c.slug));
      cats.forEach((c) => assigned.add(c.slug));
      if (!cats.length) return null;
      const og = el('optgroup', { label: g.title });
      cats.forEach((c) => og.appendChild(el('option', { value: c.slug }, c.label)));
      return og;
    }).filter(Boolean);

    const others = state.categories.filter((c) => !assigned.has(c.slug));
    if (others.length) {
      const og = el('optgroup', { label: 'Other' });
      others.forEach((c) => og.appendChild(el('option', { value: c.slug }, c.label)));
      optgroups.push(og);
    }

    sel.replaceChildren(el('option', { value: '' }, 'Category: any'), ...optgroups);
    sel.value = state.categories.some((c) => c.slug === keep) ? keep : '';
  }

  const filtersActive = () => !!($('#search').value.trim() || $('#filter-category').value || $('#filter-featured').value);

  function visibleProjects() {
    const q = $('#search').value.trim().toLowerCase();
    const cat = $('#filter-category').value;
    const feat = $('#filter-featured').value;
    return state.projects.filter((p) =>
      (!q || [p.title, p.slug, p.id, p.meta, p.subtitle, p.heroTitle, p.heroTag].some((v) => v && String(v).toLowerCase().includes(q))) &&
      (!cat || p.categories.includes(cat)) &&
      (!feat || (feat === 'yes') === Boolean(p.featured)));
  }

  const labelOf = (slug) => (state.categories.find((c) => c.slug === slug) || { label: slug }).label;

  function renderProjects() {
    const rows = visibleProjects();
    const locked = filtersActive();
    const featured = state.projects.filter((p) => Boolean(p.featured)).length;

    const summary = $('#summary');
    summary.replaceChildren(
      `Showing ${rows.length} of ${state.projects.length} projects. Featured: ${featured}. `,
      featured !== 5 ? el('span', { class: 'warn' }, 'The public works grid is laid out for exactly 5 featured projects. ') : '',
      locked ? 'Clear search and filters to change the order.' : '');

    $('#project-table tbody').replaceChildren(...rows.map((p) => {
      const i = state.projects.indexOf(p);
      const box = el('input', {
        type: 'checkbox', checked: Boolean(p.featured), 'aria-label': `Featured: ${p.title}`,
        onchange: run(async () => {
          try { await api('PATCH', `/api/admin/projects/${p.id}`, { featured: box.checked }); } catch (e) { box.checked = !box.checked; throw e; }
          await load();
          notify(`${p.title} ${box.checked ? 'is now featured' : 'is no longer featured'}`);
        })
      });
      return el('tr', { 'data-id': p.id },
        el('td', { class: 'order' },
          el('button', { type: 'button', 'aria-label': `Move ${p.title} up`, disabled: locked || i === 0, onclick: run(() => move(p.id, -1)) }, '↑'), ' ',
          el('button', { type: 'button', 'aria-label': `Move ${p.title} down`, disabled: locked || i === state.projects.length - 1, onclick: run(() => move(p.id, 1)) }, '↓')),
        el('td', {}, p.thumb || p.image
          ? el('img', { class: 'thumb', src: urlOf(p.thumb || p.image), alt: p.alt || '', loading: 'lazy' })
          : el('div', { class: 'noimg' }, 'no image')),
        el('td', {},
          el('strong', {}, p.title), el('br'),
          el('span', { class: 'sub' }, `id ${p.id} · `, el('code', {}, p.slug), p.heroSlot != null ? ` · hero slot ${p.heroSlot}` : '')),
        el('td', {}, p.categories.map(labelOf).join(', ')),
        el('td', {}, box),
        el('td', { class: 'actions' },
          el('button', { type: 'button', onclick: () => openProject(p) }, 'Edit'),
          el('button', { type: 'button', class: 'danger', onclick: run(() => removeProject(p)) }, 'Delete')));
    }));
  }

  async function move(id, delta) {
    const ids = state.projects.map((p) => p.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api('PUT', '/api/admin/projects/order', { ids });
    await load();
  }

  async function removeProject(p) {
    const extra = isUploaded(p) ? ' Its uploaded image will be deleted too.' : '';
    if (!confirm(`Delete "${p.title}"? This cannot be undone.${extra}`)) return;
    await api('DELETE', `/api/admin/projects/${p.id}`);
    await load();
    notify(`Deleted ${p.title}`);
  }

  ['input', 'change'].forEach((evt) => {
    $('#search').addEventListener(evt, renderProjects);
    $('#filter-category').addEventListener(evt, renderProjects);
    $('#filter-featured').addEventListener(evt, renderProjects);
  });

  // ---- project dialog -------------------------------------------------------------------
  const dlg = $('#project-dialog');
  const form = $('#project-form');
  const fileInput = $('#image-file');
  const preview = $('#image-preview');
  let objectUrl = null;

  function clearFile() {
    fileInput.value = '';
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  }

  function renderImage() {
    const p = state.editing;
    let src = null;
    let text = 'No image';
    if (objectUrl) { src = objectUrl; text = 'New image selected (not saved yet)'; }
    else if (p && p.image) { src = urlOf(p.image); text = isUploaded(p) ? 'Uploaded image' : 'Bundled image (not uploaded)'; }
    preview.hidden = !src;
    if (src) preview.src = src;
    $('#image-status').textContent = text;
    $('#image-remove').hidden = !isUploaded(p);
  }

  // A bundled full-size path can fail to load (e.g. odd filename); fall back to the thumb.
  preview.addEventListener('error', () => {
    const t = state.editing && state.editing.thumb;
    if (t && !preview.src.endsWith(urlOf(t))) preview.src = urlOf(t);
  });

  function openProject(p) {
    state.editing = p;
    form.reset();
    clearFile();
    dialogError(null);
    const e = form.elements;
    $('#dialog-title').textContent = p ? `Edit: ${p.title}` : 'New project';
    e.title.value = (p && p.title) || '';
    e.slug.value = (p && p.slug) || '';
    for (const k of ['meta', 'subtitle', 'year', 'deliverables', 'tech', 'alt', 'heroTitle', 'heroTag']) e[k].value = (p && p[k]) || '';
    e.desc.value = (p && p.desc) || '';
    e.badges.value = p ? p.badges.join(', ') : '';
    e.featured.checked = !!(p && p.featured);

    const checkContainer = $('#category-checks');
    if (!state.categories.length) {
      checkContainer.replaceChildren(el('span', { class: 'hint' }, 'No categories yet. Add some on the Categories tab.'));
    } else {
      const assigned = new Set();
      const groups = SECTION_DEFS.map((g) => {
        const cats = state.categories.filter((c) => g.slugs.includes(c.slug));
        cats.forEach((c) => assigned.add(c.slug));
        if (!cats.length) return null;
        return el('div', { class: 'cat-group' },
          el('span', { class: 'cat-group-title' }, g.title + ' Showcase'),
          el('div', { class: 'cat-group-items' },
            ...cats.map((c) => el('label', {},
              el('input', { type: 'checkbox', value: c.slug, checked: !!p && p.categories.includes(c.slug) }),
              c.label
            ))
          )
        );
      }).filter(Boolean);

      const others = state.categories.filter((c) => !assigned.has(c.slug));
      if (others.length) {
        groups.push(el('div', { class: 'cat-group' },
          el('span', { class: 'cat-group-title' }, 'Other Categories'),
          el('div', { class: 'cat-group-items' },
            ...others.map((c) => el('label', {},
              el('input', { type: 'checkbox', value: c.slug, checked: !!p && p.categories.includes(c.slug) }),
              c.label
            ))
          )
        ));
      }
      checkContainer.replaceChildren(...groups);
    }
    renderImage();
    dlg.showModal();
  }

  $('#new-project').addEventListener('click', () => openProject(null));
  $('#dialog-cancel').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', clearFile);

  fileInput.addEventListener('change', () => {
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    dialogError(null);
    const f = fileInput.files[0];
    if (f && !IMAGE_TYPES.includes(f.type)) { fileInput.value = ''; dialogError('Choose a JPEG, PNG or WebP image'); }
    else if (f && f.size > MAX_IMAGE) { fileInput.value = ''; dialogError('Image exceeds 10 MB'); }
    else if (f) objectUrl = URL.createObjectURL(f);
    renderImage();
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    dialogError(null);
    const e = form.elements;
    const file = fileInput.files[0];
    const body = {
      title: e.title.value,
      meta: e.meta.value, subtitle: e.subtitle.value, year: e.year.value,
      deliverables: e.deliverables.value, tech: e.tech.value, desc: e.desc.value,
      alt: e.alt.value, heroTitle: e.heroTitle.value, heroTag: e.heroTag.value,
      badges: e.badges.value.split(',').map((s) => s.trim()).filter(Boolean),
      categories: [...$('#category-checks').querySelectorAll('input:checked')].map((i) => i.value),
      featured: e.featured.checked
    };
    if (state.editing || e.slug.value.trim()) body.slug = e.slug.value.trim();   // blank slug on a new project = derive from title

    const buttons = form.querySelectorAll('button');
    buttons.forEach((b) => { b.disabled = true; });
    let id = state.editing && state.editing.id;
    try {
      if (id) await api('PATCH', `/api/admin/projects/${id}`, body);
      else {
        id = (await api('POST', '/api/admin/projects', body)).id;
        state.editing = { id, image: null };   // created: a retry after an image error now edits it
      }
      if (file) {
        const fd = new FormData();
        fd.append('image', file);
        await api(isUploaded(state.editing) ? 'PUT' : 'POST', `/api/projects/${id}/image`, fd);
      }
      dlg.close();
      await load();
      notify('Saved');
    } catch (err) {
      if (!err.handled) dialogError(err.message);
      if (id) {   // fields were saved even though the image was not: show the real state
        try { await load(); state.editing = state.projects.find((p) => p.id === id) || state.editing; renderImage(); } catch (e2) { /* ignore */ }
      }
    } finally {
      buttons.forEach((b) => { b.disabled = false; });
    }
  });

  $('#image-remove').addEventListener('click', async () => {
    const p = state.editing;
    if (!isUploaded(p) || !confirm('Remove the uploaded image? The project goes back to its bundled image (or none).')) return;
    try {
      await api('DELETE', `/api/projects/${p.id}/image`);
      clearFile();
      await load();
      state.editing = state.projects.find((x) => x.id === p.id);
      renderImage();
      notify('Uploaded image removed');
    } catch (err) { if (!err.handled) dialogError(err.message); }
  });

  // ---- categories -----------------------------------------------------------------------
  function renderCategories() {
    $('#category-table tbody').replaceChildren(...state.categories.map((c) => {
      const used = state.projects.filter((p) => p.categories.includes(c.slug)).length;
      const label = el('input', { value: c.label, maxlength: '40', 'aria-label': `Label for ${c.slug}` });
      const sec = sectionFor(c.slug);
      return el('tr', { 'data-slug': c.slug },
        el('td', {}, el('code', {}, c.slug), el('span', { class: 'section-badge ' + sec.cls }, sec.title)),
        el('td', {}, label),
        el('td', {}, String(used)),
        el('td', { class: 'actions' },
          el('button', {
            type: 'button',
            onclick: run(async () => {
              await api('PATCH', `/api/admin/categories/${c.slug}`, { label: label.value });
              await load();
              notify('Category saved');
            })
          }, 'Save'),
          el('button', {
            type: 'button', class: 'danger',
            onclick: run(async () => {
              const note = used ? ` It will be removed from ${used} project${used === 1 ? '' : 's'}.` : '';
              if (!confirm(`Delete category "${c.label}"?${note}`)) return;
              await api('DELETE', `/api/admin/categories/${c.slug}`);
              await load();
              notify('Category deleted');
            })
          }, 'Delete')));
    }));
  }

  $('#category-form').addEventListener('submit', run(async (ev) => {
    ev.preventDefault();
    const f = ev.target.elements;
    await api('POST', '/api/admin/categories', { slug: f.slug.value.trim(), label: f.label.value.trim() });
    ev.target.reset();
    await load();
    notify('Category added');
  }));

  // ---- mapping (Photography, Videography, Graphic Designer) ---------------------------
  function renderMappingCard(p, disciplineKey, propName, onLabel) {
    const isChecked = p[propName] !== false;
    const checkbox = el('input', {
      type: 'checkbox',
      class: 'mapping-checkbox',
      checked: isChecked,
      'aria-label': `${onLabel}: ${p.title}`
    });

    const statusPill = el('span', { class: `mapping-status-pill ${isChecked ? 'on' : 'off'}` }, isChecked ? 'Live on site' : 'Hidden');

    const card = el('div', { class: `mapping-card ${isChecked ? 'is-active' : ''}` },
      // Media preview
      el('div', { class: 'mapping-media-preview' },
        (p.thumb || p.image)
          ? el('img', { src: urlOf(p.thumb || p.image), alt: p.alt || p.title, loading: 'lazy' })
          : el('div', { class: 'mapping-media-noimg' }, el('strong', {}, 'No Media'), el('span', {}, 'Image missing')),
        el('div', { class: 'mapping-badge-overlay' },
          el('span', { class: 'mapping-badge-pill' }, p.id ? `#${p.id}` : 'WORK'),
          p.year ? el('span', { class: 'mapping-badge-pill' }, p.year) : null,
          disciplineKey === 'video' ? el('span', { class: 'mapping-badge-pill video-pill' }, '▶ VIDEO') : null
        )
      ),
      // Content
      el('div', { class: 'mapping-card-content' },
        el('div', {},
          el('div', { class: 'mapping-card-title' }, p.title),
          el('div', { class: 'mapping-card-sub' }, p.subtitle || p.meta || 'Showcase Project')
        ),
        el('div', { class: 'mapping-card-cats' },
          ...(p.categories || []).map((cat) => el('span', { class: 'mapping-cat-tag' }, cat))
        )
      ),
      // Checkbox Toggle Row
      el('div', {
        class: 'mapping-card-toggle',
        onclick: (ev) => {
          if (ev.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          }
        }
      },
        el('label', { class: 'mapping-toggle-label' }, checkbox, 'Show on website'),
        statusPill
      )
    );

    checkbox.addEventListener('change', run(async (ev) => {
      ev.stopPropagation();
      const nextChecked = checkbox.checked;
      try {
        const payload = {};
        payload[propName] = nextChecked;
        await api('PATCH', `/api/admin/projects/${p.id}`, payload);
        p[propName] = nextChecked;
        card.classList.toggle('is-active', nextChecked);
        statusPill.className = `mapping-status-pill ${nextChecked ? 'on' : 'off'}`;
        statusPill.textContent = nextChecked ? 'Live on site' : 'Hidden';
        updateMappingCounts();
        notify(`${p.title} ${nextChecked ? 'will now show' : 'is now hidden'} on ${onLabel}`);
      } catch (err) {
        checkbox.checked = !nextChecked;
        throw err;
      }
    }));

    return card;
  }

  function updateMappingCounts() {
    const photoGrid = $('#mapping-photography-grid');
    const videoGrid = $('#mapping-videography-grid');
    const graphicGrid = $('#mapping-graphic-grid');

    if (photoGrid) {
      const allP = state.projects.filter(isPhotoProject);
      const activeP = allP.filter((p) => p.showPhoto !== false);
      const c = $('#photo-count');
      if (c) c.textContent = `${activeP.length} of ${allP.length} visible`;
    }
    if (videoGrid) {
      const allV = state.projects.filter(isVideoProject);
      const activeV = allV.filter((p) => p.showVideo !== false);
      const c = $('#video-count');
      if (c) c.textContent = `${activeV.length} of ${allV.length} visible`;
    }
    if (graphicGrid) {
      const allG = state.projects.filter(isGraphicProject);
      const activeG = allG.filter((p) => p.showGraphic !== false);
      const c = $('#graphic-count');
      if (c) c.textContent = `${activeG.length} of ${allG.length} visible`;
    }
  }

  function isPhotoProject(p) {
    const cats = p.categories || [];
    return String(p.id).startsWith('p') || cats.some((c) => ['photography', 'architecture', 'editorial', 'analog'].includes(c));
  }

  function isVideoProject(p) {
    const cats = p.categories || [];
    return String(p.id).startsWith('v') || cats.some((c) => ['videography', 'cinematic', 'commercial', 'experimental'].includes(c));
  }

  function isGraphicProject(p) {
    // If not photo-only and not video-only, or has works categories / hero slot
    const cats = p.categories || [];
    const isPhoto = isPhotoProject(p);
    const isVideo = isVideoProject(p);
    if (!isPhoto && !isVideo) return true;
    return cats.some((c) => ['spatial', 'telemetry', 'identity', 'systems'].includes(c)) || p.heroSlot != null;
  }

  function renderMapping() {
    const photoGrid = $('#mapping-photography-grid');
    const videoGrid = $('#mapping-videography-grid');
    const graphicGrid = $('#mapping-graphic-grid');
    if (!photoGrid || !videoGrid || !graphicGrid) return;

    // 1. Photography
    const photos = state.projects.filter(isPhotoProject);
    photoGrid.replaceChildren(...photos.map((p) => renderMappingCard(p, 'photo', 'showPhoto', 'Photography')));

    // 2. Videography
    const videos = state.projects.filter(isVideoProject);
    videoGrid.replaceChildren(...videos.map((p) => renderMappingCard(p, 'video', 'showVideo', 'Videography')));

    // 3. Graphic Designer
    const graphics = state.projects.filter(isGraphicProject);
    graphicGrid.replaceChildren(...graphics.map((p) => renderMappingCard(p, 'graphic', 'showGraphic', 'Graphic Designer')));

    updateMappingCounts();
  }


  // ---- start ----------------------------------------------------------------------------
  (async () => {
    let user = null;
    try {
      const r = await fetch('/api/admin/me', { credentials: 'same-origin', cache: 'no-store' });
      if (r.ok) user = (await r.json()).user;
    } catch (e) { /* not logged in / server unreachable: show the login form */ }
    if (!user) return showLogin();
    await run(() => showMain(user))();
  })();
})();
