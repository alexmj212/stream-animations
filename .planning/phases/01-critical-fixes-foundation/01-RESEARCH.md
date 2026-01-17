# Phase 1: Critical Fixes & Foundation - Research

**Researched:** 2026-01-17
**Domain:** Canvas animation timing, memory management, JavaScript configuration patterns
**Confidence:** HIGH

## Summary

This phase addresses production-critical bugs in canvas-based OBS browser source animations: memory leaks from unbounded cache growth, timing inconsistencies across different refresh rates (30Hz/60Hz/120Hz), and maintainability issues from scattered magic numbers. The research focused on three core domains: delta-time animation systems for frame-rate independence, memory management strategies for canvas caches and event listeners, and JavaScript configuration patterns with validation.

**Key findings:**
- Delta-time based animation using `requestAnimationFrame` timestamp parameter is the standard approach for frame-rate independence, ensuring consistent animation speeds across 60Hz, 120Hz, and higher refresh rate displays
- `AbortController` with `addEventListener({ signal })` is the modern, recommended pattern for guaranteed event listener cleanup without requiring function references
- Simple Map-based LRU cache with time-based eviction provides O(1) performance for small-to-medium cache sizes without external dependencies
- Pure JavaScript configuration files (`.js` not `.json`) enable comments, computed values, and better developer experience
- Lightweight validation using plain JavaScript functions with graceful defaults is sufficient for configuration validation without adding dependencies

**Primary recommendation:** Implement delta-time multiplier system with `requestAnimationFrame` timestamp, use Map-based LRU cache with periodic time-based cleanup, employ `AbortController` for all event listeners, and create JavaScript config file with inline validation and default values.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| requestAnimationFrame | Native Browser API | Frame-synchronized animation timing | Standard Web API since 2015, ensures animations sync with display refresh rate |
| performance.now() | Native Browser API | High-resolution timestamps | DOMHighResTimeStamp with microsecond precision, essential for delta-time calculations |
| AbortController | Native Browser API | Event listener lifecycle management | Modern standard (2019+), cleaner than removeEventListener pattern |
| Map | Native ES6 | Cache storage with insertion-order preservation | Built-in, O(1) lookups, maintains insertion order for LRU eviction |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.x | Testing framework | Already in project, supports jsdom for canvas testing |
| Performance API | Native Browser API | Memory usage monitoring | Available in browsers, use for dev-mode tracking only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Delta-time multiplier | Fixed frame rate with frame skipping | Fixed rate is simpler but delta-time handles variable refresh rates better |
| Map-based LRU | lru-cache npm package | Package is more feature-rich but adds dependency for simple use case |
| Pure JS validation | Zod/Joi schema library | Schema libraries offer more features but add 8-45kb bundle size for validation not needed client-side |
| JavaScript config | JSON config | JSON can't have comments or computed values, worse DX |

**Installation:**
```bash
# No additional packages needed - using native browser APIs
# Existing dependencies sufficient (vitest already installed)
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── config/
│   ├── config.js           # Main configuration file (JavaScript, not JSON)
│   └── validation.js       # Validation functions with defaults
├── shared/
│   ├── AnimatedBar.js      # (existing) Base animation class
│   ├── timing.js           # Delta-time utilities
│   ├── cache.js            # LRU cache manager
│   └── lifecycle.js        # AbortController utilities
├── background/
│   └── index.html          # (existing) Scene entry point
└── ...
```

### Pattern 1: Delta-Time Animation Loop
**What:** Use `requestAnimationFrame` timestamp parameter to calculate elapsed time and multiply all movement/animation values by delta-time factor

**When to use:** All animation loops that need consistent speed across different refresh rates

**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
let lastTimestamp = 0;

function animate(timestamp) {
  // timestamp is DOMHighResTimeStamp in milliseconds
  if (lastTimestamp === 0) {
    lastTimestamp = timestamp;
  }

  // Calculate delta in seconds for smoother values
  const deltaTime = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  // Apply delta-time multiplier to all movements
  // baseSpeed is in pixels per second
  const movement = baseSpeed * deltaTime;
  x += movement;

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
```

**Critical:** Never use fixed values per frame (e.g., `x += 5`) as this runs 2x faster on 120Hz vs 60Hz displays.

### Pattern 2: AbortController for Event Listeners
**What:** Pass `AbortSignal` to `addEventListener` options, then call `abort()` to automatically remove all listeners without function references

**When to use:** All event listener registration, especially in OBS browser sources that reload scenes

**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
const controller = new AbortController();
const signal = controller.signal;

// Add multiple listeners with same signal
window.addEventListener('resize', handleResize, { signal });
document.addEventListener('visibilitychange', handleVisibility, { signal });
canvas.addEventListener('webglcontextlost', handleContextLost, { signal });

// Single abort removes ALL listeners
function cleanup() {
  controller.abort();
  // All three event listeners automatically removed
}

// In OBS context, call cleanup when scene is unloaded
window.addEventListener('beforeunload', cleanup, { once: true });
```

### Pattern 3: Map-Based LRU Cache with Time Tracking
**What:** Use native Map with timestamps to track access times, periodically evict least-recently-used entries when size exceeds threshold

**When to use:** Caching offscreen canvases or other expensive-to-create objects with bounded memory requirements

**Example:**
```javascript
// Simple LRU cache using Map's insertion-order guarantee
class LRUCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessTimes = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;

    // Update access time
    this.accessTimes.set(key, Date.now());

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  set(key, value) {
    // Delete if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end (most recently used)
    this.cache.set(key, value);
    this.accessTimes.set(key, Date.now());

    // Evict oldest if over size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.accessTimes.delete(firstKey);
    }
  }

  // Time-based cleanup: remove entries unused for X milliseconds
  evictStale(maxAgeMs = 60000) {
    const now = Date.now();
    for (const [key, accessTime] of this.accessTimes) {
      if (now - accessTime > maxAgeMs) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
    this.accessTimes.clear();
  }

  get size() {
    return this.cache.size;
  }
}
```

### Pattern 4: JavaScript Configuration with Inline Validation
**What:** Export configuration as JavaScript object with comments, computed values, and inline validation function

**When to use:** Any project configuration that benefits from comments and type safety

**Example:**
```javascript
// config/config.js
export const config = {
  // Background scene configuration
  background: {
    // Animation speeds in pixels per second (not per frame!)
    baseSpeed: {
      min: 10,    // Slowest bar movement (px/sec)
      max: 100,   // Fastest bar movement (px/sec)
      default: 50 // Default speed multiplier
    },

    // Cache settings
    cache: {
      maxSize: 100,              // Maximum cached offscreen canvases
      evictionIntervalMs: 30000, // Clean stale caches every 30 seconds
      maxAgeMs: 60000           // Evict caches unused for 60 seconds
    },

    // Canvas coordinate system: origin at top-left, +X right, +Y down
    positions: {
      offscreenLeft: -300,  // Start position for bars entering from left
      offscreenRight: 1920 + 300 // Start position for bars entering from right (canvas.width + margin)
    }
  },

  // Shared configuration
  shared: {
    performance: {
      enableMonitoring: false, // Set to true for dev mode (query param ?perf=true)
      sampleSize: 60          // Frame samples for FPS calculation
    }
  }
};

// Validation with defaults
export function validateConfig(userConfig, defaults) {
  const validated = {};

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const userValue = userConfig?.[key];

    if (userValue === undefined) {
      validated[key] = defaultValue;
      continue;
    }

    // Type validation
    if (typeof userValue !== typeof defaultValue) {
      console.warn(`Config validation: ${key} should be ${typeof defaultValue}, got ${typeof userValue}. Using default.`);
      validated[key] = defaultValue;
      continue;
    }

    // Range validation for numbers
    if (typeof defaultValue === 'number' && typeof userValue === 'number') {
      if (!isFinite(userValue) || userValue < 0) {
        console.warn(`Config validation: ${key} must be positive finite number. Using default.`);
        validated[key] = defaultValue;
        continue;
      }
    }

    // Recursive validation for nested objects
    if (typeof defaultValue === 'object' && defaultValue !== null) {
      validated[key] = validateConfig(userValue, defaultValue);
      continue;
    }

    validated[key] = userValue;
  }

  return validated;
}
```

### Anti-Patterns to Avoid
- **Frame-counting for timing:** Using frame counters (`frameCount++`) instead of delta-time makes animations frame-rate dependent
- **setInterval/setTimeout for animation:** These don't sync with display refresh, cause jank, and waste CPU in background tabs
- **Storing event listeners for manual cleanup:** `removeEventListener` requires exact function reference; use `AbortController` instead
- **JSON configuration files:** Cannot include comments, require separate schema file, worse developer experience
- **Unbounded Map/cache growth:** Without size limits or eviction, caches grow indefinitely and cause memory exhaustion

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animation frame timing | Custom setInterval with frame counting | requestAnimationFrame with timestamp | Browser-optimized, syncs with refresh rate, pauses in background tabs, widely supported since 2015 |
| High-resolution timestamps | Date.now() or new Date() | performance.now() | Microsecond precision, monotonic (not affected by system clock changes), essential for smooth delta-time |
| Event listener cleanup | Manual tracking of listener functions | AbortController with signal option | No function references needed, cleanup multiple listeners at once, prevents memory leaks, standard since 2019 |
| Schema validation for simple config | Custom validation or Zod/Joi | Plain JavaScript functions with graceful defaults | No bundle size impact, sufficient for client-side config, easier to debug |

**Key insight:** Browser APIs have evolved significantly for animation and lifecycle management. Modern patterns (requestAnimationFrame timestamps, AbortController) are simpler and more robust than older approaches (setInterval, manual removeEventListener). The "don't hand-roll" advice applies to timing primitives, not the higher-level patterns (delta-time system, LRU cache) which should be custom-built to project requirements.

## Common Pitfalls

### Pitfall 1: Forgetting to Use Delta-Time Multiplier
**What goes wrong:** Animations run at different speeds on 60Hz vs 120Hz vs 144Hz displays, making the experience inconsistent for viewers with high-refresh-rate monitors.

**Why it happens:** `requestAnimationFrame` callbacks are invoked once per display refresh. On a 60Hz monitor, this is ~16.67ms intervals. On a 120Hz monitor, this is ~8.33ms intervals. Code like `x += 5` runs twice as often on 120Hz, making movement twice as fast.

**How to avoid:**
1. Always accept and use the `timestamp` parameter from `requestAnimationFrame`
2. Calculate delta-time in seconds: `deltaTime = (timestamp - lastTimestamp) / 1000`
3. Define all speeds in "per second" units, not "per frame"
4. Multiply all movement by delta-time: `x += speedPerSecond * deltaTime`

**Warning signs:**
- Animations look "correct" in development but users report different speeds
- Testing on different monitors shows inconsistent behavior
- Math uses fixed constants like `x += 5` instead of time-based values

### Pitfall 2: requestAnimationFrame Timestamp Reset on Tab Switch
**What goes wrong:** When user switches browser tabs, `requestAnimationFrame` pauses. On tab return, the next timestamp shows a large elapsed time (seconds or minutes), causing animations to "jump" forward or objects to teleport across the screen.

**Why it happens:** `requestAnimationFrame` automatically pauses in background tabs for performance. When tab becomes visible again, the timestamp continues from where the global timer left off, creating a massive delta-time spike.

**How to avoid:**
```javascript
// Cap delta-time to prevent tab-switch spikes
const MAX_DELTA_TIME = 0.1; // 100ms cap (10 FPS minimum)

function animate(timestamp) {
  const rawDelta = (timestamp - lastTimestamp) / 1000;
  const deltaTime = Math.min(rawDelta, MAX_DELTA_TIME);
  lastTimestamp = timestamp;

  // Now safe from tab-switch jumps
  updateAnimations(deltaTime);
  requestAnimationFrame(animate);
}
```

**Warning signs:**
- Animations work perfectly until you switch tabs and return
- Objects "teleport" or "jump" after tab becomes visible again
- Delta-time calculations occasionally show values like 30+ seconds

### Pitfall 3: Canvas Memory Leaks from Unbounded Cache
**What goes wrong:** Each offscreen canvas consumes significant memory (width × height × 4 bytes for RGBA). Without eviction, cache grows indefinitely, eventually causing browser to kill the tab with "Out of Memory" error. In OBS, this manifests as crashes during long streams (8+ hours).

**Why it happens:** `AnimatedBar.offscreenCache` is a static Map that persists across all bar instances. Every unique bar configuration creates a new cache entry. With random variations in size, color, and angle, unique combinations grow unbounded.

**How to avoid:**
1. Implement LRU eviction: limit cache to reasonable size (50-100 entries)
2. Add time-based cleanup: evict entries unused for 60+ seconds
3. Periodic cleanup: run eviction every 30 seconds via `setInterval`
4. Monitor cache size in dev mode: log cache.size periodically

**Warning signs:**
- Memory usage grows steadily over time without plateauing
- Browser DevTools memory profiler shows offscreen canvas allocations increasing
- Crashes occur after several hours of continuous animation
- Cache size continues growing past initial startup period

### Pitfall 4: Event Listeners Not Cleaned Up on Scene Reload
**What goes wrong:** In OBS, when switching scenes, the browser source may reload or become inactive. Event listeners attached to `window`, `document`, or canvas remain active, creating memory leaks and potential duplicate handlers if scene is reloaded.

**Why it happens:** Unlike React components, plain HTML pages don't have automatic cleanup lifecycle. Event listeners persist until explicitly removed or page is fully unloaded. OBS browser sources can remain in memory even when scene is hidden.

**How to avoid:**
```javascript
// Create single AbortController for all listeners
const cleanupController = new AbortController();
const signal = cleanupController.signal;

// Add all event listeners with same signal
window.addEventListener('resize', handleResize, { signal });
document.addEventListener('visibilitychange', handleVisibility, { signal });

// Cleanup on beforeunload
window.addEventListener('beforeunload', () => {
  cleanupController.abort(); // Removes ALL listeners at once
}, { once: true }); // Use once:true for cleanup listener itself
```

**Warning signs:**
- Memory usage doesn't decrease when switching away from scene
- Console logs show duplicate events firing after scene reload
- Performance degrades over time with multiple scene switches
- Event handlers reference old canvas contexts or DOM elements

### Pitfall 5: Mixed Frame Rate System Creating Timing Drift
**What goes wrong:** Current code updates background layer every 2 frames (30fps) and foreground every frame (60fps) using frame counting. This creates timing inconsistencies because frame counting doesn't account for variable frame times. On a 120Hz display, "every 2 frames" is still 60fps, not 30fps as intended.

**Why it happens:** Code uses `frameCount % 2 === 0` pattern, which counts frames not time. Frame duration varies by display refresh rate.

**How to avoid:**
```javascript
// Time-based layer updates instead of frame-based
let backgroundLastUpdate = 0;
const BACKGROUND_UPDATE_INTERVAL = 1000 / 30; // 30fps in milliseconds

function animate(timestamp) {
  // Always update foreground (60fps)
  updateForeground(deltaTime);

  // Update background only if enough time elapsed
  if (timestamp - backgroundLastUpdate >= BACKGROUND_UPDATE_INTERVAL) {
    updateBackground(deltaTime);
    backgroundLastUpdate = timestamp;
  }

  requestAnimationFrame(animate);
}
```

**Better approach for this project:** Unify to single frame rate with delta-time. Mixed frame rates add complexity without meaningful performance benefit for this use case.

**Warning signs:**
- Animation speeds differ between background and foreground layers
- Frame skip pattern works on 60Hz but breaks on 120Hz displays
- Timing feels "off" or "jittery" on high refresh rate monitors

### Pitfall 6: Validation That Fails Silently
**What goes wrong:** Configuration validation detects invalid values but throws errors, causing entire application to fail. Alternatively, invalid values are silently accepted, causing undefined behavior or visual glitches.

**Why it happens:** Missing graceful degradation strategy. Validation is often binary: valid or error.

**How to avoid:**
```javascript
// Validate with logging and default fallback
function validateNumber(value, defaultValue, min = 0, max = Infinity, label = 'value') {
  if (typeof value !== 'number' || !isFinite(value)) {
    console.warn(`Config: ${label} must be a finite number, got ${value}. Using default: ${defaultValue}`);
    return defaultValue;
  }

  if (value < min || value > max) {
    console.warn(`Config: ${label} must be between ${min} and ${max}, got ${value}. Using default: ${defaultValue}`);
    return defaultValue;
  }

  return value;
}

// Application continues working with defaults, developer sees warning in console
```

**Warning signs:**
- Application crashes on invalid config instead of logging warning
- Invalid config values cause visual glitches without any console output
- No way to know if config is being applied vs falling back to defaults

## Code Examples

Verified patterns from official sources:

### Delta-Time Animation Loop
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
// Source: https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors

class DeltaTimeAnimation {
  constructor() {
    this.lastTimestamp = 0;
    this.maxDeltaTime = 0.1; // Cap at 100ms to prevent tab-switch jumps
  }

  start() {
    requestAnimationFrame(this.animate.bind(this));
  }

  animate(timestamp) {
    // Calculate delta-time in seconds
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
    }

    const rawDelta = (timestamp - this.lastTimestamp) / 1000;
    const deltaTime = Math.min(rawDelta, this.maxDeltaTime);
    this.lastTimestamp = timestamp;

    // Update all animations with delta-time
    this.update(deltaTime);
    this.render();

    requestAnimationFrame(this.animate.bind(this));
  }

  update(deltaTime) {
    // All speeds are in "per second" units
    const speedPerSecond = 100; // pixels per second
    this.x += speedPerSecond * deltaTime;
  }

  render() {
    // Drawing logic
  }
}
```

### Performance Monitor (Already in Codebase)
```javascript
// Source: /home/alex/Projects/stream-animations/src/shared/performance.js
// Note: Existing implementation uses performance.now() for frame time tracking
// This is correct pattern - keep using performance.now() not Date.now()

// Usage pattern for dev mode only
const urlParams = new URLSearchParams(window.location.search);
const showPerf = urlParams.get('perf') === 'true';

const perfMonitor = new PerformanceMonitor(60);
if (showPerf) {
  perfMonitor.enable();
  setInterval(() => perfMonitor.logStats(), 2000);
}

// In animation loop
function animate(timestamp) {
  perfMonitor.recordFrame(); // Only measures when enabled
  // ... rest of animation
}
```

### AbortController for Multiple Listeners
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
// Source: https://kettanaito.com/blog/dont-sleep-on-abort-controller

class AnimationLifecycle {
  constructor(canvas) {
    this.canvas = canvas;
    this.controller = new AbortController();
    this.signal = this.controller.signal;
    this.setupListeners();
  }

  setupListeners() {
    // All listeners use same signal
    window.addEventListener('resize', this.handleResize.bind(this), {
      signal: this.signal
    });

    document.addEventListener('visibilitychange', this.handleVisibility.bind(this), {
      signal: this.signal
    });

    this.canvas.addEventListener('webglcontextlost', this.handleContextLost.bind(this), {
      signal: this.signal
    });

    // Setup cleanup on beforeunload
    window.addEventListener('beforeunload', this.cleanup.bind(this), {
      once: true, // Cleanup listener removes itself
      signal: this.signal
    });
  }

  cleanup() {
    // Single abort removes ALL listeners
    this.controller.abort();
    console.log('All event listeners cleaned up');
  }

  handleResize() { /* ... */ }
  handleVisibility() { /* ... */ }
  handleContextLost() { /* ... */ }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| setInterval for animation | requestAnimationFrame with delta-time | ~2015 (rAF stable across browsers) | 60% less CPU usage, perfect frame sync, automatic background tab throttling |
| Frame counting for timing | Timestamp-based delta-time | ~2018 (high refresh rates common) | Consistent animation speeds across 60Hz/120Hz/144Hz displays |
| removeEventListener cleanup | AbortController with signal option | March 2019 (baseline support) | No function reference needed, cleanup multiple listeners at once, prevents leaks |
| Date.now() for timing | performance.now() | ~2015 (Performance API stable) | Microsecond precision, monotonic clock unaffected by system time changes |
| JSON config files | JavaScript config files | ~2020 (ES modules widely supported) | Comments, computed values, better IDE support, type safety |
| External validation libraries | Plain JavaScript with defaults | Ongoing (bundle size concerns) | Zero bundle size impact for client-side config, easier to debug |

**Deprecated/outdated:**
- **setInterval/setTimeout for animation loops:** Replaced by `requestAnimationFrame`. Modern approach syncs with display refresh, reduces CPU usage, and automatically throttles in background tabs.
- **Frame counting for cross-browser consistency:** Replaced by delta-time calculation. High refresh rate displays (120Hz+) are now common, making frame-based timing inconsistent.
- **Manual removeEventListener patterns:** Replaced by `AbortController`. Modern approach eliminates need to store function references and guarantees cleanup.
- **window.requestAnimationFrame polyfills:** No longer needed. Baseline support since July 2015 across all major browsers.

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal cache size threshold for OBS browser source**
   - What we know: Offscreen canvases consume width × height × 4 bytes. Typical bar cache entry is 200×800 pixels = ~640KB per canvas. With 100 entry limit, max cache is ~64MB.
   - What's unclear: OBS browser source memory limits vary by system. No official documentation on Chromium Embedded Framework memory caps in OBS context.
   - Recommendation: Start with 50 entry limit (conservative ~32MB max), add cache size monitoring in dev mode, adjust based on real-world testing during 8-hour stream sessions. Test with query parameter to override: `?cacheSize=100`

2. **Time-based vs size-based cache eviction priority**
   - What we know: LRU eviction (size-based) prevents unbounded growth. Time-based eviction (stale cleanup) reduces memory for long-running sessions. Both are needed.
   - What's unclear: Optimal balance between the two strategies. Should time-based cleanup be aggressive (30 second max age) or conservative (60+ seconds)?
   - Recommendation: Implement both with configurable thresholds. Start conservative (60 second max age, 100 entry size limit), add monitoring to measure hit rates and eviction frequency. Adjust based on data.

3. **Performance impact of unified frame rate vs mixed frame rate**
   - What we know: Current code uses 30fps background / 60fps foreground split via frame counting. This is meant to reduce canvas clears for performance.
   - What's unclear: Whether this optimization is meaningful for this workload. Modern browsers and OBS's Chromium instance may handle 60fps uniform updates efficiently. Mixed rates add timing complexity and are frame-rate dependent.
   - Recommendation: **Remove mixed frame rate system in Phase 1.** Simplify to unified 60fps with delta-time. If performance testing in Phase 3 shows issues, revisit with proper time-based (not frame-based) throttling.

4. **Dev mode detection approach**
   - What we know: Performance monitoring should only run in development. Current code uses URL query parameter `?perf=true`.
   - What's unclear: Whether query parameter is sufficient or if we need additional detection (localStorage flag, separate dev build, etc.).
   - Recommendation: Keep URL query parameter approach for Phase 1 (simple, explicit, works in OBS). Consider adding localStorage persistence in Phase 4 if needed: first visit with `?perf=true` sets localStorage flag that persists across reloads.

5. **Canvas cache key granularity tradeoff**
   - What we know: Current cache key includes width, height, hue, saturation, lightness, angle, withShadow. More granular keys = more cache entries = more memory but better performance.
   - What's unclear: Whether rounding dimensions (e.g., round to nearest 10px) would significantly reduce cache entries without visual quality loss.
   - Recommendation: Keep current granularity in Phase 1 (bars already round coordinates to integers). Add cache hit/miss rate monitoring in dev mode. If cache thrashing detected in testing, consider dimension bucketing in Phase 3.

## Sources

### Primary (HIGH confidence)
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) - Official Web API documentation
- [MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) - Official Web API documentation
- [MDN: addEventListener signal option](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) - Official Web API documentation with AbortSignal examples
- [MDN: performance.now()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now) - High-resolution timestamp documentation
- Existing codebase: `/src/shared/performance.js`, `/src/shared/AnimatedBar.js`, `/src/background/index.html`

### Secondary (MEDIUM confidence)
- [WebDevSimplified: Stop Using setInterval](https://blog.webdevsimplified.com/2021-12/request-animation-frame/) - requestAnimationFrame best practices
- [Kirupa: Consistent Animation Speeds](https://www.kirupa.com/animations/ensuring_consistent_animation_speeds.htm) - Delta-time implementation patterns
- [CSS-Tricks: AbortController for Event Listeners](https://css-tricks.com/using-abortcontroller-as-an-alternative-for-removing-event-listeners/) - Modern cleanup patterns
- [kettanaito: Don't Sleep on AbortController](https://kettanaito.com/blog/dont-sleep-on-abort-controller) - Advanced AbortController patterns
- [Chris Courses: Standardize Framerate](https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors) - Delta-time for variable refresh rates
- [Konva: Avoid Memory Leaks](https://konvajs.org/docs/performance/Avoid_Memory_Leaks.html) - Canvas memory management patterns
- [Better Stack: Joi vs Zod](https://betterstack.com/community/guides/scaling-nodejs/joi-vs-zod/) - Schema validation library comparison
- [Medium: Stop Using JSON Config Files](https://medium.com/trabe/stop-using-json-config-files-ab9bc55d82fa) - JavaScript config patterns

### Tertiary (LOW confidence)
- [GitHub: modern-lru](https://github.com/silentroach/modern-lru) - Map-based LRU implementation reference (not verified in production)
- [GitHub: js-lru](https://github.com/rsms/js-lru) - Alternative LRU approach (not tested for this use case)
- OBS Forum discussions on browser source memory usage (community reports, not official documentation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Native browser APIs with MDN documentation, baseline support since 2015-2019
- Architecture patterns: HIGH - Verified patterns from official docs and established best practices
- Memory management: MEDIUM - Canvas cache strategies are well-established but OBS-specific limits are undocumented
- Configuration patterns: HIGH - JavaScript config patterns widely adopted, validation approach is straightforward
- Pitfalls: HIGH - Common mistakes documented across multiple authoritative sources

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (30 days - stable domain with mature APIs)

**Note on dependencies:** This phase intentionally avoids adding external dependencies. All solutions use native browser APIs (requestAnimationFrame, AbortController, Map, performance.now()) or simple patterns that can be implemented directly. The only existing dependency is Vitest for testing, which is already installed.
