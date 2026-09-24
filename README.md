# portfolio-AETHER

Portfolio and creative studio site for Ashin Krishna (AETHER / Kinetic Studio).

## Overview

- **Frontend**: Vanilla JS, HTML5, CSS3, Three.js (WebGL 3D centerpiece and interactive scatter cards), GSAP (ScrollTrigger & animations), and Lenis smooth scrolling.
- **Backend**: Lightweight Node.js Express server with SQLite (`better-sqlite3`), image processing (`sharp`, `multer`), and an authenticated admin dashboard for project & media management.
- **Gallery**: Dynamic 3D interactive portfolio gallery.

## Getting Started

### 1. Install dependencies
```bash
npm install
cd server && npm install && cd ..
```

### 2. Start the development server
```bash
npm start
```
The server will be available at `http://localhost:3000`.

- **Main site**: `http://localhost:3000/`
- **Gallery**: `http://localhost:3000/gallery/`
- **Admin**: `http://localhost:3000/admin/`
