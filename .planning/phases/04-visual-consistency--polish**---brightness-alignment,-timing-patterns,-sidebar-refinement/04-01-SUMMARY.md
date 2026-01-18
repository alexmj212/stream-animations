---
phase: 04-visual-consistency-polish
plan: 01
subsystem: config
tags: [configuration, validation, timing, brightness, vitest]

# Dependency graph
requires:
  - phase: 01-memory-timing-bugs
    provides: "Configuration centralization with validation patterns"
  - phase: 02-comprehensive-testing
    provides: "Test patterns with vitest and property-based testing"
  - phase: 03-performance-optimization
    provides: "Performance config schema and validation"
provides:
  - "Shared timing structure (config.shared.durations) for millisecond-based animation timing"
  - "Per-scene duration overrides (config.background.durations) for scene-specific timing control"
  - "Per-scene brightness multipliers (config.*.brightness) for visual harmony"
  - "Validation functions for durations, brightness, easing, and sidebar positioning"
  - "Comprehensive test coverage (24 new tests) for new validation logic"
affects: [04-02, 04-03, animation-scenes, visual-consistency]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Millisecond-based timing configuration (durations.*Ms)"
    - "Per-scene overrides pattern (shared.durations + scene.durations)"
    - "Brightness multiplier pattern (0-1 range, applied to colors)"

key-files:
  created: []
  modified:
    - src/config/config.js
    - src/config/validation.js
    - src/config/validation.test.js

key-decisions:
  - "Shared timing defaults in config.shared.durations (1000ms entry/exit, 2000ms hold)"
  - "Background timing overrides slower than shared defaults (2000ms entry/exit vs 1000ms)"
  - "Brightness multipliers at 0.8 across all scenes (20% reduction for visual harmony)"
  - "Duration validation ranges: 100-10000ms for transitions, 0-30000ms for holds, 0-300000ms for background holds"
  - "Sidebar positioning validates logical constraint: sidebarStart + sidebarWidth <= 1.0 (warns if exceeded)"
  - "Easing function validation accepts any string (format validation only, not method existence check)"

patterns-established:
  - "Per-scene duration overrides: scenes can override shared.durations defaults with scene-specific values"
  - "Brightness multiplier application: 0-1 range multiplied against color values for consistent dimming"
  - "Graceful degradation for timing: validation clamps invalid values and warns without blocking"

# Metrics
duration: 2min
completed: 2026-01-18
---

# Phase 04 Plan 01: Config Schema Extension Summary

**Millisecond-based timing structure and brightness multipliers added to config schema with comprehensive validation and 45 passing tests**

## Performance

- **Duration:** 2 minutes (147 seconds)
- **Started:** 2026-01-18T22:56:49Z
- **Completed:** 2026-01-18T22:59:16Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Extended config schema with shared.durations (defaultMs, entryMs, exitMs, holdMs) for timing harmonization
- Added config.background.durations with per-scene overrides (2000ms entry/exit, 30000-120000ms hold range, 3000ms transitions)
- Added brightness multipliers to all scenes (background, stinger, sidebar) at 0.8 value
- Implemented validation functions for durations (100-10000ms), brightness (0-1), easing functions, and sidebar positioning
- Added 24 new tests with 100% pass rate (45 total tests passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend config.js with shared timing, per-scene durations, and per-scene brightness** - `df6684f` (feat)
2. **Task 2: Extend validation.js with timing and brightness validators** - `d42ac02` (feat)
3. **Task 3: Add validation tests for new config properties** - `8cd47fb` (test)

## Files Created/Modified
- `src/config/config.js` - Added config.shared.durations, config.shared.easingFunction, config.background.durations, config.*.brightness fields with inline documentation
- `src/config/validation.js` - Added validateDurations(), validateBrightness(), validateEasingFunction(), validateSidebarPositioning() with graceful degradation
- `src/config/validation.test.js` - Added 24 new tests covering duration validation, brightness validation, easing validation, and sidebar positioning validation (45 total tests)

## Decisions Made

**Timing structure decisions:**
- Shared defaults use 1000ms for entry/exit transitions (smooth transition matching easeInOutCubic feel)
- Background overrides use 2000ms for entry/exit (background fades slower than other scenes)
- Hold duration defaults to 2000ms in shared, background uses 30000-120000ms range (30-120 second visible time)
- Transition duration for background direction changes set to 3000ms

**Brightness decisions:**
- All scenes use 0.8 brightness multiplier (20% reduction for visual harmony)
- Applied consistently across background, stinger, and sidebar scenes
- Validation enforces 0-1 range with graceful degradation

**Validation ranges:**
- Transition durations: 100-10000ms (0.1-10 seconds)
- Hold durations: 0-30000ms (0-30 seconds) for shared, 0-300000ms (0-5 minutes) for background
- Brightness: 0-1 (percentage multiplier)
- Sidebar positioning: 0-1 (viewport percentages), warns if sidebarStart + sidebarWidth > 1.0

**Easing function:**
- Config documents 'easeInOutCubic' but validation accepts any string (format validation only)
- Implementation hardcoded in AnimatedBar.easeInOutCubic() method
- Config exists for documentation and future extensibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed smoothly with no unexpected problems.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02 (Background Bar Migration):**
- config.background.durations structure created and validated
- config.background.brightness field available for color multiplier application
- config.shared.durations provides fallback defaults for migration

**Ready for Plan 03 (Stinger/Sidebar Migration):**
- config.stinger.brightness and config.sidebar.brightness fields created
- config.shared.durations provides shared timing patterns
- Validation functions ready for runtime config verification

**Breaking config change documented:**
- Plan 02 will migrate BackgroundBar.js from frame-based timing to millisecond-based durations
- Existing config.background.timing (frame-based) will coexist during migration
- Final removal of frame-based timing after migration complete

**No blockers or concerns** - all validation functions tested and working correctly.

---
*Phase: 04-visual-consistency-polish*
*Completed: 2026-01-18*
