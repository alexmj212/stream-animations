# Stack Research: Canvas Animation Libraries

**Domain:** High-performance Canvas animations for OBS Browser Sources
**Researched:** 2026-01-17
**Confidence:** MEDIUM-HIGH

## Executive Summary

For OBS browser source animations with continuous background rendering, **staying with vanilla Canvas 2D + requestAnimationFrame is the optimal choice**. The project's current architecture is already well-optimized for the use case. Animation libraries like GSAP can provide developer convenience for complex sequences but won't improve raw rendering performance for continuous canvas drawing. WebGL libraries offer performance advantages only at high element counts (5,000+), which this project doesn't require.

**Key finding:** The performance bottleneck for always-on background animations is rendering overhead, not animation timing. Your current optimizations (offscreen canvas caching, viewport culling, integer coordinates) are the right approach.

## Recommended Stack

### Core Rendering

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Canvas 2D API** | Native | Primary rendering target | Zero overhead, native performance, guaranteed OBS compatibility. Already optimized for your use case. |
| **requestAnimationFrame** | Native | Animation loop timing | Syncs with display refresh rate, automatically pauses when tab inactive. Perfect for OBS. |
| **Vite** | 7.3.0 (current) | Build system | Already in use, excellent for single-file output with vite-plugin-singlefile. |
| **Vitest** | 4.0.16 (current) | Testing framework | Already in use, works well for testing pure calculation functions. |

**Rationale:** Your current stack is optimal. OBS Browser Source uses Chromium Embedded Framework (CEF) without hardware acceleration enabled, so complex libraries add overhead without performance benefit.

### Optional Enhancement Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **GSAP** | 3.14.2 | Animation timing & sequencing | For stinger transitions with complex timing, not for continuous background | HIGH |
| **PixiJS** | 8.15.0 | WebGL rendering | Only if element count exceeds 5,000+ simultaneously | MEDIUM |
| **Konva.js** | 9.x | Canvas 2D wrapper | Only if needing scene graph management | LOW |

**Note:** None of these are recommended for your background scene. They add bundle size and abstraction overhead for features you don't need.

### Development Tools (Current)

| Tool | Purpose | Notes |
|------|---------|-------|
| vite-plugin-singlefile | Bundle to single HTML | Critical for OBS compatibility - keep using |
| jsdom | Vitest DOM simulation | Already in use, works well |
| serve | Local development server | Already in use for testing |

## Detailed Analysis by Use Case

### 1. Background Scene (Always-On, Performance Critical)

**Recommendation:** Continue with vanilla Canvas 2D

**Why:**
- Your current implementation already includes key optimizations:
  - Offscreen canvas caching for repeated shapes
  - Viewport culling (skip drawing off-screen elements)
  - Integer coordinate rounding (avoids sub-pixel rendering)
  - Pure calculation functions (testable, predictable)

- Animation libraries won't help because:
  - GSAP optimizes DOM/CSS animations, not canvas pixel pushing
  - WebGL has startup cost (~10ms context creation) + doesn't benefit <5000 elements
  - Your bottleneck is draw calls, not timing logic

**Performance data:** Canvas 2D maintains 60 FPS up to 3,000-5,000 elements. Your background has ~20-50 bars maximum.

### 2. Stinger Transitions (Brief, Event-Driven)

**Recommendation:** Vanilla Canvas 2D + optional GSAP for complex sequences

**Why:**
- Brief duration (1-3 seconds) means library overhead is negligible
- GSAP could simplify complex multi-bar choreography with:
  - Timeline-based sequencing
  - Easing functions (you have cubic, GSAP has 20+)
  - Keyframe system for complex paths

**Trade-off:**
- Benefit: Cleaner code for complex sequences
- Cost: +~50KB bundle size, learning curve
- Verdict: **Optional but not necessary** - your current easing functions work fine

### 3. Sidebar Notifications (Temporary, Low Frequency)

**Recommendation:** Vanilla Canvas 2D

**Why:**
- Short-lived (few seconds)
- Simple animations (slide in, display, slide out)
- Performance not critical (infrequent)
- Your current approach is sufficient

## Alternatives Considered

### WebGL via PixiJS

| Aspect | Canvas 2D (Current) | PixiJS (WebGL) |
|--------|---------------------|----------------|
| **Startup Cost** | ~0ms | ~10ms context creation |
| **Performance at 50 elements** | 60 FPS | 60 FPS (no benefit) |
| **Performance at 5000+ elements** | 20-30 FPS | 60 FPS (advantage) |
| **Bundle Size** | 0KB | 450KB |
| **OBS Compatibility** | Guaranteed | Likely compatible but unverified |
| **Learning Curve** | Zero (already implemented) | Significant |

**Verdict:** Not worth it for your element count. WebGL benefits start at 3,000-5,000+ elements.

**When to reconsider:** If background scene requires 1,000+ simultaneous bars with particle effects.

### Animation Libraries

#### GSAP (GreenSock Animation Platform)

**Version:** 3.14.2 (December 2025)
**Bundle Size:** ~50KB (core)
**Confidence:** HIGH

**Pros:**
- Industry standard for web animation
- Excellent timeline/sequencing for complex animations
- Works with Canvas via PixiPlugin or manual integration
- 100% free including all plugins (as of 2025)

**Cons:**
- Optimized for DOM/CSS, not Canvas pixel pushing
- Your current easing + timing logic already works
- Adds bundle size for features you don't need
- Requires manual integration for canvas coordinates

**Use case:** Complex stinger choreography where timeline-based sequencing simplifies code.

**Recommendation:** Skip for now. Add only if stinger sequences become complex enough to justify abstraction.

#### Konva.js

**Version:** 9.x
**Bundle Size:** ~200KB
**Confidence:** MEDIUM

**Pros:**
- Canvas 2D wrapper with scene graph
- Shape caching built-in (you already do this manually)
- Event handling for interactive canvas

**Cons:**
- Scene graph overhead unnecessary for simple bar animations
- Event handling not needed (OBS browser sources rarely need interaction)
- Your manual caching implementation is more optimized for this specific use case

**Recommendation:** Not recommended. Adds complexity without benefit for your use case.

#### Theatre.js

**Version:** 0.7+ (actively developed in 2025)
**Bundle Size:** ~100KB + visual editor
**Confidence:** LOW

**Pros:**
- Visual timeline editor for keyframe animation
- Good for cinematic/motion design work
- Integrates with Three.js, HTML, CSS

**Cons:**
- Overkill for parametric bar animations
- Visual editor not useful for algorithmic animations
- Adds significant complexity

**Recommendation:** Not applicable to this project. Better for hand-animated scenes, not algorithmic/generative animations.

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Three.js** | 3D library, massive overhead for 2D shapes | Canvas 2D or PixiJS if needed |
| **Anime.js** | DOM-focused, similar to GSAP but less mature | GSAP if animation library needed |
| **React/Vue animation libraries** | Framework overhead not needed | Vanilla Canvas 2D |
| **CSS animations** | Can't animate Canvas pixel data | requestAnimationFrame + Canvas 2D |
| **setInterval/setTimeout** | Not synced to refresh rate, causes jank | requestAnimationFrame |
| **OffscreenCanvas + Workers** | Likely incompatible with OBS CEF, communication overhead | Main thread Canvas 2D |
| **WebGPU** | Cutting-edge, browser support incomplete, OBS compatibility unknown | Canvas 2D or WebGL |

### OffscreenCanvas + Web Workers: Why Not

**Theory:** Move rendering to worker thread for better performance.

**Reality for OBS:**
- OffscreenCanvas has known compatibility issues in OBS browser sources
- OBS CEF may not support workers with canvas transfer
- Communication overhead between threads costs ~5-10ms
- Your animations aren't CPU-bound enough to justify threading complexity

**Evidence:** Community reports of canvas rendering issues in OBS browser sources, especially with advanced features.

**Confidence:** MEDIUM (based on community reports, not direct testing)

**Verdict:** High risk, low reward. Stick to main thread rendering.

## Performance Optimization Recommendations

Your current optimizations are excellent. Here are additional techniques if needed:

### 1. Rendering Optimizations (Already Implemented)

- **Offscreen canvas caching:** ✓ You already do this for white bars
- **Viewport culling:** ✓ You already skip off-screen bars
- **Integer coordinates:** ✓ You already use Math.round()
- **Pure calculation functions:** ✓ You already separated animation logic

### 2. Additional Canvas 2D Optimizations

If performance becomes an issue:

```javascript
// Layer separation (not currently needed)
// Separate static background from animated foreground
// Redraw only animated layer per frame

// Pre-calculate static values
// Cache Math.sin/cos for repeated angles
// Pre-calculate color strings: `hsl(${h}, ${s}%, ${l}%)`

// Batch similar operations
// Draw all bars of same color together to reduce fillStyle changes
```

**Priority:** LOW - Only implement if profiling shows these as bottlenecks.

### 3. OBS-Specific Optimizations (Already Applied)

- **Custom FPS:** Set browser source to 30 FPS if 60 FPS causes CPU issues
- **Minimize canvas dimensions:** Already using appropriate sizes
- **Avoid shadowBlur:** ✓ You use manual shadow offsets (much faster)
- **Disable unnecessary features:** Your bars don't use events, gradients, or patterns (good!)

## Canvas 2D vs WebGL Performance Data

**Source:** Multiple 2025 benchmarks

| Metric | Canvas 2D | WebGL |
|--------|-----------|-------|
| **Context creation** | <1ms | ~10ms |
| **100 elements** | 60 FPS | 60 FPS |
| **1,000 elements** | 60 FPS | 60 FPS |
| **5,000 elements** | 30-40 FPS | 60 FPS |
| **10,000 elements** | 15-20 FPS | 60 FPS |
| **50,000+ elements** | <10 FPS | 60 FPS |

**Your use case:** ~20-50 bars → Canvas 2D is optimal

**WebGL crossover point:** 3,000-5,000 elements (depending on complexity)

## Installation (If Adding Libraries)

### GSAP (Optional, for stinger complexity)

```bash
npm install gsap@3.14.2
```

```javascript
// Example: Complex stinger sequence
import { gsap } from 'gsap';

// Timeline-based choreography
const tl = gsap.timeline();
tl.to(bar1, { x: 500, duration: 1 })
  .to(bar2, { x: 500, duration: 1 }, "-=0.5") // Overlap
  .to([bar1, bar2], { opacity: 0, duration: 0.5 });
```

**Note:** Requires manual integration with Canvas coordinates. GSAP animates object properties, you still call `drawBar()` each frame.

### PixiJS (Not Recommended)

```bash
npm install pixi.js@8.15.0
```

**Only consider if:** Background scene requirements change to 5,000+ simultaneous elements.

## Version Compatibility

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| Vite | 7.3.0 | 7.3.0 | Latest stable, excellent ES module support |
| Vitest | 4.0.16 | 4.0.16 | Latest stable |
| vite-plugin-singlefile | 2.3.0 | 2.3.0 | Critical for OBS, keep current |
| GSAP | N/A | 3.14.2 | Optional, if adding animation library |
| PixiJS | N/A | 8.15.0 | Not recommended for current use case |

## Browser/OBS Compatibility Notes

**OBS Browser Source:**
- Uses Chromium Embedded Framework (CEF)
- Hardware acceleration typically disabled
- Some advanced Canvas/WebGL features may not work
- Best practice: Test all features directly in OBS before deployment

**Guaranteed Compatible:**
- Canvas 2D API (all standard features)
- requestAnimationFrame
- Basic transforms, fills, compositing
- HSL colors

**Potentially Problematic:**
- OffscreenCanvas + Workers
- WebGPU (too new, incomplete browser support)
- Complex WebGL features (MRT, advanced shaders)
- Features requiring hardware acceleration

## Stack Patterns by Variant

**If building continuous background (current):**
- Use: Vanilla Canvas 2D + requestAnimationFrame
- Optimize: Offscreen caching, viewport culling, integer coords
- Because: Performance critical, library overhead not justified

**If building brief stinger (current):**
- Use: Vanilla Canvas 2D + manual easing
- Consider: GSAP only if sequences become complex
- Because: Duration too short for library overhead to matter

**If element count exceeds 5,000:**
- Use: PixiJS (WebGL renderer)
- With: Sprite batching, texture atlases
- Because: WebGL performance advantage kicks in at this scale

**If building interactive tool (not current use case):**
- Use: Konva.js or PixiJS
- Because: Scene graph + event handling built-in
- Note: Not applicable to OBS browser sources (minimal interaction)

## Confidence Assessment

| Finding | Confidence | Basis |
|---------|------------|-------|
| Canvas 2D optimal for <5000 elements | **HIGH** | Multiple 2025 benchmarks from credible sources |
| GSAP won't improve background performance | **HIGH** | Understanding of library purpose + profiling data |
| WebGL crossover at 3000-5000 elements | **HIGH** | Consistent across multiple benchmark sources |
| OffscreenCanvas issues in OBS | **MEDIUM** | Community reports, not direct testing |
| PixiJS version 8.15.0 features | **HIGH** | Official GitHub releases, published Jan 2025 |
| GSAP version 3.14.2 current | **HIGH** | npm package data, published Dec 2025 |
| OBS CEF limitations | **MEDIUM** | Community knowledge, not official OBS docs |
| WebGPU not ready for OBS | **MEDIUM** | Browser support timeline, OBS lag typically 1-2 years |

## Research Gaps

**Areas needing phase-specific research:**
- None identified for current roadmap
- Your vanilla approach is well-suited to all planned features

**If requirements change:**
- Test OffscreenCanvas + Workers directly in OBS (currently advised against)
- Benchmark actual OBS performance vs browser performance (may differ due to CEF)
- Evaluate WebGL if element count requirements increase 100x

## Recommendation Summary

**Keep your current stack.** It's optimized for exactly your use case:
- Zero library overhead
- Maximum OBS compatibility
- Already includes key performance optimizations
- Testable, maintainable pure functions

**Don't add libraries unless:**
- Stinger sequences become complex enough to justify GSAP timeline API
- Background scene requirements change to 5,000+ simultaneous elements (add PixiJS)
- You need interactive features (not applicable for OBS)

**Focus optimization efforts on:**
- Pre-calculating static values (colors, angles) if profiling shows benefit
- Reducing draw calls further (batch similar colors)
- OBS-specific tuning (FPS, canvas size, browser source settings)

## Sources

**Performance Benchmarks:**
- [Canvas vs WebGL Performance Analysis](https://digitaladblog.com/2025/05/21/comparing-canvas-vs-webgl-for-javascript-chart-performance/)
- [2D vs WebGL Canvas Performance](https://semisignal.com/a-look-at-2d-vs-webgl-canvas-performance/)
- [SVG vs Canvas vs WebGL 2025](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)

**Library Documentation:**
- [PixiJS v8.15.0 Release](https://github.com/pixijs/pixijs/releases)
- [PixiJS v8.13.0 Features](https://pixijs.com/blog/8.13.0)
- [GSAP npm Package](https://www.npmjs.com/package/gsap)
- [GSAP 3.14.2 Release Info](https://libraries.io/npm/gsap)
- [Konva Performance Tips](https://konvajs.org/docs/performance/All_Performance_Tips.html)
- [Theatre.js Official](https://www.theatrejs.com/)

**Animation Libraries 2025:**
- [Top JavaScript Animation Libraries 2025](https://wpshout.com/best-javascript-animation-libraries/)
- [JavaScript Animation Libraries 2025](https://dev.to/hadil/top-10-javascript-animation-libraries-in-2025-2ch5)

**OBS Performance:**
- [OBS Browser Source Performance](https://obsproject.com/forum/threads/browser-source-cpu-optimization.82406/)
- [OBS Browser Source Best Practices](https://obsproject.com/kb/browser-source)
- [Browser Source Canvas Issues](https://obsproject.com/forum/threads/browser-source-canvas-text-not-rendering.122363/)

**Canvas Optimization:**
- [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [OffscreenCanvas Browser Support](https://caniuse.com/offscreencanvas)
- [OffscreenCanvas Performance](https://web.dev/articles/offscreen-canvas)
- [RequestAnimationFrame MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

**WebGPU Status:**
- [WebGPU Browser Support 2025](https://www.todetect.net/article/webgpu/webgpu-browser-support-2025/)
- [WebGPU Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)

---
*Stack research for: Canvas-based OBS stream animations*
*Researched: 2026-01-17*
*Next: No additional library research needed - current stack is optimal*
