# Project Research Summary

**Project:** Canvas Animation Library for OBS Stream Graphics
**Domain:** High-performance Canvas animations for OBS Browser Sources
**Researched:** 2026-01-17
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project builds OBS stream graphics (background animations, stinger transitions, notification alerts) using Canvas 2D for browser source integration. Research shows that **the current vanilla Canvas 2D + requestAnimationFrame stack is optimal** for this use case. Animation libraries like GSAP add overhead without performance benefit for continuous rendering at this element count (20-50 bars). WebGL only becomes advantageous at 3,000-5,000+ simultaneous elements.

The recommended approach is **layered architecture with pure functional calculations**: centralize all configuration constants, extract animation math to testable pure functions, maintain class-based inheritance for rendering, and implement proper memory management with LRU caching. The current codebase already follows many best practices (offscreen canvas caching, viewport culling, manual shadows over shadowBlur), but needs critical fixes for unbounded cache growth and frame-rate timing inconsistencies.

**Key risks:** Memory leaks from unbounded caches and event listener accumulation will cause crashes during long streaming sessions (4-8 hours). Frame-rate dependent timing causes animations to run at different speeds across hardware. OBS-specific CEF memory issues compound application-level leaks. Mitigation: implement LRU cache with size limits, add cleanup lifecycle for event listeners, normalize timing with delta-time calculations, and test directly in OBS (not just browser).

## Key Findings

### Recommended Stack

The current vanilla Canvas 2D stack is optimal for OBS browser sources. Adding libraries would introduce overhead without performance benefit at this element count.

**Core technologies:**
- **Canvas 2D API**: Zero overhead native rendering, guaranteed OBS compatibility, already optimized for 20-50 element use case
- **requestAnimationFrame**: Syncs with display refresh rate, automatically pauses when inactive, perfect for OBS timing
- **Vite 7.3.0**: Already in use with vite-plugin-singlefile for single-file HTML output (critical for OBS compatibility)
- **Vitest 4.0.16**: Already in use for testing pure calculation functions

**Optional (not recommended for current scope):**
- **GSAP 3.14.2**: Only if stinger sequences become complex enough to justify timeline API (~50KB bundle cost)
- **PixiJS 8.15.0**: Only if background scene requires 5,000+ simultaneous elements (adds 450KB + WebGL complexity)

**Critical insight:** Performance bottleneck for always-on background animations is **rendering overhead, not animation timing**. The current optimizations (offscreen canvas caching, viewport culling, integer coordinates, pure calculation functions) are the right approach. Canvas 2D maintains 60 FPS up to 3,000-5,000 elements; this project uses ~20-50 bars maximum.

### Expected Features

**Must have (table stakes):**
- Event-driven alerts (follow, subscribe, donation, raid) — core function of stream graphics
- Basic customization (colors, text) — every streamer wants unique branding
- Transparent background support — must layer over gameplay
- Persistent background animations — already implemented, performance-critical foundation
- Scene transition animations (stingers) — already implemented, validates event integration
- Responsive to platform events — must respond to Twitch/YouTube events

**Should have (competitive advantage):**
- Ultra-low CPU/GPU usage — personal streamers have limited hardware, performance = competitive edge
- Cohesive visual language across all animations — unified design feels professional vs Frankenstein collections
- Local-first configuration — no accounts, works offline, better UX than cloud dashboards
- Quick notification type extension — adding new alert types should be trivial (current project goal)
- Smart queueing for rapid events — prevents alert spam during raids

**Defer (v2+):**
- Rich WYSIWYG editor — adds massive complexity (300KB+ JS), maintenance burden for solo tool
- Video file backgrounds (MP4 loops) — poor performance, 10MB+ files, procedural canvas is better
- Dozens of animation presets — analysis paralysis, focus on 3-5 well-designed core animations
- Cloud sync/account system — server costs, privacy concerns, localStorage + export/import is sufficient

**Anti-features to avoid:** Real-time preview mode (OBS has built-in preview), 3D animations/particle systems (WebGL overhead), integration with every platform (focus on Twitch + generic event API).

### Architecture Approach

Modern Canvas animation systems in 2025 have converged on: **Entity-Component-System (ECS)** for complex game engines, **pure functional calculations** for testable animation math, **centralized configuration layers** for maintainability, and **offscreen canvas caching with proper lifecycle management** for performance. For OBS stream animations, the current class-based inheritance with pure calculation functions is solid but needs strategic refactoring.

**Major components:**

1. **Configuration Layer (NEW)** — Centralize all magic numbers, durations, dimensions in `config/constants.js`. Document coordinate system explicitly to prevent AI coding regressions.

2. **Calculation Layer (EXISTING, EXPAND)** — Pure functions in `shared/calculations.js` already follow 2025 best practices. Extract additional calculations (positioning, dimensions) to make them testable.

3. **Component Layer (REFACTOR EXISTING)** — Keep class-based inheritance for rendering (`AnimatedBar` base class → `BackgroundBar`/`StingerBar`/`SidebarBar`). Consider composition for behaviors if adding 3+ animation types.

4. **Memory Management (FIX EXISTING)** — Implement LRU cache for offscreen canvas to prevent unbounded growth. Current `static offscreenCache = new Map()` grows indefinitely.

5. **Frame Rate Management (DOCUMENT EXISTING)** — Current dual-layer rendering (30fps background, 60fps foreground) is valid but needs delta-time normalization for cross-hardware consistency.

**Key architectural principle:** Separate data from behavior, separate calculations from rendering, centralize constants.

### Critical Pitfalls

1. **Unbounded Offscreen Canvas Cache (CRITICAL)** — Static Map grows indefinitely, consuming memory until browser crashes after 4-8 hours. Prevention: Implement LRU cache with ~100 entry limit, round cache keys aggressively, add cache metrics logging. Current codebase has this issue in `AnimatedBar.offscreenCache`.

2. **Event Listener Accumulation (CRITICAL)** — `setupCanvas()` adds resize listener but never removes it. Multiple listeners accumulate over scene changes in OBS. Prevention: Use AbortController pattern for automatic cleanup, store listener references for removal. Current codebase needs cleanup lifecycle.

3. **Mixed Frame Rate Timing (CRITICAL)** — Hardcoded timing assumes 60fps but runs at variable refresh rates (30/60/120/144Hz), causing animation speed inconsistencies. Prevention: Implement delta-time normalization, express velocity in pixels/second not pixels/frame. Reported in milestone context as "timing inconsistencies."

4. **OBS CEF Memory Leak (MODERATE, EXTERNAL)** — OBS browser process accumulates 20-50MB/hour regardless of animation efficiency. This is OBS/CEF issue, not application bug. Mitigation: Document expected growth, structure as single browser source not multiple, provide scene refresh workaround.

5. **Full Canvas Clears Every Frame (MODERATE)** — `clearRect()` on entire canvas wastes 10-20% GPU. Prevention: Dirty rectangle tracking, layered canvases (static background separate from animated foreground), opaque fills instead of clears.

**Other significant pitfalls:** Sub-pixel rendering overhead (use integer coordinates), shadowBlur performance killer (current code wisely uses manual offset), hardware acceleration conflicts on Linux Wayland, canvas context state leakage (always pair save/restore), requestAnimationFrame without cleanup mechanism.

## Implications for Roadmap

Based on research, the roadmap should prioritize fixing critical memory/timing issues before adding features. The architecture refactoring enables safe feature extension.

### Phase 1: Foundation & Critical Fixes
**Rationale:** Fix memory leaks and timing issues before they compound during feature work. These are production-critical for long streaming sessions.

**Delivers:**
- LRU cache implementation for offscreen canvas (prevents memory leak)
- Delta-time normalization for frame-rate independence (fixes timing inconsistencies)
- Event listener cleanup lifecycle (prevents accumulation)
- Centralized configuration layer (`config/constants.js` with all magic numbers)
- Coordinate system documentation (prevents AI regressions)

**Addresses:**
- Ultra-low CPU/GPU usage (table stakes feature)
- Performance monitoring/FPS counter (MVP requirement)

**Avoids:**
- Unbounded offscreen canvas cache (Pitfall #1)
- Event listener accumulation (Pitfall #2)
- Mixed frame rate timing (Pitfall #3)

**Research flag:** Standard patterns, well-documented (skip `/gsd:research-phase`). Canvas performance optimization is extensively documented.

---

### Phase 2: Testing Infrastructure
**Rationale:** Lock down positioning and animation logic with tests before extending with new notification types. Prevents AI coding regressions during feature development.

**Delivers:**
- Position-locking tests (coordinate system contract)
- Property-based tests (animation invariants: opacity ranges, velocity limits)
- Long-running stress tests (detect memory leaks over 1 hour accelerated time)
- Frame rate consistency tests (ensure same movement at 30/60/120fps)

**Uses:**
- Pure calculation functions (already in `calculations.js`)
- Centralized configuration (from Phase 1)

**Implements:**
- Testing layer from architecture (locks down positioning, validates invariants)

**Avoids:**
- Canvas context state leakage (Pitfall #9)
- AI-generated positioning regressions (documented in milestone)

**Research flag:** Standard patterns (skip `/gsd:research-phase`). Canvas testing strategies are well-documented (askUI, MDN optimization guides).

---

### Phase 3: Notification System Foundation
**Rationale:** Build shared animation primitives and URL parameter configuration to enable quick addition of new notification types (stated project goal).

**Delivers:**
- URL parameter configuration system (color, text, timing customization)
- Shared animation primitive library (base notification components)
- 2-3 core notification types (follow, subscribe, generic)
- Event queueing system (prevents overlapping alerts)

**Addresses:**
- Event-driven alerts (table stakes feature)
- Basic customization (table stakes feature)
- Quick notification type extension (competitive advantage)
- Smart queueing for rapid events (competitive advantage)

**Uses:**
- Inheritance pattern (BackgroundBar → FollowBar/SubBar)
- Pure calculation functions and config constants (from Phase 1)

**Avoids:**
- Mixed concerns in classes (Pitfall/Anti-pattern #6)
- Magic numbers in code (Anti-pattern #1)

**Research flag:** Needs shallow research for event integration patterns (Twitch API, StreamElements, Streamlabs). Use `/gsd:research-phase "notification system event integration"` during planning.

---

### Phase 4: Notification Extension & Polish
**Rationale:** Add remaining notification types using established patterns. Polish OBS-specific configuration and documentation.

**Delivers:**
- Additional notification types (raid, donation, bits, host)
- Animation timing presets (fast/medium/slow)
- Export/import configuration (JSON)
- OBS-specific documentation (hardware acceleration settings, platform differences)
- Performance monitoring dashboard (cache size, FPS, memory usage)

**Addresses:**
- Additional notification types (v1.x feature)
- Cohesive visual language (competitive advantage)

**Avoids:**
- OBS hardware acceleration conflicts (Pitfall #8)
- Platform-specific issues (Phase-specific warning)

**Research flag:** Standard patterns (skip `/gsd:research-phase`). Notification types follow same architecture as Phase 3.

---

### Phase 5: Advanced Features (Optional/v2)
**Rationale:** Only proceed if core product validates. These are high-complexity, unclear-demand features.

**Delivers:**
- Visual configuration builder (if users struggle with URL params)
- Multiple visual themes (if demand emerges)
- Sound effect support (after visual animations solidified)
- Custom CSS injection (advanced users only)

**Addresses:**
- Visual config builder (P3 priority, defer)
- Multiple visual themes (v1.x feature if requested)
- Sound effect support (v1.x feature)

**Avoids:**
- Analysis paralysis from too many presets (Anti-feature)
- Over-engineering before product-market fit

**Research flag:** Needs research if pursued. Visual editor requires framework evaluation, theme system needs design pattern research.

---

### Phase Ordering Rationale

**Why Phase 1 first:** Memory leaks and timing issues will compound with every new feature. Must fix foundation before building. These are production-critical bugs that cause crashes during long streams.

**Why Phase 2 before features:** Tests lock down positioning/timing logic, preventing AI coding regressions when extending the system. Position-locking tests documented in ARCHITECTURE.md as critical for preventing coordinate system confusion.

**Why Phase 3 before Phase 4:** Phase 3 establishes patterns (inheritance, config usage, pure functions). Phase 4 repeats those patterns for new notification types. Must validate pattern works before scaling.

**Why Phase 5 last/optional:** High complexity features with unclear demand. Only pursue after validating core product with users.

**Dependency insights:**
- Notification types require config centralization (Phase 1) to avoid magic numbers
- Event queueing requires notification base classes (Phase 3)
- Testing requires pure functions and constants (Phase 1)
- All features depend on memory/timing fixes (Phase 1) for stability

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 3:** Event integration patterns (Twitch API, StreamElements, Streamlabs webhook formats, OBS browser source communication protocol). Recommend `/gsd:research-phase "notification system event integration"` during Phase 3 planning.

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Canvas performance optimization extensively documented (MDN, web.dev, Konva docs)
- **Phase 2:** Canvas testing strategies well-documented (askUI, property-based testing guides)
- **Phase 4:** Repeats Phase 3 patterns, no new domain knowledge required

**Note on Phase 5:** If pursued, will need research for visual editor frameworks and theme system architecture. Defer research until decision to proceed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Canvas 2D optimal for <5000 elements verified by multiple 2025 benchmarks. GSAP/PixiJS library analysis from npm data and official releases. |
| Features | **MEDIUM** | Based on professional tools analysis (StreamElements, Streamlabs), community best practices, and performance research. Needs validation with actual user testing. |
| Architecture | **HIGH** | ECS, pure functions, centralized config are 2025 patterns verified by multiple authoritative sources. Current codebase analysis shows clear refactoring path. |
| Pitfalls | **HIGH** | Memory leak patterns verified with MDN, GitHub issues, CVEs. OBS-specific issues from forum threads and official bug reports. Frame rate timing from MDN requestAnimationFrame docs. |

**Overall confidence:** **MEDIUM-HIGH**

Research is thorough for technical implementation (stack, architecture, pitfalls). Lower confidence on feature priorities due to lack of direct user validation. Recommend validating table stakes features (event-driven alerts, customization) with target users after Phase 3.

### Gaps to Address

**Event integration specifics:** Research covered general notification system patterns but not specific Twitch/StreamElements API formats. Phase 3 planning should research webhook/event payload structures before implementation. Recommend `/gsd:research-phase` during Phase 3 kickoff.

**OBS CEF version differences:** OBS v31+ with CEF 127 has different memory characteristics than v30. Testing should cover multiple OBS versions to identify breaking changes. Document minimum OBS version requirements.

**Visual theme system:** If Phase 5 proceeds, needs research on theme architecture (CSS variables vs JSON config vs dynamic generation). Current research doesn't cover theme system patterns deeply.

**Browser compatibility edge cases:** Research focused on Chromium/CEF (OBS browser source engine). If users request standalone browser usage, test Firefox/Safari compatibility. OffscreenCanvas known to have compatibility issues.

**Hardware acceleration platform differences:** Linux Wayland has known issues with OBS v31+ hardware acceleration. Testing should validate workarounds (disable hardware accel) don't break Windows/Mac functionality.

## Sources

### Primary (HIGH confidence)

**Official Documentation:**
- MDN: Canvas API Optimization — Performance patterns, memory management
- MDN: requestAnimationFrame — Frame rate timing, cancellation patterns
- web.dev: Canvas Performance — Dirty regions, state management
- OBS Project Knowledge Base — Browser source configuration

**Library Documentation:**
- npm: GSAP 3.14.2 — Version verification, bundle size
- GitHub: PixiJS 8.15.0 Release — WebGL performance characteristics
- Konva: Performance Tips — Memory leak prevention, optimization patterns

**Performance Research:**
- Canvas vs WebGL Performance Analysis (digitaladblog.com 2025) — Element count thresholds
- 2D vs WebGL Canvas Performance (semisignal.com) — Benchmark data
- SVG vs Canvas vs WebGL 2025 (svggenie.com) — Performance comparison

### Secondary (MEDIUM confidence)

**Feature Research:**
- Nerd or Die: Streamlabs vs StreamElements — Professional overlay comparison
- Restream: Alert System Comparison — Feature expectations
- FragileGFX: Stream Graphics 2025 — Design trends
- GETREKT Labs: Overlay Design Guide — Best practices

**OBS-Specific Issues:**
- OBS Forum: Browser Source Memory Leak (#134736) — CEF memory accumulation
- OBS Forum: CEF Bootstrap RAM Usage (#63720) — Architecture explanation
- GitHub: OBS Studio Issue #12762 — RAM leak discussion
- GitHub: OBS Studio Issue #12888 — CEF 127 hardware acceleration bug

**Architecture Patterns:**
- Semaphore: Constants Layer JavaScript — Centralized configuration
- Dev.to: Pure Functions 2025 — Testable code patterns
- Konva: Avoid Memory Leaks — Canvas lifecycle management
- Reintech: Canvas Performance Large-Scale Apps — Memory management

**Testing Strategies:**
- askUI: Canvas Testing Techniques — Visual regression approaches
- Pluralsight: Testable JavaScript Pure Functions — Testing pure functions
- Chris Courses: Standardize Game Framerate — Delta time patterns
- Kirupa: Consistent Animation Speeds — Frame-rate independence

### Tertiary (LOW confidence, needs validation)

**Browser Differences:**
- WebGPU Browser Support 2025 — Emerging standards (not applicable yet)
- OffscreenCanvas Browser Support — Known compatibility issues in OBS
- WebGPU Implementation Status — Future considerations only

**Community Patterns:**
- Various GitHub Gists: Canvas performance tips — Community knowledge
- Forum posts: OBS hardware acceleration issues — User-reported workarounds

---

*Research completed: 2026-01-17*
*Ready for roadmap: yes*

**Next step:** Orchestrator should proceed to requirements definition using this summary to structure phase-based requirements. Phase 1 is well-defined and ready to plan. Phase 3 will need event integration research during planning.
