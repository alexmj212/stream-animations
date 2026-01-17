# Roadmap: Stream Animations

## Overview

This roadmap transforms a working but fragile brownfield codebase into a maintainable foundation for stream graphics. The journey progresses from fixing critical memory leaks and timing bugs that cause crashes during long streams, through comprehensive testing that prevents AI coding regressions, to performance optimization and visual polish. Each phase delivers observable improvements to stability, maintainability, and visual consistency while preserving the core value: flawless background animation performance.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Critical Fixes & Foundation** - Memory management, timing fixes, centralized configuration
- [ ] **Phase 2: Testing Infrastructure** - Lock down positioning and animation logic
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
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

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
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 3: Performance Optimization
**Goal**: Minimize GPU operations and memory usage for continuous rendering
**Depends on**: Phase 2 (tests ensure optimizations don't break behavior)
**Requirements**: PERF-04, PERF-05, PERF-06
**Success Criteria** (what must be TRUE):
  1. Alpha channel disabled where not needed (33% memory savings on opaque bars)
  2. Dirty rectangle tracking reduces GPU clears by 60-80% for static background areas
  3. Background scene maintains consistent 30fps foreground/60fps background split without timing drift
  4. Performance monitoring shows stable memory usage and frame times during continuous rendering
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

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
| 1. Critical Fixes & Foundation | 0/TBD | Not started | - |
| 2. Testing Infrastructure | 0/TBD | Not started | - |
| 3. Performance Optimization | 0/TBD | Not started | - |
| 4. Visual Consistency & Polish | 0/TBD | Not started | - |

---
*Last updated: 2026-01-17 after roadmap creation*
