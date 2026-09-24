/**
 * scripts/api-client.js
 *
 * Minimal frontend helper for the Ashi backend (see ARCHITECTURE.md §4).
 * Fetches GET /api/projects, GET /api/categories, GET /api/site.
 *
 * This file is purely additive: it does not import, wrap, or depend on
 * index.html, main.js, webgl-distort.js, intro.js, animations.js, or
 * main.css, and it does not touch the DOM or Three.js on its own. It is a
 * classic <script> (no ES modules, matching the rest of /scripts) that
 * exposes one global, `window.AshiAPI`, for other scripts to call.
 *
 * Every call resolves (never rejects) with a normalized envelope:
 *   { ok: true,  data: <normalized data>, error: null }
 *   { ok: false, data: <safe fallback>,   error: '<message>' }
 * so a wiring script can always do `const { data } = await AshiAPI.getProjects()`
 * and get a safe shape back, even if the API is down or returns malformed
 * data ("fail soft", per ARCHITECTURE.md §4).
 */
(function (global) {
  'use strict';

  var DEFAULT_BASE_URL = '';
  var DEFAULT_TIMEOUT_MS = 8000;

  // ---- fetch wrapper -------------------------------------------------

  /**
   * Fetch JSON from `path` with a timeout, and return a normalized
   * { ok, data, error } envelope. Never throws.
   */
  function fetchJson(path, baseUrl, timeoutMs) {
    var url = (baseUrl || DEFAULT_BASE_URL) + path;

    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () { controller.abort(); }, timeoutMs || DEFAULT_TIMEOUT_MS);
    }

    return fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) {
          return res
            .json()
            .catch(function () { return null; })
            .then(function (body) {
              var msg = (body && body.error) || (res.status + ' ' + res.statusText);
              throw new Error(msg);
            });
        }
        return res.json();
      })
      .then(function (json) {
        return { ok: true, data: json, error: null };
      })
      .catch(function (err) {
        var message = (err && err.name === 'AbortError')
          ? 'Request to ' + path + ' timed out'
          : (err && err.message) || ('Request to ' + path + ' failed');
        return { ok: false, data: null, error: message };
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  // ---- normalizers -----------------------------------------------------
  // Guarantee stable shapes/types so callers never have to null-check every
  // field. Defaults mirror the current hardcoded frontend content described
  // in ARCHITECTURE.md, so a caller can safely spread these over fallbacks.

  function str(v, fallback) {
    return (typeof v === 'string') ? v : (fallback || '');
  }

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function normalizeProject(p) {
    p = p || {};
    return {
      id: str(p.id),
      slug: str(p.slug),
      title: str(p.title),
      meta: str(p.meta),
      subtitle: str(p.subtitle),
      categories: arr(p.categories).map(String),
      year: str(p.year),
      deliverables: str(p.deliverables),
      tech: str(p.tech),
      desc: str(p.desc),
      image: str(p.image),
      thumb: str(p.thumb),
      featured: !!p.featured,
      heroSlot: (typeof p.heroSlot === 'number') ? p.heroSlot : null,
      heroTitle: str(p.heroTitle),
      heroTag: str(p.heroTag),
      badges: arr(p.badges).map(String),
      alt: str(p.alt)
    };
  }

  function normalizeCategory(c) {
    c = c || {};
    return { slug: str(c.slug), label: str(c.label) };
  }

  function normalizeSite(s) {
    s = s || {};
    var meta = s.meta || {};
    var hero = s.hero || {};
    var about = s.about || {};
    var works = s.works || {};
    var contact = s.contact || {};

    return {
      meta: {
        title: str(meta.title),
        description: str(meta.description)
      },
      hero: {
        tagline: str(hero.tagline)
      },
      ticker: arr(s.ticker).map(String),
      about: {
        label: str(about.label),
        heading: str(about.heading),
        bio: str(about.bio),
        photo: str(about.photo),
        photoAlt: str(about.photoAlt),
        photoBadge: str(about.photoBadge),
        caption: str(about.caption),
        skillsLabel: str(about.skillsLabel),
        skills: arr(about.skills).map(String),
        pillarsLabel: str(about.pillarsLabel),
        pillars: arr(about.pillars).map(function (p) {
          p = p || {};
          return { num: str(p.num), title: str(p.title), desc: str(p.desc) };
        })
      },
      works: {
        label: str(works.label),
        heading: str(works.heading)
      },
      contact: {
        label: str(contact.label),
        heading: str(contact.heading),
        desc: str(contact.desc),
        email: str(contact.email),
        mailtoSubject: str(contact.mailtoSubject),
        copyright: str(contact.copyright),
        socials: arr(contact.socials).map(function (s2) {
          s2 = s2 || {};
          return { label: str(s2.label), url: str(s2.url) };
        })
      }
    };
  }

  // ---- public API --------------------------------------------------

  /**
   * @param {string} [baseUrl] e.g. '' (same-origin, default) or 'http://localhost:3000'
   * @param {number} [timeoutMs] per-request timeout, default 8000
   */
  function createClient(baseUrl, timeoutMs) {
    return {
      /** GET /api/projects -> { ok, data: Project[], error } */
      getProjects: function () {
        return fetchJson('/api/projects', baseUrl, timeoutMs).then(function (res) {
          if (!res.ok) return { ok: false, data: [], error: res.error };
          return { ok: true, data: arr(res.data).map(normalizeProject), error: null };
        });
      },

      /** GET /api/projects/:id -> { ok, data: Project|null, error } */
      getProject: function (id) {
        if (!id) return Promise.resolve({ ok: false, data: null, error: 'getProject requires an id' });
        return fetchJson('/api/projects/' + encodeURIComponent(id), baseUrl, timeoutMs).then(function (res) {
          if (!res.ok) return { ok: false, data: null, error: res.error };
          return { ok: true, data: normalizeProject(res.data), error: null };
        });
      },

      /** GET /api/categories -> { ok, data: Category[], error } */
      getCategories: function () {
        return fetchJson('/api/categories', baseUrl, timeoutMs).then(function (res) {
          if (!res.ok) return { ok: false, data: [], error: res.error };
          return { ok: true, data: arr(res.data).map(normalizeCategory), error: null };
        });
      },

      /** GET /api/site -> { ok, data: Site, error } */
      getSite: function () {
        return fetchJson('/api/site', baseUrl, timeoutMs).then(function (res) {
          if (!res.ok) return { ok: false, data: normalizeSite(null), error: res.error };
          return { ok: true, data: normalizeSite(res.data), error: null };
        });
      },

      /**
       * Convenience: fetch all three in parallel.
       * -> { ok, data: { projects, categories, site }, errors: { projects?, categories?, site? } }
       * `ok` is true only if all three requests succeeded; partial failures
       * still resolve with safe fallback data for the failed part(s), plus
       * an `errors` map so a caller can decide whether to fall back to
       * bundled content per-section.
       */
      getAll: function () {
        return Promise.all([this.getProjects(), this.getCategories(), this.getSite()]).then(
          function (results) {
            var projects = results[0];
            var categories = results[1];
            var site = results[2];
            var errors = {};
            if (!projects.ok) errors.projects = projects.error;
            if (!categories.ok) errors.categories = categories.error;
            if (!site.ok) errors.site = site.error;

            return {
              ok: projects.ok && categories.ok && site.ok,
              data: { projects: projects.data, categories: categories.data, site: site.data },
              errors: errors
            };
          }
        );
      }
    };
  }

  var AshiAPI = createClient(DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS);
  AshiAPI.createClient = createClient; // for a custom base URL / timeout if ever needed
  AshiAPI._normalize = { project: normalizeProject, category: normalizeCategory, site: normalizeSite }; // exposed for tests

  global.AshiAPI = AshiAPI;
})(typeof window !== 'undefined' ? window : globalThis);
