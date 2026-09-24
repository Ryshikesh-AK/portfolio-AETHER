const { chromium } = require('playwright');
const path = require('path');

async function testNaturalMinimalLanding() {
  console.log('=== VERIFYING NATURAL REAL-TIME MINIMAL POST-INTRO LANDING ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore external analytics/resource connection errors if any
      if (!text.includes('ERR_CONNECTION_REFUSED')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', err => errors.push(err.message));

  console.log('Loading page http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  // 1. Check Preloader start
  await page.waitForTimeout(300);
  console.log('Sampling at t ~ 0.3s (Preloader Boxed Cycle)...');
  await page.screenshot({ path: path.join(__dirname, 'verify_minimal_01_boxed_cycle.png') });

  // 2. Check Expanding Butter Frame
  await page.waitForTimeout(1600); // t ~ 1.9s
  console.log('Sampling at t ~ 1.9s (Expanding Butter Frame)...');
  await page.screenshot({ path: path.join(__dirname, 'verify_minimal_02_expanding_butter.png') });

  // 3. Check Breathing Moment (Empty Pale Butter Scene, nav + SCROLL anchor, NO RING)
  await page.waitForTimeout(1400); // t ~ 3.3s
  console.log('Sampling at t ~ 3.3s (Breathing Pause: Nav + SCROLL only, Ring = 0)...');
  const breathingData = await page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const scroll = document.querySelector('.scroll-indicator');
    const ringOp = window.webglEngine ? window.webglEngine.ringOpacity : null;
    const cardOp = (window.webglEngine && window.webglEngine.ringItems && window.webglEngine.ringItems[0]) 
      ? window.webglEngine.ringItems[0].uniforms.uOpacity.value 
      : null;
    return {
      bodyIntroRunning: document.body.classList.contains('intro-running'),
      headerOpacity: header ? window.getComputedStyle(header).opacity : null,
      scrollOpacity: scroll ? window.getComputedStyle(scroll).opacity : null,
      ringOpacity: ringOp,
      cardOpacity: cardOp
    };
  });
  console.log('Breathing Moment Status:', breathingData);
  await page.screenshot({ path: path.join(__dirname, 'verify_minimal_03_breathing_moment.png') });

  // 4. Check Ring Floating In (Mid-Fade)
  await page.waitForTimeout(1300); // t ~ 4.6s
  console.log('Sampling at t ~ 4.6s (Ring Mid-Fade Arrival)...');
  const midFadeData = await page.evaluate(() => {
    const ringOp = window.webglEngine ? window.webglEngine.ringOpacity : null;
    const cardOp = (window.webglEngine && window.webglEngine.ringItems && window.webglEngine.ringItems[0]) 
      ? window.webglEngine.ringItems[0].uniforms.uOpacity.value 
      : null;
    return {
      ringOpacity: ringOp,
      cardOpacity: cardOp
    };
  });
  console.log('Ring Mid-Fade Status:', midFadeData);
  await page.screenshot({ path: path.join(__dirname, 'verify_minimal_04_ring_mid_fade.png') });

  // 5. Check Settled Full Ring & Interactive Scene
  await page.waitForTimeout(1500); // t ~ 6.1s
  console.log('Sampling at t ~ 6.1s (Ring Fully Arrived & Settled)...');
  const arrivedData = await page.evaluate(() => {
    const ringOp = window.webglEngine ? window.webglEngine.ringOpacity : null;
    const cardOp = (window.webglEngine && window.webglEngine.ringItems && window.webglEngine.ringItems[0]) 
      ? window.webglEngine.ringItems[0].uniforms.uOpacity.value 
      : null;
    return {
      done: window.introSequenceDone,
      ringOpacity: ringOp,
      cardOpacity: cardOp
    };
  });
  console.log('Settled Arrived Status:', arrivedData);
  await page.screenshot({ path: path.join(__dirname, 'verify_minimal_05_ring_settled.png') });

  if (errors.length > 0) {
    console.error('Errors encountered:', errors);
  } else {
    console.log('\n✓ Sequence executed cleanly without JavaScript errors.');
  }

  await browser.close();
}

testNaturalMinimalLanding().catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
});
