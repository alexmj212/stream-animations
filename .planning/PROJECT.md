# Stream Animations

## What This Is

Browser-based animation scenes for OBS stream graphics, including a persistent background animation and event-driven transitions/notifications. Built with vanilla JavaScript and Canvas API to provide flexible control over stream aesthetics beyond OBS's native animation capabilities.

## Core Value

The background animation must perform flawlessly with minimal CPU/GPU usage since it runs continuously throughout every stream.

## Current State

**Latest shipped:** v1.1 Shade Component (2026-01-20)

**Codebase:**
- 4 complete animation scenes (background, stinger, sidebar, shade)
- 5,774 lines of JavaScript and HTML
- 309 tests passing (100% green)
- Production-ready performance optimizations (offscreen canvas caching, hsla() colors)

**Next milestone focus:** Deployment automation, mini notification bar for stream events, additional scene widgets (follower count, stats)

## Requirements

### Validated

- ✓ Background animation renders continuously with animated bars — existing
- ✓ Stinger transition responds to OBS events with curtain effect — existing
- ✓ Sidebar notification displays with animated bars and text — existing
- ✓ Shared AnimatedBar base class with inheritance pattern — existing
- ✓ Canvas rendering with offscreen caching — existing
- ✓ URL parameter configuration for colors and settings — existing
- ✓ Vitest test suite with coverage reporting — existing
- ✓ Vite builds single-file HTML outputs for OBS — existing
- ✓ All tests passing and accurately describing functionality — v1.0 (265 tests)
- ✓ Performance infrastructure complete across all scenes — v1.0 (validation deferred)
- ✓ Visual consistency: brightness, timing, and styling aligned — v1.0
- ✓ Centralized configuration for colors, timing, and positioning — v1.0
- ✓ Unit tests lock down positioning/timing math — v1.0
- ✓ Clean, maintainable codebase structure — v1.0
- ✓ Sidebar positioning and timing refinements completed — v1.0
- ✓ Shade component with semi-transparent curtains and three-phase lifecycle — v1.1
- ✓ Large scrolling text with velocity-first continuous motion architecture — v1.1
- ✓ Dynamic hold duration based on text length (200ms/word reading speed) — v1.1
- ✓ Text and curtains synchronized with single phase controller — v1.1
- ✓ Offscreen canvas text caching (10-20x performance gain) — v1.1
- ✓ Font Loading API integration preventing race conditions — v1.1
- ✓ Performance validation tooling (window.perfValidation.runAll()) — v1.1

### Active

- [ ] Deployment automation and workflow improvements
- [ ] Mini notification bar for stream events (follows, subs, donations)
- [ ] Additional scene widgets (follower count, subscriber count, stream stats)
- [ ] Phase 3 validation work: Alpha audit, frame rate audit, dirty rectangle validation, long-duration stability test (infrastructure ready - deferred from v1.0)

### Out of Scope

- Live dynamic updates during stream (nice to have for future) — complexity not justified for v1
- URL-based color coordination (experimented, didn't work out) — approach abandoned
- Sharing code publicly or making it generic — personal use only
- Mobile or non-OBS browser support — OBS Chromium is only target
- Accessibility features (alt text, reduced motion) — not needed for stream overlays

## Context

Originally a brownfield "vibe coded" project, now transformed into a maintainable foundation with comprehensive testing (309 tests), performance optimizations, and consistent architecture patterns.

### Current Architecture (v1.1)

- Component-based system with `AnimatedBar` base class and specialized subclasses (`BackgroundBar`, `StingerBar`, `SidebarBar`, `ShadeBar`, `CurtainBar`)
- Pure calculation functions separated from stateful animation classes for testability
- Offscreen canvas caching for expensive rendering operations (text, complex shapes)
- Delta-time normalization for frame-rate independence
- AnimationLifecycle with AbortController for proper cleanup
- Vite builds self-contained HTML files suitable for OBS Browser Sources
- Centralized configuration system with per-scene overrides
- Performance monitoring infrastructure (overlay, storage, CI regression tests)

### Recent Additions (v1.1)

- **Shade component:** Semi-transparent curtains with scrolling text for major stream events
- **Velocity-first animation:** Continuous motion with no discontinuities at phase boundaries
- **Font Loading API integration:** Prevents text measurement race conditions
- **Offscreen canvas text caching:** 10-20x performance gain for large text rendering
- **hsla() GPU optimization:** Baked-in opacity for efficient compositing

### Known Tech Debt

- OBS validation deferred (performance script available but not executed)
- Phase 3 validation work deferred from v1.0 (alpha audit, frame rate audit, dirty rectangle validation, long-duration stability test) - infrastructure complete
- Async font loading could be simplified with top-level await

### Development Workflow

- Primary testing happens in OBS output preview (not browser)
- Occasional browser testing for rapid iteration
- Stinger uses OBS event system (`transitionStart` event) - willing to explore more OBS events
- Unit tests exist to lock down behavior and prevent regressions during AI-assisted coding

## Constraints

- **Platform**: OBS Browser Source (Chromium-based) — single-file HTML outputs required
- **Performance**: Background must be lightweight for continuous rendering — critical constraint
- **Tooling**: Vanilla JavaScript with Canvas API — no framework dependencies, proven approach
- **Testing**: Vitest with jsdom — existing test infrastructure to maintain
- **Build**: Vite with singlefile plugin — current build system works well
- **Audience**: Personal stream only — no need for configurability beyond maintainer's needs

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Canvas API over CSS animations | More control, better performance for complex animations, JavaScript animation libraries available | ✓ Good |
| Class-based inheritance pattern | Shared rendering logic in base class, specialized behavior in subclasses | ✓ Good |
| Pure calculation functions | Testable animation math separate from rendering state, helps prevent AI regressions | ✓ Good |
| Single-file HTML builds | OBS Browser Source compatibility requirement | ✓ Good |
| No bundler runtime overhead | Inline module scripts for minimal performance impact | ✓ Good |
| LRU cache with bounded size (maxSize=50) | Prevents memory exhaustion over long streams, automatic eviction every 30s | ✓ Good |
| Delta-time normalization | Provides frame-rate independence across 30/60/120Hz displays | ✓ Good |
| AnimationLifecycle with AbortController | Ensures proper cleanup on OBS reload, prevents event listener leaks | ✓ Good |
| Property-based testing with @fast-check | Catches edge cases automatically with 2,200+ random validations | ✓ Good |
| Brightness multiplier (0.8) across scenes | Visual harmony without excessive dimming, colors remain vibrant | ✓ Good |
| Millisecond-based timing with shared defaults | Maintainability through per-scene overrides, unified timing approach | ✓ Good |
| Phase 3 validation deferred | Infrastructure complete and tested, empirical validation can be post-milestone | — Pending |
| Velocity-first animation (v1.1) | Eliminates phase boundary discontinuities, position integrated from velocity | ✓ Good |
| 200ms/word reading speed (v1.1) | Calibrated for stream event pacing, matches reading comprehension time | ✓ Good |
| Font Loading API integration (v1.1) | Prevents text measurement race conditions with document.fonts.ready → init() flow | ✓ Good |
| Offscreen canvas text caching (v1.1) | 10-20x performance gain, critical for 96px font with shadow rendering | ✓ Good |
| hsla() colors instead of globalAlpha (v1.1) | GPU-efficient premultiplied alpha compositing, no state management | ✓ Good |
| Word count for duration calculation (v1.1) | Correlates with reading comprehension time better than character count | ✓ Good |
| Optical text centering with actualBoundingBox (v1.1) | Font-specific visual alignment accounts for asymmetric ascent/descent | ✓ Good |
| OBS validation deferred (v1.1) | Implementation complete, performance script available, empirical testing can be post-milestone | — Pending |

---
*Last updated: 2026-01-20 after v1.1 milestone completion*
