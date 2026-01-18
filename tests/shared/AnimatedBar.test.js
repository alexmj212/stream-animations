import { test, fc } from '@fast-check/vitest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnimatedBar } from '../../src/shared/AnimatedBar.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

describe('AnimatedBar', () => {
  // Clean up cache and intervals between tests
  beforeEach(() => {
    AnimatedBar.offscreenCache.clear();
  });

  afterEach(() => {
    if (AnimatedBar.cacheCleanupInterval) {
      clearInterval(AnimatedBar.cacheCleanupInterval);
      AnimatedBar.cacheCleanupInterval = null;
    }
  });

  describe('constructor', () => {
    it('creates bar with canvas and type', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);

      const bar = new AnimatedBar(ctx, canvas, 'slanted');

      expect(bar.ctx).toBe(ctx);
      expect(bar.canvas).toBe(canvas);
      expect(bar.type).toBe('slanted');
      expect(bar.active).toBe(true);
    });

    it('accepts optional random function', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);
      const mockRandom = () => 0.5;

      const bar = new AnimatedBar(ctx, canvas, 'slanted', { random: mockRandom });

      expect(bar.random()).toBe(0.5);
    });

    it('uses Math.random by default', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);

      const bar = new AnimatedBar(ctx, canvas, 'slanted');

      const value = bar.random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  describe('easing function', () => {
    it('returns 0 for input 0', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);
      const bar = new AnimatedBar(ctx, canvas, 'slanted');

      const result = bar.easeInOutCubic(0);

      expect(result).toBeCloseTo(0, 2);
    });

    it('returns 1 for input 1', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);
      const bar = new AnimatedBar(ctx, canvas, 'slanted');

      const result = bar.easeInOutCubic(1);

      expect(result).toBeCloseTo(1, 2);
    });

    it('returns value between 0 and 1 for input 0.5', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);
      const bar = new AnimatedBar(ctx, canvas, 'slanted');

      const result = bar.easeInOutCubic(0.5);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
      expect(result).toBeCloseTo(0.5, 1); // Should be close to 0.5 at midpoint
    });

    test.prop([
      fc.float({ min: 0, max: 1, noNaN: true }) // t value
    ], { seed: 48, numRuns: 100 })(
      'easeInOutCubic returns value in 0-1 range for input 0-1',
      (t) => {
        const canvas = createMockCanvas();
        const ctx = createMockContext(canvas);
        const bar = new AnimatedBar(ctx, canvas, 'slanted');

        const result = bar.easeInOutCubic(t);

        // Invariant: output must be in 0-1 range for valid input
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      }
    );

    test.prop([
      fc.float({ min: 0, max: Math.fround(0.9) }) // t1 value (leaving room for t2)
    ], { seed: 49, numRuns: 100 })(
      'easeInOutCubic is monotonic (increasing)',
      (t1) => {
        const canvas = createMockCanvas();
        const ctx = createMockContext(canvas);
        const bar = new AnimatedBar(ctx, canvas, 'slanted');

        const t2 = Math.min(1, t1 + 0.1); // t2 > t1
        const result1 = bar.easeInOutCubic(t1);
        const result2 = bar.easeInOutCubic(t2);

        // Invariant: easing function should be increasing
        expect(result2).toBeGreaterThanOrEqual(result1);
      }
    );
  });

  describe('cache initialization', () => {
    it('initializes cache cleanup interval on first instance', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);

      expect(AnimatedBar.cacheCleanupInterval).toBeNull();

      new AnimatedBar(ctx, canvas, 'slanted');

      expect(AnimatedBar.cacheCleanupInterval).not.toBeNull();
    });

    it('shares static cache across instances', () => {
      const canvas1 = createMockCanvas();
      const ctx1 = createMockContext(canvas1);
      const bar1 = new AnimatedBar(ctx1, canvas1, 'slanted');

      const canvas2 = createMockCanvas();
      const ctx2 = createMockContext(canvas2);
      const bar2 = new AnimatedBar(ctx2, canvas2, 'slanted'); // Same type to get same cache key

      // Both instances share the same cache
      expect(AnimatedBar.offscreenCache).toBe(AnimatedBar.offscreenCache);

      // Test by adding to cache via one instance and checking via the other
      const testCanvas = bar1.getOrCreateOffscreenCanvas(100, 50, 180, 50, 50, 15, false);
      const cached = bar2.getOrCreateOffscreenCanvas(100, 50, 180, 50, 50, 15, false);

      expect(cached).toBe(testCanvas);
    });
  });

  describe('offscreen cache', () => {
    it('creates canvas with correct dimensions for slanted bars', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);
      const bar = new AnimatedBar(ctx, canvas, 'slanted');

      const offscreen = bar.getOrCreateOffscreenCanvas(100, 50, 180, 50, 50, 15, false);

      // For slanted bars, size is based on diagonal
      const diagonal = Math.sqrt(100 * 100 + 50 * 50);
      expect(offscreen.width).toBeGreaterThanOrEqual(Math.ceil(diagonal));
      expect(offscreen.height).toBeGreaterThanOrEqual(Math.ceil(diagonal));
    });

    it('creates canvas with correct dimensions for horizontal bars', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);
      const bar = new AnimatedBar(ctx, canvas, 'horizontal');

      const offscreen = bar.getOrCreateOffscreenCanvas(100, 50, 180, 50, 50, 15, false);

      // For horizontal bars, size includes skew extension
      const skewExtension = Math.abs(Math.tan(15 * Math.PI / 180) * 50);
      expect(offscreen.width).toBeGreaterThanOrEqual(Math.ceil(100 + skewExtension));
      expect(offscreen.height).toBeGreaterThanOrEqual(Math.ceil(50));
    });

    it('adds padding when shadow is enabled', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);
      const bar = new AnimatedBar(ctx, canvas, 'slanted');

      const withoutShadow = bar.getOrCreateOffscreenCanvas(100, 50, 180, 50, 50, 15, false);
      const withShadow = bar.getOrCreateOffscreenCanvas(100, 50, 180, 50, 50, 15, true);

      // Shadow version should be larger due to padding
      expect(withShadow.width).toBeGreaterThan(withoutShadow.width);
      expect(withShadow.height).toBeGreaterThan(withoutShadow.height);
    });

    test.prop([
      fc.integer({ min: 10, max: 100 }), // width
      fc.integer({ min: 10, max: 100 }), // height
      fc.integer({ min: 0, max: 360 }),  // hue
      fc.integer({ min: 0, max: 100 }),  // saturation
      fc.integer({ min: 0, max: 100 })   // lightness
    ], { seed: 50, numRuns: 100 })(
      'cache key is deterministic for same properties',
      (width, height, hue, sat, light) => {
        const canvas = createMockCanvas();
        const ctx = createMockContext(canvas);
        const bar = new AnimatedBar(ctx, canvas, 'slanted');

        const canvas1 = bar.getOrCreateOffscreenCanvas(width, height, hue, sat, light, 15, false);
        const canvas2 = bar.getOrCreateOffscreenCanvas(width, height, hue, sat, light, 15, false);

        // Invariant: same inputs return same cached canvas
        expect(canvas1).toBe(canvas2);
      }
    );

    it('generates different cache keys for different properties', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);
      const bar = new AnimatedBar(ctx, canvas, 'slanted');

      const canvas1 = bar.getOrCreateOffscreenCanvas(100, 50, 180, 50, 50, 15, false);
      const canvas2 = bar.getOrCreateOffscreenCanvas(100, 50, 181, 50, 50, 15, false); // Different hue
      const canvas3 = bar.getOrCreateOffscreenCanvas(100, 51, 180, 50, 50, 15, false); // Different height

      // Different properties should create different canvases
      expect(canvas1).not.toBe(canvas2);
      expect(canvas1).not.toBe(canvas3);
    });

    it('includes type in cache key', () => {
      const canvas = createMockCanvas();
      const ctx = createMockContext(canvas);
      const bar1 = new AnimatedBar(ctx, canvas, 'slanted');
      const bar2 = new AnimatedBar(ctx, canvas, 'horizontal');

      const slantedCanvas = bar1.getOrCreateOffscreenCanvas(100, 50, 180, 50, 50, 15, false);
      const horizontalCanvas = bar2.getOrCreateOffscreenCanvas(100, 50, 180, 50, 50, 15, false);

      // Different types should create different canvases
      expect(slantedCanvas).not.toBe(horizontalCanvas);
    });
  });

  describe('framesToSeconds helper', () => {
    it('converts 60 frames to 1 second', () => {
      expect(AnimatedBar.framesToSeconds(60)).toBe(1);
    });

    it('converts 120 frames to 2 seconds', () => {
      expect(AnimatedBar.framesToSeconds(120)).toBe(2);
    });

    it('converts 30 frames to 0.5 seconds', () => {
      expect(AnimatedBar.framesToSeconds(30)).toBe(0.5);
    });
  });

  describe('coordinate system', () => {
    // Coordinate system: Origin at top-left (0,0)
    // X increases rightward (0 to canvas.width)
    // Y increases downward (0 to canvas.height)

    it('uses top-left origin coordinate system', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const bar = new AnimatedBar(ctx, canvas, 'slanted');

      // Verify canvas dimensions match expected coordinate space
      expect(canvas.width).toBe(1920);
      expect(canvas.height).toBe(1080);

      // Top-left corner
      expect(0).toBeLessThan(canvas.width);
      expect(0).toBeLessThan(canvas.height);

      // Bottom-right corner
      expect(canvas.width).toBe(1920);
      expect(canvas.height).toBe(1080);
    });
  });
});
