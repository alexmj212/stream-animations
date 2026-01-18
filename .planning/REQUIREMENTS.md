# Requirements

## v1 Requirements

### Testing & Quality
- [x] **TEST-01**: Position-locking tests for all bar types with explicit coordinate system contracts
- [x] **TEST-02**: Property-based tests for animation invariants (opacity 0-1, speed limits, phase transitions)
- [x] **TEST-03**: Fix existing test failures in colors.test.js (color parameter parsing)
- [x] **TEST-04**: Frame rate consistency tests validating 30fps vs 60fps behavior
- [x] **TEST-05**: Long-running stress tests simulating 1+ hour sessions
- [x] **TEST-06**: Seeded random tests for deterministic animation behavior

### Performance & Stability
- [x] **PERF-01**: Implement LRU cache eviction for AnimatedBar.offscreenCache (prevent memory exhaustion)
- [x] **PERF-02**: Add delta-time normalization to animation loops (fix frame rate dependencies)
- [x] **PERF-03**: Implement cleanup lifecycle for event listeners and requestAnimationFrame
- [x] **PERF-04**: Optimize alpha channel usage (disable where not needed, 33% memory savings)
- [x] **PERF-05**: Add dirty rectangle tracking to reduce unnecessary GPU operations
- [x] **PERF-06**: Audit and fix mixed frame rate timing issues (background 30fps/60fps split)

### Configuration & Maintainability
- [x] **CONFIG-01**: Create centralized configuration file for colors, timings, and positioning constants
- [x] **CONFIG-02**: Document coordinate system explicitly in configuration (prevent AI positioning bugs)
- [x] **CONFIG-03**: Extract scattered magic numbers into named constants
- [x] **CONFIG-04**: Create configuration schema with validation
- [x] **CONFIG-05**: Make sidebar positioning and timing easily adjustable via config

### Visual Consistency
- [x] **VISUAL-01**: Fix brightness inconsistency (apply 20% reduction to stinger and sidebar like background)
- [x] **VISUAL-02**: Align animation timing patterns across all scenes
- [x] **VISUAL-03**: Standardize easing functions across animations
- [x] **VISUAL-04**: Ensure color palette consistency across all bar types

## v2 Requirements (Deferred)

### Event-Driven Notifications
- [ ] Follow notifications with animated bars
- [ ] Subscribe notifications with animated bars
- [ ] Donation/tip notifications with animated bars
- [ ] Raid notifications with animated bars
- [ ] Bits/cheer notifications with animated bars
- [ ] Event queueing system to prevent overlapping notifications during raids

### Advanced Features
- [ ] Live dynamic updates during stream (color/timing changes without reload)
- [ ] Visual configuration builder
- [ ] Theme system with presets
- [ ] Sound effect integration
- [ ] Interactive elements (chat integration)

## Out of Scope

- **WYSIWYG editor** — Massive complexity for minimal gain in personal use
- **Video backgrounds** — MP4 loops kill performance
- **Cloud sync** — Local-first is simpler and faster
- **Multi-platform support** — OBS Chromium is only target
- **Mobile/responsive design** — Stream overlays are fixed resolution
- **Accessibility features** — Not applicable for stream overlays
- **Cross-browser compatibility** — OBS browser source only

## Traceability

### Phase Mapping

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 2 | Complete |
| TEST-02 | Phase 2 | Complete |
| TEST-03 | Phase 2 | Complete |
| TEST-04 | Phase 2 | Complete |
| TEST-05 | Phase 2 | Complete |
| TEST-06 | Phase 2 | Complete |
| PERF-01 | Phase 1 | Complete |
| PERF-02 | Phase 1 | Complete |
| PERF-03 | Phase 1 | Complete |
| PERF-04 | Phase 3 | Complete |
| PERF-05 | Phase 3 | Complete |
| PERF-06 | Phase 3 | Complete |
| CONFIG-01 | Phase 1 | Complete |
| CONFIG-02 | Phase 1 | Complete |
| CONFIG-03 | Phase 1 | Complete |
| CONFIG-04 | Phase 4 | Complete |
| CONFIG-05 | Phase 4 | Complete |
| VISUAL-01 | Phase 4 | Complete |
| VISUAL-02 | Phase 4 | Complete |
| VISUAL-03 | Phase 4 | Complete |
| VISUAL-04 | Phase 4 | Complete |

**Coverage:** 21/21 requirements mapped (100%)

### Success Criteria by Phase

**Phase 1: Critical Fixes & Foundation**
- Background animation runs for 8+ hours without memory exhaustion or crashes
- Animation timing remains consistent across different hardware refresh rates (30Hz/60Hz/120Hz)
- All magic numbers (colors, timings, positions) are centralized in config file with documented coordinate system
- Event listeners clean up properly when scenes are reloaded in OBS

**Phase 2: Testing Infrastructure**
- Tests verify bar positions using explicit coordinate system contracts (prevent positioning bugs)
- Property-based tests validate animation invariants hold across random inputs (opacity 0-1, speed limits, phases)
- All existing test failures fixed and passing (colors.test.js color parameter parsing)
- Long-running stress tests detect memory leaks over simulated 1+ hour sessions
- Frame rate consistency tests validate animations run at same speed on 30fps/60fps/120fps displays

**Phase 3: Performance Optimization**
- Alpha channel disabled where not needed (33% memory savings on opaque bars)
- Dirty rectangle tracking reduces GPU clears by 60-80% for static background areas
- Background scene maintains consistent 30fps foreground/60fps background split without timing drift
- Performance monitoring shows stable memory usage and frame times during continuous rendering

**Phase 4: Visual Consistency & Polish**
- Stinger and sidebar brightness reduced to match background (20% reduction applied consistently)
- Animation timing patterns use same easing functions and duration ratios across all scenes
- Color palette consistency verified across all bar types (background, stinger, sidebar)
- Sidebar positioning and timing easily adjustable via config schema with validation
- All scenes tested in OBS output preview showing cohesive visual language

---
*Last updated: 2026-01-17 after Phase 2 completion*
