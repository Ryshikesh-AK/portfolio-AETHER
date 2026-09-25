/**
 * Main Application Bootstrapper
 * Coordinates Lenis Smooth Scroll, WebGL Distort Engine, GSAP Animations,
 * Dynamic Filtering, Case Study Modals, and Interactive Studio Terminal
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 0. Render Works cards from the CMS (falls back to the existing hardcoded
  //    card content on any failure). Must resolve before anything below
  //    queries .project-card, since WebGL registration (step 2) and
  //    AnimationController (step 3) both read it once.
  if (window.renderProjectCards) {
    await window.renderProjectCards();
  }

  // 1. Initialize Lenis Smooth Scroll (with fallback)
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.1,
      touchMultiplier: 2
    });

    window.lenis = lenis;

    // Connect Lenis to GSAP ScrollTrigger
    if (window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
    console.log('✓ Lenis Smooth Scroll initialized');
  }

  // 1b. Fix nav-link anchor scrolling: Lenis's auto anchor-observer scrolls
  // to the exact element top and ignores the CSS `scroll-margin-top` used to
  // clear the fixed nav dock. Handle clicks explicitly with a computed offset
  // instead, so mobile (where the dock can be taller) always clears correctly.
  const siteHeader = document.querySelector('.site-header');
  document.querySelectorAll('.nav-link[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      const targetEl = document.querySelector(targetId);
      if (!targetEl) return;
      e.preventDefault();

      // Measure the fixed header's real rendered height on every click,
      // not a hardcoded number, so it stays correct if the dock wraps to
      // two rows on narrow screens or its size changes at any breakpoint.
      const headerHeight = siteHeader ? siteHeader.getBoundingClientRect().height : 0;
      const topOffset = parseFloat(getComputedStyle(siteHeader || document.body).top) || 24;
      const clearance = headerHeight + topOffset + 24; // header + its own top gap + buffer

      if (lenis) {
        lenis.scrollTo(targetEl, { offset: -clearance, duration: 1.2 });
      } else {
        const y = targetEl.getBoundingClientRect().top + window.scrollY - clearance;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });

  // 1c. Mobile hamburger nav: toggle panel, close on link click or outside tap.
  const mobileToggle = document.getElementById('mobile-nav-toggle');
  const mobilePanel  = document.getElementById('mobile-nav-panel');
  if (mobileToggle && mobilePanel) {
    const closeMobileNav = () => {
      mobilePanel.classList.remove('is-open');
      mobilePanel.setAttribute('aria-hidden', 'true');
      mobileToggle.setAttribute('aria-expanded', 'false');
    };
    const openMobileNav = () => {
      mobilePanel.classList.add('is-open');
      mobilePanel.setAttribute('aria-hidden', 'false');
      mobileToggle.setAttribute('aria-expanded', 'true');
    };

    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobilePanel.classList.contains('is-open');
      if (isOpen) closeMobileNav(); else openMobileNav();
    });

    // Close on outside tap
    document.addEventListener('click', (e) => {
      if (!mobilePanel.classList.contains('is-open')) return;
      if (!mobilePanel.contains(e.target) && e.target !== mobileToggle) {
        closeMobileNav();
      }
    });

    // Reuse the same offset-aware smooth-scroll as the desktop nav-links,
    // then close the panel so it doesn't stay open over the new section.
    mobilePanel.querySelectorAll('.mobile-nav-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetEl = document.querySelector(link.getAttribute('href'));
        closeMobileNav();
        if (!targetEl) return;
        e.preventDefault();
        const headerHeight = siteHeader ? siteHeader.getBoundingClientRect().height : 0;
        const clearance = headerHeight + 40;
        if (lenis) {
          lenis.scrollTo(targetEl, { offset: -clearance, duration: 1.2 });
        } else {
          const y = targetEl.getBoundingClientRect().top + window.scrollY - clearance;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      });
    });
  }

  // 2. Initialize WebGL Distortion Canvas
  const canvas = document.getElementById('webgl-canvas');
  let webglEngine = null;
  if (canvas && window.WebGLDistortEngine) {
    webglEngine = new WebGLDistortEngine(canvas);
    window.webglEngine = webglEngine;

    // Connect scroll velocity directly to WebGL shader uniforms
    if (lenis) {
      lenis.on('scroll', (e) => {
        webglEngine.updateVelocity(e.velocity);
      });
    } else {
      let lastScroll = window.scrollY;
      window.addEventListener('scroll', () => {
        const current = window.scrollY;
        const delta = current - lastScroll;
        lastScroll = current;
        webglEngine.updateVelocity(delta);
      }, { passive: true });
    }

    // Register all project card image containers
    document.querySelectorAll('.project-card').forEach((card) => {
      const mediaWrap = card.querySelector('.card-media-wrap');
      const img = card.querySelector('.webgl-texture-source');
      if (mediaWrap && img) {
        webglEngine.register(mediaWrap, img.getAttribute('src'));
      }
    });
  }

  // 3. Initialize GSAP Animations & Text Splitting
  if (window.AnimationController) {
    const animController = new AnimationController();
    window.animController = animController;
  }


  // 5. Category Filtering (Scoped per showcase section)
  document.querySelectorAll('.works-section, .works-subgroup').forEach((section) => {
    const filterContainer = section.querySelector('.category-filters');
    if (!filterContainer) return;
    const filterButtons = filterContainer.querySelectorAll('.filter-btn');
    const cards = section.querySelectorAll('.project-card');

    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');

        cards.forEach((card) => {
          if (card.getAttribute('data-admin-disabled') === 'true') {
            card.style.display = 'none';
            return;
          }
          const cat = card.getAttribute('data-category') || '';
          if (filter === 'all' || cat.includes(filter)) {
            card.style.display = '';
            if (window.gsap) {
              gsap.fromTo(card, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' });
            }
          } else {
            card.style.display = 'none';
          }
        });

        // Refresh ScrollTrigger and WebGL coordinates after DOM re-flow
        if (window.ScrollTrigger) ScrollTrigger.refresh();
        if (webglEngine) webglEngine.onResize();
      });
    });
  });

  // 6. Interactive Case Study Modal
  const modalBackdrop = document.getElementById('project-modal');
  const modalCloseBtn = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');
  const modalDesc = document.getElementById('modal-desc');
  const modalBanner = document.getElementById('modal-banner');
  const modalDeliverables = document.getElementById('modal-deliverables');
  const modalTech = document.getElementById('modal-tech');
  const modalYear = document.getElementById('modal-year');
  let activeModalProjectId = null;

  const projectData = {
    '1': {
      title: 'AETHERIA OS',
      meta: 'NEOBRUTALISM // SPATIAL COMPUTING',
      year: '2026',
      deliverables: 'Spatial Design System, Holographic HUD, Ambient Audio Engine, Micro-Interactions',
      tech: 'Three.js, WebGL 2.0, Web Audio API, GSAP Motion, Shaders',
      banner: 'assets/images/Neobrutalist_digital_art_geometr_20260918114558.jpeg',
      desc: 'Aetheria OS represents our exploration into post-screen spatial interaction. Built around an acoustic ambient field, the interface dynamically warps visual density based on cognitive auditory feedback. Every UI primitive responds to gravity vectors with sub-pixel inertia.'
    },
    '2': {
      title: 'VANGUARD KINETIC',
      meta: 'SWISS STYLE // TELEMETRY & AERODYNAMICS',
      year: '2026',
      deliverables: 'CAN-Bus Telemetry HUD, Aerodynamic Visualizer, Type Foundry Specimen',
      tech: 'WebGL Real-Time Shaders, Vector Aerodynamics, Custom GLSL',
      banner: 'assets/images/Swiss_style_graphic_design_layout_20260918114558.jpeg',
      desc: 'High-speed aerodynamic telemetry system designed for an electric hypercar concept. The interface translates live wind-tunnel turbulence and tyre temperature telemetry into an intuitive HUD dashboard optimized for 300+ km/h reaction times.'
    },
    '3': {
      title: 'MONOFORM FOUNDRY',
      meta: 'BAUHAUS // VARIABLE TYPE FOUNDRY',
      year: '2025',
      deliverables: 'Variable Font Specimen Site, Glyphs Engine, Interactive Type Tester',
      tech: 'Variable Font Axes, CSS Houdini, Kinetic Typography',
      banner: 'assets/images/Bauhaus_geometric_art_composition_20260918114558.jpeg',
      desc: 'Monoform Foundry investigates the intersection between architectural Brutalism and dynamic variable typography. The site generates algorithmic specimens in real time based on scroll velocity and audio frequency inputs.'
    },
    '4': {
      title: 'LUMINA BIOCLIMATIC',
      meta: 'BRUTALIST ARCHITECTURE // SPATIAL IDENTITY',
      year: '2025',
      deliverables: 'Identity Architecture, Solar Radiation Interactive Map, Spatial Signage',
      tech: 'Three.js Solar Shaders, Parametric Timber Simulation',
      banner: 'assets/images/Brutalist_architecture_graphic_20260918114558.jpeg',
      desc: 'A comprehensive brand and digital presence for a carbon-negative pavilion in Scandinavia. The design system incorporates continuous real-time solar tracking with live shadow projections rendered natively in WebGL.'
    },
    '5': {
      title: 'SOLARIA ENERGY',
      meta: 'RETRO-GRID // CONTINENTAL ENERGY OS',
      year: '2026',
      deliverables: 'Grid Control OS, Continental Energy Flow Map, Real-time Alerts',
      tech: 'High-frequency WebSocket Data, Canvas 2D, WebGL Shaders',
      banner: 'assets/images/Vaporwave_grid_landscape_sunset_20260918114558.jpeg',
      desc: 'A planetary telemetry dashboard mapping solar and offshore wind energy distribution across Europe. Employs multi-layer vector canvas pipelines to render over 20,000 live turbine points without frame latency.'
    },
    'p1': {
      title: 'BRUTALIST MONOLITH',
      meta: 'ARCHITECTURAL FORM // 35MM FILM',
      year: '2026',
      deliverables: 'Monochrome Architectural Study, Museum Print Edition, Spatial Morphology',
      tech: 'Leica M6, Summicron 35mm f/2, Kodak Tri-X 400 Silver Gelatin',
      banner: 'assets/images/photo-1-architecture.jpg',
      desc: 'An architectural investigation documenting raw concrete brutalist structures and stark geometric cantilever forms. Shot exclusively on high-contrast 35mm black-and-white film to emphasize tactile texture and harsh sunlight shadow planes.'
    },
    'p2': {
      title: 'AVANT-GARDE SHADOW',
      meta: 'HAUTE COUTURE // EDITORIAL PORTRAITURE',
      year: '2026',
      deliverables: 'Editorial Lookbook, Sculptural Fashion Direction, High-Key Chiaroscuro',
      tech: 'Medium Format Digital, Broncolor Para Lighting, Monochromatic Grading',
      banner: 'assets/images/photo-2-portrait.jpg',
      desc: 'High-concept fashion editorial centered on architectural silhouettes and extreme chiaroscuro. The series examines the boundary between garment structure and monolithic spatial form with precision studio lighting.'
    },
    'p3': {
      title: 'VOLCANIC SEASCAPE',
      meta: 'ANALOG LANDSCAPE // MEDIUM FORMAT',
      year: '2025',
      deliverables: 'Fine Art Exhibition Portfolio, Archival Pigment Prints, Analog Field Study',
      tech: 'Hasselblad 500C/M, Carl Zeiss 80mm f/2.8, Ilford HP5+ 120 Film',
      banner: 'assets/images/photo-3-landscape.jpg',
      desc: 'Documenting the stark coastal geology and basalt monoliths of Nordic volcanic beaches. Captured on medium format roll film under dense sea mist and low Arctic sun, evoking timeless primeval isolation.'
    },
    'v1': {
      title: 'KINETIC HYPERCAR DRIFT',
      meta: 'DIRECTOR OF PHOTOGRAPHY // 2026',
      year: '2026',
      deliverables: '4K DCI Cinema Master, High-Speed Pursuit Pipeline, Anamorphic Lens Flare Suite',
      tech: 'ARRI Alexa Mini LF, Atlas Orion 2x Anamorphic, Gyro-Stabilized Pursuit Rig',
      banner: 'assets/images/video-1-hypercar.jpg',
      desc: 'High-octane nocturnal cinema spot tracking an electric hypercar through rain-slicked Tokyo highways. Features horizontal blue anamorphic flares, visceral wet-surface light reflections, and authentic motion-picture texture.'
    },
    'v2': {
      title: 'BRUTALIST ATRIUM // BRAND FILM',
      meta: 'COMMERCIAL DIRECTION // 2025',
      year: '2025',
      deliverables: 'Commercial Direction, Volumetric Lighting Design, Soundscape Synthesis',
      tech: 'RED V-Raptor 8K, Master Primes, Custom LUT Color Architecture',
      banner: 'assets/images/video-2-fashion.jpg',
      desc: 'A moody commercial brand film set in a towering brutalist concrete atrium. Volumetric sun beams cut through morning atmospheric haze to create an ethereal, monumental sense of scale and architectural poetry.'
    },
    'v3': {
      title: 'CYBERNETIC STAGE ECHO',
      meta: 'EXPERIMENTAL LIVE VISUALS // 2026',
      year: '2026',
      deliverables: 'Live Stage Visual Engineering, Laser Synchronizer, Real-Time Audio Reactive Shaders',
      tech: 'Kinetix Robotic Rig, TouchDesigner 60FPS Pipeline, Custom GLSL Laser Nodes',
      banner: 'assets/images/video-3-stage.jpg',
      desc: 'An immersive live performance visual installation fusing kinetic robotic LED arms, synchronized volumetric laser arrays, and real-time audio reactive shader feeds for a futuristic concert experience.'
    }
  };

  // Intercept wheel events on the modal window so Lenis never sees them.
  // This must be attached once and left in place for the lifetime of the page.
  const _modalScrollEl = document.querySelector('.modal-content-window');
  if (_modalScrollEl) {
    _modalScrollEl.addEventListener('wheel', (e) => {
      // Only intercept when the modal is actually open — let it bubble otherwise
      if (!modalBackdrop.classList.contains('open')) return;
      e.stopPropagation();
      // Native scroll: manually move the container's scrollTop so that the
      // browser's own scroll engine handles momentum/inertia on Mac trackpads.
      // We do NOT call e.preventDefault() so the browser can still apply
      // its native smooth-scroll on the element.
    }, { passive: true, capture: true });
  }

  function populateModal(data) {
    if (!data) return;

    modalTitle.textContent = data.title;
    modalMeta.textContent = data.meta || data.tag || '';
    modalDesc.textContent = data.desc || '[PROJECT DESCRIPTION] — Algorithmic investigation into kinetic reality, spatial interfaces, and sub-pixel tactile ergonomics.';
    modalDeliverables.textContent = data.deliverables || 'Spatial Design System, WebGL Shaders, HUD Architecture';
    modalTech.textContent = data.tech || 'Three.js, WebGL 2.0, GSAP Motion, Custom GLSL';
    modalYear.textContent = data.year || '2026';
    modalBanner.setAttribute('src', data.banner || data.image || data.src || '');
  }

  function openModal(data, startRect) {
    if (!data) return;

    populateModal(data);

    // Reset scroll position to top on every open
    if (_modalScrollEl) _modalScrollEl.scrollTop = 0;

    modalBackdrop.classList.add('open');
    // Lock background scroll: prevent body scroll and stop Lenis.
    // We do NOT set overflow:hidden on the body because that would also
    // remove the scrollbar, causing a layout shift. Instead we rely on
    // lenis.stop() + body pointer-events to block the page scroll.
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    if (webglEngine && typeof webglEngine.pauseRotation === 'function') {
      webglEngine.pauseRotation();
    }

    // Shared-element FLIP animation: animate modal from source rect
    const modalWindow = modalBackdrop.querySelector('.modal-content-window');
    if (modalWindow && window.gsap && startRect && startRect.width > 0 && startRect.height > 0) {
      // getBoundingClientRect after classList.add('open') — the backdrop is now visible
      const targetRect = modalWindow.getBoundingClientRect();
      const startCenterX = startRect.left + startRect.width * 0.5;
      const startCenterY = startRect.top + startRect.height * 0.5;
      const targetCenterX = targetRect.left + targetRect.width * 0.5;
      const targetCenterY = targetRect.top + targetRect.height * 0.5;

      const deltaX = startCenterX - targetCenterX;
      const deltaY = startCenterY - targetCenterY;
      const scaleX = Math.max(0.15, startRect.width / Math.max(1, targetRect.width));
      const scaleY = Math.max(0.15, startRect.height / Math.max(1, targetRect.height));

      gsap.fromTo(modalWindow,
        { x: deltaX, y: deltaY, scaleX, scaleY, opacity: 0.6 },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: 0.42, ease: 'expo.out' }
      );
    }
  }

  // Ring 3D card click handler
  window.addEventListener('ring-card-click', (e) => {
    const { item, screenRect } = e.detail;
    openModal({
      title: item.title,
      meta: item.tag,
      desc: '[PROJECT DESCRIPTION] — Kinetic spatial interface engineered for sub-pixel tactile feedback and real-time GPU displacement.',
      deliverables: 'Spatial Design System, Holographic HUD, Kinetic Type',
      tech: 'Three.js, WebGL Shaders, GSAP Motion Engine',
      year: '2026',
      banner: item.src
    }, screenRect);
  });

  document.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('click', () => {
      const pid = card.getAttribute('data-project-id');
      const rect = card.getBoundingClientRect();
      const fallback = projectData[pid] || {
        title: card.querySelector('.card-title')?.textContent?.replace('→', '')?.trim() || 'SELECTED WORK',
        meta: card.querySelector('.card-sub')?.textContent?.trim() || 'PORTFOLIO // 2026',
        desc: 'Bespoke project exploration and technical case study documentation.',
        deliverables: 'Direction, Production, Technical Architecture',
        tech: 'Industry Standard Cameras, Optical Systems, Color Pipeline',
        year: '2026',
        banner: card.querySelector('.webgl-texture-source')?.getAttribute('src') || ''
      };
      activeModalProjectId = pid;

      // Open immediately with bundled data so the existing FLIP animation
      // starts from the card; replace the modal fields when CMS data arrives.
      openModal(fallback, rect);
      if (window.AshiAPI && typeof window.AshiAPI.getProject === 'function') {
        window.AshiAPI.getProject(pid).then((res) => {
          if (res && res.ok && res.data && modalBackdrop.classList.contains('open') && activeModalProjectId === pid) {
            populateModal(res.data);
          }
        });
      }
    });
  });

  function closeModal() {
    activeModalProjectId = null;
    const modalWindow = modalBackdrop.querySelector('.modal-content-window');
    if (modalWindow && window.gsap) {
      gsap.to(modalWindow, {
        scale: 0.95,
        opacity: 0,
        y: 16,
        duration: 0.22,
        ease: 'power2.in',
        onComplete: () => {
          modalBackdrop.classList.remove('open');
          document.body.style.overflow = '';
          if (lenis) lenis.start();
          if (webglEngine && typeof webglEngine.resumeRotation === 'function') {
            webglEngine.resumeRotation();
          }
          gsap.set(modalWindow, { clearProps: 'all' });
        }
      });
    } else {
      modalBackdrop.classList.remove('open');
      document.body.style.overflow = '';
      if (lenis) lenis.start();
      if (webglEngine && typeof webglEngine.resumeRotation === 'function') {
        webglEngine.resumeRotation();
      }
    }
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) {
      closeModal();
    }
  });

  // 7. Email Copy with Toast Notice
  const copyBtn = document.getElementById('copy-email-btn');
  const toast = document.getElementById('toast-notice');

  if (copyBtn && toast) {
    copyBtn.addEventListener('click', () => {
      const email = 'studio@aether-kinetic.com';
      navigator.clipboard.writeText(email).then(() => {
        toast.textContent = `COPIED TO CLIPBOARD: ${email}`;
        toast.classList.add('show');
        setTimeout(() => {
          toast.classList.remove('show');
        }, 3000);
      }).catch(() => {
        toast.textContent = `CONTACT: ${email}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
      });
    });
  }

  // 8. Wireframe Centrepiece Toggle (LATTICE <-> FRACTAL)
  const geoToggle = document.getElementById('geo-toggle');
  if (geoToggle) {
    const geoButtons = geoToggle.querySelectorAll('.geo-btn');
    geoButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-geo');
        geoButtons.forEach((b) => {
          const isActive = (b === btn);
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        if (webglEngine && typeof webglEngine.morphCenterpiece === 'function') {
          webglEngine.morphCenterpiece(mode);
        }
      });
    });
  }

  console.log('✓ Application successfully bootstrapped');
});
