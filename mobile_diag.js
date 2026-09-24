/**
 * Diagnostic: mobile responsiveness bug investigation at 360px
 * Checks:
 *  1. Canvas getBoundingClientRect dimensions
 *  2. window.innerWidth/Height vs canvas size
 *  3. Works section scroll position and filter pill positions
 *  4. Hero section height
 *  5. WebGL engine initialized state and mobile scale
 */
const { chromium } = require('playwright');
const path = require('path');
const ARTIFACTS = 'C:/Users/abani/.gemini/antigravity-ide/brain/524da48c-f1f0-45d7-a419-8023eec556d3';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });
  const page = await ctx.newPage();

  const consoleLog = [];
  page.on('console', msg => {
    const t = msg.text();
    if (!t.includes('content.js') && !t.includes('Receiving end')) {
      consoleLog.push(`[${msg.type()}] ${t}`);
    }
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000); // wait for intro + scene init

  // ── A. Canvas & WebGL checks ─────────────────────────────────────────────────
  const checks = await page.evaluate(() => {
    const canvas = document.getElementById('webgl-canvas');
    const hero = document.querySelector('.hero-section');
    const works = document.getElementById('works');
    const header = document.querySelector('.section-header');
    const filters = document.querySelector('.category-filters');
    const nav = document.querySelector('.floating-nav-dock');
    const siteHeader = document.querySelector('.site-header');

    const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
    const heroRect   = hero   ? hero.getBoundingClientRect()   : null;
    const worksRect  = works  ? works.getBoundingClientRect()  : null;
    const headerRect = header ? header.getBoundingClientRect() : null;
    const filtersRect = filters ? filters.getBoundingClientRect() : null;
    const navRect    = nav    ? nav.getBoundingClientRect()    : null;
    const siteHeaderRect = siteHeader ? siteHeader.getBoundingClientRect() : null;

    const eng = window.webglEngine;

    return {
      window: { w: window.innerWidth, h: window.innerHeight },
      canvas: canvasRect ? {
        x: Math.round(canvasRect.x), y: Math.round(canvasRect.y),
        w: Math.round(canvasRect.width), h: Math.round(canvasRect.height),
        cssW: canvas.style.width, cssH: canvas.style.height,
        domW: canvas.width, domH: canvas.height,
        opacity: window.getComputedStyle(canvas).opacity
      } : 'canvas element not found',
      hero: heroRect ? {
        top: Math.round(heroRect.top), h: Math.round(heroRect.height)
      } : null,
      works: worksRect ? {
        top: Math.round(worksRect.top), h: Math.round(worksRect.height),
        paddingTop: window.getComputedStyle(works).paddingTop,
        paddingLeft: window.getComputedStyle(works).paddingLeft
      } : null,
      sectionHeader: headerRect ? {
        top: Math.round(headerRect.top), h: Math.round(headerRect.height), w: Math.round(headerRect.width)
      } : null,
      filters: filtersRect ? {
        top: Math.round(filtersRect.top), h: Math.round(filtersRect.height), w: Math.round(filtersRect.width),
        computed: window.getComputedStyle(filters).position
      } : null,
      nav: navRect ? {
        top: Math.round(navRect.top), h: Math.round(navRect.height), w: Math.round(navRect.width)
      } : null,
      siteHeader: siteHeaderRect ? {
        top: Math.round(siteHeaderRect.top), h: Math.round(siteHeaderRect.height)
      } : null,
      webgl: eng ? {
        initialized: eng.isInitialized,
        width: eng.width,
        height: eng.height,
        scatterOpacity: eng._scatterOpacity,
        heroScrollOpacity: eng._heroScrollOpacity,
        centerpieceScale: eng.centerpieceGroup ? eng.centerpieceGroup.scale.x : 'no group',
        cardCount: eng.scatterItems ? eng.scatterItems.length : 0,
        visibleCards: eng.scatterItems ? eng.scatterItems.filter(i => i.isVisible).length : 0
      } : 'webglEngine not found'
    };
  });

  console.log('\n=== DIAGNOSTIC RESULTS @ 360×780 ===');
  console.log(JSON.stringify(checks, null, 2));
  console.log('\n=== CONSOLE LOGS ===');
  consoleLog.forEach(l => console.log(' ', l));

  // ── B. Screenshot at page load (hero/canvas area) ───────────────────────────
  const shot1 = path.join(ARTIFACTS, 'diag_mobile360_hero.png');
  await page.screenshot({ path: shot1, fullPage: false });
  console.log(`\n✓ Hero screenshot: ${shot1}`);

  // ── C. Screenshot after scrolling to works section ──────────────────────────
  await page.evaluate(() => document.getElementById('works').scrollIntoView());
  await page.waitForTimeout(400);
  const shot2 = path.join(ARTIFACTS, 'diag_mobile360_works.png');
  await page.screenshot({ path: shot2, fullPage: false });
  console.log(`✓ Works screenshot: ${shot2}`);

  // ── D. Check overlay: are filter pills vertically overlapping the fixed nav? ─
  const overlap = await page.evaluate(() => {
    const pills = document.querySelector('.category-filters');
    const nav   = document.querySelector('.site-header');
    if (!pills || !nav) return 'elements not found';
    const pRect = pills.getBoundingClientRect();
    const nRect = nav.getBoundingClientRect();
    // Both in viewport: check if their vertical ranges intersect
    const navBottom = nRect.top + nRect.height;
    const pillsBottom = pRect.top + pRect.height;
    const overlaps = pRect.top < navBottom && pillsBottom > nRect.top;
    return {
      navTop: Math.round(nRect.top), navBottom: Math.round(navBottom),
      pillsTop: Math.round(pRect.top), pillsBottom: Math.round(pillsBottom),
      overlapping: overlaps,
      pillsScrollY: Math.round(window.scrollY)
    };
  });
  console.log('\n=== FILTER/NAV OVERLAP CHECK (at works scroll position) ===');
  console.log(JSON.stringify(overlap, null, 2));

  await browser.close();
  console.log('\nDone.');
}

run().catch(e => { console.error(e); process.exit(1); });
