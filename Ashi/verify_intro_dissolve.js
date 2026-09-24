const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testIntro() {
  console.log('--- Testing Intro Sequence & Pale Butter Crossfade ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  // 1. Initial Load
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  console.log('Page loaded.');

  // Check initial state (PRELOAD)
  await page.waitForTimeout(100);
  const preloadState = await page.evaluate(() => {
    const dot = document.getElementById('intro-dot');
    const butterLayer = document.getElementById('intro-butter-layer');
    const imageStage = document.getElementById('intro-image-stage');
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    return {
      hasDot: !!dot,
      hasButterLayer: !!butterLayer,
      hasImageStage: !!imageStage,
      bodyBg,
      butterOpacity: butterLayer ? window.getComputedStyle(butterLayer).opacity : null,
      imageStageOpacity: imageStage ? window.getComputedStyle(imageStage).opacity : null
    };
  });
  console.log('Preload state:', preloadState);
  await page.screenshot({ path: 'captured_intro_test_1_preload.png' });

  // 2. Image Reveal / Zoom (t ~ 2.0s)
  await page.waitForTimeout(2000);
  const zoomState = await page.evaluate(() => {
    const butterLayer = document.getElementById('intro-butter-layer');
    const imageStage = document.getElementById('intro-image-stage');
    return {
      butterOpacity: butterLayer ? window.getComputedStyle(butterLayer).opacity : null,
      imageStageOpacity: imageStage ? window.getComputedStyle(imageStage).opacity : null
    };
  });
  console.log('Zoom state at 2.0s:', zoomState);
  await page.screenshot({ path: 'captured_intro_test_2_zoom.png' });

  // 3. Mid-Crossfade (DISSOLVE_COVER is at ~3.0s, duration 1.0s, so t ~ 3.5s)
  await page.waitForTimeout(1500); // now at ~3.6s
  const crossfadeState = await page.evaluate(() => {
    const butterLayer = document.getElementById('intro-butter-layer');
    const imageStage = document.getElementById('intro-image-stage');
    return {
      butterOpacity: butterLayer ? window.getComputedStyle(butterLayer).opacity : null,
      imageStageOpacity: imageStage ? window.getComputedStyle(imageStage).opacity : null
    };
  });
  console.log('Mid-crossfade state at ~3.6s:', crossfadeState);
  await page.screenshot({ path: 'captured_intro_test_3_crossfade.png' });

  // 4. End of Crossfade / Full Butter Cover (t ~ 4.2s)
  await page.waitForTimeout(600); // now at ~4.2s
  const solidButterState = await page.evaluate(() => {
    const butterLayer = document.getElementById('intro-butter-layer');
    const imageStage = document.getElementById('intro-image-stage');
    return {
      hasImageStage: !!imageStage,
      butterOpacity: butterLayer ? window.getComputedStyle(butterLayer).opacity : null
    };
  });
  console.log('Solid Butter state at ~4.2s:', solidButterState);
  await page.screenshot({ path: 'captured_intro_test_4_butter.png' });

  // 5. Final Scene Reveal (t ~ 5.5s)
  await page.waitForTimeout(1400); // now at ~5.6s
  const finalState = await page.evaluate(() => {
    const butterLayer = document.getElementById('intro-butter-layer');
    const canvas = document.getElementById('webgl-canvas');
    const header = document.querySelector('.site-header');
    const isIntroRunning = document.body.classList.contains('intro-running');
    const doneFlag = window.introSequenceDone;
    return {
      introDone: doneFlag,
      isIntroRunning,
      hasButterLayer: !!butterLayer,
      canvasOpacity: canvas ? window.getComputedStyle(canvas).opacity : null,
      headerOpacity: header ? window.getComputedStyle(header).opacity : null,
      headerY: header ? window.getComputedStyle(header).transform : null
    };
  });
  console.log('Final state at ~5.6s:', finalState);
  await page.screenshot({ path: 'captured_intro_test_5_revealed.png' });

  // 6. Test Refresh Replay
  console.log('Testing reload replay...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(150);
  const reloadState = await page.evaluate(() => {
    const isIntroRunning = document.body.classList.contains('intro-running');
    const dot = document.getElementById('intro-dot');
    return { isIntroRunning, hasDot: !!dot };
  });
  console.log('Reload replay state:', reloadState);

  console.log('Errors encountered:', errors);
  await browser.close();
}

testIntro().catch(console.error);
