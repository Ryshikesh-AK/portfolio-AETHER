/* Public browser client for the homepage CMS endpoints (Supports Local API & Direct Supabase fallback) */
(function (global) {
  'use strict';

  function request(path) {
    return fetch(path, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
      return response.json();
    });
  }

  function normalizeProject(project) {
    project = project || {};
    return {
      id: typeof project.id === 'string' ? project.id : String(project.id || ''),
      slug: typeof project.slug === 'string' ? project.slug : '',
      title: typeof project.title === 'string' ? project.title : '',
      meta: typeof project.meta === 'string' ? project.meta : '',
      subtitle: typeof project.subtitle === 'string' ? project.subtitle : '',
      categories: Array.isArray(project.categories) ? project.categories.map(String) : [],
      year: typeof project.year === 'string' ? project.year : String(project.year || ''),
      deliverables: typeof project.deliverables === 'string' ? project.deliverables : '',
      tech: typeof project.tech === 'string' ? project.tech : '',
      desc: typeof project.desc === 'string' ? project.desc : (project.description || ''),
      image: typeof project.image === 'string' ? (global.getSupabaseMediaUrl ? global.getSupabaseMediaUrl(project.image) : project.image.replace(/\\/g, '/')) : '',
      thumb: typeof project.thumb === 'string' ? (global.getSupabaseMediaUrl ? global.getSupabaseMediaUrl(project.thumb) : project.thumb.replace(/\\/g, '/')) : '',
      featured: typeof project.featured === 'boolean' ? project.featured : Boolean(project.featured),
      heroSlot: project.hero_slot !== undefined ? project.hero_slot : project.heroSlot,
      heroTitle: project.hero_title || project.heroTitle || '',
      heroTag: project.hero_tag || project.heroTag || '',
      badges: Array.isArray(project.badges) ? project.badges.map(String) : [],
      alt: typeof project.alt === 'string' ? project.alt : '',
      showPhoto: project.show_photo !== undefined ? Boolean(project.show_photo) : (project.showPhoto !== undefined ? Boolean(project.showPhoto) : true),
      showVideo: project.show_video !== undefined ? Boolean(project.show_video) : (project.showVideo !== undefined ? Boolean(project.showVideo) : true),
      showGraphic: project.show_graphic !== undefined ? Boolean(project.show_graphic) : (project.showGraphic !== undefined ? Boolean(project.showGraphic) : true)
    };
  }

  function getProjectsFromSupabase() {
    var sb = typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null;
    if (!sb) return Promise.reject(new Error('Supabase client not initialized'));

    return sb
      .from('projects')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data.map(normalizeProject);
      });
  }

  function getProjects() {
    // Try local /api/projects first. If running on Netlify without local Express, fallback to Supabase.
    return request('/api/projects')
      .then(function (projects) {
        return { ok: true, data: Array.isArray(projects) ? projects.map(normalizeProject) : [], error: null };
      })
      .catch(function (error) {
        // Fallback to Supabase client if /api/projects is unavailable (e.g. static Netlify deploy)
        return getProjectsFromSupabase()
          .then(function (data) {
            return { ok: true, data: data, error: null };
          })
          .catch(function (sbErr) {
            return { ok: false, data: [], error: sbErr.message || error.message };
          });
      });
  }

  function getProject(id) {
    if (!id) return Promise.resolve({ ok: false, data: null, error: 'Project id is required' });
    return request('/api/projects/' + encodeURIComponent(id))
      .then(function (project) {
        return { ok: true, data: normalizeProject(project), error: null };
      })
      .catch(function (error) {
        var sb = typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null;
        if (!sb) return { ok: false, data: null, error: error.message };

        return sb
          .from('projects')
          .select('*')
          .or('id.eq.' + id + ',slug.eq.' + id)
          .single()
          .then(function (res) {
            if (res.error) throw res.error;
            return { ok: true, data: normalizeProject(res.data), error: null };
          })
          .catch(function (sbErr) {
            return { ok: false, data: null, error: sbErr.message || error.message };
          });
      });
  }

  global.AshiAPI = { getProjects: getProjects, getProject: getProject, normalizeProject: normalizeProject };
})(typeof window !== 'undefined' ? window : globalThis);
