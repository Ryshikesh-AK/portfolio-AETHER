# ARCHITECTURE.md — Ashi (AETHER / Kinetic Studio portfolio)

> Snapshot of `Ashi_about_reordered.zip` (90 files, last edit 2026-09-21). Written from a read-only code inspection. Nothing was installed, run in a browser, or modified.

**Summary:** a static single-page site: vanilla JS + Three.js + GSAP + Lenis loaded from CDNs. No framework, no bundler, no backend, no network calls. All content (projects, copy, image paths) is hardcoded.

---

## 1. Frontend structure

| Aspect | Current state |
|---|---|
| Framework / build | None. One `index.html`, four classic `<script>` files (no ES modules), one CSS file. No bundler, TypeScript, or transpile step. |
| Libraries (CDN, pinned) | `three@0.149.0`, `gsap@3.12.5` + ScrollTrigger, `lenis@1.1.18`. Fonts from Fontshare and Google Fonts. |
| Routes / pages | One page. Hash anchors only: `#home`, `#studio`, `#works`, `#contact`. No router. Project "detail" is a modal with no URL or deep link. |
| Cache busting | Manual: CSS `?v=15`, scripts `?v=19`. |
| Server | None in the repo. Playwright scripts expect `http://localhost:3000`, but nothing starts it. |

**Boot order** (`main.js`, inside `DOMContentLoaded`; script tags load `webgl-distort → intro → animations → main`):
1. Lenis smooth scroll, synced to the GSAP ticker and ScrollTrigger. Scroll velocity feeds shader uniforms.
2. `new WebGLDistortEngine(canvas)` builds the scene, 13 hero cards, and the wireframe centrepiece. Then `register()` runs once per `.project-card`.
3. `new AnimationController()` does text splitting, `IntroSequence` preloader, ScrollTriggers, dock tracker, and cursor. It queries `.project-card`, `[data-reveal]` and `.skill-tag` **once, at construction**.
4. Filter, modal, email-copy, and BODY/EXPLODED toggle handlers.

**Two independent image-driven WebGL systems share one fullscreen `<canvas id="webgl-canvas">`:**
- **Hero scatter cards** (13). Floating cards with raycast hover and tap/click. Data lives *inside* `webgl-distort.js` (`setupScatteredCards()` → `projects[]` of `{id,title,tag,src}`). Desktop shows 13. Viewports under 768px show 8. Click dispatches `ring-card-click`, which opens the modal with **placeholder text**.
- **Works cards** (5). DOM-driven. `register(mediaWrap, img.src)` creates a plane that tracks the DOM rect every frame. On desktop the `<img class="webgl-texture-source">` is `opacity:0` (texture source only). On mobile, CSS shows it directly.
- The centrepiece is procedural wireframe geometry (no model files). The only loader used is `THREE.TextureLoader`.

**Project data lives in three unlinked places:**

| Location | Holds | Count |
|---|---|---|
| `index.html` `<article.project-card>` | title, subtitle, badges, `data-category`, image | 5 |
| `main.js` `projectData` | modal: meta, year, deliverables, tech, banner, description | 5 (keys `'1'`–`'5'`) |
| `webgl-distort.js` `projects[]` | hero cards: id, title, tag, thumb src | 13 (titles differ from the works, e.g. "SWISS KINETIC" vs "VANGUARD KINETIC") |

Also hardcoded: filter buttons and the "ALL (05)" label, ticker text, About placeholders (`[BIO TEXT HERE]`, `[SKILL 1–8]`), the 4-image list in `intro.js`, and the contact email.

---

## 2. Important files

| File | Role |
|---|---|
| `index.html` (19 KB) | All markup: nav, hero, About, 5 hardcoded work cards, contact, modal shell. |
| `scripts/webgl-distort.js` (1074 lines) | `WebGLDistortEngine`: shaders, centrepiece, hero cards, `register()`, raycasting, tap-vs-scroll, RAF loop. |
| `scripts/intro.js` (383) | `IntroSequence` preloader timeline. Hardcodes 4 image paths and calls `webglEngine.ringOpacity`. |
| `scripts/animations.js` (546) | `AnimationController`: text reveals, ScrollTriggers, hero fade-out, dock, cursor. |
| `scripts/main.js` (410) | Bootstrapper, `projectData`, modal FLIP animation, filters, clipboard. |
| `styles/main.css` (1635 lines) | Design tokens, layout, breakpoints (1024 / 768 / 640 / 430). |
| `package.json` | Only dependency is `playwright ^1.63.0` (test tooling). No `start` or `build` script. |
| `generate_assets.js`, `generate_thumbs.js`, `copy_thumbs.js` | One-off asset scripts (placeholder SVGs; copies JPEGs into `thumbs/`). |
| `verify_*.js`, `capture_*.js`, `mobile_diag.js`, `audit_butter_sections.js` | Playwright checks/screenshots against `localhost:3000`. |
| `test_k95.js`, `capture_k95.js` | Scrape an external reference site (k95.it), not this project. |
| `implementation_plan.md` | **Outdated** (describes an off-white palette and spiral; the site now uses Pale Butter `#F6EFA6`). |

Notes: `animations.js`'s header says its text-reveal logic was "extracted and optimized" from k95.it bundles. Worth a licensing sanity-check before a public launch. Naming has drifted (`ring*` names vs `scatter*` internals).

---

## 3. Current image system

**Everything is local and static.** There is no CDN, no `srcset`/`<picture>`, no resizing, and no build-time optimization.

- **13 source artworks**, 1376×768 or 768×1376 (7 landscape, 6 portrait), 30–550 KB each.
- **Each exists 3 times, byte-identical** (same MD5): `assets/images/<Name>_20260918114558.jpeg`, `assets/images/thumbs/<Name>…jpeg`, and `assets/images/thumbs/thumb-N.jpeg`. `N` is the alphabetical index assigned by `copy_thumbs.js`. The "thumbs" are **not** downscaled.
- Unreferenced files: `project-1..5.svg`, `thumbs/thumb-*.svg` (13), the long-named copies in `thumbs/`, and `profile.jpeg` (duplicate of `profile.jpg`). Folder total is about 10 MB.

| Consumer | Loads via | Files |
|---|---|---|
| Hero cards (13) | `THREE.TextureLoader` (eager, no mipmaps, `LinearFilter`) | `thumbs/thumb-N.jpeg` from `projects[].src` (~3.2 MB) |
| Works cards (5) | `<img loading=lazy>` + `register()` reads `img.getAttribute('src')` → `TextureLoader` | `assets/images/<Name>…jpeg` (~1.2 MB) |
| Intro preloader | 4 `<img>` created in JS | 4 of the works images (hardcoded paths) |
| Modal banner | `setAttribute('src')` from `projectData[id].banner`; hero clicks use `item.src` | works image or thumb |
| About portrait | `<img src="assets/images/profile.jpg" loading=lazy>` | 103 KB |

**Known issues (verified in code/files):**
1. **Double download.** All 5 works images are byte-identical to hero thumbs but sit at different URLs, so the browser fetches both. Desktop first load is about 4.5 MB of images.
2. **Portrait stretch.** The hero shader (`ringFragmentShader`) samples UVs directly with no cover-crop. The 6 portrait images are squashed into 285×178 landscape cards. The works shader *does* cover-crop (`cover()` with per-image aspect).
3. **`…` filename risk.** `index.html` (×2), `main.js`, and `intro.js` reference `Neobrutalist_digital_art_geometr…_2026…jpeg` with a real `…` (U+2026). In the zip, 6 filenames (that one plus 5 others) are stored with a literal `#U2026` and no UTF-8 flag. If they aren't restored on extraction, those paths 404 (works card 1, modal 1, first intro frame). Only the Neobrutalist one is referenced by its long name; the others are reached via `thumb-N`. **Check on your disk:** `ls assets/images | grep Neobrutalist`.
4. **No `crossOrigin`.** `TextureLoader` isn't configured for it. WebGL textures from another origin will fail without CORS headers.

---

## 4. Where a backend should connect

Keep the static front end and add an API behind it. Replace the three hardcoded data blocks with one fetched dataset that keeps the **existing object shapes**.

| # | Seam | Today | Backend replacement |
|---|---|---|---|
| 1 | Works cards | 5 `<article>` in HTML + `projectData` | `GET /api/projects`. Render `.project-card` articles **before** the engine and `AnimationController` initialise (both query cards once). |
| 2 | Hero cards | `projects[]` inside the engine | Preferred: an adapter after `new WebGLDistortEngine` overwrites `webglEngine.scatterItems[i].{title,tag,src}` and swaps `uniforms.uTexture` via `webglEngine.textureLoader`, so **no engine edit** is needed. Fixed capacity: 13 desktop, 8 mobile. |
| 3 | Modal detail | `openModal({title,meta,desc,deliverables,tech,year,banner})` | `GET /api/projects/:id`. Hero clicks should use it too (currently placeholder text). |
| 4 | Filters | Hardcoded buttons and `data-category` | Categories from the API. Replace "ALL (05)" with a computed count. |
| 5 | About | `[BIO TEXT HERE]`, `[SKILL n]` | `GET /api/site`. Fill **before** `AnimationController` runs (it splits `[data-reveal]` text once). |
| 6 | Contact | `mailto:` + copy button, no `<form>` | Optional `POST /api/inquiries`. Needs new markup. |
| 7 | Images | Local paths | Serve **same-origin** (`/media/...`) via a reverse proxy. This avoids CORS on textures. If cross-origin, call `textureLoader.setCrossOrigin('anonymous')` from the adapter and add CORS headers. |
| 8 | Hosting | Nothing on `:3000` | Have the backend serve `index.html` + assets on `:3000` to match the tests. |

Suggested project DTO (mirrors current fields):
```json
{ "id": "1", "slug": "aetheria-os", "title": "AETHERIA OS",
  "meta": "NEOBRUTALISM // SPATIAL COMPUTING", "subtitle": "SPATIAL COMPUTING // 2026",
  "categories": ["spatial", "systems"], "year": "2026",
  "deliverables": "…", "tech": "…", "desc": "…",
  "image": "/media/aetheria-os.jpg", "thumb": "/media/aetheria-os-thumb.jpg",
  "featured": true, "heroSlot": 0 }
```

The API must fail soft: if it is down, fall back to the current hardcoded content so the site still renders.

---

## 5. Files that must NOT be modified

**Frozen. Do not edit** (tuned choreography, shaders, layout; tests and other files depend on their APIs):
- `scripts/webgl-distort.js` — shaders, motion, raycast, and touch logic. Other code depends on `register`, `setRingOpacity`/`ringOpacity`, `setHeroVisibility`, `fadeHeroObjectsIn`, `morphCenterpiece`, `pauseRotation`/`resumeRotation`, `onResize`, `scatterItems`, `renderer`. *Only possible exception:* a one-line data-injection point, with explicit approval. The adapter in §4 avoids it.
- `scripts/intro.js` — timeline timings and the `ringOpacity` handoff. Don't edit even to fix the `…` filename; rename the file on disk instead.
- `scripts/animations.js` — ScrollTrigger and GSAP orchestration, plus the one-time DOM queries.
- `styles/main.css` — layout depends on `.project-card:nth-child(1–5)`. Put new styles in a **new additive file** (e.g. `styles/dynamic.css`) and bump the version query.
- `assets/images/**` originals — don't rename, delete, or optimize in place. Produce optimized copies in a new folder.
- `package.json` / `package-lock.json` — the backend gets its own folder and manifest (e.g. `server/`).

**Integration points. Edit minimally, with approval:** `scripts/main.js` (`projectData`, bootstrap ordering) and `index.html` (card markup, new `<script>` tags).

**Identifiers that must keep their names:**
- IDs: `webgl-canvas`, `ring-card-badge`, `rcb-title`, `rcb-tag`, `app-cursor`, `project-modal`, `modal-*`, `geo-toggle`, `copy-email-btn`.
- Classes and attributes: `.project-card`, `.card-media-wrap`, `.webgl-texture-source`, `[data-reveal]`, `.site-header`, `.nav-link`, `data-project-id`, `data-category`, `data-filter`.
- Globals and events: `window.webglEngine`, `window.lenis`, `window.animController`, `window.introSeq`, `window.introSequenceDone`, and the `ring-card-click` event (`detail: {item, screenRect}`).

**Caution on existing tests.** `verify_*.js` reference `ringItems`, `spiralProgress`, `ringAutoRotation`, and `updateRingPositions`. None exist in the current engine (0 hits; it now uses `scatterItems`). Don't treat them as a regression net until updated.

---

## 6. Recommended implementation plan

1. **Baseline (no code changes).** Serve the site on `:3000` with any static server. Capture desktop and mobile screenshots and a console log as the "before" reference. Confirm the `…` image loads.
2. **Backend skeleton.** Add `server/` with its own manifest. It serves the static site unchanged, plus `/api` and `/media`, same-origin. The site should stay byte-identical.
3. **Data model + seed.** Seed from the existing hardcoded data: 5 works with modal fields, 13 hero items, About copy, categories. Use the §4 DTO shape.
4. **Image pipeline (server-side).** On upload, generate a ~570×356 hero thumb and a full-size banner. Normalize aspect (crop portrait to landscape) to fix the stretch. Use stable ASCII slugs. Stop relying on `thumbs/` duplicates and `copy_thumbs.js`.
5. **Frontend wiring (additive).** New `scripts/api-client.js` (and optional `styles/dynamic.css`). Fetch, render works cards and About text, then start the existing bootstrap. Apply the hero adapter after engine construction. Fall back to bundled content on failure.
6. **Detail + filters.** Wire the modal to `/api/projects/:id` and generate filters from API categories. Keep the works grid at 5 featured slots unless additive CSS is approved (a 6th card would fall outside the `nth-child` rules and collapse to 1 grid column).
7. **Optional.** Admin/upload UI with auth, and the contact-form endpoint.
8. **Verify.** Rewrite the stale Playwright checks for `scatterItems`, then run desktop and mobile. Check zero console errors, no texture/CORS failures, FPS parity with baseline, and that the site still works with the API down.

**Decisions needed from you:** (a) allow a one-line engine edit, or use the no-edit adapter; (b) cap the works grid at 5 slots or approve additive CSS; (c) confirm the `…` filename state on your actual disk.
