# Phase 2: Testing Infrastructure - Research

**Researched:** 2026-01-17
**Domain:** JavaScript/Canvas animation testing with Vitest
**Confidence:** HIGH

## Summary

Testing canvas-based animations requires specialized approaches beyond standard unit testing. The standard stack combines Vitest (already in use) with property-based testing via fast-check for animation invariants, vitest-canvas-mock for jsdom canvas support, and tolerance-based assertions for floating-point positioning math.

The research reveals three critical insights:
1. **Canvas in jsdom is incomplete** - HTMLCanvasElement.prototype.getContext is not implemented in jsdom, requiring vitest-canvas-mock for basic canvas testing
2. **Property-based testing is standard for animation invariants** - fast-check with seeded randomness provides reproducible tests for constraints like opacity bounds, speed limits, and position boundaries
3. **Frame-rate independent testing requires delta-time mocking** - requestAnimationFrame must be mocked with vi.useFakeTimers and vi.advanceTimersToNextFrame() to test time-based animations deterministically

**Primary recommendation:** Use @fast-check/vitest integration for property-based tests with fixed seeds (100 runs), vitest-canvas-mock for canvas mocking, and toBeCloseTo() for all position assertions with 0.01 tolerance.

## Standard Stack

The established libraries/tools for JavaScript canvas animation testing:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.0.16+ | Test runner | Already in use, modern, fast, Vite-native, jsdom support |
| @fast-check/vitest | latest | Property-based testing | Official fast-check integration, supports seeded reproducible tests, controlled randomness |
| vitest-canvas-mock | latest | Canvas API mocking | Provides HTMLCanvasElement.getContext('2d') in jsdom, tracks draw calls |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsdom | 27.4.0+ | DOM environment | Already configured, lightweight browser simulation |
| @vitest/coverage-v8 | 4.0.16+ | Coverage reporting | Already in use, identifies untested code paths |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @fast-check/vitest | jsverify | fast-check has better TypeScript support, active maintenance, better shrinking |
| vitest-canvas-mock | node-canvas | node-canvas requires native compilation (node-gyp), heavier, but provides real rendering |
| jsdom | @vitest/browser with playwright | Real browser testing more accurate but 10x slower, overkill for unit tests |

**Installation:**
```bash
npm install --save-dev @fast-check/vitest vitest-canvas-mock
```

**Configuration (vitest.config.js):**
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.js',
        '**/index.html'
      ]
    }
  }
});
```

**Setup file (vitest.setup.js):**
```javascript
import 'vitest-canvas-mock';
import { vi } from 'vitest';

// Re-initialize canvas mock after vi.resetAllMocks()
import { setupVitestCanvasMock } from 'vitest-canvas-mock';
global.setupVitestCanvasMock = setupVitestCanvasMock;
```

## Architecture Patterns

### Recommended Test Structure
```
tests/
├── fixtures/                # Shared test data
│   ├── canvas-contexts.js   # Mock canvas/context creators
│   ├── animation-states.js  # Common animation state objects
│   └── config-overrides.js  # Test-specific config variations
├── background/              # Mirror source structure
│   └── BackgroundBar.test.js
├── stinger/
│   └── StingerBar.test.js
├── sidebar/
│   └── SidebarBar.test.js
└── shared/
    ├── AnimatedBar.test.js
    ├── animations/
    │   └── calculations.test.js
    ├── timing.test.js
    └── cache.test.js
```

### Pattern 1: Tolerance-Based Position Assertions
**What:** Use toBeCloseTo() for all floating-point coordinate comparisons
**When to use:** Any test asserting positions, dimensions, or animation progress values
**Example:**
```javascript
// Source: Vitest documentation + project requirements
import { describe, it, expect } from 'vitest';

describe('bar positioning', () => {
  it('should position bar at center of canvas', () => {
    const canvas = { width: 1920, height: 1080 };
    const bar = new BackgroundBar(mockCtx, canvas, 'slanted');

    // Coordinate system contract: Origin at top-left (0,0)
    // X increases rightward, Y increases downward
    const expectedX = canvas.width / 2;  // 960
    const expectedY = canvas.height / 2; // 540

    // Use 0.01 tolerance for floating-point precision
    expect(bar.x).toBeCloseTo(expectedX, 2);  // 2 decimal places = 0.01 tolerance
    expect(bar.y).toBeCloseTo(expectedY, 2);
  });
});
```

### Pattern 2: Property-Based Animation Invariants
**What:** Test that animation properties hold across random inputs using fast-check
**When to use:** Validating constraints that must always be true (opacity 0-1, speeds positive, positions in bounds)
**Example:**
```javascript
// Source: @fast-check/vitest documentation
import { test, fc } from '@fast-check/vitest';
import { expect } from 'vitest';

// Fixed seed for reproducibility
test.prop([
  fc.float({ min: 0, max: 2 }),     // opacity multiplier
  fc.float({ min: -1, max: 2 }),    // speed multiplier
  fc.integer({ min: 0, max: 7200 }) // frame count
], { seed: 42, numRuns: 100 })(
  'opacity always stays within 0-1 bounds',
  (opacityMult, speedMult, frameCount) => {
    const bar = new BackgroundBar(mockCtx, mockCanvas, 'slanted');
    bar.opacityMultiplier = opacityMult;
    bar.speedMultiplier = speedMult;

    // Simulate animation frames
    for (let i = 0; i < frameCount; i++) {
      bar.update(0.016); // 60fps delta
    }

    // Invariant: opacity must always be [0, 1]
    expect(bar.opacity).toBeGreaterThanOrEqual(0);
    expect(bar.opacity).toBeLessThanOrEqual(1);
  }
);
```

### Pattern 3: Continuous Sampling Throughout Animation
**What:** Test positions at multiple points during animation, not just start/end
**When to use:** Position-locking tests that verify trajectories
**Example:**
```javascript
// Source: Project requirements + animation testing best practices
import { describe, it, expect, vi } from 'vitest';

describe('slanted bar animation trajectory', () => {
  it('should move rightward continuously during visible phase', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });

    const bar = new BackgroundBar(mockCtx, mockCanvas, 'slanted');
    const positions = [];

    // Coordinate system contract: X increases rightward (0 to canvas.width)
    // Sample position every 100ms for 2 seconds
    const samplingInterval = 0.1; // 100ms
    const duration = 2.0; // 2 seconds
    const samples = Math.floor(duration / samplingInterval);

    for (let i = 0; i < samples; i++) {
      bar.update(samplingInterval);
      positions.push(bar.x);
    }

    // Verify monotonic rightward movement (each X > previous X)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }

    vi.useRealTimers();
  });
});
```

### Pattern 4: Mocking requestAnimationFrame
**What:** Use vi.useFakeTimers with vi.advanceTimersToNextFrame() for deterministic animation frame testing
**When to use:** Any test involving requestAnimationFrame-based animation loops
**Example:**
```javascript
// Source: Vitest documentation
import { describe, it, expect, vi } from 'vitest';

describe('animation loop', () => {
  it('should execute animation frame callbacks', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });

    let frameCount = 0;
    const animate = () => {
      frameCount++;
      if (frameCount < 10) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);

    // Advance 10 animation frames
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersToNextFrame();
    }

    expect(frameCount).toBe(10);

    vi.useRealTimers();
  });
});
```

### Pattern 5: Canvas Draw Call Inspection
**What:** Use vitest-canvas-mock's __getDrawCalls() to verify rendering operations
**When to use:** Integration tests verifying bars are actually drawn
**Example:**
```javascript
// Source: jest-canvas-mock documentation (vitest-canvas-mock inherits)
import { describe, it, expect } from 'vitest';

describe('bar rendering', () => {
  it('should draw bar to canvas context', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    const bar = new BackgroundBar(ctx, canvas, 'slanted');
    bar.draw();

    // vitest-canvas-mock tracks all draw operations
    const drawCalls = ctx.__getDrawCalls();

    // Should have fillRect or similar drawing operations
    expect(drawCalls.length).toBeGreaterThan(0);
    expect(drawCalls.some(call => call.type === 'fillRect')).toBe(true);
  });
});
```

### Pattern 6: Shared Fixtures
**What:** Create reusable test fixtures in tests/fixtures/ directory
**When to use:** When same test data is needed across 3+ test files
**Example:**
```javascript
// tests/fixtures/canvas-contexts.js
export function createMockCanvas(width = 1920, height = 1080) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createMockContext(canvas) {
  const ctx = canvas.getContext('2d');
  // Add any test-specific spy/mock behavior
  return ctx;
}

// Usage in tests
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

describe('BackgroundBar', () => {
  it('should initialize with canvas', () => {
    const canvas = createMockCanvas();
    const ctx = createMockContext(canvas);
    const bar = new BackgroundBar(ctx, canvas, 'slanted');
    expect(bar.canvas).toBe(canvas);
  });
});
```

### Anti-Patterns to Avoid
- **Exact float equality (toBe/toEqual):** JavaScript floating-point math is imprecise (0.1 + 0.2 !== 0.3). Always use toBeCloseTo() for coordinates and animation values.
- **Testing canvas pixel data:** vitest-canvas-mock doesn't render actual pixels. Don't test getImageData() or pixel colors unless using real browser testing.
- **Mocking canvas methods manually:** Use vitest-canvas-mock instead of manual mocks. Manual mocks miss edge cases and validation behavior.
- **Frame-counting instead of time-based testing:** Test with delta-time (seconds), not frame counts. This matches the delta-time animation system from Phase 1.
- **Ignoring coordinate system contracts:** Every position test should have a comment documenting the coordinate system (origin at top-left, X rightward, Y downward).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Testing random animation behavior reproducibly | Custom seeded PRNG, manual seed tracking | fast-check with fixed seeds, @fast-check/vitest | Automatic shrinking finds minimal failing case, built-in replay via seed+path, integrates with vitest test runner |
| Canvas API in jsdom tests | Manual HTMLCanvasElement.prototype.getContext mock | vitest-canvas-mock | Mocks entire Canvas API correctly, validates parameters like browsers do, tracks draw calls for inspection |
| Floating-point position assertions | Custom epsilon comparison functions | vitest toBeCloseTo(value, numDigits) | Built-in, works with error messages, numDigits=2 gives 0.01 tolerance (sufficient for pixel coords) |
| requestAnimationFrame in tests | setTimeout approximations, manual frame tracking | vi.useFakeTimers + vi.advanceTimersToNextFrame() | Deterministic frame advancement, no race conditions, matches browser behavior |
| Property-based test inputs | Manual random value generation with Math.random | fast-check arbitraries (fc.integer, fc.float, fc.tuple) | Automatic shrinking, built-in constraints, reproducible with seeds |

**Key insight:** Animation testing has subtle edge cases (float precision, async timing, canvas API quirks). Using battle-tested libraries prevents flaky tests and maintenance burden. Fast-check's shrinking alone saves hours of debugging by finding minimal failing inputs.

## Common Pitfalls

### Pitfall 1: Canvas Methods Return Undefined in jsdom
**What goes wrong:** Tests fail with "Cannot read property 'fillRect' of null" or similar when calling canvas.getContext('2d')
**Why it happens:** jsdom doesn't implement Canvas API - HTMLCanvasElement.prototype.getContext returns null/undefined
**How to avoid:** Install vitest-canvas-mock and import in setupFiles before any tests run
**Warning signs:**
- Errors like "Not implemented: HTMLCanvasElement.prototype.getContext"
- ctx is null/undefined in tests
- Draw methods fail immediately

**Solution:**
```javascript
// vitest.setup.js
import 'vitest-canvas-mock';
```

### Pitfall 2: Brittle Position Tests with Exact Equality
**What goes wrong:** Tests fail intermittently with values like "Expected: 960, Received: 959.9999999"
**Why it happens:** Floating-point arithmetic in JavaScript is imprecise due to binary representation (0.1 + 0.2 = 0.30000000000000004)
**How to avoid:** Always use toBeCloseTo() for floating-point values, never toBe() or toEqual()
**Warning signs:**
- Tests fail with tiny differences (< 0.01)
- Position tests only pass sometimes
- Math operations on positions cause failures

**Solution:**
```javascript
// Bad
expect(bar.x).toBe(960);

// Good - 2 decimal places = 0.01 tolerance
expect(bar.x).toBeCloseTo(960, 2);
```

### Pitfall 3: Testing Canvas Rendering Without Real Browser
**What goes wrong:** Tests pass but visual bugs exist in production because mock doesn't actually render
**Why it happens:** vitest-canvas-mock tracks draw calls but doesn't produce pixels - it can't catch visual rendering issues
**How to avoid:** Use visual regression testing with @vitest/browser or separate E2E tests for pixel-perfect verification. Unit tests verify logic, not visuals.
**Warning signs:**
- Tests pass but bars don't appear correctly in OBS
- Color/brightness issues not caught by tests
- Shadow rendering problems in production

**Mitigation:** Focus unit tests on position/opacity/timing logic. Use manual testing or visual regression for rendering quality.

### Pitfall 4: Non-Deterministic requestAnimationFrame Tests
**What goes wrong:** Tests timing out, flaky failures, race conditions with async animation loops
**Why it happens:** requestAnimationFrame is async and timing-dependent - without mocking, tests depend on actual frame timing
**How to avoid:** Always use vi.useFakeTimers with toFake: ['requestAnimationFrame'], advance frames explicitly with vi.advanceTimersToNextFrame()
**Warning signs:**
- Tests hang or timeout
- Async tests fail intermittently
- Animation frame count varies between runs

**Solution:**
```javascript
import { vi } from 'vitest';

// Setup
vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });

// Test animation
requestAnimationFrame(callback);
vi.advanceTimersToNextFrame(); // Explicit frame advance

// Cleanup
vi.useRealTimers();
```

### Pitfall 5: Property Tests Without Fixed Seeds
**What goes wrong:** Property-based tests fail non-deterministically, can't reproduce failures, different developers see different failures
**Why it happens:** fast-check uses Date.now() as default seed - each test run generates different random inputs
**How to avoid:** Always specify seed parameter in property tests: test.prop([...], { seed: 42, numRuns: 100 })
**Warning signs:**
- Property test failures can't be reproduced
- CI failures don't reproduce locally
- Each test run explores different input space

**Solution:**
```javascript
// Bad - non-deterministic
test.prop([fc.integer()])('test', (n) => { ... });

// Good - reproducible with seed
test.prop([fc.integer()], { seed: 42, numRuns: 100 })('test', (n) => { ... });
```

### Pitfall 6: Forgetting Coordinate System Documentation
**What goes wrong:** Position tests pass but assumptions about coordinate system are wrong, leading to positioning bugs when refactoring
**Why it happens:** Canvas coordinate system (origin top-left, Y downward) is implicit - tests don't document assumptions
**How to avoid:** Every position test should have a comment stating coordinate system contract (origin, axis directions)
**Warning signs:**
- Positioning bugs introduced during refactoring
- Confusion about "up" vs "down" in Y-axis
- Tests pass but bars appear in wrong locations

**Solution:**
```javascript
it('should position bar at center', () => {
  // Coordinate system contract: Origin at top-left (0,0)
  // X-axis increases rightward (0 to canvas.width)
  // Y-axis increases downward (0 to canvas.height)
  const expectedX = canvas.width / 2;
  const expectedY = canvas.height / 2;

  expect(bar.x).toBeCloseTo(expectedX, 2);
  expect(bar.y).toBeCloseTo(expectedY, 2);
});
```

## Code Examples

Verified patterns from official sources:

### Tolerance-Based Position Assertion
```javascript
// Source: Vitest docs - https://vitest.dev/api/expect.html#tobecloseto
describe('bar movement calculations', () => {
  it('should calculate correct position after 1 second of movement', () => {
    const bar = new BackgroundBar(mockCtx, mockCanvas, 'slanted');
    const initialX = bar.x;
    const speed = 100; // pixels per second
    const deltaTime = 1.0; // 1 second

    bar.update(deltaTime);

    // Use 2 decimal places (0.01 tolerance) for pixel coordinates
    expect(bar.x).toBeCloseTo(initialX + speed * deltaTime, 2);
  });
});
```

### Property-Based Invariant Testing
```javascript
// Source: @fast-check/vitest integration docs
import { test, fc } from '@fast-check/vitest';
import { expect } from 'vitest';

test.prop([
  fc.float({ min: 0, max: 1 }),      // base opacity
  fc.float({ min: 0, max: 1 }),      // opacity multiplier
  fc.float({ min: 0.1, max: 2.0 })   // time elapsed
], { seed: 42, numRuns: 100 })(
  'opacity calculation never exceeds bounds',
  (baseOpacity, multiplier, timeElapsed) => {
    const calculatedOpacity = calculateAnimationOpacity(baseOpacity, multiplier, timeElapsed);

    // Invariants that must always hold
    expect(calculatedOpacity).toBeGreaterThanOrEqual(0);
    expect(calculatedOpacity).toBeLessThanOrEqual(1);
  }
);
```

### Canvas Mock Setup
```javascript
// Source: vitest-canvas-mock documentation
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
  }
});

// vitest.setup.js
import 'vitest-canvas-mock';

// Re-initialize after vi.resetAllMocks() if needed
import { setupVitestCanvasMock } from 'vitest-canvas-mock';
global.setupVitestCanvasMock = setupVitestCanvasMock;
```

### Continuous Sampling Test
```javascript
// Source: Project requirements + animation testing patterns
import { describe, it, expect } from 'vitest';

describe('animation trajectory', () => {
  it('should maintain consistent speed throughout visible phase', () => {
    const bar = new BackgroundBar(mockCtx, mockCanvas, 'slanted');
    const samplingInterval = 0.1; // 100ms samples
    const samples = 20; // 2 seconds total
    const speeds = [];

    let prevX = bar.x;

    for (let i = 0; i < samples; i++) {
      bar.update(samplingInterval);

      // Calculate instantaneous speed (distance / time)
      const distance = bar.x - prevX;
      const speed = distance / samplingInterval;
      speeds.push(speed);

      prevX = bar.x;
    }

    // Calculate average speed
    const avgSpeed = speeds.reduce((a, b) => a + b) / speeds.length;

    // All samples should be within 10% of average (consistent speed)
    speeds.forEach(speed => {
      expect(speed).toBeGreaterThan(avgSpeed * 0.9);
      expect(speed).toBeLessThan(avgSpeed * 1.1);
    });
  });
});
```

### Shared Test Fixture
```javascript
// Source: JavaScript test fixtures best practices
// tests/fixtures/canvas-contexts.js
export function createMockCanvas(width = 1920, height = 1080) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createMockContext(canvas) {
  return canvas.getContext('2d');
}

export function createMockBar(type = 'slanted', options = {}) {
  const canvas = createMockCanvas(options.width, options.height);
  const ctx = createMockContext(canvas);
  return {
    bar: new BackgroundBar(ctx, canvas, type, options),
    canvas,
    ctx
  };
}

// Usage in tests
import { createMockBar } from '../fixtures/canvas-contexts.js';

describe('BackgroundBar', () => {
  it('should handle small canvas', () => {
    const { bar, canvas } = createMockBar('slanted', { width: 800, height: 600 });
    expect(bar.canvas.width).toBe(800);
  });
});
```

### Mocking requestAnimationFrame
```javascript
// Source: Vitest fake timers documentation
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('animation loop', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should advance animation on each frame', () => {
    let frameCount = 0;
    const bar = new BackgroundBar(mockCtx, mockCanvas, 'slanted');

    const animate = () => {
      bar.update(0.016); // 60fps delta
      frameCount++;
      if (frameCount < 60) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);

    // Advance 60 frames
    for (let i = 0; i < 60; i++) {
      vi.advanceTimersToNextFrame();
    }

    expect(frameCount).toBe(60);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Math.random() mocking | fast-check with seeded arbitraries | 2023-2024 | Reproducible property tests, automatic shrinking to minimal failure |
| Manual canvas method mocks | vitest-canvas-mock | 2023+ | Complete Canvas API mocking with validation, easier setup |
| jest with @sinonjs/fake-timers | vitest with vi.useFakeTimers + vi.advanceTimersToNextFrame() | 2023+ | Faster test execution, better Vite integration, same API |
| toBe() with epsilon checks | toBeCloseTo(value, numDigits) | Built-in since Jest 15+ | Cleaner syntax, better error messages, standard practice |
| Example-based only testing | Property-based + example-based hybrid | 2020-2024 | Better edge case coverage, fewer regression bugs |

**Deprecated/outdated:**
- **jest-canvas-mock directly:** Use vitest-canvas-mock (vitest-specific fork) for better integration
- **jsverify:** Unmaintained since 2019, use fast-check instead
- **Snapshot testing for canvas operations:** Canvas mocks don't produce consistent snapshots, use draw call inspection instead
- **@testing-library/react for canvas:** Testing Library doesn't help with canvas - canvas has no DOM structure to query

## Open Questions

Things that couldn't be fully resolved:

1. **Stress testing for memory leaks (TEST-05)**
   - What we know: MemLab from Meta can detect memory leaks via Puppeteer, Bun added heap snapshot API in 2025, memory leak testing is "particularly tricky" in GC environments
   - What's unclear: Best approach for 1+ hour stress tests in CI/local environment, whether to use MemLab (requires Puppeteer/browser) or custom Node.js memory monitoring
   - Recommendation: Start with simple approach - run animation loop for simulated time, monitor process.memoryUsage().heapUsed, assert memory stays below threshold. Consider MemLab later if needed.

2. **Frame rate consistency testing (TEST-04)**
   - What we know: Delta-time system from Phase 1 should make animations frame-rate independent, vi.useFakeTimers can control animation frame timing
   - What's unclear: How to simulate different refresh rates (30/60/120fps) in tests without actual displays
   - Recommendation: Mock DeltaTimer to return different delta values (0.033s for 30fps, 0.016s for 60fps, 0.008s for 120fps), verify animation completes in same total time regardless of frame rate

3. **Exact tolerance values for position matching**
   - What we know: toBeCloseTo() default is 2 decimal places (0.01 tolerance), floating-point precision issues are common
   - What's unclear: Whether 0.01 (2 decimal places) is sufficient for all position tests, or if some need tighter/looser tolerance
   - Recommendation: Start with 0.01 (2 decimal places) for all position tests - this is 1/100th of a pixel, more than sufficient for canvas coordinates. Tighten to 0.001 (3 decimal places) only if 0.01 causes false positives.

4. **Sampling interval for continuous position tests**
   - What we know: User decided on continuous sampling throughout animation, not just endpoints
   - What's unclear: Optimal interval - 50ms vs 100ms vs 200ms for performance vs thoroughness tradeoff
   - Recommendation: 100ms (0.1s) sampling interval provides 10 samples per second, catches most trajectory issues without excessive test runtime. Use 50ms for critical tests, 200ms for long animations.

## Sources

### Primary (HIGH confidence)
- [Vitest Expect API](https://vitest.dev/api/expect.html) - toBeCloseTo() documentation
- [Vitest Fake Timers](https://vitest.dev/config/faketimers) - requestAnimationFrame mocking
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking) - vi.useFakeTimers API
- [GitHub - dubzzz/fast-check](https://github.com/dubzzz/fast-check) - Property-based testing framework
- [fast-check official documentation](https://fast-check.dev/) - Core features and usage
- [fast-check Global Settings](https://fast-check.dev/docs/configuration/global-settings/) - Configuration options
- [fast-check Fake Data](https://fast-check.dev/docs/advanced/fake-data/) - Seeded generators
- [@fast-check/vitest package](https://www.npmjs.com/package/@fast-check/vitest) - Vitest integration
- [Beyond flaky tests - fast-check blog](https://fast-check.dev/blog/2025/03/28/beyond-flaky-tests-bringing-controlled-randomness-to-vitest/) - Seed configuration examples
- [GitHub - wobsoriano/vitest-canvas-mock](https://github.com/wobsoriano/vitest-canvas-mock) - Canvas mocking for Vitest
- [GitHub - hustcc/jest-canvas-mock](https://github.com/hustcc/jest-canvas-mock) - Mock strategy documentation

### Secondary (MEDIUM confidence)
- [jsdom HTMLCanvasElement.getContext Issue #3568](https://github.com/jsdom/jsdom/issues/3568) - jsdom Canvas limitations
- [MDN - requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) - Browser animation API
- [Chris Courses - Standardize framerate](https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors) - Delta-time patterns
- [BrowserStack - Canvas Automation](https://www.browserstack.com/guide/canvas-cypress) - Canvas testing challenges
- [HTML5 Canvas Performance - web.dev](https://web.dev/articles/canvas-performance) - Optimization patterns
- [MDN - Canvas Performance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_animations) - Basic animation patterns

### Tertiary (LOW confidence - flagged for validation)
- [MemLab by Meta](https://engineering.fb.com/2022/09/12/open-source/memlab/) - Memory leak detection (requires browser environment, may be overkill)
- [GitHub - andywer/leakage](https://github.com/andywer/leakage) - Node.js memory leak testing (unmaintained since 2018)
- [Bun - Debugging Memory Leaks](https://bun.com/blog/debugging-memory-leaks) - Heap snapshot API (Bun-specific, may not apply to Node.js)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest already in use, fast-check is industry standard for property-based testing, vitest-canvas-mock is actively maintained and widely used
- Architecture patterns: HIGH - All patterns verified with official documentation and project requirements
- Common pitfalls: HIGH - Based on official issue trackers (jsdom Canvas issues, fast-check seed requirements) and documentation
- Code examples: HIGH - All examples source from official documentation or project requirements
- Open questions: MEDIUM - Stress testing and frame rate testing approaches need experimentation during implementation

**Research date:** 2026-01-17
**Valid until:** Approximately 30 days (stable testing domain, libraries mature, API unlikely to change)

**Key validation notes:**
- toBeCloseTo() tolerance of 0.01 (2 decimal places) is standard practice for pixel coordinates
- Fixed seed (seed: 42) + 100 runs is conservative for fast CI while catching edge cases
- vitest-canvas-mock provides all needed Canvas API mocking without native compilation overhead
- Delta-time testing patterns match Phase 1 implementation (DeltaTimer class)
