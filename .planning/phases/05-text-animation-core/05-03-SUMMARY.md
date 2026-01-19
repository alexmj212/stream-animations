---
phase: 05-text-animation-core
plan: 03
subsystem: animation
tags: [canvas, testing, vitest, fast-check, obs, animation, easing]

# Dependency graph
requires:
  - phase: 05-01
    provides: "Canvas-based text rendering with font loading API integration"
  - phase: 05-02
    provides: "Text scrolling animation with duration calculations"
  - phase: 02
    provides: "Testing infrastructure with vitest and fast-check"
provides:
  - "Unit test suite validating duration and speed calculations"
  - "Property-based tests for calculation invariants"
  - "Continuous motion animation with smooth velocity transitions"
  - "Fixed keyframe positions (0-25%, 25-75%, 75-100%)"
  - "White text color (removed color URL parameter)"
affects: [06-curtain-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Property-based testing for animation calculations using fast-check"
    - "Easing derivative functions for smooth velocity transitions"
    - "Position-based continuous motion animation (not discrete phases)"

key-files:
  created:
    - tests/shade/ShadeBar.test.js
  modified:
    - src/shade/ShadeBar.js
    - src/shade/index.html

key-decisions:
  - "Animation is ONE continuous motion with velocity transitions (not three separate stop-start animations)"
  - "Text color is always white (removed color URL parameter for consistent branding)"
  - "Keyframe positions: Enter (0-25%), Hold (25-75%), Exit (75-100%) of viewport width"
  - "easeInOutCubicDerivative() calculates instantaneous velocity for smooth acceleration/deceleration"
  - "Phase-specific velocities calculated in init() from keyframe positions and durations"

patterns-established:
  - "Property-based test pattern: duration >= minDuration invariant"
  - "Property-based test pattern: scroll speed always positive"
  - "Property-based test pattern: deterministic calculation verification"
  - "Continuous motion pattern: position-based animation with smooth velocity transitions"

# Metrics
duration: 134min
completed: 2026-01-19
---

# Phase 05 Plan 03: Text Animation Testing & Continuous Motion Summary

**Comprehensive unit test suite with property-based testing, plus continuous motion animation rewrite for smooth velocity transitions (white text only)**

## Performance

- **Duration:** 2h 14min
- **Started:** 2026-01-19T18:08:12Z
- **Completed:** 2026-01-19T20:22:13Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Complete unit test suite for ShadeBar duration and speed calculations with edge cases
- Property-based tests validate calculation invariants (duration >= min, speed > 0, deterministic)
- Rewrote animation from discrete phases to continuous motion with smooth velocity transitions
- Fixed keyframe positions to 25/50/25 split (0-25%, 25-75%, 75-100%)
- Removed color URL parameter - text is always white for consistent branding

## Task Commits

Each task was committed atomically:

1. **Task 1: Create unit tests** - `43135bc` (test)
2. **Task 2: User verification with fixes** - `0a22ec8` (fix)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `tests/shade/ShadeBar.test.js` - Unit tests and property-based tests for duration/speed calculations (27 tests)
- `src/shade/ShadeBar.js` - Continuous motion animation with velocity transitions, white text color
- `src/shade/index.html` - Removed color URL parameter, always use white

## Decisions Made

**Animation architecture:**
- Animation is ONE continuous motion with velocity changes (not three separate animations)
- Position calculated from total elapsed time across entire animation
- Velocity transitions smoothly between phases: fast → slow → fast
- easeInOutCubicDerivative() provides instantaneous velocity for smooth acceleration/deceleration

**Keyframe positions (corrected after user testing):**
- Enter phase: Text left edge moves from canvas.width (offscreen right) to canvas.width * 0.25 (25% viewport)
- Hold phase: Text left edge moves from canvas.width * 0.25 to 0 (left edge of viewport) - slow marquee
- Exit phase: Text left edge moves from 0 to -textWidth (fully offscreen left) - accelerated exit
- Uses easeOut for entrance (smooth deceleration), linear for hold (constant velocity), easeIn for exit (smooth acceleration)

**Branding consistency:**
- Text color is always white (config.shade.text.color)
- Removed color URL parameter for consistent visual identity
- No custom colors allowed - enforces brand standards

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Animation treated phases as separate stop-start motions**
- **Found during:** Task 2 (checkpoint user feedback)
- **Issue:** Animation was implemented as three discrete phases with hard transitions, creating stop-start feel instead of continuous motion
- **Fix:** Rewrote update() method to use position-based animation with smooth velocity transitions. Removed discrete phase tracking (phase, elapsedTime) in favor of totalAnimationTime. Added easeInOutCubicDerivative() for smooth velocity changes between phases.
- **Files modified:** src/shade/ShadeBar.js
- **Verification:** Tests pass, animation logic is continuous
- **Committed in:** 0a22ec8 (Task 2 fix commit)

**2. [Rule 1 - Bug] Keyframe positions incorrect**
- **Found during:** Task 2 (checkpoint user feedback)
- **Issue:** Animation keyframes didn't match user specification (25/50/25 split)
- **Fix:** Recalculated keyframe positions: enterEndX = 25% viewport, holdEndX = 75% viewport (text 25% offscreen), exitEndX = fully offscreen left
- **Files modified:** src/shade/ShadeBar.js
- **Verification:** Keyframe calculations in init() match 25/50/25 split
- **Committed in:** 0a22ec8 (Task 2 fix commit)

**3. [Rule 2 - Missing Critical] easeInOutCubicDerivative() for smooth velocity**
- **Found during:** Task 2 (checkpoint user feedback)
- **Issue:** Animation needed smooth velocity transitions between phases, but no derivative function existed
- **Fix:** Added easeInOutCubicDerivative() method to calculate instantaneous velocity from position easing function
- **Files modified:** src/shade/ShadeBar.js
- **Verification:** Method correctly calculates derivative for t < 0.5 and t >= 0.5 cases
- **Committed in:** 0a22ec8 (Task 2 fix commit)

**4. [Rule 1 - Bug] Color URL parameter violated branding consistency**
- **Found during:** Task 2 (checkpoint user feedback)
- **Issue:** Color URL parameter allowed custom colors, user specified text must always be white
- **Fix:** Removed color parameter from ShadeBar constructor, removed color field, changed draw() to use config.shade.text.color (white). Updated index.html to remove color URL parsing.
- **Files modified:** src/shade/ShadeBar.js, src/shade/index.html, tests/shade/ShadeBar.test.js
- **Verification:** Tests updated to match new constructor signature, all pass
- **Committed in:** 0a22ec8 (Task 2 fix commit)

**5. [Rule 1 - Bug] Keyframe positions still incorrect after first fix (2026-01-19 user testing)**
- **Found during:** User browser testing after plan completion
- **Issue:** Three specific problems found: (1) Momentum not conserved between phases, (2) Entrance ending too late, (3) Exit incomplete
- **Root cause:** holdEndX was still wrong (canvas.width * 0.75 moved text RIGHT), and easing functions created velocity discontinuities
- **Fix:** Corrected keyframes to: enterEndX = canvas.width * 0.25, holdEndX = 0 (left edge of viewport), exitEndX = -textWidth. Replaced easeInOutCubic with easeOut (enter) and easeIn (exit) for smoother velocity transitions. Removed derivative function.
- **Files modified:** src/shade/ShadeBar.js
- **Verification:** Manual calculation verified all phases move left with correct keyframe positions
- **Committed in:** 75d64a1 (fix commit 2026-01-19)

---

**Total deviations:** 5 auto-fixed (4 bugs, 1 missing critical)
**Impact on plan:** All auto-fixes were necessary to match user's animation vision. Original implementation was technically correct but conceptually wrong - treated animation as three separate motions instead of one continuous motion. Second round of fixes (after user testing) corrected keyframe positions and easing functions for proper momentum conservation.

## Issues Encountered

**Checkpoint feedback revealed fundamental animation misunderstanding:**
The original plan and implementation treated enter/hold/exit as three separate animations with discrete phase transitions. User feedback clarified this was wrong - animation should be ONE continuous motion with smooth velocity changes (fast → slow → fast) and momentum preservation between phases. This required rewriting the animation architecture from discrete phase-based to continuous position-based motion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 06 (Curtain Integration):**
- ShadeBar animation validated with comprehensive unit tests
- Continuous motion animation with smooth velocity transitions
- White text color enforced for consistent branding
- Duration and speed calculations tested for edge cases
- Property-based tests verify calculation invariants
- OBS browser source compatibility maintained (explicit fillStyle, font loading)

**Animation characteristics for curtain integration:**
- Enter phase: 1000ms fast rush in (0-25% viewport)
- Hold phase: Dynamic duration based on text length (25-75% viewport)
- Exit phase: 1000ms fast rush out (75-100% viewport)
- Total animation time: enterDurationMs + holdDurationMs + exitDurationMs
- Position calculated from totalAnimationTime (continuous motion)

**No blockers or concerns.**

---
*Phase: 05-text-animation-core*
*Completed: 2026-01-19*
