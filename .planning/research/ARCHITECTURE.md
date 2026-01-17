# Architecture Patterns for Canvas Animation Systems

**Domain:** High-performance Canvas animations for OBS stream graphics
**Researched:** 2026-01-17
**Overall Confidence:** HIGH (verified with multiple authoritative sources and current codebase analysis)

## Executive Summary

Modern Canvas animation systems in 2025 have converged on several proven architectural patterns: **Entity-Component-System (ECS)** for complex game engines, **pure functional calculations** for testable animation math, **centralized configuration layers** for maintainability, and **offscreen canvas caching** with proper lifecycle management for performance. For your OBS stream animation system, the current class-based inheritance with pure calculation functions is solid, but needs strategic refactoring around configuration centralization and memory management.

The key insight from 2025 patterns: **Separate data from behavior, separate calculations from rendering, centralize constants**. Your existing pure calculation functions (`calculations.js`) already follow this trend—they just need to be the foundation of a more comprehensive architecture.

---

## Current Architecture Analysis

### What's Working Well

```
AnimatedBar (base class)
├── Shared rendering logic (drawBar, offscreen caching)
├── Common easing functions
└── Consistent coordinate system

Subclasses extend for behavior:
├── BackgroundBar (continuous drift, lifecycle phases)
├── StingerBar (phase-based curtain effect)
└── SidebarBar (notification display)

Pure Calculation Layer:
└── calculations.js (testable animation math)
```

**Strengths:**
- Clear inheritance hierarchy reduces code duplication
- Pure calculation functions are highly testable (no side effects)
- Offscreen canvas caching exists (performance optimization)
- Coordinate system is consistent (if not well-documented)

**Weaknesses:**
- Configuration scattered across files (magic numbers everywhere)
- Static cache grows unbounded (memory leak)
- Mixed frame rates (30fps/60fps) not architected systematically
- No coordinate system documentation (AI coding breaks positioning)
- No centralized timing constants (2 seconds = 120 frames is repeated)

---

## Recommended Architecture: Layered Configuration + Pure Functions

### Layer 1: Configuration Layer (NEW)

Modern JavaScript applications use a **centralized constants layer** to promote reusability, avoid duplication, and enable consistency ([Semaphore: Constants Layer](https://semaphore.io/blog/constants-layer-javascript)).

```javascript
// config/constants.js
export const ANIMATION_CONFIG = {
  // Frame rates
  FPS: {
    BACKGROUND: 30,
    FOREGROUND: 60,
  },

  // Durations (in frames at 60fps)
  DURATION: {
    FADE_IN: 120,           // 2 seconds
    FADE_OUT: 120,          // 2 seconds
    VISIBLE_MIN: 1800,      // 30 seconds
    VISIBLE_MAX: 7200,      // 120 seconds
    DIRECTION_TRANSITION: 180, // 3 seconds
  },

  // Visual properties
  VISUAL: {
    WHITE_BAR_PROBABILITY: 0.7,
    WHITE_LIGHTNESS: 80,    // 20% darker than pure white
    OPACITY_MIN: 0.4,
    OPACITY_MAX: 0.7,
    HUE_VARIATION: 40,
    LIGHTNESS_VARIATION: 30,
  },

  // Bar dimensions
  BARS: {
    SLANTED: {
      ANGLE: 15,
      WHITE_WIDTH_MIN: 50,
      WHITE_WIDTH_MAX: 150,
      COLORED_WIDTH_MIN: 200,
      COLORED_WIDTH_MAX: 600,
    },
    HORIZONTAL: {
      SKEW: -15,
      WHITE_HEIGHT_MIN: 20,
      WHITE_HEIGHT_MAX: 50,
      COLORED_HEIGHT_MIN: 40,
      COLORED_HEIGHT_MAX: 100,
    },
  },

  // Performance
  PERFORMANCE: {
    OFFSCREEN_CACHE_MAX_SIZE: 100, // Limit cache entries
    VIEWPORT_MARGIN: 200,          // Culling margin in pixels
  },

  // Positioning (COORDINATE SYSTEM DOCUMENTATION)
  COORDINATE_SYSTEM: {
    // Canvas origin (0,0) is TOP-LEFT corner
    // Positive X moves RIGHT
    // Positive Y moves DOWN
    // Slanted bars: positioned at Y=0, extend full height
    // Horizontal bars: positioned at random Y within canvas height
    OFFSCREEN_LEFT: -300,
    OFFSCREEN_RIGHT_OFFSET: 300, // canvas.width + 300
  },
};

// config/colors.js (existing, but move to config/)
// Leave existing hexToHSL, cssColorToHex functions here

// config/index.js (barrel export)
export { ANIMATION_CONFIG } from './constants.js';
export * from './colors.js';
```

**Benefits:**
- All magic numbers in one place
- Easy to adjust timing/appearance globally
- Self-documenting (comments explain coordinate system)
- TypeScript-ready (can add JSDoc or convert to TS later)

**Build Order Implication:** Phase 1 should be "Extract configuration layer" before any feature work.

---

### Layer 2: Pure Calculation Functions (EXISTING, EXPAND)

Your existing `calculations.js` follows 2025 best practices perfectly. Pure functions are "the secret weapon of scalable code in 2025" because they enable **trivial unit testing with no mocks, no setup, just pure input-output validation** ([Dev.to: Pure Functions 2025](https://dev.to/arkhan/why-pure-functions-are-the-secret-weapon-of-scalable-code-in-2025-4h41)).

**Current functions (all good):**
- `calculateOpacity` ✓
- `calculateSizeMultiplier` ✓
- `calculateDirectionTransition` ✓
- `calculatePosition` ✓
- `shouldChangeDirection` ✓
- `calculateTransitionProgress` ✓
- `determineNextPhase` ✓
- `isBarInViewport` ✓

**Functions to add:**
```javascript
// calculations.js (additions)

/**
 * Calculate random bar dimensions based on type and color
 * PURE: Same inputs always produce same outputs (when random is seeded)
 */
export function calculateBarDimensions(type, isWhite, random, config) {
  if (type === 'slanted') {
    if (isWhite) {
      return {
        width: random() * (config.BARS.SLANTED.WHITE_WIDTH_MAX - config.BARS.SLANTED.WHITE_WIDTH_MIN) + config.BARS.SLANTED.WHITE_WIDTH_MIN,
      };
    } else {
      return {
        width: random() * (config.BARS.SLANTED.COLORED_WIDTH_MAX - config.BARS.SLANTED.COLORED_WIDTH_MIN) + config.BARS.SLANTED.COLORED_WIDTH_MIN,
      };
    }
  } else {
    const height = isWhite
      ? random() * (config.BARS.HORIZONTAL.WHITE_HEIGHT_MAX - config.BARS.HORIZONTAL.WHITE_HEIGHT_MIN) + config.BARS.HORIZONTAL.WHITE_HEIGHT_MIN
      : random() * (config.BARS.HORIZONTAL.COLORED_HEIGHT_MAX - config.BARS.HORIZONTAL.COLORED_HEIGHT_MIN) + config.BARS.HORIZONTAL.COLORED_HEIGHT_MIN;
    return { width: null, height }; // width is canvas-dependent
  }
}

/**
 * Calculate starting position based on direction
 * LOCKED DOWN: Documents coordinate system explicitly
 */
export function calculateStartPosition(direction, barWidth, canvasWidth, config) {
  // COORDINATE SYSTEM: Origin (0,0) is top-left
  // Bars move horizontally (X axis)
  // Direction: 1 = left-to-right, -1 = right-to-left

  if (direction === 1) {
    // Start offscreen left
    return config.COORDINATE_SYSTEM.OFFSCREEN_LEFT - barWidth;
  } else {
    // Start offscreen right
    return canvasWidth + config.COORDINATE_SYSTEM.OFFSCREEN_RIGHT_OFFSET;
  }
}

/**
 * Convert duration from seconds to frames
 */
export function secondsToFrames(seconds, fps = 60) {
  return Math.floor(seconds * fps);
}

/**
 * Convert duration from frames to seconds
 */
export function framesToSeconds(frames, fps = 60) {
  return frames / fps;
}
```

**Testing Strategy:**
Every pure function gets comprehensive unit tests. Example:

```javascript
// calculations.test.js (example additions)
describe('calculateStartPosition', () => {
  const config = ANIMATION_CONFIG;

  test('left-to-right: starts offscreen left', () => {
    const pos = calculateStartPosition(1, 100, 1920, config);
    expect(pos).toBe(-300 - 100); // OFFSCREEN_LEFT - barWidth
    expect(pos).toBeLessThan(0); // Verify offscreen
  });

  test('right-to-left: starts offscreen right', () => {
    const pos = calculateStartPosition(-1, 100, 1920, config);
    expect(pos).toBe(1920 + 300); // canvasWidth + OFFSCREEN_RIGHT_OFFSET
    expect(pos).toBeGreaterThan(1920); // Verify offscreen
  });

  test('coordinates are integers (no subpixel issues)', () => {
    const pos = calculateStartPosition(1, 100.5, 1920, config);
    expect(Number.isInteger(pos)).toBe(false); // This would fail, showing rounding needed
    // Then fix the function to round
  });
});
```

**Key Insight:** Tests should **document the coordinate system through assertions**. When AI coding breaks positioning, tests fail with clear messages about what coordinate space means.

---

### Layer 3: Component System (REFACTOR EXISTING)

Current inheritance is fine, but can be improved with **composition over inheritance** for some aspects.

#### Pattern A: Keep Inheritance for Rendering (Status Quo)

```
AnimatedBar (base class)
├── drawBar()         // Shared rendering
├── getOrCreateOffscreenCanvas() // Shared caching
└── easeInOutCubic()  // Shared easing

↓ Inheritance

BackgroundBar/StingerBar/SidebarBar
├── init()    // Specialized initialization
├── update()  // Specialized behavior
└── draw()    // Specialized drawing logic
```

**When to use:** Current pattern works well for **rendering-focused** components. Keep it.

#### Pattern B: Add Composition for Behaviors (NEW)

For reusable behaviors (direction changes, size animation, lifecycle), use **mixins** or **strategy pattern**:

```javascript
// behaviors/lifecycle.js
export class LifecycleBehavior {
  constructor(config) {
    this.phase = 'fadeIn';
    this.frame = 0;
    this.config = config;
  }

  update() {
    this.frame++;
    const result = determineNextPhase(
      this.phase,
      this.frame,
      this.config.DURATION.FADE_IN,
      this.config.DURATION.VISIBLE_MIN,
      this.config.DURATION.FADE_OUT
    );
    this.phase = result.phase;
    this.frame = result.frame;
  }

  getOpacity(maxOpacity, easingFn) {
    return calculateOpacity(
      this.phase,
      this.frame,
      this.config.DURATION.FADE_IN,
      this.config.DURATION.FADE_OUT,
      maxOpacity,
      easingFn
    );
  }
}

// Then in BackgroundBar:
this.lifecycle = new LifecycleBehavior(ANIMATION_CONFIG);

// In update():
this.lifecycle.update();
this.currentOpacity = this.lifecycle.getOpacity(this.maxOpacity, this.easeInOutCubic.bind(this));
```

**Benefits:**
- Behaviors are reusable across bar types
- Easier to add new animation types (compose behaviors)
- Each behavior can be tested independently

**Tradeoff:** More files, more abstractions. Only use if adding 3+ new animation types.

**Build Order Implication:** Phase 2-3 could extract behaviors if adding sidebar variants. Otherwise, defer.

---

### Layer 4: Memory Management (FIX EXISTING)

Current problem: `AnimatedBar.offscreenCache` grows unbounded. Solution: **LRU cache with size limit**.

Modern Canvas optimization guides emphasize proper disposal and cache limits ([Konva: Avoid Memory Leaks](https://konvajs.org/docs/performance/Avoid_Memory_Leaks.html), [Reintech: Canvas Performance](https://reintech.io/blog/optimizing-canvas-performance-large-scale-apps)).

```javascript
// shared/LRUCache.js (NEW)
export class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // Remove if already exists (will re-add at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

// AnimatedBar.js (modify)
static offscreenCache = new LRUCache(ANIMATION_CONFIG.PERFORMANCE.OFFSCREEN_CACHE_MAX_SIZE);

// Usage stays the same:
const cached = AnimatedBar.offscreenCache.get(cacheKey);
if (cached) return cached;

const offscreenCanvas = /* create */;
AnimatedBar.offscreenCache.set(cacheKey, offscreenCanvas);
```

**Testing Strategy:**
```javascript
describe('LRUCache', () => {
  test('evicts oldest entry when full', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // Should evict 'a'

    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('d')).toBe(4);
  });
});
```

**Build Order Implication:** Phase 1 (urgent fix for memory leak).

---

### Layer 5: Frame Rate Management (DOCUMENT EXISTING)

Current background scene uses **dual-layer rendering** (30fps background, 60fps foreground). This is a valid pattern but needs documentation.

**Pattern: Multi-Rate Animation Loop**

```javascript
// background/main.js (simplified current pattern)
let lastBackgroundUpdate = 0;
const BACKGROUND_INTERVAL = 1000 / 30; // 33.33ms

function animate(timestamp) {
  // 60fps foreground layer (white bars)
  foregroundBars.forEach(bar => bar.update());

  // 30fps background layer (colored bars)
  if (timestamp - lastBackgroundUpdate >= BACKGROUND_INTERVAL) {
    backgroundBars.forEach(bar => bar.update());
    lastBackgroundUpdate = timestamp;
  }

  // Render all at 60fps (drawing is cheap, updates are expensive)
  clearCanvas(ctx, canvas);
  backgroundBars.forEach(bar => bar.draw());
  foregroundBars.forEach(bar => bar.draw());

  requestAnimationFrame(animate);
}
```

**Problem:** Timing calculations assume 60fps everywhere, but background updates at 30fps.

**Solution:** Pass `deltaTime` or `fps` to update functions:

```javascript
// BackgroundBar.update(deltaTime)
// Convert config durations based on actual update rate
const fadeInDuration = (ANIMATION_CONFIG.DURATION.FADE_IN * this.fps) / 60;
```

Or simpler: **Document that background bars use 60fps timing but update every other frame**. That's fine as long as it's intentional.

**Build Order Implication:** Phase 2 (document pattern, add test for timing accuracy).

---

## Architecture for Adding New Animation Types

When adding a new notification type (e.g., "FollowNotification", "SubNotification"):

### Option 1: Inheritance (Simple, Current Pattern)

```javascript
// notifications/FollowBar.js
export class FollowBar extends AnimatedBar {
  constructor(ctx, canvas, username, config) {
    super(ctx, canvas, 'horizontal', { random: Math.random });
    this.username = username;
    this.config = config;
    this.init();
  }

  init() {
    // Use config constants
    this.width = calculateBarDimensions('horizontal', false, this.random, this.config).width;
    // ... initialization using pure functions
  }

  update() {
    // Use pure functions for calculations
    this.x = calculatePosition(this.x, this.baseSpeed, this.direction);
    // ...
  }

  draw() {
    this.drawBar(/* params from config */);
    // Draw username text
    this.ctx.fillText(this.username, this.x, this.y);
  }
}
```

**Checklist for new animation type:**
1. Extend `AnimatedBar`
2. Use `ANIMATION_CONFIG` constants (no magic numbers)
3. Use pure calculation functions from `calculations.js`
4. Write unit tests for `init()` logic (with seeded random)
5. Write unit tests for positioning (coordinate system)
6. Add visual regression test (see Testing Strategies section)

### Option 2: ECS (Complex, Overkill for This Project)

Entity-Component-System is the 2025 trend for **game engines** ([GitHub: ECSY](https://github.com/ecsyjs/ecsy), [Game Engine Architecture 2025](https://generalistprogrammer.com/game-engine-architecture)). It provides better performance and flexibility when you have **hundreds of entities** with **dynamic components**.

**Don't use ECS unless:**
- You need 50+ simultaneous animations
- You need dynamic component addition/removal at runtime
- Performance profiling shows current architecture is a bottleneck

For OBS stream overlays with 10-20 bars, inheritance is simpler and sufficient.

---

## Testing Strategies to Prevent Regressions

### Problem: AI Coding Breaks Positioning

AI models (including Claude) often misunderstand Canvas coordinate systems because training data includes multiple conventions (top-left origin, center origin, mathematical coordinates, etc.).

### Solution: Position-Locking Tests

**Strategy from 2025 research:** "Unit tests for pure functions are trivial—no mocks, no setup, just input-output validation" ([Pluralsight: Testable JavaScript](https://www.pluralsight.com/tech-blog/testable-javascript-pure-functions/)).

```javascript
// tests/positioning.test.js
describe('Coordinate System Contract', () => {
  test('Canvas origin is top-left (0,0)', () => {
    // This test documents the coordinate system
    // If AI changes this assumption, test fails
    const canvas = createTestCanvas(1920, 1080);
    expect(canvas.origin).toEqual({ x: 0, y: 0 });
  });

  test('Bars moving left-to-right start negative X', () => {
    const startX = calculateStartPosition(1, 100, 1920, ANIMATION_CONFIG);
    expect(startX).toBeLessThan(0);
    expect(startX).toBe(-400); // Exact expected value
  });

  test('Bars moving right-to-left start beyond canvas width', () => {
    const startX = calculateStartPosition(-1, 100, 1920, ANIMATION_CONFIG);
    expect(startX).toBeGreaterThan(1920);
    expect(startX).toBe(2220); // Exact expected value
  });

  test('Slanted bars always positioned at Y=0', () => {
    const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, true, { random: seededRandom });
    expect(bar.y).toBe(0);
  });

  test('Horizontal bars positioned within canvas height', () => {
    const bar = new BackgroundBar(ctx, canvas, 'horizontal', baseHSL, 1.0, true, { random: seededRandom });
    expect(bar.y).toBeGreaterThanOrEqual(0);
    expect(bar.y).toBeLessThanOrEqual(canvas.height);
  });
});
```

**Key Insight:** Tests should fail with **specific error messages** that teach the AI:

```javascript
expect(bar.y).toBe(0);
// If this fails: "Expected slanted bar Y position to be 0 (top edge), but got 540 (center).
// Canvas origin is TOP-LEFT, not center."
```

### Visual Regression Testing

Canvas testing is notoriously difficult because **traditional automation tools can't "see" inside Canvas elements** ([askUI: Canvas Testing](https://www.askui.com/blog-posts/html5-canvas-testing-techniques-tools-and-best-practices)). Two approaches:

#### Approach A: Snapshot Canvas ImageData (Recommended for OBS)

```javascript
// tests/visual/snapshots.test.js
describe('Visual Regression', () => {
  test('background scene matches snapshot', async () => {
    const { canvas, ctx } = setupBackgroundScene(seededRandom);

    // Run for fixed duration with seeded random
    for (let i = 0; i < 120; i++) { // 2 seconds at 60fps
      updateAndRender();
    }

    // Capture ImageData
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    expect(imageData).toMatchSnapshot();
  });
});
```

**Caveat:** ImageData snapshots are brittle (any pixel change breaks test). Use for **smoke tests** only.

#### Approach B: Property-Based Testing (Recommended for Logic)

```javascript
describe('Animation Invariants', () => {
  test('bars never move faster than max speed', () => {
    const bar = new BackgroundBar(/* ... */);
    let prevX = bar.x;

    for (let i = 0; i < 1000; i++) {
      bar.update();
      const deltaX = Math.abs(bar.x - prevX);
      expect(deltaX).toBeLessThanOrEqual(MAX_SPEED_PER_FRAME);
      prevX = bar.x;
    }
  });

  test('opacity always in range [0, maxOpacity]', () => {
    const bar = new BackgroundBar(/* ... */);

    for (let i = 0; i < 10000; i++) {
      bar.update();
      expect(bar.currentOpacity).toBeGreaterThanOrEqual(0);
      expect(bar.currentOpacity).toBeLessThanOrEqual(bar.maxOpacity);
    }
  });
});
```

**This prevents logic bugs without brittle pixel comparisons.**

### Manual Visual Testing (Primary for OBS)

Given that "Primary testing happens in OBS output preview (not browser)" (from PROJECT.md), automated visual testing has limited value.

**Recommended workflow:**
1. Unit tests lock down calculations (positioning, timing, opacity)
2. Property-based tests verify invariants (no out-of-bounds bugs)
3. Manual OBS testing for final visual validation

---

## Component Boundaries & Responsibilities

Clear boundaries prevent architectural drift:

| Component | Responsibility | Does NOT Handle |
|-----------|---------------|----------------|
| **config/constants.js** | All magic numbers, durations, dimensions, coordinate system documentation | Runtime state, calculations |
| **shared/calculations.js** | Pure animation math, testable functions, no side effects | Rendering, DOM, state mutation |
| **shared/AnimatedBar.js** | Shared rendering logic (drawBar), offscreen caching, canvas transforms | Animation-specific behavior |
| **shared/LRUCache.js** | Memory-bounded cache, eviction policy | What's being cached |
| **background/BackgroundBar.js** | Background-specific lifecycle (drift, direction changes) | Other bar types |
| **stinger/StingerBar.js** | Stinger-specific phases (in, pause, out) | Background behavior |
| **sidebar/SidebarBar.js** | Notification display logic | Background/stinger behavior |
| **{scene}/main.js** | Scene setup, animation loop, frame rate management | Shared bar logic |

**Architectural Rule:** If a component has multiple responsibilities, split it. If two components share code, extract to shared/.

---

## Data Flow Diagram

```
URL Parameters
    ↓
Config Layer (constants + color parsing)
    ↓
Scene Setup (main.js)
    ↓
Bar Instantiation (BackgroundBar, etc.)
    ↓
Animation Loop
    ├→ Update Phase
    │   ├→ Pure Calculations (calculations.js)
    │   └→ State Mutation (bar instances)
    └→ Render Phase
        ├→ Offscreen Canvas (LRU cache)
        └→ Main Canvas (drawBar)
            ↓
        OBS Display
```

---

## Build Order Recommendations

Based on architecture analysis, suggested refactoring order:

### Phase 1: Foundation (Most Important)
**Goal:** Fix memory leak, centralize configuration

1. Create `config/constants.js` with all magic numbers
2. Implement `LRUCache` for offscreen canvas management
3. Update `AnimatedBar` to use LRU cache
4. Add coordinate system documentation in constants
5. Write tests for configuration layer

**Why first:** Prevents memory leak in production, establishes foundation for all other work.

### Phase 2: Lock Down Positioning
**Goal:** Prevent AI regressions with tests

1. Extract positioning calculations to pure functions
2. Write comprehensive positioning tests (coordinate system contract)
3. Write property-based tests (animation invariants)
4. Update all bar classes to use pure functions

**Why second:** Protects against AI coding mistakes before adding new features.

### Phase 3: Frame Rate Documentation
**Goal:** Clarify multi-rate animation pattern

1. Document dual-layer rendering pattern in background
2. Add timing accuracy tests
3. Consider deltaTime parameter (optional)

**Why third:** Current pattern works, just needs clarity.

### Phase 4: Add New Animation Types
**Goal:** Extend with new notification types

1. Follow inheritance pattern (BackgroundBar → FollowBar)
2. Use config constants and pure functions
3. Write unit tests before implementation
4. Manual OBS testing

**Why fourth:** Build on solid foundation from Phases 1-3.

### Phase 5: Behavior Extraction (Optional)
**Goal:** Composition over inheritance (if needed)

1. Extract LifecycleBehavior
2. Extract DirectionBehavior
3. Update existing bars to use behaviors

**Why last:** Only needed if adding 3+ animation types. Current inheritance works fine.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Magic Numbers in Code
**What:** Hardcoded `120`, `1800`, `0.7` scattered everywhere
**Why bad:** Changes require editing multiple files, inconsistency, hard to maintain
**Instead:** Centralize in `ANIMATION_CONFIG`

### Anti-Pattern 2: Stateful Calculation Functions
**What:** `function calculateX(bar) { bar.x += speed; }`
**Why bad:** Untestable, side effects, breaks pure function pattern
**Instead:** `function calculateX(currentX, speed, direction) { return currentX + speed * direction; }`

### Anti-Pattern 3: Unbounded Caches
**What:** `Map` that grows forever
**Why bad:** Memory leak over long streaming sessions
**Instead:** LRU cache with max size

### Anti-Pattern 4: Testing Canvas Rendering Directly
**What:** Asserting pixel colors in unit tests
**Why bad:** Brittle, slow, misses logic bugs
**Instead:** Test pure calculation functions, use property-based tests for invariants

### Anti-Pattern 5: Coordinate System Assumptions Without Documentation
**What:** Code assumes (0,0) is center without saying so
**Why bad:** AI coding breaks positioning, new developers confused
**Instead:** Document coordinate system in config, test assumptions

### Anti-Pattern 6: Mixed Concerns in Classes
**What:** BackgroundBar handles calculation, rendering, lifecycle, AND event handling
**Why bad:** Hard to test, hard to reuse, violates single responsibility
**Instead:** Separate calculations (pure functions), rendering (base class), behavior (subclass)

### Anti-Pattern 7: Using requestAnimationFrame Directly in Components
**What:** Bar classes calling `requestAnimationFrame`
**Why bad:** Hard to test, tightly couples animation loop to components
**Instead:** Main.js owns animation loop, calls `update()` and `draw()` on bars

---

## Sources & Confidence Assessment

| Topic | Confidence | Sources |
|-------|------------|---------|
| ECS Architecture | HIGH | [Game Engine Architecture 2025](https://generalistprogrammer.com/game-engine-architecture), [GitHub: ECSY](https://github.com/ecsyjs/ecsy), [Ape-ECS](https://github.com/fritzy/ape-ecs) |
| Pure Functions for Testing | HIGH | [Dev.to: Pure Functions 2025](https://dev.to/arkhan/why-pure-functions-are-the-secret-weapon-of-scalable-code-in-2025-4h41), [Pluralsight: Testable JavaScript](https://www.pluralsight.com/tech-blog/testable-javascript-pure-functions/) |
| Centralized Configuration | HIGH | [Semaphore: Constants Layer](https://semaphore.io/blog/constants-layer-javascript) |
| Canvas Memory Management | HIGH | [Konva: Avoid Memory Leaks](https://konvajs.org/docs/performance/Avoid_Memory_Leaks.html), [Reintech: Canvas Performance](https://reintech.io/blog/optimizing-canvas-performance-large-scale-apps), [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) |
| Canvas Testing | HIGH | [askUI: Canvas Testing](https://www.askui.com/blog-posts/html5-canvas-testing-techniques-tools-and-best-practices), [Visual Regression Testing 2025](https://www.getpanto.ai/blog/visual-regression-testing-in-mobile-qa) |
| Frame Rate Management | MEDIUM | Current codebase analysis, general Canvas animation patterns |
| Inheritance vs Composition | HIGH | Current codebase works well, ECS overkill for this scale |

---

## Summary: Architecture Vision

**Current State:** Class-based inheritance with pure calculation functions (solid foundation)

**Target State:**
- **Configuration Layer:** All constants centralized, coordinate system documented
- **Calculation Layer:** Pure functions for all animation math (expand existing)
- **Component Layer:** Inheritance for rendering, composition for behaviors (if needed)
- **Memory Layer:** LRU cache for offscreen canvas (fix leak)
- **Testing Layer:** Position-locking tests, property-based invariant tests

**Key Principle:** **Separate data from behavior, separate calculations from rendering, centralize constants.**

**Build Order:** Fix memory leak & centralize config (Phase 1) → Lock down positioning with tests (Phase 2) → Document frame rates (Phase 3) → Add new animations (Phase 4) → Extract behaviors if needed (Phase 5)

This architecture supports the stated goals:
- ✓ Centralized configuration (config/ layer)
- ✓ Easy addition of new animation types (inheritance + pure functions + config)
- ✓ Prevention of AI coding regressions (position-locking tests, coordinate system docs)
- ✓ Memory leak prevention (LRU cache)
- ✓ Performance optimization (offscreen caching with bounds)

The architecture is **evolutionary, not revolutionary**—it builds on what works in the current codebase rather than requiring a full rewrite.
