# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-17)

**Core value:** The background animation must perform flawlessly with minimal CPU/GPU usage since it runs continuously throughout every stream.
**Current focus:** Phase 2 complete - Ready for Phase 3

## Current Position

Phase: 3 of 4 (Performance Optimization)
Plan: 6 of 8 in current phase
Status: In progress
Last activity: 2026-01-18 — Completed 03-06-PLAN.md (CI Performance Tests)

Progress: [█████████░] 94%

## Performance Metrics

**Velocity:**
- Total plans completed: 18
- Average duration: 37.9 min
- Total execution time: 11.84 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | 61.8min | 12.4min |
| 02 | 8 | 23.1min | 2.9min |
| 03 | 5 | 639.0min | 127.8min |

**Recent Trend:**
- Last 5 plans: 03-06 (3.0min), 03-04 (2.0min deferred), 03-03 (630.0min deferred), 03-01 (2.0min), 03-02 (2.0min)
- Trend: Wave 2 audit plans deferred (~2min each); implementation plans quick (2-3min); audit execution plans slow (630min)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- CI regression tests use generous thresholds: 20% memory headroom, 5-10fps variance to prevent false positives [03-06]
- Memory tests skip gracefully if performance.memory unavailable (not all browsers/CI support it) [03-06]
- Accelerated iteration (1000 cycles) simulates extended rendering without real-time delays [03-06]
- Placeholder baselines with TODO markers await 03-03 and 03-04 audit updates [03-06]
- Frame rate audit execution DEFERRED to post-Wave 3 implementation [03-04]
- Dirty rectangle optimization proceeds WITHOUT baseline performance data [03-04]
- Post-implementation audit recommended to validate optimization impact [03-04]
- Wave 3 implementations rely on runtime monitoring via performance overlay [03-04]
- P99 frame time tracks tail latency for 99th percentile outliers [03-01]
- Dropped frames detected when frameTime > targetFrameTime + 1ms [03-01]
- localStorage enforces 50 session limit with FIFO eviction [03-01]
- Overlay gated behind ?perf=true URL parameter (opt-in dev tool) [03-01]
- Color thresholds: FPS 58/55, Memory 250MB/300MB [03-01]
- Sessions saved on beforeunload for persistence across reloads [03-01]
- Alpha channel enabled by default for all scenes to preserve Phase 4 flexibility [03-02]
- Dirty rectangles disabled by default (enabled=false) until audit proves benefit [03-02]
- Conservative thresholds: maxMemoryMB (300), minFPS (55), targetFPS (60) for 8+ hour streaming [03-02]
- Validation warns but never throws on incompatibilities (graceful degradation) [03-02]
- Per-scene alpha toggles enable A/B testing of GPU memory impact [03-02]
- Use controlled random sequences (mockReturnValueOnce) to ensure identical bar behavior across frame rates [02-07]
- Test phase duration equality rather than waiting for full completion (30-120s visible phase) [02-07]
- Allow 1.5-2px tolerance for position comparisons due to floating-point accumulation differences [02-07]
- Reduce property-based test runs to 50 (from 100) due to integration test cost [02-07]
- Accelerated iteration (1000 iterations) simulates 1+ hour sessions without real-time delays for stress testing [02-08]
- Cache size sampling every 100 iterations detects growth patterns in stress tests [02-08]
- First-half vs second-half average comparison validates cache stability (1.5x tolerance) [02-08]
- Cache size bounded at <= 100 entries as reasonable upper limit in stress tests [02-08]
- Mock random sequences must account for full initialization flow including animateSize check to avoid infinite loops in size multiplier selection [02-04]
- AnimatedBar.cacheCleanupInterval must be cleared in afterEach to prevent memory leaks in test runs [02-04]
- Continuous sampling uses 100ms intervals over 2 second duration for trajectory validation [02-04]
- Property-based tests use seeds 51-53 with 100 runs per property [02-04]
- Use @fast-check/vitest for property-based testing with 100 runs per property [02-03]
- Fixed seeds (48-50) for reproducible test failures [02-03]
- Shared fixtures created early (tests/fixtures/canvas-contexts.js) for reuse across bar tests [02-03]
- Use noNaN constraint for float generators to avoid NaN in easing function tests [02-03]
- Tolerance-based assertions (toBeCloseTo) with 2 decimal places for floating-point comparisons [02-03]
- Property-based tests use fixed seeds (42-51) for reproducible failures [02-02]
- Each property test runs 100 iterations to ensure thorough coverage [02-02]
- DeltaTimer clamps deltas to [0, 0.1] range using Math.max(0, Math.min(rawDelta, maxDeltaTime)) [02-02]
- Use @fast-check/vitest for property-based testing with seeded randomness [02-01]
- Use vitest-canvas-mock for HTMLCanvasElement.getContext() in jsdom [02-01]
- Normalize all hex color outputs to include # prefix for consistency [02-01]
- Phase ordering prioritizes memory leaks and timing bugs before feature work (production-critical)
- Testing phase positioned after config centralization to use constants in tests
- Performance optimization deferred until tests lock down behavior
- Sidebar uses one-shot animation with visibility detection to support OBS browser source toggle behavior [01-05]
- Stinger remains event-driven via transitionStart (not auto-start) [01-05]
- Sidebar animation triggers on visibility change from hidden to visible [01-05]
- Removed mixed frame rate system (30fps/60fps split) in favor of unified 60fps for both layers [01-04]
- Size animation uses smooth interpolation with easeInOutCubic for visual quality [01-04]
- Direction changes and size transitions tracked independently with separate time accumulators [01-04]
- LRUCache replaces plain Map for bounded memory usage [01-03]
- Cache cleanup runs every 30 seconds via setInterval [01-03]
- Cache stats logged only in dev mode via ?perf=true URL parameter [01-03]
- update(deltaTime) signature provides time-based animation foundation [01-03]
- framesToSeconds() helper enables gradual subclass migration from frame-based to time-based logic [01-03]
- Use JavaScript object format instead of JSON for configuration (enables comments and computed values) [01-02]
- Scene-based organization (background/stinger/sidebar/shared) mirrors code structure for maintainability [01-02]
- Graceful degradation: validation failures log warnings and return defaults rather than throwing errors [01-02]
- Inline coordinate system documentation in comments to prevent AI positioning bugs [01-02]
- Use null instead of 0 for DeltaTimer initialization to handle timestamp=0 correctly [01-01]
- Cap delta-time at 0.1 seconds (100ms) to prevent tab-switch jumps [01-01]
- Conservative LRU cache defaults: maxSize=50, maxAgeMs=60000 (60 seconds) [01-01]
- Single AbortController per lifecycle instance for all event listeners [01-01]

### Pending Todos

None yet.

### Blockers/Concerns

**Wave 2 audits deferred:**
- Frame rate audit (03-04) and alpha channel audit (03-03) execution deferred per user decision [03-04]
- Wave 3 implementations (dirty rectangles, GPU optimizations) proceeding without baseline data
- Post-implementation validation recommended to measure optimization impact
- Runtime monitoring via performance overlay (?perf=true) provides development visibility [03-01]

## Session Continuity

Last session: 2026-01-18T17:06:46Z
Stopped at: Completed 03-06-PLAN.md (CI Performance Tests)
Resume file: None

---
*Last updated: 2026-01-18 after 03-06 completion (CI Performance Tests - Regression Detection Operational)*
