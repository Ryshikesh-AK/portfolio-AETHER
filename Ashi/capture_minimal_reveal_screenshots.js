const { chromium } = require('playwright');
const path = require('path');

async function captureFinalVerification() {
  console.log('=== CAPTURING FINAL MINIMAL POST-INTRO LANDING SEQUENCE ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('ERR_CONNECTION_REFUSED')) errors.push(t);
    }
  });
  page.on('pageerror', err => errors.push(err.message));

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  // Helper to pause animation, take screenshot and evaluate metrics at given timeline time
  const sampleTimelineAt = async (targetSec, filename, desc) => {
    const data = await page.evaluate(({ sec }) => {
      const tl = window.introSeq._tl;
      // Seek with suppressEvents = false so all calls, tweens, and updates fire
      tl.seek(sec, false);
      if (window.webglEngine) {
        window.webglEngine.updateRingPositions();
        window.webglEngine.renderer.render(window.webglEngine.scene, window.webglEngine.camera);
      }

      const header = document.querySelector('.site-header');
      const scroll = document.querySelector('.scroll-indicator');
      const butterFrame = document.getElementById('intro-butter-frame');
      const stage = document.getElementById('intro-stage');

      return {
        sec,
        introRunning: document.body.classList.contains('intro-running'),
        headerOpacity: header ? window.getComputedStyle(header).opacity : null,
        scrollOpacity: scroll ? window.getComputedStyle(scroll).opacity : null,
        butterOpacity: butterFrame ? window.getComputedStyle(butterFrame).opacity : null,
        stageOpacity: stage ? window.getComputedStyle(stage).opacity : null,
        ringOpacity: window.webglEngine ? window.webglEngine.ringOpacity : null,
        cardUniformOpacity: (window.webglEngine && window.webglEngine.ringItems[0]) 
          ? window.webglEngine.ringItems[0].uniforms.uOpacity.value 
          : null
      };
    }, { sec: targetSec });

    const outPath = path.join(__dirname, filename);
    await page.screenshot({ path: outPath });
    console.log(`\nCaptured [${filename}] at t=${targetSec}s: ${desc}`);
    console.log(`  Header Opacity: ${data.headerOpacity} | Scroll Cue Opacity: ${data.scrollOpacity}`);
    console.log(`  Butter Overlay Opacity: ${data.butterOpacity} | Ring Opacity: ${data.ringOpacity} (Card Shader uOpacity: ${data.cardUniformOpacity})`);
    console.log(`  intro-running: ${data.introRunning}`);
    return data;
  };

  // 1. Expanding Pale Butter Frame (t=2.6s)
  await sampleTimelineAt(2.6, 'final_verify_01_butter_expand.png', 'Solid Pale Butter frame expanding towards full viewport');

  // 2. Scene Reveal Empty (t=3.6s)
  await sampleTimelineAt(3.6, 'final_verify_02_scene_reveal_empty.png', 'Preloader faded out, Nav & SCROLL anchor visible, Ring opacity = 0');

  // 3. Breathing Moment (t=5.2s)
  await sampleTimelineAt(5.2, 'final_verify_03_breathing_moment.png', 'Empty Pale Butter scene, confident & minimal, Ring opacity = 0');

  // 4. Ring Floating In (t=6.6s)
  await sampleTimelineAt(6.6, 'final_verify_04_ring_fading_in.png', 'Ring cards mid-fade floating in naturally');

  // 5. Ring Fully Settled (t=7.8s)
  await sampleTimelineAt(7.8, 'final_verify_05_ring_settled.png', 'Full 13-card ring arrived at opacity 1.0, interactive');

  if (errors.length > 0) {
    console.error('Errors:', errors);
  } else {
    console.log('\n✓ Verification completed with zero JS errors.');
  }

  await browser.close();
}

captureFinalVerification().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
