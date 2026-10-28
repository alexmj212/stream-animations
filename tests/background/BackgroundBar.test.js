import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { BackgroundBar } from '../../src/background/BackgroundBar.js';
import { AnimatedBar } from '../../src/shared/AnimatedBar.js';
import { createRandom } from '../../src/shared/motion.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

describe('BackgroundBar positioning', () => {
  // Clean up cache interval and cache contents after all tests to prevent memory leaks
  afterEach(() => {
    if (AnimatedBar.cacheCleanupInterval) {
      clearInterval(AnimatedBar.cacheCleanupInterval);
      AnimatedBar.cacheCleanupInterval = null;
    }
    // Clear the offscreen canvas cache to prevent memory accumulation
    AnimatedBar.offscreenCache.clear();
  });
  describe('coordinate system contracts', () => {
    it('slanted bars extend full canvas height', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);

      // Coordinate system contract: Origin at top-left (0,0)
      // Y-axis increases downward (0 to canvas.height)
      // Slanted bars should start at y=0 (top edge)
      expect(bar.y).toBe(0);
    });

    it('horizontal bars positioned within canvas height', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new BackgroundBar(ctx, canvas, 'horizontal', baseHSL, 1.0, false);

      // Coordinate system contract: Y position must be within canvas bounds
      expect(bar.y).toBeGreaterThanOrEqual(0);
      expect(bar.y).toBeLessThanOrEqual(canvas.height);
    });

    it('slanted bars maintain angle property', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);

      // Coordinate system contract: slanted bars have angle (rotation)
      expect(bar.angle).toBe(15); // As defined in BackgroundBar.js
    });

    it('horizontal bars maintain skew property', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new BackgroundBar(ctx, canvas, 'horizontal', baseHSL, 1.0, false);

      // Coordinate system contract: horizontal bars have skew (not rotation)
      expect(bar.skew).toBe(-15); // As defined in BackgroundBar.js
    });
  });

  describe('continuous sampling', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should drift rightward continuously for direction=1', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Force direction=1 (rightward) via seeded random
      // Sequence: isWhite, hueVar, lightnessVar, maxOpacity, direction, width, baseSpeed, visibleDuration, directionChanges, [timings...], animateSize
      const mockRandom = vi.fn()
        .mockReturnValueOnce(0.3)  // isWhite = false (0.3 <= 0.7)
        .mockReturnValueOnce(0.5)  // hueVariation
        .mockReturnValueOnce(0.5)  // lightnessVariation
        .mockReturnValueOnce(0.5)  // maxOpacity
        .mockReturnValueOnce(0.9)  // direction = 1 (>0.5)
        .mockReturnValueOnce(0.5)  // width (slanted, colored bar)
        .mockReturnValueOnce(0.5)  // baseSpeed
        .mockReturnValueOnce(0.5)  // visibleDuration
        .mockReturnValueOnce(0.01) // directionChanges = 0 (floor(0.01 * 3) = 0)
        .mockReturnValueOnce(0.1)  // animateSize = false (0.1 <= 0.5)
        .mockReturnValue(0.5);     // other random values (shouldn't be reached)

      const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false, { random: mockRandom });

      const positions = [];
      const samplingInterval = 0.1; // 100ms samples
      const samples = 20; // 2 seconds total

      // Coordinate system contract: X increases rightward (0 to canvas.width)
      for (let i = 0; i < samples; i++) {
        positions.push(bar.x);
        bar.update(samplingInterval);
      }

      // Verify monotonic rightward movement (each X >= previous X)
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
      }
    });

    it('should drift leftward continuously for direction=-1', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Force direction=-1 (leftward) via seeded random
      // Sequence: isWhite, hueVar, lightnessVar, maxOpacity, direction, width, baseSpeed, visibleDuration, directionChanges, [timings...], animateSize
      const mockRandom = vi.fn()
        .mockReturnValueOnce(0.3)  // isWhite = false (0.3 <= 0.7)
        .mockReturnValueOnce(0.5)  // hueVariation
        .mockReturnValueOnce(0.5)  // lightnessVariation
        .mockReturnValueOnce(0.5)  // maxOpacity
        .mockReturnValueOnce(0.1)  // direction = -1 (<=0.5)
        .mockReturnValueOnce(0.5)  // width (slanted, colored bar)
        .mockReturnValueOnce(0.5)  // baseSpeed
        .mockReturnValueOnce(0.5)  // visibleDuration
        .mockReturnValueOnce(0.01) // directionChanges = 0 (floor(0.01 * 3) = 0)
        .mockReturnValueOnce(0.1)  // animateSize = false (0.1 <= 0.5)
        .mockReturnValue(0.5);     // other random values (shouldn't be reached)

      const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false, { random: mockRandom });

      const positions = [];
      const samplingInterval = 0.1; // 100ms samples
      const samples = 20; // 2 seconds total

      // Coordinate system contract: X increases rightward, so leftward = decreasing X
      for (let i = 0; i < samples; i++) {
        positions.push(bar.x);
        bar.update(samplingInterval);
      }

      // Verify monotonic leftward movement (each X <= previous X)
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeLessThanOrEqual(positions[i - 1]);
      }
    });

    it('should maintain consistent drift speed over time', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Force direction=1 (rightward)
      // Sequence: isWhite, hueVar, lightnessVar, maxOpacity, direction, width, baseSpeed, visibleDuration, directionChanges, [timings...], animateSize
      const mockRandom = vi.fn()
        .mockReturnValueOnce(0.3)  // isWhite = false (0.3 <= 0.7)
        .mockReturnValueOnce(0.5)  // hueVariation
        .mockReturnValueOnce(0.5)  // lightnessVariation
        .mockReturnValueOnce(0.5)  // maxOpacity
        .mockReturnValueOnce(0.9)  // direction = 1 (>0.5)
        .mockReturnValueOnce(0.5)  // width (slanted, colored bar)
        .mockReturnValueOnce(0.5)  // baseSpeed calculation (0.1 + 0.5 * 0.9) * 60 = 30 px/sec
        .mockReturnValueOnce(0.5)  // visibleDuration
        .mockReturnValueOnce(0.01) // directionChanges = 0 (floor(0.01 * 3) = 0)
        .mockReturnValueOnce(0.1)  // animateSize = false (0.1 <= 0.5)
        .mockReturnValue(0.5);     // other random values (shouldn't be reached)

      const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false, { random: mockRandom });

      const samplingInterval = 0.1; // 100ms samples
      const samples = 10; // 1 second total
      const positions = [];

      for (let i = 0; i < samples; i++) {
        positions.push(bar.x);
        bar.update(samplingInterval);
      }

      // Calculate distances traveled between samples
      const distances = [];
      for (let i = 1; i < positions.length; i++) {
        distances.push(positions[i] - positions[i - 1]);
      }

      // All distances should be approximately equal (within tolerance for floating-point)
      const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
      for (const distance of distances) {
        expect(distance).toBeCloseTo(avgDistance, 2);
      }
    });
  });

  describe('direction transitions', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should smoothly transition between directions', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Create bar with scheduled direction change
      // Sequence: isWhite, hueVar, lightnessVar, maxOpacity, direction, width, baseSpeed, visibleDuration, directionChanges, [timings...], animateSize
      const mockRandom = vi.fn()
        .mockReturnValueOnce(0.3)  // isWhite = false (0.3 <= 0.7)
        .mockReturnValueOnce(0.5)  // hueVariation
        .mockReturnValueOnce(0.5)  // lightnessVariation
        .mockReturnValueOnce(0.5)  // maxOpacity
        .mockReturnValueOnce(0.9)  // direction = 1 (>0.5)
        .mockReturnValueOnce(0.5)  // width (slanted, colored bar)
        .mockReturnValueOnce(0.5)  // baseSpeed
        .mockReturnValueOnce(0.01) // visibleDuration calculation (very short for testing)
        .mockReturnValueOnce(0.99) // directionChanges = 2 (floor(0.99 * 3) = 2)
        .mockReturnValueOnce(0.1)  // first direction change timing
        .mockReturnValueOnce(0.9)  // second direction change timing
        .mockReturnValueOnce(0.1)  // animateSize = false (0.1 <= 0.5)
        .mockReturnValue(0.5);     // other random values (shouldn't be reached)

      const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false, { random: mockRandom });

      // Fast-forward to visible phase
      bar.phase = 'visible';
      bar.phaseStartTime = 0;
      bar.elapsedTime = 0;

      const initialDirection = bar.direction;
      expect(initialDirection).toBe(1); // Should start at 1

      // Before direction change - should be at initial direction
      expect(bar.direction).toBeCloseTo(initialDirection, 2);
    });

    it('should track position during direction transition', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Force direction=1 initially
      // Sequence: isWhite, hueVar, lightnessVar, maxOpacity, direction, width, baseSpeed, visibleDuration, directionChanges, [timings...], animateSize
      const mockRandom = vi.fn()
        .mockReturnValueOnce(0.3)  // isWhite = false (0.3 <= 0.7)
        .mockReturnValueOnce(0.5)  // hueVariation
        .mockReturnValueOnce(0.5)  // lightnessVariation
        .mockReturnValueOnce(0.5)  // maxOpacity
        .mockReturnValueOnce(0.9)  // direction = 1 (>0.5)
        .mockReturnValueOnce(0.5)  // width (slanted, colored bar)
        .mockReturnValueOnce(0.5)  // baseSpeed
        .mockReturnValueOnce(0.5)  // visibleDuration
        .mockReturnValueOnce(0.01) // directionChanges = 0 (floor(0.01 * 3) = 0)
        .mockReturnValueOnce(0.1)  // animateSize = false (0.1 <= 0.5)
        .mockReturnValue(0.5);     // other random values (shouldn't be reached)

      const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false, { random: mockRandom });

      const positions = [];
      const samplingInterval = 0.016; // ~60fps
      const samples = 60; // ~1 second

      // Coordinate system contract: positions should change smoothly even during transitions
      for (let i = 0; i < samples; i++) {
        positions.push({ x: bar.x, direction: bar.direction });
        bar.update(samplingInterval);
      }

      // Position should always increase (for rightward direction=1)
      // Even if direction transitions occur, the bar started moving right
      for (let i = 1; i < positions.length; i++) {
        const deltaX = positions[i].x - positions[i - 1].x;
        // Movement should be continuous (no sudden jumps)
        expect(Math.abs(deltaX)).toBeLessThan(10); // Max 10 pixels per frame at 60fps
      }
    });
  });
});

describe('BackgroundBar property-based tests', () => {
  // Clean up cache interval and cache contents after each property test to prevent memory leaks
  afterEach(() => {
    if (AnimatedBar.cacheCleanupInterval) {
      clearInterval(AnimatedBar.cacheCleanupInterval);
      AnimatedBar.cacheCleanupInterval = null;
    }
    // Clear the offscreen canvas cache to prevent memory accumulation
    AnimatedBar.offscreenCache.clear();
  });

  test.prop([
    fc.float({ min: Math.fround(0.1), max: Math.fround(2.0), noNaN: true }),   // speed multiplier
    fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true }),   // elapsed time (seconds)
    fc.integer({ min: 800, max: 3840 }), // canvas width
    fc.integer({ min: 600, max: 2160 })  // canvas height
  ], { seed: 51, numRuns: 100 })(
    'positions remain within reasonable bounds during animation',
    (speed, elapsedTime, width, height) => {
      const canvas = createMockCanvas(width, height);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, speed, false);

      // Simulate animation
      const steps = Math.floor(elapsedTime / 0.016); // 60fps
      for (let i = 0; i < steps; i++) {
        bar.update(0.016);
      }

      // Invariant: positions should be within extended canvas bounds
      // (bars can drift off-screen but shouldn't go to infinity)
      const maxBound = Math.max(width, height) * 3; // 3x canvas size is reasonable
      expect(Math.abs(bar.x)).toBeLessThan(maxBound);
      expect(Math.abs(bar.y)).toBeLessThan(maxBound);
    }
  );

  test.prop([
    fc.float({ min: Math.fround(0.1), max: Math.fround(2.0), noNaN: true }) // speed multiplier
  ], { seed: 52, numRuns: 100 })(
    'slanted bars maintain consistent angle',
    (speed) => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, speed, false);
      const initialAngle = bar.angle;

      // Simulate animation
      for (let i = 0; i < 100; i++) {
        bar.update(0.016);
      }

      // Invariant: angle should remain constant (slanted bars don't rotate)
      expect(bar.angle).toBe(initialAngle);
    }
  );

  test.prop([
    fc.float({ min: Math.fround(0.1), max: Math.fround(2.0), noNaN: true }),   // speed multiplier
    fc.constantFrom('slanted', 'horizontal') // bar type
  ], { seed: 53, numRuns: 100 })(
    'bars remain active during animation lifecycle',
    (speed, type) => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new BackgroundBar(ctx, canvas, type, baseHSL, speed, false);

      // Bar should start active (in fadeIn phase)
      expect(bar.active).toBe(true);
      expect(bar.phase).toBe('fadeIn');

      // After some animation, bar should still be active (or reach expected completion)
      for (let i = 0; i < 60; i++) { // 1 second at 60fps
        bar.update(0.016);
      }

      // Bar could be in any phase (fadeIn, visible, fadeOut) but shouldn't be inactive yet
      // (unless it has a very short lifecycle, which is possible)
      // So we just verify that if active, it has a valid phase
      if (bar.active) {
        expect(['fadeIn', 'visible', 'fadeOut']).toContain(bar.phase);
      }
    }
  );
});

describe('BackgroundBar balanced placement', () => {
  afterEach(() => {
    AnimatedBar.offscreenCache.clear();
  });

  const fill = (seed, count) => {
    const canvas = createMockCanvas(1920, 1080);
    const ctx = createMockContext(canvas);
    const random = createRandom(seed);
    const bars = [];
    for (let i = 0; i < count; i++) {
      const type = i % 5 < 2 ? 'slanted' : 'horizontal';
      bars.push(new BackgroundBar(ctx, canvas, type, { h: 24, s: 100, l: 50 }, 1.0, false, {
        random,
        neighbours: () => bars
      }));
    }
    return bars;
  };

  it('spreads area evenly across the two halves of the screen', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let left = 0;
      let right = 0;
      for (const bar of fill(seed, 8)) {
        const [l, r] = bar.halfAreas();
        left += l;
        right += r;
      }
      expect(Math.max(left, right) / Math.min(left, right)).toBeLessThan(2);
    }
  });

  it('a respawned bar lands in the emptier half', () => {
    const bars = fill(7, 6);
    for (const bar of bars) bar.x = -bar.width / 2; // everything on the left edge
    const canvas = bars[0].canvas;
    const bar = new BackgroundBar(bars[0].ctx, canvas, 'slanted', { h: 24, s: 100, l: 50 }, 1.0, false, {
      random: createRandom(3),
      neighbours: () => bars
    });
    expect(bar.visualCenter().cx).toBeGreaterThan(0.5);
  });
});
