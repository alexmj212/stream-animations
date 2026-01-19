# Phase 6: Curtain Integration & Synchronization - Research

**Researched:** 2026-01-19
**Domain:** Canvas-based curtain overlays with synchronized animation timing
**Confidence:** HIGH

## Summary

This research investigated canvas-based semi-transparent overlay rendering, multi-element animation synchronization, and component composition patterns for creating unified "shade" effects. Phase 6 focuses on adding semi-transparent curtains (top/bottom) with animated bars inside, synchronized with the existing Phase 5 text animation through shared timing configuration.

The standard approach uses native Canvas API with globalAlpha for semi-transparent overlays, rendering order control (draw curtains first, then text on top), and shared timing state to coordinate multiple independent components. The curtain structure follows the established stinger pattern (curtains moving in/holding/moving out), adapted for vertical movement from top/bottom edges instead of horizontal movement from sides.

The key architectural insight: Simple timing coordination through shared config and start timestamp is sufficient—no event/notification system needed. Components animate independently with same duration, ensuring they stay synchronized for the total animation lifecycle.

**Primary recommendation:** Create CurtainBar class extending AnimatedBar for top/bottom curtain rendering, embed horizontal AnimatedBars inside each curtain for continuous bar animation, coordinate via shared start timestamp and config.shade.durations, and render in correct order (curtains first, text last for proper layering).

## Standard Stack

The established libraries/tools for curtain overlay and synchronization:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| HTML5 Canvas API | Native | Semi-transparent overlays with globalAlpha | Native browser API, zero dependencies, OBS browser source compatible. Rendering order controls layering (draw curtains, then text). |
| AnimatedBar | v1.0 (existing) | Base class for animated curtains and bars | Established pattern in v1.0 (StingerBar, SidebarBar). Provides easing, delta-time integration, canvas rendering. Proven for three-phase animations (in/hold/out). |
| DeltaTimer | v1.0 (existing) | Frame-rate independent timing | Already implemented for text animation in Phase 5. Ensures curtain movement stays synchronized with text across varying frame rates. |
| config.js | v1.0 (existing) | Centralized timing and visual configuration | Existing config.shade section has durations, brightness. Extend with curtain-specific settings (opacity, bar count). |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shared/colors.js | v1.0 (existing) | HSL color utilities and URL parameter parsing | Convert baseColor to HSL for curtain gradient consistency. Already used by stinger/sidebar/background. |
| AnimationLifecycle | v1.0 (existing) | Cleanup on OBS reload | Prevents memory leaks when OBS reloads browser source. Required for all scenes (CONFIG-03). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared start timestamp | Event system for phase sync | Event system over-engineered per user decision. Shared timestamp is simpler and sufficient for "respects total duration" requirement. |
| Drawing order (curtains first, text last) | CSS z-index with DOM elements | Canvas provides unified rendering pipeline, better OBS performance. DOM layering violates v1.1 canvas-based approach. |
| Independent bar animation in curtains | Static curtain fills | Animated bars match visual style of stinger/sidebar. Static fills would look incomplete compared to other components. |
| Velocity-first animation from Phase 5 | Position interpolation with easing for curtains | Curtains don't need continuous velocity—discrete phases with easeInOutCubic work well. Text already uses velocity-first successfully. |

**Installation:**
No new dependencies required - uses native browser APIs and existing v1.0/v1.1 utilities.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── shade/                     # Shade component (Phase 5 + Phase 6)
│   ├── index.html            # Entry point, coordinates curtains + text
│   ├── ShadeBar.js           # Text rendering (Phase 5, existing)
│   ├── CurtainBar.js         # NEW: Top/bottom curtain overlay
│   └── (uses AnimatedBar)    # Horizontal bars inside curtains
├── shared/
│   ├── AnimatedBar.js        # Base class (existing)
│   ├── timing.js             # DeltaTimer (existing)
│   ├── colors.js             # HSL utilities (existing)
│   └── lifecycle.js          # AnimationLifecycle (existing)
└── config/
    └── config.js             # Extend config.shade for curtains
```

### Pattern 1: Curtain Overlay with Semi-Transparent Fill

**What:** Top and bottom curtain rectangles with semi-transparent fills that enter/hold/exit

**When to use:** When creating overlay effects that dim or frame content

**Example:**
```javascript
// Source: Existing StingerBar three-phase pattern + Canvas globalAlpha
// MDN globalAlpha: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalAlpha

export class CurtainBar extends AnimatedBar {
    constructor(ctx, canvas, position, baseHSL, totalDurationMs, options = {}) {
        super(ctx, canvas, 'curtain', options);
        this.position = position; // 'top' or 'bottom'
        this.baseHSL = baseHSL;
        this.totalDurationMs = totalDurationMs;

        // Curtain visual properties
        this.opacity = 0.5; // Medium opacity (0.4-0.6 range from context)
        this.targetHeight = canvas.height / 2; // Covers 50% of height

        // Animation state (three phases like stinger)
        this.phase = 'enter'; // 'enter' | 'hold' | 'exit'
        this.elapsedTime = 0;
        this.phaseStartTime = 0;

        // Phase durations (milliseconds to seconds)
        this.enterDuration = config.shade.durations.entryMs / 1000;
        this.exitDuration = config.shade.durations.exitMs / 1000;
        // Hold duration fills remaining time
        const enterExitMs = config.shade.durations.entryMs + config.shade.durations.exitMs;
        this.holdDuration = (totalDurationMs - enterExitMs) / 1000;

        // Initial position (offscreen)
        if (position === 'top') {
            this.y = -this.targetHeight; // Start above viewport
            this.targetY = 0; // End at top edge
        } else {
            this.y = canvas.height; // Start below viewport
            this.targetY = canvas.height / 2; // End at centerline
        }

        this.startY = this.y;
    }

    update(deltaTime) {
        if (!this.active) return;

        this.elapsedTime += deltaTime;
        const phaseTime = this.elapsedTime - this.phaseStartTime;

        if (this.phase === 'enter') {
            const progress = Math.min(phaseTime / this.enterDuration, 1);
            const easedProgress = this.easeInOutCubic(progress);
            this.y = this.startY + (this.targetY - this.startY) * easedProgress;

            if (progress >= 1) {
                this.phase = 'hold';
                this.phaseStartTime = this.elapsedTime;
            }
        } else if (this.phase === 'hold') {
            // Static position during hold phase (no breathing/motion)
            this.y = this.targetY;

            if (phaseTime >= this.holdDuration) {
                this.phase = 'exit';
                this.phaseStartTime = this.elapsedTime;
                this.exitStartY = this.y;
            }
        } else if (this.phase === 'exit') {
            const progress = Math.min(phaseTime / this.exitDuration, 1);
            const easedProgress = this.easeInOutCubic(progress);

            // Return to offscreen position
            this.y = this.exitStartY + (this.startY - this.exitStartY) * easedProgress;

            if (progress >= 1) {
                this.active = false;
            }
        }
    }

    draw() {
        if (!this.active) return;

        this.ctx.save();

        // Semi-transparent fill (CONTEXT decision: 0.4-0.6 range)
        this.ctx.globalAlpha = this.opacity;

        // Gradient fill using baseHSL (matches stinger/sidebar pattern)
        const gradient = this.ctx.createLinearGradient(0, this.y, 0, this.y + this.targetHeight);
        gradient.addColorStop(0, `hsl(${this.baseHSL.h}, ${this.baseHSL.s}%, ${this.baseHSL.l}%)`);
        gradient.addColorStop(1, `hsl(${this.baseHSL.h}, ${this.baseHSL.s}%, ${Math.max(10, this.baseHSL.l - 20)}%)`);

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, this.y, this.canvas.width, this.targetHeight);

        this.ctx.restore();
    }
}
```

### Pattern 2: Embedded Animated Bars Inside Curtains

**What:** Horizontal bars animate continuously inside curtain area throughout enter/hold/exit

**When to use:** To maintain visual consistency with stinger/sidebar animated bar aesthetic

**Example:**
```javascript
// Source: Existing StingerBar horizontal bar pattern
// Adapted for continuous animation inside curtain boundaries

class CurtainWithBars {
    constructor(ctx, canvas, position, baseHSL, totalDurationMs) {
        this.curtain = new CurtainBar(ctx, canvas, position, baseHSL, totalDurationMs);

        // Create horizontal bars (CONTEXT decision: horizontal bars only)
        this.bars = [];
        const barCount = 5; // Claude's discretion - matches stinger density

        for (let i = 0; i < barCount; i++) {
            // Use AnimatedBar with 'horizontal' type
            // Direction randomized: both left-to-right and right-to-left
            const bar = new AnimatedBar(ctx, canvas, 'horizontal', {});

            // Position within curtain area
            bar.direction = Math.random() > 0.5 ? 1 : -1;
            bar.y = (position === 'top' ? 0 : canvas.height / 2) + (i / barCount) * (canvas.height / 2);

            // Visual properties (match stinger pattern)
            bar.isWhite = Math.random() > 0.7;
            if (bar.isWhite) {
                bar.hue = 0;
                bar.saturation = 0;
                bar.lightness = 100 * config.shade.brightness;
                bar.width = Math.random() * 30 + 20;
            } else {
                const hueVariation = (Math.random() - 0.5) * 40;
                bar.hue = (baseHSL.h + hueVariation + 360) % 360;
                bar.saturation = baseHSL.s;
                bar.lightness = Math.max(10, (baseHSL.l + (Math.random() - 0.5) * 30) * config.shade.brightness);
                bar.width = Math.random() * 60 + 40;
            }

            bar.height = canvas.width + 400; // Full width as "height" for horizontal bar
            bar.skew = -15; // Matches stinger skew
            bar.opacity = Math.random() * 0.4 + 0.6;

            // Start offscreen (direction determines side)
            bar.x = bar.direction === 1 ? -200 : canvas.width + 200;

            // Speed to traverse canvas in ~2-3 seconds
            bar.speed = (canvas.width + 400) / (2 + Math.random());

            this.bars.push(bar);
        }
    }

    update(deltaTime) {
        // Update curtain position
        this.curtain.update(deltaTime);

        // Update bars continuously (animate throughout enter/hold/exit)
        this.bars.forEach(bar => {
            bar.x += bar.speed * bar.direction * deltaTime;

            // Wrap around when off screen
            if (bar.direction === 1 && bar.x > this.canvas.width + 200) {
                bar.x = -200;
            } else if (bar.direction === -1 && bar.x < -200) {
                bar.x = this.canvas.width + 200;
            }
        });
    }

    draw() {
        // Draw curtain first (background layer)
        this.curtain.draw();

        // Draw bars on top of curtain
        // Clip bars to curtain boundaries during enter/exit
        if (this.curtain.position === 'top') {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(0, 0, this.canvas.width, this.curtain.y + this.curtain.targetHeight);
            this.ctx.clip();
            this.bars.forEach(bar => bar.draw());
            this.ctx.restore();
        } else {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(0, this.curtain.y, this.canvas.width, this.curtain.targetHeight);
            this.ctx.clip();
            this.bars.forEach(bar => bar.draw());
            this.ctx.restore();
        }
    }
}
```

### Pattern 3: Simple Timing Coordination via Shared Start Timestamp

**What:** Synchronize multiple independent components by starting them with same timestamp

**When to use:** When components have same total duration but don't need frame-perfect synchronization

**Example:**
```javascript
// Source: User decision - "keep architecture simple, no event system"
// Shared timestamp approach from requestAnimationFrame pattern

class ShadeScene {
    constructor(ctx, canvas, text, baseColor) {
        this.ctx = ctx;
        this.canvas = canvas;

        // Calculate timing (shared across all components)
        const holdDurationMs = ShadeBar.calculateHoldDuration(text);
        const totalDurationMs = config.shade.durations.entryMs + holdDurationMs + config.shade.durations.exitMs;

        // Create components with same duration
        const baseHSL = hexToHSL(baseColor);
        this.topCurtain = new CurtainWithBars(ctx, canvas, 'top', baseHSL, totalDurationMs);
        this.bottomCurtain = new CurtainWithBars(ctx, canvas, 'bottom', baseHSL, totalDurationMs);
        this.textBar = new ShadeBar(ctx, canvas, text, holdDurationMs);

        // Shared animation state
        this.startTime = null;
        this.active = true;
    }

    init() {
        // Initialize text measurement (Phase 5 pattern - wait for fonts)
        return this.textBar.init();
    }

    update(deltaTime, timestamp) {
        // Set start timestamp on first frame
        if (this.startTime === null) {
            this.startTime = timestamp;
        }

        // All components update independently with same deltaTime
        // They stay synchronized because they have same total duration
        this.topCurtain.update(deltaTime);
        this.bottomCurtain.update(deltaTime);
        this.textBar.update(deltaTime);

        // Deactivate when all components done
        if (!this.topCurtain.curtain.active && !this.bottomCurtain.curtain.active && !this.textBar.active) {
            this.active = false;
        }
    }

    draw() {
        // Drawing order critical for layering (CONTEXT: text renders ABOVE curtains)
        // 1. Draw curtains first (background)
        this.topCurtain.draw();
        this.bottomCurtain.draw();

        // 2. Draw text last (foreground) - no clipping
        this.textBar.draw();
    }
}

// Animation loop
const deltaTimer = new DeltaTimer();

function animate(timestamp) {
    const deltaTime = deltaTimer.update(timestamp);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    scene.update(deltaTime, timestamp);
    scene.draw();

    if (scene.active) {
        requestAnimationFrame(animate);
    }
}

// Start after font loading (Phase 5 pattern)
document.fonts.ready.then(() => {
    scene.init();
    requestAnimationFrame(animate);
});
```

### Pattern 4: Canvas Layer Rendering Order

**What:** Control visual layering through drawing order (last drawn appears on top)

**When to use:** When creating overlapping canvas elements with specific z-order

**Example:**
```javascript
// Source: Canvas API rendering fundamentals
// MDN Canvas Tutorial: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Drawing order determines layering (no CSS z-index on canvas)
    // Each draw operation renders on top of previous

    // Layer 1: Background (optional - could be transparent)
    // (none in shade component - transparent background)

    // Layer 2: Bottom curtain (semi-transparent overlay)
    bottomCurtain.draw(); // Drawn first = behind everything

    // Layer 3: Top curtain (semi-transparent overlay)
    topCurtain.draw(); // Overlaps bottom curtain at centerline

    // Layer 4: Text (fully opaque, white)
    textBar.draw(); // Drawn last = on top of curtains

    // Text is ALWAYS visible above curtains (CONTEXT decision)
    // No clipping needed - text flies across full canvas
}
```

### Anti-Patterns to Avoid

- **Event-based phase synchronization:** Over-engineered per user decision. Components with same duration don't need notifications—they naturally stay synchronized.
- **Clipping text to curtain boundaries:** Context specifies text renders ABOVE curtains everywhere. Clipping would create incorrect visual where text disappears under curtains.
- **Independent timing for curtains and text:** Would cause desynchronization. Use shared totalDurationMs calculated from text length to ensure components start/end together.
- **Static curtains during enter/exit:** Would look disconnected from animation flow. Curtains should animate in smoothly with easing, not snap into position.
- **Frame-based animation:** Would break synchronization on variable frame rates. Use delta-time with DeltaTimer for consistent timing.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Three-phase curtain animation (enter/hold/exit) | Custom position tracking | AnimatedBar pattern from StingerBar | StingerBar already implements three phases with easeInOutCubic. Same pattern works for vertical movement (top/bottom instead of left/right). Proven in production. |
| Semi-transparent overlay rendering | Multiple draw calls with opacity math | Canvas globalAlpha property | Native API handles opacity uniformly. Set once, applies to all subsequent draws. More efficient than manual alpha blending. |
| Gradient fills for curtains | Manual color interpolation | ctx.createLinearGradient() | Native canvas API handles color stops and smooth gradients. GPU-accelerated. Manual interpolation is slower and pixelated. |
| Animation timing coordination | Event system, callbacks, promises | Shared duration + DeltaTimer | Components with same total duration stay synchronized naturally when using delta-time. No communication needed. Simpler architecture per user decision. |
| Horizontal bar animation | Custom bar rendering | AnimatedBar with type='horizontal' | Already implemented in v1.0 for stinger/sidebar. Handles skew, shadow, color variations, viewport culling. Don't reimplement. |
| Canvas layer ordering | CSS z-index on multiple canvases | Drawing order on single canvas | Single canvas with drawing order is simpler and more performant. Multiple canvases add DOM overhead. OBS prefers single canvas sources. |

**Key insight:** Phase 6 is mostly composition of existing patterns (AnimatedBar three-phase animation, horizontal bars, HSL colors, delta-time coordination). The only new component is CurtainBar, which adapts StingerBar pattern for vertical movement. Keep it simple—reuse v1.0 patterns instead of creating new synchronization mechanisms.

## Common Pitfalls

### Pitfall 1: Drawing Text Before Curtains (Wrong Layer Order)

**What goes wrong:** Text appears behind semi-transparent curtains instead of on top, making it hard to read or completely hidden.

**Why it happens:** Canvas rendering order determines layering. First drawn = bottom layer, last drawn = top layer. Drawing text before curtains places text in background.

**How to avoid:**
```javascript
// WRONG: Text drawn first (background layer)
textBar.draw();       // Text on bottom
topCurtain.draw();    // Curtain on top of text (hides text)
bottomCurtain.draw(); // Curtain on top of text (hides text)

// RIGHT: Text drawn last (foreground layer)
topCurtain.draw();    // Curtain on bottom
bottomCurtain.draw(); // Curtain on bottom
textBar.draw();       // Text on top (always visible)
```

**Warning signs:**
- Text appears dim or transparent even though fillStyle is opaque white
- Text partially hidden or completely invisible during curtain hold phase
- Text looks like it's "behind" the curtain overlay
- Text shadow appears but text itself is dimmed

**Additional prevention:**
- Mentally model canvas as layers stacking from first draw (bottom) to last draw (top)
- Test with exaggerated curtain opacity (0.9) to verify text is always fully visible
- Check rendering order in code review - text.draw() should be last call
- Context decision explicitly states: "Text always renders ABOVE curtains"

**Source:** [MDN Canvas Tutorial - Compositing](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Compositing)

### Pitfall 2: Curtains Don't Meet Exactly at Centerline

**What goes wrong:** Gap or overlap between top and bottom curtains at canvas center, creating visual discontinuity.

**Why it happens:** Floating point math errors, off-by-one pixel calculations, or wrong target positions cause curtains to not perfectly align.

**How to avoid:**
```javascript
// WRONG: Overlapping curtains
topCurtain.height = canvas.height / 2 + 1;    // 51% coverage
bottomCurtain.y = canvas.height / 2 - 1;       // Starts at 49%
// Result: Overlap at center creates darker band

// WRONG: Gap between curtains
topCurtain.height = canvas.height / 2 - 1;    // 49% coverage
bottomCurtain.y = canvas.height / 2 + 1;       // Starts at 51%
// Result: Gap at center shows background

// RIGHT: Exact meeting at centerline
topCurtain.y = 0;
topCurtain.height = canvas.height / 2;         // 0 to 50%
bottomCurtain.y = canvas.height / 2;           // 50% to 100%
bottomCurtain.height = canvas.height / 2;

// Use integer division carefully
const halfHeight = Math.floor(canvas.height / 2);
topCurtain.height = halfHeight;
bottomCurtain.y = halfHeight;
bottomCurtain.height = canvas.height - halfHeight; // Handle odd heights
```

**Warning signs:**
- Thin visible line at canvas center during hold phase
- Darker band at center (overlap)
- Background shows through at center (gap)
- Visual discontinuity in gradient or bar animation at centerline

**Additional prevention:**
- Test with odd canvas heights (1919, 1079) to catch rounding errors
- Log curtain positions: `console.log('Top:', topY, topY + height, 'Bottom:', bottomY, bottomY + height)`
- Use browser inspector to verify fillRect coordinates during hold phase
- Context decision: "Curtains meet exactly at centerline (each covers 50% of height)"

### Pitfall 3: Different Duration Calculations Cause Desynchronization

**What goes wrong:** Curtains finish animating before/after text, breaking the unified "shade" effect.

**Why it happens:** Curtains and text calculate totalDuration independently using different logic, leading to timing mismatches.

**How to avoid:**
```javascript
// WRONG: Independent duration calculations
// In text component:
const textDuration = calculateHoldDuration(text); // 5000ms

// In curtain component:
const curtainDuration = 6000; // Hardcoded! Doesn't match text

// Result: Curtains exit while text still scrolling, or vice versa

// RIGHT: Single source of truth for duration
// Calculate once, pass to all components
const holdDurationMs = ShadeBar.calculateHoldDuration(text);
const totalDurationMs = config.shade.durations.entryMs + holdDurationMs + config.shade.durations.exitMs;

// All components use same duration
const topCurtain = new CurtainBar(ctx, canvas, 'top', baseHSL, totalDurationMs);
const bottomCurtain = new CurtainBar(ctx, canvas, 'bottom', baseHSL, totalDurationMs);
const textBar = new ShadeBar(ctx, canvas, text, holdDurationMs); // Uses holdDuration internally

// All components naturally end at same time
```

**Warning signs:**
- Curtains exit before text finishes scrolling off screen
- Text disappears while curtains still visible
- Components animate at different speeds (look "out of sync")
- Animation feels jerky or disconnected between elements

**Additional prevention:**
- Calculate totalDurationMs in one place (scene constructor or main file)
- Pass duration as constructor parameter to all components
- Log component lifetimes: `console.log('Curtain active:', c.active, 'Text active:', t.active)`
- Unit test: verify all components transition to inactive on same frame
- Context requirement: "Text and curtains synchronized via single phase controller"

### Pitfall 4: Bars Render Outside Curtain Boundaries During Enter/Exit

**What goes wrong:** Horizontal bars visible above/below curtain area during enter/exit phases, breaking the contained effect.

**Why it happens:** Bars animate continuously but aren't clipped to curtain's current position, so they render in full canvas even when curtain is partially offscreen.

**How to avoid:**
```javascript
// WRONG: Draw bars without clipping
curtain.draw();      // Curtain at y=50 during enter (moving down)
bars.forEach(b => b.draw()); // Bars draw at y=0-100 (full curtain height)
// Result: Bars visible above curtain during enter phase

// RIGHT: Clip bars to curtain's current visible area
curtain.draw();

ctx.save();
ctx.beginPath();
// Clip region matches curtain's current position and height
if (position === 'top') {
    const visibleHeight = curtain.y + curtain.targetHeight;
    ctx.rect(0, 0, canvas.width, Math.max(0, visibleHeight));
} else {
    const visibleHeight = curtain.targetHeight - (canvas.height / 2 - curtain.y);
    ctx.rect(0, Math.max(curtain.y, canvas.height / 2), canvas.width, visibleHeight);
}
ctx.clip();

bars.forEach(b => b.draw()); // Only draws within clip region
ctx.restore();
```

**Warning signs:**
- Bars "leak" outside curtain area during animation
- Bars visible in upper/lower canvas area before curtain fully enters
- Bars disappear abruptly instead of smoothly exiting with curtain
- Visual disconnect between curtain edge and bar visibility

**Additional prevention:**
- Test enter/exit phases specifically with bars enabled
- Visually verify bars only appear within curtain boundaries during transitions
- Use ctx.save()/restore() pairs to isolate clipping regions
- Consider rendering bars directly on offscreen canvas sized to curtain height (advanced)
- Context decision: "Bars visible and moving from moment curtains start entering until they finish exiting"

### Pitfall 5: globalAlpha Persists Across Draw Calls

**What goes wrong:** Setting globalAlpha for curtain opacity affects subsequent text/bar rendering, making them unexpectedly transparent.

**Why it happens:** globalAlpha is context state that persists until changed. Unlike fillStyle which is typically set per draw, globalAlpha affects everything until explicitly reset.

**How to avoid:**
```javascript
// WRONG: globalAlpha not restored
ctx.globalAlpha = 0.5; // Set for curtain
ctx.fillRect(0, 0, 100, 100); // Curtain drawn at 50% opacity
ctx.fillStyle = '#ffffff';
ctx.fillText('Hello', 50, 50); // Text also 50% opacity! (unintended)

// RIGHT: Save/restore context state
ctx.save();
ctx.globalAlpha = 0.5;
ctx.fillRect(0, 0, 100, 100); // Curtain at 50% opacity
ctx.restore(); // Restores globalAlpha to previous value (1.0)

ctx.fillStyle = '#ffffff';
ctx.fillText('Hello', 50, 50); // Text at 100% opacity (correct)

// BEST: Encapsulate in methods
draw() {
    this.ctx.save(); // Always save at method start
    this.ctx.globalAlpha = this.opacity;
    // ... drawing code ...
    this.ctx.restore(); // Always restore at method end
}
```

**Warning signs:**
- Text appears semi-transparent even though context specifies opaque white
- Bars have unexpected opacity variations
- Opacity seems to "accumulate" across frames
- Different rendering results between isolated tests and full scene

**Additional prevention:**
- Always use ctx.save()/restore() pairs in draw() methods
- Never rely on "default" globalAlpha—assume it's been modified
- Test each component in isolation to verify opacity is correct
- Use eslint rule or code review to enforce save/restore patterns
- MDN documentation warns: "Affects all subsequent drawing operations"

**Source:** [MDN Canvas globalAlpha Property](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalAlpha)

## Code Examples

Verified patterns from official sources:

### Semi-Transparent Rectangle Overlay
```javascript
// Source: MDN Canvas API Tutorial - Transparency
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Applying_styles_and_colors

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Draw semi-transparent overlay using globalAlpha
ctx.save();
ctx.globalAlpha = 0.5; // 50% opacity (range: 0.0-1.0)
ctx.fillStyle = '#000000'; // Color for curtain
ctx.fillRect(0, 0, canvas.width, canvas.height / 2); // Top half
ctx.restore();

// Alternative: Use rgba() for per-element opacity
ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // 50% opacity black
ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2); // Bottom half
```

### Linear Gradient for Curtain Fill
```javascript
// Source: MDN Canvas API Tutorial - Gradients
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Applying_styles_and_colors

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Create vertical gradient (top to bottom)
const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height / 2);

// Add color stops (HSL format matches existing codebase pattern)
gradient.addColorStop(0, 'hsl(200, 100%, 50%)');    // Lighter at top
gradient.addColorStop(1, 'hsl(200, 100%, 30%)');    // Darker at bottom

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
```

### Three-Phase Animation with easeInOutCubic
```javascript
// Source: Existing v1.0 StingerBar.js pattern
// Adapted for vertical curtain movement

update(deltaTime) {
    this.elapsedTime += deltaTime;
    const phaseTime = this.elapsedTime - this.phaseStartTime;

    if (this.phase === 'enter') {
        // Ease from startY to targetY
        const progress = Math.min(phaseTime / this.enterDuration, 1);
        const easedProgress = this.easeInOutCubic(progress);
        this.y = this.startY + (this.targetY - this.startY) * easedProgress;

        if (progress >= 1) {
            this.phase = 'hold';
            this.phaseStartTime = this.elapsedTime;
        }
    } else if (this.phase === 'hold') {
        // Static position (no movement during hold)
        this.y = this.targetY;

        if (phaseTime >= this.holdDuration) {
            this.phase = 'exit';
            this.phaseStartTime = this.elapsedTime;
        }
    } else if (this.phase === 'exit') {
        // Ease from targetY back to startY
        const progress = Math.min(phaseTime / this.exitDuration, 1);
        const easedProgress = this.easeInOutCubic(progress);
        this.y = this.targetY + (this.startY - this.targetY) * easedProgress;

        if (progress >= 1) {
            this.active = false;
        }
    }
}

// easeInOutCubic already implemented in AnimatedBar base class
easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

### Canvas Clipping Region for Bar Containment
```javascript
// Source: MDN Canvas API Tutorial - Clipping paths
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Compositing

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Save context state before clipping
ctx.save();

// Define clipping region (rectangular clip)
ctx.beginPath();
ctx.rect(0, curtain.y, canvas.width, curtain.height);
ctx.clip(); // All subsequent draws confined to this region

// Draw bars - only visible within clip region
bars.forEach(bar => {
    bar.draw(); // Portions outside clip region won't render
});

// Restore context to remove clipping
ctx.restore(); // Subsequent draws not clipped
```

### Coordinated Animation Initialization
```javascript
// Source: Phase 5 ShadeBar pattern + v1.0 AnimationLifecycle
// Simple coordination via shared timing configuration

// Main scene setup
const urlParams = new URLSearchParams(window.location.search);
const text = urlParams.get('text') || 'Default Text';
const baseColor = getColorFromURL();

// Calculate timing (single source of truth)
const holdDurationMs = ShadeBar.calculateHoldDuration(text);
const totalDurationMs = config.shade.durations.entryMs + holdDurationMs + config.shade.durations.exitMs;

// Create all components with shared duration
const baseHSL = hexToHSL(baseColor);
const topCurtain = new CurtainBar(ctx, canvas, 'top', baseHSL, totalDurationMs);
const bottomCurtain = new CurtainBar(ctx, canvas, 'bottom', baseHSL, totalDurationMs);
const textBar = new ShadeBar(ctx, canvas, text, holdDurationMs);

// Initialize with font loading
document.fonts.ready.then(() => {
    textBar.init(); // Measure text after fonts load

    // Start animation loop
    requestAnimationFrame(animate);
});

// Animation loop with lifecycle cleanup (CONFIG-03 requirement)
const lifecycle = new AnimationLifecycle(() => {
    deltaTimer.reset();
});

function animate(timestamp) {
    const deltaTime = deltaTimer.update(timestamp);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // All components update with same deltaTime
    topCurtain.update(deltaTime);
    bottomCurtain.update(deltaTime);
    textBar.update(deltaTime);

    // Drawing order: curtains first, text last
    topCurtain.draw();
    bottomCurtain.draw();
    textBar.draw();

    // Continue until all components inactive
    const anyActive = topCurtain.active || bottomCurtain.active || textBar.active;
    if (anyActive) {
        requestAnimationFrame(animate);
    } else {
        lifecycle.cleanup(); // Cleanup on completion
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple canvases for layering | Single canvas with draw order | Native canvas pattern | Simpler architecture, better performance. OBS browser sources prefer single canvas. Drawing order naturally handles z-index. |
| Event-based synchronization | Shared duration + delta-time | User decision (Phase 6) | Components stay synchronized through independent updates with same total duration. No communication overhead. Simpler to reason about. |
| CSS animations for overlays | Canvas globalAlpha for transparency | v1.1 canvas-based requirement | Unified rendering pipeline. Canvas provides explicit control over compositing. Better OBS compatibility. |
| Fixed curtain timing | Dynamic timing from text length | v1.1 requirement | Curtains match text animation duration (enter 1s + dynamic hold + exit 1s). Total animation adapts to text length for complete readability. |
| Position interpolation for curtains | easeInOutCubic from AnimatedBar | v1.0 established | Smooth acceleration/deceleration proven in stinger/sidebar. Reusing existing easing function ensures visual consistency. |

**Deprecated/outdated:**
- **CSS transform animations for overlays:** Violates v1.1 canvas-based approach. Mixing DOM and canvas creates complexity. Canvas-only is simpler and more consistent.
- **requestAnimationFrame without delta-time:** Breaks on variable frame rates. DeltaTimer (v1.0) provides frame-rate independence essential for synchronized multi-element animation.
- **Hardcoded opacity values:** Context decision specifies 0.4-0.6 range. Should be configurable in config.shade.curtains.opacity for maintainability.

## Open Questions

Things that couldn't be fully resolved:

1. **Exact curtain opacity value within 0.4-0.6 range**
   - What we know: Context specifies "medium opacity (0.4-0.6 range)" for semi-transparent curtains
   - What's unclear: Optimal value for readability vs. dramatic effect
   - Recommendation: Start with 0.5 (middle of range). Test in OBS with background animation running. Adjust based on visual testing. May need different values for light vs. dark base colors. Add to config.shade.curtains.opacity for easy tuning.

2. **Bar configuration for curtains (speed, count, exact colors)**
   - What we know: Horizontal bars only, both directions, independent patterns per curtain, using existing AnimatedBar pattern
   - What's unclear: Optimal bar count, speed, and color distribution for curtain aesthetic
   - Recommendation: Start with 5-8 bars per curtain (matches stinger density). Speed: traverse canvas in 2-3 seconds (matches stinger timing). 70% white / 30% colored (matches existing config.stinger.color.whiteBarProbability). Tune during implementation based on visual density.

3. **Start timestamp synchronization approach**
   - What we know: Components need to start animation simultaneously, respects total duration
   - What's unclear: Store startTime on scene object, or pass relative time to components?
   - Recommendation: Store startTime in scene/index.html, components use elapsed time (timestamp - startTime) if needed for absolute timing. However, components using delta-time don't need startTime—they naturally synchronize through update(deltaTime) calls. Keep simplest approach: just call update(deltaTime) on all components each frame.

4. **Shadow rendering for curtains**
   - What we know: Context mentions "Apply same shadow technique used in other components"
   - What's unclear: Should curtains have drop shadow like bars, or is gradient sufficient for depth?
   - Recommendation: No shadow on curtain fills—gradient provides depth. Shadow would make curtains look "floaty" instead of overlay-like. Bars inside curtains use existing AnimatedBar shadow rendering (withShadow parameter). Test both approaches during implementation.

5. **Error handling strategy (fail together vs independent)**
   - What we know: User decision: "fail together vs independent" under Claude's discretion
   - What's unclear: If curtain init fails but text succeeds, show text-only or abort entire animation?
   - Recommendation: Fail together (abort entire scene). Shade is unified effect—showing only text or only curtains breaks the design. Log error, set scene.active = false, cleanup. Prevents partially-rendered state from appearing on stream.

## Sources

### Primary (HIGH confidence)
- [MDN Canvas API: globalAlpha](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalAlpha) - Transparency property for overlays
- [MDN Canvas API: fillRect](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillRect) - Rectangle rendering syntax
- [MDN Canvas API: createLinearGradient](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient) - Gradient fills for curtains
- [MDN Canvas API: Clipping Paths](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Compositing) - Clip bars to curtain boundaries
- [MDN Canvas API: Basic Animations](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_animations) - requestAnimationFrame and animation loop patterns
- Existing v1.0 codebase (StingerBar.js, SidebarBar.js, AnimatedBar.js) - Three-phase animation pattern, easeInOutCubic implementation
- Existing v1.1 codebase (ShadeBar.js) - Text animation and Font Loading API integration

### Secondary (MEDIUM confidence)
- [W3Schools Canvas fillRect](https://www.w3schools.com/jsref/canvas_fillrect.asp) - fillRect coordinate system examples
- [Viget: Time-based Animation](https://www.viget.com/articles/time-based-animation) - Delta-time animation patterns for synchronization
- [Easings.net](https://easings.net/) - Easing function reference (easeInOutCubic visualization)
- [ZetCode Canvas Transparency](https://zetcode.com/gfx/html5canvas/transparency/) - globalAlpha examples

### Tertiary (LOW confidence)
- WebSearch results for "canvas animation synchronization" - General patterns, not authoritative
- WebSearch results for "HTML5 curtain overlay animation" - Limited specific examples for this use case

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Canvas API verified with MDN official docs, existing v1.0 patterns proven in codebase (StingerBar three-phase, AnimatedBar inheritance)
- Architecture: HIGH - Composition of proven patterns (AnimatedBar extension, simple timing coordination, drawing order for layering)
- Don't hand-roll: HIGH - All recommended solutions exist in v1.0 (AnimatedBar, easeInOutCubic, delta-time) or native APIs (globalAlpha, gradient, clipping)
- Pitfalls: HIGH - Drawing order and globalAlpha persistence documented in MDN. Desynchronization pattern common in multi-element animations. Clipping requirement clear from context decision.
- Code examples: HIGH - Examples from MDN official docs, existing v1.0 codebase patterns, verified canvas API usage

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (30 days - stable native APIs and established v1.0 patterns unlikely to change)
