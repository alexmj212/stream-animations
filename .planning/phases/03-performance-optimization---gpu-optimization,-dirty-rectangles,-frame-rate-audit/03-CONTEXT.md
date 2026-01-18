# Phase 3: Performance Optimization - Context

**Gathered:** 2026-01-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Minimize GPU operations and memory usage for continuous rendering. This phase optimizes the animation system built in Phases 1-2 to reduce resource consumption during long streams (8+ hours). Focus on alpha channel usage audit, frame rate consistency validation, dirty rectangle optimization, and comprehensive performance monitoring infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Alpha Channel Strategy

**Approach:**
- Keep alpha enabled for all bar types (background, stinger, sidebar) to preserve visual flexibility for Phase 4
- Audit current alpha usage comprehensively but don't disable alpha in Phase 3
- Document current memory and FPS costs, provide recommendations for future optimization paths
- If audit findings exceed conservative thresholds, fix in this phase via scene-wide optimization

**Audit scope:**
- Measure canvas memory footprint (width × height × 4 bytes vs × 3 bytes)
- Browser DevTools memory profiling during animation runs
- Synthetic benchmarks comparing alpha vs no-alpha in isolation
- Test duration: 4-6 hour stream simulation (long stream scenario)
- Measure both memory usage AND FPS impact (not just memory)
- Compare GPU-accelerated vs CPU-only rendering paths
- Test at typical OBS browser source resolutions (focus on 1920x1080)
- Consider OBS rendering pipeline (how browser sources composite with other layers)

**Thresholds (conservative streaming-focused):**
- Memory: <300MB steady-state
- FPS drops: <5%
- Stability: 8+ hour continuous operation
- If thresholds exceeded: Implement scene-wide alpha optimization in Phase 3

**Configuration:**
- Add `config.performance.alpha` section with:
  - Per-scene enable flags (background, stinger, sidebar)
  - Performance thresholds (memory limits, FPS targets)
- Validation: Warn on incompatible settings (e.g., alpha disabled but fade animations configured)
- Must be easily reversible - config-based toggle for A/B testing and rollback

**Development tools:**
- Dev overlay with hotkey toggle (e.g., 'P' key) showing:
  - Memory usage (current canvas memory, cache size, allocation rate)
  - FPS and frame times (current FPS, frame time distribution, dropped frames)
  - Color-coded threshold warnings (green=OK, yellow=approaching, red=exceeding)
- Overlay position/opacity configurable in `config.performance.overlay`
- Show current values only (no historical sparklines)
- Shared state across OBS scene switches (persist visibility/position)

**Optimization strategy:**
- Scene-wide approach (optimize at scene level: background.html, stinger.html, sidebar.html)
- If optimization needed, expose via config file settings rather than hardcoding
- Config validation warns about incompatibilities but doesn't throw errors

**Documentation:**
- Comprehensive report including:
  - Methodology section (tools, test scenarios, measurement approach)
  - Raw data tables (memory snapshots, FPS samples over time)
  - Visual analysis (charts showing memory over time, FPS distribution, GPU vs CPU comparisons)
  - Findings and recommendations (current state vs thresholds, actions taken, future optimization opportunities)
- Research external best practices (canvas performance studies, OBS optimization guides, streaming recommendations)
- Document future optimization paths even if not implemented in Phase 3
- Chrome/Chromium only (OBS browser source) - no cross-browser testing needed

**Priority:**
- Complete alpha audit EARLY in Phase 3 - findings may inform dirty rectangle and frame rate work
- Update Phase 2 tests to verify alpha-disabled scenarios still pass position/timing invariants
- Add CI checks: Automated tests fail if memory or FPS exceeds thresholds after code changes
- Audit treats cache and render canvas alpha as combined memory pool (not separate)
- Preserve flexibility for Phase 4 visual enhancements

### Frame Rate Handling

**Approach:**
- Keep unified 60fps everywhere (maintain Phase 1 decision)
- PERF-06 audit verifies delta-time system works correctly, not re-introducing split rates

**Frame rate audit scope:**
- Verify consistent 60fps delivery under load without drops
- Validate delta-time correctness across different display refresh rates
- Ensure update/render work fits within 16.67ms frame budget

**Stress scenarios:**
- High bar count (20-50 bars active simultaneously)
- Rapid scene transitions (quick stinger/sidebar triggers)
- Background system load (OBS encoding + game capture running)

**Performance targets:**
- 55fps acceptable floor under peak stress
- 60fps target for normal use
- If FPS drops below 55fps under stress: Implement optimizations in Phase 3 to meet target
- Optimize for worst-case scenarios (stress tests) not just typical-case

**Metrics tracked:**
- Current FPS (instantaneous frames per second)
- Frame time distribution (min/max/avg/p99 for consistency analysis)
- Dropped frames (count of frames exceeding 16.67ms budget)

**Testing parameters:**
- Compare GPU-accelerated vs CPU-only rendering
- Document dev machine hardware only (note specs for reproducibility)
- Single resolution baseline (1920x1080)
- Active tab/source only (don't test backgrounded behavior)
- Collect timing via requestAnimationFrame timestamps (native browser timing)

**Integration:**
- Show FPS metrics in unified Performance Overlay (rename from "alpha debug overlay")
- Add CI checks: Automated FPS regression tests using headless browser (Xvfb) with virtual display
- Synthetic stress scenarios run in CI to catch regressions
- Optimize all bar types equally (no per-type prioritization)

### Performance Monitoring

**Scope:**
- Dev overlay (covered above in Alpha section) PLUS comprehensive reporting/logging infrastructure

**Reporting system:**
- Capture session summaries: Aggregate metrics per stream session (duration, avg FPS, peak memory, threshold violations)
- Persist to localStorage: Store session summaries across browser reloads
- ISO 8601 timestamps for readability

**Storage management:**
- Auto-delete old summaries when storage limit reached (FIFO after N sessions)
- Config settings: `config.performance.monitoring` with:
  - Sample intervals (how often to collect metrics, e.g., every 1 second)
  - Storage limits (max localStorage size, session history retention count)

**Activation:**
- Always on in dev mode (?perf=true URL parameter), off in production
- URL parameter detection: ?perf=true explicitly enables dev mode

**Console API:**
- Expose `window.perfMonitor` API with:
  - Query methods: `getSessions()`, `getCurrentMetrics()`, `getAverages()`
  - Control methods: `start()`, `stop()`, `reset()`, `clearHistory()`
- No export methods needed (localStorage sufficient)

**Scene tracking:**
- Track per-scene metrics: Session summaries include which scene (background/stinger/sidebar) generated data

**Test integration:**
- Extend Phase 2 tests with performance assertions (cache size, FPS metrics during test runs)
- Shared metrics collection code between tests and runtime monitoring

**Overlay details:**
- No storage status in overlay (would clutter real-time view)
- Focus on current metrics only

### Dirty Rectangle Optimization

**Approach:**
- Aggressive per-bar tracking: Track each bar's bounding box, only clear/redraw affected regions for maximum optimization

**Region handling:**
- Merge overlapping regions: Combine overlapping bar bounds into single larger rectangle (reduce complexity vs tracking separately)
- Add safety margin: Expand dirty rectangles by fixed padding (5px) to catch anti-aliasing, shadows, blur effects
- Per-frame reset: Clear dirty regions each frame, track only current frame's changes (not accumulated)

**Configuration:**
- Toggleable via `config.performance.dirtyRectangles` boolean
- Allows disabling optimization for debugging or if issues arise

**Development visualization:**
- Overlay dirty regions with colored outlines when ?perf=true for visual debugging
- Shows exactly which canvas areas are being redrawn each frame

### Claude's Discretion

- Exact measurement tools and profiling techniques beyond what's specified
- Specific config.performance schema details and validation logic
- Performance overlay styling and layout (within position/opacity constraints)
- Dirty rectangle merging algorithm and edge case handling
- Session summary data schema and localStorage key structure
- window.perfMonitor API implementation details
- CI test implementation (headless setup, test scenarios, assertions)

</decisions>

<specifics>
## Specific Ideas

- "I want the performance overlay to feel like Chrome DevTools performance panel but minimal - just the key numbers I care about during streaming"
- Conservative thresholds are critical - this runs for 8+ hours during live streams, so any memory leak or FPS degradation is stream-ending
- The goal is to validate Phase 1-2 work under realistic long-duration stress, not to achieve theoretical maximum performance
- Dirty rectangles should provide measurable improvement (target: 60-80% reduction in GPU clears for static areas as noted in roadmap)

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed tightly focused on Phase 3 performance optimization scope. Visual enhancements belong in Phase 4.

</deferred>

---

*Phase: 03-performance-optimization*
*Context gathered: 2026-01-17*
