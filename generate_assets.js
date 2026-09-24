const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, 'assets', 'images');

const projects = [
  {
    file: 'project-1.svg',
    title: 'AETHERIA OS',
    subtitle: 'SPATIAL COMPUTING & AMBIENT AUDIO INTERFACE',
    tags: 'NEURAL AUDIO // SPATIAL UI // WEAK-GRAVITY HUD',
    bgStart: '#0b0c16',
    bgMid: '#161938',
    bgEnd: '#3b28cc',
    accent: '#6366f1',
    meshColor: 'rgba(99, 102, 241, 0.4)',
    accentGradient: 'linear-gradient(135deg, #6366f1, #a855f7)',
    shapes: `
      <circle cx="960" cy="540" r="380" fill="none" stroke="url(#meshGrad)" stroke-width="1.5" stroke-dasharray="8 6" opacity="0.7"/>
      <circle cx="960" cy="540" r="280" fill="none" stroke="#818cf8" stroke-width="1" opacity="0.5"/>
      <circle cx="960" cy="540" r="140" fill="url(#orbGrad)" opacity="0.85"/>
      <ellipse cx="960" cy="540" rx="480" ry="180" fill="none" stroke="#c084fc" stroke-width="2" transform="rotate(-25 960 540)"/>
      <ellipse cx="960" cy="540" rx="480" ry="180" fill="none" stroke="#60a5fa" stroke-width="1.5" transform="rotate(35 960 540)"/>
      <line x1="200" y1="540" x2="1720" y2="540" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
      <line x1="960" y1="100" x2="960" y2="980" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    `
  },
  {
    file: 'project-2.svg',
    title: 'VANGUARD KINETIC',
    subtitle: 'HYPERCAR TELEMETRY & AERODYNAMIC DESIGN SYSTEM',
    tags: 'ELECTRIC GT // CAN-BUS HUD // CFD STREAMLINES',
    bgStart: '#08080a',
    bgMid: '#15171e',
    bgEnd: '#1e2430',
    accent: '#06b6d4',
    meshColor: 'rgba(6, 182, 212, 0.35)',
    shapes: `
      <path d="M 300 700 Q 600 350 960 380 T 1620 620" fill="none" stroke="#22d3ee" stroke-width="3" opacity="0.8"/>
      <path d="M 260 720 Q 620 330 1000 360 T 1660 600" fill="none" stroke="#0ea5e9" stroke-width="2" opacity="0.6"/>
      <path d="M 340 680 Q 580 370 920 400 T 1580 640" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.4"/>
      <rect x="740" y="380" width="440" height="240" fill="none" stroke="#06b6d4" stroke-width="1.5" rx="8"/>
      <line x1="740" y1="440" x2="1180" y2="440" stroke="#06b6d4" stroke-width="1" stroke-dasharray="4 4" opacity="0.5"/>
      <circle cx="820" cy="510" r="45" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <circle cx="1100" cy="510" r="45" fill="none" stroke="#22d3ee" stroke-width="2"/>
    `
  },
  {
    file: 'project-3.svg',
    title: 'MONOFORM FOUNDRY',
    subtitle: 'ALGORITHMIC VARIABLE TYPE SYSTEM & SPECIMEN',
    tags: 'DYNAMIC GLYPHS // VARIABLE AXES // KINETIC SPECIMEN',
    bgStart: '#0a0a0a',
    bgMid: '#18181b',
    bgEnd: '#27272a',
    accent: '#f43f5e',
    meshColor: 'rgba(244, 63, 94, 0.35)',
    shapes: `
      <text x="960" y="590" font-family="'Space Mono', monospace, sans-serif" font-size="320" font-weight="700" fill="none" stroke="#f43f5e" stroke-width="3" text-anchor="middle" letter-spacing="10" opacity="0.85">M95</text>
      <text x="960" y="590" font-family="'Space Mono', monospace, sans-serif" font-size="320" font-weight="700" fill="none" stroke="#ffffff" stroke-width="1" text-anchor="middle" letter-spacing="10" transform="translate(6, -6)" opacity="0.4">M95</text>
      <rect x="360" y="240" width="1200" height="540" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="12 12"/>
      <line x1="360" y1="510" x2="1560" y2="510" stroke="#f43f5e" stroke-width="1" stroke-dasharray="3 3"/>
    `
  },
  {
    file: 'project-4.svg',
    title: 'LUMINA BIOCLIMATIC',
    subtitle: 'PASSIVE SOLAR PAVILION IDENTITY & SPATIAL GUIDE',
    tags: 'PARAMETRIC TIMBER // BIOCLIMATIC // CARBON ZERO',
    bgStart: '#0d1310',
    bgMid: '#16221c',
    bgEnd: '#1e382b',
    accent: '#10b981',
    meshColor: 'rgba(16, 185, 129, 0.35)',
    shapes: `
      <path d="M 400 800 C 600 400, 800 700, 1000 350 C 1200 650, 1400 350, 1550 750" fill="none" stroke="#10b981" stroke-width="2.5" opacity="0.8"/>
      <path d="M 420 810 C 620 410, 820 710, 1020 360 C 1220 660, 1420 360, 1570 760" fill="none" stroke="#34d399" stroke-width="1.5" opacity="0.5"/>
      <path d="M 440 820 C 640 420, 840 720, 1040 370 C 1240 670, 1440 370, 1590 770" fill="none" stroke="#6ee7b7" stroke-width="1" opacity="0.3"/>
      <circle cx="1000" cy="350" r="16" fill="#34d399"/>
      <circle cx="1200" cy="650" r="12" fill="#10b981"/>
    `
  },
  {
    file: 'project-5.svg',
    title: 'SOLARIA ENERGY',
    subtitle: 'CONTINENTAL SMART-GRID TELEMETRY & OS',
    tags: 'KINETIC ENERGY // INFRASTRUCTURE // HIGH FREQUENCY',
    bgStart: '#140c06',
    bgMid: '#24140b',
    bgEnd: '#3f1f0f',
    accent: '#f97316',
    meshColor: 'rgba(249, 115, 22, 0.35)',
    shapes: `
      <polygon points="960,240 1280,420 1280,720 960,900 640,720 640,420" fill="none" stroke="#f97316" stroke-width="2" opacity="0.8"/>
      <polygon points="960,300 1220,450 1220,690 960,840 700,690 700,450" fill="none" stroke="#fb923c" stroke-width="1" stroke-dasharray="6 6" opacity="0.5"/>
      <line x1="960" y1="240" x2="960" y2="900" stroke="#f97316" stroke-width="1" opacity="0.4"/>
      <line x1="640" y1="420" x2="1280" y2="720" stroke="#f97316" stroke-width="1" opacity="0.4"/>
      <line x1="640" y1="720" x2="1280" y2="420" stroke="#f97316" stroke-width="1" opacity="0.4"/>
      <circle cx="960" cy="570" r="70" fill="none" stroke="#fdba74" stroke-width="2"/>
    `
  }
];

for (const p of projects) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="${p.bgEnd}" stop-opacity="0.85"/>
      <stop offset="50%" stop-color="${p.bgMid}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${p.bgStart}" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="meshGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.accent}"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.2"/>
    </linearGradient>
    <radialGradient id="orbGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="30%" stop-color="${p.accent}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${p.bgStart}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
      <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="1920" height="1080" fill="${p.bgStart}"/>
  <rect width="1920" height="1080" fill="url(#bgGlow)"/>
  <rect width="1920" height="1080" fill="url(#grid)"/>

  <!-- Graphical Elements -->
  ${p.shapes}

  <!-- Project Title and Details Overlays for Rich Canvas Texture -->
  <g opacity="0.9">
    <rect x="120" y="110" width="160" height="34" rx="17" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.15)"/>
    <text x="200" y="132" font-family="'Space Mono', monospace" font-size="12" font-weight="700" fill="${p.accent}" text-anchor="middle" letter-spacing="2">ARCHIVE // 2026</text>
    
    <text x="120" y="930" font-family="'General Sans', sans-serif, system-ui" font-size="68" font-weight="700" fill="#ffffff" letter-spacing="-1">${p.title}</text>
    <text x="120" y="975" font-family="'Space Mono', monospace" font-size="16" fill="rgba(255,255,255,0.65)" letter-spacing="1.5">${p.subtitle}</text>
    
    <text x="1800" y="975" font-family="'Space Mono', monospace" font-size="14" fill="${p.accent}" text-anchor="end" letter-spacing="2">${p.tags}</text>
  </g>

  <!-- Tech Corner Markers -->
  <path d="M 80 120 L 80 80 L 120 80" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
  <path d="M 1840 120 L 1840 80 L 1800 80" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
  <path d="M 80 960 L 80 1000 L 120 1000" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
  <path d="M 1840 960 L 1840 1000 L 1800 1000" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
</svg>
`;

  fs.writeFileSync(path.join(imgDir, p.file), svg.trim(), 'utf8');
  console.log(`Generated: ${p.file}`);
}
