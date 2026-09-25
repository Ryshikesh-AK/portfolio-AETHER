// Seed data transcribed from the existing frontend:
//   works cards      -> index.html (.project-card)
//   modal details    -> scripts/main.js (projectData)
//   hero cards       -> scripts/webgl-distort.js (setupScatteredCards -> projects[])
//   site copy        -> index.html
// Nothing here is new content. Image paths are kept exactly as the frontend references them
// (including the U+2026 ellipsis in the Neobrutalist filename).

const IMG = 'assets/images/';
const NEO = IMG + 'Neobrutalist_digital_art_geometr_20260918114558.jpeg';

const categories = [
  { slug: 'spatial',       label: 'SPATIAL' },
  { slug: 'telemetry',     label: 'TELEMETRY' },
  { slug: 'identity',      label: 'IDENTITY' },
  { slug: 'systems',       label: 'SYSTEMS' },
  { slug: 'photography',   label: 'PHOTOGRAPHY' },
  { slug: 'architecture',  label: 'ARCHITECTURE' },
  { slug: 'editorial',     label: 'EDITORIAL' },
  { slug: 'analog',        label: 'ANALOG' },
  { slug: 'videography',   label: 'VIDEOGRAPHY' },
  { slug: 'cinematic',     label: 'CINEMATIC' },
  { slug: 'commercial',    label: 'COMMERCIAL' },
  { slug: 'experimental',  label: 'EXPERIMENTAL' }
];

// Hero scatter cards, in engine order (index = heroSlot).
const hero = [
  { id: '01', title: 'AETHERIA OS',           tag: 'NEOBRUTALISM // SPATIAL',       src: IMG + 'thumbs/thumb-11.jpeg' },
  { id: '02', title: 'SWISS KINETIC',          tag: 'SWISS STYLE // TELEMETRY',      src: IMG + 'thumbs/thumb-12.jpeg' },
  { id: '03', title: 'BAUHAUS COMPOSITION',    tag: 'BAUHAUS // VARIABLE TYPE',      src: IMG + 'thumbs/thumb-2.jpeg' },
  { id: '04', title: 'BRUTALIST ARCHITECTURE', tag: 'BRUTALIST ARCHITECTURE',        src: IMG + 'thumbs/thumb-3.jpeg' },
  { id: '05', title: 'VAPORWAVE GRID',         tag: 'RETRO-GRID // CONTINENTAL OS',  src: IMG + 'thumbs/thumb-13.jpeg' },
  { id: '06', title: 'GEOMETRIC QUANTUM',      tag: 'GEOMETRIC // QUANTUM HUD',      src: IMG + 'thumbs/thumb-6.jpeg' },
  { id: '07', title: 'FLUID KALEIDOSCOPE',     tag: 'FLUID DYNAMICS // ACOUSTICS',   src: IMG + 'thumbs/thumb-8.jpeg' },
  { id: '08', title: 'CORPORATE VECTOR',       tag: 'VECTOR ROBOTICS',               src: IMG + 'thumbs/thumb-4.jpeg' },
  { id: '09', title: 'MEMPHIS DESIGN',         tag: 'MEMPHIS DESIGN // COMPUTATION', src: IMG + 'thumbs/thumb-9.jpeg' },
  { id: '10', title: 'MINIMALIST SWISS',       tag: 'MINIMALIST // BIO-SIGNAL',      src: IMG + 'thumbs/thumb-10.jpeg' },
  { id: '11', title: 'DE STIJL OPTICS',        tag: 'DE STIJL // OPTICS',            src: IMG + 'thumbs/thumb-5.jpeg' },
  { id: '12', title: 'FLOATING SPHERE',        tag: 'MINIMAL SPHERICAL // CRYPTO',   src: IMG + 'thumbs/thumb-7.jpeg' },
  { id: '13', title: 'BOTANICAL GRID',         tag: 'BOTANICAL // GENERATIVE',       src: IMG + 'thumbs/thumb-1.jpeg' }
];

// The 5 works cards. heroSlot links each to the hero card that uses the same image
// (thumb-11/12/2/3/13 are byte-identical to these 5 images).
const works = [
  {
    id: '1', heroSlot: 0, categories: ['spatial', 'systems'],
    title: 'AETHERIA OS', subtitle: 'SPATIAL COMPUTING // 2026',
    meta: 'NEOBRUTALISM // SPATIAL COMPUTING', year: '2026',
    deliverables: 'Spatial Design System, Holographic HUD, Ambient Audio Engine, Micro-Interactions',
    tech: 'Three.js, WebGL 2.0, Web Audio API, GSAP Motion, Shaders',
    desc: 'Aetheria OS represents our exploration into post-screen spatial interaction. Built around an acoustic ambient field, the interface dynamically warps visual density based on cognitive auditory feedback. Every UI primitive responds to gravity vectors with sub-pixel inertia.',
    image: NEO, alt: 'Aetheria OS Interface', badges: ['SPATIAL // 01', 'THREE.JS SHADER']
  },
  {
    id: '2', heroSlot: 1, categories: ['telemetry', 'identity'],
    title: 'VANGUARD KINETIC', subtitle: 'HYPERCAR TELEMETRY // 2026',
    meta: 'SWISS STYLE // TELEMETRY & AERODYNAMICS', year: '2026',
    deliverables: 'CAN-Bus Telemetry HUD, Aerodynamic Visualizer, Type Foundry Specimen',
    tech: 'WebGL Real-Time Shaders, Vector Aerodynamics, Custom GLSL',
    desc: 'High-speed aerodynamic telemetry system designed for an electric hypercar concept. The interface translates live wind-tunnel turbulence and tyre temperature telemetry into an intuitive HUD dashboard optimized for 300+ km/h reaction times.',
    image: IMG + 'Swiss_style_graphic_design_layout_20260918114558.jpeg',
    alt: 'Vanguard Kinetic Telemetry', badges: ['AERO // 02', 'HUD SYSTEM']
  },
  {
    id: '3', heroSlot: 2, categories: ['identity', 'systems'],
    title: 'MONOFORM FOUNDRY', subtitle: 'ALGORITHMIC TYPE // 2025',
    meta: 'BAUHAUS // VARIABLE TYPE FOUNDRY', year: '2025',
    deliverables: 'Variable Font Specimen Site, Glyphs Engine, Interactive Type Tester',
    tech: 'Variable Font Axes, CSS Houdini, Kinetic Typography',
    desc: 'Monoform Foundry investigates the intersection between architectural Brutalism and dynamic variable typography. The site generates algorithmic specimens in real time based on scroll velocity and audio frequency inputs.',
    image: IMG + 'Bauhaus_geometric_art_composition_20260918114558.jpeg',
    alt: 'Monoform Variable Type Foundry', badges: ['TYPE // 03', 'VARIABLE SPECIMEN']
  },
  {
    id: '4', heroSlot: 3, categories: ['identity', 'spatial'],
    title: 'LUMINA BIOCLIMATIC', subtitle: 'SUSTAINABLE ARCH // 2025',
    meta: 'BRUTALIST ARCHITECTURE // SPATIAL IDENTITY', year: '2025',
    deliverables: 'Identity Architecture, Solar Radiation Interactive Map, Spatial Signage',
    tech: 'Three.js Solar Shaders, Parametric Timber Simulation',
    desc: 'A comprehensive brand and digital presence for a carbon-negative pavilion in Scandinavia. The design system incorporates continuous real-time solar tracking with live shadow projections rendered natively in WebGL.',
    image: IMG + 'Brutalist_architecture_graphic_20260918114558.jpeg',
    alt: 'Lumina Bioclimatic Pavilion', badges: ['ARCH // 04', 'SOLAR SHADOWS']
  },
  {
    id: '5', heroSlot: 4, categories: ['systems', 'telemetry'],
    title: 'SOLARIA ENERGY', subtitle: 'CONTINENTAL TELEMETRY // 2026',
    meta: 'RETRO-GRID // CONTINENTAL ENERGY OS', year: '2026',
    deliverables: 'Grid Control OS, Continental Energy Flow Map, Real-time Alerts',
    tech: 'High-frequency WebSocket Data, Canvas 2D, WebGL Shaders',
    desc: 'A planetary telemetry dashboard mapping solar and offshore wind energy distribution across Europe. Employs multi-layer vector canvas pipelines to render over 20,000 live turbine points without frame latency.',
    image: IMG + 'Vaporwave_grid_landscape_sunset_20260918114558.jpeg',
    alt: 'Solaria Continental Energy Grid', badges: ['GRID // 05', 'REALTIME WS STREAM']
  }
];

const photography = [
  {
    id: 'p1', categories: ['photography', 'architecture', 'analog'],
    title: 'BRUTALIST MONOLITH', subtitle: 'ARCHITECTURAL GEOMETRY // 2026',
    meta: 'ARCHITECTURAL FORM // 35MM FILM', year: '2026',
    deliverables: 'Monochrome Architectural Study, Museum Print Edition, Spatial Morphology',
    tech: 'Leica M6, Summicron 35mm f/2, Kodak Tri-X 400 Silver Gelatin',
    desc: 'An architectural investigation documenting raw concrete brutalist structures and stark geometric cantilever forms. Shot exclusively on high-contrast 35mm black-and-white film to emphasize tactile texture and harsh sunlight shadow planes.',
    image: IMG + 'photo-1-architecture.jpg',
    alt: 'Brutalist Monolith Architectural Photography', badges: ['ARCH // 35MM', 'LEICA // F/8']
  },
  {
    id: 'p2', categories: ['photography', 'editorial'],
    title: 'AVANT-GARDE SHADOW', subtitle: 'HAUTE COUTURE SILHOUETTE // 2026',
    meta: 'HAUTE COUTURE // EDITORIAL PORTRAITURE', year: '2026',
    deliverables: 'Editorial Lookbook, Sculptural Fashion Direction, High-Key Chiaroscuro',
    tech: 'Medium Format Digital, Broncolor Para Lighting, Monochromatic Grading',
    desc: 'High-concept fashion editorial centered on architectural silhouettes and extreme chiaroscuro. The series examines the boundary between garment structure and monolithic spatial form with precision studio lighting.',
    image: IMG + 'photo-2-portrait.jpg',
    alt: 'Avant-Garde Shadow & Form Editorial Portrait', badges: ['EDITORIAL // 02', 'CHIAROSCURO']
  },
  {
    id: 'p3', categories: ['photography', 'analog'],
    title: 'VOLCANIC SEASCAPE', subtitle: 'MEDIUM FORMAT ANALOG // 2025',
    meta: 'ANALOG LANDSCAPE // MEDIUM FORMAT', year: '2025',
    deliverables: 'Fine Art Exhibition Portfolio, Archival Pigment Prints, Analog Field Study',
    tech: 'Hasselblad 500C/M, Carl Zeiss 80mm f/2.8, Ilford HP5+ 120 Film',
    desc: 'Documenting the stark coastal geology and basalt monoliths of Nordic volcanic beaches. Captured on medium format roll film under dense sea mist and low Arctic sun, evoking timeless primeval isolation.',
    image: IMG + 'photo-3-landscape.jpg',
    alt: 'Volcanic Seascape Medium Format Analog', badges: ['ANALOG // HASSELBLAD', 'NORDIC MONOLITH']
  }
];

const videography = [
  {
    id: 'v1', categories: ['videography', 'cinematic', 'commercial'],
    title: 'KINETIC HYPERCAR DRIFT', subtitle: 'DIRECTOR OF PHOTOGRAPHY // 2026',
    meta: 'DIRECTOR OF PHOTOGRAPHY // 2026', year: '2026',
    deliverables: '4K DCI Cinema Master, High-Speed Pursuit Pipeline, Anamorphic Lens Flare Suite',
    tech: 'ARRI Alexa Mini LF, Atlas Orion 2x Anamorphic, Gyro-Stabilized Pursuit Rig',
    desc: 'High-octane nocturnal cinema spot tracking an electric hypercar through rain-slicked Tokyo highways. Features horizontal blue anamorphic flares, visceral wet-surface light reflections, and authentic motion-picture texture.',
    image: IMG + 'video-1-hypercar.jpg',
    alt: 'Kinetic Hypercar Drift Anamorphic Frame', badges: ['REC // 24FPS', '4K DCI ANAMORPHIC']
  },
  {
    id: 'v2', categories: ['videography', 'cinematic', 'commercial'],
    title: 'BRUTALIST ATRIUM // BRAND FILM', subtitle: 'COMMERCIAL DIRECTION // 2025',
    meta: 'COMMERCIAL DIRECTION // 2025', year: '2025',
    deliverables: 'Commercial Direction, Volumetric Lighting Design, Soundscape Synthesis',
    tech: 'RED V-Raptor 8K, Master Primes, Custom LUT Color Architecture',
    desc: 'A moody commercial brand film set in a towering brutalist concrete atrium. Volumetric sun beams cut through morning atmospheric haze to create an ethereal, monumental sense of scale and architectural poetry.',
    image: IMG + 'video-2-fashion.jpg',
    alt: 'Brutalist Atrium Commercial Brand Film', badges: ['ARRI ALEXA 65', 'VOLUMETRIC LIGHT']
  },
  {
    id: 'v3', categories: ['videography', 'experimental'],
    title: 'CYBERNETIC STAGE ECHO', subtitle: 'EXPERIMENTAL LIVE VISUALS // 2026',
    meta: 'EXPERIMENTAL LIVE VISUALS // 2026', year: '2026',
    deliverables: 'Live Stage Visual Engineering, Laser Synchronizer, Real-Time Audio Reactive Shaders',
    tech: 'Kinetix Robotic Rig, TouchDesigner 60FPS Pipeline, Custom GLSL Laser Nodes',
    desc: 'An immersive live performance visual installation fusing kinetic robotic LED arms, synchronized volumetric laser arrays, and real-time audio reactive shader feeds for a futuristic concert experience.',
    image: IMG + 'video-3-stage.jpg',
    alt: 'Cybernetic Stage Echo Live Visuals', badges: ['35MM MOTION', 'GLSL LIVE LASERS']
  }
];

// index.html site copy (About bio/skills are the frontend's existing placeholders, kept as-is).
const site = {
  meta: {
    title: 'AETHER / KINETIC STUDIO \u2014 Brand, Spatial & Generative Engineering',
    description: 'Aether is an independent creative technology and digital design studio engineering tactile digital realities, spatial interfaces, and kinetic typography.'
  },
  hero: { tagline: 'Brand, Spatial & Generative Engineering' },
  ticker: [
    'SPATIAL COMPUTING', 'GENERATIVE SHADERS', 'HYPERCAR TELEMETRY',
    'VARIABLE TYPE FOUNDRY', 'BIOCLIMATIC IDENTITY', 'CONTINENTAL GRID OS'
  ],
  about: {
    label: 'STUDIO // ABOUT ME',
    heading: 'ENGINEERING DIGITAL REALITIES.',
    bio: '[BIO TEXT HERE]',
    photo: 'assets/images/profile.jpg',
    photoAlt: 'Profile Portrait',
    photoBadge: 'STUDIO LEAD // 2026',
    caption: 'DISCIPLINE: BRAND, SPATIAL & GENERATIVE',
    skillsLabel: 'ARSENAL // SKILLS & TOOLS',
    skills: ['[SKILL 1]', '[SKILL 2]', '[SKILL 3]', '[SKILL 4]', '[SKILL 5]', '[SKILL 6]', '[SKILL 7]', '[SKILL 8]'],
    pillarsLabel: 'STUDIO ETHOS & TECHNICAL PILLARS',
    pillars: [
      { num: '01 // VISCERAL SHADERS',      title: 'Kinetic Physics',       desc: 'Sub-pixel inertia, wave displacement, and volumetric shaders calculated in real time on the GPU.' },
      { num: '02 // ARCHITECTURAL TYPE',    title: 'Variable Rhythm',       desc: 'Contemporary grotesques paired with technical mono grids to create unmistakable editorial hierarchies.' },
      { num: '03 // HIGH-SPEED TELEMETRY',  title: 'Instantaneous Latency', desc: 'Optimized zero-jank frame cycles matching 120Hz ProMotion displays with zero unnecessary weight.' },
      { num: '04 // BESPOKE ENGINEERING',   title: 'Autonomous Code',       desc: 'Zero generic component templates. Every transition curve and visual asset tailored to the project DNA.' }
    ]
  },
  works: {
    label: 'SELECTED WORKS // 2024 \u2014 2026',
    heading: 'ENGINEERED EXPERIENCES'
  },
  contact: {
    label: 'START A COLLABORATION',
    heading: 'HAVE A VISION IN MIND?',
    desc: 'We are currently scheduling bespoke digital identities, spatial design systems, and WebGL experiences for Q3/Q4.',
    email: 'studio@aether-kinetic.com',
    mailtoSubject: 'Project Inquiry',
    copyright: '\u00a9 2026 AETHER KINETIC STUDIO. ALL RIGHTS RESERVED.',
    socials: [
      { label: 'GITHUB',      url: 'https://github.com' },
      { label: 'BEHANCE',     url: 'https://behance.net' },
      { label: 'TWITTER / X', url: 'https://twitter.com' },
      { label: 'INSTAGRAM',   url: 'https://instagram.com' }
    ]
  }
};

module.exports = { categories, hero, works, photography, videography, site };
