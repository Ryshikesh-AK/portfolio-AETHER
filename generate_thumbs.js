const fs = require('fs');
const path = require('path');

const thumbsDir = path.join(__dirname, 'assets', 'images', 'thumbs');

const ringProjects = [
  { id: '01', title: 'AETHERIA OS', tag: 'SPATIAL', c1: '#11122a', c2: '#6366f1', shape: '<circle cx="200" cy="130" r="50" fill="none" stroke="#818cf8" stroke-width="2"/>' },
  { id: '02', title: 'VANGUARD', tag: 'AERODYNAMICS', c1: '#0a1724', c2: '#06b6d4', shape: '<path d="M 80 150 Q 200 70 320 140" fill="none" stroke="#22d3ee" stroke-width="3"/>' },
  { id: '03', title: 'MONOFORM', tag: 'VARIABLE TYPE', c1: '#1c0f16', c2: '#f43f5e', shape: '<text x="200" y="150" font-family="monospace" font-size="56" font-weight="700" fill="none" stroke="#fb7185" stroke-width="2" text-anchor="middle">M95</text>' },
  { id: '04', title: 'LUMINA', tag: 'BIOCLIMATIC', c1: '#0c1a14', c2: '#10b981', shape: '<polygon points="200,60 260,170 140,170" fill="none" stroke="#34d399" stroke-width="2"/>' },
  { id: '05', title: 'SOLARIA', tag: 'CLEAN GRID', c1: '#1f1308', c2: '#f97316', shape: '<polygon points="200,70 250,130 200,190 150,130" fill="none" stroke="#fb923c" stroke-width="2"/>' },
  { id: '06', title: 'NEURAL CHRONO', tag: 'QUANTUM HUD', c1: '#18122b', c2: '#a855f7', shape: '<circle cx="200" cy="130" r="45" fill="none" stroke="#c084fc" stroke-width="2" stroke-dasharray="6 4"/>' },
  { id: '07', title: 'STRATA AUDIO', tag: 'ACOUSTICS', c1: '#091c24', c2: '#0284c7', shape: '<path d="M 120 130 Q 160 80 200 130 T 280 130" fill="none" stroke="#38bdf8" stroke-width="2.5"/>' },
  { id: '08', title: 'HYPERION', tag: 'ROBOTICS', c1: '#1f1c09', c2: '#eab308', shape: '<rect x="150" y="80" width="100" height="100" fill="none" stroke="#facc15" stroke-width="2" rx="12"/>' },
  { id: '09', title: 'VECTOR LABS', tag: 'COMPUTATION', c1: '#1a1028', c2: '#ec4899', shape: '<ellipse cx="200" cy="130" rx="65" ry="30" fill="none" stroke="#f472b6" stroke-width="2"/>' },
  { id: '10', title: 'PULSE SYNAPSE', tag: 'BIO-SIGNAL', c1: '#0f1a24', c2: '#14b8a6', shape: '<polyline points="100,130 160,130 180,90 200,170 220,110 240,130 300,130" fill="none" stroke="#2dd4bf" stroke-width="2"/>' },
  { id: '11', title: 'PRISM FORM', tag: 'OPTICS', c1: '#1c1524', c2: '#d946ef', shape: '<polygon points="200,65 270,185 130,185" fill="none" stroke="#e879f9" stroke-width="2"/>' },
  { id: '12', title: 'OBSIDIAN CORE', tag: 'CRYPTOGRAPHY', c1: '#141418', c2: '#94a3b8', shape: '<polygon points="200,70 260,105 260,155 200,190 140,155 140,105" fill="none" stroke="#cbd5e1" stroke-width="2"/>' },
  { id: '13', title: 'KINETIC ARCHIVE', tag: 'GENERATIVE', c1: '#240d12', c2: '#ef4444', shape: '<circle cx="200" cy="130" r="40" fill="none" stroke="#f87171" stroke-width="2"/><line x1="120" y1="130" x2="280" y2="130" stroke="#f87171" stroke-width="1.5"/>' }
];

ringProjects.forEach((p, idx) => {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" width="400" height="260">
  <defs>
    <linearGradient id="g_${p.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.c2}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${p.c1}" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <rect width="400" height="260" fill="${p.c1}" rx="12"/>
  <rect width="400" height="260" fill="url(#g_${p.id})" opacity="0.3" rx="12"/>
  <rect x="1" y="1" width="398" height="258" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" rx="11"/>

  <!-- Graphical shape -->
  ${p.shape}

  <!-- Typography metadata -->
  <text x="24" y="38" font-family="'Space Mono', monospace" font-size="11" font-weight="700" fill="${p.c2}" letter-spacing="1.5">// ${p.id}</text>
  <text x="376" y="38" font-family="'Space Mono', monospace" font-size="10" fill="rgba(255,255,255,0.5)" text-anchor="end" letter-spacing="1">${p.tag}</text>
  
  <text x="24" y="228" font-family="'General Sans', system-ui, sans-serif" font-size="18" font-weight="700" fill="#ffffff" letter-spacing="-0.3">${p.title}</text>
</svg>
`;

  const fname = `thumb-${idx + 1}.svg`;
  fs.writeFileSync(path.join(thumbsDir, fname), svg.trim(), 'utf8');
  console.log(`Created thumbnail: ${fname} (${p.title})`);
});
