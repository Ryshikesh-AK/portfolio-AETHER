/**
 * intro.js - Contained Boxed Image-Cycle Preloader with Expanding Pale Butter Finale
 *
 * Sequence flow:
 *   PRELOAD          t=0.0s   White bg, yellow dot pulses at bottom-left, boxed card appears
 *   CYCLE_1..3       t~0.3s   Rapid image-to-image opacity crossfades inside the centered box
 *   CYCLE_BUTTER     t~1.3s   Final cycle step: previous image crossfades into the solid #F6EFA6
 *                             Pale Butter frame, which expands from the contained boxed size
 *                             to full viewport coverage as it becomes the site background
 *   SCENE_REVEAL     t~2.3s   Overlay fades out. Nav dock + SCROLL anchor appear.
 *                             Ring stays hidden (opacity:0) — breathing moment begins.
 *   BREATHING_PAUSE  t~3.2s   ~1s of empty Pale Butter + nav + SCROLL anchor only.
 *                             Confident, uncluttered first impression before density arrives.
 *   RING_ARRIVE      t~4.2s   13-card ring fades in over 1.6s via fadeHeroObjectsIn.
 *                             Cards float in naturally, no jarring pop-in.
 *   INTERACTIVE      t~4.4s   ScrollTrigger.refresh(), lenis.start()
 */

function hexToRGB(hex) {
  return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}

let _clearColorObj = null;
function applyClearColor(renderer, rgb) {
  if (!renderer || typeof THREE === 'undefined') return;
  if (!_clearColorObj) _clearColorObj = new THREE.Color();
  _clearColorObj.setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255);
  renderer.setClearColor(_clearColorObj, 1);
}

class IntroSequence {
  constructor() {
    this._tl          = null;
    this._dot         = null;
    this._stage       = null;
    this._cardWrap    = null;
    this._butterFrame = null;
    this._imgs        = [];
  }

  init() {
    // Clean up any stale session or local storage flags so intro replays on every refresh
    try {
      sessionStorage.removeItem('aether_preloader_seen');
      localStorage.removeItem('aether_preloader_seen');
    } catch (_) {}

    this._buildDOM();
    this._buildTimeline();
  }

  _buildDOM() {
    // Remove any previous temporary intro nodes if re-running
    ['intro-dot', 'intro-stage', 'intro-butter-frame', 'intro-preloader', 'intro-image-stage', 'intro-butter-layer', 'intro-blue-cover'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    if (!document.getElementById('intro-style')) {
      const style = document.createElement('style');
      style.id = 'intro-style';
      style.textContent = [
        '@keyframes introDotPulse {',
        '  from { transform: scale(1);   opacity: 1; }',
        '  to   { transform: scale(1.5); opacity: 0.45; }',
        '}',
        '#intro-dot {',
        '  position: fixed; bottom: 32px; left: 32px;',
        '  width: 10px; height: 10px;',
        '  background: #C8FF00; border: 2px solid #000;',
        '  z-index: 10000; opacity: 0; pointer-events: none;',
        '  animation: introDotPulse 0.85s ease-in-out infinite alternate;',
        '}',
        /* Preloader backdrop — clean near-white initial stage */
        '#intro-stage {',
        '  position: fixed; inset: 0;',
        '  display: flex; align-items: center; justify-content: center;',
        '  z-index: 9991; pointer-events: none; overflow: hidden;',
        '  background: #ffffff;',
        '}',
        /* Contained, boxed presentation: moderate rectangle centered in viewport */
        '.intro-card-wrap {',
        '  position: relative;',
        '  width: 72vw; max-width: 900px;',
        '  aspect-ratio: 16 / 9;',
        '  border: 3px solid #000;',
        '  box-shadow: 10px 10px 0px #000;',
        '  background: #08080a;',
        '  overflow: hidden;',
        '  z-index: 9992;',
        '}',
        '.intro-cycle-img {',
        '  position: absolute; inset: 0;',
        '  width: 100%; height: 100%;',
        '  object-fit: cover;',
        '  opacity: 0;',
        '  will-change: opacity;',
        '}',
        /* Final Pale Butter frame — expands from boxed size to full viewport coverage */
        '#intro-butter-frame {',
        '  position: fixed;',
        '  background: #F6EFA6;',
        '  z-index: 9995;',
        '  pointer-events: none;',
        '  opacity: 0;',
        '  will-change: top, left, width, height, opacity;',
        '}',
        /* Clean up any legacy rules from previous iterations */
        '#intro-image-stage, #intro-butter-layer, #intro-blue-cover, #intro-preloader { display: none !important; }',
        'body.intro-running .site-header,',
        'body.intro-running main,',
        'body.intro-running .ticker-wrap,',
        'body.intro-running .geo-toggle { visibility: hidden !important; opacity: 0 !important; }',
        'body.intro-running #webgl-canvas { opacity: 0 !important; }'
      ].join('\n');
      document.head.appendChild(style);
    }

    // 1. Anchored yellow indicator dot
    const dot = document.createElement('div');
    dot.id = 'intro-dot';
    dot.setAttribute('aria-hidden', 'true');

    // 2. Preloader stage with centered box
    const stage = document.createElement('div');
    stage.id = 'intro-stage';
    stage.setAttribute('aria-hidden', 'true');

    const cardWrap = document.createElement('div');
    cardWrap.className = 'intro-card-wrap';

    // 3. Image sources for boxed sequential cycling (real artworks)
    const imageSources = [
      'assets/images/Neobrutalist_digital_art_geometr_20260918114558.jpeg',
      'assets/images/Bauhaus_geometric_art_composition_20260918114558.jpeg',
      'assets/images/Brutalist_architecture_graphic_20260918114558.jpeg',
      'assets/images/Swiss_style_graphic_design_layout_20260918114558.jpeg'
    ];

    this._imgs = [];
    imageSources.forEach((src, idx) => {
      const img = document.createElement('img');
      img.className = 'intro-cycle-img';
      img.src = src;
      img.alt = `Project frame ${idx + 1}`;
      img.draggable = false;
      cardWrap.appendChild(img);
      this._imgs.push(img);
    });

    stage.appendChild(cardWrap);

    // 4. Final Pale Butter frame: starts at exact boxed size and coordinates,
    // crossfades in and expands to full viewport
    const butterFrame = document.createElement('div');
    butterFrame.id = 'intro-butter-frame';
    butterFrame.setAttribute('aria-hidden', 'true');

    document.body.classList.add('intro-running');
    document.body.appendChild(stage);
    document.body.appendChild(butterFrame);
    document.body.appendChild(dot);

    // Measure initial card box rect for sub-pixel alignment
    const rect = cardWrap.getBoundingClientRect();
    gsap.set(butterFrame, {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      opacity: 0
    });

    this._dot         = dot;
    this._stage       = stage;
    this._cardWrap    = cardWrap;
    this._butterFrame = butterFrame;

    // Set initial GSAP hidden transform states on hero elements
    const header          = document.querySelector('.site-header');
    const heroTagline     = document.querySelector('.hero-anchor-tagline');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (header)           gsap.set(header,          { opacity: 0, y: -20 });
    if (heroTagline)      gsap.set(heroTagline,      { opacity: 0, y: 10 });
    if (scrollIndicator)  gsap.set(scrollIndicator,  { opacity: 0 });

    // Ensure canvas clear color matches Pale Butter and starts invisible
    const butterRGB = hexToRGB(0xF6EFA6);
    const canvas = document.getElementById('webgl-canvas');
    if (canvas) canvas.style.opacity = '0';
    if (window.webglEngine) {
      if (window.webglEngine.renderer) applyClearColor(window.webglEngine.renderer, butterRGB);
      if (typeof window.webglEngine.setRingOpacity === 'function') {
        window.webglEngine.setRingOpacity(0.0);
      }
    }
  }

  _buildTimeline() {
    const dot         = this._dot;
    const stage       = this._stage;
    const cardWrap    = this._cardWrap;
    const butterFrame = this._butterFrame;
    const [img0, img1, img2, img3] = this._imgs;
    const getRenderer = () => (window.webglEngine && window.webglEngine.renderer) || null;
    const butterRGB   = hexToRGB(0xF6EFA6);

    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => this._cleanup()
    });
    this._tl = tl;

    // ---------- 1. PRELOAD (t=0) ----------
    tl.addLabel('PRELOAD', 0);
    tl.to(dot, { opacity: 1, duration: 0.25, ease: 'power2.out' }, 'PRELOAD');

    // First image in boxed sequence fades in
    tl.to(img0, { opacity: 1, duration: 0.28, ease: 'power2.out' }, 'PRELOAD+=0.05');

    // ---------- 2. CONTAINED BOXED IMAGE CYCLE ----------
    // Artwork images cycle inside the centered box via opacity crossfades.
    // Frame 0 -> Frame 1
    tl.addLabel('CYCLE_1', '+=0.28');
    tl.to(img1, { opacity: 1, duration: 0.22, ease: 'power2.out' }, 'CYCLE_1');
    tl.to(img0, { opacity: 0, duration: 0.20, ease: 'power1.in'  }, 'CYCLE_1');

    // Frame 1 -> Frame 2
    tl.addLabel('CYCLE_2', '+=0.22');
    tl.to(img2, { opacity: 1, duration: 0.24, ease: 'power2.out' }, 'CYCLE_2');
    tl.to(img1, { opacity: 0, duration: 0.22, ease: 'power1.in'  }, 'CYCLE_2');

    // Frame 2 -> Frame 3
    tl.addLabel('CYCLE_3', '+=0.24');
    tl.to(img3, { opacity: 1, duration: 0.28, ease: 'power2.out' }, 'CYCLE_3');
    tl.to(img2, { opacity: 0, duration: 0.24, ease: 'power1.in'  }, 'CYCLE_3');

    // ---------- 3. FINAL CYCLE STEP: BOXED-EXPANDING-TO-FULLSCREEN PALE BUTTER FRAME ----------
    // Solid #F6EFA6 Pale Butter frame crossfades from previous image (exact same crossfade logic)
    // AND expands from the contained boxed size into full viewport coverage as it becomes the site background.
    tl.addLabel('CYCLE_BUTTER', '+=0.30');

    // Ensure initial boxed coordinates match cardWrap exactly right as transition starts
    tl.call(() => {
      const rect = cardWrap.getBoundingClientRect();
      gsap.set(butterFrame, {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    }, null, 'CYCLE_BUTTER');

    // Previous photo fades out inside the box
    tl.to(img3, { opacity: 0, duration: 0.55, ease: 'power2.inOut' }, 'CYCLE_BUTTER');

    // Card border and shadow dissolve away cleanly
    tl.to(cardWrap, {
      borderColor: 'transparent',
      boxShadow: '0px 0px 0px transparent',
      duration: 0.35,
      ease: 'power2.out'
    }, 'CYCLE_BUTTER');

    // Solid Pale Butter frame crossfades in AND expands to full viewport
    tl.to(butterFrame, {
      opacity: 1,
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      duration: 0.85,
      ease: 'power2.inOut'
    }, 'CYCLE_BUTTER');

    // Ensure WebGL clear color matches #F6EFA6 behind the opaque expanding overlay
    tl.call(() => {
      const rend = getRenderer();
      if (rend) applyClearColor(rend, butterRGB);
    }, null, 'CYCLE_BUTTER');

    // ---------- 4. SCENE_REVEAL ----------
    // Overlay fades out revealing the bare Pale Butter scene.
    // At this point: only the nav dock + scroll anchor appear.
    // The ring stays hidden (opacity: 0) — this is the intentional 'breathing moment'.
    tl.addLabel('SCENE_REVEAL', '+=0.15');

    const ringProxy = { opacity: 0 };
    tl.set(ringProxy, { opacity: 0 }, 0);
    if (window.webglEngine) {
      tl.set(window.webglEngine, { ringOpacity: 0.0 }, 0);
    }
    tl.call(() => {
      if (window.webglEngine) {
        window.webglEngine.ringOpacity = 0.0;
      }
    }, null, 'PRELOAD');

    // Fade out preloader dot
    tl.to(dot, { opacity: 0, duration: 0.25, ease: 'power2.in' }, 'SCENE_REVEAL');

    // Fade out the expanding butter overlay and stage
    tl.to([butterFrame, stage], {
      opacity: 0,
      duration: 0.7,
      ease: 'power2.inOut'
    }, 'SCENE_REVEAL');

    // Handoff: unhide content, reveal canvas — but NOT the ring yet
    tl.call(() => {
      document.body.classList.remove('intro-running');
      if (window.webglEngine) {
        window.webglEngine.ringOpacity = 0.0;
      }
    }, null, 'SCENE_REVEAL');

    if (window.webglEngine) {
      tl.set(window.webglEngine, { ringOpacity: 0.0 }, 'SCENE_REVEAL');
    }

    tl.to('#webgl-canvas', { opacity: 1, duration: 0.2, ease: 'power1.out' }, 'SCENE_REVEAL');

    // Nav dock slides down — minimal, unobtrusive
    tl.to('.site-header', {
      opacity: 1, y: 0, duration: 0.75, ease: 'expo.out'
    }, 'SCENE_REVEAL+=0.1');

    // Studio tagline reveals at bottom-left
    tl.to('.hero-anchor-tagline', {
      opacity: 1, y: 0, duration: 0.65, ease: 'expo.out'
    }, 'SCENE_REVEAL+=0.2');

    // SCROLL anchor fades in — the sole centred anchor point during the breathing moment
    tl.to('.scroll-indicator', {
      opacity: 1, duration: 0.75, ease: 'power2.out'
    }, 'SCENE_REVEAL+=0.3');

    // ---------- 5. BREATHING_PAUSE (~1.0s of confident empty Pale Butter + anchor only) ----------
    // The scene sits quietly: solid butter colour, nav, SCROLL cue. Ring is absent.
    // This intentional pause creates pacing — density arrives as a deliberate second beat.
    tl.addLabel('BREATHING_PAUSE', '+=0.75'); // at SCENE_REVEAL + 0.3s reveal + 0.75s pause = ~1.1s total
    tl.to({}, { duration: 1.0 }, 'BREATHING_PAUSE'); // holds timeline open for the pause duration

    // ---------- 6. RING_ARRIVE — ring cards float in, not a pop-in ----------
    // After the breathing moment, the 13-card ring fades in smoothly.
    tl.addLabel('RING_ARRIVE', '+=0');
    tl.to(ringProxy, {
      opacity: 1.0,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: () => {
        if (window.webglEngine) {
          window.webglEngine.ringOpacity = ringProxy.opacity;
        }
      }
    }, 'RING_ARRIVE');
    if (window.webglEngine) {
      tl.to(window.webglEngine, {
        ringOpacity: 1.0,
        duration: 1.6,
        ease: 'power2.out'
      }, 'RING_ARRIVE');
    }

    // ---------- 7. INTERACTIVE ----------
    tl.addLabel('INTERACTIVE', '+=0');
    tl.call(() => {
      this._cleanup();
      if (window.ScrollTrigger) ScrollTrigger.refresh();
      if (window.lenis) window.lenis.start();
      window.introSequenceDone = true;
    }, null, 'INTERACTIVE');
  }

  _cleanup() {
    if (this._dot         && this._dot.parentNode)         this._dot.remove();
    if (this._stage       && this._stage.parentNode)       this._stage.remove();
    if (this._butterFrame && this._butterFrame.parentNode) this._butterFrame.remove();
    document.body.classList.remove('intro-running');
  }
}

window.IntroSequence = IntroSequence;
