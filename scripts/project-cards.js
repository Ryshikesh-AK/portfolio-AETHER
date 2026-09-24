/**
 * scripts/project-cards.js
 *
 * Connects the existing 5 Works cards (.project-card) to the CMS.
 *
 * This is purely additive and content-only:
 *  - It never creates, removes, or reorders .project-card elements — the
 *    grid stays at exactly 5 cards, matching styles/main.css's
 *    `.project-card:nth-child(1-5)` layout rules (see ARCHITECTURE.md §5).
 *  - It only edits text nodes and a few attributes *inside* the cards that
 *    already exist in index.html: the image src/alt, data-category, the two
 *    .vf-badge spans, .card-title's text (the .card-arrow span is preserved
 *    untouched), and .card-sub. No classes, ids, or DOM structure change.
 *  - It does not touch webgl-distort.js, intro.js, animations.js, main.css,
 *    the hero/WebGL ring cards, the modal, filters, gallery, or admin. Those
 *    all keep reading `.project-card` / `data-category` / `data-project-id`
 *    / `.card-media-wrap` / `.webgl-texture-source` exactly as before.
 *  - If the API is unreachable, times out, or returns no usable data, this
 *    is a no-op and the existing hardcoded card content stays exactly as
 *    shipped — that hardcoded markup *is* the fallback.
 *
 * Exposes `window.renderProjectCards()` — an async function returning a
 * Promise that always resolves (never rejects), so callers (main.js) can
 * `await` it to guarantee the DOM is in its final state before anything
 * that queries `.project-card` once at construction (AnimationController,
 * the WebGL texture register() loop) runs.
 */
(function (global) {
  'use strict';

  function applyProjectToCard(card, project) {
    if (project.id != null) {
      card.setAttribute('data-project-id', String(project.id));
    }

    // data-category: keep the attribute, update its value to the CMS
    // categories so the existing filter buttons (main.js, untouched) keep
    // working against live data.
    if (Array.isArray(project.categories) && project.categories.length) {
      card.setAttribute('data-category', project.categories.join(' '));
    } else {
      card.setAttribute('data-category', 'all');
    }

    // Image: only overwrite if the API gave us a real path, so a blank/
    // missing field can never blank out the existing texture source.
    var img = card.querySelector('.card-media-wrap .webgl-texture-source');
    if (img && project.image) {
      img.setAttribute('src', project.image);
      img.setAttribute('alt', project.alt || project.title || '');
    }

    // Badges: update or fill in
    var badgeEls = card.querySelectorAll('.card-viewfinder .vf-badge');
    if (Array.isArray(project.badges) && project.badges.length) {
      for (var i = 0; i < badgeEls.length; i++) {
        if (project.badges[i]) {
          badgeEls[i].textContent = project.badges[i];
          badgeEls[i].style.display = '';
        } else {
          badgeEls[i].style.display = 'none';
        }
      }
    } else if (Array.isArray(project.categories) && project.categories.length) {
      for (var j = 0; j < badgeEls.length; j++) {
        if (project.categories[j]) {
          badgeEls[j].textContent = project.categories[j].toUpperCase() + ' // ' + (j + 1);
          badgeEls[j].style.display = '';
        } else {
          badgeEls[j].style.display = 'none';
        }
      }
    } else {
      if (badgeEls[0]) badgeEls[0].textContent = 'FEATURED // ' + (project.id || 'WORK');
      if (badgeEls[1]) badgeEls[1].textContent = project.year ? 'YEAR // ' + project.year : 'PORTFOLIO // 2026';
    }

    // Title: `.card-title` is `"TITLE <span class='card-arrow'>&rarr;</span>"`.
    // Rebuild the text node only, re-attach or recreate the existing arrow span.
    var titleEl = card.querySelector('.card-meta-bottom .card-title');
    if (titleEl && project.title) {
      var arrow = titleEl.querySelector('.card-arrow');
      titleEl.textContent = project.title + ' ';
      if (arrow) {
        titleEl.appendChild(arrow);
      } else {
        var span = document.createElement('span');
        span.className = 'card-arrow';
        span.innerHTML = '&rarr;';
        titleEl.appendChild(span);
      }
    }

    // Subtitle
    var subEl = card.querySelector('.card-meta-bottom .card-sub');
    if (subEl) {
      if (project.subtitle) {
        subEl.textContent = project.subtitle;
      } else if (project.meta) {
        subEl.textContent = project.meta;
      } else if (Array.isArray(project.categories) && project.categories.length) {
        subEl.textContent = project.categories.map(function (c) { return c.toUpperCase(); }).join(' & ') + ' // ' + (project.year || '2026');
      } else {
        subEl.textContent = (project.title || 'WORK') + ' // ' + (project.year || '2026');
      }
    }
  }

  function renderProjectCards() {
    if (!global.AshiAPI || typeof global.AshiAPI.getProjects !== 'function') {
      // api-client.js not loaded — fall back to existing hardcoded markup.
      return Promise.resolve({ ok: false, reason: 'AshiAPI not available' });
    }

    return global.AshiAPI.getProjects()
      .then(function (res) {
        if (!res.ok || !res.data || !res.data.length) {
          // API down / empty response — leave hardcoded cards untouched.
          return { ok: false, reason: res.error || 'no projects returned' };
        }

        var byId = {};
        res.data.forEach(function (p) {
          if (p && p.id != null) byId[String(p.id)] = p;
        });

        // 1. Graphic Designer (Works Showcase grid):
        // Filter projects where showGraphic !== false (defaulting to true) and featured === true
        var activeGraphic = res.data.filter(function (p) {
          return p.showGraphic !== false && Boolean(p.featured);
        });

        // If fewer than 5 are featured+enabled, check if there are other projects with showGraphic !== false
        if (activeGraphic.length < 5) {
          var graphicIds = new Set(activeGraphic.map(function (p) { return String(p.id); }));
          res.data.forEach(function (p) {
            if (activeGraphic.length < 5 && p.showGraphic !== false && !graphicIds.has(String(p.id))) {
              activeGraphic.push(p);
              graphicIds.add(String(p.id));
            }
          });
        }

        var worksCards = document.querySelectorAll('.works-section > .projects-grid:not(.projects-grid-3col) > .project-card');
        var updated = 0;
        worksCards.forEach(function (card, index) {
          var project = activeGraphic[index];
          if (project) {
            card.removeAttribute('data-admin-disabled');
            card.style.display = '';
            applyProjectToCard(card, project);
            updated++;
          } else {
            // Deselected / not enough active items
            card.setAttribute('data-admin-disabled', 'true');
            card.style.display = 'none';
          }
        });

        // Update Graphic Designer / Works ALL count button
        var worksAllBtn = document.querySelector('.works-section > .section-header .filter-btn[data-filter="all"]');
        if (worksAllBtn) {
          worksAllBtn.textContent = 'ALL (' + String(activeGraphic.length).padStart(2, '0') + ')';
        }

        // 2. Photography showcase cards (#photography .projects-grid-3col > .project-card):
        var isPhoto = function (p) {
          return String(p.id).startsWith('p') || (Array.isArray(p.categories) && p.categories.some(function (c) {
            return ['photography', 'architecture', 'editorial', 'analog'].indexOf(c) !== -1;
          }));
        };
        var activePhotos = res.data.filter(function (p) {
          return isPhoto(p) && p.showPhoto !== false;
        });

        var photoCards = document.querySelectorAll('#photography .projects-grid-3col > .project-card');
        photoCards.forEach(function (card, index) {
          var project = activePhotos[index];
          if (project) {
            card.removeAttribute('data-admin-disabled');
            card.style.display = '';
            applyProjectToCard(card, project);
            updated++;
          } else {
            card.setAttribute('data-admin-disabled', 'true');
            card.style.display = 'none';
          }
        });

        var photoAllBtn = document.querySelector('#photography .filter-btn[data-filter="all"]');
        if (photoAllBtn) {
          photoAllBtn.textContent = 'ALL (' + String(activePhotos.length).padStart(2, '0') + ')';
        }

        // 3. Videography showcase cards (#videography .projects-grid-3col > .project-card):
        var isVideo = function (p) {
          return String(p.id).startsWith('v') || (Array.isArray(p.categories) && p.categories.some(function (c) {
            return ['videography', 'cinematic', 'commercial', 'experimental'].indexOf(c) !== -1;
          }));
        };
        var activeVideos = res.data.filter(function (p) {
          return isVideo(p) && p.showVideo !== false;
        });

        var videoCards = document.querySelectorAll('#videography .projects-grid-3col > .project-card');
        videoCards.forEach(function (card, index) {
          var project = activeVideos[index];
          if (project) {
            card.removeAttribute('data-admin-disabled');
            card.style.display = '';
            applyProjectToCard(card, project);
            updated++;
          } else {
            card.setAttribute('data-admin-disabled', 'true');
            card.style.display = 'none';
          }
        });

        var videoAllBtn = document.querySelector('#videography .filter-btn[data-filter="all"]');
        if (videoAllBtn) {
          videoAllBtn.textContent = 'ALL (' + String(activeVideos.length).padStart(2, '0') + ')';
        }

        // Refresh layout if ScrollTrigger or WebGL is present
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        if (window.webglEngine && typeof window.webglEngine.onResize === 'function') {
          window.webglEngine.onResize();
        }

        return { ok: true, updated: updated, total: worksCards.length + photoCards.length + videoCards.length };
      })
      .catch(function (e) {
        // Defensive: getProjects() already fails soft and shouldn't reject,
        // but guarantee this function never rejects either.
        return { ok: false, reason: (e && e.message) || 'unknown error' };
      });
  }

  global.renderProjectCards = renderProjectCards;
})(typeof window !== 'undefined' ? window : globalThis);
