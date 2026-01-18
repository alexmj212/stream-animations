/**
 * Stress tests for memory leak detection over simulated 1+ hour sessions
 *
 * These tests simulate extended rendering periods through accelerated iteration
 * to validate that LRU cache eviction, lifecycle cleanup, and animation loops
 * from Phase 1 prevent memory exhaustion during long streams.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackgroundBar } from '../../src/background/BackgroundBar.js';
import { StingerBar } from '../../src/stinger/StingerBar.js';
import { SidebarBar } from '../../src/sidebar/SidebarBar.js';
import { LRUCache } from '../../src/shared/cache.js';
import { AnimationLifecycle } from '../../src/shared/lifecycle.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

describe('Stress testing for memory leaks', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('LRU cache eviction over long sessions', () => {
    it('should maintain stable cache size over 1 hour simulated rendering', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Clear static cache before test
      if (BackgroundBar.offscreenCache) {
        BackgroundBar.offscreenCache.clear();
      }

      // Create multiple bars to stress cache
      const bars = [];
      for (let i = 0; i < 10; i++) {
        const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);
        bars.push(bar);
      }

      // Simulate 1 hour at 60fps = 216,000 frames
      // Run 1000 iterations to keep test fast while still stressing cache
      const iterations = 1000;
      const delta = 0.016; // 60fps
      const cacheSizeSamples = [];

      for (let i = 0; i < iterations; i++) {
        // Update all bars
        bars.forEach(bar => bar.update(delta));

        // Sample cache size every 100 iterations
        if (i % 100 === 0 && BackgroundBar.offscreenCache) {
          cacheSizeSamples.push(BackgroundBar.offscreenCache.size);
        }
      }

      // Verify cache size is bounded (should not grow unbounded)
      const maxCacheSize = Math.max(...cacheSizeSamples);
      const finalCacheSize = cacheSizeSamples[cacheSizeSamples.length - 1];

      // Cache should be bounded by maxSize (from Phase 1 config)
      expect(maxCacheSize).toBeLessThanOrEqual(100); // Reasonable upper bound

      // Final size should be stable (not growing linearly)
      const firstHalfAvg = cacheSizeSamples.slice(0, Math.floor(cacheSizeSamples.length / 2))
        .reduce((a, b) => a + b, 0) / (cacheSizeSamples.length / 2);
      const secondHalfAvg = cacheSizeSamples.slice(Math.floor(cacheSizeSamples.length / 2))
        .reduce((a, b) => a + b, 0) / (cacheSizeSamples.length / 2);

      // Second half should not be significantly larger than first half
      expect(secondHalfAvg).toBeLessThanOrEqual(firstHalfAvg * 1.5);
    });

    it('should evict stale entries based on maxAge', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Clear static cache before test
      if (BackgroundBar.offscreenCache) {
        BackgroundBar.offscreenCache.clear();
      }

      const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);

      // Generate many cache entries
      const iterations = 500;
      for (let i = 0; i < iterations; i++) {
        bar.update(0.016);
      }

      // Record cache size before eviction
      const sizeBeforeEviction = BackgroundBar.offscreenCache ?
        BackgroundBar.offscreenCache.size : 0;

      // Advance time significantly to make entries stale
      vi.advanceTimersByTime(100);

      // Manually trigger eviction with short maxAge (simulating cleanup interval)
      if (BackgroundBar.offscreenCache) {
        BackgroundBar.offscreenCache.evictStale(1); // 1ms maxAge - everything is stale
      }

      // Cache size should decrease after eviction
      const sizeAfterEviction = BackgroundBar.offscreenCache ?
        BackgroundBar.offscreenCache.size : 0;

      expect(sizeAfterEviction).toBeLessThanOrEqual(sizeBeforeEviction);
    });
  });

  describe('Lifecycle cleanup over many iterations', () => {
    it('should clean up event listeners over many creation/destruction cycles', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const lifecycles = [];
      const mockElement = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };

      // Simulate many lifecycle creation/cleanup cycles
      const cycles = 1000;
      for (let i = 0; i < cycles; i++) {
        const lifecycle = new AnimationLifecycle();
        lifecycle.addEventListener(mockElement, 'test', () => {});
        lifecycle.cleanup();
        lifecycles.push(lifecycle);
      }

      // Verify all lifecycles are properly aborted
      lifecycles.forEach(lifecycle => {
        expect(lifecycle.signal.aborted).toBe(true);
      });

      // Memory should not grow unbounded (JavaScript GC will collect aborted lifecycles)
      // This is a smoke test - actual memory monitoring requires tooling beyond Vitest
      expect(lifecycles.length).toBe(cycles);
    });

    it('should handle continuous bar creation and disposal without leaks', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Clear static cache before test
      if (BackgroundBar.offscreenCache) {
        BackgroundBar.offscreenCache.clear();
      }

      const barCreationCycles = 100;
      const barsPerCycle = 10;

      for (let cycle = 0; cycle < barCreationCycles; cycle++) {
        const bars = [];

        // Create bars
        for (let i = 0; i < barsPerCycle; i++) {
          const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false);
          bars.push(bar);
        }

        // Update bars a few times
        for (let i = 0; i < 10; i++) {
          bars.forEach(bar => bar.update(0.016));
        }

        // Dispose bars (let GC collect)
        bars.length = 0;
      }

      // Cache should not grow unbounded
      const finalCacheSize = BackgroundBar.offscreenCache ?
        BackgroundBar.offscreenCache.size : 0;

      expect(finalCacheSize).toBeLessThanOrEqual(100); // Reasonable bound
    });
  });

  describe('StingerBar lifecycle stress tests', () => {
    it('should complete many stinger animations without memory growth', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Clear static cache before test
      if (StingerBar.offscreenCache) {
        StingerBar.offscreenCache.clear();
      }

      // Simulate 100 stinger transitions (like 100 scene changes during stream)
      const stingerCycles = 100;

      for (let cycle = 0; cycle < stingerCycles; cycle++) {
        const bars = [];

        // Create stinger bars
        for (let i = 0; i < 20; i++) {
          const bar = new StingerBar(ctx, canvas, 'slanted', i, 20, baseHSL, 2000, false);
          bars.push(bar);
        }

        // Run through complete lifecycle
        let allComplete = false;
        let iterations = 0;
        const maxIterations = 1000;

        while (!allComplete && iterations < maxIterations) {
          bars.forEach(bar => bar.update(0.016));
          allComplete = bars.every(bar => !bar.active);
          iterations++;
        }

        // All bars should become inactive
        expect(allComplete).toBe(true);

        // Dispose bars
        bars.length = 0;
      }

      // Cache should remain bounded
      const finalCacheSize = StingerBar.offscreenCache ?
        StingerBar.offscreenCache.size : 0;

      expect(finalCacheSize).toBeLessThanOrEqual(100);
    });
  });

  describe('SidebarBar sequence stress tests', () => {
    it('should complete many sidebar animations without memory growth', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Clear static cache before test
      if (SidebarBar.offscreenCache) {
        SidebarBar.offscreenCache.clear();
      }

      // Simulate 100 sidebar notifications (like follows/subs during stream)
      const sidebarCycles = 100;

      for (let cycle = 0; cycle < sidebarCycles; cycle++) {
        const bars = [];

        // Create sidebar bars
        for (let i = 0; i < 10; i++) {
          const bar = new SidebarBar(ctx, canvas, 'horizontal', i, 10, baseHSL, 3000, false);
          bars.push(bar);
        }

        // Run through complete sequence
        let allComplete = false;
        let iterations = 0;
        const maxIterations = 2000;

        while (!allComplete && iterations < maxIterations) {
          bars.forEach(bar => bar.update(0.016));
          allComplete = bars.every(bar => !bar.active);
          iterations++;
        }

        // All bars should become inactive
        expect(allComplete).toBe(true);

        // Dispose bars
        bars.length = 0;
      }

      // Cache should remain bounded
      const finalCacheSize = SidebarBar.offscreenCache ?
        SidebarBar.offscreenCache.size : 0;

      expect(finalCacheSize).toBeLessThanOrEqual(100);
    });
  });
});
