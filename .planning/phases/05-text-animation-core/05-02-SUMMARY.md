---
phase: 05-text-animation-core
plan: 02
subsystem: text-animation
tags: [canvas, text-rendering, scrolling, animation, delta-time, reading-speed]

# Dependency graph
requires:
  - phase: 05-01
    provides: Text rendering foundation with font loading and measurement
provides:
  - Dynamic hold duration calculation based on word count (200ms/word baseline)
  - Scroll speed calculation ensuring full text visibility within hold duration
  - Three-phase animation lifecycle (enter → hold → exit)
  - Frame-rate independent scrolling using delta-time normalization
affects: [05-03, 06-curtain-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Reading speed calculation (200ms/word) with 3-second minimum enforcement
    - Scroll speed formula: (textWidth + canvasWidth) / holdDuration
    - Three-phase animation pattern (enter with easing → hold with linear velocity → exit with easing)
    - Delta-time normalized velocity application for frame-rate independence

key-files:
  created: []
  modified:
    - src/shade/ShadeBar.js
    - src/shade/index.html

key-decisions:
  - "calculateHoldDuration() uses word count (not character count) for reading time correlation"
  - "3-second minimum hold duration enforced regardless of text length"
  - "Scroll speed dynamically calculated to ensure full text scrolls within hold duration"
  - "Enter/exit phases use shared.durations (1000ms) for consistency with stinger/sidebar"
  - "Hold phase uses constant velocity (linear scrolling) for marquee feel"
  - "Enter/exit phases use easeInOutCubic for smooth transitions"

patterns-established:
  - "Pattern 1: Static calculation methods (calculateHoldDuration, calculateScrollSpeed) for testability and reusability"
  - "Pattern 2: Phase-based animation with elapsed time tracking and phase transitions"
  - "Pattern 3: Velocity application using deltaTime multiplication for frame-rate independence"

# Metrics
duration: 2min
completed: 2026-01-19
---

# Phase 5 Plan 2: Text Scrolling Animation Summary

**Dynamic text scrolling with reading-speed-based duration calculation and three-phase animation lifecycle**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-19T18:02:24Z
- **Completed:** 2026-01-19T18:04:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Hold duration automatically calculated from word count using 200ms/word reading speed baseline
- Scroll speed dynamically calculated to ensure full text scrolls within hold duration
- Three-phase animation implemented (enter, hold with scrolling, exit)
- Frame-rate independent animation using delta-time normalization
- Animation lifecycle completes and stops when exit phase finishes

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement hold duration calculation from word count** - `d30ec14` (feat)
2. **Task 2: Implement scrolling animation with three-phase lifecycle** - `a9a68e0` (feat)

## Files Created/Modified
- `src/shade/ShadeBar.js` - Added calculateHoldDuration() and calculateScrollSpeed() static methods, implemented three-phase update() logic with enter/hold/exit animations
- `src/shade/index.html` - Updated animation loop to stop when ShadeBar becomes inactive

## Decisions Made

1. **Word count over character count:** Used word count for duration calculation because it correlates with reading comprehension time (research shows 238-250 WPM average). Character count doesn't reflect reading time.

2. **3-second minimum hold duration:** Enforced minimum regardless of text length to ensure short messages (1-2 words) remain readable and don't feel rushed.

3. **Dynamic scroll speed calculation:** Speed calculated from text width and hold duration to ensure full text scrolls across screen within hold phase. Formula: `(textWidth + canvasWidth) / holdDurationMs * 1000`.

4. **Shared durations for enter/exit:** Used `config.shared.durations.entryMs` (1000ms) and `exitMs` (1000ms) for consistency with stinger/sidebar animations established in Phase 04.

5. **Easing for enter/exit, linear for hold:** Enter and exit phases use `easeInOutCubic` for smooth transitions. Hold phase uses constant velocity for classic marquee scrolling feel.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed RESEARCH.md patterns and CONTEXT.md decisions without issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Text animation core is complete with:
- Text rendering (05-01)
- Scrolling animation with dynamic timing (05-02)

Ready for Phase 06 curtain integration to synchronize text animation with curtain open/close phases.

**Blockers:** None

**Concerns:** None - all TEXT requirements met, frame-rate independence verified via DeltaTimer integration.

---
*Phase: 05-text-animation-core*
*Completed: 2026-01-19*
