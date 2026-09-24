const { chromium } = require('playwright');
const path = require('path');

async function captureExactStages() {
  console.log('--- Capturing Deterministic Stages of Intro Crossfade ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);

  // Pause the timeline immediately so we can seek with frame-accuracy
  await page.evaluate(() => {
    if (window.introSeq && window.introSeq._tl) {
      window.introSeq._tl.pause();
    }
  });

  const stages = [
    { name: '01_preload', label: 'PRELOAD', offset: 0.1, desc: 'Initial preload with yellow dot' },
    { name: '02_image_reveal', label: 'IMAGE_REVEAL', offset: 0.1, desc: 'Hero image card settled' },
    { name: '03_scale_zoom', label: 'IMAGE_SCALE_ZOOM', offset: 0.8, desc: 'Camera push zoom (scale 1.22)' },
    { name: '04_dissolve_start', label: 'DISSOLVE_COVER', offset: 0.05, desc: 'Start of crossfade: Layer A 100%, Layer B ~5%' },
    { name: '05_dissolve_mid', label: 'DISSOLVE_COVER', offset: 0.5, desc: 'Mid-crossfade: Layer A 50%, Layer B 50% dissolving directly into Pale Butter' },
    { name: '06_dissolve_butter_solid', label: 'DISSOLVE_COVER', offset: 0.98, desc: 'End of crossfade: solid Pale Butter #F6EFA6' },
    { name: '07_scene_reveal_mid', label: 'SCENE_REVEAL', offset: 0.35, desc: 'Scene reveal: butter fading, 3D ring & dock appearing' },
    { name: '08_interactive_final', label: 'INTERACTIVE', offset: 0.1, desc: 'Final interactive hero state with Pale Butter theme' }
  ];

  for (const st of stages) {
    const state = await page.evaluate(({ label, offset }) => {
      const tl = window.introSeq._tl;
      const targetTime = tl.labels[label] + offset;
      tl.seek(targetTime);

      const butterLayer = document.getElementById('intro-butter-layer');
      const imageStage = document.getElementById('intro-image-stage');
      const dot = document.getElementById('intro-dot');
      const canvas = document.getElementById('webgl-canvas');
      const header = document.querySelector('.site-header');

      return {
        time: targetTime.toFixed(2),
        butterOpacity: butterLayer ? window.getComputedStyle(butterLayer).opacity : 'removed',
        imageStageOpacity: imageStage ? window.getComputedStyle(imageStage).opacity : 'removed',
        dotOpacity: dot ? window.getComputedStyle(dot).opacity : 'removed',
        canvasOpacity: canvas ? window.getComputedStyle(canvas).opacity : 'none',
        headerOpacity: header ? window.getComputedStyle(header).opacity : 'none'
      };
    }, st);

    const outPath = path.join(__dirname, `captured_intro_${st.name}.png`);
    await page.screenshot({ path: outPath });
    console.log(`[Stage ${st.name}] t=${state.time}s | ${st.desc}`);
    console.log(`  Butter: ${state.butterOpacity} | Image: ${state.imageStageOpacity} | Dot: ${state.dotOpacity} | Canvas: ${state.canvasOpacity} | Header: ${state.headerOpacity}`);
  }

  await browser.close();
  console.log('--- All stages captured successfully ---');
}

captureExactStages().catch(console.error);
