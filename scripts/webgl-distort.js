/**
 * WebGL Hero Scene Engine v2
 * - Wireframe centrepiece: LATTICE (3x3x3 cube grid) <-> FRACTAL (recursive corner cubes)
 * - 13 project thumbnails scattered asymmetrically on a flat ground plane
 * - Ground-plane graph-paper grid (thin 12% opacity lines)
 * - Dual-axis centrepiece auto-rotation (~45-65 s/rev)
 * - GSAP morph between LATTICE / FRACTAL states
 * - Simplified hover: scale + shadow lift (no GLSL colour-shift)
 * - Raycasting, floating badge RAF tracking, modal FLIP click dispatch
 * - Touch tap vs scroll discrimination (<=10px / <=300ms = tap)
 */

class WebGLDistortEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.items = new Map();
    this.scrollVelocity = 0;
    this.targetVelocity = 0;
    this.time = 0;
    this.isInitialized = false;

    // Mouse parallax
    this.mousePos   = { x: 0, y: 0 };
    this.targetMouse = { x: 0, y: 0 };

    // Scattered card state
    this.scatterItems = [];
    this.scatterGroup = null;
    this._scatterOpacity = 0.0;
    this._heroScrollOpacity = 1.0;

    // Whole-scene parent group (cards + centerpiece + ground grid)
    this.heroSceneGroup = null;

    // Centrepiece (3D Wireframe DSLR Camera)
    this.centerpieceGroup = null;
    this.cameraParts = [];
    this.geoState = 'body';
    this.centerpieceRotX = 0;
    this.centerpieceRotY = 0;

    // Interaction
    this.raycaster  = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2(-999, -999);
    this.hoveredItem  = null;
    this.isPaused     = false;
    this.touchStart   = null;
    this.lastClientX  = 0;
    this.lastClientY  = 0;

    // Performance
    this.frameCount  = 0;
    this.lastFpsTime = performance.now();
    this.currentFps  = 60;

    if (!window.THREE) {
      console.warn('Three.js not loaded.');
      document.body.classList.add('no-webgl');
      return;
    }

    try {
      this.initThree();
      console.log('[WebGL] initThree OK — canvas render size:', this.renderer.domElement.width, 'x', this.renderer.domElement.height, '| CSS size:', this.canvas.clientWidth, 'x', this.canvas.clientHeight, '| DPR:', window.devicePixelRatio);
      this.setupShaders();
      this.setupGroundGrid();
      this.setupCenterpiece();
      this.setupScatteredCards();
      this.addEventListeners();
      this.animate();
      this.isInitialized = true;
      console.log('--- WebGLDistortEngine v2: Centrepiece + Scattered Cards initialized OK');
    } catch (e) {
      // Surface the FULL error (message + stack + which step failed) instead of
      // a generic line, so a blank-canvas report can be diagnosed from the
      // console alone without needing to reproduce it live.
      console.error('[WebGL] Initialization failed at runtime. Full error below:');
      console.error(e);
      console.error('[WebGL] Stack:', e && e.stack);
      document.body.classList.add('no-webgl');
    }

    // Independent watchdog: even if the try/catch above did NOT fire (no
    // exception thrown), confirm the renderer is actually producing a
    // non-trivial frame — a silent 0x0 or NaN-sized canvas won't throw but
    // will render nothing.
    requestAnimationFrame(() => {
      if (this.renderer) {
        const w = this.renderer.domElement.width;
        const h = this.renderer.domElement.height;
        if (!w || !h || Number.isNaN(w) || Number.isNaN(h)) {
          console.error('[WebGL] Renderer produced an invalid canvas size (' + w + 'x' + h + '). This causes a blank canvas with no thrown error. Check devicePixelRatio and container CSS width/height at this viewport.');
        } else {
          console.log('[WebGL] Post-first-frame check OK, canvas is ' + w + 'x' + h + 'px.');
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // THREE.js SETUP
  // ---------------------------------------------------------------------------

  initThree() {
    this.width  = window.innerWidth;
    this.height = window.innerHeight;

    this.fov    = 50;
    this.camera = new THREE.PerspectiveCamera(this.fov, this.width / this.height, 0.1, 8000);
    this.updateCameraPosition();

    this.scene = new THREE.Scene();

    // Whole-scene parent group for unified mouse parallax
    this.heroSceneGroup = new THREE.Group();
    this.scene.add(this.heroSceneGroup);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha:  true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setClearColor(0xF6EFA6, 1); // Pale Butter

    this.cardW = 285;
    this.cardH = 178;
    this.cardPlaneGeometry       = new THREE.PlaneGeometry(this.cardW, this.cardH, 2, 2);
    this.shadowPlaneGeometry     = new THREE.PlaneGeometry(this.cardW, this.cardH, 1, 1);
    this.hoverCardPlaneGeometry  = new THREE.PlaneGeometry(1, 1, 16, 16);

    this.textureLoader = new THREE.TextureLoader();
  }

  updateCameraPosition() {
    const z = this.height / (2 * Math.tan((this.fov * Math.PI) / 360));
    this.camera.position.set(0, 0, z);
    this.camera.aspect = this.width / Math.max(1, this.height);
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------------------
  // SHADERS
  // ---------------------------------------------------------------------------

  setupShaders() {
    // Scatter card vertex shader
    this.ringVertexShader = `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uScrollVelocity;
      uniform float uIndex;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(uv.x * 5.0 + uTime * 2.5 + uIndex) * (uScrollVelocity * 0.0015);
        pos.z += wave * 8.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    // Scatter card fragment shader -- no hover colour-shift, clean depth cue only
    this.ringFragmentShader = `
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float uScrollVelocity;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uDepth;

      void main() {
        vec2 planeSize = vec2(285.0, 178.0);
        vec2 p = (vUv - 0.5) * planeSize;
        vec2 b = planeSize * 0.5;
        vec2 d = abs(p) - b;
        float dist = max(d.x, d.y);
        if (dist > 0.0) discard;

        vec2 uv = vUv;
        float rawVel = uScrollVelocity * 0.0025;
        float wave = sin(uv.x * 8.0 + uTime * 3.0);
        uv.y += floor(wave * 4.0) / 4.0 * rawVel;

        float shift = floor(abs(uScrollVelocity) * 0.0022 * 320.0) / 320.0;
        float r    = texture2D(uTexture, uv + vec2(shift, 0.0)).r;
        float g    = texture2D(uTexture, uv).g;
        float bCol = texture2D(uTexture, uv - vec2(shift, 0.0)).b;
        vec4 color = vec4(r, g, bCol, 1.0);

        // Depth cue only (no hover tint)
        float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        color.rgb = mix(vec3(lum), color.rgb, 0.72 + 0.28 * uDepth);
        color.rgb *= (0.82 + 0.18 * uDepth);

        // 3.5px neo-brutalist border
        if (dist > -3.5) color.rgb = vec3(0.0);

        float edgeAA = 1.0 - smoothstep(-0.8, 0.0, dist);
        color.a = edgeAA * uOpacity;
        gl_FragColor = color;
      }
    `;

    // Shadow shader
    this.shadowVertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    this.shadowFragmentShader = `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform float uDepth;
      void main() {
        vec2 planeSize = vec2(285.0, 178.0);
        vec2 p = (vUv - 0.5) * planeSize;
        vec2 b = planeSize * 0.5;
        vec2 d = abs(p) - b;
        float dist = max(d.x, d.y);
        if (dist > 0.0) discard;
        float edgeAA = 1.0 - smoothstep(-0.8, 0.0, dist);
        gl_FragColor = vec4(0.0, 0.0, 0.0, edgeAA * (0.88 + 0.12 * uDepth) * uOpacity);
      }
    `;

    // Works-section full hover card shaders (unchanged)
    this.cardVertexShader = `
      varying vec2 vUv;
      varying float vWave;
      uniform float uTime;
      uniform float uScrollVelocity;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(uv.x * 7.0 + uTime * 2.5) * cos(uv.y * 5.0 + uTime * 2.0) * (uScrollVelocity * 0.002);
        pos.z += wave * 18.0;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;
    this.cardFragmentShader = `
      varying vec2 vUv;
      varying float vWave;
      uniform sampler2D uTexture;
      uniform float uScrollVelocity;
      uniform float uParallax;
      uniform float uTargetAspect;
      uniform float uSourceAspect;
      uniform float uHover;
      uniform float uOpacity;
      uniform float uTime;
      uniform vec2 uMouse;

      vec2 cover(vec2 uv) {
        vec2 r = uv;
        if (uTargetAspect > uSourceAspect) r.y = 0.5 + (uv.y - 0.5) * (uSourceAspect / uTargetAspect);
        else r.x = 0.5 + (uv.x - 0.5) * (uTargetAspect / uSourceAspect);
        return r;
      }

      void main() {
        vec2 correctedUv = (vUv * 2.0 - 1.0) * 0.92;
        correctedUv.y += (uParallax - 0.5) * 0.14;
        correctedUv = (correctedUv + 1.0) * 0.5;
        vec2 newUv = mix(vUv, correctedUv, 0.88);

        float rv = uScrollVelocity * 0.0075;
        newUv.y += sin(newUv.x * 9.0 + uTime * 2.0) * rv;

        if (uHover > 0.001) {
          vec2 mDelta = newUv - uMouse;
          float d = length(mDelta);
          float rp = sin(d * 20.0 - uTime * 5.0) * exp(-d * 5.0) * (0.025 * uHover);
          newUv += normalize(mDelta + 0.0001) * rp;
        }

        float rgb = (rv * 0.5) + (uHover * 0.005);
        float r = texture2D(uTexture, cover(newUv + vec2(rgb, 0.0))).r;
        float g = texture2D(uTexture, cover(newUv)).g;
        float b = texture2D(uTexture, cover(newUv - vec2(rgb, 0.0))).b;
        vec4 color = vec4(r, g, b, 1.0);
        color.rgb += vWave * 0.12;
        color.a   *= uOpacity;
        gl_FragColor = color;
      }
    `;
  }

  // ---------------------------------------------------------------------------
  // CENTREPIECE WIREFRAME (3D DSLR CAMERA: BODY <-> EXPLODED)
  // ---------------------------------------------------------------------------

  _createCameraPart(name, geo, bodyPos, explodedPos, bodyRot, explodedRot) {
    var edges = new THREE.EdgesGeometry(geo);
    var mat = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.82 * this._scatterOpacity
    });
    var line = new THREE.LineSegments(edges, mat);
    line.position.set(bodyPos[0], bodyPos[1], bodyPos[2]);
    if (bodyRot) {
      line.rotation.set(bodyRot[0], bodyRot[1], bodyRot[2]);
    }
    this.centerpieceGroup.add(line);
    var part = {
      name: name,
      mesh: line,
      geo: geo,
      edges: edges,
      bodyPos: { x: bodyPos[0], y: bodyPos[1], z: bodyPos[2] },
      explodedPos: { x: explodedPos[0], y: explodedPos[1], z: explodedPos[2] },
      bodyRot: bodyRot ? { x: bodyRot[0], y: bodyRot[1], z: bodyRot[2] } : { x: 0, y: 0, z: 0 },
      explodedRot: explodedRot ? { x: explodedRot[0], y: explodedRot[1], z: explodedRot[2] } : (bodyRot ? { x: bodyRot[0], y: bodyRot[1], z: bodyRot[2] } : { x: 0, y: 0, z: 0 })
    };
    this.cameraParts.push(part);
    return line;
  }

  // Viewport-width-aware centerpiece scale: ~40vw on mobile (dominant focal
  // object per the mobile gallery composition), desktop keeps its original
  // fixed presence untouched.
  _computeCenterpieceScale() {
    if (this.width >= 768) return 1.08;
    var targetVw = 0.40;
    var perspectiveFalloff = 0.80; // approx apparent-size factor at z=-220
    var baseWidth = 260; // approx world-unit bounding width of assembled camera
    var scale = (targetVw * this.width) / (baseWidth * perspectiveFalloff);
    // Clamp so very narrow (320px) or wider (430px+) phones stay in a sane range.
    return Math.max(0.55, Math.min(1.0, scale));
  }

  setupCenterpiece() {
    this.centerpieceGroup = new THREE.Group();
    this.centerpieceGroup.position.set(0, 0, -220);
    // Mobile target: ~40vw on screen. Camera sits at z=-220 with a perspective
    // falloff of ~0.80x at that depth, and the assembled camera's bounding
    // width is ~260 world units, so scale = (0.40 * viewportWidth) / (260 * 0.80).
    // This is now viewport-width-aware (via onResize) rather than a flat
    // constant, so it stays ~40vw across 320-430px, not just at one width.
    this.centerpieceGroup.scale.setScalar(this._computeCenterpieceScale());
    this.heroSceneGroup.add(this.centerpieceGroup);

    this.cameraParts = [];

    // 1. Camera Body Chassis (central anchor reference)
    var bodyGeo = new THREE.BoxGeometry(160, 100, 64);
    this._createCameraPart('body', bodyGeo, [-10, 0, 0], [-10, 0, 0]);

    // 2. Right Ergonomic Handgrip (detaches outward +X)
    var gripGeo = new THREE.BoxGeometry(42, 96, 78);
    this._createCameraPart('grip', gripGeo, [76, -2, 6], [118, -2, 6]);

    // 3. Pentaprism / Viewfinder Hump (lifts +Y)
    var pentaprismGeo = new THREE.BoxGeometry(60, 28, 54);
    this._createCameraPart('viewfinder', pentaprismGeo, [-10, 64, 0], [-10, 104, 0]);

    // 4. Hotshoe Flash Mount (lifts +Y above pentaprism)
    var hotshoeGeo = new THREE.BoxGeometry(22, 6, 24);
    this._createCameraPart('hotshoe', hotshoeGeo, [-10, 81, 0], [-10, 131, 0]);

    // 5. Rear Viewfinder Eyepiece (lifts +Y and moves -Z backward)
    var eyepieceGeo = new THREE.BoxGeometry(28, 18, 12);
    this._createCameraPart('eyepiece', eyepieceGeo, [-10, 64, -33], [-10, 104, -65]);

    // 6. Rear LCD Display Frame (detaches backward -Z)
    var lcdGeo = new THREE.BoxGeometry(86, 62, 4);
    this._createCameraPart('lcd', lcdGeo, [-22, -4, -34], [-22, -4, -72]);

    // 7. Lens Mount Flange (faces along Z axis, detaches forward +Z)
    var mountGeo = new THREE.CylinderGeometry(40, 40, 12, 24);
    mountGeo.rotateX(Math.PI / 2);
    this._createCameraPart('lens_mount', mountGeo, [-18, 0, 38], [-18, 0, 68]);

    // 8. Lens Barrel Stage 1 (Base / zoom barrel)
    var barrel1Geo = new THREE.CylinderGeometry(38, 38, 36, 24);
    barrel1Geo.rotateX(Math.PI / 2);
    this._createCameraPart('lens_barrel1', barrel1Geo, [-18, 0, 62], [-18, 0, 122]);

    // 9. Focus / Zoom Ring (Torus along Z axis)
    var ringGeo = new THREE.TorusGeometry(39, 3, 8, 28);
    this._createCameraPart('lens_ring', ringGeo, [-18, 0, 80], [-18, 0, 168]);

    // 10. Lens Barrel Stage 2 (Front barrel)
    var barrel2Geo = new THREE.CylinderGeometry(42, 38, 36, 24);
    barrel2Geo.rotateX(Math.PI / 2);
    this._createCameraPart('lens_barrel2', barrel2Geo, [-18, 0, 98], [-18, 0, 214]);

    // 11. Front Lens Rim / Filter Ring (Torus along Z axis)
    var rimGeo = new THREE.TorusGeometry(40, 2.5, 8, 28);
    this._createCameraPart('lens_rim', rimGeo, [-18, 0, 116], [-18, 0, 260]);

    // 12. Mode Dial (top left of camera body)
    var modeDialGeo = new THREE.CylinderGeometry(13, 13, 10, 16);
    this._createCameraPart('mode_dial', modeDialGeo, [-64, 55, -4], [-64, 88, -4]);

    // 13. Shutter Button (top of grip, moves with grip in +X and lifts +Y)
    var shutterGeo = new THREE.CylinderGeometry(7, 7, 8, 16);
    this._createCameraPart('shutter', shutterGeo, [74, 52, 20], [116, 78, 20]);

    console.log('--- Centrepiece: 3D DSLR Camera Wireframe model (' + this.cameraParts.length + ' parts) built');
  }

  morphCenterpiece(state) {
    if (state === this.geoState) return;
    this.geoState = state;
    var toExploded = (state === 'exploded');
    if (window.gsap) {
      this.cameraParts.forEach(function(part) {
        var targetPos = toExploded ? part.explodedPos : part.bodyPos;
        var targetRot = toExploded ? part.explodedRot : part.bodyRot;
        gsap.to(part.mesh.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: 0.95,
          ease: 'power2.inOut',
          overwrite: 'auto'
        });
        if (targetRot) {
          gsap.to(part.mesh.rotation, {
            x: targetRot.x,
            y: targetRot.y,
            z: targetRot.z,
            duration: 0.95,
            ease: 'power2.inOut',
            overwrite: 'auto'
          });
        }
      });
    } else {
      this.cameraParts.forEach(function(part) {
        var targetPos = toExploded ? part.explodedPos : part.bodyPos;
        var targetRot = toExploded ? part.explodedRot : part.bodyRot;
        part.mesh.position.set(targetPos.x, targetPos.y, targetPos.z);
        if (targetRot) {
          part.mesh.rotation.set(targetRot.x, targetRot.y, targetRot.z);
        }
      });
    }
  }

  updateSceneParallax() {
    if (!this.heroSceneGroup) return;
    // Smooth weighted camera response (lerp ~0.06 damping factor per frame, not jittery)
    var damping = 0.06;
    this.mousePos.x += (this.targetMouse.x - this.mousePos.x) * damping;
    this.mousePos.y += (this.targetMouse.y - this.mousePos.y) * damping;

    // Rotate and offset entire scene group
    this.heroSceneGroup.rotation.y = this.mousePos.x * 0.08;
    this.heroSceneGroup.rotation.x = -this.mousePos.y * 0.05;
    this.heroSceneGroup.position.x = this.mousePos.x * 20;
    this.heroSceneGroup.position.y = this.mousePos.y * 14;
  }

  updateCenterpieceRotation() {
    if (this.isPaused || !this.centerpieceGroup) return;
    // ~50s on Y axis, ~65s on X axis (both slow, independent)
    this.centerpieceRotY += (Math.PI * 2) / (50 * 60);
    this.centerpieceRotX += (Math.PI * 2) / (65 * 60);
    this.centerpieceGroup.rotation.y = this.centerpieceRotY;
    this.centerpieceGroup.rotation.x = this.centerpieceRotX;
  }

  // ---------------------------------------------------------------------------
  // GROUND GRID
  // ---------------------------------------------------------------------------

  setupGroundGrid() {
    var GRID_SIZE = 5200;
    var SPACING   = 240;
    var STEPS = Math.floor(GRID_SIZE / SPACING);
    var positions = [];
    var half = GRID_SIZE / 2;
    for (var i = -STEPS; i <= STEPS; i++) {
      var t = i * SPACING;
      positions.push(-half, t, 0,  half, t, 0);
      positions.push(t, -half, 0,  t, half, 0);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    // Mobile: slightly stronger opacity so the perspective floor actually
    // reads as a deliberate gallery-floor element at smaller viewport sizes,
    // not just a barely-visible desktop leftover.
    var gridOpacity = (window.innerWidth < 768) ? 0.16 : 0.10;
    var mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: gridOpacity });
    var grid = new THREE.LineSegments(geo, mat);
    grid.rotation.x = Math.PI / 2;
    grid.position.set(0, -380, -140);
    this.heroSceneGroup.add(grid);
    this.groundGrid = grid;
  }

  // ---------------------------------------------------------------------------
  // SCATTERED CARDS
  // ---------------------------------------------------------------------------

  _desktopPlacements() {
    // 1440px reference. Cards spread wide so none overlap.
    // Centre zone +-260 x / +-220 y reserved for centrepiece (scale 0.72 of 480 world units = ~346px).
    return [
      { x: -680, y:  290, z: -22, tiltY:  0.16, tiltX: -0.05 },  // 0 top-left outer
      { x: -490, y:  390, z:   8, tiltY:  0.10, tiltX: -0.08 },  // 1 top-left inner
      { x: -800, y:   40, z: -44, tiltY:  0.20, tiltX:  0.04 },  // 2 mid-left far
      { x: -620, y: -270, z: -14, tiltY:  0.14, tiltX:  0.06 },  // 3 bot-left outer
      { x: -480, y: -130, z:   6, tiltY:  0.08, tiltX:  0.03 },  // 4 bot-left inner
      { x:  680, y:  300, z: -28, tiltY: -0.16, tiltX: -0.06 },  // 5 top-right outer
      { x:  490, y:  390, z:  14, tiltY: -0.12, tiltX: -0.09 },  // 6 top-right inner
      { x:  810, y:   40, z: -48, tiltY: -0.20, tiltX:  0.05 },  // 7 mid-right far
      { x:  620, y: -250, z:  -9, tiltY: -0.14, tiltX:  0.07 },  // 8 bot-right outer
      { x:  480, y: -110, z:  16, tiltY: -0.08, tiltX:  0.02 },  // 9 bot-right inner
      { x: -240, y: -400, z: -26, tiltY:  0.06, tiltX:  0.12 },  // 10 bottom-left
      { x:    0, y: -430, z: -36, tiltY:  0.00, tiltX:  0.11 },  // 11 bottom-centre
      { x:  260, y: -400, z:   4, tiltY: -0.06, tiltX:  0.09 }   // 12 bottom-right
    ];
  }

  // Mobile "gallery" layout (390px reference). 8 cards in vertical pairs
  // along the left/right edges, well clear of the enlarged centerpiece
  // (~40vw, half-width ~80px at reference scale). Stronger tiltY/tiltX than
  // the old flat mobile layout for a real perspective/gallery feel.
  _mobilePlacements() {
    return [
      // Left side — outer column (further from center, slightly further back)
      { x: -165, y:  245, z: -30, tiltY:  0.30, tiltX: -0.12 },
      { x: -150, y:  -20, z: -34, tiltY:  0.27, tiltX:  0.05 },
      { x: -160, y: -255, z: -28, tiltY:  0.32, tiltX:  0.14 },
      // Left side — inner column (closer to center, slightly forward)
      { x: -118, y:  110, z: -12, tiltY:  0.20, tiltX: -0.06 },
      // Right side — outer column
      { x:  165, y:  245, z: -30, tiltY: -0.30, tiltX: -0.12 },
      { x:  150, y:  -20, z: -34, tiltY: -0.27, tiltX:  0.05 },
      { x:  160, y: -255, z: -28, tiltY: -0.32, tiltX:  0.14 },
      // Right side — inner column
      { x:  118, y:  110, z: -12, tiltY: -0.20, tiltX: -0.06 }
    ];
  }

  _getActivePlacements() {
    var isMobile   = this.width < 768;
    var placements = isMobile ? this._mobilePlacements() : this._desktopPlacements();
    var refWidth   = isMobile ? 390 : 1440;
    var coordScale = this.width / refWidth;
    var cardScale  = isMobile ? coordScale * 0.34 : coordScale;
    return { placements: placements, coordScale: coordScale, cardScale: cardScale, scale: cardScale, isMobile: isMobile };
  }

  setupScatteredCards() {
    this.scatterGroup = new THREE.Group();
    this.heroSceneGroup.add(this.scatterGroup);

    var projects = [
      { id: '01', title: 'AETHERIA OS',           tag: 'NEOBRUTALISM // SPATIAL',       src: 'assets/images/thumbs/thumb-11.jpeg' },
      { id: '02', title: 'SWISS KINETIC',          tag: 'SWISS STYLE // TELEMETRY',      src: 'assets/images/thumbs/thumb-12.jpeg' },
      { id: '03', title: 'BAUHAUS COMPOSITION',    tag: 'BAUHAUS // VARIABLE TYPE',      src: 'assets/images/thumbs/thumb-2.jpeg'  },
      { id: '04', title: 'BRUTALIST ARCHITECTURE', tag: 'BRUTALIST ARCHITECTURE',        src: 'assets/images/thumbs/thumb-3.jpeg'  },
      { id: '05', title: 'VAPORWAVE GRID',         tag: 'RETRO-GRID // CONTINENTAL OS',  src: 'assets/images/thumbs/thumb-13.jpeg' },
      { id: '06', title: 'GEOMETRIC QUANTUM',      tag: 'GEOMETRIC // QUANTUM HUD',      src: 'assets/images/thumbs/thumb-6.jpeg'  },
      { id: '07', title: 'FLUID KALEIDOSCOPE',     tag: 'FLUID DYNAMICS // ACOUSTICS',   src: 'assets/images/thumbs/thumb-8.jpeg'  },
      { id: '08', title: 'CORPORATE VECTOR',       tag: 'VECTOR ROBOTICS',               src: 'assets/images/thumbs/thumb-4.jpeg'  },
      { id: '09', title: 'MEMPHIS DESIGN',         tag: 'MEMPHIS DESIGN // COMPUTATION', src: 'assets/images/thumbs/thumb-9.jpeg'  },
      { id: '10', title: 'MINIMALIST SWISS',       tag: 'MINIMALIST // BIO-SIGNAL',      src: 'assets/images/thumbs/thumb-10.jpeg' },
      { id: '11', title: 'DE STIJL OPTICS',        tag: 'DE STIJL // OPTICS',            src: 'assets/images/thumbs/thumb-5.jpeg'  },
      { id: '12', title: 'FLOATING SPHERE',        tag: 'MINIMAL SPHERICAL // CRYPTO',   src: 'assets/images/thumbs/thumb-7.jpeg'  },
      { id: '13', title: 'BOTANICAL GRID',         tag: 'BOTANICAL // GENERATIVE',       src: 'assets/images/thumbs/thumb-1.jpeg'  }
    ];
    this.scatterProjects = projects;

    var act = this._getActivePlacements();
    var placements   = act.placements;
    var visibleCount = placements.length;
    var self = this;

    for (var i = 0; i < projects.length; i++) {
      var pData     = projects[i];
      var isVisible = i < visibleCount;
      var pl        = isVisible ? placements[i] : placements[0];

      var shadowUniforms = { uOpacity: { value: 0.0 }, uDepth: { value: 0.5 } };
      var shadowMat = new THREE.ShaderMaterial({
        vertexShader:   this.shadowVertexShader,
        fragmentShader: this.shadowFragmentShader,
        uniforms:       shadowUniforms,
        transparent:    true,
        blending:       THREE.NormalBlending,
        depthWrite:     false,
        depthTest:      true
      });
      var shadowMesh = new THREE.Mesh(this.shadowPlaneGeometry, shadowMat);
      shadowMesh.renderOrder = i * 2;
      shadowMesh.visible     = isVisible;
      this.scatterGroup.add(shadowMesh);

      var cardUniforms = {
        uTexture:        { value: null },
        uScrollVelocity: { value: 0    },
        uOpacity:        { value: 0.0  },
        uTime:           { value: 0    },
        uIndex:          { value: i    },
        uDepth:          { value: 0.5  }
      };
      var cardMat = new THREE.ShaderMaterial({
        vertexShader:   this.ringVertexShader,
        fragmentShader: this.ringFragmentShader,
        uniforms:       cardUniforms,
        transparent:    true,
        blending:       THREE.NormalBlending,
        depthWrite:     false,
        depthTest:      true
      });
      var mesh = new THREE.Mesh(this.cardPlaneGeometry, cardMat);
      mesh.renderOrder = i * 2 + 1;
      mesh.visible     = isVisible;
      this.scatterGroup.add(mesh);

      var item = {
        index: i,
        id:    pData.id,
        title: pData.title,
        tag:   pData.tag,
        src:   pData.src,
        mesh:  mesh,
        material:       cardMat,
        uniforms:       cardUniforms,
        shadowMesh:     shadowMesh,
        shadowMaterial: shadowMat,
        shadowUniforms: shadowUniforms,
        baseX:    pl.x,
        baseY:    pl.y,
        baseZ:    pl.z,
        baseTiltY: pl.tiltY,
        baseTiltX: pl.tiltX,
        hoverProgress: 0.0,
        targetHover:   0.0,
        isVisible:     isVisible
      };

      (function(src, uniforms) {
        self.textureLoader.load(src,
          function(texture) {
            texture.generateMipmaps = false;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.needsUpdate = true;
            uniforms.uTexture.value = texture;
          },
          undefined,
          function(err) { console.error('[WebGL] Texture load failed: ' + src, err); }
        );
      })(pData.src, cardUniforms);

      this.scatterItems.push(item);
    }

    this.updateScatterPositions();
    console.log('--- ' + visibleCount + ' scatter cards positioned (' + (act.isMobile ? 'mobile' : 'desktop') + ' layout, scale=' + act.scale.toFixed(2) + ')');
  }

  calculateScatterLayout() {
    var act          = this._getActivePlacements();
    var placements   = act.placements;
    var visibleCount = placements.length;

    this.scatterItems.forEach(function(item, i) {
      var isVisible = i < visibleCount;
      var pl = isVisible ? placements[i] : placements[0];
      item.baseX    = pl.x;
      item.baseY    = pl.y;
      item.baseZ    = pl.z;
      item.baseTiltY = pl.tiltY;
      item.baseTiltX = pl.tiltX;
      item.isVisible = isVisible;
      item.mesh.visible       = isVisible;
      item.shadowMesh.visible = isVisible;
    });
  }

  updateScatterPositions() {
    if (!this.scatterItems.length) return;
    var act = this._getActivePlacements();
    var coordScale = act.coordScale;
    var cardScale  = act.cardScale;
    var self  = this;

    this.scatterItems.forEach(function(item, idx) {
      if (!item.isVisible) return;

      // Smooth hover interpolation (~0.22)
      item.hoverProgress += (item.targetHover - item.hoverProgress) * 0.22;
      if (item.hoverProgress < 0.001) item.hoverProgress = 0.0;
      if (item.hoverProgress > 0.999) item.hoverProgress = 1.0;

      var bx = item.baseX * coordScale;
      var by = item.baseY * coordScale;
      var bz = item.baseZ;

      var floatDamp = 1.0 - item.hoverProgress;
      var floatY  = Math.sin(self.time * 1.4 + idx * 0.88) * 7.0 * floatDamp;
      var floatX  = Math.cos(self.time * 1.1 + idx * 0.63) * 5.0 * floatDamp;
      var floatRot = Math.sin(self.time * 1.3 + idx * 0.72) * 0.03 * floatDamp;

      var x = bx + floatX;
      var y = by + floatY;

      var depthNorm = Math.max(0.05, Math.min(1.0, (bz + 80.0) / 130.0));

      // Hover: scale ~1.07x, lift +30 Z
      var hoverScale  = 1.0 + item.hoverProgress * 0.07;
      var perspScale  = (0.90 + 0.12 * depthNorm) * hoverScale * cardScale;
      var z = bz + item.hoverProgress * 30.0;

      item.mesh.position.set(x, y, z);
      item.mesh.scale.set(perspScale, perspScale, 1.0);

      var tiltY = item.baseTiltY + floatRot;
      var tiltX = item.baseTiltX;
      var tiltZ = floatRot * 0.5;
      item.mesh.rotation.set(tiltX, tiltY, tiltZ);

      // Shadow: rotated offset + hover lift
      var shadowLift = 1.0 + item.hoverProgress * 0.45;
      var rawSX = 8.0 * perspScale * shadowLift;
      var rawSY = -9.0 * perspScale * shadowLift;
      var rawSZ = -3.0 - item.hoverProgress * 2.5;

      var cx = Math.cos(tiltX), sx = Math.sin(tiltX);
      var cy = Math.cos(tiltY), sy = Math.sin(tiltY);
      var cz = Math.cos(tiltZ), sz = Math.sin(tiltZ);
      var rzx = rawSX * cz - rawSY * sz;
      var rzy = rawSX * sz + rawSY * cz;
      var rzz = rawSZ;
      var ryx =  rzx * cy + rzz * sy;
      var ryy =  rzy;
      var ryz = -rzx * sy + rzz * cy;

      item.shadowMesh.position.set(x + ryx, y + (ryy * cx - ryz * sx), z + (ryy * sx + ryz * cx));
      item.shadowMesh.rotation.set(tiltX, tiltY, tiltZ);
      item.shadowMesh.scale.set(perspScale, perspScale, 1.0);

      var rOp = self._scatterOpacity * (self._heroScrollOpacity !== undefined ? self._heroScrollOpacity : 1.0);
      item.uniforms.uOpacity.value        = rOp;
      item.uniforms.uDepth.value          = depthNorm;
      item.uniforms.uTime.value           = self.time;
      item.uniforms.uScrollVelocity.value = self.scrollVelocity;
      item.shadowUniforms.uOpacity.value  = rOp * 0.85;
      item.shadowUniforms.uDepth.value    = depthNorm;
    });
  }

  // ---------------------------------------------------------------------------
  // OPACITY / FADE IN
  // ---------------------------------------------------------------------------

  get ringOpacity()    { return this._scatterOpacity; }
  set ringOpacity(val) { this.setRingOpacity(val);    }

  setRingOpacity(val) {
    this._scatterOpacity = Math.max(0, Math.min(1, val));
    var op = this._scatterOpacity;
    var camOp = 0.82 * op * (this._heroScrollOpacity !== undefined ? this._heroScrollOpacity : 1.0);
    if (this.cameraParts) {
      this.cameraParts.forEach(function(part) {
        if (part.mesh && part.mesh.material) part.mesh.material.opacity = camOp;
      });
    }
  }

  // Called by ScrollTrigger to fade hero cards + centrepiece as page scrolls into WORKS.
  // progress: 0 = fully visible (hero on screen), 1 = fully hidden (scrolled away).
  setHeroVisibility(progress) {
    var op = Math.max(0, 1.0 - progress);
    this._heroScrollOpacity = op;
    // Hide the entire hero scene group when fully scrolled away
    if (this.heroSceneGroup) this.heroSceneGroup.visible = op > 0.005;
    // Scale scatter card opacity with scroll
    var targetOp = this._scatterOpacity * op;
    this.scatterItems.forEach(function(item) {
      item.uniforms.uOpacity.value       = targetOp;
      item.shadowUniforms.uOpacity.value = targetOp * 0.85;
    });
    if (this.cameraParts) {
      var camOp = 0.82 * targetOp;
      this.cameraParts.forEach(function(part) {
        if (part.mesh && part.mesh.material) part.mesh.material.opacity = camOp;
      });
    }
  }

  fadeHeroObjectsIn(duration, delay) {
    duration = duration || 1.4;
    delay    = delay    || 0;
    var self = this;
    this._heroScrollOpacity = 1.0;
    if (typeof gsap !== 'undefined') {
      var proxy = { opacity: 0 };
      gsap.to(proxy, {
        opacity: 1.0, duration: duration, delay: delay, ease: 'power2.out',
        onUpdate: function() { self.setRingOpacity(proxy.opacity); }
      });
    } else {
      this.setRingOpacity(1.0);
    }
  }

  // No-op: spiral has been removed
  setSpiralProgress(_p) {}

  // ---------------------------------------------------------------------------
  // WORKS SECTION CARDS
  // ---------------------------------------------------------------------------

  register(element, imageSrc) {
    if (!this.isInitialized) return;
    var uniforms = {
      uTexture:        { value: null },
      uScrollVelocity: { value: 0    },
      uParallax:       { value: 0.5  },
      uTargetAspect:   { value: 1.0  },
      uSourceAspect:   { value: 1.777 },
      uHover:          { value: 0.0  },
      uOpacity:        { value: 0.0  },
      uTime:           { value: 0.0  },
      uMouse:          { value: new THREE.Vector2(0.5, 0.5) }
    };
    var material = new THREE.ShaderMaterial({
      vertexShader: this.cardVertexShader, fragmentShader: this.cardFragmentShader,
      uniforms: uniforms, transparent: true
    });
    var mesh = new THREE.Mesh(this.hoverCardPlaneGeometry, material);
    mesh.visible = false;
    this.scene.add(mesh);

    var item = {
      element: element, src: imageSrc, mesh: mesh, material: material, uniforms: uniforms,
      isLoaded: false, targetHover: 0, currentHover: 0,
      targetOpacity: 1, currentOpacity: 0,
      mouse: new THREE.Vector2(0.5, 0.5)
    };

    this.textureLoader.load(imageSrc, function(texture) {
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      uniforms.uTexture.value = texture;
      var img = texture.image;
      if (img && img.width && img.height) uniforms.uSourceAspect.value = img.width / img.height;
      item.isLoaded = true;
    });

    element.addEventListener('mouseenter', function() { item.targetHover = 1.0; });
    element.addEventListener('mouseleave', function() { item.targetHover = 0.0; });
    element.addEventListener('mousemove', function(e) {
      var rect = element.getBoundingClientRect();
      item.mouse.set((e.clientX - rect.left) / rect.width, 1.0 - (e.clientY - rect.top) / rect.height);
    });

    this.items.set(element, item);
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  updateVelocity(vel) { this.targetVelocity = vel; }

  onResize() {
    if (!this.isInitialized) return;
    this.width  = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    this.updateCameraPosition();
    if (this.centerpieceGroup) { this.centerpieceGroup.scale.setScalar(this._computeCenterpieceScale()); }
    this.calculateScatterLayout();
    this.updateScatterPositions();
  }

  pauseRotation()  { this.isPaused = true;  }
  resumeRotation() { this.isPaused = false; }

  getCardScreenRect(item) {
    if (!item || !item.mesh) return null;
    var center = item.mesh.getWorldPosition(new THREE.Vector3());
    center.project(this.camera);
    var cx = (center.x * 0.5 + 0.5) * this.width;
    var cy = (-center.y * 0.5 + 0.5) * this.height;
    var cardW = this.cardW * item.mesh.scale.x;
    var cardH = this.cardH * item.mesh.scale.y;
    return { left: cx - cardW * 0.5, top: cy - cardH * 0.5, width: cardW, height: cardH };
  }

  handleCardTap(clientX, clientY) {
    if (this._scatterOpacity <= 0.08) return;
    var ndcX =  (clientX / this.width)  * 2 - 1;
    var ndcY = -(clientY / this.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    var meshes = this.scatterItems.filter(function(it) { return it.isVisible; }).map(function(it) { return it.mesh; });
    var intersects = this.raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      var hitMesh = intersects[0].object;
      var item = null;
      for (var k = 0; k < this.scatterItems.length; k++) {
        if (this.scatterItems[k].mesh === hitMesh) { item = this.scatterItems[k]; break; }
      }
      if (item) {
        var screenRect = this.getCardScreenRect(item);
        window.dispatchEvent(new CustomEvent('ring-card-click', { detail: { item: item, screenRect: screenRect } }));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // EVENT LISTENERS
  // ---------------------------------------------------------------------------

  addEventListeners() {
    var self = this;
    window.addEventListener('resize', function() { self.onResize(); });

    window.addEventListener('pointermove', function(e) {
      self.lastClientX = e.clientX;
      self.lastClientY = e.clientY;
      self.targetMouse.x =  (e.clientX / self.width)  * 2 - 1;
      self.targetMouse.y = -(e.clientY / self.height) * 2 + 1;
      self.pointerNDC.x  = self.targetMouse.x;
      self.pointerNDC.y  = self.targetMouse.y;
    }, { passive: true });

    window.addEventListener('pointerleave', function() {
      self.pointerNDC.set(-999, -999);
      self.hoveredItem = null;
    });

    window.addEventListener('pointerdown', function(e) {
      self.touchStart  = { x: e.clientX, y: e.clientY, time: performance.now() };
      self.lastClientX = e.clientX;
      self.lastClientY = e.clientY;
      self.pointerNDC.x =  (e.clientX / self.width)  * 2 - 1;
      self.pointerNDC.y = -(e.clientY / self.height) * 2 + 1;
    });

    window.addEventListener('pointerup', function(e) {
      if (!self.touchStart) return;
      var dx = e.clientX - self.touchStart.x;
      var dy = e.clientY - self.touchStart.y;
      var dt = performance.now() - self.touchStart.time;
      self.touchStart = null;
      if (Math.sqrt(dx * dx + dy * dy) <= 10 && dt <= 300) self.handleCardTap(e.clientX, e.clientY);
    });
  }

  // ---------------------------------------------------------------------------
  // RAYCASTING + BADGE (every RAF frame)
  // ---------------------------------------------------------------------------

  updateRaycastingAndBadge() {
    var badge    = document.getElementById('ring-card-badge');
    var rcbTitle = document.getElementById('rcb-title');
    var rcbTag   = document.getElementById('rcb-tag');
    var cursor   = document.getElementById('app-cursor');

    var canInteract = this._scatterOpacity > 0.08;
    var intersectedItem = null;

    if (canInteract && this.pointerNDC.x !== -999) {
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);
      var meshes = this.scatterItems.filter(function(it) { return it.isVisible; }).map(function(it) { return it.mesh; });
      var intersects = this.raycaster.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        var hitMesh = intersects[0].object;
        for (var k = 0; k < this.scatterItems.length; k++) {
          if (this.scatterItems[k].mesh === hitMesh) { intersectedItem = this.scatterItems[k]; break; }
        }
      }
    }

    this.hoveredItem = intersectedItem;
    var self = this;
    this.scatterItems.forEach(function(item) {
      item.targetHover = (item === intersectedItem) ? 1.0 : 0.0;
    });

    if (cursor) {
      if (intersectedItem) {
        cursor.classList.add('cursor-hover');
      } else {
        var el = document.elementFromPoint(this.lastClientX || 0, this.lastClientY || 0);
        if (!el || !el.matches('a, button, input, .project-card, .filter-btn')) {
          cursor.classList.remove('cursor-hover');
        }
      }
    }

    if (badge && rcbTitle && rcbTag) {
      if (intersectedItem) {
        if (rcbTitle.textContent !== intersectedItem.title) {
          rcbTitle.textContent = intersectedItem.title;
          rcbTag.textContent   = intersectedItem.tag;
        }
        var cardPos  = intersectedItem.mesh.getWorldPosition(new THREE.Vector3());
        var localBot = new THREE.Vector3(0, -96 * intersectedItem.mesh.scale.y, 8);
        localBot.applyEuler(intersectedItem.mesh.rotation);
        cardPos.add(localBot);
        cardPos.project(this.camera);
        badge.style.left = ((cardPos.x * 0.5 + 0.5) * this.width)  + 'px';
        badge.style.top  = ((-cardPos.y * 0.5 + 0.5) * this.height) + 'px';
        badge.classList.add('visible');
      } else {
        badge.classList.remove('visible');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // ANIMATION LOOP
  // ---------------------------------------------------------------------------

  animate() {
    var self = this;
    requestAnimationFrame(function() { self.animate(); });

    var now = performance.now();
    this.time = now * 0.001;

    this.frameCount++;
    if (now - this.lastFpsTime >= 1000) {
      this.currentFps  = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount  = 0;
      this.lastFpsTime = now;
    }

    this.scrollVelocity += (this.targetVelocity - this.scrollVelocity) * 0.12;
    this.targetVelocity  *= 0.92;

    this.updateSceneParallax();
    this.updateCenterpieceRotation();
    this.updateScatterPositions();
    this.updateRaycastingAndBadge();

    // Works-section hover cards
    var halfW = this.width  * 0.5;
    var halfH = this.height * 0.5;
    for (var entry of this.items) {
      var element = entry[0], item = entry[1];
      if (!item.isLoaded) continue;
      var rect = element.getBoundingClientRect();
      var inView = rect.bottom > -100 && rect.top < this.height + 100 && rect.width > 0 && rect.height > 0;
      if (!inView) { item.mesh.visible = false; continue; }
      item.mesh.visible = true;
      var cx = rect.left + rect.width  * 0.5;
      var cy = rect.top  + rect.height * 0.5;
      item.mesh.position.set(cx - halfW, -(cy - halfH), 0);
      item.mesh.scale.set(rect.width, rect.height, 1);
      item.currentHover   += (item.targetHover   - item.currentHover)   * 0.1;
      item.currentOpacity += (item.targetOpacity - item.currentOpacity) * 0.08;
      var u = item.uniforms;
      u.uTime.value           = this.time;
      u.uScrollVelocity.value = this.scrollVelocity;
      u.uHover.value          = item.currentHover;
      u.uOpacity.value        = item.currentOpacity;
      u.uMouse.value.copy(item.mouse);
      u.uTargetAspect.value   = rect.width / Math.max(1, rect.height);
      u.uParallax.value       = Math.max(0, Math.min(1, cy / this.height));
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.WebGLDistortEngine = WebGLDistortEngine;
