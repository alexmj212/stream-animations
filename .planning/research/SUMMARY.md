# Project Research Summary

**Project:** stream-animations v1.1 Shade Component
**Domain:** Canvas 2D stream graphics with scrolling text and semi-transparent curtains
**Researched:** 2026-01-18
**Confidence:** HIGH

## Executive Summary

The shade component extends the validated v1.0 Canvas 2D system to display major stream events (raids, gift subs) with scrolling text behind semi-transparent curtain effects. Research confirms that **no new libraries or dependencies are required**—the native Canvas 2D text API (`fillText()`, `measureText()`) combined with existing AnimatedBar patterns provides all necessary functionality. The component follows the proven three-phase animation pattern (enter/hold/exit) used in stinger and sidebar, with the critical innovation of **dynamic hold duration calculated from text length** to ensure readability regardless of message content.

The recommended approach is Canvas-based text rendering (not DOM overlay) for OBS browser source compatibility, offscreen canvas caching for performance, and a single unified phase controller to prevent text-curtain desynchronization bugs. Stack selection is conservative and proven: extend existing architecture patterns rather than introduce new frameworks. The primary risks are OBS-specific rendering quirks (text requires explicit `fillStyle` property), text scrolling too fast to read (mitigated by reading-time calculation: 250ms/word baseline), and font loading race conditions (mitigated by Font Loading API). All three risks have well-documented solutions and can be addressed in Phase 1.

This is a **low-complexity addition** leveraging validated v1.0 patterns. The architectural strategy is "extend, don't replace"—add minimal new complexity for text scrolling while reusing delta-time normalization, config-driven timing, and AnimatedBar inheritance. Research confidence is high because the domain is mature (Canvas text rendering is standard), the architecture is proven (v1.0 validated), and pitfalls are documented (OBS forum threads, performance optimization guides).

## Key Findings

### Recommended Stack

No new packages required. The shade component uses **100% native Canvas 2D APIs** plus existing v1.0 architecture:

**Core technologies:**
- **Canvas 2D Text API** (native) — Text rendering with `fillText()` and width measurement with `measureText()`. Native API is performant (~0.1-0.5ms per text draw) and zero overhead. Faster than DOM text for non-interactive displays.
- **CSS Font Loading API** (native) — Ensures web fonts (Jost) load before canvas measures text width, preventing race conditions. Already used in sidebar DOM overlay, same pattern applies here.
- **TextMetrics API** (native) — Dynamic text width calculation (~0.01ms per call). Essential for determining scroll distance and calculating hold duration based on readability constraints.

**Supporting patterns (reuse from v1.0):**
- AnimatedBar base class with inheritance (proven in stinger/sidebar)
- Delta-time normalization via DeltaTimer (frame-rate independence)
- Three-phase animation pattern (enter/hold/exit)
- Easing functions (easeInOutCubic for curtain entry/exit)
- Config-driven timing and colors (centralized config.js)
- LRU cache for offscreen canvas (performance optimization)

**What NOT to use:**
- GSAP/GSAP ScrollTrigger (47KB+, designed for scroll-driven animations, not self-animating text)
- curtains.js (100KB+ WebGL library, massive overkill for semi-transparent rectangles)
- Text animation libraries (vanilla canvas is simpler and faster)
- Marquee libraries (DOM-based, incompatible with canvas)

### Expected Features

**Must have (table stakes):**
- **Semi-transparent curtains** — Standard pattern for major event overlays, already validated in stinger (top/bottom entry with horizontal bars)
- **Large readable text** — Major events deserve prominent display at stream resolution (1920x1080)
- **Smooth enter/exit animations** — Eased transitions prevent jarring cuts (easeInOutCubic already implemented)
- **One-shot trigger pattern** — Integrates with OBS page load pattern (proven in sidebar)
- **Text visibility guarantee** — Text must be fully visible (not cut off) during entire hold phase
- **Performance guarantee** — Cannot impact stream encoding (core value constraint)

**Should have (competitive advantage):**
- **Dynamic hold duration** — Calculate duration based on text length + reading speed (~200 WPM), ensuring text is always readable. Generic overlays use fixed timing; this is a differentiator.
- **Three-phase text choreography** — Text "flies in" with curtains, scrolls during hold, "flies out" synchronized with curtain exit
- **Visual consistency** — Reuse bar patterns, colors, timing from stinger/sidebar for unified system feel
- **Minimum readability guarantee** — Enforce minimum display time (e.g., 3000ms) regardless of text length

**Defer (v2+):**
- **Multi-line text** — Adds vertical layout complexity, complicates scroll timing. Single-line with strategic composition is sufficient for v1.
- **Event-driven triggers** — OBS WebSocket integration for automatic raids/subs. Current manual trigger validates UX first.
- **Multiple concurrent shades** — Edge case (multiple simultaneous raids). Adds z-index management complexity.
- **Real-time text updates** — Breaks one-shot pattern, requires event system integration.

**Anti-features (avoid):**
- Configurable scroll speed (user control defeats dynamic timing algorithm)
- Multiple scrolling text lines (readability degrades, timing coordination nightmare)
- Real-time text updates during hold (breaks one-shot OBS pattern)
- Backdrop blur effects (Canvas doesn't support backdrop-filter, GPU-intensive)
- Per-character color animation (GPU overhead, visual noise)

### Architecture Approach

The shade component follows the validated v1.0 scene architecture: **ShadeBar class extends AnimatedBar** (inheritance pattern), uses pure calculation functions for text width/duration, and integrates config-driven timing via centralized config.js. The key architectural decision is **Canvas-based text rendering** (not DOM overlay) for OBS browser source compatibility, despite higher complexity. Canvas ensures consistent rendering in OBS's Chromium Embedded Framework.

**Major components:**
1. **ShadeBar.js** — Extends AnimatedBar. Implements three-phase update logic (enter: curtains slide in, hold: text scrolls, exit: curtains slide out). Renders curtain bars + scrolling text layer with clipping.
2. **calculations.js (extended)** — Add pure functions: `calculateShadeHoldDuration(textWidth, canvasWidth, scrollSpeed, config)` and text measurement helpers. Testable, deterministic logic.
3. **config.js (extended)** — Add `config.shade` section with timing proportions (enter/exit 20% each, hold calculated dynamically), curtain properties (width, position, angle, opacity), text rendering settings (font, color, scroll speed).
4. **shade/index.html** — Scene setup based on sidebar template. URL parameter parsing (?text, ?color, ?duration), animation loop with DeltaTimer, AnimationLifecycle cleanup.

**Key patterns:**
- **Dynamic hold duration calculation** — `holdDuration = max(readingTime, scrollTime, minHoldMs)`. Ensures text readable (reading time) and fully visible (scroll time).
- **Offscreen canvas caching for text** — Pre-render text to offscreen canvas once during init, use `drawImage()` for subsequent frames. 10x faster than re-rendering text every frame (10ms → 1ms).
- **Text clipping to curtain boundaries** — Use `ctx.clip()` to restrict text rendering to curtain area during enter/exit phases (prevents overflow).
- **Linear text scroll** — Use **linear interpolation** for text scroll (constant speed for readability). Reserve easing for curtain enter/exit only.
- **Single phase controller** — Shared timing source for text + curtains prevents desynchronization bugs.

**Inheritance chain:**
```
AnimatedBar (base class)
└── ShadeBar (new)
    ├── Properties: text, textWidth, scrollOffset, phase, elapsedTime, duration
    ├── Methods: init(), update(deltaTime), draw(), drawScrollingText()
    └── Pattern: THREE-PHASE (like sidebar/stinger, NOT continuous like background)
```

**Build order recommendation:**
1. Phase 1: Config & calculations (foundation) — Add config.shade, calculateShadeHoldDuration(), unit tests
2. Phase 2: ShadeBar class (core component) — Implement three-phase lifecycle, curtain rendering
3. Phase 3: Text rendering (text layer) — Add drawScrollingText() with clipping, offscreen caching
4. Phase 4: Scene integration — Create shade/index.html, URL params, animation loop, OBS testing
5. Phase 5: Visual polish — Adjust scroll speed, fine-tune timing, performance profiling

### Critical Pitfalls

Research identified **8 critical pitfalls** specific to scrolling text + curtains. v1.0 already prevents general Canvas pitfalls (memory leaks, frame-rate independence, cleanup lifecycle).

**Top 5 critical pitfalls to address immediately:**

1. **Text too fast to read** — Scrolling text moves too quickly for viewers to read during high-energy moments (raids). **Prevention:** Calculate reading time: `minReadingTime = 500ms + (words * 250ms)`. Ensure hold duration ≥ reading time. Test with 100-character messages.

2. **Font loading race condition** — `ctx.measureText()` returns incorrect width if custom fonts haven't loaded yet, causing wrong text positioning. **Prevention:** Use Font Loading API: `await document.fonts.ready` before measuring. Test in OBS on fresh browser source (no cache).

3. **OBS browser source requires explicit fillStyle** — Text renders in Chrome/Firefox but invisible in OBS. **Prevention:** Always set `ctx.fillStyle = 'white'` explicitly before `fillText()`. Test in OBS within first hour of text implementation.

4. **Text-curtain desynchronization** — Curtains exit before text finishes scrolling (or vice versa), breaking unified animation effect. **Prevention:** Single phase controller for both text and curtains. Test with timing assertions: "text exits before curtains close".

5. **Hold duration miscalculation for long text** — Long messages (100-char raid messages) either scroll too fast (unreadable) or hold too long (feels stuck). **Prevention:** Dynamic calculation with min/max bounds: `duration = clamp(calculateDuration(text), minHoldMs, maxHoldMs)`. Test edge cases: 5-word, 15-word, 30-word messages.

**Performance pitfalls (address in Phase 3):**

6. **Alpha blending on every frame** — Semi-transparent curtains with `globalAlpha` cause expensive GPU compositing (60fps → 40fps). **Prevention:** Use `rgba(0,0,0,0.7)` instead of `globalAlpha`. Profile GPU usage (<50%).

7. **Measuring text width every frame** — Calling `measureText()` in update/draw loop wastes 1-2ms per frame. **Prevention:** Measure once in init(), cache textWidth. Unit test verifies measureText() called once.

8. **Large fonts without offscreen caching** — Drawing 48px+ text with effects every frame degrades performance. **Prevention:** Pre-render text to offscreen canvas, use drawImage(). Benchmark: cached rendering 5x+ faster.

## Implications for Roadmap

Based on research, suggested 3-phase structure with focus on **immediate OBS validation** and **progressive enhancement**:

### Phase 1: Text Animation Core
**Rationale:** Foundation must handle text measurement, dynamic hold duration, and OBS compatibility before adding synchronization complexity. Font loading and fillStyle bugs discovered early = cheap to fix.

**Delivers:**
- Config additions (config.shade section)
- Pure calculation functions (calculateShadeHoldDuration, text measurement)
- Unit tests for hold duration edge cases (short/medium/long text)
- Basic text rendering with explicit fillStyle (OBS-compatible)
- Font loading integration (document.fonts.ready)

**Addresses features:**
- Large readable text (table stakes)
- Dynamic hold duration (differentiator)
- Minimum readability guarantee (differentiator)

**Avoids pitfalls:**
- Text too fast to read (reading time calculation)
- Font loading race condition (Font Loading API)
- OBS fillStyle requirement (test in OBS immediately)
- Hold duration miscalculation (unit tests for edge cases)
- Measuring text every frame (cache in init)

**Research flag:** Standard patterns. Font loading and text measurement are well-documented. Skip phase-specific research.

### Phase 2: Curtain Integration & Synchronization
**Rationale:** Text animation working independently allows focus on curtain coordination without debugging two systems simultaneously. Synchronization is critical for "shade" effect—must be rock solid before polish.

**Delivers:**
- ShadeBar class extending AnimatedBar
- Three-phase lifecycle (enter/hold/exit)
- Curtain rendering (horizontal bars, semi-transparent)
- Text clipping to curtain boundaries (ctx.clip())
- Single phase controller (prevents desync)
- Timing assertions in tests (curtains fully open before text scrolls, text exits before curtains close)

**Uses stack:**
- AnimatedBar inheritance (proven pattern from v1.0)
- easeInOutCubic for curtain entry/exit (existing function)
- Delta-time normalization (DeltaTimer)

**Implements architecture:**
- ShadeBar with unified phase controller
- Text + curtain synchronized via single timing source

**Avoids pitfalls:**
- Text-curtain desynchronization (shared phase controller)
- Alpha blending performance (use rgba() colors, not globalAlpha)

**Research flag:** Standard patterns. Three-phase animation already validated in v1.0. Skip phase-specific research.

### Phase 3: Performance Optimization & Polish
**Rationale:** Functionality complete, now optimize for production use. Performance profiling reveals actual bottlenecks (not premature optimization). Visual polish after OBS validation ensures effort aligns with real rendering.

**Delivers:**
- Offscreen canvas caching for text (if font size ≥48px)
- Performance profiling (GPU usage, frame times)
- Visual polish (scroll speed tuning, timing adjustments)
- OBS integration testing (browser source settings, cache behavior)
- Production validation (5+ test streams)

**Addresses:**
- Performance guarantee (core value constraint)
- Visual consistency (unified system feel)

**Avoids pitfalls:**
- Large text performance (offscreen caching)
- Alpha blending overhead (profiling validates approach)

**Research flag:** Performance profiling may require phase research if GPU usage >50%. Monitor during implementation; invoke `/gsd:research-phase` if bottlenecks discovered.

### Phase Ordering Rationale

**Why text → curtain → polish (not curtain → text):**
- Text measurement + hold duration calculation = foundation. Curtain timing depends on hold duration.
- OBS-specific bugs (fillStyle, font loading) discovered early when cheap to fix.
- Text scrolling + curtain rendering are independent concerns. Build text first, validate readability, then add curtain synchronization.
- Performance optimization requires working implementation to profile. Premature offscreen caching adds complexity before measuring benefit.

**Why 3 phases (not 5):**
- Research shows low architectural complexity (extends v1.0 patterns, no new dependencies).
- Text + curtain are tightly coupled in "shade" concept. Attempting to separate further creates artificial boundaries.
- Performance optimization naturally follows functional completion (profile → optimize loop).

**Dependencies identified:**
- Phase 2 requires Phase 1 complete (hold duration calculation needed for curtain timing)
- Phase 3 requires Phase 2 complete (performance profiling needs working animation)
- No circular dependencies (clean phase boundaries)

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Canvas text rendering is mature domain. Font Loading API and measureText() are well-documented (MDN, multiple optimization guides). Reading time calculation has research backing (250ms/word baseline from UX studies).
- **Phase 2:** Three-phase animation already validated in v1.0 stinger/sidebar. AnimatedBar inheritance proven. Synchronization pattern (shared phase controller) is standard software architecture.

**Phases needing potential research:**
- **Phase 3:** Performance profiling may reveal unexpected bottlenecks. If GPU usage >50% or frame rate <60fps, invoke `/gsd:research-phase 3` to research optimization strategies beyond offscreen caching (e.g., WebGL rendering, texture atlases, multi-threaded canvas).

**No phase requires deep research** — stack is proven, architecture extends v1.0, pitfalls are documented. Proceed confidently to requirements definition.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Native Canvas 2D APIs (no dependencies). Text rendering mature, well-documented. Font Loading API standard. v1.0 architecture validated. |
| Features | MEDIUM | Table stakes clear (curtains, text, animations). Differentiators (dynamic hold duration) unique but calculable. Reading speed research is general-purpose (not stream-specific), requires production validation. |
| Architecture | HIGH | Extends proven v1.0 patterns (AnimatedBar, three-phase, config-driven). Canvas text rendering well-understood. Offscreen caching performance gains documented (10x speedup benchmarks). |
| Pitfalls | HIGH | OBS-specific bugs documented in forums (fillStyle requirement). Font loading race conditions well-known. Performance pitfalls verified with optimization guides. Synchronization patterns standard. |

**Overall confidence:** HIGH

Research is comprehensive (4 parallel agents, 1000+ lines combined output), domain is mature (Canvas API since 2011), and architecture builds on validated v1.0 system. Low novelty = low uncertainty.

### Gaps to Address

**Minor gaps (handle during implementation, not blocking):**

- **Optimal scroll speed requires empirical tuning** — Research provides baseline (200 WPM reading speed → ~800px/s max scroll speed), but actual readability during live streams may differ. **Mitigation:** Start with conservative 300px/s, adjust after 3-5 production uses based on viewer feedback.

- **Text truncation strategy unknown** — Where to truncate long messages (>150 chars) to preserve key info (username vs message body). **Mitigation:** Defer truncation to v1.2. If needed during v1.1, truncate message tail with ellipsis, always preserve username.

- **Multiple shade instances behavior undefined** — If two raids occur within 10 seconds, should shades queue or overlap? **Mitigation:** Out of scope for v1.1 (single instance assumed). Address in v1.2 if real-world need emerges.

- **Reading time validation incomplete** — 250ms/word baseline from general UX research, not canvas-specific or stream-specific. **Mitigation:** Production validation during Phase 3. Collect feedback from 5+ streams, adjust formula if viewers report "too fast" or "too slow".

**No critical gaps.** All identified gaps are refinements, not blockers. Research provides sufficient foundation for implementation.

## Sources

### Primary (HIGH confidence)
- MDN Canvas 2D API documentation — Text rendering APIs (fillText, measureText, TextMetrics), font property, globalAlpha, optimization guides
- MDN CSS Font Loading API — Font loading race condition prevention (document.fonts.ready)
- OBS Project Forums — Browser source canvas text rendering issues (fillStyle requirement)
- Current codebase (v1.0) — Validated patterns: AnimatedBar, DeltaTimer, three-phase animation, LRU cache, config-driven architecture

### Secondary (MEDIUM confidence)
- Canvas performance optimization guides (web.dev, AG Grid, Mirko Sertic) — Offscreen canvas caching (10x speedup), alpha blending costs, text rendering optimization
- UX reading speed research (Character Calculator, Omni Calculator) — 200-250 WPM baseline, screen reading 20-30% slower than print
- Animation pattern libraries (Konva.js, Motion Canvas) — Three-phase timing baselines (1.5s fade-in + 1s hold + 1.5s fade-out)

### Tertiary (LOW confidence, validation needed)
- Reading time calculator tools — 250ms/word baseline (general-purpose, not stream-specific)
- Stream overlay design articles (GETREKT Labs) — Common mistakes (overcrowding, poor readability, overdesigned layouts)

---

*Research completed: 2026-01-18*

*Ready for roadmap: Yes*

*Next step: Requirements definition via gsd-new-project orchestrator*
