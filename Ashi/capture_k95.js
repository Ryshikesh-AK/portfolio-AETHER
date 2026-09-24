const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.join(__dirname, 'captured_k95');

const PAGES_TO_CAPTURE = [
  { name: '01_home', url: 'https://k95.it/en', title: 'Home' },
  { name: '02_works', url: 'https://k95.it/en/works', title: 'Works' },
  { name: '03_studio', url: 'https://k95.it/en/studio', title: 'Studio' },
  { name: '04_contacts', url: 'https://k95.it/en/contacts', title: 'Contacts' },
  { name: '05_project_stelvio_grotesk', url: 'https://k95.it/en/projects/stelvio-grotesk', title: 'Project - Stelvio Grotesk' }
];

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 150);
}

function getSafeFilename(urlStr, contentType, defaultExt = '.bin') {
  try {
    const parsed = new URL(urlStr);
    let base = path.basename(parsed.pathname);
    if (!base || base === '/' || base.includes('?') || !path.extname(base)) {
      const hash = crypto.createHash('md5').update(urlStr).digest('hex').substring(0, 10);
      let ext = defaultExt;
      if (contentType) {
        if (contentType.includes('woff2')) ext = '.woff2';
        else if (contentType.includes('woff')) ext = '.woff';
        else if (contentType.includes('ttf')) ext = '.ttf';
        else if (contentType.includes('otf')) ext = '.otf';
        else if (contentType.includes('javascript')) ext = '.js';
        else if (contentType.includes('css')) ext = '.css';
        else if (contentType.includes('webp')) ext = '.webp';
        else if (contentType.includes('svg')) ext = '.svg';
        else if (contentType.includes('png')) ext = '.png';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
        else if (contentType.includes('mp4')) ext = '.mp4';
        else if (contentType.includes('webm')) ext = '.webm';
      }
      base = `asset_${hash}${ext}`;
    }
    // Clean query parameters from base if any
    base = base.split('?')[0].split('#')[0];
    if (!path.extname(base) && defaultExt) {
      base += defaultExt;
    }
    return sanitizeFilename(base);
  } catch {
    const hash = crypto.createHash('md5').update(urlStr).digest('hex').substring(0, 10);
    return `asset_${hash}${defaultExt}`;
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight || totalHeight > 15000) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);
    });
  });
}

async function capturePage(browser, pageConfig) {
  console.log(`\n==================================================`);
  console.log(`Starting capture for: ${pageConfig.title} (${pageConfig.url})`);
  console.log(`==================================================`);

  const pageDir = path.join(BASE_DIR, pageConfig.name);
  const cssDir = path.join(pageDir, 'css');
  const jsDir = path.join(pageDir, 'js');
  const fontsDir = path.join(pageDir, 'fonts');
  const mediaDir = path.join(pageDir, 'media');

  [pageDir, cssDir, jsDir, fontsDir, mediaDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US'
  });

  const page = await context.newPage();

  const allRequests = [];
  const fontMediaRequests = [];
  const savedFiles = {
    css: [],
    js: [],
    fonts: [],
    media: []
  };

  const processedUrls = new Set();

  page.on('response', async (response) => {
    try {
      const req = response.request();
      const url = response.url();
      const status = response.status();
      const resourceType = req.resourceType();
      const headers = response.headers();
      const contentType = headers['content-type'] || '';
      const contentLength = headers['content-length'] || null;

      const reqInfo = {
        url,
        method: req.method(),
        status,
        resourceType,
        contentType,
        contentLength,
        headers
      };
      allRequests.push(reqInfo);

      // Determine category
      const isFont = resourceType === 'font' ||
        url.match(/\.(woff2|woff|ttf|otf|eot)(\?.*)?$/i) ||
        contentType.includes('font') ||
        contentType.includes('woff');

      const isMedia = resourceType === 'image' ||
        resourceType === 'media' ||
        url.match(/\.(png|jpe?g|webp|gif|svg|ico|avif|mp4|webm|ogg|mp3|wav)(\?.*)?$/i) ||
        contentType.includes('image/') ||
        contentType.includes('video/') ||
        contentType.includes('audio/');

      const isCss = resourceType === 'stylesheet' ||
        url.match(/\.css(\?.*)?$/i) ||
        contentType.includes('text/css');

      const isJs = resourceType === 'script' ||
        url.match(/\.(m?js)(\?.*)?$/i) ||
        contentType.includes('javascript');

      if (isFont || isMedia) {
        fontMediaRequests.push(reqInfo);
      }

      // Download and save body if successful response
      if (status >= 200 && status < 400 && !url.startsWith('data:') && !processedUrls.has(url)) {
        processedUrls.add(url);

        let bodyBuffer = null;
        try {
          bodyBuffer = await response.body();
        } catch (e) {
          // Body might not be available for aborted or redirected stream
        }

        if (bodyBuffer && bodyBuffer.length > 0) {
          if (isFont) {
            let fname = getSafeFilename(url, contentType, '.woff2');
            let targetPath = path.join(fontsDir, fname);
            // Deduplicate filename if collision with different content
            let idx = 1;
            while (fs.existsSync(targetPath) && fs.readFileSync(targetPath).length !== bodyBuffer.length) {
              const parsed = path.parse(fname);
              targetPath = path.join(fontsDir, `${parsed.name}_${idx++}${parsed.ext}`);
            }
            fs.writeFileSync(targetPath, bodyBuffer);
            savedFiles.fonts.push({
              url,
              file: path.relative(pageDir, targetPath),
              bytes: bodyBuffer.length,
              contentType
            });
            reqInfo.savedFile = path.relative(pageDir, targetPath);
            console.log(`  [FONT] Saved ${path.basename(targetPath)} (${bodyBuffer.length} bytes)`);
          } else if (isMedia) {
            let fname = getSafeFilename(url, contentType, '.png');
            let targetPath = path.join(mediaDir, fname);
            let idx = 1;
            while (fs.existsSync(targetPath) && fs.readFileSync(targetPath).length !== bodyBuffer.length) {
              const parsed = path.parse(fname);
              targetPath = path.join(mediaDir, `${parsed.name}_${idx++}${parsed.ext}`);
            }
            fs.writeFileSync(targetPath, bodyBuffer);
            savedFiles.media.push({
              url,
              file: path.relative(pageDir, targetPath),
              bytes: bodyBuffer.length,
              contentType
            });
            reqInfo.savedFile = path.relative(pageDir, targetPath);
            console.log(`  [MEDIA] Saved ${path.basename(targetPath)} (${bodyBuffer.length} bytes)`);
          } else if (isCss) {
            let fname = getSafeFilename(url, contentType, '.css');
            let targetPath = path.join(cssDir, fname);
            let idx = 1;
            while (fs.existsSync(targetPath) && fs.readFileSync(targetPath).length !== bodyBuffer.length) {
              const parsed = path.parse(fname);
              targetPath = path.join(cssDir, `${parsed.name}_${idx++}${parsed.ext}`);
            }
            fs.writeFileSync(targetPath, bodyBuffer);
            savedFiles.css.push({
              url,
              file: path.relative(pageDir, targetPath),
              bytes: bodyBuffer.length,
              contentType
            });
            console.log(`  [CSS] Saved ${path.basename(targetPath)} (${bodyBuffer.length} bytes)`);
          } else if (isJs) {
            let fname = getSafeFilename(url, contentType, '.js');
            let targetPath = path.join(jsDir, fname);
            let idx = 1;
            while (fs.existsSync(targetPath) && fs.readFileSync(targetPath).length !== bodyBuffer.length) {
              const parsed = path.parse(fname);
              targetPath = path.join(jsDir, `${parsed.name}_${idx++}${parsed.ext}`);
            }
            fs.writeFileSync(targetPath, bodyBuffer);
            savedFiles.js.push({
              url,
              file: path.relative(pageDir, targetPath),
              bytes: bodyBuffer.length,
              contentType
            });
            console.log(`  [JS] Saved ${path.basename(targetPath)} (${bodyBuffer.length} bytes)`);
          }
        }
      }
    } catch (err) {
      console.warn('Error processing response:', err.message);
    }
  });

  console.log(`Navigating to ${pageConfig.url}...`);
  try {
    await page.goto(pageConfig.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (err) {
    console.error(`Initial navigation error: ${err.message}`);
  }

  // Wait a bit for initial scripts and styles to execute
  await page.waitForTimeout(3000);

  // Auto-scroll to trigger any lazy-loaded media, images, videos and web fonts
  console.log('Scrolling page to trigger lazy-loaded assets...');
  try {
    await autoScroll(page);
  } catch (err) {
    console.warn('Scroll warning:', err.message);
  }

  // Explicitly ensure fonts are loaded
  console.log('Waiting for document.fonts.ready...');
  try {
    await page.evaluate(() => document.fonts ? document.fonts.ready : Promise.resolve());
  } catch (err) {
    console.warn('Fonts ready warning:', err.message);
  }

  // Wait for network idle or extra seconds
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  } catch {}
  await page.waitForTimeout(4000);

  // Capture Rendered DOM
  console.log('Capturing rendered DOM...');
  const renderedDom = await page.evaluate(() => document.documentElement.outerHTML);
  const domPath = path.join(pageDir, 'rendered_dom.html');
  fs.writeFileSync(domPath, renderedDom, 'utf8');
  console.log(`Rendered DOM saved to ${domPath} (${renderedDom.length} chars)`);

  // Additionally check if any fonts were referenced in CSS @font-face that weren't captured
  console.log('Extracting and verifying all fonts defined in stylesheets...');
  const discoveredFontUrls = await page.evaluate(() => {
    const urls = [];
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (const rule of rules) {
          if (rule.type === CSSRule.FONT_FACE_RULE || (rule.cssText && rule.cssText.startsWith('@font-face'))) {
            const src = rule.style.getPropertyValue('src') || rule.cssText;
            const matches = src.match(/url\((['"]?)(.*?)\1\)/g);
            if (matches) {
              for (const m of matches) {
                const clean = m.replace(/url\((['"]?)(.*?)\1\)/, '$2');
                try {
                  const absoluteUrl = new URL(clean, sheet.href || window.location.href).href;
                  urls.push(absoluteUrl);
                } catch {}
              }
            }
          }
        }
      } catch (e) {
        // cross-origin stylesheet
      }
    }
    return urls;
  });

  // Also extract any <link rel="preload" as="font"> or <link rel="stylesheet">
  const preloadFontUrls = await page.evaluate(() => {
    const list = [];
    document.querySelectorAll('link[rel="preload"][as="font"], link[rel="stylesheet"]').forEach(el => {
      if (el.href) list.push(el.href);
    });
    return list;
  });

  console.log(`Found ${discoveredFontUrls.length} @font-face URLs and ${preloadFontUrls.length} preload/css URLs`);
  for (const fUrl of [...discoveredFontUrls, ...preloadFontUrls]) {
    if (fUrl.match(/\.(woff2|woff|ttf|otf)(\?.*)?$/i) && !processedUrls.has(fUrl)) {
      console.log(`Explicitly fetching missed font: ${fUrl}`);
      try {
        const fontRes = await context.request.get(fUrl);
        if (fontRes.ok()) {
          const buf = await fontRes.body();
          processedUrls.add(fUrl);
          const fname = getSafeFilename(fUrl, fontRes.headers()['content-type'], '.woff2');
          const targetPath = path.join(fontsDir, fname);
          fs.writeFileSync(targetPath, buf);
          savedFiles.fonts.push({
            url: fUrl,
            file: path.relative(pageDir, targetPath),
            bytes: buf.length,
            contentType: fontRes.headers()['content-type']
          });
          fontMediaRequests.push({
            url: fUrl,
            method: 'GET',
            status: fontRes.status(),
            resourceType: 'font',
            contentType: fontRes.headers()['content-type'],
            savedFile: path.relative(pageDir, targetPath)
          });
          console.log(`  [EXPLICIT FONT SAVED] ${fname} (${buf.length} bytes)`);
        }
      } catch (e) {
        console.warn(`Could not fetch font ${fUrl}: ${e.message}`);
      }
    }
  }

  // Write Network tab filtered by Font and Media log
  const fontMediaJsonPath = path.join(pageDir, 'network_font_and_media.json');
  fs.writeFileSync(fontMediaJsonPath, JSON.stringify(fontMediaRequests, null, 2), 'utf8');

  // Write all network requests log
  const allRequestsJsonPath = path.join(pageDir, 'network_all_requests.json');
  fs.writeFileSync(allRequestsJsonPath, JSON.stringify(allRequests, null, 2), 'utf8');

  // Write page summary
  const summary = {
    title: pageConfig.title,
    url: pageConfig.url,
    capturedAt: new Date().toISOString(),
    domFile: 'rendered_dom.html',
    domLength: renderedDom.length,
    counts: {
      cssFiles: savedFiles.css.length,
      jsBundles: savedFiles.js.length,
      fontFiles: savedFiles.fonts.length,
      mediaFiles: savedFiles.media.length,
      totalFontMediaRequests: fontMediaRequests.length,
      totalNetworkRequests: allRequests.length
    },
    savedFiles
  };

  fs.writeFileSync(path.join(pageDir, 'capture_summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Completed ${pageConfig.title}:`);
  console.log(`- CSS: ${savedFiles.css.length}`);
  console.log(`- JS: ${savedFiles.js.length}`);
  console.log(`- Fonts: ${savedFiles.fonts.length} (including .woff2)`);
  console.log(`- Media: ${savedFiles.media.length}`);
  console.log(`- Font/Media requests: ${fontMediaRequests.length}`);

  await page.close();
  await context.close();

  return summary;
}

async function main() {
  if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

  console.log('Launching Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox'
    ]
  });

  const overallResults = [];

  for (const pageConfig of PAGES_TO_CAPTURE) {
    try {
      const summary = await capturePage(browser, pageConfig);
      overallResults.push(summary);
    } catch (err) {
      console.error(`Failed to capture ${pageConfig.title}:`, err);
    }
  }

  await browser.close();

  // Create master manifest
  const masterSummaryPath = path.join(BASE_DIR, 'master_manifest.json');
  fs.writeFileSync(masterSummaryPath, JSON.stringify(overallResults, null, 2), 'utf8');
  console.log(`\n==================================================`);
  console.log(`ALL CAPTURES COMPLETED! Master manifest saved to ${masterSummaryPath}`);
  console.log(`==================================================`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
