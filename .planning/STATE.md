# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-17)

**Core value:** The background animation must perform flawlessly with minimal CPU/GPU usage since it runs continuously throughout every stream.
**Current focus:** Phase 3 complete with gaps - Ready for gap closure or Phase 4

## Current Position

Phase: 4 of 4 (Visual Consistency & Polish)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-01-18 — Completed 04-01-PLAN.md (Config Schema Extension)

Progress: [████████░░] 78%

## Performance Metrics

**Velocity:**
- Total plans completed: 18
- Average duration: 38.2 min
- Total execution time: 11.45 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | 61.8min | 12.4min |
| 02 | 8 | 23.1min | 2.9min |
| 03 | 4 | 636.0min | 159.0min |
| 04 | 1 | 2.0min | 2.0min |

**Recent Trend:**
- Last 5 plans: 04-01 (2.0min), 03-05 (4.0min), 03-04 (2.0min deferred), 03-03 (630.0min deferred), 03-01 (2.0min)
- Trend: Configuration and validation tasks complete quickly (~2min); audit/implementation tasks vary widely

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Shared timing defaults in config.shared.durations (1000ms entry/exit, 2000ms hold) [04-01]
- Background timing overrides slower than shared defaults (2000ms entry/exit vs 1000ms) [04-01]
- Brightness multipliers at 0.8 across all scenes (20% reduction for visual harmony) [04-01]
- Duration validation ranges: 100-10000ms for transitions, 0-30000ms for holds, 0-300000ms for background holds [04-01]
- Sidebar positioning validates logical constraint: sidebarStart + sidebarWidth <= 1.0 (warns if exceeded) [04-01]
- Easing function validation accepts any string (format validation only, not method existence check) [04-01]
- Simple union merge strategy for overlapping rectangles - accepts redrawing clean pixels for CPU efficiency (avoids expensive polygon math) [03-05]
- Safety margin of 5px expands dirty regions to catch anti-aliasing and shadow effects [03-05]
- Dirty rectangles disabled by default until post-implementation audit validates benefit [03-05]
- Debug visualization only when BOTH ?perf=true AND visualize=true (explicit opt-in) [03-05]
- Background scene uses separate dirty trackers for background/foreground layers [03-05]
- getBoundingBox() accounts for rotation/skew transforms AND shadow offset [03-05]
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

Last session: 2026-01-18T22:59:16Z
Stopped at: Completed 04-01-PLAN.md (Config Schema Extension)
Resume file: None

---
*Last updated: 2026-01-18 after 04-01 completion (Config Schema Extension - Timing and Brightness Config Added)*
