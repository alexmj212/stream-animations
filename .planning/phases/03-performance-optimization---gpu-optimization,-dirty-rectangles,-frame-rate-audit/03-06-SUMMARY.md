---
phase: 03-performance-optimization
plan: 06
subsystem: testing
tags: [vitest, performance, regression-testing, ci, fps, memory]

# Dependency graph
requires:
  - phase: 03-01
    provides: PerformanceMonitor for FPS and frame time tracking
  - phase: 03-05
    provides: Performance thresholds in config.performance.thresholds
provides:
  - CI performance regression test suite with 7 test cases
  - Memory leak detection via stable growth validation
  - FPS degradation detection (55fps floor with CI variance)
  - Frame time consistency checks (P99 < 20ms)
  - Dropped frame percentage validation (<1%)
  - Placeholder baselines with TODO markers for audit updates
affects: [03-03, 03-04, 03-07, 03-08, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [synthetic-stress-testing, accelerated-iteration, generous-ci-thresholds]

key-files:
  created:
    - tests/integration/performance-regression.test.js
  modified: []

key-decisions:
  - "Memory tests skip gracefully if performance.memory unavailable (not supported in all browsers/CI)"
  - "Generous thresholds prevent CI false positives: 20% memory headroom, 5-10fps variance allowance"
  - "Tests detect major regressions (>20% degradation) not minor fluctuations (<10%)"
  - "Placeholder baselines with TODO markers for 03-03 and 03-04 audit updates"
  - "Accelerated iteration (1000 cycles) simulates extended rendering without real-time delays"
  - "Tests use config.performance.thresholds for consistency across test suite and application"

patterns-established:
  - "CI regression tests use synthetic stress scenarios (15/50 bars, 300-1000 iterations)"
  - "Memory stability validated via first-half vs second-half average comparison (1.5x tolerance)"
  - "FPS tests allow CI environment variance (5-10fps slack) to prevent false positives"
  - "Tests provide actionable error messages suggesting possible causes on failure"

# Metrics
duration: 3min
completed: 2026-01-18
---

# Phase 3 Plan 6: CI Performance Tests Summary

**Automated performance regression tests detect memory leaks, FPS degradation, and frame time inconsistencies in CI with placeholder baselines awaiting 03-03/03-04 audit updates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-18T17:03:28Z
- **Completed:** 2026-01-18T17:06:46Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created 7 comprehensive performance regression tests for CI pipeline
- Memory threshold validation: normal load (15 bars), high load (50 bars), stability check
- FPS threshold validation: normal/high load with CI environment variance allowance
- Frame time consistency: P99 < 20ms, dropped frames < 1%
- Tests detect major regressions (verified with artificial expensive operation)
- Comprehensive documentation with CI setup, baseline expectations, and audit update procedure

## Task Commits

Each task was committed atomically:

1. **Task 1 & 2: Create performance regression test suite with documentation** - `ef775bc` (test)

**Plan metadata:** (will be added in final commit)

## Files Created/Modified
- `tests/integration/performance-regression.test.js` - Automated performance regression tests for CI pipeline with 7 test cases validating memory thresholds, FPS floors, P99 frame time, and dropped frame percentage

## Decisions Made

**Memory test graceful degradation:**
- Memory tests skip if `performance.memory` unavailable (not supported in all browsers/CI environments)
- Uses `ctx.skip()` pattern for conditional test execution
- Prevents CI failures in environments without memory API

**Generous CI thresholds:**
- Memory: 20% headroom for normal load (360MB vs 300MB), 50% for high load (450MB)
- FPS: 5fps variance normal load (50fps vs 55fps floor), 10fps high load (45fps)
- Rationale: CI with Xvfb slower than real hardware; detect major regressions (>20%) not minor fluctuations

**Placeholder baseline strategy:**
- Tests functional immediately with estimated baselines (58-60fps normal, 52-58fps high)
- TODO comments in tests 3, 4, 5 reference 03-03-SUMMARY.md and 03-04-SUMMARY.md for updates
- Header JSDoc documents placeholder status and update procedure
- Baselines will be refined after 03-03 alpha audit and 03-04 frame rate audit complete

**Accelerated iteration pattern:**
- Simulate 1000 update cycles (normal load) or 500 cycles (high load) without real-time delays
- Pattern borrowed from Phase 2 stress-testing.test.js
- Enables fast CI execution while stressing cache, lifecycle, and animation loops

**Config-driven thresholds:**
- Tests import and assert against `config.performance.thresholds` values
- Keeps tests synced with application configuration
- Single source of truth for performance targets

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Initial test skip pattern error:**
- Issue: Used `this.skip()` in regular function, caused "Cannot read properties of undefined" error
- Fix: Changed to arrow function with `ctx` parameter: `(ctx) => { ctx.skip(); }`
- Vitest requires context parameter for conditional skipping
- Resolved immediately, tests pass

## Next Phase Readiness

**CI Performance Tests operational:**
- Tests run automatically on every commit
- Detect major regressions (>20% FPS drops, 2x memory growth)
- Skip gracefully if memory API unavailable
- Ready for Wave 3 optimization implementations (03-07, 03-08)

**Baseline update procedure documented:**
- Comprehensive TEST MAINTENANCE section at end of file
- Step-by-step instructions for updating baselines after audits
- References 03-03-SUMMARY.md and 03-04-SUMMARY.md for actual measurements
- Guidance for handling flaky tests and adding new regression tests

**Verification:**
- Tests pass with current codebase (4 pass, 3 skip due to memory API)
- Artificial regression detected successfully (expensive operation caused all FPS tests to fail)
- Regression reverted, tests pass again
- Ready for CI integration

**Post-audit TODO:**
- Update placeholder baselines in tests 3, 4, 5 after 03-03 completes
- Update P99 threshold if 03-04 findings differ from 20ms estimate
- Update header JSDoc BASELINES section with confirmed values
- Consider tightening thresholds if actual baselines significantly better than estimates

---
*Phase: 03-performance-optimization*
*Completed: 2026-01-18*
