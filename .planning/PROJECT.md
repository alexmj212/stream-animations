# Stream Animations

## What This Is

Browser-based animation scenes for OBS stream graphics, including a persistent background animation and event-driven transitions/notifications. Built with vanilla JavaScript and Canvas API to provide flexible control over stream aesthetics beyond OBS's native animation capabilities.

## Core Value

The background animation must perform flawlessly with minimal CPU/GPU usage since it runs continuously throughout every stream.

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

### Active

- [ ] All tests passing and accurately describing functionality
- [ ] Performance optimized across all scenes (especially background)
- [ ] Visual consistency: brightness, timing, and styling aligned across scenes
- [ ] Centralized configuration for colors, timing, and positioning
- [ ] Unit tests lock down positioning/timing math to prevent AI coding regressions
- [ ] Clean, maintainable codebase structure for adding new notification types
- [ ] Sidebar positioning and timing refinements completed

### Out of Scope

- Live dynamic updates during stream (nice to have for future) — complexity not justified for v1
- URL-based color coordination (experimented, didn't work out) — approach abandoned
- Sharing code publicly or making it generic — personal use only
- Mobile or non-OBS browser support — OBS Chromium is only target
- Accessibility features (alt text, reduced motion) — not needed for stream overlays

## Context

This is a brownfield project that has been "vibe coded" to work with a personal OBS stream setup. The core concepts are proven and working in production, but the codebase needs cleanup and consolidation to make ongoing maintenance and enhancement sustainable.

### Existing Architecture

- Component-based system with `AnimatedBar` base class and specialized subclasses (`BackgroundBar`, `StingerBar`, `SidebarBar`)
- Pure calculation functions separated from stateful animation classes for testability
- Multi-layered rendering in background scene (30fps background layer, 60fps foreground layer)
- Offscreen canvas caching for performance optimization
- Vite builds self-contained HTML files suitable for OBS Browser Sources

### Known Issues to Address

- Sidebar incomplete/untested (works but needs refinement)
- Test failures in color URL parameter parsing
- Brightness inconsistency between scenes (background reduced 20%, stinger/sidebar still at 100%)
- Offscreen canvas cache grows unbounded (memory leak over long sessions)
- Mixed frame rates in background causing timing inconsistencies
- No centralized configuration system
- Positioning changes by AI often break visual output due to misunderstanding canvas coordinates

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
| Canvas API over CSS animations | More control, better performance for complex animations, JavaScript animation libraries available | — Pending |
| Class-based inheritance pattern | Shared rendering logic in base class, specialized behavior in subclasses | — Pending |
| Pure calculation functions | Testable animation math separate from rendering state, helps prevent AI regressions | — Pending |
| Single-file HTML builds | OBS Browser Source compatibility requirement | ✓ Good |
| No bundler runtime overhead | Inline module scripts for minimal performance impact | — Pending |

---
*Last updated: 2026-01-17 after initialization*
