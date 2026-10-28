# Scenes

Each scene is `src/<scene>/index.html` plus its classes, and builds to one
self-contained HTML file (`npm run build:<scene>`) for an OBS Browser Source
at 1920x1080 with a transparent background. Tunable numbers for every scene
live in `src/config/config.js`.

| Scene | What it is | Triggered by | URL params |
|---|---|---|---|
| stinger | Curtain-style scene transition: slanted and horizontal bars sweep across | OBS `transitionStart` or `obsSourceActiveChanged` window events (listeners registered at load to catch the first scene change); `?autoplay=true` plays once on load | `color`, `scheme`, `colormode`, `duration`, `seed`, `autoplay`, `perf` |
| sidebar | Slide-in notification panel with animated bars and text | Plays on load (OBS reloads it when the source is shown) | `color`, `scheme`, `colormode`, `text`, `duration`, `seed`, `perf` |
| shade | Raid/alert banner: semi-transparent curtains with large scrolling text | Plays on load (OBS reloads it when the source is shown) | `color`, `scheme`, `colormode`, `text`, `duration`, `seed`, `perf` |
| background | Continuous loop of drifting bars on two canvas layers | Always running | `color`, `speed`, `density` (default 8), `perf` |
| epcot | Spaceship Earth lattice with lit bulbs, patterns and overlays; deployed to GitHub Pages on push to `main` | Always running | Many; see the root README |

The stinger, sidebar and shade paint colored bars from the epcot
Illuminations palette by default, as one screen-fixed top-to-bottom
gradient (`config.palette`, `src/shared/palette.js`); `?scheme=mono` gives
the old single-hue look. See the root README for `scheme` and `colormode`.

`?perf=true` shows the performance overlay on any scene. `?seed=N` pins a
random layout so the same stinger or sidebar plays every time (recording,
motion checks).

## Shared code

- `src/shared/AnimatedBar.js`: base class; scene bars (`BackgroundBar`,
  `StingerBar`, `SidebarBar`, `ShadeBar`, `CurtainBar`) extend it.
- `src/shared/animations/`: pure animation math, unit-tested.
- `src/shared/lifecycle.js`: `AnimationLifecycle` with an `AbortController`,
  so an OBS reload leaves no listeners or loops behind.
- `src/shared/timing.js`, `cache.js`, `dirtyRect.js`, `performance.js`,
  `perfOverlay.js`, `perfStorage.js`: delta time, LRU caches, dirty-rect
  tracking and performance monitoring.

## Fragile areas

From the 2026-01-17 codebase audit (retired `.planning/codebase/CONCERNS.md`):

- **Background bar state machine** (`BackgroundBar.js`): fade in, visible,
  fade out and direction changes interact. Test a full lifecycle and use the
  pure functions in `calculations.js` rather than inline math.
- **Background dual canvas**: bars split across two canvases by speed. Don't
  add logic that depends on which layer a bar is on.
- **Random start positions** (`BackgroundBar.js`): two init paths. Test both
  `randomStart` values.
- **Stinger curtain setup** (`src/stinger/index.html`): large curtain bars
  built with manual overrides tied to canvas size and timing. Untested.
