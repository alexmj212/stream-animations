---
phase: 03-performance-optimization
plan: 01
subsystem: monitoring
tags: [performance, monitoring, overlay, localStorage, P99, frame-drops, dev-tools]

# Dependency graph
requires:
  - phase: 01-config-centralization
    provides: Unified configuration system and validation patterns
  - phase: 02-testing-infrastructure
    provides: PerformanceMonitor class with FPS tracking
  - phase: 03-02
    provides: Performance config schema with overlay and monitoring settings
provides:
  - Real-time performance overlay with FPS, memory, P99, dropped frames
  - localStorage session storage with FIFO eviction (50 session limit)
  - window.perfMonitor console API for runtime inspection
  - 'P' hotkey toggle for overlay visibility
  - Per-scene session tracking (background, stinger, sidebar)
affects: [03-03, 03-04, 03-05, 03-06, 03-07, 03-08, performance-audits]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Performance overlay with color-coded thresholds (green/yellow/red)
    - localStorage session management with FIFO eviction on quota
    - P99 frame time calculation for tail latency detection
    - Dropped frame detection using target frame time + 1ms headroom
    - window.perfMonitor API for console-based metrics inspection

key-files:
  created:
    - src/shared/perfStorage.js
    - src/shared/perfOverlay.js
  modified:
    - src/shared/performance.js
    - src/background/index.html
    - src/stinger/index.html
    - src/sidebar/index.html

key-decisions:
  - "P99 frame time tracks tail latency for 99th percentile outliers"
  - "Dropped frames detected when frameTime > targetFrameTime + 1ms"
  - "localStorage enforces 50 session limit with FIFO eviction"
  - "Overlay gated behind ?perf=true URL parameter (opt-in dev tool)"
  - "Color thresholds: FPS 58/55, Memory 250MB/300MB"
  - "Sessions saved on beforeunload for persistence across reloads"

patterns-established:
  - "Performance overlay as opt-in dev tool (not production UI)"
  - "Session storage with aggressive cleanup on QuotaExceededError"
  - "window.perfMonitor API for manual inspection during long stress tests"
  - "Per-scene tracking enables comparison across background/stinger/sidebar"
  - "Hotkey toggle ('P') for non-intrusive metrics during development"

# Metrics
duration: 2min
completed: 2026-01-18
---

# Phase 3 Plan 1: Performance Monitoring Infrastructure Summary

**Real-time performance overlay with P99 tracking, localStorage session persistence, and console API for 4-6 hour stress test instrumentation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-18T05:37:11Z
- **Completed:** 2026-01-18T05:38:59Z
- **Tasks:** 5 (4 auto + 1 checkpoint:human-verify)
- **Files modified:** 6

## Accomplishments
- Extended PerformanceMonitor with P99 frame time calculation and dropped frame tracking
- Created PerformanceStorage module with localStorage persistence and FIFO eviction (50 session limit)
- Built PerformanceOverlay component with color-coded metrics, 'P' hotkey toggle, and window.perfMonitor API
- Integrated performance overlay into all three scenes (background, stinger, sidebar) behind ?perf=true parameter
- Sessions persist across browser reloads with ISO 8601 timestamps and scene identifiers

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend PerformanceMonitor with P99 and dropped frame tracking** - `cedcfdb` (feat)
2. **Task 2: Create session storage module with localStorage persistence** - `0d18a9d` (feat)
3. **Task 3: Create visual performance overlay component** - `166e064` (feat)
4. **Task 4: Integrate performance overlay into all three scenes** - `ffe5cd1` (feat)
5. **Task 5: Human verification checkpoint** - Approved by user

## Files Created/Modified
- `src/shared/performance.js` - Added getP99FrameTime(), getDroppedFrames(), reset(), droppedFrames counter, targetFrameTime property
- `src/shared/perfStorage.js` - NEW: PerformanceStorage class with saveSession(), getSessions(), clearAll(), evictOldSessions() with FIFO cleanup
- `src/shared/perfOverlay.js` - NEW: PerformanceOverlay class with show/hide/toggle, setupHotkey(), startSession/endSession(), window.perfMonitor API exposure
- `src/background/index.html` - Added ?perf=true detection, overlay initialization, perfMonitor.recordFrame() in animate loop
- `src/stinger/index.html` - Added ?perf=true detection, overlay initialization, perfMonitor.recordFrame() in animate loop
- `src/sidebar/index.html` - Added ?perf=true detection, overlay initialization, perfMonitor.recordFrame() in animate loop

## Decisions Made
- P99 frame time tracks tail latency for 99th percentile outliers (critical for identifying frame drops during long sessions)
- Dropped frames detected when frameTime exceeds targetFrameTime + 1ms headroom (accounts for measurement noise)
- localStorage enforces 50 session limit with FIFO eviction (oldest sessions removed first to prevent quota errors)
- Overlay gated behind ?perf=true URL parameter as opt-in dev tool (not production UI, zero overhead when disabled)
- Color-coded thresholds: FPS 58/55 (green/yellow/red), Memory 250MB/300MB based on 03-02 performance config
- Sessions saved on beforeunload event for persistence across browser reloads
- window.perfMonitor API provides getCurrentMetrics(), getSessions(), getAverages(), start/stop/reset(), clearHistory() for console-based inspection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully with existing infrastructure.

## User Setup Required

None - overlay auto-initializes when ?perf=true parameter present. No external services or credentials required.

## User Observation

User noted performance is worse when GPU acceleration is OFF (expected - CPU fallback is slower). This will be important context for Wave 2 audits (alpha channel impact in 03-04, frame rate validation in 03-05).

## Next Phase Readiness

Ready for Phase 3 Wave 2 audits:
- Performance overlay provides real-time metrics for alpha channel audit (03-04)
- P99 tracking detects tail latency during frame rate tests (03-05)
- Session storage enables comparison before/after dirty rectangles (03-06)
- Dropped frame counter validates optimization impact
- window.perfMonitor API ready for 4-6 hour stress test inspection
- All three scenes instrumented identically for consistent measurement

**Key capabilities unlocked:**
- Visual feedback during development (?perf=true)
- Historical session data for trend analysis (localStorage)
- Console API for manual inspection during long-running tests
- Per-scene tracking for isolating performance differences

---
*Phase: 03-performance-optimization*
*Completed: 2026-01-18*
