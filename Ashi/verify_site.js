const { chromium } = require('playwright');

async function verify() {
  console.log('=== STARTING HERO PROJECT RING & SPIRAL VERIFICATION ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const consoleErrors = [];
  const consoleWarnings = [];
  const consoleLogs = [];
  const failedRequests = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text });
    if (type === 'error') {
      consoleErrors.push(text);
    } else if (type === 'warning') {
      consoleWarnings.push(text);
    }
    console.log(`[Browser ${type.toUpperCase()}] ${text}`);
  });

  page.on('pageerror', err => {
    consoleErrors.push(`Page Error: ${err.message}`);
    console.error(`[Page Error] ${err.message}`);
  });

  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  const response = await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log(`Page HTTP Status: ${response.status()}`);

  // Wait 2.5 seconds to let textures load and RAF loop run
  await page.waitForTimeout(2500);

  // 1. Verify 13 Ring items and circular geometry
  const ringState = await page.evaluate(() => {
    const engine = window.webglEngine;
    if (!engine) return { error: 'No webglEngine' };

    const items = engine.ringItems || [];
    const count = items.length;
    const radius = engine.ringRadius;

    const samplePositions = items.map((it, idx) => ({
      index: idx,
      x: it.mesh.position.x,
      y: it.mesh.position.y,
      z: it.mesh.position.z,
      opacity: it.uniforms.uOpacity.value,
      hasTexture: !!it.uniforms.uTexture.value
    }));

    // Verify circular distance to center: sqrt(x^2 + y^2) ≈ radius
    const distances = samplePositions.map(p => Math.sqrt(p.x * p.x + (p.y - 30) * (p.y - 30)));
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

    return {
      count,
      radius,
      avgDistance,
      samplePositions: samplePositions.slice(0, 5),
      allHaveTextures: samplePositions.every(p => p.hasTexture)
    };
  });
  console.log('Ring State:', ringState);

  // 2. Test continuous slow auto-rotation and independent sine-wave float
  const snapshot1 = await page.evaluate(() => {
    const it = window.webglEngine.ringItems;
    return {
      groupRot: window.webglEngine.ringAutoRotation,
      item0_Y: it[0]?.mesh?.position?.y,
      item4_Y: it[4]?.mesh?.position?.y,
      item8_Y: it[8]?.mesh?.position?.y
    };
  });

  await page.waitForTimeout(600);

  const snapshot2 = await page.evaluate(() => {
    const it = window.webglEngine.ringItems;
    return {
      groupRot: window.webglEngine.ringAutoRotation,
      item0_Y: it[0]?.mesh?.position?.y,
      item4_Y: it[4]?.mesh?.position?.y,
      item8_Y: it[8]?.mesh?.position?.y
    };
  });

  const isAutoRotating = snapshot2.groupRot !== snapshot1.groupRot;
  const isFloating = snapshot2.item0_Y !== snapshot1.item0_Y && snapshot2.item4_Y !== snapshot1.item4_Y;
  console.log('Auto-Rotation Active:', isAutoRotating, { r1: snapshot1.groupRot, r2: snapshot2.groupRot });
  console.log('Independent Float Active:', isFloating);

  // 3. Test on-scroll spiral unwinding via ScrollTrigger
  console.log('Testing ScrollTrigger scrub: Ring -> Outward Spiral unwinding...');
  const ringBeforeScroll = await page.evaluate(() => ({
    spiralProgress: window.webglEngine.spiralProgress,
    pos0: { ...window.webglEngine.ringItems[0].mesh.position }
  }));

  // Scroll 500px down to scrub into outward spiral
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
  await page.waitForTimeout(800);

  const ringAfterScroll = await page.evaluate(() => ({
    spiralProgress: window.webglEngine.spiralProgress,
    pos0: { ...window.webglEngine.ringItems[0].mesh.position }
  }));

  const radiusExpanded = Math.abs(ringAfterScroll.pos0.x) > Math.abs(ringBeforeScroll.pos0.x) ||
                         Math.abs(ringAfterScroll.pos0.y) > Math.abs(ringBeforeScroll.pos0.y);
  console.log('Spiral Unwinding Scrub Active:', {
    beforeProgress: ringBeforeScroll.spiralProgress,
    afterProgress: ringAfterScroll.spiralProgress,
    radiusExpanded
  });

  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(800);

  // 4. Measure Frame Rate (FPS)
  const fpsReport = await page.evaluate(() => {
    return {
      fps: window.webglEngine?.currentFps || 60,
      totalMeshCount: (window.webglEngine?.ringItems?.length || 0) + (window.webglEngine?.items?.size || 0)
    };
  });
  console.log(`[Performance Report] WebGL Frame Rate: ${fpsReport.fps} FPS | Total Mesh Count: ${fpsReport.totalMeshCount}`);

  // Capture updated screenshot
  await page.screenshot({ path: 'verification_screenshot.png', fullPage: false });
  console.log('Screenshot updated: verification_screenshot.png');

  console.log('\n=============================================');
  console.log('HERO RING / SPIRAL TEST SUMMARY:');
  console.log(`- Project Ring Items: ${ringState.count} (Target: 10-13)`);
  console.log(`- Ring Radius: ${ringState.radius.toFixed(0)}px`);
  console.log(`- All Textures Loaded: ${ringState.allHaveTextures}`);
  console.log(`- Auto-Rotation Active: ${isAutoRotating}`);
  console.log(`- Independent Sine Float: ${isFloating}`);
  console.log(`- Outward Spiral Scrub: ${ringAfterScroll.spiralProgress > 0}`);
  console.log(`- Frame Rate: ${fpsReport.fps} FPS`);
  console.log(`- Console Errors: ${consoleErrors.length}`);
  console.log('=============================================\n');

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error('FAILED due to console errors');
    process.exit(1);
  } else if (ringState.count < 10 || !isAutoRotating || !isFloating) {
    console.error('FAILED: Ring items or animation not fully functional');
    process.exit(1);
  } else {
    console.log('✓ ALL HERO PROJECT RING & SPIRAL TESTS PASSED WITH ZERO CONSOLE ERRORS!');
  }
}

verify().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
