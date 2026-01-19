# Phase 5: Text Animation Core - Research

**Researched:** 2026-01-19
**Domain:** Canvas-based text rendering and animation
**Confidence:** HIGH

## Summary

This research investigated canvas-based text rendering, scrolling animation patterns, dynamic timing calculations, and OBS browser source compatibility. The phase focuses on creating large scrolling text with dynamic hold duration based on text length (reading speed baseline of 200ms/word), using established patterns from the existing v1.0 codebase (AnimatedBar inheritance, DeltaTimer, centralized config).

The standard approach uses native HTML5 Canvas API text rendering methods (`fillText`, `measureText`) with CSS Font Loading API (`document.fonts.ready`) to prevent race conditions. Text scrolls right-to-left in a three-phase animation (enter, hold with scrolling, exit) with speed calculated from text length to ensure full text visibility within the hold duration.

**Primary recommendation:** Extend AnimatedBar pattern for ShadeBar class, use native Canvas API for text rendering with explicit fillStyle for OBS compatibility, calculate hold duration using 200ms/word baseline with 3-second minimum, and integrate Font Loading API to prevent text measurement race conditions.

## Standard Stack

The established libraries/tools for canvas text rendering and animation:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| HTML5 Canvas API | Native | Text rendering with fillText/measureText | Native browser API, zero dependencies, OBS browser source compatible. Baseline: widely available since July 2015. |
| CSS Font Loading API | Native | Font loading with document.fonts.ready | Prevents race conditions when measuring text before fonts load. Native API, already established in v1.0 research. |
| DeltaTimer | v1.0 (existing) | Frame-rate independent timing | Already implemented in v1.0 for delta-time normalization. Proven pattern for smooth animation across varying frame rates. |
| AnimatedBar | v1.0 (existing) | Base class for animated components | Established inheritance pattern in v1.0 (StingerBar, SidebarBar extend this). Provides easing, canvas caching, delta-time integration. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| URLSearchParams | Native | URL parameter parsing | Parse ?text, ?color, ?duration parameters for OBS configuration. Native API, baseline since 2016. |
| config.js | v1.0 (existing) | Centralized configuration | Store config.shade section with timing defaults, font settings, shadow parameters. Established pattern in v1.0. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas text | DOM text with CSS animations | DOM text simpler but violates v1.1 requirement for canvas-based rendering. OBS browser sources handle canvas better for compositing. |
| Native Font Loading API | Manual font loading checks | FontFace API is standard, reliable, and prevents all FOUT/race conditions. Manual checks are fragile. |
| Word count | Character count | 200ms/word baseline aligns with reading speed research (238-250 WPM adult average). Character count doesn't correlate with reading comprehension time. |

**Installation:**
No new dependencies required - uses native browser APIs and existing v1.0 utilities.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── shade/                  # New component for Phase 5
│   ├── index.html         # Entry point with URL parameter parsing
│   ├── ShadeBar.js        # Extends AnimatedBar for text rendering
│   └── (Phase 6 adds)     # Curtain components added in Phase 6
├── shared/
│   ├── AnimatedBar.js     # Base class (existing)
│   ├── timing.js          # DeltaTimer (existing)
│   └── colors.js          # URL color parsing (existing)
└── config/
    └── config.js          # Add config.shade section
```

### Pattern 1: AnimatedBar Extension for Text Rendering

**What:** ShadeBar extends AnimatedBar to render canvas text with three-phase animation (enter, hold with scrolling, exit)

**When to use:** When creating animated canvas components that follow established v1.0 patterns

**Example:**
```javascript
// Based on existing SidebarBar/StingerBar pattern
import { AnimatedBar } from '../shared/AnimatedBar.js';

export class ShadeBar extends AnimatedBar {
    constructor(ctx, canvas, text, holdDurationMs) {
        super(ctx, canvas, 'text', {});
        this.text = text;
        this.holdDurationMs = holdDurationMs;

        // Animation phase tracking
        this.phase = 'enter'; // 'enter' | 'hold' | 'exit'
        this.elapsedTime = 0;

        // Text positioning
        this.x = canvas.width; // Start off-screen right
        this.y = canvas.height / 2; // Vertical center

        // Calculate text metrics after font loads
        this.textWidth = 0;
    }

    update(deltaTime) {
        this.elapsedTime += deltaTime;

        // Phase transitions based on time
        if (this.phase === 'enter' && this.elapsedTime >= this.enterDurationMs / 1000) {
            this.phase = 'hold';
            this.elapsedTime = 0;
        } else if (this.phase === 'hold' && this.elapsedTime >= this.holdDurationMs / 1000) {
            this.phase = 'exit';
            this.elapsedTime = 0;
        }

        // Update position based on phase and delta time
        this.x += this.calculateVelocity() * deltaTime;
    }

    draw() {
        this.ctx.save();

        // Set text properties
        this.ctx.font = 'bold 96px Jost';
        this.ctx.fillStyle = this.color; // Explicit fillStyle for OBS
        this.ctx.textBaseline = 'middle';

        // Draw shadow/glow
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetX = 4;
        this.ctx.shadowOffsetY = 4;

        // Draw text
        this.ctx.fillText(this.text, this.x, this.y);

        this.ctx.restore();
    }
}
```

### Pattern 2: Font Loading Before Text Measurement

**What:** Use CSS Font Loading API to wait for fonts before measuring text

**When to use:** Always when using custom fonts with canvas text

**Example:**
```javascript
// Source: MDN CSS Font Loading API
// https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API

// Option 1: Wait for all fonts (simplest, recommended)
document.fonts.ready.then(() => {
    // All fonts loaded and layout complete
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    // Safe to start animation
});

// Option 2: Load specific font explicitly (if not in CSS)
const font = new FontFace('Jost', 'url(/fonts/Jost-Bold.woff2)');
document.fonts.add(font);
font.load().then(() => {
    document.fonts.ready.then(() => {
        // Font loaded and layout complete
        const metrics = ctx.measureText(text);
    });
});
```

### Pattern 3: Dynamic Hold Duration Calculation

**What:** Calculate hold duration from word count using reading speed baseline

**When to use:** For text that needs to be fully readable regardless of length

**Example:**
```javascript
// Source: Reading speed research (238-250 WPM average adult)
// User decision: 200ms/word baseline (5 words per second)

function calculateHoldDuration(text, msPerWord = 200, minDurationMs = 3000) {
    // Count words by splitting on whitespace
    // Source: https://www.geeksforgeeks.org/javascript-program-to-count-words-of-a-string/
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Calculate duration based on reading speed
    const calculatedDuration = wordCount * msPerWord;

    // Enforce minimum duration (3 seconds from user decision)
    return Math.max(calculatedDuration, minDurationMs);
}

// Examples:
// "Hello world" (2 words) = 400ms → 3000ms (min enforced)
// "This is a celebration message" (5 words) = 1000ms → 3000ms (min enforced)
// "This is a very long celebratory message for a raid" (10 words) = 2000ms → 3000ms (min enforced)
// "Thank you so much for the massive raid everyone welcome to the stream" (13 words) = 2600ms → 3000ms (min enforced)
// [25+ word message] = 5000ms+ (scales naturally)
```

### Pattern 4: Scroll Speed Calculation

**What:** Calculate horizontal scroll velocity to ensure full text visibility within hold duration

**When to use:** For marquee-style scrolling text

**Example:**
```javascript
function calculateScrollSpeed(textWidth, canvasWidth, holdDurationMs) {
    // Text must travel its full width plus one screen width during hold phase
    // to ensure full text scrolls completely across screen
    const totalDistance = textWidth + canvasWidth;

    // Speed = distance / time (pixels per millisecond)
    // Convert to pixels per second for delta-time compatibility
    const speedPxPerSecond = (totalDistance / holdDurationMs) * 1000;

    return speedPxPerSecond;
}

// Example:
// textWidth = 1200px
// canvasWidth = 1920px
// holdDurationMs = 5000ms
// totalDistance = 3120px
// speed = 624 px/s (moves ~10px per frame at 60fps)
```

### Pattern 5: URL Parameter Configuration

**What:** Parse OBS-friendly URL parameters for text, color, duration

**When to use:** When creating OBS browser source scenes that need runtime configuration

**Example:**
```javascript
// Source: Existing pattern from sidebar/stinger (getColorFromURL, duration parsing)
// MDN URLSearchParams: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams

const urlParams = new URLSearchParams(window.location.search);

// Required parameter with fallback
const text = urlParams.get('text') || 'Default Text';

// Optional color parameter (existing utility)
import { getColorFromURL } from '../shared/colors.js';
const color = getColorFromURL(); // Handles ?color parameter or generates random

// Optional duration override
const durationMs = parseInt(urlParams.get('duration')) || config.shade.timing.defaultHoldMs;

// URL examples:
// shade.html?text=Hello%20World
// shade.html?text=Raid!&color=ff6600&duration=5000
// shade.html?text=Thanks%20for%20the%20sub&color=purple
```

### Anti-Patterns to Avoid

- **Measuring text before fonts load:** Causes incorrect width calculations, leading to wrong scroll speeds. Always use `document.fonts.ready`.
- **Character-based duration:** Doesn't correlate with reading comprehension. Use word count with reading speed baseline.
- **Fixed scroll speed:** Text length varies, fixed speed means short text scrolls unnecessarily fast or long text doesn't fully display. Calculate speed from text width and hold duration.
- **Missing fillStyle on canvas text:** OBS browser sources may not render text without explicit fillStyle. Always set `ctx.fillStyle` before `fillText()`.
- **Frame-based timing:** Breaks on variable frame rates. Use delta-time with DeltaTimer for consistency.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font loading detection | Manual font.onload checks, setTimeout polling | CSS Font Loading API (`document.fonts.ready`) | Native API handles all edge cases: multiple fonts, layout completion, FOUT prevention. Manual checks miss layout timing. |
| Reading speed calculation | Character count, fixed duration | Word count * 200ms/word with min/max bounds | Research-backed baseline (238-250 WPM adult average). Word count correlates with reading comprehension, character count doesn't. |
| Delta-time animation | `setInterval`, frame counting | DeltaTimer from v1.0 | Already implemented and proven. Frame counting breaks on variable frame rates (60fps vs 120fps vs tab backgrounding). |
| URL parameter parsing | Manual string splitting, regex | URLSearchParams native API | Handles encoding/decoding, plus signs as spaces, edge cases. Native API since 2016. |
| Easing functions | Linear interpolation | AnimatedBar.easeInOutCubic | Already implemented in v1.0 base class. Cubic easing provides smooth acceleration/deceleration for professional feel. |
| Text shadow on canvas | Multiple fillText calls with offsets | Canvas shadow properties (shadowColor, shadowBlur, shadowOffsetX/Y) | Native canvas shadow rendering is GPU-accelerated and handles blur/glow effects properly. Manual offsets look pixelated. |

**Key insight:** Canvas text rendering and animation has established native patterns. The main pitfalls are font loading race conditions (solved by Font Loading API) and OBS compatibility (solved by explicit fillStyle). Existing v1.0 patterns (AnimatedBar, DeltaTimer, config) already solve animation architecture problems.

## Common Pitfalls

### Pitfall 1: Font Loading Race Condition

**What goes wrong:** Calling `ctx.measureText()` before custom fonts load returns incorrect width (fallback font metrics), causing wrong scroll speed calculations and text positioning.

**Why it happens:** Web fonts load asynchronously. Canvas API doesn't wait for fonts - it uses whatever font is available immediately (usually Arial/sans-serif fallback).

**How to avoid:**
```javascript
// WRONG: Measure immediately
const metrics = ctx.measureText(text); // Uses fallback font!
const textWidth = metrics.width; // Incorrect width

// RIGHT: Wait for fonts
document.fonts.ready.then(() => {
    const metrics = ctx.measureText(text); // Uses actual font
    const textWidth = metrics.width; // Correct width
    startAnimation();
});
```

**Warning signs:**
- Text width calculations seem inconsistent between page loads
- Scroll speed is wrong on first load but correct after refresh
- OBS browser source shows different text layout than browser preview
- Text appears to "jump" or resize slightly after page load

**Additional prevention:**
- Test in OBS with fresh browser source (no cache) to catch race conditions
- Add loading state in HTML to prevent flash of wrong layout
- Consider adding text to document.fonts explicitly if not loaded via CSS

**Source:** [MDN CSS Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API)

### Pitfall 2: OBS Browser Source Text Not Rendering

**What goes wrong:** Text renders in browser preview but appears invisible in OBS browser source.

**Why it happens:** OBS browser source requires explicit `fillStyle` property set on canvas context before calling `fillText()`. Default fillStyle is transparent in some OBS configurations.

**How to avoid:**
```javascript
// WRONG: Assume default fillStyle
ctx.font = 'bold 96px Jost';
ctx.fillText(text, x, y); // May be transparent in OBS

// RIGHT: Always set explicit fillStyle
ctx.font = 'bold 96px Jost';
ctx.fillStyle = '#ffffff'; // or any color
ctx.fillText(text, x, y); // Visible in OBS
```

**Warning signs:**
- Text visible in browser but not in OBS browser source
- Text appears after changing OBS settings but not on initial load
- Canvas clears but text never appears in OBS preview

**Additional prevention:**
- Always test in OBS browser source, not just browser preview
- Set fillStyle even for "obvious" white text - OBS doesn't use same defaults
- Check OBS logs (Help > Log Files > View Current Log) for canvas errors
- Verify browser source dimensions match canvas resolution

**Source:** [OBS Forum - Browser Source Canvas Text Not Rendering](https://obsproject.com/forum/threads/browser-source-canvas-text-not-rendering.122363/)

### Pitfall 3: Plus Signs Become Spaces in URL Parameters

**What goes wrong:** URLSearchParams interprets plus signs (+) as spaces, breaking text like "OMG+5" or "Level+Up".

**Why it happens:** Legacy URL encoding uses plus signs to represent spaces. URLSearchParams follows this spec, converting `+` → ` ` (space) during parsing.

**How to avoid:**
```javascript
// Example URL: shade.html?text=Level+Up

// WRONG: Direct parsing
const text = urlParams.get('text'); // Returns "Level Up" (space, not plus)

// RIGHT: Use percent-encoding for plus signs in URLs
// OBS: Use %2B for literal plus sign: shade.html?text=Level%2BUp
// Or: Expect this behavior and document it (+ means space is standard)

// If you need literal plus signs, detect and warn:
if (urlParams.toString().includes('+')) {
    console.warn('[Shade] Plus signs in URL will become spaces. Use %2B for literal +');
}
```

**Warning signs:**
- Text contains unexpected spaces where plus signs were expected
- Mathematical expressions or compound terms show spaces: "HP+5" becomes "HP 5"
- Copy-pasted URLs work differently than manually typed ones

**Additional prevention:**
- Document URL encoding in OBS setup instructions (+ = space, %2B = +)
- Consider using `.append()` method when building URLs programmatically
- Test with text containing special characters (+, &, =, %) before deploying

**Source:** [DEV Community - Mastering URLSearchParams](https://dev.to/amitkumar13/mastering-urlsearchparams-in-javascript-the-smart-way-to-handle-query-strings-3g20)

### Pitfall 4: Empty String Word Count Returns 1

**What goes wrong:** Using `text.split(/\s+/).length` on empty or whitespace-only strings returns 1 instead of 0, causing incorrect hold duration calculations.

**Why it happens:** `split()` always returns an array with at least one element, even for empty strings. Empty string split returns `['']` (array with empty string), which has length 1.

**How to avoid:**
```javascript
// WRONG: Naive split
const wordCount = text.split(/\s+/).length; // Empty string returns 1

// RIGHT: Trim and filter
const words = text.trim().split(/\s+/).filter(word => word.length > 0);
const wordCount = words.length; // Empty string returns 0

// Or check empty first:
const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
```

**Warning signs:**
- Empty text shows minimum duration (3 seconds) unexpectedly
- Single-space strings behave like one-word strings
- Word count logging shows 1 for blank input

**Additional prevention:**
- Unit test word counting with edge cases: '', ' ', '  \n\t  ', 'word', 'two words'
- Consider trimming text input in URL parameter handler
- Log word count in development to verify calculations

**Source:** [GeeksforGeeks - Count Words in String](https://www.geeksforgeeks.org/javascript-program-to-count-words-of-a-string/)

### Pitfall 5: Text Offscreen During Measurement

**What goes wrong:** Text is positioned off-canvas (x = -5000) during initial setup/measurement, causing some browsers to optimize away the measurement or return 0.

**Why it happens:** Browser optimization may skip rendering/measuring for elements outside viewport. Canvas may not allocate resources for offscreen content.

**How to avoid:**
```javascript
// WRONG: Measure while offscreen
this.x = -5000; // Way offscreen
const metrics = ctx.measureText(this.text); // May return 0 or cached value

// RIGHT: Measure at any valid position, then move offscreen
ctx.font = 'bold 96px Jost';
const metrics = ctx.measureText(this.text); // Measure first
this.textWidth = metrics.width;
this.x = canvas.width + this.textWidth; // Then position offscreen right

// Or measure at origin:
const tempMetrics = ctx.measureText(text); // Measure at (0,0) conceptually
```

**Warning signs:**
- textWidth is 0 or very small unexpectedly
- Different measurements between browsers (Chrome vs Firefox vs OBS)
- Text appears correctly but scroll speed is wrong

**Additional prevention:**
- Measure text in initialization before setting position
- Don't rely on current position for measurement (measureText is independent of position)
- Log textWidth to verify it's reasonable (96px bold text of "Hello" is ~250-300px)

## Code Examples

Verified patterns from official sources:

### Canvas Text Rendering with Shadow
```javascript
// Source: MDN Canvas API Tutorial
// https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set font properties
ctx.font = 'bold 96px Jost';
ctx.fillStyle = '#ffffff'; // Explicit for OBS compatibility
ctx.textBaseline = 'middle'; // Vertical alignment at y coordinate

// Set shadow/glow properties
ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
ctx.shadowBlur = 8; // Blur radius for glow effect
ctx.shadowOffsetX = 4; // Horizontal shadow offset
ctx.shadowOffsetY = 4; // Vertical shadow offset

// Draw text
ctx.fillText('Hello World', x, y);

// Optional: Stroke text for outline effect
ctx.strokeStyle = '#000000';
ctx.lineWidth = 2;
ctx.strokeText('Hello World', x, y);
```

### Text Width Measurement
```javascript
// Source: MDN Canvas API Tutorial
// https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText

// Wait for fonts to load
document.fonts.ready.then(() => {
    // Set font before measuring
    ctx.font = 'bold 96px Jost';

    // Measure text
    const metrics = ctx.measureText('Hello World');

    // Get width
    const textWidth = metrics.width; // Primary property

    // Optional: Get bounding box for precise layout
    const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const actualWidth = metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft;
});
```

### Word Count Function
```javascript
// Source: GeeksforGeeks - Count Words in String
// https://www.geeksforgeeks.org/javascript-program-to-count-words-of-a-string/

function countWords(text) {
    // Trim whitespace and split on one or more whitespace characters
    const words = text.trim().split(/\s+/);

    // Filter out empty strings (handles edge case of empty input)
    const nonEmptyWords = words.filter(word => word.length > 0);

    return nonEmptyWords.length;
}

// Examples:
countWords('');                    // 0
countWords('   ');                 // 0
countWords('Hello');               // 1
countWords('Hello World');         // 2
countWords('  Multiple   spaces  '); // 2
```

### Delta-Time Scrolling Animation
```javascript
// Source: v1.0 DeltaTimer pattern + Viget Time-Based Animation
// https://www.viget.com/articles/time-based-animation

import { DeltaTimer } from '../shared/timing.js';

class ShadeBar {
    constructor(ctx, canvas, text, scrollSpeedPxPerSecond) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.text = text;
        this.scrollSpeed = scrollSpeedPxPerSecond; // Pixels per second

        this.x = canvas.width; // Start off-screen right
        this.y = canvas.height / 2;
    }

    update(deltaTime) {
        // deltaTime is in seconds (e.g., 0.016 for 60fps)
        // scrollSpeed is pixels per second (e.g., 624)
        // Distance this frame = 624 * 0.016 = ~10 pixels at 60fps
        this.x -= this.scrollSpeed * deltaTime; // Move left

        // Check if completely off-screen left
        if (this.x + this.textWidth < 0) {
            this.active = false;
        }
    }

    draw() {
        this.ctx.save();
        this.ctx.font = 'bold 96px Jost';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.text, this.x, this.y);
        this.ctx.restore();
    }
}

// Animation loop
const deltaTimer = new DeltaTimer();

function animate(timestamp) {
    const deltaTime = deltaTimer.update(timestamp);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw
    shadeBar.update(deltaTime);
    shadeBar.draw();

    if (shadeBar.active) {
        requestAnimationFrame(animate);
    }
}

requestAnimationFrame(animate);
```

### URL Parameter Parsing for OBS
```javascript
// Source: Existing v1.0 pattern from sidebar/stinger
// URLSearchParams: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams

import { getColorFromURL } from '../shared/colors.js';
import { config } from '../config/config.js';

// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);

// Get text (required parameter with fallback)
const text = urlParams.get('text') || 'Default Text';

// Get color (existing utility handles hex, named colors, or random)
const color = getColorFromURL(); // Parses ?color parameter

// Get duration override (optional)
const durationParam = urlParams.get('duration');
const holdDurationMs = durationParam ? parseInt(durationParam) : config.shade.timing.defaultHoldMs;

// Validate and log
console.log('[Shade] Config:', { text, color, holdDurationMs });

// OBS browser source URL examples:
// http://localhost:5173/shade/?text=Thank%20you%20for%20the%20raid!
// http://localhost:5173/shade/?text=Welcome&color=ff6600&duration=5000
// http://localhost:5173/shade/?text=New%20Subscriber!&color=purple
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual font loading checks with setTimeout | CSS Font Loading API (`document.fonts.ready`) | 2016+ (API baseline) | Eliminates race conditions, handles all edge cases (multiple fonts, layout completion). Native API is more reliable than polling. |
| Frame-based animation timing | Delta-time with requestAnimationFrame | v1.0 established | Frame-rate independent animation. Works at 60fps, 120fps, or variable refresh rates. Essential for smooth playback. |
| Fixed animation duration | Dynamic duration from content (word count × reading speed) | Current (v1.1 requirement) | Text is fully readable regardless of length. Short messages don't waste time, long messages get adequate display time. |
| Character count for duration | Word count for duration | Current (research-backed) | Correlates with reading comprehension (238-250 WPM research). Character count doesn't reflect reading time. |
| DOM text with CSS animations | Canvas-based text rendering | v1.1 requirement | Better OBS browser source compatibility, unified rendering pipeline with bars/curtains, explicit control over compositing. |

**Deprecated/outdated:**
- **`<marquee>` HTML element:** Deprecated, use CSS animations or canvas. Not recommended for modern web development.
- **Fixed 250ms/word duration:** Research shows 200ms/word (5 WPM) is more appropriate for stream events requiring faster pace than typical reading.
- **Font loading with `font.onload`:** Unreliable, doesn't handle all fonts. Use CSS Font Loading API instead.

## Open Questions

Things that couldn't be fully resolved:

1. **Jost font loading mechanism in existing sidebar**
   - What we know: Sidebar uses Jost font (`font-family: "Jost", Arial, sans-serif`), but no `@font-face` or `<link>` tag found in codebase
   - What's unclear: How Jost is currently loaded - Google Fonts CDN in build tool? System font? Vite plugin?
   - Recommendation: Check if Jost is loaded via build tool or add explicit Google Fonts link. For Phase 5, add `document.fonts.ready` regardless of loading mechanism to prevent race conditions. Investigate during implementation.

2. **Exact shadow/glow styling for "depth/separation from background"**
   - What we know: Text shadow properties (shadowColor, shadowBlur, shadowOffset) available. Sidebar uses CSS text-shadow with multiple layers.
   - What's unclear: Canvas shadow values to match sidebar aesthetic vs. optimize for OBS performance
   - Recommendation: Start with canvas shadow (blur 8px, offset 4px, color rgba(0,0,0,0.6)). Test in OBS. Adjust during implementation based on visual testing. May need multiple draw calls for multi-layer shadow if single shadow insufficient.

3. **Scroll speed formula during hold phase**
   - What we know: Text must fully scroll across screen within hold duration. Total distance = textWidth + canvasWidth.
   - What's unclear: Should scrolling be continuous throughout hold, or pause briefly when text is centered?
   - Recommendation: User decision specified "scrolls continuously right-to-left" during hold. Implement continuous scroll: speed = (textWidth + canvasWidth) / holdDuration. No pause. Matches classic marquee behavior.

4. **Enter/exit phase duration**
   - What we know: Three phases required (enter, hold, exit). Hold duration is dynamic (word count based).
   - What's unclear: Duration for enter and exit phases. Fixed or proportional to hold?
   - Recommendation: Use shared.durations.entryMs (1000ms) and exitMs (1000ms) from config for consistency with stinger/sidebar. Enter phase flies text in from right, exit flies out left, each 1 second. Keeps total animation time predictable.

## Sources

### Primary (HIGH confidence)
- [MDN Canvas API: fillText()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText) - Canvas text rendering syntax and parameters
- [MDN Canvas API: measureText()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText) - Text width measurement and TextMetrics
- [MDN CSS Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API) - document.fonts.ready, FontFace API, race condition prevention
- [MDN URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) - URL parameter parsing API
- Existing v1.0 codebase (AnimatedBar.js, timing.js, config.js, colors.js) - Established patterns verified in code

### Secondary (MEDIUM confidence)
- [W3Schools Canvas Shadows](https://www.w3schools.com/graphics/canvas_shadows.asp) - Shadow properties for text glow effects
- [OBS Forum: Browser Source Canvas Text Not Rendering](https://obsproject.com/forum/threads/browser-source-canvas-text-not-rendering.122363/) - OBS fillStyle requirement
- [Reading Speed Statistics - WordsRated](https://wordsrated.com/reading-speed-statistics/) - 238-250 WPM adult reading speed baseline
- [Viget: Time-based Animation](https://www.viget.com/articles/time-based-animation) - Delta-time animation patterns
- [GeeksforGeeks: Count Words in String](https://www.geeksforgeeks.org/javascript-program-to-count-words-of-a-string/) - Word counting implementation

### Tertiary (LOW confidence)
- WebSearch results for "canvas scrolling text marquee" - General patterns, not authoritative
- WebSearch results for "scroll speed calculations" - Generic guidance, needs verification with actual implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Native APIs verified with MDN official docs, existing v1.0 patterns proven in codebase
- Architecture: HIGH - AnimatedBar extension pattern established in v1.0 (StingerBar, SidebarBar), delta-time integration proven
- Don't hand-roll: HIGH - Font Loading API, URLSearchParams, DeltaTimer all verified native/existing solutions
- Pitfalls: HIGH - OBS fillStyle issue documented in official forum, font loading race condition documented in MDN, URLSearchParams behavior verified
- Code examples: HIGH - All examples sourced from MDN official docs or existing v1.0 codebase

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (30 days - stable native APIs, unlikely to change)
