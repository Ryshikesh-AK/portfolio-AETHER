// Gallery centerpiece: a small wireframe "camera" object with a perspective
// floor grid, shown only on mobile (<=768px, matched via CSS + matchMedia
// here). Fully separate from scripts/webgl-distort.js — no shared code,
// no shared globals, nothing on window.webglEngine.
(function () {
  'use strict';
  if (typeof THREE === 'undefined') return;   // vendor/three.min.js failed to load: fail quiet, grid still works

  const mq = window.matchMedia('(max-width: 768px)');
  const canvas = document.getElementById('centerpiece-canvas');
  const stage = document.querySelector('.centerpiece-stage');
  if (!canvas || !stage) return;

  let renderer, scene, camera, rig, raf, ro;
  let running = false;
  const clock = new THREE.Clock();

  function buildRig() {
    const group = new THREE.Group();
    const lineColor = 0x000000;
    const accent = 0xc8ff00;

    // Body: a boxy camera block, wireframe only (edges, so the render stays crisp and cheap).
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.05, 0.9));
    const bodyEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: lineColor })
    );
    group.add(bodyEdges);

    // Lens barrel, offset toward the front (+Z).
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.7, 20, 1, true));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.75;
    const lensWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(lens.geometry),
      new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.85 })
    );
    lensWire.rotation.copy(lens.rotation);
    lensWire.position.copy(lens.position);
    group.add(lensWire);

    // Front lens ring accent.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 28));
    ring.position.z = 1.1;
    const ringWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(ring.geometry),
      new THREE.LineBasicMaterial({ color: accent })
    );
    ringWire.position.copy(ring.position);
    group.add(ringWire);

    // Viewfinder bump on top.
    const finder = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.32));
    finder.position.set(-0.15, 0.66, -0.05);
    const finderEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(finder.geometry),
      new THREE.LineBasicMaterial({ color: lineColor })
    );
    finderEdges.position.copy(finder.position);
    group.add(finderEdges);

    // Two small dials on top of the body.
    [-0.5, 0.45].forEach((x) => {
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 14));
      dial.position.set(x, 0.58, -0.15);
      const wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(dial.geometry),
        new THREE.LineBasicMaterial({ color: lineColor })
      );
      wire.position.copy(dial.position);
      group.add(wire);
    });

    return group;
  }

  function buildFloor() {
    const grid = new THREE.GridHelper(10, 20, 0x000000, 0x000000);
    grid.material.transparent = true;
    grid.material.opacity = 0.08;
    grid.position.y = -1.15;
    return grid;
  }

  function init() {
    if (running) return;
    try {
      // preserveDrawingBuffer: without it the browser may clear the backbuffer right after
      // compositing, which is fine visually (we redraw every frame) but makes the canvas read
      // back as blank to anything (screenshots, tests) that samples it between frames.
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    } catch (e) { return; }   // no WebGL: skip the centerpiece, layout still works without it
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 0.9, 4.4);
    camera.lookAt(0, -0.1, 0);

    rig = buildRig();
    scene.add(rig);
    scene.add(buildFloor());

    resize();
    ro = new ResizeObserver(resize);
    ro.observe(stage);

    running = true;
    clock.start();
    tick();
  }

  function resize() {
    if (!renderer) return;
    const w = stage.clientWidth || 1;
    const h = stage.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function tick() {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const t = clock.getElapsedTime();
    // Floating bob + slow continuous turn: enough motion to read as "alive", not distracting.
    rig.position.y = Math.sin(t * 0.9) * 0.12;
    rig.rotation.y = t * 0.35;
    rig.rotation.x = Math.sin(t * 0.6) * 0.06;
    renderer.render(scene, camera);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function sync() {
    if (mq.matches && document.visibilityState === 'visible') init();
    else stop();
  }

  mq.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  sync();
})();
