/**
 * Animation Orchestration System
 * Direct technical implementation of K95's text-reveal algorithms & ScrollTrigger choreography
 * Extracted and optimized from tDcpOAvj.js and Heh74mPD.js
 */

class AnimationController {
  constructor() {
    if (!window.gsap || !window.ScrollTrigger) {
      console.warn('GSAP or ScrollTrigger not loaded');
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    this.initTextSplitting();
    this.initPreloaderIntro();
    this.initScrollWordReveals();
    this.initScrollReveals();
    this.initDockTracker();
    this.initMagneticDock();
    this.initCustomCursor();
    console.log('✓ AnimationController successfully initialized with GSAP ScrollTrigger');
  }

  /**
   * Character and word splitting algorithm reproducing K95's DOM TreeWalker technique
   */
  initTextSplitting() {
    // Split elements marked with [data-reveal="chars"]
    document.querySelectorAll('[data-reveal="chars"]').forEach((container) => {
      const text = container.textContent.trim();
      container.textContent = '';

      const words = text.split(/\s+/);
      words.forEach((word, wIdx) => {
        const wordWrap = document.createElement('span');
        wordWrap.className = 'gsap-char-reveal-word';

        for (let i = 0; i < word.length; i++) {
          const charWrap = document.createElement('span');
          charWrap.className = 'gsap-char-reveal-wrap';

          const charSpan = document.createElement('span');
          charSpan.className = 'gsap-char-reveal';
          charSpan.textContent = word[i];

          charWrap.appendChild(charSpan);
          wordWrap.appendChild(charWrap);
        }

        container.appendChild(wordWrap);
        if (wIdx < words.length - 1) {
          container.appendChild(document.createTextNode(' '));
        }
      });
    });

    // Split elements marked with [data-reveal="words"]
    document.querySelectorAll('[data-reveal="words"]').forEach((container) => {
      const text = container.textContent.trim();
      container.textContent = '';

      const words = text.split(/(\s+)/);
      words.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          container.appendChild(document.createTextNode(part));
          return;
        }
        const wrap = document.createElement('span');
        wrap.className = 'gsap-word-reveal-wrap';

        const span = document.createElement('span');
        span.className = 'gsap-word-reveal';
        span.textContent = part;

        wrap.appendChild(span);
        container.appendChild(wrap);
      });
    });
  }

  /**
   * Intro Sequence — delegates entirely to IntroSequence (scripts/intro.js).
   * IntroSequence owns the six-stage GSAP timeline (PRELOAD → IMAGE_REVEAL →
   * IMAGE_SCALE_ZOOM → BLUE_COVER → SCENE_REVEAL → INTERACTIVE).
   * After SCENE_REVEAL it calls webglEngine.fadeHeroObjectsIn() directly.
   * AnimationController.initPageLoadIntro() is still available as a fallback
   * for the skip path (sessionStorage already set / page reload).
   */
  initPreloaderIntro() {
    if (window.IntroSequence) {
      const seq = new IntroSequence();
      window.introSeq = seq;
      seq.init();
      return;
    }
    // Fallback: IntroSequence not loaded — just reveal the page directly.
    this.initPageLoadIntro();
  }

  /**
   * Page-Load Intro Sequence
   * Animates the minimal corner anchor (studio label) and header.
   * The ring images are the visual hero — no dominant type animation competes.
   */
  initPageLoadIntro() {
    const heroAnchor = document.querySelector('.hero-anchor');
    const heroAnchorTagline = document.querySelector('.hero-anchor-tagline');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const header = document.querySelector('.site-header');

    console.log('[Intro Sequence] Initializing page-load timeline (ring-first hero, corner anchor label).');

    // Set initial hidden states
    if (header) gsap.set(header, { opacity: 0, y: -20 });
    if (heroAnchorTagline) gsap.set(heroAnchorTagline, { opacity: 0, y: 10 });
    if (scrollIndicator) gsap.set(scrollIndicator, { opacity: 0 });

    let lastProgressLog = 0;

    const introTimeline = gsap.timeline({
      delay: 0.15,
      onStart: () => {
        console.log('[Intro Sequence] RUNNING: header + corner anchor label fade in.');
      },
      onUpdate: function () {
        const progress = Math.round(this.progress() * 100);
        if (progress - lastProgressLog >= 25) {
          lastProgressLog = progress;
          console.log(`[Intro Sequence] Timeline Progress: ${progress}%`);
        }
      },
      onComplete: () => {
        console.log('[Intro Sequence] COMPLETED: header and hero anchor fully revealed.');
      }
    });

    // 1. Navigation bar floats in first
    if (header) {
      introTimeline.to(header, {
        opacity: 1,
        y: 0,
        duration: 0.85,
        ease: 'expo.out'
      }, 0);
    }

    // 2. Tagline slides up
    if (heroAnchorTagline) {
      introTimeline.to(heroAnchorTagline, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'expo.out'
      }, 0.3);
    }

    // 5. Scroll cue fades in gently
    if (scrollIndicator) {
      introTimeline.to(scrollIndicator, {
        opacity: 1,
        duration: 1.0,
        ease: 'power2.out'
      }, 0.75);
    }

    // 6. Fade in WebGL ring after brief moment
    introTimeline.call(() => {
      if (window.webglEngine && typeof window.webglEngine.fadeHeroObjectsIn === 'function') {
        window.webglEngine.fadeHeroObjectsIn(1.4, 0);
      }
    }, null, 0.85);

    this.introTimeline = introTimeline;
  }

  /**
   * ScrollTrigger Word Reveals
   * Calculates visual line grouping by client bounding box and animates words line by line
   */
  initScrollWordReveals() {
    function groupWordsByLine(words) {
      const lines = [];
      words.forEach((w) => {
        const rect = w.getBoundingClientRect();
        const top = rect.top;
        let line = lines.find((l) => Math.abs(l.top - top) <= 4);
        if (!line) {
          line = { top, words: [] };
          lines.push(line);
        }
        line.words.push(w);
      });
      return lines.sort((a, b) => a.top - b.top).map((l) => l.words);
    }

    document.querySelectorAll('[data-reveal="words"]').forEach((container) => {
      // Don't auto-hide hero description if it's already animated in the intro
      if (container.closest('.hero-section')) return;

      const words = Array.from(container.querySelectorAll('.gsap-word-reveal'));
      if (!words.length) return;

      gsap.set(words, { yPercent: 115, opacity: 0 });

      ScrollTrigger.create({
        trigger: container,
        start: 'top 88%',
        once: true,
        onEnter: () => {
          const lines = groupWordsByLine(words);
          const tl = gsap.timeline();
          lines.forEach((lineWords, lineIdx) => {
            tl.to(lineWords, {
              yPercent: 0,
              opacity: 1,
              duration: 0.95,
              stagger: 0.018,
              ease: 'expo.out'
            }, lineIdx * 0.055);
          });
        }
      });
    });
  }

  initScrollReveals() {
    // Section headers reveal (non-hero)
    document.querySelectorAll('.section-heading, .studio-manifesto-title, .contact-title').forEach((heading) => {
      const chars = heading.querySelectorAll('.gsap-char-reveal');
      if (chars.length > 0) {
        gsap.set(chars, { yPercent: 115, opacity: 0, force3D: true });
        ScrollTrigger.create({
          trigger: heading,
          start: 'top 88%',
          once: true,
          onEnter: () => {
            gsap.to(chars, {
              yPercent: 0,
              opacity: 1,
              duration: 0.9,
              stagger: 0.018,
              ease: 'expo.out'
            });
          }
        });
      }
    });

    // Hero WebGL fade-out: scatter cards + centrepiece fade to invisible
    // as the user scrolls the hero section out of view.
    // Starts fading when hero is 50% scrolled past (so cards vanish before WORKS appears).
    ScrollTrigger.create({
      trigger: '#home',
      start: 'top top',
      end:   '50% top',      // smoothly fades across the first 360px before WORKS enters
      scrub: 0.5,
      onUpdate: (self) => {
        if (window.webglEngine && typeof window.webglEngine.setHeroVisibility === 'function') {
          window.webglEngine.setHeroVisibility(self.progress);
        }
      },
      onLeave: () => {
        // Ensure fully hidden + pause scatter updates for performance
        if (window.webglEngine) {
          window.webglEngine.setHeroVisibility(1.0);
          window.webglEngine.isPaused = true;
        }
      },
      onEnterBack: () => {
        // Restore when scrolling back up into hero
        if (window.webglEngine) {
          window.webglEngine.isPaused = false;
        }
      }
    });

    // Project cards staggered entrance + parallax scrub
    const cards = document.querySelectorAll('.project-card');
    cards.forEach((card, index) => {
      // Entrance
      gsap.fromTo(card,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 1.1,
          delay: (index % 2) * 0.12,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 88%',
            once: true
          }
        }
      );

      // Parallax scroll scrub for subtle depth (desktop only — disabled on mobile/tablet single-column to avoid card overlap)
      if (window.innerWidth > 768) {
        const yOffset = index % 2 === 0 ? -35 : 35;
        gsap.to(card, {
          y: yOffset,
          ease: 'none',
          scrollTrigger: {
            trigger: card,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1.2
          }
        });
      }
    });

    // About Section Portrait Photo entrance
    if (document.querySelector('.about-photo-frame')) {
      gsap.fromTo('.about-photo-frame',
        { opacity: 0, scale: 0.95, y: 35 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 1.1,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: '.about-photo-wrapper',
            start: 'top 85%',
            once: true
          }
        }
      );
    }

    // Skills & Arsenal Tag Pills entrance
    if (document.querySelectorAll('.skill-tag').length > 0) {
      gsap.fromTo('.skill-tag',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.05,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: '.skills-grid',
            start: 'top 88%',
            once: true
          }
        }
      );
    }

    // Studio Pillars Cards (if present)
    if (document.querySelector('.pillars-grid')) {
      gsap.fromTo('.pillar-card',
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: 0.95,
          stagger: 0.1,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: '.pillars-grid',
            start: 'top 85%',
            once: true
          }
        }
      );
    }

    // Contact Card
    gsap.fromTo('.contact-card',
      { opacity: 0, scale: 0.96, y: 40 },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: '.contact-section',
          start: 'top 80%',
          once: true
        }
      }
    );
  }

  /**
   * Floating dock active indicator pill tracking
   */
  initDockTracker() {
    const navLinks = document.querySelectorAll('.nav-link');
    const dockPill = document.querySelector('.dock-pill');
    const sections = document.querySelectorAll('section[id]');

    function updatePillPosition(activeLink) {
      if (!activeLink || !dockPill) return;
      dockPill.style.width = `${activeLink.offsetWidth}px`;
      dockPill.style.transform = `translateX(${activeLink.offsetLeft - 6}px)`;
    }

    const firstActive = document.querySelector('.nav-link.active') || navLinks[0];
    if (firstActive) updatePillPosition(firstActive);

    sections.forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 40%',
        end: 'bottom 40%',
        onEnter: () => activateLink(sec.id),
        onEnterBack: () => activateLink(sec.id)
      });
    });

    function activateLink(id) {
      navLinks.forEach((link) => {
        if (link.getAttribute('href') === `#${id}`) {
          link.classList.add('active');
          updatePillPosition(link);
        } else {
          link.classList.remove('active');
        }
      });
    }

    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        // Scrolling itself is handled by the dynamic-offset handler in
        // main.js (accounts for the fixed nav's real height at any
        // breakpoint). This listener only updates the pill/active-state UI
        // so the two don't fire two competing scrollTo calls on one click.
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        updatePillPosition(link);
      });
    });

    window.addEventListener('resize', () => {
      const currentActive = document.querySelector('.nav-link.active');
      if (currentActive) updatePillPosition(currentActive);
    });
  }

  /**
   * Magnetic Dock Navigation Links
   * Smooth physics attraction to cursor on hover
   */
  initMagneticDock() {
    const dockButtons = document.querySelectorAll('.nav-link, .copy-email-btn');

    dockButtons.forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        gsap.to(btn, {
          x: x * 0.35,
          y: y * 0.35,
          duration: 0.3,
          ease: 'power2.out'
        });
      });

      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, {
          x: 0,
          y: 0,
          duration: 0.6,
          ease: 'elastic.out(1, 0.4)'
        });
      });
    });
  }

  /**
   * Interactive Custom Cursor Viewfinder
   */
  initCustomCursor() {
    const cursor = document.getElementById('app-cursor');
    if (!cursor) return;

    // ── Touch / no-hover guard ──────────────────────────────────────────────
    // matchMedia('(hover: none)') covers touch devices where there's no mouse.
    // matchMedia('(pointer: coarse)') catches stylus / touch secondary pointers.
    // On these devices hide the custom cursor entirely and bail out — the CSS
    // @media block already re-enables the native cursor there.
    const isTouchPrimary =
      window.matchMedia('(hover: none)').matches ||
      window.matchMedia('(pointer: coarse)').matches;

    if (isTouchPrimary) {
      cursor.style.display = 'none';
      return;
    }

    // ── Position tracking ────────────────────────────────────────────────────
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let curX = mouseX;
    let curY = mouseY;
    let hasMovedOnce = false;

    // Keep cursor invisible (opacity 0) until the first real mousemove so it
    // doesn't render at (0,0) or screen-centre before the user moves the mouse.
    cursor.style.opacity = '0';
    cursor.style.transition = 'opacity 0.2s ease, width 0.2s var(--ease-expo), height 0.2s var(--ease-expo), margin 0.2s var(--ease-expo)';

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!hasMovedOnce) {
        // Snap to real position immediately on first move (no lerp lag at start)
        curX = mouseX;
        curY = mouseY;
        cursor.style.opacity = '1';
        hasMovedOnce = true;
      }
    }, { passive: true });

    // Hide cursor when mouse leaves the browser window
    document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => {
      if (hasMovedOnce) cursor.style.opacity = '1';
    });

    function renderCursor() {
      curX += (mouseX - curX) * 0.15;
      curY += (mouseY - curY) * 0.15;
      cursor.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;
      requestAnimationFrame(renderCursor);
    }
    requestAnimationFrame(renderCursor);

    // ── Hover expansion targets ──────────────────────────────────────────────
    // Expand the viewfinder on any interactive element
    const hoverTargets = document.querySelectorAll(
      '.project-card, .filter-btn, .copy-email-btn, .inquiry-btn, .modal-close-btn, .nav-link, a, button'
    );
    hoverTargets.forEach((el) => {
      el.addEventListener('mouseenter', () => cursor.classList.add('cursor-hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('cursor-hover'));
    });
  }

}

window.AnimationController = AnimationController;
