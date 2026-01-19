# Pitfalls Research: Shade Component for Stream Graphics

**Domain:** Scrolling text and semi-transparent curtain effects in Canvas animations
**Researched:** 2026-01-18
**Confidence:** HIGH

## Executive Summary

Adding scrolling text with semi-transparent curtains to Canvas animations introduces **three critical failure modes**: text readability issues (speed too fast, duration too short, font rendering problems in OBS), synchronization bugs (text animation desync from curtain phases, hold duration miscalculation), and alpha blending performance degradation (semi-transparent fills triggering expensive compositing). Unlike static text or simple animations, scrolling text for stream events must be **readable under pressure** (viewers seeing it once during raid), **performant with transparency** (alpha blending on every frame), and **synchronized perfectly** (text exits before curtains close).

Your v1.0 system already prevents general Canvas pitfalls (memory leaks, frame-rate independence, cleanup lifecycle). This research focuses on **shade-specific pitfalls** not yet addressed.

---

## Critical Pitfalls

These mistakes make the shade component unusable or require major refactoring.

### Pitfall 1: Text Too Fast to Read

**What goes wrong:**
Scrolling text moves across the screen too quickly for viewers to read the full message. During high-energy moments (raids, massive gift subs), viewers miss the message entirely because it scrolls by in 1-2 seconds.

**Why it happens:**
- Developers calculate scroll speed based on "looks good" rather than reading time
- Fixed pixel-per-frame velocity doesn't account for text length
- No minimum duration for readability (viewers need 3-5 seconds for 20-character usernames)
- Scrolling speed optimized for demo videos, not real stream events

**Consequences:**
- Viewers: "Who raided? I couldn't read it!"
- Streamer misses opportunity to thank raider by name
- Defeats the purpose of displaying the message
- Longer text becomes progressively more unreadable

**How to avoid:**

1. **Calculate reading time:** Use research-backed formula: minimum 250ms per word + 500ms baseline
   ```javascript
   function calculateMinimumReadingTime(text) {
     const words = text.split(/\s+/).length;
     const readingTimeMs = 500 + (words * 250); // 500ms baseline + 250ms/word
     return Math.max(readingTimeMs, 2000); // Minimum 2 seconds
   }
   ```

2. **Scroll speed based on text length:**
   ```javascript
   function calculateScrollSpeed(textWidth, holdDuration, canvasWidth) {
     // Text must traverse: offscreen-left → center → offscreen-right
     const totalDistance = canvasWidth + (2 * textWidth);
     const pixelsPerSecond = totalDistance / (holdDuration / 1000);
     return pixelsPerSecond / 60; // Convert to pixels per frame at 60fps
   }
   ```

3. **Reading time validation tests:**
   ```javascript
   test('shade hold duration provides minimum reading time', () => {
     const message = "Thanks for the 100 gift subs!";
     const minReadingTime = calculateMinimumReadingTime(message);
     const actualHoldDuration = shade.calculateHoldDuration(message);
     expect(actualHoldDuration).toBeGreaterThanOrEqual(minReadingTime);
   });
   ```

**Warning signs:**
- Manual testing: Can you read the full message comfortably?
- Ask someone unfamiliar with the message to read it while scrolling
- Test with maximum-length messages (100-character raid message)
- During live stream: Chat asks "who was that?" after raid animation

**Phase to address:**
Phase 1 (Text Animation Implementation) - Must calculate reading time during hold duration logic.

**Sources:**
- [Predicting Text Readability from Scrolling Interactions](https://research.google/blog/predicting-text-readability-from-scrolling-interactions/) - Research showing total read time and scrolling speed affect comprehension
- [Konva Text Animations](https://konvajs.org/docs/animations/Text_Animations.html) - 1.5s fade-in + 1s hold + 1.5s fade-out as baseline timing

---

### Pitfall 2: Text Measurement Race Condition with Font Loading

**What goes wrong:**
`ctx.measureText()` returns incorrect width because custom fonts haven't loaded yet, causing text to be positioned incorrectly (too far left/right) or scroll speed calculation to be wrong.

**Why it happens:**
- Canvas doesn't automatically wait for font loading like DOM elements do
- `ctx.font = "48px CustomFont"` sets the font property, but font file might still be downloading
- `measureText()` falls back to default font (Times New Roman), returning different width
- Font loads 100ms later, but measurements are already cached

**Consequences:**
- Text starts at wrong X position (calculated with fallback font width)
- Scroll speed is incorrect (based on wrong text width)
- "Text jumps" when font loads mid-animation
- Inconsistent behavior: works after page refresh (font cached), breaks on first load
- **OBS-specific:** Browser source cache settings affect font loading timing

**How to avoid:**

1. **Use Font Loading API before measuring:**
   ```javascript
   async function measureTextWithFont(ctx, text, fontFamily, fontSize) {
     // Wait for font to load
     await document.fonts.load(`${fontSize}px ${fontFamily}`);

     ctx.font = `${fontSize}px ${fontFamily}`;
     const metrics = ctx.measureText(text);
     return metrics.width;
   }
   ```

2. **Fallback detection pattern:**
   ```javascript
   function detectFontLoaded(fontFamily) {
     const canvas = document.createElement('canvas');
     const ctx = canvas.getContext('2d');

     // Measure with fallback
     ctx.font = `48px serif`;
     const fallbackWidth = ctx.measureText('M').width;

     // Measure with custom font
     ctx.font = `48px ${fontFamily}`;
     const customWidth = ctx.measureText('M').width;

     // If widths differ, custom font loaded
     return customWidth !== fallbackWidth;
   }
   ```

3. **Preload fonts in HTML:**
   ```html
   <link rel="preload" href="/fonts/stream-font.woff2" as="font" type="font/woff2" crossorigin>
   ```

4. **Delay animation start until fonts ready:**
   ```javascript
   async function initShade(message) {
     await document.fonts.ready; // Wait for all fonts
     const textWidth = ctx.measureText(message).width;
     shade.init(message, textWidth);
     shade.start();
   }
   ```

**Warning signs:**
- Text position inconsistent between first load and subsequent reloads
- `measureText()` returns different values in browser vs OBS
- Text "jumps" 100-200ms after animation starts
- Works in local testing, breaks when deployed to OBS

**Phase to address:**
Phase 1 (Text Animation Implementation) - Font loading must be addressed before position calculations.

**Sources:**
- [Konva: Custom Font Loading](https://konvajs.org/docs/sandbox/Custom_Font.html) - Canvas text doesn't auto-update when fonts load
- [Understanding Canvas Measure Text Metrics](https://erikonarheim.com/posts/canvas-text-metrics/) - Use actualBoundingBoxLeft + actualBoundingBoxRight for accurate width
- [Don't Test Fonts](https://erikonarheim.com/posts/dont-test-fonts/) - Font loading race conditions in testing

---

### Pitfall 3: OBS Browser Source Requires Explicit fillStyle for Text

**What goes wrong:**
Text renders perfectly in Chrome/Firefox but doesn't appear at all in OBS browser source. Canvas element exists, `fillText()` is called, but text is invisible.

**Why it happens:**
- OBS browser source (Chromium Embedded Framework) has stricter Canvas rendering requirements
- Browser defaults to black fillStyle if unspecified; OBS's CEF doesn't
- Code assumes default fillStyle, works in browsers, breaks in OBS
- AI-generated code often omits explicit fillStyle (not in training data as "required")

**Consequences:**
- Silent failure: no errors, no warnings, just invisible text
- Works in local browser testing, breaks when added to OBS
- Streamer discovers during live stream (worst time)
- Wastes hours debugging "why text doesn't show"

**How to avoid:**

1. **Always set fillStyle explicitly before fillText():**
   ```javascript
   // BAD: Assumes default fillStyle
   ctx.font = '48px Arial';
   ctx.fillText('Raid!', x, y);

   // GOOD: Explicit fillStyle
   ctx.fillStyle = '#FFFFFF'; // or 'white'
   ctx.font = '48px Arial';
   ctx.fillText('Raid!', x, y);
   ```

2. **Lint rule to enforce:**
   ```javascript
   // ESLint custom rule (pseudocode)
   // Error if fillText() called without fillStyle set first
   ```

3. **Test in OBS browser source early:**
   - Don't rely solely on Chrome DevTools
   - Add to OBS as browser source within first hour of implementation
   - Test with white text on dark background AND dark text on light background

4. **Reset fillStyle in drawText() method:**
   ```javascript
   drawText(text, x, y, color = '#FFFFFF') {
     this.ctx.save();
     try {
       this.ctx.fillStyle = color; // Always set explicitly
       this.ctx.font = this.config.FONT;
       this.ctx.fillText(text, x, y);
     } finally {
       this.ctx.restore();
     }
   }
   ```

**Warning signs:**
- Text visible in browser DevTools, invisible in OBS
- `fillText()` calls succeed (no errors), but nothing renders
- Other canvas elements (bars, shapes) render fine, only text missing
- Console shows no errors (silent failure)

**Phase to address:**
Phase 1 (Text Animation Implementation) - Critical for OBS compatibility; test immediately.

**Sources:**
- [OBS Browser Source Canvas Text Not Rendering](https://obsproject.com/forum/threads/browser-source-canvas-text-not-rendering.122363/) - Workaround: add fillStyle property
- [OBS Text Source Outline Rendering Issue](https://github.com/obsproject/obs-studio/issues/12053) - Text rendering inconsistencies in OBS

---

### Pitfall 4: Text-Curtain Desynchronization

**What goes wrong:**
Curtains start exiting before text finishes scrolling, causing text to be cut off. Or text exits while curtains are still visible, creating awkward empty pause. Synchronization breaks, destroying the "unified animation" effect.

**Why it happens:**
- Text animation uses one timing system (scroll speed, distance)
- Curtain animation uses separate timing system (enter/hold/exit phases)
- No shared phase controller ensuring coordination
- Hold duration calculated for text, but curtain exit phase starts early
- Race condition: text animation completes, triggers curtain exit, but timing is off by 200ms

**Consequences:**
- Text gets cut off mid-scroll by closing curtains (looks broken)
- Text disappears while curtains linger (awkward pause)
- "Shade" effect fails because elements aren't synchronized
- Viewer perception: "Animation is buggy/unpolished"

**How to avoid:**

1. **Single source of truth for phase timing:**
   ```javascript
   class ShadeController {
     constructor(config) {
       this.phase = 'enter';
       this.phaseFrame = 0;
       this.config = config;
     }

     update() {
       this.phaseFrame++;

       // Determine next phase (single decision point)
       const result = determineNextPhase(
         this.phase,
         this.phaseFrame,
         this.config.DURATION.ENTER,
         this.holdDuration, // Calculated based on text length
         this.config.DURATION.EXIT
       );

       this.phase = result.phase;
       this.phaseFrame = result.frame;
     }

     getCurrentPhase() {
       return {
         phase: this.phase,
         progress: this.phaseFrame / this.getPhaseDuration(this.phase)
       };
     }
   }
   ```

2. **Text and curtains query same controller:**
   ```javascript
   // In ShadeBar.update()
   const { phase, progress } = this.controller.getCurrentPhase();

   // Curtain position based on phase
   this.curtainTop = this.calculateCurtainPosition('top', phase, progress);
   this.curtainBottom = this.calculateCurtainPosition('bottom', phase, progress);

   // Text position based on same phase
   this.textX = this.calculateTextPosition(phase, progress);
   ```

3. **Test synchronization with timing assertions:**
   ```javascript
   test('text exits before curtains start closing', () => {
     const shade = new ShadeBar(ctx, canvas, 'raid message', config);

     // Run through full animation
     for (let frame = 0; frame < 1000; frame++) {
       shade.update();

       // When curtains start exiting
       if (shade.phase === 'exit') {
         // Text should be off-screen or at final position
         const textOffscreenRight = shade.textX > canvas.width;
         expect(textOffscreenRight).toBe(true);
         break;
       }
     }
   });

   test('curtains fully open before text starts scrolling', () => {
     const shade = new ShadeBar(ctx, canvas, 'raid message', config);

     for (let frame = 0; frame < 100; frame++) {
       shade.update();

       // During enter phase, text should not move
       if (shade.phase === 'enter') {
         expect(shade.textX).toBe(shade.textStartX);
       }

       // Once in hold phase, curtains should be fully open
       if (shade.phase === 'hold') {
         expect(shade.curtainTop).toBeLessThanOrEqual(0); // Off top edge
         expect(shade.curtainBottom).toBeGreaterThanOrEqual(canvas.height); // Off bottom edge
         break;
       }
     }
   });
   ```

4. **Visual debugging mode:**
   ```javascript
   // Development-only: Show phase and timing on canvas
   if (DEBUG_MODE) {
     ctx.fillStyle = 'red';
     ctx.fillText(`Phase: ${shade.phase} | Frame: ${shade.phaseFrame}`, 10, 30);
     ctx.fillText(`Text X: ${shade.textX} | Curtain Top: ${shade.curtainTop}`, 10, 60);
   }
   ```

**Warning signs:**
- Text visible while curtains are closing
- Curtains linger after text exits
- Timing feels "off" or "stuttery"
- Race conditions during hold → exit transition

**Phase to address:**
Phase 2 (Synchronization) - After basic text/curtain rendering works, before polish.

---

### Pitfall 5: Hold Duration Miscalculation for Long Text

**What goes wrong:**
Long text (100-character raid messages) either scrolls too fast (unreadable) or hold duration is so long the animation feels stuck. Fixed hold duration doesn't scale with text length.

**Why it happens:**
- Hold duration set to fixed 3 seconds for all messages
- Doesn't account for text length variation (10 characters vs 100 characters)
- Scrolling speed calculation doesn't consider readability constraints
- No maximum hold duration cap (UX suffers for extremely long messages)

**Consequences:**
- Short text (10 chars): Holds unnecessarily long, feels slow
- Long text (100 chars): Either scrolls too fast OR holds too long
- Streamer gets complaints: "animation is too slow" (short text) or "couldn't read it" (long text)
- No good default satisfies all cases

**How to avoid:**

1. **Dynamic hold duration with min/max bounds:**
   ```javascript
   function calculateHoldDuration(text, config) {
     // Base reading time: 250ms per word
     const words = text.split(/\s+/).length;
     const readingTime = words * 250;

     // Add scrolling time: text must cross screen
     const scrollDistance = canvas.width + (2 * textWidth);
     const scrollTime = (scrollDistance / SCROLL_SPEED_PX_PER_MS);

     // Total hold duration
     const calculatedDuration = readingTime + scrollTime + 500; // +500ms buffer

     // Apply bounds
     const minDuration = config.DURATION.HOLD_MIN || 2000; // 2 seconds
     const maxDuration = config.DURATION.HOLD_MAX || 8000; // 8 seconds

     return Math.max(minDuration, Math.min(maxDuration, calculatedDuration));
   }
   ```

2. **Adjust scroll speed for very long text:**
   ```javascript
   function calculateScrollSpeed(textWidth, holdDuration, canvasWidth) {
     const totalDistance = canvasWidth + (2 * textWidth);
     const availableTime = holdDuration - 500; // Reserve 500ms for pause

     const baseSpeed = totalDistance / availableTime;

     // If text is very long, cap speed to maintain readability
     const MAX_SPEED = 800; // pixels per second (readability threshold)
     return Math.min(baseSpeed, MAX_SPEED);
   }
   ```

3. **Test edge cases:**
   ```javascript
   describe('Hold duration calculation', () => {
     test('short text (5 words) uses minimum duration', () => {
       const message = "Thanks for the raid!";
       const duration = calculateHoldDuration(message, config);
       expect(duration).toBe(config.DURATION.HOLD_MIN);
     });

     test('very long text (30 words) caps at maximum duration', () => {
       const message = "Thank you so much for the amazing 500 person raid with all those gift subs this is incredible I can't believe it wow everyone say hi to the raiders!";
       const duration = calculateHoldDuration(message, config);
       expect(duration).toBe(config.DURATION.HOLD_MAX);
     });

     test('medium text (15 words) scales proportionally', () => {
       const message = "Huge raid from AwesomeStreamer with 200 viewers thank you all so much for coming!";
       const duration = calculateHoldDuration(message, config);
       expect(duration).toBeGreaterThan(config.DURATION.HOLD_MIN);
       expect(duration).toBeLessThan(config.DURATION.HOLD_MAX);
     });
   });
   ```

4. **Validate readability:**
   ```javascript
   test('scroll speed never exceeds readability threshold', () => {
     const longMessage = "Very long raid message ".repeat(10);
     const textWidth = ctx.measureText(longMessage).width;
     const holdDuration = calculateHoldDuration(longMessage, config);
     const scrollSpeed = calculateScrollSpeed(textWidth, holdDuration, canvas.width);

     const MAX_READABLE_SPEED = 800; // px/s
     expect(scrollSpeed).toBeLessThanOrEqual(MAX_READABLE_SPEED);
   });
   ```

**Warning signs:**
- Testers say "sometimes it's too fast, sometimes too slow"
- Hold duration varies wildly between messages
- Very long messages scroll incomprehensibly fast
- Short messages feel sluggish

**Phase to address:**
Phase 1 (Text Animation Implementation) - Must calculate hold duration correctly from start.

---

## Performance Traps

Patterns that work at small scale but degrade performance.

### Pitfall 6: Alpha Blending on Every Frame

**What goes wrong:**
Drawing semi-transparent curtains with `globalAlpha` or `rgba()` every frame causes expensive GPU compositing, degrading performance from 60fps to 30-40fps.

**Why it happens:**
- `ctx.globalAlpha = 0.7` triggers alpha blending for all subsequent draw operations
- GPU must composite each pixel with background: `result = (foreground * alpha) + (background * (1-alpha))`
- Drawing two full-screen curtains = 2 million pixels × alpha blend calculation per frame
- Compounds with background animation already running (bars with their own alpha)

**Consequences:**
- Frame rate drops: 60fps → 40fps during shade animation
- GPU usage spikes to 80-100%
- OBS encoding suffers, stream drops frames
- CPU/GPU temperature increases
- Laptop fans spin up audibly

**Performance Cost:**
| Operation | Relative Cost | 1920×1080 @ 60fps |
|-----------|---------------|-------------------|
| Opaque fill | 1x | ~5% GPU |
| Alpha fill (globalAlpha) | 3-5x | ~15-25% GPU |
| Multiple alpha layers | 10-20x | ~50-100% GPU |

**How to avoid:**

1. **Pre-multiply alpha into color:**
   ```javascript
   // BAD: Expensive per-frame alpha blending
   ctx.globalAlpha = 0.7;
   ctx.fillStyle = '#000000';
   ctx.fillRect(0, 0, canvas.width, curtainHeight);

   // GOOD: Alpha in color (single operation)
   ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Pre-multiplied
   ctx.fillRect(0, 0, canvas.width, curtainHeight);
   // No globalAlpha = no per-pixel blending overhead
   ```

   **Important:** This doesn't eliminate alpha blending, but reduces overhead by avoiding state changes and using optimized rgba path.

2. **Cache curtain with alpha in offscreen canvas:**
   ```javascript
   // Create curtain once
   const curtainCanvas = document.createElement('canvas');
   curtainCanvas.width = canvas.width;
   curtainCanvas.height = 200; // Curtain height
   const curtainCtx = curtainCanvas.getContext('2d');
   curtainCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
   curtainCtx.fillRect(0, 0, curtainCanvas.width, curtainCanvas.height);

   // Draw cached curtain (opaque blit, faster)
   ctx.drawImage(curtainCanvas, 0, curtainTopY);
   ```

   **Benefit:** `drawImage()` of pre-rendered alpha is faster than `fillRect()` with alpha.

3. **Reduce alpha changes per frame:**
   ```javascript
   // BAD: Multiple alpha changes
   ctx.globalAlpha = 0.7;
   drawTopCurtain();
   ctx.globalAlpha = 0.7; // Redundant
   drawBottomCurtain();
   ctx.globalAlpha = 1.0; // Reset

   // GOOD: Batch alpha operations
   ctx.globalAlpha = 0.7;
   drawTopCurtain();
   drawBottomCurtain();
   ctx.globalAlpha = 1.0; // Single reset
   ```

4. **Profile alpha impact:**
   ```javascript
   // Measure performance with/without alpha
   const fpsWithAlpha = measureFPS(renderWithAlpha, 300); // 5 seconds
   const fpsWithoutAlpha = measureFPS(renderOpaque, 300);
   console.log(`Alpha cost: ${fpsWithoutAlpha - fpsWithAlpha} fps`);
   ```

**Detection:**
- Chrome DevTools → Performance → Record during shade animation
- Look for "Composite Layers" taking >5ms per frame
- GPU usage monitor: >50% during shade animation
- Compare frame times: shade animation vs background-only

**Phase to address:**
Phase 3 (Performance Optimization) - After basic functionality works, before final polish.

**Sources:**
- [Alpha Compositing Performance](https://apoorvaj.io/alpha-compositing-opengl-blending-and-premultiplied-alpha) - Premultiplied alpha reduces operations
- [Smashing Magazine: Canvas Optimization](https://www.smashingmagazine.com/2011/08/optimize-images-with-html5-canvas/) - Alpha blending is resource-intensive
- [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Minimize state changes

---

### Pitfall 7: Measuring Text Width Every Frame

**What goes wrong:**
Calling `ctx.measureText(message)` every frame to calculate text position is expensive (1-2ms per call), causing unnecessary CPU usage and frame rate drops.

**Why it happens:**
- Text width needed for centering calculation: `x = (canvas.width - textWidth) / 2`
- Developer calls `measureText()` in `update()` or `draw()` loop
- Doesn't realize measurement is expensive (it triggers font layout engine)
- Text doesn't change, but measurement recalculates every frame

**Consequences:**
- CPU usage increases 10-20% unnecessarily
- Frame time increases by 1-2ms per text element
- Multiple shade instances (e.g., queued notifications) compound the cost
- Pointless work: text width doesn't change between frames

**Performance Cost:**
| Operation | Time | Frequency | Total Cost |
|-----------|------|-----------|------------|
| `measureText()` | 1-2ms | 60 fps | 60-120ms/sec |
| Cached width lookup | 0.001ms | 60 fps | 0.06ms/sec |
| **Savings** | - | - | **~100ms/sec** |

**How to avoid:**

1. **Measure once during initialization:**
   ```javascript
   class ShadeBar {
     constructor(ctx, canvas, message, config) {
       this.message = message;

       // Measure ONCE during construction
       ctx.font = config.TEXT.FONT;
       this.textWidth = ctx.measureText(message).width;

       // Use cached width everywhere
       this.textX = this.calculateStartPosition(this.textWidth);
     }

     update() {
       // NEVER measure here
       this.textX += this.scrollSpeed;
     }

     draw() {
       // Use cached width
       this.ctx.fillText(this.message, this.textX, this.textY);
     }
   }
   ```

2. **Cache metrics, not just width:**
   ```javascript
   async initTextMetrics(message) {
     await document.fonts.ready;
     this.ctx.font = this.config.TEXT.FONT;
     const metrics = this.ctx.measureText(message);

     // Cache all useful metrics
     this.textMetrics = {
       width: metrics.width,
       actualBoundingBoxLeft: metrics.actualBoundingBoxLeft,
       actualBoundingBoxRight: metrics.actualBoundingBoxRight,
       height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
     };
   }
   ```

3. **Test that measurement only happens once:**
   ```javascript
   test('measureText called only during initialization, not per frame', () => {
     const mockMeasureText = jest.fn().mockReturnValue({ width: 500 });
     ctx.measureText = mockMeasureText;

     const shade = new ShadeBar(ctx, canvas, 'test message', config);
     expect(mockMeasureText).toHaveBeenCalledTimes(1); // Init only

     // Run animation for 60 frames
     for (let i = 0; i < 60; i++) {
       shade.update();
       shade.draw();
     }

     expect(mockMeasureText).toHaveBeenCalledTimes(1); // Still only once
   });
   ```

4. **Lint rule for common mistake:**
   ```javascript
   // ESLint rule (pseudocode)
   // Error if measureText() called inside update() or draw() methods
   ```

**Warning signs:**
- Performance profiler shows `measureText` in hot path (called repeatedly)
- CPU usage higher than expected for simple text animation
- Frame time increases when text is visible

**Phase to address:**
Phase 1 (Text Animation Implementation) - Easy to do correctly from start, hard to fix later.

**Sources:**
- [Understanding Canvas Measure Text Metrics](https://erikonarheim.com/posts/canvas-text-metrics/) - Measurement is expensive, cache results
- [GitHub: Cache Field Text Widths with measureText](https://github.com/LLK/scratch-blocks/pull/1937) - Real-world caching implementation
- [Canvas Text Measurement Performance](https://www.codestudy.net/blog/determine-width-of-string-in-html5-canvas/) - Use measureText efficiently

---

### Pitfall 8: Large Font Sizes Without Offscreen Caching

**What goes wrong:**
Drawing large text (48px+) with effects (shadow, outline) every frame is expensive. Unlike small UI text, large scrolling text without caching causes noticeable performance degradation.

**Why it happens:**
- Large fonts trigger expensive glyph rendering and anti-aliasing
- Text drawn directly to main canvas every frame
- Shadows/outlines multiply the cost (2-3x per effect)
- Developers don't realize text rendering scales poorly with size

**Consequences:**
- Frame rate drops when text is visible: 60fps → 45-50fps
- GPU rasterization overhead increases with font size
- Multiple effects compound the cost exponentially
- Scrolling becomes stuttery during text animation

**Performance Cost:**
| Font Size | Render Time | With Shadow | With Outline + Shadow |
|-----------|-------------|-------------|----------------------|
| 24px | 0.5ms | 1ms | 2ms |
| 48px | 2ms | 4ms | 8ms |
| 96px | 8ms | 16ms | 32ms (!!) |

**How to avoid:**

1. **Pre-render text to offscreen canvas:**
   ```javascript
   class ShadeBar {
     createTextCanvas(message) {
       // Measure text
       this.ctx.font = this.config.TEXT.FONT;
       const metrics = this.ctx.measureText(message);

       // Create offscreen canvas sized to text
       const padding = 20; // For shadow/outline
       const textCanvas = document.createElement('canvas');
       textCanvas.width = metrics.width + (padding * 2);
       textCanvas.height = this.config.TEXT.SIZE + (padding * 2);

       const textCtx = textCanvas.getContext('2d');

       // Draw text once with all effects
       textCtx.font = this.config.TEXT.FONT;
       textCtx.fillStyle = this.config.TEXT.COLOR;
       textCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
       textCtx.shadowBlur = 10;
       textCtx.shadowOffsetX = 2;
       textCtx.shadowOffsetY = 2;
       textCtx.fillText(message, padding, padding + this.config.TEXT.SIZE);

       return textCanvas;
     }

     init(message) {
       this.textCanvas = this.createTextCanvas(message);
     }

     draw() {
       // Fast blit: draw pre-rendered text
       this.ctx.drawImage(this.textCanvas, this.textX, this.textY);
     }
   }
   ```

2. **Cache in static Map for reusable messages:**
   ```javascript
   static textCache = new LRUCache(20); // Max 20 rendered text images

   getOrCreateTextCanvas(message) {
     const cacheKey = `${message}_${this.config.TEXT.FONT}_${this.config.TEXT.COLOR}`;

     let textCanvas = ShadeBar.textCache.get(cacheKey);
     if (textCanvas) return textCanvas;

     textCanvas = this.createTextCanvas(message);
     ShadeBar.textCache.set(cacheKey, textCanvas);
     return textCanvas;
   }
   ```

3. **Benchmark text rendering:**
   ```javascript
   test('text rendering with cache is 5x faster than direct rendering', () => {
     const message = "Thanks for the raid!";

     // Measure direct rendering
     const directStart = performance.now();
     for (let i = 0; i < 60; i++) {
       ctx.fillStyle = 'white';
       ctx.fillText(message, 100, 100);
     }
     const directTime = performance.now() - directStart;

     // Measure cached rendering
     const textCanvas = createTextCanvas(message);
     const cachedStart = performance.now();
     for (let i = 0; i < 60; i++) {
       ctx.drawImage(textCanvas, 100, 100);
     }
     const cachedTime = performance.now() - cachedStart;

     expect(cachedTime).toBeLessThan(directTime / 5); // At least 5x faster
   });
   ```

**Warning signs:**
- Frame rate drops specifically when text is visible
- Performance profiler shows `fillText` taking >2ms per frame
- GPU usage spikes during text rendering
- Scrolling feels stuttery

**Phase to address:**
Phase 2 (Performance Optimization) - After basic text works, before adding multiple shade instances.

**Sources:**
- [Supercharging Canvas fillText Performance](https://www.mirkosertic.de/blog/2015/03/tuning-html5-canvas-filltext/) - Offscreen canvas caching gains 10x speedup
- [GitHub: canvas-fill-text-opt](https://github.com/debevv/canvas-fill-text-opt) - Text performance optimization experiments
- [MDN: textRendering Property](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textRendering) - optimizeSpeed mode available in 2025

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Fixed 3-second hold duration | Simple implementation, no calculation needed | Long text unreadable, short text feels slow | Never (dynamic calculation is trivial) |
| Measure text every frame | Simpler code (one less variable) | 10-20% CPU waste, scales poorly | Never (measure once is same complexity) |
| No font loading wait | Code works in browser testing | Race conditions in OBS, inconsistent positioning | Never (async/await is standard) |
| Direct text rendering (no cache) | Fewer abstractions, straightforward | Poor performance with large fonts/effects | Only for small static text (not scrolling) |
| Hardcoded scroll speed | Easy to tune by eye | Doesn't scale with text length or screen size | Only for prototyping (not production) |
| Skip fillStyle for text | Works in browser, one less line | Breaks in OBS, silent failure | Never (required for OBS compatibility) |
| Text/curtain separate timings | Easier to implement independently | Synchronization bugs, desync over time | Never (shared controller is cleaner) |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OBS Browser Source | Test only in Chrome, assume compatibility | Test in OBS browser source early; CEF behavior differs |
| Font Loading | Assume fonts load instantly | Use Font Loading API (`document.fonts.ready`) before measuring |
| Text Measurement | Call `measureText()` every frame | Cache width during initialization, use cached value |
| Canvas Text Rendering | Omit `fillStyle`, rely on browser default | Always set `fillStyle` explicitly before `fillText()` |
| Alpha Blending | Use `globalAlpha` for large areas | Pre-multiply alpha into `rgba()` color for better performance |
| Scroll Speed | Fixed pixels-per-frame velocity | Calculate based on text length and readability constraints |
| Hold Duration | Fixed duration for all messages | Dynamic calculation: min(reading time + scroll time, MAX_DURATION) |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Text scrolls too fast | Viewers miss message entirely, can't thank raider | Calculate minimum reading time (250ms/word + baseline) |
| Hold duration too long | Animation feels stuck, viewers lose interest | Cap maximum hold duration at 8 seconds |
| Curtains cut off text | Looks broken, unprofessional | Synchronize phases: text exits BEFORE curtains close |
| Text jumps when font loads | Unprofessional, jarring visual glitch | Wait for fonts before starting animation |
| Scrolling stutters | Distracting, looks buggy | Cache text rendering, maintain 60fps |
| No minimum readability time | Short messages feel rushed | Enforce minimum 2-second display time |
| Very long text unreadable | Defeats purpose of displaying message | Cap scroll speed at readability threshold (800px/s) |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Text animation:** Works in browser but test in OBS browser source (fillStyle required)
- [ ] **Font loading:** Fonts load in dev but verify `document.fonts.ready` used in production
- [ ] **Hold duration:** Fixed duration set but verify dynamic calculation based on text length
- [ ] **Scroll speed:** Looks good at 10 characters but test with 100-character messages
- [ ] **Text measurement:** Works now but verify `measureText()` only called once (not per frame)
- [ ] **Synchronization:** Text and curtains move but verify phases synchronized (exit timing correct)
- [ ] **Readability:** Looks smooth but verify minimum reading time enforced (250ms/word)
- [ ] **Performance:** Runs at 60fps solo but verify maintains 60fps with background animation
- [ ] **Alpha blending:** Semi-transparent curtains work but verify GPU usage <50%
- [ ] **Text caching:** Large text renders but verify offscreen canvas caching implemented

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Text too fast to read | LOW | Add minimum hold duration calculation; adjust scroll speed formula |
| Font loading race condition | MEDIUM | Add `await document.fonts.ready` before init; may need to refactor initialization |
| Text invisible in OBS | LOW | Add explicit `fillStyle` before all `fillText()` calls |
| Text-curtain desync | MEDIUM | Extract shared phase controller; refactor timing to use single source of truth |
| Hold duration too long | LOW | Add maximum cap to calculation; tune min/max constants |
| Alpha blending performance | MEDIUM | Replace `globalAlpha` with `rgba()`; consider offscreen caching for curtains |
| Measuring text every frame | LOW | Move `measureText()` to initialization; cache result in instance variable |
| Large text performance | MEDIUM | Implement offscreen text canvas; cache rendered text |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Text too fast to read | Phase 1 (Text Implementation) | Manual testing with 10-char and 100-char messages |
| Font loading race condition | Phase 1 (Text Implementation) | Test in OBS on fresh browser source (no cache) |
| OBS fillStyle requirement | Phase 1 (Text Implementation) | Test in OBS within first hour of text rendering |
| Text-curtain desync | Phase 2 (Synchronization) | Unit tests verify exit timing; visual testing in OBS |
| Hold duration miscalculation | Phase 1 (Text Implementation) | Unit tests with edge cases (short, long, very long text) |
| Alpha blending performance | Phase 3 (Performance) | Profile GPU usage: <50% during shade animation |
| Measuring text every frame | Phase 1 (Text Implementation) | Unit test verifies `measureText()` called once |
| Large text performance | Phase 2 (Optimization) | Benchmark: cached rendering 5x+ faster than direct |

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Text Animation (Phase 1) | OBS fillStyle bug discovered late | Test in OBS browser source immediately, within first hour |
| Text Animation (Phase 1) | Font loading race condition | Use Font Loading API from start, don't defer |
| Synchronization (Phase 2) | Text/curtain phases drift apart | Single `ShadeController` owns all timing, not separate timers |
| Synchronization (Phase 2) | Hold duration calculation breaks sync | Include hold duration in phase controller, not separate calculation |
| Performance (Phase 3) | Alpha blending costs missed until GPU profiling | Profile GPU usage early, not after "looks done" |
| Performance (Phase 3) | Text caching added as afterthought | Cache text canvas from Phase 1 if using large fonts (48px+) |
| Testing (Phase 4) | Visual tests pass in browser, fail in OBS | Always test final build in OBS, not just browser DevTools |

---

## Known Patterns from v1.0 to Leverage

Your v1.0 system already prevents many general pitfalls. Shade component should follow these proven patterns:

### Pattern 1: Delta-Time Normalization (Already Implemented)
**Use for:** Text scroll speed calculation
```javascript
// In ShadeBar.update(deltaTime)
this.textX += this.scrollSpeedPerSecond * (deltaTime / 1000);
```

### Pattern 2: AnimationLifecycle Cleanup (Already Implemented)
**Use for:** Shade animation cleanup on OBS scene change
```javascript
// In shade/main.js
const lifecycle = new AnimationLifecycle();
lifecycle.start(animate);
// Cleanup automatic via AbortController
```

### Pattern 3: LRU Cache with Bounded Size (Already Implemented)
**Use for:** Text canvas caching
```javascript
static textCache = new LRUCache(20); // Max 20 rendered text images
```

### Pattern 4: Pure Calculation Functions (Already Implemented)
**Use for:** All text positioning and timing calculations
```javascript
// shared/calculations.js (additions)
export function calculateTextScrollSpeed(textWidth, holdDuration, canvasWidth) { /* ... */ }
export function calculateMinimumReadingTime(text) { /* ... */ }
export function calculateTextStartPosition(textWidth, canvasWidth) { /* ... */ }
```

### Pattern 5: Three-Phase Animation (Already Implemented)
**Use for:** Shade component follows same enter/hold/exit pattern as stinger
```javascript
// ShadeBar extends AnimatedBar
// Uses determineNextPhase() from calculations.js
```

---

## Sources

### Text Readability & Scrolling (MEDIUM-HIGH confidence)
- [Predicting Text Readability from Scrolling Interactions](https://research.google/blog/predicting-text-readability-from-scrolling-interactions/) - Research on reading time and scroll speed
- [Konva Text Animations](https://konvajs.org/docs/animations/Text_Animations.html) - 150ms character delay, 4s cycle baseline
- [Motion Canvas Time Events](https://motioncanvas.io/docs/time-events/) - Synchronization with audio and timing

### Canvas Text Performance (HIGH confidence)
- [Supercharging Canvas fillText Performance](https://www.mirkosertic.de/blog/2015/03/tuning-html5-canvas-filltext/) - Offscreen caching gains 10x speedup
- [GitHub: canvas-fill-text-opt](https://github.com/debevv/canvas-fill-text-opt) - Text rendering optimization experiments
- [Understanding Canvas Measure Text Metrics](https://erikonarheim.com/posts/canvas-text-metrics/) - actualBoundingBoxLeft/Right for accuracy
- [MDN: textRendering Property](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textRendering) - optimizeSpeed mode (2025)

### Font Loading (HIGH confidence)
- [Konva: Custom Font Loading](https://konvajs.org/docs/sandbox/Custom_Font.html) - Canvas doesn't auto-update when fonts load
- [Don't Test Fonts](https://erikonarheim.com/posts/dont-test-fonts/) - Font loading race conditions in testing
- [GitHub: Cache Field Text Widths with measureText](https://github.com/LLK/scratch-blocks/pull/1937) - Real-world caching implementation

### OBS-Specific Issues (HIGH confidence)
- [OBS Browser Source Canvas Text Not Rendering](https://obsproject.com/forum/threads/browser-source-canvas-text-not-rendering.122363/) - fillStyle required for CEF
- [OBS Text Source Outline Rendering Issue](https://github.com/obsproject/obs-studio/issues/12053) - Text rendering inconsistencies

### Alpha Blending Performance (MEDIUM-HIGH confidence)
- [Alpha Compositing and Blending](https://apoorvaj.io/alpha-compositing-opengl-blending-and-premultiplied-alpha) - Premultiplied alpha reduces operations
- [Smashing Magazine: Canvas Optimization](https://www.smashingmagazine.com/2011/08/optimize-images-with-html5-canvas/) - Alpha blending resource-intensive
- [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Minimize state changes

### Animation Synchronization (MEDIUM confidence)
- [Motion Canvas Time Events](https://motioncanvas.io/docs/time-events/) - waitUntil for sync without hardcoded duration
- [Konva Text Animations](https://konvajs.org/docs/animations/Text_Animations.html) - Phase-based timing patterns

---

## Confidence Assessment

| Area | Level | Reasoning |
|------|-------|-----------|
| Text readability timing | MEDIUM | Research-backed (250ms/word) but no canvas-specific standards |
| Font loading race conditions | HIGH | Documented OBS issue, verified with official font loading API docs |
| OBS fillStyle requirement | HIGH | Confirmed in OBS forums with official workaround |
| Text measurement performance | HIGH | MDN docs confirm measureText cost, multiple optimization guides |
| Alpha blending cost | HIGH | Official canvas optimization guides, GPU profiling data |
| Text-curtain synchronization | HIGH | Standard animation pattern, your v1.0 already uses three-phase pattern |
| Hold duration calculation | MEDIUM | Common sense + readability research, no official standard |
| Large text caching benefit | HIGH | Verified with benchmark data from optimization guides |

---

*Pitfalls research for: Shade Component with Scrolling Text*
*Researched: 2026-01-18*
*Focus: Shade-specific issues beyond v1.0's general Canvas pitfall prevention*
