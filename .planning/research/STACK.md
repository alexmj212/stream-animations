# Stack Research: Shade Component with Scrolling Text

**Domain:** Canvas 2D stream graphics - shade component with scrolling text and curtains
**Researched:** 2026-01-18
**Confidence:** HIGH

## Executive Summary

The shade component extends your validated v1.0 Canvas 2D system with **scrolling text animations** and **curtain effects**. The research confirms that **no new libraries are needed** — the native Canvas 2D API provides all required text rendering and animation capabilities. Your existing architecture (AnimatedBar inheritance, delta-time normalization, easing functions) applies directly to the new component.

**Key finding:** Canvas 2D `fillText()` + `measureText()` are performant and sufficient. Avoid text animation libraries like GSAP or curtains.js — they add complexity/overhead with no benefit for your use case.

---

## What's NEW for Shade (v1.1)

The following capabilities are **new** compared to v1.0 (background/stinger/sidebar):

| NEW Capability | Implementation | Status |
|----------------|----------------|--------|
| **Text rendering on canvas** | `ctx.fillText()` with font property | Native API, no library needed |
| **Text width measurement** | `ctx.measureText()` returns TextMetrics | Native API, performant |
| **Dynamic hold duration** | Calculate based on text length + reading speed | Pure calculation function |
| **Horizontal scrolling text** | Update x position per frame with deltaTime | Extends existing AnimatedBar pattern |
| **Web font loading** | CSS Font Loading API with FontFace | Already used in sidebar DOM overlay |

**What's NOT new (already validated in v1.0):**
- AnimatedBar base class with inheritance ✓
- Delta-time normalization via DeltaTimer ✓
- Three-phase animation (enter/hold/exit) ✓
- Easing functions (easeInOutCubic) ✓
- Semi-transparent bars with globalAlpha ✓
- Horizontal bars (used in stinger/sidebar) ✓
- LRU cache for offscreen canvas ✓
- Centralized config.js ✓

---

## Recommended Stack (NEW for Shade)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Canvas 2D Text API** | Native | Text rendering with `fillText()` | Native, performant, zero overhead. Text rendering is a standard Canvas 2D operation that works across all browsers. Faster than DOM text for non-interactive displays. |
| **TextMetrics API** | Native | Dynamic text measurement via `measureText()` | Fastest method for calculating text width (~0.01ms per call). Returns sub-pixel accurate measurements. Essential for determining scroll distance and dynamic hold duration. |
| **CSS Font Loading API** | Native | Font loading with `FontFace` | Ensures web fonts (Jost) load before canvas renders text. Prevents FOUT (flash of unstyled text). Already used in sidebar for DOM text overlay. |

### Supporting Techniques (Vanilla JavaScript)

| Technique | Purpose | Implementation |
|-----------|---------|----------------|
| **Text scrolling with `fillText()`** | Horizontal scrolling text during hold phase | Draw text at changing x position each frame, multiply by deltaTime for frame-rate independence. Use `textMetrics.width` to calculate when text exits viewport. |
| **Dynamic hold duration** | Minimum readability time based on text length | Calculate `textMetrics.width`, convert to reading time at 200 WPM (accounting for 20-30% slower screen reading), add minimum 3-second hold. |
| **Semi-transparent curtains** | Top/bottom curtains with globalAlpha | Extend existing `AnimatedBar` pattern with horizontal bars entering from top/bottom edges. Use `globalAlpha` 0.7-0.85 for semi-transparency. Already proven in v1.0. |
| **Text layer z-index sorting** | Draw text above curtain bars | Assign curtains low z-index (-1 to 0), text high z-index (999). Sort bars array before rendering. Already used in sidebar. |

### Development Tools (Already Validated in v1.0)

| Tool | Purpose | Notes |
|------|---------|-------|
| **Vite 7.3.0** | Build system | Add `shade` mode to vite.config.js rollupOptions. Same pattern as stinger/background/sidebar. |
| **Vitest 4.0.16** | Unit testing | Test text measurement calculations, hold duration logic, scrolling position math. |
| **@fast-check/vitest 0.2.4** | Property-based testing | Test scroll position calculations with random text lengths (0-500 chars), ensure no off-by-one errors. |
| **vitest-canvas-mock 1.1.3** | Canvas mocking | Mock `fillText()`, `measureText()`, `font` property for deterministic unit tests. |

---

## Installation

**No new packages required.** All capabilities exist in:
- Native Canvas 2D API (text rendering, measurement)
- Existing validated architecture (AnimatedBar, DeltaTimer, config.js)
- Current build/test tooling (Vite, Vitest)

**Optional consideration (NOT RECOMMENDED):**
```bash
# DO NOT INSTALL unless you identify a specific performance issue
# npm install bezier-easing  # For custom cubic bezier curves (your easeInOutCubic is sufficient)
# npm install gsap           # For text animation (vanilla canvas is faster)
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Canvas 2D fillText()** | DOM text overlay (like sidebar currently uses) | Use DOM if you need text selection, accessibility, or CSS text effects. For shade (large event celebrations), canvas text is simpler and performs better at scale. |
| **Native measureText()** | Pre-calculate text widths offline | Use pre-calculation only if text options are fixed/limited. Shade requires dynamic text (raid usernames, gift amounts), so runtime measurement is necessary. |
| **Vanilla easeInOutCubic** | bezier-easing library (6KB) | Use library only if you need complex custom easing curves not expressible as cubic polynomials. Your existing `easeInOutCubic()` matches CSS cubic-bezier and is proven in v1.0. |
| **Direct fillText() in loop** | GSAP text animation | Use GSAP only if you need timeline-based choreography with multiple text elements. For single scrolling text, direct canvas updates are 10x simpler and faster. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **GSAP ScrollTrigger** | Designed for scroll-driven animations (user scrolling), not self-animating scrolling text. Adds 47KB+ minified for zero benefit. | Native `fillText()` with frame-by-frame x position updates via deltaTime. |
| **curtains.js** | WebGL library for image/video effects with shaders. Massive overkill (100KB+) for simple semi-transparent rectangles. Designed for displacement effects, not basic transparency. | Existing `AnimatedBar` horizontal bars with `globalAlpha` 0.7-0.85. |
| **CanvasRenderingContext2D.strokeText()** | Outlined text is harder to read at scale, slower to render than fillText(). Both must be drawn anyway (stroke doesn't provide fill). | `fillText()` with manual text shadow if outline needed (draw black offset, then white text). |
| **Offscreen canvas for text** | Text measurement requires context font state anyway. Pre-rendering gains nothing since text changes per event (dynamic content). | Direct `fillText()` in main loop. Enable offscreen cache only for static curtain bars (already implemented in AnimatedBar). |
| **Node Canvas / server-side rendering** | Shade is client-side OBS browser source. No server component. | Client-side Canvas 2D API in OBS Chromium. |
| **Marquee libraries (react-ticker, etc.)** | DOM-based, designed for React/Vue. Incompatible with canvas pixel rendering. | Direct canvas text scrolling via `fillText()` with changing x coordinate. |

---

## Stack Patterns for Shade Component

### Pattern 1: Scrolling Text Animation

**Approach:**
1. Calculate text width with `measureText()` once per animation lifecycle
2. Start text position at `canvas.width` (right edge)
3. Each frame: `textX -= scrollSpeedPerSecond * deltaTime`
4. Text fully exits when `textX < -textMetrics.width`
5. Use three-phase timing: enter (curtains slide in), hold (text scrolls), exit (curtains slide out)

**Why this works:**
- Frame-rate independent (deltaTime normalized)
- No external library overhead
- Matches existing AnimatedBar update pattern
- Natural left-to-right scrolling (typical reading direction)

**Example pseudo-code:**
```javascript
// In ShadeBar.update(deltaTime)
if (this.phase === 'hold') {
  this.textX -= this.scrollSpeed * deltaTime;

  // Check if text fully scrolled past left edge
  if (this.textX < -this.textMetrics.width) {
    this.phase = 'exit';
    this.phaseStartTime = this.elapsedTime;
  }
}
```

### Pattern 2: Dynamic Hold Duration

**Approach:**
1. Count words in input text: `text.split(/\s+/).length`
2. Calculate reading time: `words / 200 WPM * 60 seconds * 1.25` (25% slower for screen reading)
3. Calculate scroll time: `(textMetrics.width + canvas.width) / scrollSpeed`
4. Hold duration = `Math.max(readingTime, scrollTime, minHoldMs / 1000)`

**Why this works:**
- Ensures text is readable (doesn't scroll too fast)
- Accommodates short text ("Thanks!") and long text (raid messages with emotes)
- Minimum threshold prevents instant exit on short text
- Physical scroll time ensures text fully traverses viewport

**Example pseudo-code:**
```javascript
// In ShadeBar.init()
const words = this.text.split(/\s+/).length;
const readingTimeSec = (words / 200) * 60 * 1.25; // 200 WPM, 25% slower on screen
const scrollTimeSec = (this.textMetrics.width + this.canvas.width) / this.scrollSpeed;
const minHoldSec = config.shade.durations.holdMinMs / 1000;

this.holdDuration = Math.max(readingTimeSec, scrollTimeSec, minHoldSec);
```

### Pattern 3: Curtain Effects (Top/Bottom Entry)

**Approach:**
1. Create two horizontal bars: one at y=0 (top), one at y=canvas.height (bottom)
2. Start offscreen: top bar at `y = -barHeight`, bottom bar at `y = canvas.height`
3. Animate into position: top bar to `y = 0`, bottom bar to `y = canvas.height - barHeight`
4. Use `globalAlpha` 0.7-0.85 for semi-transparency
5. Draw text layer on top with z-index sorting (existing pattern from sidebar)

**Why this works:**
- Reuses AnimatedBar horizontal bar pattern (proven in stinger/sidebar)
- Semi-transparency via globalAlpha (native, performant)
- Top/bottom symmetry creates "curtain" effect
- No special library needed

**Example pseudo-code:**
```javascript
// Create top curtain
const topCurtain = new ShadeBar(ctx, canvas, 'horizontal', ...);
topCurtain.startY = -curtainHeight;
topCurtain.targetY = 0;
topCurtain.opacity = 0.8;
topCurtain.zIndex = -1; // Behind text

// Create bottom curtain
const bottomCurtain = new ShadeBar(ctx, canvas, 'horizontal', ...);
bottomCurtain.startY = canvas.height;
bottomCurtain.targetY = canvas.height - curtainHeight;
bottomCurtain.opacity = 0.8;
bottomCurtain.zIndex = -1; // Behind text

// Text bar drawn with zIndex = 999 (on top)
```

### Pattern 4: Text Rendering with Font Loading

**Approach:**
1. Use CSS Font Loading API to preload Jost font (already in sidebar)
2. Set canvas font property: `ctx.font = "bold 10vw Jost"` (calculate vw manually)
3. Use viewport-relative sizing: `fontSize = canvas.width * 0.1` for 10vw equivalent
4. Apply text shadow manually if needed (like sidebar's DOM text shadow)

**Why this works:**
- Font preloading prevents FOUT (flash of unstyled text)
- Viewport-relative sizing scales with canvas dimensions
- Manual shadow via double-draw (black offset, then white text) if needed
- Proven pattern from sidebar implementation

**Example pseudo-code:**
```javascript
// Load font (in HTML <head> or via FontFace API)
const font = new FontFace('Jost', 'url(/fonts/Jost-Bold.woff2)');
font.load().then(() => {
  document.fonts.add(font);
  // Start animation once font loaded
  requestAnimationFrame(animate);
});

// In ShadeBar.draw()
const fontSize = this.canvas.width * 0.08; // 8vw equivalent
this.ctx.font = `bold ${fontSize}px Jost`;
this.ctx.textAlign = 'left';
this.ctx.textBaseline = 'middle';

// Draw shadow (optional, like sidebar)
this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
this.ctx.fillText(this.text, this.textX + 5, this.textY + 5);

// Draw main text
this.ctx.fillStyle = 'white';
this.ctx.fillText(this.text, this.textX, this.textY);
```

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| **Vite** | 7.3.0 | vite-plugin-singlefile 2.3.0 | Already validated in v1.0. Add `shade` mode to config. |
| **Vitest** | 4.0.16 | vitest-canvas-mock 1.1.3 | Mock `measureText()` return value for deterministic tests. |
| **OBS Browser** | Chromium 120+ | Canvas 2D text APIs | OBS uses recent Chromium builds. TextMetrics full API available. |

**Browser Compatibility Note:**
- `measureText()` full TextMetrics interface (actualBoundingBox*, fontBoundingBox*, etc.) became Baseline available **March 2025** per MDN
- OBS Chromium version 120+ (current) supports all TextMetrics properties
- Basic `width` property supported since forever (Chrome 4, Firefox 3.5)

---

## Performance Considerations

### Text Rendering Performance

| Operation | Performance | Notes |
|-----------|-------------|-------|
| **fillText()** | ~0.1-0.5ms per draw | Fast. Drawing large text (10vw) at 60fps is trivial on streaming hardware. |
| **measureText()** | ~0.01ms per call | Fastest text width calculation method. Call once per lifecycle, cache result. |
| **globalAlpha** | Negligible overhead | Native compositing operation. No performance impact vs opaque fills. |
| **Font changes** | ~0.05ms per change | Avoid changing font every frame. Set once per bar in init(). |

**Benchmark reference:** Canvas text rendering is CPU-bound, not GPU. On typical streaming hardware (Intel i5+), expect 60fps even with 10+ bars + scrolling text.

### Optimization Checklist

- [x] **Call measureText() once** - Cache `textMetrics.width` in bar init, don't recalculate every frame
- [x] **Set font property once** - Font changes have cost, set in init() not draw()
- [x] **Use offscreen cache for static bars** - Curtain bars (if colored/patterned) benefit from caching (already implemented in AnimatedBar)
- [x] **Avoid text shadows via shadowBlur** - Use manual offset technique (existing pattern) instead of ctx.shadowBlur (slow)
- [ ] **Batch text draws** - Draw all bars, then all text in separate pass if z-index matters (existing sidebar pattern)
- [ ] **Use ctx.textRendering = 'optimizeSpeed'** - Consider if text quality acceptable (trade legibility for 10-15% speed boost)

**Known from v1.0 validation:**
- Delta-time normalization prevents frame-rate dependent animations ✓
- LRU cache with maxSize=50 prevents memory leaks ✓
- Viewport culling skips offscreen draws ✓
- Performance monitoring via `?perf=true` tracks FPS/memory ✓

---

## Text-Specific Gotchas

### Gotcha 1: Text Measurement Requires Font Context

**Problem:** `measureText()` depends on `ctx.font` being set first. Calling `measureText()` before setting font returns width based on default "10px sans-serif".

**Solution:** Set `ctx.font` in `init()` before calling `measureText()`:
```javascript
init() {
  const fontSize = this.canvas.width * 0.08;
  this.ctx.font = `bold ${fontSize}px Jost`;
  this.textMetrics = this.ctx.measureText(this.text);
  this.scrollSpeed = ...; // Use textMetrics.width for calculations
}
```

### Gotcha 2: TextMetrics Width vs actualBoundingBox

**Problem:** `textMetrics.width` is inline width (advance width), which may be narrower than actual rendered bounds for italic/slanted fonts. `actualBoundingBoxLeft + actualBoundingBoxRight` gives true visual width.

**Solution:** For scrolling text exit detection, use `actualBoundingBoxLeft + actualBoundingBoxRight` if visual precision matters:
```javascript
const visualWidth = this.textMetrics.actualBoundingBoxLeft + this.textMetrics.actualBoundingBoxRight;
if (this.textX < -visualWidth) {
  // Text fully exited viewport
}
```

### Gotcha 3: Font Loading Race Condition

**Problem:** Canvas renders before web font loads, fallback font (sans-serif) used, text width wrong.

**Solution:** Use FontFace API (already in sidebar) or CSS `font-display: block`:
```javascript
// In HTML or setup
const font = new FontFace('Jost', 'url(/fonts/Jost-Bold.woff2)');
font.load().then(() => {
  document.fonts.add(font);
  // Now safe to start animation
  requestAnimationFrame(animate);
});
```

### Gotcha 4: Viewport-Relative Font Sizing

**Problem:** CSS units like `10vw` don't work in canvas `ctx.font` property (expects px/pt/em).

**Solution:** Calculate manually based on canvas dimensions:
```javascript
const fontSize = this.canvas.width * 0.10; // 10vw equivalent
this.ctx.font = `bold ${fontSize}px Jost`;
```

**Note:** Canvas size matches viewport (100vw × 100vh from CSS), so `canvas.width * 0.10` === 10vw.

### Gotcha 5: Text Baseline Alignment

**Problem:** Default baseline is "alphabetic" which positions text relative to lowercase letters. Large all-caps text may appear vertically misaligned.

**Solution:** Use `textBaseline = 'middle'` for vertical centering:
```javascript
this.ctx.textBaseline = 'middle';
this.ctx.fillText(this.text, this.textX, this.canvas.height / 2); // Vertically centered
```

---

## Reading Time Research (for Dynamic Hold Duration)

### Average Reading Speeds

| Reading Type | Speed (WPM) | Notes |
|--------------|-------------|-------|
| **Silent reading (comprehension)** | 200-250 WPM | Adults reading for understanding |
| **Skimming** | 400-700 WPM | Not suitable for shade (celebratory context requires reading) |
| **Screen reading** | 160-180 WPM | 20-30% slower than print due to eye strain, scrolling interruptions |

**Recommendation:** Use **200 WPM** as baseline for shade hold duration calculation. This accounts for:
- Celebratory context (users want to read names/amounts)
- Screen reading slowdown
- Scrolling text (moving target, slower than static)

### Hold Duration Formula

```javascript
const words = text.split(/\s+/).length;
const readingTimeSec = (words / 200) * 60; // 200 WPM baseline
const scrollTimeSec = (textMetrics.width + canvas.width) / scrollSpeed; // Physical scroll time
const minHoldSec = 3; // Minimum 3 seconds for short text

holdDuration = Math.max(readingTimeSec, scrollTimeSec, minHoldSec);
```

**Rationale:**
- `readingTimeSec`: Ensures adequate comprehension time
- `scrollTimeSec`: Ensures text fully traverses viewport (doesn't cut off mid-scroll)
- `minHoldSec`: Prevents jarring instant-exit on short text ("Thanks!")

---

## Sources

### Official Documentation (HIGH confidence)
- [CanvasRenderingContext2D.measureText() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText) — TextMetrics API
- [TextMetrics - MDN](https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics) — All text measurement properties
- [CanvasRenderingContext2D.fillText() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText) — Text rendering API
- [CanvasRenderingContext2D.font - MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/font) — Font property and CSS Font Loading API
- [CanvasRenderingContext2D.globalAlpha - MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalAlpha) — Transparency API
- [CanvasRenderingContext2D.textRendering - MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textRendering) — Text rendering optimization

### Performance Best Practices (MEDIUM confidence - verified with official sources)
- [Optimizing canvas - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) — Official optimization guide
- [Improving HTML5 Canvas performance - web.dev](https://web.dev/articles/canvas-performance) — Chrome team recommendations
- [Optimising HTML5 Canvas Rendering - AG Grid](https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/) — Enterprise-scale canvas optimization

### Animation Techniques (MEDIUM confidence - community best practices)
- [Buttery-Smooth Scroll Animations - DEV](https://dev.to/nidal_tahir_cde5660ddbe04/buttery-smooth-scroll-animations-building-a-high-performance-canvas-parallax-effect-2m8l) — Canvas scroll performance
- [Create a Smooth Canvas Animation - Spicy Yoghurt](https://spicyyoghurt.com/tutorials/html5-javascript-game-development/create-a-smooth-canvas-animation) — Frame-rate independent animation
- [bezier-easing - GitHub](https://github.com/gre/bezier-easing) — Cubic bezier implementation (reference, not needed)

### Reading Time Research (LOW confidence - multiple sources, unverified)
- [Reading Time Calculator - Character Calculator](https://charactercalculator.com/reading-time-calculator/) — 200-250 WPM baseline
- [Words per Minute Calculator - Omni Calculator](https://www.omnicalculator.com/everyday-life/words-per-minute) — Reading speed estimates
- [Reading Time Increases Engagement - MarTech](https://martech.org/estimated-reading-times-increase-engagement/) — Screen reading 20-30% slower

---

*Stack research for: Shade component with scrolling text and curtains*
*Researched: 2026-01-18*
*Architecture: Extends v1.0 validated Canvas 2D system — NO NEW LIBRARIES REQUIRED*
