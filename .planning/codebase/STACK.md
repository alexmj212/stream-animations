# Technology Stack

**Analysis Date:** 2026-01-17

## Languages

**Primary:**
- JavaScript (ES6+ with modules) - All source code

**Secondary:**
- HTML5 - Canvas-based animation entry points
- CSS3 - Minimal styling for canvas elements

## Runtime

**Environment:**
- Browser (client-side only)
- Designed for OBS Browser Sources (Chromium-based)
- Node.js v25.2.1 (development environment)

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Vanilla JavaScript with ES6 modules - No framework dependencies
- HTML5 Canvas API - All rendering

**Testing:**
- Vitest ^4.0.16 - Test runner
- @vitest/ui ^4.0.16 - Test UI interface
- @vitest/coverage-v8 ^4.0.16 - Code coverage reporting
- jsdom ^27.4.0 - DOM environment for testing

**Build/Dev:**
- Vite ^7.3.0 - Build tool and dev server
- vite-plugin-singlefile ^2.3.0 - Bundle to single HTML files
- serve ^14.2.4 - Local HTTP server for development

## Key Dependencies

**Critical:**
- None - Project uses only native browser APIs (Canvas API, URLSearchParams)

**Infrastructure:**
- Vite - Bundles ES6 modules into self-contained HTML files for OBS
- vite-plugin-singlefile - Packages each animation as a single `.html` file with inlined JS

## Configuration

**Environment:**
- No environment variables required
- Configuration via URL parameters:
  - `color` - Base color (hex format)
  - `duration` - Animation duration (stinger)
  - `speed` - Speed multiplier (background)
  - `density` - Bar density (background)
  - `perf` - Enable performance monitoring

**Build:**
- `vite.config.js` - Multi-mode build configuration (stinger/background/sidebar)
- `vitest.config.js` - Test configuration with jsdom environment

## Platform Requirements

**Development:**
- Node.js (modern version, tested with v25.2.1)
- npm or compatible package manager
- Modern browser for testing

**Production:**
- OBS Studio with Browser Source support
- Chromium-based browser engine (built into OBS)
- No server required - animations are self-contained HTML files
- Local filesystem or web server hosting

---

*Stack analysis: 2026-01-17*
