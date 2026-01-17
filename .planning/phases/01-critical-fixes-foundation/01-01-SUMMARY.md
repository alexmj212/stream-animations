---
phase: 01-critical-fixes-foundation
plan: 01
subsystem: infrastructure
tags: [timing, cache, lifecycle, requestAnimationFrame, AbortController, Map, delta-time, LRU]

# Dependency graph
requires:
  - phase: initial
    provides: Existing AnimatedBar class with offscreen canvas caching pattern
provides:
  - DeltaTimer class for frame-rate independent animations
  - LRUCache class for bounded memory management
  - AnimationLifecycle class for automatic event listener cleanup
affects: [01-02-configuration, 01-03-memory-leaks, background-scene, stinger-scene, sidebar-scene]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Delta-time animation using requestAnimationFrame timestamp
    - Map-based LRU cache with time-tracking
    - AbortController for event listener lifecycle management

key-files:
  created:
    - src/shared/timing.js
    - src/shared/timing.test.js
    - src/shared/cache.js
    - src/shared/cache.test.js
    - src/shared/lifecycle.js
    - src/shared/lifecycle.test.js
  modified: []

key-decisions:
  - "Use null instead of 0 for DeltaTimer.lastTimestamp initialization to handle timestamp=0 correctly"
  - "Cap delta-time at 0.1 seconds (100ms) to prevent tab-switch jumps"
  - "Conservative LRU cache defaults: maxSize=50, maxAgeMs=60000"
  - "Use Date.now() for cache access time tracking (not performance.now()) to reduce overhead"
  - "Single AbortController per lifecycle instance for all event listeners"

patterns-established:
  - "Delta-time pattern: Accept rAF timestamp, calculate delta in seconds, cap at maxDeltaTime"
  - "LRU pattern: Move accessed items to end by delete+set, evict oldest (first) on size limit"
  - "Lifecycle pattern: Pass signal to addEventListener options, single abort() removes all"

# Metrics
duration: 3min
completed: 2026-01-17
---

# Phase 01 Plan 01: Core Infrastructure Utilities Summary

**Delta-time timing, LRU cache with time-based eviction, and AbortController lifecycle management using native browser APIs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-17T22:49:53Z
- **Completed:** 2026-01-17T22:53:15Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- DeltaTimer provides frame-rate independent animation timing across 60Hz/120Hz/144Hz displays
- LRUCache manages offscreen canvas memory with size-based and time-based eviction strategies
- AnimationLifecycle ensures event listeners are automatically cleaned up on scene unload

## Task Commits

Each task was committed atomically:

1. **Task 1: Create delta-time timing utilities** - `1271c38` (feat)
   - DeltaTimer class with update() method
   - Handles first-frame case (returns 0)
   - Caps delta-time to prevent tab-switch jumps
   - 7 comprehensive tests for 60Hz, 120Hz, varying refresh rates

2. **Task 2: Create LRU cache manager with time-based eviction** - `8826fa7` (feat)
   - LRUCache class with get/set/evictStale/clear methods
   - Native Map for O(1) operations with insertion-order guarantee
   - Dual eviction: size-based (LRU) and time-based (stale)
   - 13 comprehensive tests for LRU behavior and cleanup

3. **Task 3: Create lifecycle management utilities** - `963fbec` (feat)
   - AnimationLifecycle class with addEventListener wrapper
   - AbortController signal passed to all listeners
   - Cleanup callbacks with error handling
   - Automatic beforeunload cleanup trigger
   - 11 comprehensive tests for lifecycle and cleanup

## Files Created/Modified

### Created
- `src/shared/timing.js` - Delta-time timer for frame-rate independent animations
- `src/shared/timing.test.js` - Tests for DeltaTimer across multiple refresh rates
- `src/shared/cache.js` - LRU cache with size and time-based eviction
- `src/shared/cache.test.js` - Tests for LRU behavior and stale eviction
- `src/shared/lifecycle.js` - AbortController-based event listener lifecycle
- `src/shared/lifecycle.test.js` - Tests for lifecycle management and cleanup

### Modified
None

## Decisions Made

**1. Null vs 0 for uninitialized timestamp**
- **Decision:** Use `null` instead of `0` for `DeltaTimer.lastTimestamp` initialization
- **Rationale:** Timestamp can legitimately be 0 on first rAF call. Using `lastTimestamp === 0` check would incorrectly treat second call as first frame if initial timestamp was 0.
- **Impact:** Correct first-frame handling for all timestamp sequences

**2. Delta-time cap value**
- **Decision:** Cap delta-time at 0.1 seconds (100ms)
- **Rationale:** Prevents animation "jumps" when user switches tabs (rAF pauses, returns with large elapsed time). 100ms = 10fps minimum, reasonable floor for animation continuity.
- **Impact:** Smooth animation resumption after tab switches

**3. LRU cache defaults**
- **Decision:** `maxSize=50` and `maxAgeMs=60000` (60 seconds)
- **Rationale:** Conservative starting point. 50 offscreen canvases × ~640KB each = ~32MB max memory. 60 second stale threshold balances memory vs hit rate for long-running streams.
- **Impact:** Prevents unbounded memory growth while maintaining cache effectiveness

**4. Access time tracking approach**
- **Decision:** Use `Date.now()` for access times, not `performance.now()`
- **Rationale:** Access times are for eviction decisions (60+ second intervals), not precision timing. `Date.now()` is simpler and sufficient for this use case. Save `performance.now()` for animation timing where microsecond precision matters.
- **Impact:** Slightly less overhead for cache access tracking

**5. Single AbortController design**
- **Decision:** One AbortController per AnimationLifecycle instance
- **Rationale:** All listeners for a given animation scene should cleanup together. Single `abort()` call removes everything. Simpler than per-listener controllers.
- **Impact:** Guaranteed cleanup with minimal API surface

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**1. DeltaTimer first-frame detection bug (Task 1)**
- **Problem:** Initial implementation used `lastTimestamp === 0` check, which failed when first timestamp was 0
- **Solution:** Changed to `lastTimestamp === null` for uninitialized state detection
- **Resolution time:** Immediate fix after test failure, verified with full test suite
- **Impact:** All tests pass, handles edge case correctly

No other issues - implementation followed RESEARCH.md patterns directly.

## Test Results

All new tests pass:
- ✓ `src/shared/timing.test.js` - 7 tests
- ✓ `src/shared/cache.test.js` - 13 tests
- ✓ `src/shared/lifecycle.test.js` - 11 tests

**Pre-existing test failures (unrelated to this plan):**
- `tests/shared/colors.test.js` - 2 failures in `getColorFromURL()` tests
  - Issue: Function adds '#' prefix but tests expect no prefix
  - Status: Pre-existing bug, tracked separately
  - Impact: Does not affect timing/cache/lifecycle utilities

## User Setup Required

None - no external service configuration required. All utilities use native browser APIs.

## Next Phase Readiness

**Ready for next phase:**
- Delta-time utilities ready for integration into animation loops
- Cache utilities ready to replace unbounded AnimatedBar.offscreenCache
- Lifecycle utilities ready for event listener management in scenes

**Usage notes:**
- DeltaTimer: Call `timer.update(timestamp)` in rAF callback, multiply all movements by returned deltaTime
- LRUCache: Replace `new Map()` with `new LRUCache(maxSize)`, call `evictStale()` periodically via setInterval
- AnimationLifecycle: Use `lifecycle.addEventListener()` instead of direct `addEventListener()`, call `cleanup()` on scene unload (automatically triggered on beforeunload)

**No blockers or concerns.**

---
*Phase: 01-critical-fixes-foundation*
*Completed: 2026-01-17*
