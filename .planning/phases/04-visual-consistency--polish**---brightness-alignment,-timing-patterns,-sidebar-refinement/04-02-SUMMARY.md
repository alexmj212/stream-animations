---
phase: 04-visual-consistency-polish
plan: 02
subsystem: animations
tags: [timing, brightness, config, milliseconds, visual-harmony]

# Dependency graph
requires:
  - phase: 04-01
    provides: Config schema with shared.durations, per-scene brightness multipliers, and validation
provides:
  - Millisecond-based timing across all three scenes (BackgroundBar, StingerBar, SidebarBar)
  - Unified brightness multipliers (0.8 = 20% reduction) for visual consistency
  - Shared fallback pattern for timing (config.shared.durations)
  - Per-scene timing overrides (config.background.durations)
affects: [04-03-visual-verification, any future animation timing work, brightness tuning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Millisecond-based timing with ms/1000 conversion to seconds for deltaTime"
    - "Shared timing fallback: scene.durations ?? shared.durations"
    - "Brightness multiplier pattern: baseLightness * config.scene.brightness"

key-files:
  created: []
  modified:
    - src/background/BackgroundBar.js
    - src/stinger/StingerBar.js
    - src/sidebar/SidebarBar.js
    - src/config/config.js

key-decisions:
  - "Millisecond-based timing replaces frame-based timing (AnimatedBar.framesToSeconds removed from BackgroundBar)"
  - "Background overrides shared defaults with slower fades: 2000ms entry/exit vs 1000ms shared default"
  - "Brightness multiplier applied consistently: white bars = 100 * 0.8 = 80, colored bars = baseLightness * 0.8"
  - "Breaking config changes: removed background.timing (fadeInFrames, fadeOutFrames, etc.) and stinger.curtain.lightnessReductionMin/Max"

patterns-established:
  - "Timing fallback pattern: const entryMs = config.scene.durations?.entryMs ?? config.shared.durations.entryMs"
  - "Brightness application: const brightness = config.scene.brightness; this.lightness = baseLightness * brightness"

# Metrics
duration: 2min
completed: 2026-01-18
---

# Phase 4 Plan 2: Timing and Brightness Harmonization Summary

**Millisecond-based timing migration complete across all scenes with 0.8 brightness multipliers for 20% visual harmony reduction**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-18T18:01:02Z
- **Completed:** 2026-01-18T18:02:58Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- BackgroundBar migrated from frame-based timing to millisecond-based with per-scene overrides (2000ms entry/exit)
- StingerBar and SidebarBar updated with shared timing fallback pattern
- Brightness multipliers (0.8) applied consistently: white bars 80 lightness, colored bars baseLightness * 0.8
- Removed unused config properties (background.timing frame-based fields, stinger.curtain.lightnessReduction)

## Task Commits

Each task was committed atomically:

1. **Task 1: Harmonize timing patterns to millisecond-based durations** - `bdc9911` (feat)
2. **Task 2: Apply brightness multipliers for visual consistency** - `bd14762` (feat)
3. **Config cleanup: Remove unused properties** - `8fb37c9` (chore)

## Files Created/Modified
- `src/background/BackgroundBar.js` - Migrated from frame-based to millisecond-based timing, applied brightness multiplier
- `src/stinger/StingerBar.js` - Replaced curtain lightnessReduction with brightness multiplier, added shared fallback
- `src/sidebar/SidebarBar.js` - Applied brightness multiplier for visual consistency
- `src/config/config.js` - Removed unused background.timing and stinger.curtain properties

## Decisions Made

**Timing conversion preserves animation feel:**
- 120 frames @ 60fps = 2000ms (fadeIn/fadeOut)
- 180 frames @ 60fps = 3000ms (direction transition)
- 1800-7200 frames @ 60fps = 30000-120000ms (visible hold duration)

**Background timing overrides:**
- Background uses slower fades (2000ms entry/exit) vs shared default (1000ms)
- Per-scene overrides via config.background.durations with fallback to config.shared.durations

**Brightness multiplier standardization:**
- All scenes now use 0.8 multiplier (20% reduction) for visual harmony
- White bars: `100 * 0.8 = 80` across background, stinger, sidebar
- Colored bars: `baseLightness * 0.8` with Math.max(10, ...) clamping

**Breaking config changes:**
- Removed `background.timing.fadeInFrames`, `fadeOutFrames`, `visibleFramesMin/Max`, `directionTransitionFrames`
- Removed `stinger.curtain.lightnessReductionMin/Max`
- All timing now millisecond-based via `scene.durations` or `shared.durations`
- All brightness now multiplier-based via `scene.brightness`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - timing migration and brightness refactoring proceeded smoothly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 03 (Visual Verification in OBS):**
- All three scenes use millisecond-based timing (frame-based migration complete)
- Brightness multipliers (0.8) applied consistently across all scenes
- Phase 2 frame rate consistency tests pass (no timing regressions)
- All 265 tests pass (no behavior regressions)

**Visual verification needed:**
- Confirm brightness consistency (white bars should be 80 lightness across all scenes)
- Verify timing feel preserved (2-second fades should look smooth)
- Check for any visual artifacts from brightness changes

**No blockers or concerns.**

---
*Phase: 04-visual-consistency-polish*
*Completed: 2026-01-18*
