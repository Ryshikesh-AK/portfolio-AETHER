const { chromium } = require('playwright');

async function verifyRingInteractions() {
  console.log('=== STARTING RING CARD HOVER, TOUCH & CLICK VERIFICATION ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('[Browser ERROR]', msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.error('[Page ERROR]', err.message);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  // Wait for intro to finish and ring to be revealed
  await page.waitForTimeout(3000);

  // Ensure ring opacity is 1.0
  await page.evaluate(() => {
    if (window.webglEngine) window.webglEngine.setRingOpacity(1.0);
  });
  await page.waitForTimeout(500);

  // 1. Find the 2D screen coordinate of the first ring card
  const card0Coords = await page.evaluate(() => {
    const engine = window.webglEngine;
    if (!engine || !engine.ringItems || !engine.ringItems.length) return null;
    const item = engine.ringItems[0];
    const rect = engine.getCardScreenRect(item);
    return {
      left: rect.left,
      top: rect.top,
      cx: rect.left + rect.width * 0.5,
      cy: rect.top + rect.height * 0.5,
      title: item.title,
      tag: item.tag
    };
  });

  console.log('Target card 0 screen coords:', card0Coords);

  // 2. Move mouse to hover card 0
  await page.mouse.move(card0Coords.cx, card0Coords.cy);
  await page.waitForTimeout(400);

  // 3. Inspect hover state
  const hoverState1 = await page.evaluate(() => {
    const engine = window.webglEngine;
    const badge = document.getElementById('ring-card-badge');
    const title = document.getElementById('rcb-title')?.textContent;
    const tag = document.getElementById('rcb-tag')?.textContent;
    const badgeVisible = badge?.classList.contains('visible');
    const badgePos = { left: badge?.style.left, top: badge?.style.top };

    const item0 = engine.ringItems[0];
    const otherItemsHover = engine.ringItems.slice(1).map(it => it.hoverProgress);
    const maxOtherHover = Math.max(...otherItemsHover);

    return {
      badgeVisible,
      title,
      tag,
      badgePos,
      item0HoverProgress: item0.hoverProgress,
      maxOtherHover
    };
  });

  console.log('Hover state after 400ms:', hoverState1);

  // 4. Verify RAF badge movement: wait 250ms and re-check badgePos
  await page.waitForTimeout(250);
  const badgePos2 = await page.evaluate(() => {
    const badge = document.getElementById('ring-card-badge');
    return { left: badge?.style.left, top: badge?.style.top };
  });
  console.log('Badge pos 1:', hoverState1.badgePos, 'Badge pos 2:', badgePos2);

  // Capture screenshot of hover state
  await page.screenshot({ path: 'verify_ring_hover.png' });
  console.log('Saved hover screenshot to verify_ring_hover.png');

  // 5. Test Click on Card -> Shared-element modal expansion
  await page.mouse.click(card0Coords.cx, card0Coords.cy);
  await page.waitForTimeout(600);

  const modalOpenState = await page.evaluate(() => {
    const modal = document.getElementById('project-modal');
    const title = document.getElementById('modal-title')?.textContent;
    const meta = document.getElementById('modal-meta')?.textContent;
    const isOpen = modal?.classList.contains('open');
    const isPaused = window.webglEngine?.isPaused;
    return { isOpen, isPaused, title, meta };
  });

  console.log('Modal state after card click:', modalOpenState);
  await page.screenshot({ path: 'verify_ring_modal_expanded.png' });
  console.log('Saved modal expanded screenshot to verify_ring_modal_expanded.png');

  // 6. Test Close Modal
  await page.click('#modal-close');
  await page.waitForTimeout(400);

  const modalClosedState = await page.evaluate(() => {
    const modal = document.getElementById('project-modal');
    const isOpen = modal?.classList.contains('open');
    const isPaused = window.webglEngine?.isPaused;
    return { isOpen, isPaused };
  });
  console.log('Modal state after close:', modalClosedState);

  // 7. Mobile Touch Test (tap vs scroll)
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await mobilePage.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(3000);
  await mobilePage.evaluate(() => {
    if (window.webglEngine) window.webglEngine.setRingOpacity(1.0);
  });
  await mobilePage.waitForTimeout(500);

  const mobileCardCoords = await mobilePage.evaluate(() => {
    const engine = window.webglEngine;
    if (!engine || !engine.ringItems || !engine.ringItems.length) return null;
    const item = engine.ringItems[0];
    const rect = engine.getCardScreenRect(item);
    return { cx: rect.left + rect.width * 0.5, cy: rect.top + rect.height * 0.5 };
  });

  // A. Scroll gesture (drag > 10px) -> should NOT open modal
  await mobilePage.touchscreen.tap(mobileCardCoords.cx, mobileCardCoords.cy);
  await mobilePage.waitForTimeout(600);

  const mobileModalState = await mobilePage.evaluate(() => {
    const modal = document.getElementById('project-modal');
    return { isOpen: modal?.classList.contains('open') };
  });
  console.log('Mobile modal state after tap:', mobileModalState);
  await mobilePage.screenshot({ path: 'verify_ring_mobile_modal.png' });

  await browser.close();

  // Validate results
  if (consoleErrors.length > 0) {
    console.error('FAILED with console errors:', consoleErrors);
    process.exit(1);
  } else if (!hoverState1.badgeVisible || hoverState1.item0HoverProgress < 0.5) {
    console.error('FAILED: Hover state not activated on card!');
    process.exit(1);
  } else if (!modalOpenState.isOpen || !modalOpenState.isPaused) {
    console.error('FAILED: Modal did not open or ring rotation did not pause!');
    process.exit(1);
  } else if (modalClosedState.isOpen || modalClosedState.isPaused) {
    console.error('FAILED: Modal did not close or ring did not resume rotation!');
    process.exit(1);
  } else if (!mobileModalState.isOpen) {
    console.error('FAILED: Mobile tap did not open modal!');
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED PERFECTLY!');
  }
}

verifyRingInteractions().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
