# Neo-Brutalist Design System Conversion Plan

Convert the site aesthetics to a bold Neo-Brutalist design system while preserving all 3D animation physics, ring rotation, float, spiral unwind, depth scaling, and tilt logic.

## Design Tokens & Visual Architecture

### 1. Palette & Surface Colors
- **Background**: Raw off-white `#f5f5f0` (canvas clear color `0xf5f5f0`).
- **Primary Accent**: Electric Neo-Yellow `#f5ff00` (high-voltage contrast against pure black).
- **Secondary Accent**: Acid Hot Pink `#ff2a5f` (for select interactive badges/indicators).
- **Ink / Borders / Solids**: Pitch Black `#000000`.
- **Card Surfaces**: Pure White `#ffffff` and Light Tint `#ecece5`.

### 2. Neo-Brutalist Foundations
- **Corners**: `border-radius: 0px` globally across all components, cards, navigation pills, tags, and buttons.
- **Borders**: 3px to 4px solid black (`border: 3px solid #000000`) on all cards, buttons, headers, and grid containers.
- **Shadows**: Zero-blur hard offset shadows: `box-shadow: 6px 6px 0px #000000` (collapsing on hover/active to `2px 2px 0px #000000` with slight translate for punchy tactile tactile feedback).
- **Navigation Dock**: Replace glassmorphism/frosted-glass with a solid Electric Yellow `#f5ff00` or White bar with 3px black border, 5px 5px hard shadow, and black text with solid black active pill.

### 3. Typography
- **Headings / Display**: `Space Grotesk` (Google Fonts, 700/800 ExtraBold) paired with chunky uppercase letterforms.
- **Mono / Labels / Data**: `Space Mono` (400/700), raw monospace for coordinates, stats, categories, and timestamps.
- **Micro-labels & Badges**: Monospace uppercase inside black-bordered pill-boxes with hard shadows.

---

## Proposed Changes

### [HTML / Head](file:///c:/Ashi/index.html)
- Load `Space Grotesk` from Google Fonts alongside existing `Space Mono`.
- Retain semantic structure, ids, and classes so GSAP animations hook in seamlessly.

### [CSS Stylesheet](file:///c:/Ashi/styles/main.css)
- Overhaul `:root` variables:
  - `--bg-color: #f5f5f0`
  - `--accent-color: #f5ff00` (Electric Yellow)
  - `--accent-pink: #ff2a5f`
  - `--text-primary: #000000`
  - `--border-brutal: 3px solid #000000`
  - `--shadow-hard: 6px 6px 0px #000000`
  - `--shadow-hard-sm: 4px 4px 0px #000000`
- Remove all `backdrop-filter: blur()`, gradients, and soft box-shadows.
- Set `border-radius: 0px !important` on cards, tags, buttons, header dock, status pill.
- Replace project cards with bold 3px black border, white surface, and hard offset shadow.
- Replace cursor with a brutalist square reticle or sharp crosshair.

### [WebGL Engine](file:///c:/Ashi/scripts/webgl-distort.js)
1. **Renderer Clear Color**: Update clear color to `0xf5f5f0`.
2. **Card Fragment Shader**:
   - Change geometry cutout to sharp 0px corners (strict rectangular boundary $x \in [-b_x, b_x], y \in [-b_y, b_y]$).
   - Add thick 3.5px solid black border (`color.rgb = vec3(0.0)` for perimeter).
   - Remove soft rim light; preserve chromatic aberration with crisp raw sampling.
   - Maintain depth cueing (`uDepth`) for subtle value shifts across 3D orbit.
3. **Hard-Edged Sticker Drop Shadows**:
   - Replace blurred SDF shadow shader with a **flat hard-edged sticker shadow**:
     - Solid black shape (`#000000`) with sharp rectangular boundary (0 blur, 100% opacity, 1px anti-aliased edge).
     - Geometry: exact card dimensions ($285 \times 178$).
     - Position: offset down-right (e.g. $+10\text{px} X, -12\text{px} Y, -4\text{px} Z$).
     - Renders beneath the card mesh, generating the definitive neo-brutalist "sticker" drop shadow.
4. **Motion Math**:
   - Keep 100% of the 3D position, tilt, orbit rotation, float, and spiral unwind math intact.

---

## Verification Plan

### Automated / Browser Tests
1. Run Playwright script to verify:
   - Zero console errors / WebGL compilation issues.
   - Renderer clear color is `#f5f5f0`.
   - Card plane and shadow plane transforms track correctly during idle ring and spiral unwind.
   - Frame rate maintains ~60 FPS.
2. Capture visual screenshots:
   - **Hero Ring**: Hard black 3.5px borders, sharp 0px corners, hard sticker offset shadows, Electric Yellow accents, Space Grotesk typography.
   - **50% Spiral Unwind**: Verify hard sticker shadows remain tightly aligned and render without clipping.
   - **Works Section**: Verify brutalist cards with 3px black borders, hard offset shadows, and sharp hover interactions.
