const { chromium } = require('playwright');
const path = require('path');

async function testBoxedIntro() {
  console.log('=== VERIFYING BOXED PRELOADER WITH EXPANDING BUTTER FRAME ===');
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
    { name: '1_preload', label: 'PRELOAD', offset: 0.1, desc: 'Initial preload with boxed card' },
    { name: '2_cycle_1', label: 'CYCLE_1', offset: 0.1, desc: 'Photo cycle 1 in box' },
    { name: '3_cycle_2', label: 'CYCLE_2', offset: 0.1, desc: 'Photo cycle 2 in box' },
    { name: '4_cycle_3', label: 'CYCLE_3', offset: 0.1, desc: 'Photo cycle 3 in box' },
    { name: '5_expand_start', label: 'CYCLE_BUTTER', offset: 0.05, desc: 'Start of expanding butter frame (boxed size)' },
    { name: '6_expand_mid', label: 'CYCLE_BUTTER', offset: 0.45, desc: 'Midway expanding butter frame' },
    { name: '7_expand_solid_full', label: 'CYCLE_BUTTER', offset: 0.85, desc: 'Solid butter frame covers 100% viewport' },
    { name: '8_scene_reveal', label: 'SCENE_REVEAL', offset: 0.35, desc: 'Butter frame fading out revealing scene' },
    { name: '9_interactive', label: 'INTERACTIVE', offset: 0.05, desc: 'Interactive scene, preloader cleaned up' }
  ];

  for (const st of stagesToInspect) {
    const data = await page.evaluate(({ label, offset }) => {
      const tl = window.introSeq._tl;
      const targetTime = tl.labels[label] + offset;
      tl.seek(targetTime);

      const cardWrap = document.querySelector('.intro-card-wrap');
      const butterFrame = document.getElementById('intro-butter-frame');
      const dot = document.getElementById('intro-dot');
      const imgs = Array.from(document.querySelectorAll('.intro-cycle-img'));

      const cardRect = cardWrap ? cardWrap.getBoundingClientRect() : null;
      const butterRect = butterFrame ? butterFrame.getBoundingClientRect() : null;

      return {
        time: targetTime.toFixed(2),
        hasCard: !!cardWrap,
        cardWidth: cardRect ? cardRect.width : null,
        cardHeight: cardRect ? cardRect.height : null,
        imgOpacities: imgs.map(img => window.getComputedStyle(img).opacity),
        butterOpacity: butterFrame ? window.getComputedStyle(butterFrame).opacity : 'none',
        butterWidth: butterRect ? butterRect.width : null,
        butterHeight: butterRect ? butterRect.height : null,
        butterTop: butterRect ? butterRect.top : null,
        butterLeft: butterRect ? butterRect.left : null
      };
    }, st);

    const outPath = path.join(__dirname, `verify_boxed_${st.name}.png`);
    await page.screenshot({ path: outPath });
    console.log(`[Stage: ${st.name}] t=${data.time}s | ${st.desc}`);
    console.log(`  Card: ${data.cardWidth}x${data.cardHeight} | Img opacities: ${data.imgOpacities.join(', ')}`);
    console.log(`  Butter: opac=${data.butterOpacity}, rect=${data.butterWidth}x${data.butterHeight} at (${data.butterLeft}, ${data.butterTop})`);
  }

  // Also test natural playback without pausing
  console.log('\nTesting natural playback to completion...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const naturalState = await page.evaluate(() => {
    const stage = document.getElementById('intro-stage');
    const butterFrame = document.getElementById('intro-butter-frame');
    const header = document.querySelector('.site-header');
    return {
      done: window.introSequenceDone,
      hasStage: !!stage,
      hasButterFrame: !!butterFrame,
      headerOpacity: header ? window.getComputedStyle(header).opacity : null
    };
  });
  console.log('Natural playback result:', naturalState);
  await page.screenshot({ path: 'verify_boxed_natural_complete.png' });

  // Test reload replay
  console.log('Testing reload replay...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);
  const replayState = await page.evaluate(() => {
    const isIntroRunning = document.body.classList.contains('intro-running');
    const stage = document.getElementById('intro-stage');
    return { isIntroRunning, hasStage: !!stage };
  });
  console.log('Replay state:', replayState);

  console.log('Console Errors:', errors);
  await browser.close();
}

testBoxedIntro().catch(console.error);
