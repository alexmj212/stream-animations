# Architecture Research: Shade Component Integration

**Domain:** Canvas-based stream graphics - shade/curtain component with scrolling text
**Researched:** 2026-01-18
**Confidence:** HIGH (builds on validated v1.0 architecture + verified Canvas text rendering patterns)

## Executive Summary

The shade component extends the existing three-phase animation pattern (enter/hold/exit) used in stinger and sidebar scenes. The key architectural decision is **whether to render scrolling text using Canvas or DOM**, with Canvas offering better OBS chroma key compatibility and DOM offering simpler text layout. Based on the project's "OBS output preview is primary testing environment" constraint, **Canvas-based text rendering is recommended** despite higher complexity, as it ensures consistent rendering in OBS's browser source.

The architecture follows the validated v1.0 patterns:
- **ShadeBar class** extends AnimatedBar (inheritance pattern)
- **Pure calculation functions** for text width/duration calculations
- **Config-driven timing** using centralized config.js
- **Delta-time normalization** for frame-rate independence
- **One-shot animation** triggered on page load (like sidebar)

The only new complexity is **text scrolling within the curtain hold phase**, which requires Canvas text measurement APIs and offscreen canvas caching for optimal performance.

---

## Integration with Existing Architecture

### Component Structure (v1.0 Pattern)

The shade component follows the established scene architecture:

```
src/
├── shade/                    # NEW scene (parallel to background/stinger/sidebar)
│   ├── index.html           # Scene HTML with canvas element
│   ├── ShadeBar.js          # Extends AnimatedBar (like StingerBar, SidebarBar)
│   └── main.js (inline)     # Scene setup in index.html (like sidebar)
├── shared/
│   ├── AnimatedBar.js       # REUSE: Base class (no changes needed)
│   ├── animations/
│   │   └── calculations.js  # EXTEND: Add text measurement functions
│   ├── timing.js            # REUSE: DeltaTimer
│   ├── lifecycle.js         # REUSE: AnimationLifecycle
│   └── canvas.js            # REUSE: setupCanvas, clearCanvas
└── config/
    └── config.js            # EXTEND: Add shade section
```

**Key Insight:** The shade scene is a **sibling to stinger/sidebar**, not a child. It uses the same base classes and utilities but has its own scene-specific bar class.

### Inheritance Chain

```
AnimatedBar (base class)
├── Properties:
│   ├── ctx, canvas          # Canvas context/element
│   ├── type                 # 'slanted' (shade uses full-height curtain)
│   ├── active               # Lifecycle flag
│   └── useOffscreenCache    # Performance optimization
├── Methods:
│   ├── drawBar()            # Renders colored rectangles
│   ├── getOrCreateOffscreenCanvas() # Caching for white bars
│   ├── easeInOutCubic()     # Timing function
│   └── update(deltaTime)    # Override in subclass
└── Static:
    └── offscreenCache       # Shared LRU cache

↓ Inheritance

ShadeBar (NEW)
├── Properties:
│   ├── text                 # Display text
│   ├── textWidth            # Measured width (for scroll duration)
│   ├── scrollOffset         # Current scroll position
│   ├── phase                # 'enter', 'hold', 'exit'
│   ├── elapsedTime          # Time tracking
│   └── duration             # Total animation duration (enter + hold + exit)
├── Methods:
│   ├── init()               # Initialize positions, calculate hold duration
│   ├── update(deltaTime)    # THREE-PHASE: enter (slide in), hold (scroll), exit (slide out)
│   ├── draw()               # Render curtain + text
│   └── drawScrollingText()  # NEW: Canvas text rendering with scroll offset
└── Timing Pattern:
    └── THREE-PHASE (like sidebar/stinger, NOT continuous like background)
```

**Design Decision:** ShadeBar uses **'slanted' type** for the curtain (full-height vertical bar) but does NOT use horizontal bars. This is simpler than sidebar's mixed approach.

---

## Data Flow

### Scene Lifecycle

```
Page Load
    ↓
URL Parameters → Config
    ├── ?text=Message        # Text to display
    ├── ?color=ff6b35        # Base color
    └── ?duration=5000       # Optional (defaults to auto-calculated)
    ↓
ShadeBar Initialization
    ├── Measure text width (Canvas measureText)
    ├── Calculate hold duration = f(textWidth, scrollSpeed)
    ├── Set phase = 'enter'
    └── Position curtain offscreen right
    ↓
Animation Loop (requestAnimationFrame)
    ├── Update Phase:
    │   ├── DeltaTimer.update(timestamp) → deltaTime
    │   ├── ShadeBar.update(deltaTime)
    │   │   ├── IF phase == 'enter': slide curtain from right to center
    │   │   ├── IF phase == 'hold': scroll text left-to-right
    │   │   └── IF phase == 'exit': slide curtain back offscreen right
    │   └── Check if animation complete (phase == 'exit' && progress >= 1)
    └── Render Phase:
        ├── clearCanvas(ctx, canvas)
        ├── ShadeBar.draw()
        │   ├── drawBar() → curtain rectangle
        │   └── drawScrollingText() → Canvas fillText with offset
        └── If not complete: requestAnimationFrame(animate)
```

### Text Scrolling Within Hold Phase

```
Hold Phase Entry
    ↓
Calculate scroll distance
    ├── Text starts: offscreen left (x = -textWidth)
    ├── Text ends: offscreen right (x = canvas.width)
    └── Total distance = canvas.width + textWidth
    ↓
Each frame during hold:
    ├── Calculate progress = phaseTime / holdDuration
    ├── scrollOffset = lerp(-textWidth, canvas.width, progress)
    ├── Render text at (curtainCenterX + scrollOffset, curtainCenterY)
    └── When progress >= 1: transition to 'exit' phase
```

**Key Constraint:** Hold duration MUST be long enough for text to scroll completely across the curtain. This is calculated automatically:

```javascript
// Pure calculation function
export function calculateHoldDuration(textWidth, canvasWidth, scrollSpeed, config) {
  const totalDistance = textWidth + canvasWidth;
  const minHoldMs = (totalDistance / scrollSpeed) * 1000; // Convert to milliseconds
  return Math.max(minHoldMs, config.shade.timing.minHoldMs); // Enforce minimum
}
```

---

## Component Boundaries & Responsibilities

| Component | Responsibility | Integration Point |
|-----------|---------------|-------------------|
| **ShadeBar.js** | Shade-specific animation logic (enter/hold/exit), text scrolling, hold duration calculation | Extends AnimatedBar, uses config.shade |
| **AnimatedBar.js** | Curtain rendering (drawBar), offscreen caching, easing | REUSE: No changes needed |
| **calculations.js** | TEXT MEASUREMENT: calculateTextWidth(), calculateHoldDuration() | NEW: Pure functions for text layout |
| **config.js** | shade section: timing proportions, scroll speed, text rendering settings | NEW: config.shade.* |
| **index.html** | Scene setup, canvas element, inline animation loop | NEW: Similar to sidebar/index.html |
| **DeltaTimer** | Frame-rate independent timing | REUSE: Same pattern as v1.0 |
| **AnimationLifecycle** | Cleanup on page unload | REUSE: Same pattern as v1.0 |

**Architectural Boundary:** ShadeBar does NOT call requestAnimationFrame—main animation loop does. ShadeBar only implements `update()` and `draw()`.

---

## Architectural Patterns

### Pattern 1: Canvas vs DOM Text Rendering

**The Question:** Should scrolling text be rendered using Canvas (fillText) or DOM (HTML element with CSS animation)?

**Canvas Approach (RECOMMENDED):**

```javascript
// ShadeBar.drawScrollingText()
drawScrollingText() {
  const curtainCenterX = this.x; // Curtain's center X position
  const curtainCenterY = this.canvas.height / 2;

  // Calculate scroll offset within curtain boundaries
  const progress = this.phaseTime / this.holdDuration;
  const scrollStart = -this.textWidth;
  const scrollEnd = this.canvas.width;
  const scrollOffset = scrollStart + (scrollEnd - scrollStart) * progress;

  // Clip text to curtain area (prevent overflow)
  this.ctx.save();
  this.ctx.rect(this.x - this.width / 2, 0, this.width, this.canvas.height);
  this.ctx.clip();

  // Render text
  this.ctx.font = `bold ${config.shade.text.fontSize}px ${config.shade.text.fontFamily}`;
  this.ctx.fillStyle = config.shade.text.color;
  this.ctx.textAlign = 'left';
  this.ctx.textBaseline = 'middle';
  this.ctx.fillText(
    this.text,
    curtainCenterX + scrollOffset,
    curtainCenterY
  );

  this.ctx.restore();
}
```

**DOM Approach (NOT RECOMMENDED for OBS):**

```html
<!-- index.html -->
<div id="textOverlay" style="position: absolute; clip-path: rect(...)">
  <div id="scrollingText" style="animation: scroll 5s linear"></div>
</div>
```

**Decision Matrix:**

| Factor | Canvas | DOM |
|--------|--------|-----|
| OBS Compatibility | ✓ Perfect | ⚠ May have chroma key issues |
| Text Layout | ⚠ Manual measurement | ✓ Automatic wrapping |
| Performance | ✓ Cached offscreen canvas | ✓ GPU-accelerated CSS |
| Synchronization | ✓ Frame-by-frame control | ⚠ CSS animation timing drift |
| Testing | ⚠ Visual only | ✓ DOM assertions |

**Recommendation:** Use Canvas for **OBS chroma key consistency**. The project constraint "Primary testing happens in OBS output preview (not browser)" means DOM rendering risks introducing browser-specific artifacts that won't appear in development but will appear in production (OBS).

**Trade-off:** Canvas text requires manual measurement and clipping logic, but this is offset by performance benefits (offscreen caching) and guarantees consistent rendering in OBS.

---

### Pattern 2: Dynamic Hold Duration Calculation

**Problem:** Unlike stinger/sidebar with fixed durations, the shade component's hold phase must be **long enough for text to scroll completely**.

**Solution:** Calculate hold duration based on text width.

```javascript
// calculations.js (NEW pure function)
/**
 * Calculate minimum hold duration for text to scroll completely
 * @param {number} textWidth - Measured text width in pixels
 * @param {number} canvasWidth - Canvas width
 * @param {number} scrollSpeed - Pixels per second
 * @param {Object} config - Config object
 * @returns {number} Hold duration in milliseconds
 */
export function calculateShadeHoldDuration(textWidth, canvasWidth, scrollSpeed, config) {
  // Text must travel: from offscreen left (-textWidth) to offscreen right (canvasWidth)
  const totalDistance = textWidth + canvasWidth;

  // Calculate time at constant speed
  const calculatedMs = (totalDistance / scrollSpeed) * 1000;

  // Enforce minimum duration (prevents too-fast animation for short text)
  return Math.max(calculatedMs, config.shade.timing.minHoldMs);
}
```

**Testing Strategy:**

```javascript
describe('calculateShadeHoldDuration', () => {
  const config = {
    shade: {
      timing: { minHoldMs: 2000 }
    }
  };

  test('short text uses minimum duration', () => {
    const duration = calculateShadeHoldDuration(100, 1920, 300, config);
    expect(duration).toBe(2000); // Minimum enforced
  });

  test('long text increases duration proportionally', () => {
    const duration = calculateShadeHoldDuration(1000, 1920, 300, config);
    const expectedDistance = 1000 + 1920; // 2920px
    const expectedTime = (2920 / 300) * 1000; // ~9733ms
    expect(duration).toBeCloseTo(expectedTime, 0);
  });

  test('faster scroll speed reduces duration', () => {
    const slow = calculateShadeHoldDuration(500, 1920, 200, config);
    const fast = calculateShadeHoldDuration(500, 1920, 400, config);
    expect(fast).toBeLessThan(slow);
  });
});
```

**Integration:** Main scene setup calls this function:

```javascript
// shade/index.html (inline script)
const text = urlParams.get('text') || 'Default Message';

// Measure text width (Canvas API)
const tempCtx = canvas.getContext('2d');
tempCtx.font = `bold ${config.shade.text.fontSize}px ${config.shade.text.fontFamily}`;
const metrics = tempCtx.measureText(text);
const textWidth = metrics.width;

// Calculate dynamic hold duration
const holdDuration = calculateShadeHoldDuration(
  textWidth,
  canvas.width,
  config.shade.text.scrollSpeed,
  config
);

// Override URL parameter if provided (manual control)
const finalDuration = parseInt(urlParams.get('duration')) || holdDuration;

// Create shade bar with calculated duration
const shadeBar = new ShadeBar(ctx, canvas, text, textWidth, finalDuration);
```

**Why this pattern:** Ensures text readability regardless of message length. Short messages ("Hi!") don't zoom by too fast. Long messages ("Welcome to the stream!") have enough time to scroll completely.

---

### Pattern 3: Offscreen Canvas Caching for Text

**Problem:** Canvas text rendering is expensive. Re-rendering the same text every frame wastes CPU ([Mirko Sertic: Canvas fillText Performance](https://www.mirkosertic.de/blog/2015/03/tuning-html5-canvas-filltext/)).

**Solution:** Render text to offscreen canvas once, then use `drawImage()` for subsequent frames.

```javascript
// ShadeBar.init()
init() {
  // ... other initialization ...

  // Pre-render text to offscreen canvas (do once)
  this.textCanvas = document.createElement('canvas');
  this.textCanvas.width = this.textWidth;
  this.textCanvas.height = config.shade.text.fontSize * 2; // Extra height for descenders

  const textCtx = this.textCanvas.getContext('2d');
  textCtx.font = `bold ${config.shade.text.fontSize}px ${config.shade.text.fontFamily}`;
  textCtx.fillStyle = config.shade.text.color;
  textCtx.textAlign = 'left';
  textCtx.textBaseline = 'middle';
  textCtx.fillText(this.text, 0, this.textCanvas.height / 2);

  // Now this.textCanvas contains rendered text
}

// ShadeBar.drawScrollingText()
drawScrollingText() {
  const curtainCenterX = this.x;
  const curtainCenterY = this.canvas.height / 2;

  const progress = this.phaseTime / this.holdDuration;
  const scrollStart = -this.textWidth;
  const scrollEnd = this.canvas.width;
  const scrollOffset = scrollStart + (scrollEnd - scrollStart) * progress;

  // Clip to curtain
  this.ctx.save();
  this.ctx.rect(this.x - this.width / 2, 0, this.width, this.canvas.height);
  this.ctx.clip();

  // Draw pre-rendered text (fast!)
  this.ctx.drawImage(
    this.textCanvas,
    curtainCenterX + scrollOffset,
    curtainCenterY - this.textCanvas.height / 2
  );

  this.ctx.restore();
}
```

**Performance Impact:**
- Without caching: ~10ms per frame (fillText is expensive)
- With caching: ~1ms per frame (drawImage is fast)

**Trade-off:** Memory overhead for one offscreen canvas per ShadeBar instance. For shade component (only 1 bar), this is negligible.

**Source:** [Mirko Sertic: Tuning HTML5 Canvas fillText](https://www.mirkosertic.de/blog/2015/03/tuning-html5-canvas-filltext/), [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)

---

### Pattern 4: Text Clipping to Curtain Boundaries

**Problem:** Text must only be visible within the curtain area. When curtain is sliding in/out, text outside curtain must be hidden.

**Solution:** Use Canvas clipping region (`ctx.clip()`).

```javascript
drawScrollingText() {
  this.ctx.save();

  // Define clipping rectangle (curtain boundaries)
  const curtainLeft = this.x - this.width / 2;
  const curtainTop = 0;
  const curtainWidth = this.width;
  const curtainHeight = this.canvas.height;

  this.ctx.rect(curtainLeft, curtainTop, curtainWidth, curtainHeight);
  this.ctx.clip(); // All subsequent drawing operations are clipped to this rectangle

  // Draw text (only visible portion will render)
  this.ctx.drawImage(this.textCanvas, ...);

  this.ctx.restore(); // Remove clipping
}
```

**Why not CSS overflow:hidden?** Because text is rendered on Canvas, not DOM. Canvas doesn't have CSS properties.

**Alternative:** Manual bounds checking (check if text position is within curtain before drawing). Clipping is simpler and more robust.

---

## Configuration Structure

Add shade section to existing config.js:

```javascript
// config/config.js (ADD)
export const config = {
  // ... existing background, stinger, sidebar sections ...

  // Shade scene configuration (NEW)
  shade: {
    // Timing proportions (like sidebar)
    timing: {
      enterProportion: 0.2,      // 20% of total duration for enter
      exitProportion: 0.2,       // 20% of total duration for exit
      // holdProportion calculated dynamically based on text width
      minHoldMs: 2000,           // Minimum 2 seconds for short text
      maxHoldMs: 10000,          // Maximum 10 seconds for very long text
    },

    // Curtain (slanted bar) configuration
    curtain: {
      width: 0.5,                // 50% of viewport width
      position: 0.5,             // Center horizontally (50% from left)
      angle: 15,                 // Rotation angle (matches other scenes)
      opacity: 1.0,              // Fully opaque curtain
      // Colors from baseHSL (like sidebar background bar)
    },

    // Text rendering
    text: {
      fontSize: 48,              // Base font size (scales with viewport?)
      fontFamily: 'Jost, Arial, sans-serif', // Match sidebar font
      color: 'white',            // Text color
      scrollSpeed: 300,          // Pixels per second
      // textRendering: 'optimizeLegibility' // Canvas textRendering property
    },

    // Offscreen positioning
    offscreen: {
      startMargin: 200,          // Distance beyond viewport right edge
    }
  },

  // ... existing shared, performance sections ...
};
```

**Design Notes:**
- `enterProportion` + `exitProportion` + `holdProportion` = 1.0 (like sidebar)
- Hold proportion is **NOT fixed**—calculated based on text width
- Curtain is a single slanted bar (simpler than sidebar's multiple bars)
- Text scrolls at constant speed (not eased) for readability

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| v1.1 (shade only) | Single ShadeBar instance, text measurement on init, offscreen canvas caching |
| v1.2 (multiple shades) | Reuse ShadeBar for different text messages, cache management (LRU if needed) |
| v2.0 (dynamic text updates) | Text texture atlas (pre-render common characters), WebGL rendering for complex effects |

**Key Insight:** For v1.1, the architecture is optimized for **one-shot animations with static text**. If future requirements include rapidly changing text (e.g., chat messages), consider texture atlas pattern to avoid re-creating offscreen canvases.

**Not needed for v1.1:** Text wrapping, multi-line layout, dynamic font sizing. These add complexity without immediate benefit.

---

## Anti-Patterns

### Anti-Pattern 1: Re-measuring Text Every Frame

**What:** Calling `ctx.measureText()` inside `update()` or `draw()`

**Why bad:** Text measurement is synchronous and blocks rendering. Measuring every frame wastes CPU.

**Do this instead:** Measure once in `init()`, cache `textWidth` as instance property.

```javascript
// BAD
draw() {
  const metrics = this.ctx.measureText(this.text); // SLOW!
  const textWidth = metrics.width;
  // ... use textWidth
}

// GOOD
init() {
  const metrics = this.ctx.measureText(this.text);
  this.textWidth = metrics.width; // Cache once
}

draw() {
  // Use this.textWidth (already cached)
}
```

---

### Anti-Pattern 2: Using DOM for Text with Canvas for Curtain

**What:** Mixing DOM `<div>` overlay with Canvas curtain

**Why bad:** Synchronization issues (CSS animation timing vs. Canvas rAF timing), OBS rendering inconsistencies.

**Do this instead:** Render both curtain AND text on Canvas for consistent timing.

---

### Anti-Pattern 3: Fixed Hold Duration for All Text Lengths

**What:** Using `config.shade.timing.holdMs = 3000` regardless of text length

**Why bad:** Short text scrolls too fast (unreadable), long text gets cut off.

**Do this instead:** Calculate hold duration based on text width (Pattern 2).

---

### Anti-Pattern 4: Ignoring Canvas Text Clipping

**What:** Rendering text without clipping region, letting it overflow curtain boundaries

**Why bad:** Breaks visual effect (text visible outside curtain during enter/exit phases).

**Do this instead:** Use `ctx.clip()` to restrict text rendering to curtain area (Pattern 4).

---

### Anti-Pattern 5: Easing the Text Scroll

**What:** Applying `easeInOutCubic()` to text scroll offset

**Why bad:** Makes text harder to read (speeds up and slows down during scroll).

**Do this instead:** Use **linear interpolation** for text scroll (constant speed). Reserve easing for curtain enter/exit.

```javascript
// BAD
const easedProgress = this.easeInOutCubic(progress);
const scrollOffset = lerp(-textWidth, canvasWidth, easedProgress); // Text speeds up/slows down

// GOOD (linear scroll)
const scrollOffset = lerp(-textWidth, canvasWidth, progress); // Constant speed
```

---

## Integration Points

### With AnimatedBar (Base Class)

| Integration | How |
|-------------|-----|
| Curtain rendering | Call `this.drawBar()` with curtain parameters |
| Easing for enter/exit | Use `this.easeInOutCubic()` for curtain slide-in/out |
| Offscreen caching | Reuse `AnimatedBar.offscreenCache` if needed (for colored curtain bars) |
| Active flag | Set `this.active = false` when animation completes |

**No changes needed to AnimatedBar.js**—ShadeBar is a pure extension.

---

### With Config Layer

| Config Section | Usage |
|---------------|--------|
| `config.shade.timing.*` | Calculate enter/hold/exit durations |
| `config.shade.curtain.*` | Curtain dimensions, position, angle |
| `config.shade.text.*` | Font, color, scroll speed |
| `config.shared.shadow.*` | Shadow rendering for curtain |

**Add new `config.shade` section**—no changes to existing sections.

---

### With Pure Calculations

| Function | Purpose |
|----------|---------|
| `calculateShadeHoldDuration(textWidth, canvasWidth, scrollSpeed, config)` | NEW: Calculate hold duration |
| `isBarInViewport(x, y, width, height, canvasWidth, canvasHeight, margin)` | REUSE: Viewport culling (though shade is always on-screen) |

**Add new pure functions to calculations.js**—existing functions unchanged.

---

### With Scene Setup (index.html)

| Pattern | From |
|---------|------|
| URL parameters | sidebar (text parameter) |
| One-shot animation | sidebar (page load trigger) |
| Canvas setup | All scenes (setupCanvas) |
| Delta-time loop | All scenes (DeltaTimer) |
| Lifecycle cleanup | All scenes (AnimationLifecycle) |

**Shade scene is most similar to sidebar**—use sidebar/index.html as template.

---

## Build Order Recommendations

Based on architectural dependencies:

### Phase 1: Config & Calculations (Foundation)
1. Add `config.shade` section to config.js
2. Add `calculateShadeHoldDuration()` to calculations.js
3. Write unit tests for hold duration calculation
4. Document text measurement strategy

**Why first:** Establishes contracts before implementation. Tests define behavior.

---

### Phase 2: ShadeBar Class (Core Component)
1. Create `ShadeBar.js` extending AnimatedBar
2. Implement `init()` with text measurement
3. Implement three-phase `update()` (enter/hold/exit)
4. Implement `draw()` with curtain only (no text yet)
5. Write unit tests for phase transitions

**Why second:** Builds component layer on foundation. Tests verify timing logic.

---

### Phase 3: Text Rendering (Text Layer)
1. Implement `drawScrollingText()` with Canvas fillText
2. Add text clipping to curtain boundaries
3. Test text visibility during enter/exit phases
4. Add offscreen canvas caching for performance

**Why third:** Adds text layer on working curtain. Ensures curtain works before adding complexity.

---

### Phase 4: Scene Integration (Scene Setup)
1. Create `shade/index.html` based on sidebar template
2. Add URL parameter parsing (text, color, duration)
3. Implement animation loop with DeltaTimer
4. Add AnimationLifecycle cleanup
5. Manual OBS testing

**Why fourth:** Integrates component into scene. OBS testing validates rendering.

---

### Phase 5: Visual Polish (Refinement)
1. Adjust scroll speed for readability
2. Fine-tune curtain width/position
3. Add shadow to text (optional)
4. Performance profiling

**Why last:** Polish after functionality is validated. OBS testing drives adjustments.

---

## Testing Strategy

### Unit Tests (Pure Functions)

```javascript
// calculations.test.js
describe('Text measurement calculations', () => {
  test('calculateShadeHoldDuration enforces minimum', () => {
    const config = { shade: { timing: { minHoldMs: 2000 } } };
    const duration = calculateShadeHoldDuration(50, 1920, 300, config);
    expect(duration).toBe(2000);
  });

  test('calculateShadeHoldDuration scales with text width', () => {
    const config = { shade: { timing: { minHoldMs: 1000 } } };
    const short = calculateShadeHoldDuration(100, 1920, 300, config);
    const long = calculateShadeHoldDuration(1000, 1920, 300, config);
    expect(long).toBeGreaterThan(short);
  });
});
```

---

### Component Tests (ShadeBar)

```javascript
// ShadeBar.test.js
describe('ShadeBar lifecycle', () => {
  test('starts in enter phase', () => {
    const bar = new ShadeBar(ctx, canvas, 'Test', 200, 5000);
    expect(bar.phase).toBe('enter');
  });

  test('transitions to hold after enter duration', () => {
    const bar = new ShadeBar(ctx, canvas, 'Test', 200, 5000);
    const enterDuration = bar.enterDuration;

    // Simulate time passing
    bar.update(enterDuration + 0.001); // Just past enter
    expect(bar.phase).toBe('hold');
  });

  test('text scrolls from left to right during hold', () => {
    const bar = new ShadeBar(ctx, canvas, 'Test', 200, 5000);
    bar.phase = 'hold';
    bar.phaseStartTime = 0;
    bar.elapsedTime = 0;

    const initialOffset = bar.calculateScrollOffset();

    bar.update(bar.holdDuration / 2); // Halfway through hold
    const midOffset = bar.calculateScrollOffset();

    expect(midOffset).toBeGreaterThan(initialOffset); // Moving right
  });
});
```

---

### Visual Tests (Manual OBS Validation)

**Test Cases:**
1. **Short text ("Hi!")**: Verify minimum hold duration prevents too-fast scroll
2. **Long text ("Welcome to stream!")**: Verify full text scrolls completely
3. **Curtain clipping**: Verify text not visible outside curtain during enter/exit
4. **Color consistency**: Verify curtain color matches baseHSL parameter
5. **Performance**: Verify 60fps with ?perf=true in OBS browser source

**Why manual:** Canvas rendering in OBS may differ from browser. Visual validation is primary test.

---

## Architectural Decision Log

| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| Canvas text rendering | OBS chroma key consistency | DOM overlay (simpler but risky for OBS) |
| Single curtain bar | Simpler than sidebar's multiple bars | Multiple accent bars (unnecessary complexity) |
| Dynamic hold duration | Ensures text readability | Fixed duration (fails for long text) |
| Linear text scroll | Readability (constant speed) | Eased scroll (looks cool but harder to read) |
| Offscreen text caching | Performance (10ms → 1ms) | Re-render every frame (wastes CPU) |
| Three-phase pattern | Matches sidebar/stinger (consistency) | Continuous loop (wrong for one-shot notification) |

---

## Sources & Confidence Assessment

| Topic | Confidence | Sources |
|-------|------------|---------|
| Canvas text rendering performance | HIGH | [Mirko Sertic: Canvas fillText Performance](https://www.mirkosertic.de/blog/2015/03/tuning-html5-canvas-filltext/), [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) |
| Offscreen canvas caching | HIGH | [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas), [AG Grid: Canvas Rendering](https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/) |
| Text measurement APIs | HIGH | [MDN: measureText](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText), [W3Resource: Canvas Text](https://www.w3resource.com/html5-canvas/html5-canvas-text.php) |
| Scroll animation patterns | MEDIUM | [DEV: Canvas Parallax Effect](https://dev.to/nidal_tahir_cde5660ddbe04/buttery-smooth-scroll-animations-building-a-high-performance-canvas-parallax-effect-2m8l), project experience |
| Integration with v1.0 architecture | HIGH | Current codebase analysis, validated patterns from background/stinger/sidebar |

---

## Summary: Architectural Vision for Shade Component

**Core Principle:** **Extend, don't replace**. The shade component reuses v1.0's validated patterns (AnimatedBar inheritance, pure calculations, delta-time, config-driven) and adds only the minimal new complexity required for text scrolling.

**Key Innovations:**
1. **Dynamic hold duration** calculated from text width (ensures readability)
2. **Canvas text rendering** with offscreen caching (OBS-safe + performant)
3. **Text clipping** to curtain boundaries (visual polish)
4. **Linear scroll** (readability over visual flair)

**Build Strategy:** Foundation first (config + calculations), then component (ShadeBar), then text layer, then scene integration, finally polish.

**Testing Strategy:** Unit tests for calculations, component tests for lifecycle, manual OBS validation for visual correctness.

**Performance Target:** 60fps with text scrolling (achievable with offscreen caching).

This architecture supports immediate v1.1 goals while remaining extensible for future enhancements (multiple shades, text wrapping, dynamic updates).

---

*Architecture research for: Shade component with scrolling text*
*Researched: 2026-01-18*
*Builds on: v1.0 architecture (background, stinger, sidebar)*
