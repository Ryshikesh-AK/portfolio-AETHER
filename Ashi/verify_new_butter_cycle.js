const { chromium } = require('playwright');
const path = require('path');

async function testNewIntro() {
  console.log('=== VERIFYING SEQUENTIAL IMAGE-OVERLAY PRELOADER ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);

  // Pause timeline for deterministic frame inspection
  await page.evaluate(() => {
    if (window.introSeq && window.introSeq._tl) {
      window.introSeq._tl.pause();
    }
  });

  const stagesToInspect = [
    { name: '1_preload', label: 'PRELOAD', offset: 0.1, desc: 'Initial preload' },
    { name: '2_cycle_1', label: 'CYCLE_1', offset: 0.1, desc: 'Image cycle 1' },
    { name: '3_cycle_2', label: 'CYCLE_2', offset: 0.1, desc: 'Image cycle 2' },
    { name: '4_cycle_3', label: 'CYCLE_3', offset: 0.1, desc: 'Image cycle 3' },
    { name: '5_cycle_butter_mid', label: 'CYCLE_BUTTER', offset: 0.32, desc: 'Crossfading into solid Pale Butter frame' },
    { name: '6_cycle_butter_solid', label: 'CYCLE_BUTTER', offset: 0.65, desc: 'Solid Pale Butter frame at 100%' },
    { name: '7_scene_reveal_mid', label: 'SCENE_REVEAL', offset: 0.35, desc: 'Overlay fading out to reveal scene' },
    { name: '8_interactive', label: 'INTERACTIVE', offset: 0.05, desc: 'Interactive scene, overlay removed' }
  ];

  for (const st of stagesToInspect) {
    const data = await page.evaluate(({ label, offset }) => {
      const tl = window.introSeq._tl;
      const targetTime = tl.labels[label] + offset;
      tl.seek(targetTime);

      const overlay = document.getElementById('intro-preloader');
      const dot = document.getElementById('intro-dot');
      const frames = overlay ? Array.from(overlay.querySelectorAll('.intro-frame')) : [];
      const canvas = document.getElementById('webgl-canvas');

      return {
        time: targetTime.toFixed(2),
        hasOverlay: !!overlay,
        overlayOpacity: overlay ? window.getComputedStyle(overlay).opacity : 'none',
        dotOpacity: dot ? window.getComputedStyle(dot).opacity : 'none',
        frameCount: frames.length,
        frameOpacities: frames.map(f => window.getComputedStyle(f).opacity),
        isButterLastFrame: frames.length > 0 && frames[frames.length - 1].classList.contains('intro-frame-butter'),
        canvasOpacity: canvas ? window.getComputedStyle(canvas).opacity : 'none'
      };
    }, st);

    const outPath = path.join(__dirname, `verify_butter_cycle_${st.name}.png`);
    await page.screenshot({ path: outPath });
    console.log(`[Stage: ${st.name}] t=${data.time}s | ${st.desc}`);
    console.log(`  Overlay: ${data.overlayOpacity} | Dot: ${data.dotOpacity} | Frame opacities: ${data.frameOpacities.join(', ')} | Last frame is butter: ${data.isButterLastFrame}`);
  }

  // Also test natural playback without pausing
  console.log('\nTesting complete natural playback...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000); // Intro completes in ~3s
  const naturalState = await page.evaluate(() => {
    const overlay = document.getElementById('intro-preloader');
    const header = document.querySelector('.site-header');
    return {
      done: window.introSequenceDone,
      hasOverlay: !!overlay,
      headerOpacity: header ? window.getComputedStyle(header).opacity : null
    };
  });
  console.log('Natural playback result:', naturalState);
  await page.screenshot({ path: 'verify_butter_cycle_natural_complete.png' });

  // Test reload replay
  console.log('Testing reload replay...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);
  const replayState = await page.evaluate(() => {
    const isIntroRunning = document.body.classList.contains('intro-running');
    const overlay = document.getElementById('intro-preloader');
    return { isIntroRunning, hasOverlay: !!overlay };
  });
  console.log('Replay state:', replayState);

  console.log('Console Errors:', errors);
  await browser.close();
}

testNewIntro().catch(console.error);
