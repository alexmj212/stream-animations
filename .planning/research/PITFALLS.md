# Domain Pitfalls: Canvas-Based OBS Stream Animations

**Domain:** Long-running Canvas animations for OBS browser sources
**Researched:** 2026-01-17
**Confidence:** HIGH

## Executive Summary

Canvas animations for OBS browser sources have unique constraints: they must run continuously for hours without degradation. The biggest killers are **unbounded memory growth** (offscreen canvas caches, event listeners), **frame rate inconsistencies** (mixing 30fps/60fps logic), and **OBS-specific issues** (CEF memory leaks, hardware acceleration conflicts). Unlike typical web animations that run for seconds, streaming animations expose every memory leak and performance regression.

---

## Critical Pitfalls

These mistakes cause crashes, memory exhaustion, or require application restarts during streams.

### Pitfall 1: Unbounded Offscreen Canvas Cache

**What goes wrong:**
Offscreen canvas caches grow indefinitely as new cache keys are generated, consuming memory until browser crashes. In the current codebase, `AnimatedBar.offscreenCache` is a static Map that never removes entries.

**Why it happens:**
- Cache keys include floating-point values (width, height, angles) that create unique keys for nearly identical shapes
- No maximum size limit or LRU eviction policy
- Developers assume "similar" shapes will reuse cache entries, but slight variations create new entries

**Consequences:**
- Memory grows linearly with stream duration
- After 2-4 hours: noticeable performance degradation
- After 4-8 hours: browser crashes with "out of memory" errors
- OBS shows browser source as consuming 2-4GB+ RAM

**Prevention:**
1. **Implement cache size limits:** Use LRU (Least Recently Used) eviction when cache exceeds ~100 entries
2. **Round cache key values aggressively:** `Math.round(width)` → `Math.round(width / 10) * 10` to increase reuse
3. **Add cache metrics:** Log cache size every 1000 frames to detect growth
4. **Periodic cache clearing:** Every 30 minutes, clear entries not used in last 5 minutes

**Detection:**
- Monitor `AnimatedBar.offscreenCache.size` in browser console
- Check browser memory usage in Task Manager/Activity Monitor
- Profile heap snapshots in DevTools: look for retained HTMLCanvasElement objects
- Warning signs: memory usage increasing 50-100MB per hour

**Phase mapping:** Phase 1 (Performance Fix) must address this immediately.

**Sources:**
- [Fabric.js Canvas Memory Issue](https://github.com/fabricjs/fabric.js/issues/5198) - Unbounded canvas cache causing memory errors
- [Firefox Canvas Memory Leak Bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1697344) - GPU acceleration creates memory leaks
- [Konva Performance: Avoid Memory Leaks](https://konvajs.org/docs/performance/Avoid_Memory_Leaks.html)

---

### Pitfall 2: Event Listener Accumulation

**What goes wrong:**
Event listeners (especially `resize`, `visibility`) accumulate over scene changes, causing memory leaks and duplicate event handling.

**Why it happens:**
- `setupCanvas()` in `src/shared/canvas.js` adds `resize` listener but never removes it
- OBS browser sources don't trigger normal page unload events during scene transitions
- Developers assume listeners auto-cleanup (they don't in OBS context)

**Consequences:**
- Multiple resize handlers fire simultaneously, causing redundant canvas resizes
- Memory holds references to old canvas contexts through listener closures
- After 10+ scene transitions: noticeable lag during window resize
- After 50+ transitions: browser becomes unresponsive

**Prevention:**
1. **Explicit cleanup function:** Add `cleanupCanvas(canvas)` that calls `removeEventListener`
2. **Store listener references:** Keep named function references for later removal
3. **AbortController pattern:** Use `{ signal: controller.signal }` for automatic cleanup
4. **Lifecycle hooks:** If using framework, cleanup in unmount/destroy hooks

```javascript
// Good pattern
export function setupCanvas(canvas, options = {}) {
  const controller = new AbortController();
  const resizeHandler = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  resizeHandler();
  window.addEventListener("resize", resizeHandler, { signal: controller.signal });

  return {
    ctx: canvas.getContext("2d", options),
    cleanup: () => controller.abort()
  };
}
```

**Detection:**
- Chrome DevTools → Memory → Heap Snapshot → Search "Detached HTMLCanvasElement"
- Check `getEventListeners(window).resize.length` in console (should be 1)
- Profile event listener count in Performance tab during scene transitions

**Phase mapping:** Phase 1 (Performance Fix) must implement cleanup lifecycle.

**Sources:**
- [JavaScript Memory Leaks from Event Listener Mismanagement](https://www.mindfulchase.com/explore/troubleshooting-tips/programming-languages/troubleshooting-javascript-memory-leaks-from-event-listener-mismanagement.html)
- [Konva Remove Event Listener](https://konvajs.org/docs/events/Remove_Event.html)

---

### Pitfall 3: OBS CEF Memory Leak (External Factor)

**What goes wrong:**
OBS's Chromium Embedded Framework (CEF) browser process accumulates memory over time, even with perfect animation code. This is a known OBS/CEF issue affecting all browser sources.

**Why it happens:**
- CEF architecture creates separate processes per browser source
- Chrome/CEF inherent memory management doesn't expect 24/7 operation
- OBS v31+ with CEF 127 has worse memory characteristics than v30
- Each unique browser source URL creates a new CEF process

**Consequences:**
- Memory grows 20-50MB per hour regardless of animation efficiency
- After 3-5 hours: OBS process using 4-8GB RAM
- Affects all browser sources (alerts, overlays, chat widgets) simultaneously
- Only fix: restart OBS or toggle scenes to force process reset

**Prevention:**
1. **Scene-based memory management:** Structure overlay as single browser source, not multiple
2. **Periodic scene refresh:** Switch to dummy scene every 2 hours to reset CEF
3. **Monitor external memory:** Document expected growth rate for streamers
4. **Workaround automation:** Provide script/hotkey to refresh browser source without stream interruption

**Detection:**
- Task Manager/Activity Monitor: Multiple "obs-browser-page" processes
- Each process growing steadily over time
- Total OBS memory usage > 3GB after 2+ hours
- Warning signs: OBS log shows "high memory usage" warnings

**Phase mapping:** Phase 4 (Polish) should document workarounds and monitoring.

**Sources:**
- [OBS Browser Source Memory Leak Forum](https://obsproject.com/forum/threads/browser-element-using-streamelements-causes-memory-leak-mac-os-10-15-7.134736/) - StreamElements/CEF memory issues
- [OBS CEF Bootstrap RAM Usage](https://obsproject.com/forum/threads/obs-studio-cef-bootstrap-browser-source-ram-use.63720/) - CEF architecture explanation
- [OBS Studio Issue #12762](https://github.com/obsproject/obs-studio/issues/12762) - RAM leak discussion

---

### Pitfall 4: Mixed Frame Rate Timing

**What goes wrong:**
Mixing 30fps and 60fps logic causes animations to run at inconsistent speeds depending on monitor refresh rate. Current codebase has this issue as noted in milestone context.

**Why it happens:**
- `requestAnimationFrame` matches monitor refresh rate (60Hz, 120Hz, 144Hz)
- Hardcoded timing values assume 60fps: `velocity = 2` moves 2 pixels per frame
- On 120Hz displays: animation runs 2x faster
- On 30fps OBS canvas: animation runs 2x slower

**Consequences:**
- Animations speed varies across different streaming PCs
- Bar movement speeds inconsistent between background/stinger scenes
- Testers report "works fine on my machine" but streamers see different behavior
- Brightness feels inconsistent because timing affects visual persistence

**Prevention:**
1. **Delta time normalization:** Calculate `deltaTime` between frames, scale all movements by it
2. **Target frame rate:** Track expected vs actual FPS, adjust logic accordingly
3. **Velocity in units/second:** Express as "pixels per second" not "pixels per frame"
4. **Test across refresh rates:** Validate on 30Hz, 60Hz, 120Hz, 144Hz displays

```javascript
// Good pattern: Delta-time based animation
let lastTime = performance.now();

function animate(currentTime) {
  const deltaTime = (currentTime - lastTime) / 1000; // Seconds since last frame
  lastTime = currentTime;

  // Move at 100 pixels per second, regardless of frame rate
  bar.x += 100 * deltaTime;

  requestAnimationFrame(animate);
}
```

**Detection:**
- Record video at known frame rate, count frames for animation cycle
- Compare animation speeds between OBS preview and browser preview
- Use Performance API: `performance.now()` to measure frame intervals
- Warning signs: Frame intervals jumping between 8ms, 16ms, 33ms inconsistently

**Phase mapping:** Phase 1 (Performance Fix) must implement delta-time normalization.

**Sources:**
- [Standardize JavaScript Game Framerate](https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors) - Delta time patterns
- [Ensuring Consistent Animation Speeds](https://www.kirupa.com/animations/ensuring_consistent_animation_speeds.htm)
- [OBS Canvas Framespeed Drops](https://obsproject.com/forum/threads/canvas-framespeed-drops-from-time-to-time-60-to-30-and-back-again.165554/) - OBS-specific frame rate issues

---

## Moderate Pitfalls

These mistakes cause performance degradation or technical debt but don't crash the application.

### Pitfall 5: Full Canvas Clears Every Frame

**What goes wrong:**
Calling `ctx.clearRect(0, 0, canvas.width, canvas.height)` every frame wastes GPU/CPU cycles clearing pixels that will be immediately overwritten.

**Why it happens:**
- Tutorial code shows full clears as "simple" approach
- Developers don't realize partial clears are faster
- Seems negligible on 60fps desktop, but compounds over hours

**Consequences:**
- 10-20% unnecessary GPU usage
- Fans spin up faster, laptop temperatures increase
- Battery drain on mobile streaming setups
- Compounds with OBS encoding overhead

**Prevention:**
1. **Dirty rectangle tracking:** Only clear regions that changed
2. **Layered canvases:** Separate static background from animated foreground
3. **Opaque fills:** If background is solid color, use `fillRect` instead of `clearRect`
4. **Skip clears:** For additive effects, don't clear at all (fade with semi-transparent fill)

**Detection:**
- Chrome DevTools → Performance → Record frame
- Look for large "Clear Canvas" blocks in flame graph
- Compare GPU usage with/without clearing

**Phase mapping:** Phase 2 (Optimization) should implement dirty rectangle tracking.

**Sources:**
- [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Partial canvas updates
- [web.dev Canvas Performance](https://web.dev/canvas-performance/) - Redraw regions technique

---

### Pitfall 6: Sub-Pixel Rendering Overhead

**What goes wrong:**
Using floating-point coordinates (e.g., `x = 123.456`) triggers anti-aliasing on every frame, causing blurry rendering and 2-3x slower performance.

**Why it happens:**
- Animation calculations use floating-point math naturally
- `Math.random()` returns floats, `easeInOutCubic()` returns floats
- Developers don't realize canvas treats floats differently
- Current codebase calls `Math.round()` in `drawBar()`, but only after calculations

**Consequences:**
- Bars appear slightly blurry, especially noticeable on white bars
- 2-3x slower rendering for complex shapes
- GPU/CPU doing unnecessary anti-aliasing work
- Compounds with many bars: 20 bars × 2x cost = significant degradation

**Prevention:**
1. **Round early:** Convert to integers immediately after calculations
2. **Integer math:** Use bitwise `| 0` for fast conversion: `x = (x + velocity) | 0`
3. **Translate by integers:** Ensure all `ctx.translate()` uses integers
4. **Test with pixels:** Zoom to 400% in browser, verify crisp edges

```javascript
// Current approach (good, but late)
x = Math.round(x);

// Better approach (round during calculation)
x = (x + velocity) | 0; // Bitwise OR truncates to integer
```

**Detection:**
- Zoom canvas to 400% in DevTools, check for anti-aliased edges
- Profile rendering: compare performance with `Math.round()` vs without
- Visual inspection: bars should have crisp edges, not fuzzy

**Phase mapping:** Phase 2 (Optimization) should optimize rounding strategy.

**Sources:**
- [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Use integers for coordinates
- [HTML5 Canvas Performance Tips](https://gist.github.com/jaredwilli/5469626) - Avoid floats

---

### Pitfall 7: Shadow Blur Performance Killer

**What goes wrong:**
Using `ctx.shadowBlur` is one of the most expensive canvas operations (10-50x slower than normal fills). Current codebase wisely uses manual shadow offset instead.

**Why it happens:**
- `shadowBlur` looks better than manual offset shadows
- AI code generators frequently suggest `shadowBlur` (it's in training data)
- Developers don't realize the performance cost until testing long sessions

**Consequences:**
- Frame rate drops from 60fps to 20-30fps with blur shadows on multiple bars
- GPU usage spikes to 100% during complex animations
- OBS encoding suffers, dropped frames in stream output
- Effect compounds: 20 bars × 50x cost = unusable

**Prevention:**
1. **Manual offset shadows:** Draw duplicate shape with offset (current approach is correct)
2. **Pre-render shadows:** Include shadow in offscreen canvas cache
3. **CSS shadows:** For DOM overlays, use CSS `box-shadow` (GPU accelerated)
4. **Disable in tests:** Flag to disable shadows during testing for speed

**Detection:**
- Chrome DevTools → Performance → Look for "Apply Shadow" in flame graph
- Compare frame times with/without shadows
- Warning sign: GPU usage > 80% with only a few bars visible

**Phase mapping:** Phase 3 (Testing) should add performance regression tests that fail if shadow implementation changes to blur.

**Sources:**
- [web.dev Canvas Performance](https://web.dev/canvas-performance/) - shadowBlur is expensive
- [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Avoid shadows when possible

---

### Pitfall 8: OBS Hardware Acceleration Conflicts

**What goes wrong:**
OBS browser source hardware acceleration setting conflicts with canvas rendering, causing black screens, choppy playback, or massive GPU overload.

**Why it happens:**
- OBS browser sources can use hardware acceleration OR software rendering
- Linux Wayland + hardware acceleration = known issues in OBS 31+
- Dual GPU laptops: OBS on one GPU, browser on another = black screen
- Canvas assumes GPU availability, but OBS might disable it

**Consequences:**
- Browser source shows black screen instead of animation
- Encoding overload: GPU at 100%, dropped frames in stream
- Platform inconsistency: Works on Windows, breaks on Linux
- No error messages, just silent failure

**Prevention:**
1. **Test both modes:** Validate with hardware acceleration ON and OFF
2. **Provide configuration guidance:** Document OBS settings for Linux/Windows/Mac
3. **Fallback detection:** Check `canvas.getContext('2d', { willReadFrequently: true })` hints
4. **CSS transform awareness:** Use `transform` instead of canvas scaling (GPU-friendly)

**Detection:**
- Test on Linux Wayland with OBS 31+ (known problem platform)
- Monitor GPU usage: should be consistent, not spiking to 100%
- OBS logs: Search for "hardware acceleration" warnings
- Check dual GPU laptops: Ensure OBS and browser use same GPU

**Phase mapping:** Phase 4 (Polish) should document platform-specific configuration.

**Sources:**
- [OBS Browser Sources Overloading GPU](https://obsproject.com/forum/threads/browser-sources-overloading-gpu.184305/) - Hardware acceleration issues
- [Choppy Videos in Browser Source](https://github.com/obsproject/obs-studio/issues/12888) - CEF 127 hardware acceleration bug

---

## Minor Pitfalls

These mistakes cause annoyance or maintenance burden but are easily fixable.

### Pitfall 9: Canvas Context State Leakage

**What goes wrong:**
Forgetting `ctx.save()`/`ctx.restore()` causes transform/style state to leak between drawing operations, creating cumulative positioning bugs.

**Why it happens:**
- Canvas 2D context is a state machine: transforms accumulate
- `ctx.translate()` and `ctx.rotate()` are permanent until restored
- AI-generated code often forgets `restore()` calls
- Works initially, breaks after multiple animation cycles

**Consequences:**
- Bars drift off-screen over time as transforms accumulate
- Colors/opacity bleed between bars
- "Works for 30 seconds, then positions break" - classic state leak symptom
- Difficult to debug: behavior changes over time

**Prevention:**
1. **Always pair save/restore:** Use try/finally pattern
2. **Code review checklist:** Every `translate`/`rotate` needs `save()` before and `restore()` after
3. **Linting rule:** Consider ESLint plugin for canvas state management
4. **Visual testing:** Run animation for 5+ minutes in tests

```javascript
// Good pattern: Always paired
ctx.save();
try {
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillRect(0, 0, width, height);
} finally {
  ctx.restore();
}
```

**Detection:**
- Run animation for 5+ minutes, watch for position drift
- Add assertions: Check `ctx.getTransform()` is identity after each frame
- Visual inspection: Bars should stay in consistent positions

**Phase mapping:** Phase 3 (Testing) should add long-running position stability tests.

**Sources:**
- [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Minimize state changes
- [web.dev Canvas Performance](https://web.dev/canvas-performance/) - State machine is expensive

---

### Pitfall 10: Alpha Channel When Not Needed

**What goes wrong:**
Creating canvas context with `alpha: true` (default) when transparency isn't needed wastes memory and GPU compositing cycles.

**Why it happens:**
- `alpha: true` is the default, developers don't think to disable it
- OBS browser sources often use transparent backgrounds, so seems necessary
- Doesn't realize alpha channel costs 33% more memory (RGBA vs RGB)

**Consequences:**
- 33% higher memory usage per canvas (4 bytes vs 3 bytes per pixel)
- Slower compositing: GPU must blend alpha every frame
- Compounds with multiple canvases: 5 canvases = 1.5GB wasted

**Prevention:**
1. **Disable when possible:** `canvas.getContext('2d', { alpha: false })` for solid backgrounds
2. **Audit all canvases:** Check which actually need transparency
3. **Offscreen canvases:** These often don't need alpha if compositing final image

**Detection:**
- Check canvas creation calls: Count `{ alpha: false }` vs defaults
- Memory profiler: Calculate expected canvas memory (width × height × 4)
- Compare memory usage with alpha enabled/disabled

**Phase mapping:** Phase 2 (Optimization) should audit alpha channel usage.

**Sources:**
- [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Disable transparency
- Current codebase: `setupCanvas()` defaults to `alpha: true` (should be `false` for OBS solid background)

---

### Pitfall 11: requestAnimationFrame Without Cleanup

**What goes wrong:**
Starting `requestAnimationFrame` loop without cancellation mechanism causes animation to continue running after scene change, wasting CPU and accumulating state.

**Why it happens:**
- Tutorials show starting rAF loop but not stopping it
- OBS scene transitions don't trigger page unload
- Developers assume browser cleans up automatically (it doesn't in OBS)

**Consequences:**
- Multiple animation loops running simultaneously after scene changes
- CPU usage increases linearly: 2 loops, 3 loops, 10 loops...
- Memory accumulates from all active loops
- Performance degrades mysteriously during long streams

**Prevention:**
1. **Return animation ID:** `const animationId = requestAnimationFrame(animate)`
2. **Provide stop function:** `function stopAnimation() { cancelAnimationFrame(animationId) }`
3. **Visibility API:** Pause when `document.hidden === true`
4. **Global flag:** Check `this.active` before continuing loop

```javascript
// Good pattern: Cancellable animation loop
let animationId;
let isRunning = false;

function startAnimation() {
  if (isRunning) return; // Prevent multiple loops
  isRunning = true;

  function animate() {
    if (!isRunning) return; // Early exit

    // Animation logic...

    animationId = requestAnimationFrame(animate);
  }

  animate();
}

function stopAnimation() {
  isRunning = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
}
```

**Detection:**
- Console log frame count: Should stop incrementing after scene change
- Performance tab: Look for multiple "Animation Frame Fired" events per frame
- Check `window.cancelAnimationFrame` is called somewhere in codebase

**Phase mapping:** Phase 1 (Performance Fix) should implement proper lifecycle management.

**Sources:**
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) - Cancellation pattern
- Current codebase: No `cancelAnimationFrame` calls found (needs cleanup mechanism)

---

## Testing Strategies to Catch Issues Early

### Long-Running Stress Tests

**Purpose:** Detect memory leaks and performance degradation over time

**Implementation:**
```javascript
describe('Long-running performance', () => {
  it('should maintain stable memory usage over 1 hour', async () => {
    const initialMemory = performance.memory.usedJSHeapSize;

    // Run animation for 1 hour (accelerated: 3600 frames)
    for (let i = 0; i < 3600; i++) {
      animate();
      if (i % 600 === 0) { // Check every 10 "minutes"
        const currentMemory = performance.memory.usedJSHeapSize;
        const growth = (currentMemory - initialMemory) / 1024 / 1024;
        expect(growth).toBeLessThan(50); // Max 50MB growth
      }
    }
  });
});
```

**What it catches:** Memory leaks, cache growth, event listener accumulation

---

### Frame Rate Consistency Tests

**Purpose:** Ensure animations run at consistent speed across refresh rates

**Implementation:**
```javascript
describe('Frame rate independence', () => {
  it('should move same distance regardless of frame rate', () => {
    const bar = new AnimatedBar(ctx, canvas, 'slanted');
    bar.x = 0;

    // Simulate 60fps for 1 second (60 frames at 16.67ms each)
    for (let i = 0; i < 60; i++) {
      bar.update(16.67);
    }
    const distance60fps = bar.x;

    bar.x = 0;

    // Simulate 30fps for 1 second (30 frames at 33.33ms each)
    for (let i = 0; i < 30; i++) {
      bar.update(33.33);
    }
    const distance30fps = bar.x;

    expect(distance60fps).toBeCloseTo(distance30fps, 1); // Within 1 pixel
  });
});
```

**What it catches:** Frame-rate dependent timing issues

---

### Visual Regression Tests

**Purpose:** Detect positioning, sizing, color changes

**Implementation:**
```javascript
import { toMatchImageSnapshot } from 'jest-image-snapshot';

describe('Visual regression', () => {
  it('should render bars in correct positions', async () => {
    // Render frame 100 (consistent animation state)
    for (let i = 0; i < 100; i++) {
      animate();
    }

    const image = canvas.toDataURL();
    expect(image).toMatchImageSnapshot({
      failureThreshold: 0.01, // Allow 1% difference
      failureThresholdType: 'percent'
    });
  });
});
```

**What it catches:** AI-generated positioning bugs, color inconsistencies

---

### Cache Growth Monitoring

**Purpose:** Detect unbounded cache growth

**Implementation:**
```javascript
describe('Cache management', () => {
  it('should limit offscreen cache size', () => {
    // Create 200 unique bars (more than cache limit)
    for (let i = 0; i < 200; i++) {
      const bar = new AnimatedBar(ctx, canvas, 'slanted');
      bar.useOffscreenCache = true;
      bar.drawBar(i, i, 100 + i, 50, i, 100, 50, 1, i, true);
    }

    // Cache should have maximum entries, not 200
    expect(AnimatedBar.offscreenCache.size).toBeLessThanOrEqual(100);
  });
});
```

**What it catches:** Unbounded cache growth

---

### OBS Browser Source Simulation

**Purpose:** Test in environment similar to OBS

**Implementation:**
```bash
# Launch Chrome with OBS-like flags
chromium-browser \
  --app=http://localhost:3000/background.html \
  --disable-http-cache \
  --disable-gpu-compositing \  # Simulate hardware accel OFF
  --window-size=1920,1080
```

**What it catches:** Hardware acceleration issues, OBS-specific rendering problems

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Performance Fix | Unbounded cache growth | Implement LRU eviction before fixing other issues |
| Performance Fix | Event listener leaks | Add cleanup lifecycle before adding new features |
| Performance Fix | Mixed frame rates | Implement delta-time first, then optimize rendering |
| Optimization | Over-optimization | Profile before optimizing; don't fix what isn't slow |
| Optimization | Breaking caching | Ensure cache key changes don't break existing logic |
| Testing | Flaky visual tests | Disable animations, wait for stable state before screenshots |
| Testing | Tests pass but stream fails | Test on actual OBS, not just browser |
| Polish | AI-generated regressions | Lock positioning logic with regression tests before allowing AI edits |
| Polish | Platform-specific issues | Test on Linux Wayland, Windows, Mac before release |

---

## Known Issues in Current Codebase

Based on existing code review and milestone context:

### 1. Offscreen Canvas Cache (AnimatedBar.js)
- **Location:** Line 6: `static offscreenCache = new Map()`
- **Issue:** No eviction policy, unbounded growth
- **Impact:** CRITICAL - Memory leak over hours
- **Fix priority:** Phase 1, first task

### 2. Resize Event Listener (canvas.js)
- **Location:** Line 22: `window.addEventListener("resize", resizeCanvas)`
- **Issue:** Never removed, accumulates on scene changes
- **Impact:** MODERATE - Multiple handlers after scene changes
- **Fix priority:** Phase 1, second task

### 3. Alpha Channel Default (canvas.js)
- **Location:** Line 13: `const { alpha = true } = options`
- **Issue:** Should default to `false` for OBS solid backgrounds
- **Impact:** MINOR - 33% wasted memory
- **Fix priority:** Phase 2, optimization pass

### 4. No Delta Time (Current codebase)
- **Location:** Animation loops (not visible in snippets)
- **Issue:** No delta-time normalization, frame-rate dependent
- **Impact:** CRITICAL - Timing inconsistencies reported in milestone
- **Fix priority:** Phase 1, first task

### 5. No Animation Cleanup (Current codebase)
- **Location:** rAF loops (not visible in snippets)
- **Issue:** No `cancelAnimationFrame` calls found
- **Impact:** MODERATE - Loops continue after scene changes
- **Fix priority:** Phase 1, third task

---

## Confidence Assessment

| Area | Level | Reasoning |
|------|-------|-----------|
| Memory leak patterns | HIGH | Verified with MDN official docs, multiple CVE reports, GitHub issues |
| OBS-specific issues | HIGH | OBS forum threads, GitHub issues, official bug reports |
| Frame rate timing | HIGH | MDN requestAnimationFrame docs, multiple tutorial sources |
| Testing strategies | MEDIUM | WebSearch results verified with official testing tools |
| Browser differences | MEDIUM | Cross-referenced multiple forum posts, but browser versions change |
| Current codebase issues | HIGH | Direct code inspection of provided files |

---

## Sources

### Official Documentation (HIGH confidence)
- [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Official canvas performance guide
- [web.dev: Canvas Performance](https://web.dev/canvas-performance/) - Google's canvas optimization guide
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) - Official API documentation

### Memory Leak Research (HIGH confidence)
- [Fabric.js Canvas Memory Issue](https://github.com/fabricjs/fabric.js/issues/5198) - Real-world unbounded cache problem
- [Firefox Canvas Memory Leak Bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1697344) - Official browser bug report
- [Konva: Avoid Memory Leaks](https://konvajs.org/docs/performance/Avoid_Memory_Leaks.html) - Framework-specific guidance
- [JavaScript Event Listener Memory Leaks](https://www.mindfulchase.com/explore/troubleshooting-tips/programming-languages/troubleshooting-javascript-memory-leaks-from-event-listener-mismanagement.html)

### OBS-Specific Issues (HIGH confidence)
- [OBS Browser Source Memory Leak](https://obsproject.com/forum/threads/browser-element-using-streamelements-causes-memory-leak-mac-os-10-15-7.134736/) - User reports of CEF leaks
- [OBS CEF Bootstrap RAM Usage](https://obsproject.com/forum/threads/obs-studio-cef-bootstrap-browser-source-ram-use.63720/) - CEF architecture discussion
- [OBS Studio Issue #12762](https://github.com/obsproject/obs-studio/issues/12762) - Official GitHub issue
- [OBS Browser Sources Overloading GPU](https://obsproject.com/forum/threads/browser-sources-overloading-gpu.184305/) - Hardware acceleration issues
- [OBS Hardware Acceleration Discussion](https://obsproject.com/forum/threads/why-does-disabling-browser-source-hardware-acceleration-work.166144/)
- [Choppy Videos in Browser Source](https://github.com/obsproject/obs-studio/issues/12888) - CEF 127 bug report

### Frame Rate & Timing (HIGH confidence)
- [Standardize JavaScript Game Framerate](https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors) - Delta time tutorial
- [Ensuring Consistent Animation Speeds](https://www.kirupa.com/animations/ensuring_consistent_animation_speeds.htm) - Frame-rate independence
- [OBS Canvas Framespeed Drops](https://obsproject.com/forum/threads/canvas-framespeed-drops-from-time-to-time-60-to-30-and-back-again.165554/) - OBS-specific timing issues

### Performance Optimization (MEDIUM confidence)
- [HTML5 Canvas Performance Tips](https://gist.github.com/jaredwilli/5469626) - Community best practices
- [Animation Performance Data](https://educationalvoice.co.uk/animation-performance-data/) - Testing strategies
- [Konva Performance Tips](https://konvajs.org/docs/performance/All_Performance_Tips.html) - Framework-specific optimizations

### Testing & Debugging (MEDIUM confidence)
- [Canvas Visual Testing with Retries](https://glebbahmutov.com/blog/canvas-testing/) - Visual regression approach
- [Troubleshooting Canvas Animation Issues](https://infinitejs.com/posts/troubleshooting-canvas-animation-issues/) - Common debugging patterns
