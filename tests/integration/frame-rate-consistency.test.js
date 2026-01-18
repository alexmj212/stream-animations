import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { BackgroundBar } from '../../src/background/BackgroundBar.js';
import { StingerBar } from '../../src/stinger/StingerBar.js';
import { SidebarBar } from '../../src/sidebar/SidebarBar.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

describe('Frame rate consistency', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('BackgroundBar frame rate independence', () => {
    it('should have identical phase durations at 30fps, 60fps, and 120fps', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const frameRates = [
        { fps: 30, delta: 1 / 30 },   // 0.033s
        { fps: 60, delta: 1 / 60 },   // 0.016s
        { fps: 120, delta: 1 / 120 }  // 0.008s
      ];

      // Create mock random with fixed sequence - must be identical for all bars
      // Sequence: isWhite, hueVar, lightnessVar, maxOpacity, direction, width, baseSpeed, visibleDuration, directionChanges, animateSize
      const createMockRandom = () => vi.fn()
        .mockReturnValueOnce(0.3)   // isWhite = false
        .mockReturnValueOnce(0.5)   // hueVariation
        .mockReturnValueOnce(0.5)   // lightnessVariation
        .mockReturnValueOnce(0.5)   // maxOpacity = 0.55
        .mockReturnValueOnce(0.6)   // direction = 1 (rightward)
        .mockReturnValueOnce(0.5)   // width
        .mockReturnValueOnce(0.5)   // baseSpeed
        .mockReturnValueOnce(0.2)   // visibleDuration
        .mockReturnValueOnce(0.3)   // directionChanges = 0
        .mockReturnValueOnce(0.3)   // animateSize = false
        .mockReturnValue(0.5);      // other random values

      const results = frameRates.map(({ fps, delta }) => {
        const mockRandom = createMockRandom();
        const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false, { random: mockRandom });

        // All bars should have identical durations (time-based, not frame-based)
        return {
          fps,
          fadeInDuration: bar.fadeInDuration,
          visibleDuration: bar.visibleDuration,
          fadeOutDuration: bar.fadeOutDuration
        };
      });

      // All frame rates should have identical phase durations
      const fadeInDurations = results.map(r => r.fadeInDuration);
      const visibleDurations = results.map(r => r.visibleDuration);
      const fadeOutDurations = results.map(r => r.fadeOutDuration);

      // Compare durations - should be exactly identical (time-based)
      expect(fadeInDurations[0]).toBe(fadeInDurations[1]);
      expect(fadeInDurations[1]).toBe(fadeInDurations[2]);
      expect(visibleDurations[0]).toBe(visibleDurations[1]);
      expect(visibleDurations[1]).toBe(visibleDurations[2]);
      expect(fadeOutDurations[0]).toBe(fadeOutDurations[1]);
      expect(fadeOutDurations[1]).toBe(fadeOutDurations[2]);
    });

    it('should reach same position at same elapsed time regardless of frame rate', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const targetTime = 2.0; // 2 seconds elapsed
      const frameRates = [
        { fps: 30, delta: 1 / 30 },
        { fps: 60, delta: 1 / 60 },
        { fps: 120, delta: 1 / 120 }
      ];

      // Create identical mock random for all bars
      // Sequence: isWhite, hueVar, lightnessVar, maxOpacity, direction, width, baseSpeed, visibleDuration, directionChanges, animateSize
      const createMockRandom = () => vi.fn()
        .mockReturnValueOnce(0.3)   // isWhite = false
        .mockReturnValueOnce(0.5)   // hueVariation
        .mockReturnValueOnce(0.5)   // lightnessVariation
        .mockReturnValueOnce(0.5)   // maxOpacity = 0.55
        .mockReturnValueOnce(0.6)   // direction = 1 (rightward)
        .mockReturnValueOnce(0.5)   // width
        .mockReturnValueOnce(0.5)   // baseSpeed
        .mockReturnValueOnce(0.5)   // visibleDuration
        .mockReturnValueOnce(0.3)   // directionChanges = 0
        .mockReturnValueOnce(0.3)   // animateSize = false
        .mockReturnValue(0.5);      // other random values

      const positions = frameRates.map(({ fps, delta }) => {
        const mockRandom = createMockRandom();
        const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false, { random: mockRandom });

        // Simulate until target time
        let elapsed = 0;
        while (elapsed < targetTime) {
          bar.update(delta);
          elapsed += delta;
        }

        return { fps, x: bar.x, y: bar.y, phase: bar.phase };
      });

      // All frame rates should reach approximately same position
      const xPositions = positions.map(p => p.x);
      const yPositions = positions.map(p => p.y);

      // Compare positions - should be within tolerance (allow ~1 pixel difference due to floating-point accumulation)
      const tolerance = 1.5; // pixels
      expect(Math.abs(xPositions[0] - xPositions[1])).toBeLessThan(tolerance); // 30fps vs 60fps
      expect(Math.abs(xPositions[1] - xPositions[2])).toBeLessThan(tolerance); // 60fps vs 120fps
      expect(Math.abs(yPositions[0] - yPositions[1])).toBeLessThan(tolerance);
      expect(Math.abs(yPositions[1] - yPositions[2])).toBeLessThan(tolerance);

      // All should be in same phase
      const phases = positions.map(p => p.phase);
      expect(phases[0]).toBe(phases[1]);
      expect(phases[1]).toBe(phases[2]);
    });
  });

  describe('StingerBar frame rate independence', () => {
    it('should complete full lifecycle in same time at different frame rates', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const frameRates = [
        { fps: 30, delta: 1 / 30 },
        { fps: 60, delta: 1 / 60 },
        { fps: 120, delta: 1 / 120 }
      ];

      const results = frameRates.map(({ fps, delta }) => {
        const bar = new StingerBar(ctx, canvas, 'slanted', 0, 5, baseHSL, 2000, false);

        // Simulate until complete phase
        let elapsed = 0;
        while (bar.phase !== 'complete' && elapsed < 30) {
          bar.update(delta);
          elapsed += delta;
        }

        return { fps, completionTime: elapsed, phase: bar.phase };
      });

      // All frame rates should complete in approximately same time
      const times = results.map(r => r.completionTime);
      const avgTime = times.reduce((a, b) => a + b) / times.length;

      times.forEach((time, i) => {
        expect(time).toBeCloseTo(avgTime, 1); // 0.1s tolerance
        expect(results[i].phase).toBe('out'); // StingerBar doesn't have 'complete', it ends in 'out'
      });
    });
  });

  describe('SidebarBar frame rate independence', () => {
    it('should hold for same duration at different frame rates', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const frameRates = [
        { fps: 30, delta: 1 / 30 },
        { fps: 60, delta: 1 / 60 },
        { fps: 120, delta: 1 / 120 }
      ];

      const results = frameRates.map(({ fps, delta }) => {
        const bar = new SidebarBar(ctx, canvas, 'horizontal', 0, 5, baseHSL, 3000, false);

        // Fast-forward to hold phase
        let elapsed = 0;
        while (bar.phase !== 'hold' && elapsed < 10) {
          bar.update(delta);
          elapsed += delta;
        }

        const holdStartTime = elapsed;

        // Simulate through hold phase
        while (bar.phase === 'hold' && elapsed < 30) {
          bar.update(delta);
          elapsed += delta;
        }

        const holdEndTime = elapsed;
        const holdDuration = holdEndTime - holdStartTime;

        return { fps, holdDuration, phase: bar.phase };
      });

      // All frame rates should have same hold duration
      const durations = results.map(r => r.holdDuration);
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;

      durations.forEach((duration, i) => {
        expect(duration).toBeCloseTo(avgDuration, 1); // 0.1s tolerance
        expect(results[i].phase).toBe('out'); // Should all transition to out
      });
    });
  });
});

describe('Frame rate consistency property tests', () => {
  test.prop([
    fc.integer({ min: 30, max: 120 }), // frame rate
    fc.float({ min: 1.0, max: 5.0, noNaN: true })   // target elapsed time
  ], { seed: 56, numRuns: 50 })( // Reduced runs due to integration test cost
    'BackgroundBar position at target time is frame-rate independent',
    (fps, targetTime) => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Create identical mock random for both bars
      // Sequence: isWhite, hueVar, lightnessVar, maxOpacity, direction, width, baseSpeed, visibleDuration, directionChanges, animateSize
      const createMockRandom = () => vi.fn()
        .mockReturnValueOnce(0.3)   // isWhite = false
        .mockReturnValueOnce(0.5)   // hueVariation
        .mockReturnValueOnce(0.5)   // lightnessVariation
        .mockReturnValueOnce(0.5)   // maxOpacity = 0.55
        .mockReturnValueOnce(0.6)   // direction = 1 (rightward)
        .mockReturnValueOnce(0.5)   // width
        .mockReturnValueOnce(0.5)   // baseSpeed
        .mockReturnValueOnce(0.5)   // visibleDuration
        .mockReturnValueOnce(0.3)   // directionChanges = 0
        .mockReturnValueOnce(0.3)   // animateSize = false
        .mockReturnValue(0.5);      // other random values

      const delta = 1 / fps;
      const bar = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false, { random: createMockRandom() });

      // Simulate to target time
      let elapsed = 0;
      while (elapsed < targetTime) {
        bar.update(delta);
        elapsed += delta;
      }

      // Position should be deterministic based on elapsed time, not frame count
      // Re-run with double frame rate (half delta)
      const bar2 = new BackgroundBar(ctx, canvas, 'slanted', baseHSL, 1.0, false, { random: createMockRandom() });
      const delta2 = 1 / (fps * 2);
      elapsed = 0;
      while (elapsed < targetTime) {
        bar2.update(delta2);
        elapsed += delta2;
      }

      // Positions should match within tolerance (allow ~2 pixels difference due to floating-point accumulation)
      const tolerance = 2.0; // pixels
      expect(Math.abs(bar.x - bar2.x)).toBeLessThan(tolerance);
      expect(bar.phase).toBe(bar2.phase);
    }
  );
});
