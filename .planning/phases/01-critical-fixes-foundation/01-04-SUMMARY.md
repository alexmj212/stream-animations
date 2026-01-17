---
phase: 01-critical-fixes-foundation
plan: 04
subsystem: animation-timing
tags: [delta-time, lifecycle-management, frame-rate-independence, memory-management, background-scene]

# Dependency graph
requires:
  - phase: 01-01
    provides: DeltaTimer and AnimationLifecycle infrastructure
  - phase: 01-02
    provides: Centralized config with timing constants
  - phase: 01-03
    provides: AnimatedBar base class with update(deltaTime) signature and framesToSeconds() helper
provides:
  - Background scene fully migrated to delta-time system
  - Unified 60fps frame rate (removed mixed 30fps/60fps system)
  - Lifecycle cleanup integrated into background scene
  - BackgroundBar using time-based animation (elapsed time, not frame counting)
affects: [01-05-sidebar-migration, 01-06-stinger-migration, future-animation-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Delta-time integration pattern: import DeltaTimer/AnimationLifecycle, calculate deltaTime in animate(timestamp), pass to all update() calls"
    - "Time-based animation pattern: track elapsedTime/phaseStartTime, convert frame durations to seconds using framesToSeconds(), check time thresholds instead of frame counts"
    - "Lifecycle cleanup pattern: register cleanup callbacks for intervals/resources, automatic cleanup on page unload"

key-files:
  created: []
  modified:
    - src/background/index.html
    - src/background/BackgroundBar.js

key-decisions:
  - "Removed mixed frame rate system (30fps background/60fps foreground) in favor of unified 60fps for both layers"
  - "Size animation uses smooth interpolation with easeInOutCubic for visual quality"
  - "Direction changes and size transitions tracked independently with separate time accumulators"

patterns-established:
  - "Scene migration pattern: import timing/lifecycle infrastructure, add deltaTimer/lifecycle instances, update animate() to receive timestamp, pass deltaTime to all update() calls, register cleanup callbacks"
  - "Time-based Bar pattern: replace frame counting with elapsed time accumulation, convert all frame-based durations to seconds, multiply movement by deltaTime"

# Metrics
duration: 15min
completed: 2026-01-17
---

# Phase 1 Plan 4: Background Scene Migration Summary

**Background scene migrated to delta-time system with unified 60fps frame rate, lifecycle cleanup, and time-based bar animation replacing frame counting**

## Performance

- **Duration:** ~15 min (estimated from commit timestamps)
- **Started:** 2026-01-17T18:05:00Z (estimated)
- **Completed:** 2026-01-17T23:21:59Z
- **Tasks:** 2 + 1 checkpoint + 2 auto-fixes
- **Files modified:** 2

## Accomplishments
- Background scene integrated with DeltaTimer and AnimationLifecycle infrastructure
- Removed mixed frame rate system (30fps/60fps split) - both layers now update at 60fps
- BackgroundBar converted from frame counting to time-based animation using elapsed time
- Lifecycle cleanup registered for cache interval cleanup on page unload
- Frame-rate independence verified through CPU throttling tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate delta-time and lifecycle cleanup into background scene** - `ba6a416` (feat)
2. **Task 2: Convert BackgroundBar to time-based animation** - `3b3d2a6` (feat)
3. **Auto-fix: Initialize animation loop correctly** - `f04fc81` (fix)
4. **Auto-fix: Correct size animation to preserve bar tips** - `c78c7d3` (fix)
5. **Task 3: Human verification checkpoint** - approved by user

**Plan metadata:** (pending this commit)

## Files Created/Modified
- `src/background/index.html` - Added DeltaTimer and AnimationLifecycle imports, calculate deltaTime in animate(timestamp), removed mixed frame rate system (frameCount % 2), pass deltaTime to all bar update() calls, register cleanup callback
- `src/background/BackgroundBar.js` - Replaced frame counting with time accumulation (elapsedTime, phaseStartTime, directionChangeTime, sizeTransitionTime), converted frame-based durations to seconds, phase transitions based on elapsed time, movement multiplied by deltaTime

## Decisions Made
- **Unified frame rate:** Removed the mixed 30fps/60fps system where background layer updated every other frame. Both background and foreground layers now update every frame at 60fps. This eliminates stuttering on slow-moving bars and simplifies the animation loop.
- **Separate time tracking:** Direction changes and size transitions use independent time accumulators (directionChangeTime, sizeTransitionTime) rather than sharing phase time. This allows transitions to continue across phase boundaries.
- **Smooth size interpolation:** Size animation uses easeInOutCubic interpolation between current and target size multipliers for smoother visual transitions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed animation loop initialization**
- **Found during:** Task 1 (Testing background scene after delta-time integration)
- **Issue:** Animation loop never started - animate() function defined but never called. Browser showed static frame with no movement.
- **Fix:** Added `requestAnimationFrame(animate);` after function definition to start the animation loop
- **Files modified:** src/background/index.html
- **Verification:** Opened background scene in browser, confirmed animation running smoothly
- **Committed in:** `f04fc81` (separate fix commit)

**2. [Rule 1 - Bug] Corrected size animation to preserve bar tips**
- **Found during:** Task 2 (Visual inspection of size transitions)
- **Issue:** Size animation was modifying width/height directly, causing bar endpoints (caps/tips) to be cut off. The AnimatedBar class expects width/height to remain constant and uses sizeMultiplier for scaling during draw.
- **Fix:** Changed size animation to update sizeMultiplier/currentSizeMultiplier/targetSizeMultiplier instead of width/height properties. Added smooth interpolation using easeInOutCubic for visual quality.
- **Files modified:** src/background/BackgroundBar.js
- **Verification:** Visual inspection confirmed bars maintain proper tips/caps during size transitions
- **Committed in:** `c78c7d3` (separate fix commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes were necessary for correct operation. The animation loop initialization was required to see any animation at all. The size animation fix preserved the visual quality of the bars (maintaining tips/caps). No scope creep.

## Issues Encountered
None beyond the auto-fixed issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

**Ready for next phase:**
- Background scene fully migrated to delta-time system
- Pattern established for scene migration (sidebar and stinger can follow same approach)
- Time-based animation pattern demonstrated in BackgroundBar
- Frame-rate independence verified through CPU throttling tests
- Memory stability verified (cache cleanup working correctly)

**Next steps:**
- Migrate sidebar scene (01-05) using same pattern
- Migrate stinger scene (01-06) using same pattern
- After all scenes migrated, can add comprehensive tests (Phase 02)

---
*Phase: 01-critical-fixes-foundation*
*Completed: 2026-01-17*
