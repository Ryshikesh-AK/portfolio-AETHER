/* Public browser client for the homepage CMS endpoints. */
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
      title: typeof project.title === 'string' ? project.title : '',
      meta: typeof project.meta === 'string' ? project.meta : '',
      subtitle: typeof project.subtitle === 'string' ? project.subtitle : '',
      categories: Array.isArray(project.categories) ? project.categories.map(String) : [],
      year: typeof project.year === 'string' ? project.year : String(project.year || ''),
      deliverables: typeof project.deliverables === 'string' ? project.deliverables : '',
      tech: typeof project.tech === 'string' ? project.tech : '',
      desc: typeof project.desc === 'string' ? project.desc : '',
      image: typeof project.image === 'string' ? project.image : '',
      badges: Array.isArray(project.badges) ? project.badges.map(String) : [],
      alt: typeof project.alt === 'string' ? project.alt : '',
      showPhoto: project.showPhoto !== undefined ? Boolean(project.showPhoto) : true,
      showVideo: project.showVideo !== undefined ? Boolean(project.showVideo) : true,
      showGraphic: project.showGraphic !== undefined ? Boolean(project.showGraphic) : true
    };
  }

  function getProjects() {
    return request('/api/projects')
      .then(function (projects) {
        return { ok: true, data: Array.isArray(projects) ? projects.map(normalizeProject) : [], error: null };
      })
      .catch(function (error) {
        return { ok: false, data: [], error: error.message };
      });
  }

  function getProject(id) {
    if (!id) return Promise.resolve({ ok: false, data: null, error: 'Project id is required' });
    return request('/api/projects/' + encodeURIComponent(id))
      .then(function (project) {
        return { ok: true, data: normalizeProject(project), error: null };
      })
      .catch(function (error) {
        return { ok: false, data: null, error: error.message };
      });
  }

  global.AshiAPI = { getProjects: getProjects, getProject: getProject };
})(typeof window !== 'undefined' ? window : globalThis);
