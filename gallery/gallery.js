// Ashi gallery. Reads only the existing public API:
//   GET /api/projects, GET /api/categories, and GET /api/projects/:id for the detail view.
// No admin/auth calls, no writes. Rendered with textContent/DOM APIs — never innerHTML.
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v != null && v !== false) n.setAttribute(k, v);
    }
    n.append(...kids.filter((x) => x != null && x !== false));
    return n;
  };
  // Stored paths ("assets/images/x.jpeg", "media/thumbs/x.jpg", or full URLs like "https://...") -> URL-safe.
  const urlOf = (p) => {
    if (!p) return '';
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    const clean = p.replace(/\\/g, '/').replace(/^\/+/, '');
    return '/' + clean.split('/').map(encodeURIComponent).join('/');
  };

  const state = { projects: [], categories: [], labelOf: new Map(), activeCategory: '' };
  let entranceObserver = null;

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  }

  // ---- filter bar ------------------------------------------------------------------------
  function renderFilters() {
    const bar = $('.filter-bar');
    const extra = state.categories.map((c) => el('button', {
      type: 'button', class: 'filter-pill', 'data-category': c.slug
    }, c.label));
    bar.replaceChildren(bar.firstElementChild, ...extra);   // keep the "ALL" pill, append the rest
    bar.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.filter-pill');
      if (!btn) return;
      setFilter(btn.dataset.category || '');
    });
  }

  function setFilter(slug) {
    state.activeCategory = slug;
    document.querySelectorAll('.filter-pill').forEach((b) => b.classList.toggle('active', (b.dataset.category || '') === slug));
    applyFilter();
  }

  function applyFilter() {
    const cards = document.querySelectorAll('.project-card');
    let visible = 0;
    cards.forEach((card) => {
      const cats = JSON.parse(card.dataset.categories || '[]');
      const show = !state.activeCategory || cats.includes(state.activeCategory);
      card.hidden = !show;
      if (show) { visible++; entranceObserver && entranceObserver.observe(card); }
    });
    $('.empty-state').hidden = visible > 0;
  }

  // ---- grid -------------------------------------------------------------------------------
  function projectCard(p) {
    const card = el('article', {
      class: 'project-card', tabindex: '0', role: 'button',
      'aria-label': `View ${p.title}`,
      'data-id': p.id, 'data-categories': JSON.stringify(p.categories),
      onclick: () => openDetail(p.id),
      onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openDetail(p.id); } }
    },
      el('div', { class: 'card-media' },
        (p.thumb || p.image)
          ? el('img', { src: urlOf(p.thumb || p.image), alt: p.alt || p.title, loading: 'lazy', decoding: 'async' })
          : null),
      el('div', { class: 'card-body' },
        el('h3', { class: 'card-title' }, p.title),
        el('div', { class: 'card-meta' },
          el('span', { class: 'card-category' }, p.categories.map((s) => state.labelOf.get(s) || s).join(' / ') || '—'),
          el('span', { class: 'card-year' }, p.year || ''))));
    return card;
  }

  function renderGrid() {
    const grid = $('#gallery-grid');
    grid.replaceChildren(...state.projects.map(projectCard));

    entranceObserver && entranceObserver.disconnect();
    entranceObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in-view'); entranceObserver.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.project-card').forEach((c) => entranceObserver.observe(c));
  }

  // ---- detail view ------------------------------------------------------------------------
  const backdrop = $('#detail-backdrop');
  let lastFocused = null;

  async function openDetail(id) {
    lastFocused = document.activeElement;
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('open'));
    document.body.style.overflow = 'hidden';
    $('#detail-close').focus();

    // Fast path with the list data already in hand; the fetch fills in modal-only fields
    // (deliverables/tech/desc/full image) and corrects anything if it has changed since.
    const cached = state.projects.find((p) => p.id === id);
    if (cached) fillDetail(cached);
    try { fillDetail(await getJSON(`/api/projects/${encodeURIComponent(id)}`)); }
    catch (e) { /* keep showing the cached fields */ }
  }

  function fillDetail(p) {
    $('#detail-image').src = urlOf(p.image || p.thumb);
    $('#detail-image').alt = p.alt || p.title;
    $('#detail-title').textContent = p.title;
    $('#detail-meta').textContent = p.meta || '';
    $('#detail-subtitle').textContent = p.subtitle || '';
    $('#detail-categories').replaceChildren(...p.categories.map((s) => el('span', {}, state.labelOf.get(s) || s)));
    $('#detail-year').textContent = p.year || '—';
    $('#detail-deliverables').textContent = p.deliverables || '—';
    $('#detail-tech').textContent = p.tech || '—';
    $('#detail-desc').textContent = p.desc || '';
  }

  function closeDetail() {
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { backdrop.hidden = true; }, 250);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  $('#detail-close').addEventListener('click', closeDetail);
  backdrop.addEventListener('click', (ev) => { if (ev.target === backdrop) closeDetail(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !backdrop.hidden) closeDetail(); });

  // ---- boot -------------------------------------------------------------------------------
  (async () => {
    try {
      let projects, categories;
      try {
        [projects, categories] = await Promise.all([getJSON('/api/projects'), getJSON('/api/categories')]);
      } catch (err) {
        // Fallback to Supabase client if hosted on Netlify without local Express
        const sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
        if (!sb) throw err;
        const [pRes, cRes] = await Promise.all([
          sb.from('projects').select('*').order('sort_order', { ascending: true }),
          sb.from('categories').select('*').order('sort_order', { ascending: true })
        ]);
        if (pRes.error || cRes.error) throw pRes.error || cRes.error;
        projects = (pRes.data || []).map(p => ({
          ...p,
          desc: p.description || p.desc || '',
          heroSlot: p.hero_slot,
          heroTitle: p.hero_title,
          heroTag: p.hero_tag,
          showPhoto: p.show_photo !== undefined ? p.show_photo : true,
          showVideo: p.show_video !== undefined ? p.show_video : true,
          showGraphic: p.show_graphic !== undefined ? p.show_graphic : true
        }));
        categories = cRes.data || [];
      }
      state.projects = projects;
      state.categories = categories;
      categories.forEach((c) => state.labelOf.set(c.slug, c.label));
      renderFilters();
      renderGrid();
    } catch (e) {
      console.error(e);
      $('#gallery-grid').replaceChildren(el('p', { class: 'empty-state' }, 'Could not load the gallery. Please try again shortly.'));
    }
  })();
})();
