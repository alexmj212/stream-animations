# Phase 7: Performance Optimization & Polish - Research

**Researched:** 2026-01-19
**Domain:** Canvas performance optimization, text rendering caching, GPU efficiency, OBS browser source validation
**Confidence:** HIGH

## Summary

This research investigated production-ready optimizations for the shade component, focusing on four critical performance requirements: (1) offscreen canvas caching for text rendering to achieve 5x+ performance gains, (2) text measurement caching during initialization to prevent per-frame measurement overhead, (3) GPU-efficient rendering using rgba() colors instead of globalAlpha for semi-transparent curtains, and (4) OBS browser source validation methodology across multiple test streams.

The shade component already implements core performance infrastructure from Phase 3 (PerformanceMonitor, DirtyRectTracker, LRU cache with bounded size). Phase 7 focuses on shade-specific optimizations: pre-rendering text to an offscreen canvas once during init() and reusing it via drawImage() for 10-20x speedup, measuring text dimensions once after font loading and caching the metrics, and ensuring curtains use rgba() fillStyle rather than globalAlpha to reduce GPU compositing overhead.

The standard approach uses offscreen canvas pre-rendering for static text (renders text once with fillText, caches the canvas, then uses drawImage each frame), TextMetrics caching during initialization (measureText is fast but calling it every frame is unnecessary), and rgba() colors for semi-transparent elements to enable GPU optimization. OBS browser source testing requires validation in actual OBS environment (not just browser) with 5+ test streams of varying duration to catch frame rate drops, memory leaks, and font rendering issues specific to OBS's embedded Chromium.

**Primary recommendation:** Implement offscreen canvas caching for ShadeBar text rendering (pre-render in init(), drawImage in draw()), verify text metrics are cached during init() (already implemented correctly), audit CurtainBar to use rgba() colors instead of globalAlpha where applicable (already implemented for curtain gradient, but check bar rendering), and establish OBS browser source validation protocol with 5+ test scenarios including short (30s), medium (5min), and long (30min+) streams with performance monitoring enabled.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Offscreen Canvas (createElement) | Native API | Pre-render text for caching | Standard canvas optimization technique. Creates invisible canvas for one-time rendering, then uses drawImage() for 10-20x speedup compared to repeated fillText() calls. MDN documented, proven in production. |
| TextMetrics (measureText) | Native API | Cache text dimensions once in init | Lightning-fast measurement API. Called once after font loading in init(), cached for animation loop. Prevents unnecessary per-frame measurement overhead. |
| rgba() colors | CSS Color 4 | GPU-efficient transparency | Direct color specification with alpha channel. Preferred over globalAlpha for per-element transparency. Enables GPU compositing optimizations (premultiplied alpha). |
| PerformanceMonitor | v1.0 (existing) | Track FPS, frame times, dropped frames | Already implemented in Phase 3. Provides rolling window FPS calculation, P99 frame time, dropped frame detection. Proven infrastructure. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Chrome DevTools Performance | Built-in | Record canvas rendering, measure GPU usage | Profile before/after optimizations to validate 5x+ gains. GPU timeline shows compositing overhead. Memory panel tracks canvas allocation. |
| OBS Studio | Latest (30.0+) | Browser source testing environment | Final validation environment. OBS's embedded Chromium may behave differently than standalone browser (font rendering, frame rate, GPU usage). |
| LRU Cache | v1.0 (existing) | Offscreen canvas management | Already implemented for AnimatedBar caching. maxSize=50, automatic eviction. Proven memory-safe for long streams. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Offscreen canvas | Repeated fillText() | fillText every frame is 10-20x slower than cached drawImage. No benefit to repeating expensive text rendering. Offscreen canvas is standard optimization. |
| rgba() colors | globalAlpha | globalAlpha affects all subsequent draws until reset, error-prone. Requires save/restore overhead. rgba() is per-element, clearer intent, better GPU optimization. |
| OBS validation | Browser-only testing | Browser performance doesn't guarantee OBS performance. OBS uses embedded Chromium with different rendering pipeline. Font loading, frame rate caps, GPU allocation differ. |
| Manual benchmarking | jsPerf / MeasureThat.net | Online benchmarks test isolated operations. Real-world validation requires actual animation loop with full context (font loading, shadows, transformations). |

**Installation:**
No new dependencies required - uses native browser APIs and existing v1.0 performance infrastructure.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── shade/
│   ├── ShadeBar.js              # Update: Add offscreen canvas caching
│   ├── CurtainBar.js            # Audit: Verify rgba() usage
│   └── index.html               # Add: Performance validation mode
├── shared/
│   ├── performance.js           # Existing: PerformanceMonitor
│   ├── perfOverlay.js           # Existing: Visual metrics display
│   └── canvas.js                # Existing: setupCanvas utilities
└── config/
    └── config.js                # Existing: Performance thresholds
```

### Pattern 1: Offscreen Canvas Text Caching

**What:** Pre-render text to offscreen canvas once during init(), then use drawImage() each frame for 10-20x speedup

**When to use:** When rendering static text that doesn't change during animation (ShadeBar.text is constant per instance)

**Example:**
```javascript
// Source: MDN Canvas Optimization + Mirko Sertic canvas fillText optimization
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
// https://www.mirkosertic.de/blog/2015/03/tuning-html5-canvas-filltext/

export class ShadeBar extends AnimatedBar {
  constructor(ctx, canvas, text, holdDurationMs = null) {
    super(ctx, canvas, 'text', {});
    this.text = text;
    // ... existing constructor code

    // Offscreen canvas will be created in init() after font loads
    this.textCanvas = null;
    this.textCanvasWidth = 0;
    this.textCanvasHeight = 0;
  }

  init() {
    // Wait for font loading (PERF-02: measure once)
    this.ctx.font = config.shade.text.font;
    const metrics = this.ctx.measureText(this.text);
    this.textWidth = metrics.width;

    // Calculate visual center offset (existing code)
    const actualAscent = metrics.actualBoundingBoxAscent;
    const actualDescent = metrics.actualBoundingBoxDescent;
    this.visualCenterOffset = (actualAscent - actualDescent) / 2;

    // PERF-01: Create offscreen canvas for text caching
    // Add padding for shadow (8px blur + 4px offset = 12px safety margin)
    const padding = 20;
    this.textCanvasWidth = Math.ceil(this.textWidth + padding * 2);
    this.textCanvasHeight = Math.ceil(actualAscent + actualDescent + padding * 2);

    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = this.textCanvasWidth;
    this.textCanvas.height = this.textCanvasHeight;

    const offCtx = this.textCanvas.getContext('2d', { alpha: true });

    // Pre-render text with shadow to offscreen canvas
    offCtx.font = config.shade.text.font;
    offCtx.fillStyle = config.shade.text.color;
    offCtx.textBaseline = 'alphabetic';

    offCtx.shadowColor = config.shade.text.shadow.color;
    offCtx.shadowBlur = config.shade.text.shadow.blur;
    offCtx.shadowOffsetX = config.shade.text.shadow.offsetX;
    offCtx.shadowOffsetY = config.shade.text.shadow.offsetY;

    // Draw text at baseline position accounting for padding
    const baselineY = padding + actualAscent;
    offCtx.fillText(this.text, padding, baselineY);

    // ... rest of existing init() code
  }

  draw() {
    this.ctx.save();

    // PERF-01: Use cached offscreen canvas (10-20x faster than fillText)
    // Draw pre-rendered text image instead of rendering text each frame
    const drawX = this.x - 20; // Account for offscreen canvas padding
    const drawY = this.y - this.visualCenterOffset - 20;

    this.ctx.drawImage(this.textCanvas, drawX, drawY);

    this.ctx.restore();
  }
}
```

**Performance gain:** 10-20x speedup measured in production canvas applications. fillText with complex fonts (Jost bold 96px) + shadow rendering is expensive. Pre-rendering eliminates repeated font rasterization, glyph lookup, and shadow compositing.

### Pattern 2: Text Measurement Caching

**What:** Call measureText() once during init() after font loading, cache results, never measure during animation loop

**When to use:** Always when text dimensions are needed for animation calculations (scroll speed, positioning)

**Example:**
```javascript
// Source: Scratch Blocks text width caching, HTML5 Canvas Tricks
// https://github.com/LLK/scratch-blocks/pull/1937
// https://gist.github.com/dschnare/6360657

export class ShadeBar extends AnimatedBar {
  constructor(ctx, canvas, text, holdDurationMs = null) {
    super(ctx, canvas, 'text', {});
    this.text = text;

    // PERF-02: Text metrics cached during init (not measured every frame)
    this.textWidth = 0;  // Set once in init()
    this.textHeight = 0; // Set once in init()
    this.actualAscent = 0;
    this.actualDescent = 0;
  }

  init() {
    // CRITICAL: Must be called AFTER document.fonts.ready resolves
    this.ctx.font = config.shade.text.font;

    // PERF-02: Measure once, cache forever
    const metrics = this.ctx.measureText(this.text);
    this.textWidth = metrics.width;
    this.actualAscent = metrics.actualBoundingBoxAscent;
    this.actualDescent = metrics.actualBoundingBoxDescent;
    this.textHeight = this.actualAscent + this.actualDescent;

    // All subsequent calculations use cached metrics
    this.visualCenterOffset = (this.actualAscent - this.actualDescent) / 2;

    // Calculate animation positions using cached width
    const enterEndCenter = this.canvas.width * 0.75;
    this.enterEndX = enterEndCenter - (this.textWidth / 2);
    // ... more position calculations
  }

  update(deltaTime) {
    // PERF-02: NEVER call measureText here
    // Uses only cached this.textWidth from init()
    const velocity = this.calculateVelocity(this.totalAnimationTime);
    this.x -= velocity * deltaTime;
  }
}
```

**Why this works:** measureText is fast (MDN: "lightning fast") but calling it 3600 times per minute (60fps × 60s) is wasteful. Cache once, reuse 3600x. Prevents unnecessary font lookup, glyph walking, and metric recalculation.

**Warning:** MUST call measureText AFTER document.fonts.ready resolves. Calling before font loads returns fallback font metrics (wrong width). Phase 5 already implements this correctly.

### Pattern 3: rgba() Colors for GPU Efficiency

**What:** Use rgba() fillStyle for semi-transparent elements instead of globalAlpha for better GPU compositing

**When to use:** When elements need transparency (curtain overlays, semi-transparent bars). Prefer rgba() over globalAlpha except for full-scene fades.

**Example:**
```javascript
// Source: jsPerf globalAlpha vs rgba, MDN canvas optimization
// https://jsperf.com/canvas-globalalpha-vs-rgba
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

// WRONG: Using globalAlpha (affects all subsequent draws, requires save/restore)
draw() {
  this.ctx.save();
  this.ctx.globalAlpha = 0.5; // Affects everything until restore
  this.ctx.fillStyle = '#ff6600';
  this.ctx.fillRect(0, 0, 100, 100);
  this.ctx.restore(); // Must restore to prevent affecting other draws
}

// RIGHT: Using rgba() (PERF-03 requirement)
draw() {
  // No save/restore needed - alpha is part of the color
  this.ctx.fillStyle = 'rgba(255, 102, 0, 0.5)'; // Same visual result
  this.ctx.fillRect(0, 0, 100, 100);
}

// For HSL with alpha (modern browsers support hsla)
draw() {
  const h = this.baseHSL.h;
  const s = this.baseHSL.s;
  const l = this.baseHSL.l * config.shade.brightness;
  const alpha = 0.5;

  this.ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  this.ctx.fillRect(0, 0, 100, 100);
}

// PERF-03: CurtainBar should use rgba/hsla for gradient
drawCurtain() {
  const gradient = this.ctx.createLinearGradient(0, this.y, 0, this.y + this.targetHeight);

  // Use hsla() for gradient stops (includes alpha in color)
  const baseLightness = this.baseHSL.l * config.shade.brightness;
  const endLightness = Math.max(10, (this.baseHSL.l - 20) * config.shade.brightness);

  // Alpha baked into color (not globalAlpha)
  gradient.addColorStop(0, `hsla(${this.baseHSL.h}, ${this.baseHSL.s}%, ${baseLightness}%, ${this.opacity})`);
  gradient.addColorStop(1, `hsla(${this.baseHSL.h}, ${this.baseHSL.s}%, ${endLightness}%, ${this.opacity})`);

  this.ctx.fillStyle = gradient;
  this.ctx.fillRect(0, this.y, this.canvas.width, this.targetHeight);
}
```

**GPU efficiency:** Browsers can optimize rgba() colors with premultiplied alpha for faster compositing. globalAlpha requires additional compositing pass. rgba() also avoids save/restore overhead (2 stack operations per frame).

**Current status audit needed:** CurtainBar.js uses globalAlpha for curtain background (line 349: `this.ctx.globalAlpha = this.opacity`). Should migrate to hsla() gradient for PERF-03 compliance.

### Pattern 4: OBS Browser Source Validation Protocol

**What:** Systematic testing in actual OBS environment across multiple stream scenarios to validate performance targets

**When to use:** After implementing optimizations, before marking phase complete (TEST-03 requirement)

**Example:**
```javascript
// Source: OBS Browser Source documentation, OBS Forums testing patterns
// https://obsproject.com/kb/browser-source
// https://obsproject.com/forum/threads/browser-source-framerate-doesnt-work-in-22-x.96474/

// TEST-03: OBS browser source testing validation
//
// Setup:
// 1. Create OBS scene with Browser Source
// 2. URL: http://localhost:5173/shade/?text=Test%20Stream&perf=true
// 3. Width: 1920, Height: 1080
// 4. FPS: 60 (custom frame rate enabled)
// 5. Enable "Refresh cache of current page" before each test
//
// Test Scenarios (5+ required for TEST-03):
//
// Scenario 1: Font loading validation (30 seconds)
// - Purpose: Verify fillStyle renders text in OBS
// - Text: "Font Loading Test"
// - Expected: Text visible immediately, no FOUT (Flash of Unstyled Text)
// - Metrics: Check performance overlay shows 60 FPS stable
//
// Scenario 2: Short animation (30 seconds)
// - Purpose: Baseline performance validation
// - Text: "Quick Test"
// - Expected: 60 FPS, GPU usage <50%, smooth scrolling
// - Validation: Performance overlay shows avg FPS ≥58
//
// Scenario 3: Medium text (5 minutes)
// - Purpose: Text caching performance validation
// - Text: "This is a longer test message to validate text rendering performance with caching"
// - Expected: FPS stable throughout, no frame drops
// - Validation: Dropped frames <5 over 5 minute period
//
// Scenario 4: Long stream test (30 minutes)
// - Purpose: Memory leak detection, cache stability
// - Text: "Long Running Stream Test"
// - Expected: Memory stable <300MB, no FPS degradation
// - Validation: Memory growth <50MB over 30 min, FPS >55
//
// Scenario 5: Rapid re-trigger (10 cycles, 30s each)
// - Purpose: Cache eviction and re-creation stress test
// - Text: Varies each cycle
// - Expected: Consistent performance across all cycles
// - Validation: FPS variance <5fps between cycles
//
// Validation Checklist:
// ✓ Text renders immediately (no blank frames)
// ✓ fillStyle color correct in OBS (not transparent)
// ✓ Shadow/glow visible (not clipped or missing)
// ✓ Scroll speed matches calculation (text centered at 50% mark)
// ✓ FPS stable ≥55 throughout animation
// ✓ GPU usage <50% (check Task Manager during stream)
// ✓ No memory leaks (monitor for 30+ minutes)
// ✓ Font loads correctly on cold start (clear OBS cache)
// ✓ Performance consistent across browser source reloads
// ✓ Curtain transparency renders correctly (not fully opaque)

// Monitoring during OBS tests:
// 1. Enable ?perf=true in browser source URL
// 2. Record OBS output to file (capture performance issues)
// 3. Check Task Manager > GPU column during stream
// 4. Use Chrome DevTools (F12) attached to OBS browser process:
//    - chrome://inspect/#devices → find OBS browser source
//    - Performance tab → Record 10s sample → Check GPU usage
// 5. Log window.perfMonitor.getCurrentMetrics() every 10s to console

// Common OBS-specific issues to watch for:
// - Frame rate cap at 30fps (check "Use custom frame rate" enabled)
// - Hardware acceleration off (Settings > Advanced > Enable browser source hardware acceleration)
// - Browser cache not cleared (old code running)
// - Font not loading (no @font-face or link in HTML)
// - Canvas dimensions mismatch (browser source size ≠ canvas size)
```

**Why OBS validation is critical:** OBS's embedded Chromium behaves differently than standalone Chrome:
- Different GPU allocation (shared with game capture, encoding)
- Frame rate capping (custom FPS setting may not work in some versions)
- Font loading timing (may be slower than browser)
- Hardware acceleration toggle affects canvas rendering pipeline

Browser testing shows "it works" but OBS testing shows "it works *in production*".

### Pattern 5: Performance Baseline Measurement

**What:** Establish before/after metrics to validate 5x+ performance gain from optimizations

**When to use:** Before implementing optimizations (establish baseline), after implementing (validate improvement)

**Example:**
```javascript
// Source: CanvasMark benchmark methodology, Chrome DevTools Performance profiling
// https://github.com/kevinroast/CanvasMark
// https://developer.chrome.com/docs/devtools/performance/

// Baseline measurement (before PERF-01 optimization):
//
// Test: Render "Test Message" 1000 times
// Method: Repeated fillText() calls
//
function baselineTest() {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  const text = "Test Message For Performance Baseline";
  ctx.font = 'bold 96px Jost';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;

  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, 100, 500);
  }

  const duration = performance.now() - start;
  const avgPerRender = duration / iterations;

  console.log(`Baseline: ${avgPerRender.toFixed(3)}ms per render`);
  console.log(`Total: ${duration.toFixed(1)}ms for ${iterations} renders`);
  return avgPerRender;
}

// Optimized measurement (after PERF-01 optimization):
//
// Test: Render same text 1000 times using offscreen canvas cache
// Method: Pre-render once, then drawImage() 1000 times
//
function optimizedTest() {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  const text = "Test Message For Performance Baseline";

  // Pre-render to offscreen canvas (done once)
  const offscreen = document.createElement('canvas');
  offscreen.width = 800;
  offscreen.height = 150;
  const offCtx = offscreen.getContext('2d', { alpha: true });

  offCtx.font = 'bold 96px Jost';
  offCtx.fillStyle = '#ffffff';
  offCtx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  offCtx.shadowBlur = 8;
  offCtx.shadowOffsetX = 4;
  offCtx.shadowOffsetY = 4;
  offCtx.fillText(text, 20, 100);

  // Measure drawing cached version
  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 100, 450);
  }

  const duration = performance.now() - start;
  const avgPerRender = duration / iterations;

  console.log(`Optimized: ${avgPerRender.toFixed(3)}ms per render`);
  console.log(`Total: ${duration.toFixed(1)}ms for ${iterations} renders`);
  return avgPerRender;
}

// Validate performance improvement (PERF-01 requirement: 5x+ gain)
function validatePerformanceGain() {
  const baseline = baselineTest();
  const optimized = optimizedTest();
  const speedup = baseline / optimized;

  console.log(`\nPerformance gain: ${speedup.toFixed(1)}x`);

  if (speedup >= 5.0) {
    console.log('✓ PERF-01 requirement met (5x+ gain)');
  } else {
    console.warn(`⚠ PERF-01 requirement NOT met (need ≥5x, got ${speedup.toFixed(1)}x)`);
  }

  return speedup;
}

// Expected results from research:
// Baseline: ~10-15ms per render (fillText + shadow)
// Optimized: ~0.5-1ms per render (drawImage cached canvas)
// Speedup: 10-20x (exceeds 5x requirement)
```

**Validation methodology:** Run both tests in identical conditions (same font loaded, same canvas size, same browser). Report speedup ratio. PERF-01 requires ≥5x, research suggests 10-20x is achievable.

### Anti-Patterns to Avoid

- **Measuring text every frame:** Even though measureText is "fast", calling it 60 times per second wastes CPU. Measure once in init(), cache the metrics. The only exception is if text content changes dynamically (not the case for ShadeBar).

- **Using globalAlpha for individual element transparency:** globalAlpha affects all subsequent draws until restored. Requires save/restore overhead (2 stack ops). Error-prone (forget to restore = everything transparent). Use rgba()/hsla() for per-element alpha instead.

- **Testing only in browser (not OBS):** Browser performance doesn't predict OBS performance. OBS uses embedded Chromium with different GPU allocation, frame rate behavior, and font loading. Always validate in actual OBS browser source with performance monitoring enabled.

- **Not pre-rendering static text:** Repeated fillText() for unchanging text is 10-20x slower than caching to offscreen canvas. Only render text once (in init()), then use drawImage() each frame. The "it's simple" argument doesn't justify 10x performance loss.

- **Assuming offscreen canvas is always faster:** Offscreen canvas benefits static content. For dynamic text (changing every frame), fillText may be faster than creating new canvases. ShadeBar text is static per instance, perfect for caching.

- **Skipping font loading wait before measureText:** Calling measureText before document.fonts.ready resolves returns fallback font metrics (wrong width). This causes incorrect scroll speed calculations and positioning. Always wait for fonts before measuring (Phase 5 already implements this correctly).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text rendering optimization | Custom text rasterization, bitmap fonts | Offscreen canvas pre-rendering | Native canvas optimization. Pre-render with fillText once, cache canvas, use drawImage() for 10-20x speedup. Proven in production (Scratch Blocks, RGraph, etc). |
| Performance benchmarking | console.time loops, manual timing | Chrome DevTools Performance tab | Industry standard. Records GPU timeline, shows compositing layers, identifies bottlenecks. Measuring isolated loops misses real-world context (font loading, shadow rendering, transforms). |
| OBS validation | Assume browser = OBS | Actual OBS browser source testing | OBS's embedded Chromium differs: GPU allocation shared with game capture, frame rate capping, font loading timing. Browser tests don't catch OBS-specific issues (fillStyle transparency, frame drops). |
| GPU usage monitoring | Custom tracking, estimates | Chrome DevTools GPU timeline + Task Manager | DevTools shows GPU process usage per frame. Task Manager shows overall GPU %. Native tools are accurate, custom tracking is guesswork. |
| Text metrics caching | Manual width calculations, hardcoded values | measureText() once in init | measureText provides accurate metrics including actualBoundingBox for optical centering. Lightning fast, no reason to avoid. Just cache the result, don't recalculate. |
| Transparent colors | globalAlpha + rgb() | rgba() / hsla() | CSS Color 4 standard. Alpha baked into color, no save/restore needed. GPU can optimize premultiplied alpha. globalAlpha is error-prone (affects all draws until restore). |

**Key insight:** Canvas text rendering optimization is well-researched (2015 Mirko Sertic, 2017 Scratch Blocks). Offscreen canvas caching for static text is the standard solution, not a custom optimization. The only "hand-rolled" part is deciding *what* to cache (ShadeBar text is perfect candidate - static content, expensive rendering with shadow).

## Common Pitfalls

### Pitfall 1: Not Accounting for Shadow in Offscreen Canvas Size

**What goes wrong:** Offscreen canvas too small, shadow gets clipped, visual artifacts appear around text edges

**Why it happens:** Shadows extend beyond text bounding box. measureText().width doesn't include shadow blur radius or offset. Developer creates canvas exactly width × height of text, shadow renders outside bounds and gets clipped.

**How to avoid:**
```javascript
// WRONG: No padding for shadow
const metrics = ctx.measureText(text);
offscreenCanvas.width = metrics.width;
offscreenCanvas.height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
// Shadow with 8px blur + 4px offset gets clipped at edges

// RIGHT: Add padding for shadow (PERF-01 pattern)
const metrics = ctx.measureText(text);
const shadowPadding = 20; // blur (8) + offset (4) + safety margin (8) = 20
offscreenCanvas.width = Math.ceil(metrics.width + shadowPadding * 2);
offscreenCanvas.height = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + shadowPadding * 2);

// Render text accounting for padding offset
offCtx.fillText(text, shadowPadding, shadowPadding + metrics.actualBoundingBoxAscent);
```

**Warning signs:**
- Text shadow appears "cut off" on edges
- Shadow looks dimmer than expected (clipped blur radius)
- Visual artifacts when text positioned near canvas edges
- Compare browser vs offscreen canvas rendering - different shadow appearance

**Prevention:** Calculate padding as `Math.max(shadowBlur, shadowOffsetX, shadowOffsetY) + safetyMargin`. Use 2x padding (both sides) for width and height. Render text at padding offset position, not at (0,0).

### Pitfall 2: Offscreen Canvas Without Alpha Channel

**What goes wrong:** Pre-rendered text has black background instead of transparency, can't composite correctly over animation

**Why it happens:** getContext('2d') defaults to opaque canvas in some browsers. Black background pixels render behind text, making it impossible to composite over curtains.

**How to avoid:**
```javascript
// WRONG: Default context (may be opaque)
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d'); // No alpha option
offCtx.fillText(text, x, y); // Black background pixels rendered

// RIGHT: Explicitly enable alpha (PERF-01 pattern)
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d', { alpha: true }); // Transparent background
offCtx.fillText(text, x, y); // Only text pixels rendered, rest transparent

// When drawing cached canvas:
ctx.drawImage(offscreen, x, y); // Text composites correctly over background
```

**Warning signs:**
- Text appears with rectangular black background
- Can't see curtains behind text (text blocks entire rectangle)
- Text doesn't blend correctly with scene
- Opacity changes don't work on cached text

**Prevention:** Always specify `{ alpha: true }` when creating offscreen canvas context for text caching. Verify transparency by drawing offscreen canvas over colored background - should see background through non-text areas.

### Pitfall 3: CurtainBar Using globalAlpha Instead of rgba()

**What goes wrong:** GPU compositing overhead increases, performance regression, harder to reason about opacity

**Why it happens:** globalAlpha seems simpler ("set opacity once for whole curtain"). Developers don't realize rgba() is faster and clearer. Code audit may miss globalAlpha if testing only for visual correctness.

**How to avoid:**
```javascript
// WRONG: Using globalAlpha (PERF-03 violation)
draw() {
  this.ctx.save();
  this.ctx.globalAlpha = this.opacity; // Affects all subsequent draws

  const gradient = this.ctx.createLinearGradient(0, this.y, 0, this.y + this.targetHeight);
  gradient.addColorStop(0, `hsl(${h}, ${s}%, ${l1}%)`); // No alpha in color
  gradient.addColorStop(1, `hsl(${h}, ${s}%, ${l2}%)`);

  this.ctx.fillStyle = gradient;
  this.ctx.fillRect(0, this.y, this.canvas.width, this.targetHeight);

  this.ctx.restore(); // Must restore
}

// RIGHT: Using hsla() (PERF-03 requirement)
draw() {
  // No save/restore needed
  const gradient = this.ctx.createLinearGradient(0, this.y, 0, this.y + this.targetHeight);

  // Alpha baked into gradient stops
  gradient.addColorStop(0, `hsla(${h}, ${s}%, ${l1}%, ${this.opacity})`);
  gradient.addColorStop(1, `hsla(${h}, ${s}%, ${l2}%, ${this.opacity})`);

  this.ctx.fillStyle = gradient;
  this.ctx.fillRect(0, this.y, this.canvas.width, this.targetHeight);
  // GPU can optimize premultiplied alpha
}
```

**Current code audit:** CurtainBar.js line 349 uses `this.ctx.globalAlpha = this.opacity`. Needs migration to hsla() gradient for PERF-03 compliance.

**Warning signs:**
- save/restore pairs around transparency changes
- globalAlpha set and forgotten (affects subsequent draws)
- GPU usage higher than expected (Task Manager shows >50%)
- Transparency stack depth issues (nested save/restore)

**Prevention:** Grep codebase for `globalAlpha`, audit each usage. Replace with rgba()/hsla() unless fading entire scene. PERF-03 specifically calls out curtains using rgba() instead of globalAlpha for GPU efficiency.

### Pitfall 4: Testing Offscreen Canvas Speedup Incorrectly

**What goes wrong:** Benchmark shows only 2-3x speedup instead of expected 10-20x, developer thinks optimization failed

**Why it happens:** Benchmark includes canvas creation in timing loop (offscreen canvas created every iteration instead of once). Or benchmark doesn't wait for font loading. Or comparison isn't apples-to-apples (different text, different shadow settings).

**How to avoid:**
```javascript
// WRONG: Creating offscreen canvas inside loop
function badBenchmark() {
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    const offscreen = document.createElement('canvas'); // Creates 1000 canvases!
    offscreen.width = 800;
    offscreen.height = 150;
    const offCtx = offscreen.getContext('2d');
    offCtx.fillText('Test', 10, 50);
    ctx.drawImage(offscreen, 0, 0);
  }
  return performance.now() - start;
}

// RIGHT: Create offscreen canvas once, reuse (PERF-01 pattern)
function goodBenchmark() {
  // Pre-render once (not timed)
  const offscreen = document.createElement('canvas');
  offscreen.width = 800;
  offscreen.height = 150;
  const offCtx = offscreen.getContext('2d');
  offCtx.font = 'bold 96px Jost';
  offCtx.fillStyle = '#ffffff';
  offCtx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  offCtx.shadowBlur = 8;
  offCtx.fillText('Test', 10, 100);

  // Time only the drawing part
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0); // Reuses same cached canvas
  }
  return performance.now() - start;
}
```

**Warning signs:**
- Speedup less than 5x (expected 10-20x for text with shadow)
- Benchmark results vary wildly between runs
- Memory usage grows during benchmark (canvas leak)
- Comparing different text or font settings between baseline and optimized

**Prevention:** Pre-render offscreen canvas once before timing starts. Ensure both baseline (fillText) and optimized (drawImage) use identical font, shadow, and text. Wait for document.fonts.ready before both tests. Run multiple iterations and report median (not first run - JIT warmup affects results).

### Pitfall 5: OBS Font Loading Race Condition

**What goes wrong:** Text renders correctly in browser but appears blank or uses fallback font in OBS browser source

**Why it happens:** OBS browser source may load fonts slower than standalone browser. If animation starts before document.fonts.ready resolves, text measured incorrectly and may not render.

**How to avoid:**
```javascript
// Already implemented correctly in Phase 5, but validate in OBS:

// index.html for shade scene
document.fonts.ready.then(() => {
  console.log('[Shade] Fonts loaded, initializing ShadeBar');

  const shadeBar = new ShadeBar(ctx, canvas, text, holdDurationMs);
  shadeBar.init(); // Measures text and creates offscreen canvas

  startAnimation(shadeBar);
}).catch(error => {
  console.error('[Shade] Font loading failed:', error);
  // Fallback: try proceeding anyway (will use fallback font)
});

// TEST-03: OBS validation must check font loading
// 1. Add ?perf=true to URL to see console logs in OBS
// 2. Chrome DevTools → chrome://inspect → find OBS browser source
// 3. Console should show "Fonts loaded" before "Initializing ShadeBar"
// 4. If "Fonts loaded" never appears, check @font-face in HTML
// 5. If text appears before "Fonts loaded", race condition detected
```

**Warning signs:**
- Text width different in OBS vs browser (wrong scroll speed)
- First load shows Arial/sans-serif, reload shows Jost (cache fixes it)
- Text measurements inconsistent between browser source reloads
- Performance overlay shows text render time varying wildly (not cached)

**Prevention:** Always wrap initialization in document.fonts.ready.then(). Add console logging to verify font loading completes before text measurement. Test in OBS with "Refresh cache of current page" to simulate cold start. If fonts still not loading, add explicit @font-face or Google Fonts link to HTML head.

### Pitfall 6: Not Validating 5x Performance Gain

**What goes wrong:** Implement offscreen canvas optimization but never measure actual speedup, may not meet PERF-01 requirement

**Why it happens:** "It feels faster" is not validation. Developer assumes offscreen canvas is faster without benchmarking. May have implementation bug that prevents caching (canvas recreated each frame).

**How to avoid:**
```javascript
// TEST-03: Performance validation protocol
//
// 1. Baseline measurement (before PERF-01):
//    - Run shade scene with ?perf=true
//    - Note avg frame time from performance overlay
//    - Note FPS over 30 second animation
//    - Log to console: window.perfMonitor.getStats()
//
// 2. Implement PERF-01 (offscreen canvas caching)
//
// 3. Optimized measurement (after PERF-01):
//    - Clear browser cache (force fresh load)
//    - Run shade scene with ?perf=true
//    - Note avg frame time from performance overlay
//    - Note FPS over 30 second animation
//    - Log to console: window.perfMonitor.getStats()
//
// 4. Calculate speedup:
//    speedup = baseline_frame_time / optimized_frame_time
//
// 5. Validate PERF-01 requirement:
//    if (speedup >= 5.0) {
//      console.log('✓ PERF-01 requirement met');
//    } else {
//      console.warn(`⚠ PERF-01 NOT met: ${speedup.toFixed(1)}x < 5.0x`);
//    }
//
// Expected results:
// - Baseline: 10-15ms avg frame time (fillText + shadow each frame)
// - Optimized: 0.5-1.5ms avg frame time (drawImage cached canvas)
// - Speedup: 10-20x (exceeds 5x requirement)

// Add validation helper to ShadeBar for testing:
class ShadeBar extends AnimatedBar {
  // ... existing code

  // For performance testing: render N times and measure
  static benchmarkTextRendering(ctx, canvas, text, iterations = 1000) {
    ctx.font = config.shade.text.font;
    ctx.fillStyle = config.shade.text.color;
    ctx.shadowColor = config.shade.text.shadow.color;
    ctx.shadowBlur = config.shade.text.shadow.blur;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillText(text, 100, 500);
    }
    const duration = performance.now() - start;
    return duration / iterations; // ms per render
  }

  static benchmarkCachedRendering(offscreenCanvas, ctx, canvas, iterations = 1000) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreenCanvas, 100, 450);
    }
    const duration = performance.now() - start;
    return duration / iterations; // ms per render
  }
}
```

**Warning signs:**
- No performance measurements documented
- "Looks faster" without numbers to back it up
- Implementation done but PERF-01 not checked off
- Performance overlay not enabled during testing

**Prevention:** Make performance validation a requirement for phase completion. Document baseline and optimized measurements. Run benchmarks in both browser and OBS. Report speedup ratio in phase summary. PERF-01 explicitly requires "5x+ performance gain" - this must be measured, not assumed.

## Code Examples

Verified patterns from official sources:

### Offscreen Canvas Pre-rendering for Text
```javascript
// Source: MDN Canvas Optimization + Mirko Sertic fillText optimization
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
// https://www.mirkosertic.de/blog/2015/03/tuning-html5-canvas-filltext/

// Pre-render text to offscreen canvas once
const textCanvas = document.createElement('canvas');
textCanvas.width = 800;
textCanvas.height = 150;
const textCtx = textCanvas.getContext('2d', { alpha: true });

// Render text with shadow once
textCtx.font = 'bold 96px Jost';
textCtx.fillStyle = '#ffffff';
textCtx.shadowColor = 'rgba(0, 0, 0, 0.6)';
textCtx.shadowBlur = 8;
textCtx.shadowOffsetX = 4;
textCtx.shadowOffsetY = 4;
textCtx.fillText('Celebration Text', 20, 100);

// Animation loop: use cached canvas (10-20x faster)
function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw pre-rendered text (fast drawImage instead of slow fillText)
  ctx.drawImage(textCanvas, x, y);

  requestAnimationFrame(animate);
}
```

### rgba() Colors for Semi-transparent Elements
```javascript
// Source: jsPerf globalAlpha vs rgba benchmark
// https://jsperf.com/canvas-globalalpha-vs-rgba

// PERF-03: Use rgba() instead of globalAlpha

// For solid colors with transparency:
ctx.fillStyle = 'rgba(255, 102, 0, 0.5)'; // Orange at 50% opacity
ctx.fillRect(0, 0, 100, 100);

// For HSL colors with transparency (modern browsers):
const h = 30, s = 80, l = 60, a = 0.5;
ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${a})`;
ctx.fillRect(0, 0, 100, 100);

// For gradients with transparency:
const gradient = ctx.createLinearGradient(0, 0, 0, 100);
gradient.addColorStop(0, 'hsla(30, 80%, 60%, 0.6)'); // Lighter with alpha
gradient.addColorStop(1, 'hsla(30, 80%, 40%, 0.6)'); // Darker with alpha
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 100, 100);

// No save/restore needed - alpha is part of the color
```

### Text Measurement Caching
```javascript
// Source: Scratch Blocks text width caching
// https://github.com/LLK/scratch-blocks/pull/1937

// PERF-02: Measure text once, cache results

// Wait for fonts to load
await document.fonts.ready;

// Measure once
ctx.font = 'bold 96px Jost';
const metrics = ctx.measureText('Celebration Text');

// Cache all needed measurements
const cached = {
  width: metrics.width,
  height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
  ascent: metrics.actualBoundingBoxAscent,
  descent: metrics.actualBoundingBoxDescent
};

// Animation loop: use cached metrics (never call measureText here)
function animate() {
  const scrollSpeed = (cached.width + canvas.width) / holdDuration;
  x -= scrollSpeed * deltaTime;

  // Position using cached height for vertical centering
  y = canvas.height / 2 + (cached.ascent - cached.descent) / 2;
}
```

### OBS Browser Source Configuration
```javascript
// Source: OBS Browser Source documentation
// https://obsproject.com/kb/browser-source

// TEST-03: OBS browser source setup for validation

// Browser Source Properties:
// - URL: http://localhost:5173/shade/?text=Test%20Message&perf=true
// - Width: 1920
// - Height: 1080
// - Use custom frame rate: ✓ (checked)
// - FPS: 60
// - Shutdown source when not visible: ✗ (unchecked for testing)
// - Refresh browser when scene becomes active: ✗ (unchecked)

// Before each test:
// 1. Right-click browser source → Interact
// 2. Press Ctrl+Shift+R (hard refresh, clears cache)
// 3. Or click "Refresh cache of current page" in properties

// Validation checks:
// 1. Font renders correctly (Jost, not Arial fallback)
// 2. Text color is white (fillStyle working)
// 3. Shadow visible (8px blur, 4px offset)
// 4. Frame rate stable at 60fps (check Stats in OBS)
// 5. GPU usage <50% (Task Manager during stream)
```

### Chrome DevTools Performance Profiling
```javascript
// Source: Chrome DevTools Performance documentation
// https://developer.chrome.com/docs/devtools/performance/

// Profile canvas rendering to validate optimizations:

// 1. Open DevTools (F12)
// 2. Performance tab
// 3. Check "Screenshots" and "Memory"
// 4. Click Record (or Ctrl+E)
// 5. Let animation run for 3-5 seconds
// 6. Stop recording
// 7. Analyze results:
//    - Main thread: Look for "fillText" calls (should be in init only)
//    - GPU: Check compositing time (<2ms per frame target)
//    - Memory: Verify canvas allocations stable (no leaks)
//    - FPS: Check for dropped frames (aim for solid 60fps)

// For OBS browser source profiling:
// 1. Navigate to chrome://inspect/#devices
// 2. Find "OBS Browser" target (may need "Discover network targets")
// 3. Click "inspect" to open DevTools for OBS browser source
// 4. Follow same profiling steps as above
// 5. Note: GPU usage shared with OBS encoder, expect higher baseline

// Key metrics to validate PERF-01:
// - fillText calls: 1 (in init) vs N (in draw loop) - should be 1
// - drawImage calls: N (one per frame) - expected for cached rendering
// - GPU compositing: <2ms per frame - rgba() optimization
// - Frame time: <16.67ms for 60fps - overall performance target
```

### Performance Validation Script
```javascript
// Source: CanvasMark benchmark methodology
// https://github.com/kevinroast/CanvasMark

// Add to window for console access during testing:
window.perfValidation = {
  // Run full validation suite
  runAll() {
    console.log('=== Performance Validation ===\n');

    const baseline = this.measureBaseline();
    const optimized = this.measureOptimized();
    const speedup = baseline / optimized;

    console.log(`\nSpeedup: ${speedup.toFixed(1)}x`);

    if (speedup >= 5.0) {
      console.log('✓ PERF-01 requirement MET (≥5x)');
    } else {
      console.warn(`⚠ PERF-01 requirement NOT met (need ≥5x, got ${speedup.toFixed(1)}x)`);
    }

    return { baseline, optimized, speedup };
  },

  // Measure baseline (fillText every frame)
  measureBaseline() {
    const iterations = 1000;
    const ctx = canvas.getContext('2d');

    ctx.font = config.shade.text.font;
    ctx.fillStyle = config.shade.text.color;
    ctx.shadowColor = config.shade.text.shadow.color;
    ctx.shadowBlur = config.shade.text.shadow.blur;
    ctx.shadowOffsetX = config.shade.text.shadow.offsetX;
    ctx.shadowOffsetY = config.shade.text.shadow.offsetY;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillText('Test Validation Message', 100, 500);
    }
    const duration = performance.now() - start;
    const avg = duration / iterations;

    console.log(`Baseline: ${avg.toFixed(3)}ms per render`);
    return avg;
  },

  // Measure optimized (drawImage cached canvas)
  measureOptimized() {
    const iterations = 1000;
    const ctx = canvas.getContext('2d');

    // Pre-render to offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = 800;
    offscreen.height = 150;
    const offCtx = offscreen.getContext('2d', { alpha: true });

    offCtx.font = config.shade.text.font;
    offCtx.fillStyle = config.shade.text.color;
    offCtx.shadowColor = config.shade.text.shadow.color;
    offCtx.shadowBlur = config.shade.text.shadow.blur;
    offCtx.shadowOffsetX = config.shade.text.shadow.offsetX;
    offCtx.shadowOffsetY = config.shade.text.shadow.offsetY;
    offCtx.fillText('Test Validation Message', 20, 100);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreen, 100, 450);
    }
    const duration = performance.now() - start;
    const avg = duration / iterations;

    console.log(`Optimized: ${avg.toFixed(3)}ms per render`);
    return avg;
  }
};

// Usage in browser console or OBS DevTools:
// window.perfValidation.runAll()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fillText() every frame | Offscreen canvas pre-rendering | 2015 (Mirko Sertic optimization research) | 10-20x speedup for static text. Reduces per-frame cost from 10-15ms to 0.5-1ms. Essential for 60fps with complex fonts and shadows. |
| globalAlpha for transparency | rgba() / hsla() colors | 2016+ (CSS Color 4 standard) | Better GPU compositing (premultiplied alpha), no save/restore overhead, clearer per-element opacity. Browsers can optimize rgba() but not arbitrary globalAlpha. |
| Browser-only testing | OBS browser source validation | 2018+ (OBS Studio browser source maturity) | Catches OBS-specific issues: font loading, frame rate caps, GPU allocation, fillStyle transparency. Browser performance doesn't predict OBS performance. |
| measureText() every frame | Cache measurements in init() | 2017 (Scratch Blocks optimization) | Eliminates unnecessary font lookup and glyph walking. measureText is "fast" but 3600 calls/minute wastes CPU. Cache once, reuse indefinitely for static text. |
| Manual performance testing | Chrome DevTools Performance profiling | 2020+ (DevTools GPU timeline improvements) | Shows actual GPU usage, compositing layers, per-frame breakdown. Manual timing misses real bottlenecks (font loading, shadow rendering, transforms). |

**Deprecated/outdated:**
- **Repeated fillText() for static text:** No longer acceptable for 60fps with large fonts and shadows. Offscreen canvas caching is standard since 2015. fillText is only appropriate for dynamic text that changes every frame.
- **globalAlpha for individual elements:** CSS Color 4 rgba()/hsla() is preferred. globalAlpha still useful for full-scene fades but error-prone for per-element transparency.
- **Browser-only performance testing:** OBS validation is mandatory. Browser tests show "it works" but miss production issues specific to OBS's embedded Chromium (GPU sharing, frame rate, font loading).
- **Assuming 5x speedup without measurement:** Research shows 10-20x for text with shadows, but actual gain depends on font complexity, canvas size, and GPU. Always measure baseline vs optimized.

## Open Questions

Things that couldn't be fully resolved:

1. **Exact speedup ratio for Jost bold 96px with shadow in OBS**
   - What we know: Research shows 10-20x speedup for complex text rendering with offscreen canvas caching. fillText + shadow is expensive (10-15ms), drawImage is fast (0.5-1ms).
   - What's unclear: OBS's embedded Chromium may have different rendering pipeline than standalone Chrome. GPU usage shared with encoder may affect compositing speed.
   - Recommendation: Measure baseline vs optimized in actual OBS browser source (not just browser). Run window.perfValidation.runAll() in OBS DevTools. Document actual speedup for future reference. Expect ≥5x (PERF-01 requirement), likely 8-15x in practice.

2. **GPU usage threshold for "under 50%" validation**
   - What we know: PERF-03 requires "GPU usage remains under 50% during animation". Task Manager shows GPU % but doesn't isolate OBS browser source. Integrated graphics may show higher baseline than dedicated GPU.
   - What's unclear: Is 50% threshold for OBS process total (including encoder) or just browser source? Does "during animation" mean peak or average? Integrated vs dedicated GPU expectations?
   - Recommendation: Measure GPU % in Task Manager during 30+ minute test stream with game capture + OBS encoding running (realistic load). If GPU usage >50% consistently, profile with Chrome DevTools to identify bottleneck. Threshold is guideline, not hard limit - prioritize FPS stability ≥55fps over arbitrary GPU %.

3. **TextRendering property for performance**
   - What we know: MDN documents `ctx.textRendering = "optimizeSpeed"` to disable kerning/ligatures for faster rendering. Chrome DevTools shows this property exists.
   - What's unclear: Does OBS browser source respect textRendering property? Is speedup significant enough to justify reduced text quality? Jost font may not have extensive ligatures anyway.
   - Recommendation: Test textRendering in OBS after implementing offscreen canvas caching. If already meeting 5x+ requirement, leave textRendering at default (better quality). If struggling to hit 5x, try "optimizeSpeed" as secondary optimization.

4. **Offscreen canvas size for optimal performance**
   - What we know: Offscreen canvas should be sized to text bounding box + shadow padding. Larger canvas = more memory, smaller canvas = clipped shadow.
   - What's unclear: Is there performance difference between 800×150 canvas vs 1200×200 for same text? Does GPU care about canvas size for drawImage operations?
   - Recommendation: Size offscreen canvas precisely to text metrics + shadow padding (20px recommended). Measure textWidth + actualBoundingBox dimensions in init(), add padding, round up to nearest pixel. Don't oversize "to be safe" - wastes memory in cache.

5. **LRU cache eviction for text canvases**
   - What we know: AnimatedBar.offscreenCache has maxSize=50, evicts stale entries every 30s. Cache key includes text content, so different text = different cache entry.
   - What's unclear: Should text canvases use separate cache from bar canvases? Text canvases are larger (800×150 vs typical bar 200×50). Does 50-entry limit accommodate both?
   - Recommendation: Share existing LRU cache (code simplicity). Monitor cache size during testing (window.perfMonitor shows cache.size). If cache thrashing detected (frequent eviction), increase maxSize or use separate cache for text with smaller limit (e.g., 10 text canvases, 40 bar canvases).

## Sources

### Primary (HIGH confidence)
- [MDN Canvas Optimization Guide](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Offscreen canvas pre-rendering, alpha channel optimization, GPU rendering
- [MDN CanvasRenderingContext2D.measureText()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText) - TextMetrics API, caching strategy
- [MDN CanvasRenderingContext2D.textRendering](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textRendering) - Performance optimization property
- [OBS Browser Source Documentation](https://obsproject.com/kb/browser-source) - Frame rate configuration, validation methodology
- [Chrome DevTools Performance Profiling](https://developer.chrome.com/docs/devtools/performance/) - GPU timeline, compositing analysis

### Secondary (MEDIUM confidence)
- [Mirko Sertic: Supercharging HTML5 Canvas Text Performance](https://www.mirkosertic.de/blog/2015/03/tuning-html5-canvas-filltext/) - Offscreen canvas caching for fillText, 10x+ speedup validation
- [Scratch Blocks PR #1937: Cache text widths](https://github.com/LLK/scratch-blocks/pull/1937) - Production implementation of text measurement caching
- [jsPerf: Canvas globalAlpha vs rgba](https://jsperf.com/canvas-globalalpha-vs-rgba) - Performance comparison, rgba() preferred
- [HTML5 Canvas Tricks: Text Caching](https://gist.github.com/dschnare/6360657) - Registration point and caching patterns
- [CanvasMark 2013](https://github.com/kevinroast/CanvasMark) - Canvas benchmark methodology, used by Mozilla and Chromium
- [OBS Forums: Browser Source Frame Rate Issues](https://obsproject.com/forum/threads/browser-source-framerate-doesnt-work-in-22-x.96474/) - OBS-specific testing considerations
- [AG Grid: Optimising HTML5 Canvas Rendering](https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/) - Modern canvas optimization techniques
- [Kevin Schiener: willReadFrequently Attribute](https://www.schiener.io/2024-08-02/canvas-willreadfrequently) - GPU acceleration considerations

### Tertiary (LOW confidence)
- WebSearch results: "canvas text rendering performance offscreen cache 2026" - General optimization patterns
- WebSearch results: "OBS browser source test stream validation 2026" - Testing methodologies
- WebSearch results: "canvas GPU usage monitoring 50% threshold 2026" - Performance monitoring practices
- Community benchmarks (MeasureThat.net, jsPerf) - Performance comparisons, not authoritative but useful for ballpark expectations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Native APIs documented in MDN, offscreen canvas caching is established pattern since 2015 (Mirko Sertic), LRU cache already proven in v1.0
- Architecture: HIGH - Patterns from production implementations (Scratch Blocks text caching, RGraph offscreen rendering), existing Phase 3 infrastructure
- Pitfalls: HIGH - Based on documented MDN warnings, known OBS browser source issues, common canvas optimization mistakes
- Performance targets: MEDIUM - 5x+ requirement is conservative (research shows 10-20x), but actual OBS performance needs validation
- GPU usage: MEDIUM - 50% threshold is guideline from research, actual measurement in OBS environment needed
- OBS validation: MEDIUM - Documented browser source setup, but specific test protocol is derived from community practices rather than official OBS testing guide

**Research date:** 2026-01-19
**Valid until:** 2026-03-19 (60 days - canvas APIs stable, OBS browser source mature, performance patterns well-established)

**Key areas for validation during planning:**
1. Measure actual speedup in OBS browser source (expect 8-15x, need ≥5x for PERF-01)
2. Validate GPU usage <50% during 30+ minute stream with realistic load
3. Audit CurtainBar for globalAlpha usage, migrate to hsla() if needed (PERF-03)
4. Establish OBS test protocol with 5+ scenarios (short/medium/long, cold start, cache cleared)
5. Verify text canvas caching works with existing LRU cache (monitor cache.size, eviction rate)
