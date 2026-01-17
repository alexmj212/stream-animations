# External Integrations

**Analysis Date:** 2026-01-17

## APIs & External Services

**None:**
- This project has zero external API integrations
- All code runs entirely client-side in the browser
- No network requests are made during runtime

## Data Storage

**Databases:**
- None

**File Storage:**
- Local filesystem only
- Built animations stored in `dist/` directory
- Each animation is a self-contained HTML file

**Caching:**
- Browser cache only (standard browser behavior)
- No explicit caching implementation

## Authentication & Identity

**Auth Provider:**
- None - No authentication required
- Animations are static client-side HTML files

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- Console-based performance monitoring (optional)
- Enabled via URL parameter `?perf=true`
- Implementation: `src/shared/performance.js`

## CI/CD & Deployment

**Hosting:**
- Local filesystem (primary use case for OBS)
- Can be hosted on any static file server

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- None - All configuration via URL parameters

**Secrets location:**
- Not applicable - No secrets required

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Browser APIs Used

**HTML5 Canvas API:**
- Primary rendering engine
- 2D context with optional alpha channel
- Used in all animation files

**URL API:**
- URLSearchParams - Parse configuration from query strings
- Used in: `src/stinger/index.html`, `src/background/index.html`, `src/sidebar/index.html`

**DOM APIs:**
- requestAnimationFrame - Animation loop
- window resize events - Canvas responsiveness
- Custom events - `transitionStart` event for stinger animation trigger

**Browser Rendering:**
- Designed for OBS Browser Source (Chromium-based)
- Requires HTML5 Canvas support
- Requires ES6 module support

---

*Integration audit: 2026-01-17*
