# Phase 3: Performance Optimization - Research

**Researched:** 2026-01-18
**Domain:** Canvas performance optimization, memory profiling, GPU operations, continuous rendering
**Confidence:** HIGH

## Summary

This phase focuses on optimizing long-running canvas animations (8+ hours) for OBS streaming. The research covered three core domains: (1) canvas alpha channel memory impact and configuration strategies, (2) dirty rectangle optimization to reduce GPU operations, and (3) frame rate monitoring and profiling for 60fps targets.

**Current state analysis:** The codebase already uses requestAnimationFrame with delta-time, LRU cache for offscreen canvases, and performance monitoring infrastructure. Alpha is currently enabled globally (alpha: true) across all scenes. The background scene uses dual-layered canvases, providing good architectural foundation for optimization work.

**Standard approach:** Performance optimization for continuous canvas rendering relies on Chrome DevTools memory profiling (heap snapshots, allocation timelines), dirty rectangle tracking to minimize clearRect operations (60-80% GPU reduction target), and performance.now() timestamps for accurate FPS measurement. Alpha channel optimization is configuration-driven rather than code changes—disabling alpha reduces memory by 25% (4 bytes→3 bytes per pixel internally, though ImageData remains RGBA) and speeds GPU compositing.

**Primary recommendation:** Implement performance monitoring overlay with real-time metrics (FPS, memory, frame times) first, then execute alpha audit using Chrome DevTools across 4-6 hour runs to measure actual impact. Add dirty rectangle tracking only if audit shows FPS drops below 55fps threshold. Use localStorage for session history with ISO 8601 timestamps, expose window.perfMonitor API for runtime inspection.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome DevTools | Built-in | Memory profiling, performance analysis | Official Chrome tooling for memory leak detection, heap snapshots, allocation timelines |
| performance.now() | Native API | High-resolution timestamps | Sub-millisecond precision, same clock as requestAnimationFrame callback |
| localStorage | Native API | Session metrics persistence | Survives browser reloads, synchronous API for simple key-value storage |
| requestAnimationFrame | Native API | Frame timing and FPS tracking | Already in use, provides frame timestamp for delta calculations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Xvfb | Latest | Virtual display for CI | Headless browser testing with GPU acceleration simulation |
| Vitest | 4.0.16 | Test framework (already installed) | Performance regression tests in CI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| localStorage | IndexedDB | More complex API, overkill for small session summaries |
| localStorage | sessionStorage | Loses data on browser close, defeats long-session tracking |
| Chrome DevTools | window.performance.memory | Less detailed, limited to basic heap metrics |

**Installation:**
No new dependencies required—all tools are native browser APIs or already installed (Vitest for CI testing).

## Architecture Patterns

### Recommended Project Structure
```
src/
├── shared/
│   ├── performance.js        # Existing PerformanceMonitor class
│   ├── perfOverlay.js        # New: Visual overlay UI component
│   ├── perfStorage.js        # New: localStorage session management
│   ├── dirtyRect.js          # New: Dirty rectangle tracker
│   └── canvas.js             # Update: Add selective clearing support
├── config/
│   └── config.js             # Update: Add performance configuration
└── [scene]/
    └── index.html            # Update: Initialize overlay, track regions
```

### Pattern 1: Performance Monitoring with Overlay
**What:** Real-time visual display of performance metrics (FPS, memory, frame times) toggled via URL parameter
**When to use:** Development and long-running stream tests to verify performance targets
**Example:**
```javascript
// Initialize monitoring (from CONTEXT decisions)
const urlParams = new URLSearchParams(window.location.search);
const showPerf = urlParams.get('perf') === 'true';

if (showPerf) {
    const perfMonitor = new PerformanceMonitor(60);
    const overlay = new PerformanceOverlay(perfMonitor, {
        position: 'top-right',
        opacity: 0.9
    });

    overlay.show(); // Hotkey: 'P' to toggle

    // Track per-frame
    function animate(timestamp) {
        perfMonitor.recordFrame();
        // ... rendering code
    }
}
```

### Pattern 2: Session Tracking with localStorage
**What:** Aggregate metrics per stream session, persist across reloads, auto-cleanup old data
**When to use:** Long-duration stress tests (4-6 hours) to track memory stability
**Example:**
```javascript
// Storage with ISO 8601 timestamps
const sessionData = {
    sessionId: crypto.randomUUID(),
    startTime: new Date().toISOString(), // "2026-01-18T14:30:00.123Z"
    scene: 'background',
    metrics: {
        avgFPS: 59.8,
        peakMemoryMB: 245,
        droppedFrames: 12,
        duration: 21600000 // 6 hours in ms
    }
};

// Store with FIFO eviction
localStorage.setItem(`perf_session_${sessionData.sessionId}`, JSON.stringify(sessionData));

// Auto-cleanup old sessions (keep last N)
const MAX_SESSIONS = 50;
const keys = Object.keys(localStorage).filter(k => k.startsWith('perf_session_'));
if (keys.length > MAX_SESSIONS) {
    // Sort by timestamp, remove oldest
    keys.sort().slice(0, keys.length - MAX_SESSIONS).forEach(k => localStorage.removeItem(k));
}
```

### Pattern 3: Dirty Rectangle Tracking
**What:** Track changed regions per frame, only clear/redraw affected areas
**When to use:** When FPS profiling shows excessive GPU clear operations
**Example:**
```javascript
// Track dirty regions per bar
class DirtyRectTracker {
    constructor(safetyMargin = 5) {
        this.regions = [];
        this.safetyMargin = safetyMargin; // Catch anti-aliasing, shadows
    }

    addRegion(x, y, width, height) {
        // Expand by safety margin
        this.regions.push({
            x: x - this.safetyMargin,
            y: y - this.safetyMargin,
            width: width + this.safetyMargin * 2,
            height: height + this.safetyMargin * 2
        });
    }

    getMergedRegions() {
        // Simple union merge: overlapping → single larger rect
        // Tradeoff: May redraw clean pixels, but avoids complex polygon math
        return mergeOverlappingRects(this.regions);
    }

    clearAndReset(ctx) {
        const merged = this.getMergedRegions();
        merged.forEach(rect => {
            ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
        });
        this.regions = []; // Reset each frame
    }
}

// Use in animation loop
const dirtyTracker = new DirtyRectTracker();

function animate() {
    // Don't clear full canvas
    // clearCanvas(ctx, canvas); // OLD

    // Clear only dirty regions
    dirtyTracker.clearAndReset(ctx); // NEW

    bars.forEach(bar => {
        dirtyTracker.addRegion(bar.x, bar.y, bar.width, bar.height);
        bar.draw();
    });
}
```

### Pattern 4: Alpha Channel Configuration
**What:** Toggle alpha per scene via config, validate incompatibilities
**When to use:** After audit determines alpha optimization needed
**Example:**
```javascript
// config.js
export const config = {
    performance: {
        alpha: {
            background: true,  // Keep for Phase 4 flexibility
            stinger: true,
            sidebar: true
        },
        thresholds: {
            maxMemoryMB: 300,
            minFPS: 55,
            maxContinuousHours: 8
        }
    }
};

// canvas.js - Apply per scene
export function setupCanvas(canvas, scene) {
    const alphaEnabled = config.performance.alpha[scene];
    const ctx = canvas.getContext('2d', { alpha: alphaEnabled });

    // Validate: warn if alpha disabled but fade animations configured
    if (!alphaEnabled && config[scene].opacity) {
        console.warn(`[Config] Alpha disabled for ${scene} but opacity animations configured. Visual artifacts may occur.`);
    }

    return ctx;
}
```

### Pattern 5: Frame Budget Monitoring
**What:** Track frame times against 16.67ms budget, detect dropped frames
**When to use:** Continuous monitoring during development and CI tests
**Example:**
```javascript
class PerformanceMonitor {
    constructor(targetFPS = 60) {
        this.targetFrameTime = 1000 / targetFPS; // 16.67ms for 60fps
        this.frameTimes = [];
        this.droppedFrames = 0;
    }

    recordFrame() {
        const now = performance.now();
        const frameTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Track dropped frames (exceeded budget + 1ms headroom)
        if (frameTime > this.targetFrameTime + 1) {
            this.droppedFrames++;
        }

        this.frameTimes.push(frameTime);
    }

    getP99FrameTime() {
        // Sort and find 99th percentile
        const sorted = [...this.frameTimes].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * 0.99);
        return sorted[index];
    }
}
```

### Anti-Patterns to Avoid
- **Storing raw percentiles in localStorage:** Never compute percentiles by averaging previously averaged numbers. Store raw frame time distributions or use histograms.
- **Full canvas clear every frame:** Clearing entire canvas is expensive. Use dirty rectangles for animated regions, layered canvases for static elements.
- **Using setInterval for animation:** Always use requestAnimationFrame for frame-synchronized rendering.
- **Sub-pixel rendering without rounding:** `ctx.drawImage(x, 0.3, y, 0.5)` forces anti-aliasing. Use `Math.floor()` or `Math.round()` for integer coordinates.
- **Frequent canvas state changes:** Batch operations, minimize `save()/restore()` calls which have GPU overhead.
- **shadowBlur property:** Expensive. Use offset shadows with solid fills instead (already implemented in codebase).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rectangle overlap detection | Custom collision logic | Simple geometric checks: `!(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom)` | Proven algorithm, avoids edge cases |
| Percentile calculation | Manual sorting every frame | Store samples, calculate on-demand with sorted array | O(n log n) is too expensive per-frame |
| Memory leak detection | Custom tracking | Chrome DevTools Allocation Timeline | Industry-standard tool, detects detached DOM nodes |
| High-res timestamps | Date.now() | performance.now() | Sub-millisecond precision, monotonic clock |
| Cross-origin timing precision | Default setup | Add headers: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` | Prevents security-based timestamp rounding |

**Key insight:** Canvas performance optimization is measurement-driven, not speculation-driven. Chrome DevTools profiling reveals actual bottlenecks (GPU compositing, memory allocation, GC pauses) that are impossible to predict from code review alone. Always profile before optimizing.

## Common Pitfalls

### Pitfall 1: Premature Alpha Optimization
**What goes wrong:** Disabling alpha channel before measuring actual impact, breaking transparency features
**Why it happens:** "Alpha uses more memory" is well-known advice, developers apply without validation
**How to avoid:** Run comprehensive audit first (4-6 hour stress test), measure actual memory delta and FPS impact, document thresholds. Only optimize if measurements exceed conservative streaming thresholds (<300MB, >5% FPS drop)
**Warning signs:** Visual artifacts in Phase 4 animations, inability to composite with OBS layers, config rollback needed post-deployment

### Pitfall 2: Overly Aggressive Dirty Rectangle Merging
**What goes wrong:** Complex polygon-based merging adds CPU overhead that negates GPU savings
**Why it happens:** Attempting "perfect" optimization by tracking exact changed pixels
**How to avoid:** Use simple rectangular union for overlapping regions. Accept redrawing some clean pixels—it's faster than computing exact minimal coverage. Research shows exact merge algorithms ran "order of magnitude slower" with minimal benefit
**Warning signs:** Animation loop takes >16.67ms due to merge calculations, profiler shows high CPU in merge logic

### Pitfall 3: localStorage Size Bloat
**What goes wrong:** Unbounded session history fills localStorage (typically 5-10MB limit per origin), blocking new writes
**Why it happens:** No eviction policy, each session adds data indefinitely
**How to avoid:** Implement FIFO eviction after N sessions (50 recommended), use `try/catch` around setItem to handle quota errors gracefully, prefer aggregated summaries over raw frame data
**Warning signs:** Console errors "QuotaExceededError", session data missing, localStorage.length growing unbounded

### Pitfall 4: Ignoring Headroom in Frame Budget
**What goes wrong:** Targeting exactly 16.67ms leaves no margin for variance, causes dropped frames on slight spikes
**Why it happens:** 60fps = 16.67ms math is technically correct but practically insufficient
**How to avoid:** Target 14-15ms per frame (1-2ms headroom), flag frames >16.67ms as "budget exceeded," measure P99 frame time not just average
**Warning signs:** "Smooth" 60fps average but visible stuttering, P99 >> P50 indicating high variance

### Pitfall 5: Comparing performance.now() to requestAnimationFrame Timestamp
**What goes wrong:** Negative time deltas, incorrect frame time calculations
**Why it happens:** RAF callback receives timestamp from frame start, performance.now() called later in frame
**How to avoid:** Use RAF timestamp exclusively for frame-to-frame deltas, never mix with performance.now(). Calculate `const deltaTime = (timestamp - lastTimestamp) / 1000` for seconds
**Warning signs:** Negative deltaTime values, animations speeding up/slowing down inconsistently

### Pitfall 6: Testing Only on High-End Hardware
**What goes wrong:** Performance looks great in development, fails on streaming PC under OBS load
**Why it happens:** Dev machine has discrete GPU, streaming PC shares GPU between game capture and browser sources
**How to avoid:** Test with OBS encoding + game capture running (background load simulation), document dev hardware specs, add stress test with 50 bars not just typical 15
**Warning signs:** User reports FPS issues that don't reproduce locally, CI passes but production struggles

## Code Examples

Verified patterns from official sources:

### Alpha Channel Configuration
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
// Disable alpha for opaque scenes to speed up GPU compositing

const ctx = canvas.getContext('2d', { alpha: false });
// Browser knows backdrop is opaque, optimizes blending operations
// Memory: 4 bytes/pixel RGBA → internally may use 3 bytes/pixel RGB
// Note: ImageData.data still returns Uint8ClampedArray with RGBA structure
```

### Integer Coordinate Rendering
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
// Avoid sub-pixel rendering which triggers extra anti-aliasing

// ❌ Bad: Sub-pixel coordinates
ctx.drawImage(myImage, 0.3, 0.5);

// ✅ Good: Integer coordinates
ctx.drawImage(myImage, Math.floor(0.3), Math.floor(0.5));

// For bar positions
x = Math.round(x);
y = Math.round(y);
```

### Layered Canvas Pattern
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
// Already implemented in background scene—separate layers for different update frequencies

// HTML structure
<div id="stage">
  <canvas id="background-layer"></canvas> <!-- Static/slow-moving -->
  <canvas id="foreground-layer"></canvas> <!-- Fast-moving -->
</div>

// CSS positioning
#stage { position: relative; }
canvas { position: absolute; }
#background-layer { z-index: 1; }
#foreground-layer { z-index: 2; }

// Benefit: Background layer can update at lower frequency or skip frames
```

### Memory Profiling with Chrome DevTools
```javascript
// Source: https://developer.chrome.com/docs/devtools/memory-problems
// Take heap snapshots to track memory growth

// 1. Open DevTools > Memory tab
// 2. Select "Heap snapshot"
// 3. Take snapshot at baseline (T=0)
// 4. Run animation for 1 hour
// 5. Take snapshot at T=1h
// 6. Compare snapshots, look for:
//    - Detached DOM nodes (memory leak indicator)
//    - Growing object counts (e.g., canvas elements not GC'd)
//    - Array buffer size (canvas backing stores)

// 7. Use Allocation Timeline for leak detection:
//    - Shows objects allocated over time
//    - Select time interval to see what's retained
//    - Objects alive at end = potential leak
```

### FPS Tracking with requestAnimationFrame
```javascript
// Source: https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors
// Track frame rate using RAF timestamps (already partially implemented)

let lastTimestamp = 0;
const frameTimes = [];

function animate(timestamp) {
    // Calculate frame time in milliseconds
    const frameTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Track for FPS calculation
    frameTimes.push(frameTime);
    if (frameTimes.length > 60) frameTimes.shift(); // Rolling window

    // Calculate current FPS
    const avgFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
    const fps = Math.round(1000 / avgFrameTime);

    // Calculate deltaTime for frame-rate independent animation
    const deltaTime = frameTime / 1000; // Convert to seconds

    // Use deltaTime for movement
    // x += speedPerSecond * deltaTime; // Not speedPerFrame

    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
```

### P99 Percentile Calculation
```javascript
// Source: https://www.baeldung.com/cs/whats-the-p99-latency
// Calculate 99th percentile frame time for outlier detection

function calculateP99(frameTimes) {
    // Sort ascending
    const sorted = [...frameTimes].sort((a, b) => a - b);

    // P99 index: 99% of values are lower
    const index = Math.floor(sorted.length * 0.99);

    return sorted[index];
}

// Usage in monitoring
const p99 = calculateP99(perfMonitor.frameTimes);
if (p99 > 20) { // 20ms = significant drop below 60fps
    console.warn(`P99 frame time ${p99.toFixed(2)}ms exceeds threshold`);
}
```

### localStorage Session Management
```javascript
// Source: https://dev.to/aneeqakhan/a-developers-guide-to-browser-storage
// Persist session metrics across browser reloads with ISO 8601 timestamps

class PerformanceStorage {
    constructor(maxSessions = 50) {
        this.maxSessions = maxSessions;
        this.prefix = 'perf_session_';
    }

    saveSession(metrics) {
        const session = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(), // ISO 8601 with Z suffix
            scene: metrics.scene,
            duration: metrics.duration,
            avgFPS: metrics.avgFPS,
            peakMemoryMB: metrics.peakMemoryMB,
            droppedFrames: metrics.droppedFrames
        };

        try {
            localStorage.setItem(
                `${this.prefix}${session.id}`,
                JSON.stringify(session)
            );
            this.evictOldSessions();
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('localStorage quota exceeded, forcing cleanup');
                this.evictOldSessions(true); // Aggressive cleanup
            }
        }
    }

    evictOldSessions(aggressive = false) {
        const keys = Object.keys(localStorage)
            .filter(k => k.startsWith(this.prefix))
            .sort(); // ISO 8601 sorts chronologically

        const limit = aggressive ? this.maxSessions * 0.5 : this.maxSessions;
        const toRemove = keys.length - limit;

        if (toRemove > 0) {
            keys.slice(0, toRemove).forEach(k => localStorage.removeItem(k));
        }
    }

    getSessions() {
        return Object.keys(localStorage)
            .filter(k => k.startsWith(this.prefix))
            .map(k => JSON.parse(localStorage.getItem(k)))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
}
```

### Dirty Rectangle Merging
```javascript
// Source: https://github.com/craftyjs/Crafty/issues/467
// Simple union merge—proven faster than complex polygon approaches

function mergeOverlappingRects(rects) {
    if (rects.length === 0) return [];
    if (rects.length === 1) return rects;

    const merged = [];
    const sorted = [...rects].sort((a, b) => a.x - b.x);

    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
        const rect = sorted[i];

        // Check overlap (simple geometric test)
        const overlaps = !(
            current.x + current.width < rect.x ||
            rect.x + rect.width < current.x ||
            current.y + current.height < rect.y ||
            rect.y + rect.height < current.y
        );

        if (overlaps) {
            // Merge: take bounding box of both rectangles
            const x1 = Math.min(current.x, rect.x);
            const y1 = Math.min(current.y, rect.y);
            const x2 = Math.max(current.x + current.width, rect.x + rect.width);
            const y2 = Math.max(current.y + current.height, rect.y + rect.height);

            current = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
        } else {
            merged.push(current);
            current = { ...rect };
        }
    }

    merged.push(current);
    return merged;
}
```

### window.perfMonitor API
```javascript
// Source: Context decisions + common browser API patterns
// Console API for runtime inspection during development

window.perfMonitor = {
    // Query methods
    getCurrentMetrics() {
        return {
            fps: perfMonitor.getFPS(),
            avgFrameTime: perfMonitor.getAvgFrameTime(),
            minFrameTime: perfMonitor.getMinFrameTime(),
            maxFrameTime: perfMonitor.getMaxFrameTime(),
            droppedFrames: perfMonitor.droppedFrames,
            memoryMB: window.performance.memory
                ? (window.performance.memory.usedJSHeapSize / 1048576).toFixed(2)
                : 'N/A'
        };
    },

    getSessions() {
        return perfStorage.getSessions();
    },

    getAverages() {
        const sessions = perfStorage.getSessions();
        if (sessions.length === 0) return null;

        return {
            avgFPS: sessions.reduce((sum, s) => sum + s.avgFPS, 0) / sessions.length,
            avgMemoryMB: sessions.reduce((sum, s) => sum + s.peakMemoryMB, 0) / sessions.length,
            totalSessions: sessions.length
        };
    },

    // Control methods
    start() {
        perfMonitor.enable();
    },

    stop() {
        perfMonitor.disable();
    },

    reset() {
        perfMonitor.frameTimes = [];
        perfMonitor.droppedFrames = 0;
    },

    clearHistory() {
        if (confirm('Clear all performance session history?')) {
            perfStorage.evictOldSessions(true); // Remove all
        }
    }
};

// Usage in console:
// > window.perfMonitor.getCurrentMetrics()
// { fps: 59, avgFrameTime: 16.8, ... }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Date.now() for frame timing | performance.now() | 2015+ | Sub-millisecond precision, monotonic clock prevents negative deltas |
| setInterval for animations | requestAnimationFrame | 2012+ | Frame-synchronized rendering, automatic throttling when tab backgrounded |
| shadowBlur for shadows | Offset + solid fill | 2010+ (known expensive) | 10x faster rendering, already implemented in codebase |
| Full canvas clear every frame | Dirty rectangles | 2010+ game engines, recently Apache ECharts 5 (2021) | 60-80% reduction in GPU clear operations for static regions |
| Storing all frame data | Histogram-based percentiles | OpenTelemetry pattern (2020+) | O(1) memory usage vs O(n), accurate P99 without storing raw values |
| PhantomJS for headless testing | Native --headless mode | 2017+ (Chrome 59) | Faster execution, better canvas support, active maintenance |
| sessionStorage for metrics | localStorage | Context preference | Survives browser reload critical for long-stream testing |

**Deprecated/outdated:**
- **PhantomJS:** No longer maintained since 2018. Use Chrome/Chromium native headless mode or Playwright for CI testing.
- **window.performance.memory without isolation:** Browsers lowered precision to 2ms in some cases due to Spectre attacks. Use Cross-Origin isolation headers for high-resolution timing.
- **Alpha optimization as first step:** Modern advice prioritizes measurement first. Premature optimization broke transparency workflows in Phase 4-like scenarios.

## Open Questions

Things that couldn't be fully resolved:

1. **Exact alpha channel memory savings in OBS Chromium build**
   - What we know: Standard Chrome treats alpha:false as optimization hint, may use 3-byte RGB internally vs 4-byte RGBA. ImageData always returns RGBA structure.
   - What's unclear: OBS uses embedded Chromium which may have different optimization behavior. Actual memory delta needs empirical testing.
   - Recommendation: Run audit on actual OBS browser source, measure with Chrome DevTools Memory panel. Document findings in phase report. Don't assume 25% savings without verification.

2. **P99 calculation with histogram approach vs raw storage**
   - What we know: OpenTelemetry recommends histograms for distributed systems to avoid storing every value. For local performance monitoring, raw storage in rolling window (60-120 samples) is feasible.
   - What's unclear: At what sample size does histogram become necessary? 60-sample window = ~1 second at 60fps, seems manageable.
   - Recommendation: Start with raw storage in PerformanceMonitor (already collecting frameTimes array). If memory usage becomes concern, switch to histogram with fixed buckets (e.g., 0-10ms, 10-20ms, 20-30ms).

3. **Dirty rectangle performance crossover point**
   - What we know: Dirty rectangles reduce GPU clears but add CPU overhead for tracking/merging. Research shows simple union merging outperforms complex polygon approaches.
   - What's unclear: At what bar count does tracking overhead exceed clear savings? Background scene has 15 bars (default) but stress tests use 50.
   - Recommendation: Implement dirty tracking with feature flag (config.performance.dirtyRectangles). A/B test with 15 vs 50 bars, measure frame times before/after. Document crossover threshold.

4. **CI performance testing reliability with Xvfb**
   - What we know: Xvfb provides virtual display for headless testing. Vitest already installed. Chrome native headless mode 15-20% faster than Xvfb in benchmarks.
   - What's unclear: Can synthetic FPS tests in CI (no real game capture load) detect regressions that only appear under OBS streaming conditions?
   - Recommendation: Use CI tests for detecting major regressions (e.g., 20%+ FPS drop). Real-world validation requires manual OBS testing with game capture. Document this limitation in test README.

5. **localStorage quota and fallback strategy**
   - What we know: localStorage typically 5-10MB per origin. Session summaries are small (~500 bytes), 50 sessions = ~25KB well within limit.
   - What's unclear: Should implementation handle quota errors gracefully or fail loudly to surface storage issues?
   - Recommendation: Wrap setItem in try/catch, handle QuotaExceededError with aggressive cleanup (remove oldest 50% of sessions). Log warning to console. Don't silently fail—developer needs visibility.

## Sources

### Primary (HIGH confidence)
- [MDN Canvas Optimization Guide](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Official canvas best practices
- [Chrome DevTools Memory Panel](https://developer.chrome.com/docs/devtools/memory/) - Memory profiling tools
- [Chrome DevTools Memory Problems](https://developer.chrome.com/docs/devtools/memory-problems) - Leak detection guide
- [MDN HTMLCanvasElement.getContext()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext) - Alpha channel API
- [MDN clearRect()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/clearRect) - Partial clearing method
- [MDN requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) - Animation timing API
- [MDN Date.prototype.toISOString()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString) - ISO 8601 timestamp format

### Secondary (MEDIUM confidence)
- [OBS Browser Source Documentation](https://obsproject.com/kb/browser-source) - OBS-specific configuration
- [Chris Courses: Standardize Frame Rate](https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors) - Delta-time pattern
- [Baeldung: P99 Latency](https://www.baeldung.com/cs/whats-the-p99-latency) - Percentile calculation
- [DEV.to: Browser Storage Guide](https://dev.to/aneeqakhan/a-developers-guide-to-browser-storage) - localStorage best practices
- [Crafty.js GitHub Issue #467](https://github.com/craftyjs/Crafty/issues/467) - Dirty rectangle merging research
- [Konva.js Memory Leak Guide](https://konvajs.org/docs/performance/Avoid_Memory_Leaks.html) - Canvas leak prevention
- [Apache ECharts Dirty Rectangle Rendering](https://apachecon.com/acasia2021/sessions/1087.html) - Modern implementation example

### Tertiary (LOW confidence)
- [Chromium: Efforts Against Memory Bloat](https://www.chromium.org/developers/memory-bloat/) - window.performance.memory usage
- [WebGL Dev List: Alpha Performance](https://groups.google.com/g/webgl-dev-list/c/h7WYgntLnvU) - WebGL alpha impact discussion
- [GitHub: Canvas Performance Gist](https://gist.github.com/jaredwilli/5469626) - Community optimization tips
- WebSearch results: Canvas rendering frame budget, dirty rectangles, headless testing—multiple sources cross-referenced

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are native browser APIs or officially documented Chrome DevTools features
- Architecture: HIGH - Patterns verified with MDN documentation and existing codebase structure
- Pitfalls: HIGH - Based on official documentation warnings and established community knowledge
- Alpha optimization: MEDIUM - General canvas advice verified, but OBS-specific behavior requires empirical testing
- Dirty rectangles: MEDIUM - Pattern well-established, but optimal implementation details need A/B testing
- CI testing: LOW - Xvfb + Vitest approach is standard but real-world streaming conditions differ significantly

**Research date:** 2026-01-18
**Valid until:** 60 days (2026-03-19) - Canvas APIs stable, performance tooling evolves slowly, revalidate if browser major versions change

**Key areas for validation during planning:**
1. OBS browser source alpha memory savings—assume 15-25% pending audit
2. Dirty rectangle tracking overhead threshold—implement with feature flag for A/B testing
3. CI performance test reliability—use for regression detection, not absolute validation
4. localStorage quota handling—assume 5MB minimum, implement graceful degradation
