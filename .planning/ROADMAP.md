# Roadmap: Stream Animations

## Overview

This roadmap transforms a working but fragile brownfield codebase into a maintainable foundation for stream graphics. The journey progresses from fixing critical memory leaks and timing bugs that cause crashes during long streams, through comprehensive testing that prevents AI coding regressions, to performance optimization and visual polish. Each phase delivers observable improvements to stability, maintainability, and visual consistency while preserving the core value: flawless background animation performance.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Critical Fixes & Foundation** - Memory management, timing fixes, centralized configuration
- [x] **Phase 2: Testing Infrastructure** - Lock down positioning and animation logic
- [ ] **Phase 3: Performance Optimization** - GPU optimization, dirty rectangles, frame rate audit
- [ ] **Phase 4: Visual Consistency & Polish** - Brightness alignment, timing patterns, sidebar refinement

## Phase Details

### Phase 1: Critical Fixes & Foundation
**Goal**: Eliminate production-critical bugs and establish centralized configuration system
**Depends on**: Nothing (first phase)
**Requirements**: PERF-01, PERF-02, PERF-03, CONFIG-01, CONFIG-02, CONFIG-03
**Success Criteria** (what must be TRUE):
  1. Background animation runs for 8+ hours without memory exhaustion or crashes
  2. Animation timing remains consistent across different hardware refresh rates (30Hz/60Hz/120Hz)
  3. All magic numbers (colors, timings, positions) are centralized in config file with documented coordinate system
  4. Event listeners clean up properly when scenes are reloaded in OBS
**Plans**: 5 plans in 3 waves

Plans:
- [x] 01-01-PLAN.md — Timing & Cache Infrastructure (Wave 1: timing utilities, LRU cache, lifecycle management)
- [x] 01-02-PLAN.md — Configuration System (Wave 1: centralized config, validation functions)
- [x] 01-03-PLAN.md — AnimatedBar Integration (Wave 2: delta-time & LRU cache into base class)
- [x] 01-04-PLAN.md — Background Scene Migration (Wave 3: lifecycle cleanup, config migration, unified frame rate)
- [x] 01-05-PLAN.md — Stinger & Sidebar Migration (Wave 4: complete scene migrations with verification)

### Phase 2: Testing Infrastructure
**Goal**: Lock down positioning and animation math to prevent AI coding regressions
**Depends on**: Phase 1 (needs centralized config constants)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. Tests verify bar positions using explicit coordinate system contracts (prevent positioning bugs)
  2. Property-based tests validate animation invariants hold across random inputs (opacity 0-1, speed limits, phases)
  3. All existing test failures fixed and passing (colors.test.js color parameter parsing)
  4. Long-running stress tests detect memory leaks over simulated 1+ hour sessions
  5. Frame rate consistency tests validate animations run at same speed on 30fps/60fps/120fps displays
**Plans**: 8 plans in 3 waves

Plans:
- [x] 02-01-PLAN.md — Test Infrastructure Setup (Wave 1: install deps, configure canvas mock, fix colors.test.js)
- [x] 02-02-PLAN.md — Shared Utilities Property Tests (Wave 1: timing, cache, lifecycle - property-based)
- [x] 02-03-PLAN.md — AnimatedBar Base Class Tests (Wave 1: easing, viewport, positioning)
- [x] 02-04-PLAN.md — BackgroundBar Position Tests (Wave 2: position-locking, trajectory sampling)
- [x] 02-05-PLAN.md — StingerBar Phase Tests (Wave 2: phase transitions, timing, position bounds)
- [x] 02-06-PLAN.md — SidebarBar Sequence Tests (Wave 2: animation sequence, hold timing, position bounds)
- [x] 02-07-PLAN.md — Frame Rate Consistency Tests (Wave 3: 30/60/120fps validation)
- [x] 02-08-PLAN.md — Long-Running Stress Tests (Wave 3: 1+ hour memory leak detection)

### Phase 3: Performance Optimization
**Goal**: Minimize GPU operations and memory usage for continuous rendering
**Depends on**: Phase 2 (tests ensure optimizations don't break behavior)
**Requirements**: PERF-04, PERF-05, PERF-06
**Success Criteria** (what must be TRUE):
  1. Alpha channel audited and optimized if measurements exceed thresholds (<300MB memory, <5% FPS drop)
  2. Dirty rectangle tracking reduces GPU clears by 60-80% for static background areas (if needed based on audit)
  3. Frame rate validated under stress (55fps floor, 60fps target) with delta-time system correctness confirmed
  4. Performance monitoring shows stable memory usage and frame times during 4-6 hour streaming simulations
**Plans**: 6 plans in 3 waves

Plans:
- [ ] 03-01-PLAN.md — Performance Overlay + Storage Infrastructure (Wave 1: real-time metrics, localStorage sessions, window.perfMonitor API)
- [ ] 03-02-PLAN.md — Config Schema Extension (Wave 1: config.performance section with alpha toggles, thresholds, feature flags)
- [ ] 03-03-PLAN.md — Alpha Channel Audit (Wave 2: 4-6 hour measurements, heap snapshots, findings vs thresholds)
- [ ] 03-04-PLAN.md — Frame Rate Audit (Wave 2: stress scenarios, delta-time validation, P99 frame time analysis)
- [ ] 03-05-PLAN.md — Dirty Rectangle Implementation (Wave 3: DirtyRectTracker, selective clearing, A/B testing)
- [ ] 03-06-PLAN.md — CI Performance Regression Tests (Wave 3: automated threshold checks, baseline validation)

### Phase 4: Visual Consistency & Polish
**Goal**: Align visual aesthetics and finalize sidebar positioning/timing
**Depends on**: Phase 3 (performance baseline established)
**Requirements**: VISUAL-01, VISUAL-02, VISUAL-03, VISUAL-04, CONFIG-04, CONFIG-05
**Success Criteria** (what must be TRUE):
  1. Stinger and sidebar brightness reduced to match background (20% reduction applied consistently)
  2. Animation timing patterns use same easing functions and duration ratios across all scenes
  3. Color palette consistency verified across all bar types (background, stinger, sidebar)
  4. Sidebar positioning and timing easily adjustable via config schema with validation
  5. All scenes tested in OBS output preview showing cohesive visual language
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Critical Fixes & Foundation | 5/5 | Complete | 2026-01-17 |
| 2. Testing Infrastructure | 8/8 | Complete | 2026-01-17 |
| 3. Performance Optimization | 6/6 | Complete (gaps found) | 2026-01-18 |
| 4. Visual Consistency & Polish | 0/TBD | Not started | - |

---
*Last updated: 2026-01-18 after Phase 3 execution*
