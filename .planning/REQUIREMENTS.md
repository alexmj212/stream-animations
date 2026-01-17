# Requirements

## v1 Requirements

### Testing & Quality
- [ ] **TEST-01**: Position-locking tests for all bar types with explicit coordinate system contracts
- [ ] **TEST-02**: Property-based tests for animation invariants (opacity 0-1, speed limits, phase transitions)
- [ ] **TEST-03**: Fix existing test failures in colors.test.js (color parameter parsing)
- [ ] **TEST-04**: Frame rate consistency tests validating 30fps vs 60fps behavior
- [ ] **TEST-05**: Long-running stress tests simulating 1+ hour sessions
- [ ] **TEST-06**: Seeded random tests for deterministic animation behavior

### Performance & Stability
- [ ] **PERF-01**: Implement LRU cache eviction for AnimatedBar.offscreenCache (prevent memory exhaustion)
- [ ] **PERF-02**: Add delta-time normalization to animation loops (fix frame rate dependencies)
- [ ] **PERF-03**: Implement cleanup lifecycle for event listeners and requestAnimationFrame
- [ ] **PERF-04**: Optimize alpha channel usage (disable where not needed, 33% memory savings)
- [ ] **PERF-05**: Add dirty rectangle tracking to reduce unnecessary GPU operations
- [ ] **PERF-06**: Audit and fix mixed frame rate timing issues (background 30fps/60fps split)

### Configuration & Maintainability
- [ ] **CONFIG-01**: Create centralized configuration file for colors, timings, and positioning constants
- [ ] **CONFIG-02**: Document coordinate system explicitly in configuration (prevent AI positioning bugs)
- [ ] **CONFIG-03**: Extract scattered magic numbers into named constants
- [ ] **CONFIG-04**: Create configuration schema with validation
- [ ] **CONFIG-05**: Make sidebar positioning and timing easily adjustable via config

### Visual Consistency
- [ ] **VISUAL-01**: Fix brightness inconsistency (apply 20% reduction to stinger and sidebar like background)
- [ ] **VISUAL-02**: Align animation timing patterns across all scenes
- [ ] **VISUAL-03**: Standardize easing functions across animations
- [ ] **VISUAL-04**: Ensure color palette consistency across all bar types

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
*This section will be populated by roadmap creation*

### Success Criteria
*This section will be populated by roadmap creation*

---
*Last updated: 2026-01-17 after requirements definition*
