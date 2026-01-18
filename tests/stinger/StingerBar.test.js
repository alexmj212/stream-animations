import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { StingerBar } from '../../src/stinger/StingerBar.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

describe('StingerBar phase transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('slanted bar lifecycle phases', () => {
    it('should progress through in -> pause -> out phases for slanted bars', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // StingerBar constructor signature: (ctx, canvas, type, index, total, baseHSL, duration, options)
      const bar = new StingerBar(ctx, canvas, 'slanted', 0, 5, baseHSL, 1000, {});

      // Track phase progression
      const phases = [bar.phase];

      // Get durations from bar
      const inDuration = bar.inDuration;
      const pauseDuration = bar.pauseDuration;
      const outDuration = bar.outDuration;

      // Initial phase should be 'in'
      expect(bar.phase).toBe('in');
      expect(bar.active).toBe(true);

      // Simulate through 'in' phase
      let elapsed = 0;
      while (bar.phase === 'in' && elapsed < inDuration + 0.5) {
        bar.update(0.016);
        elapsed += 0.016;
        if (bar.phase !== phases[phases.length - 1]) {
          phases.push(bar.phase);
        }
      }

      // Should now be in 'pause' phase
      expect(bar.phase).toBe('pause');

      // Simulate through 'pause' phase
      elapsed = 0;
      while (bar.phase === 'pause' && elapsed < pauseDuration + 0.5) {
        bar.update(0.016);
        elapsed += 0.016;
        if (bar.phase !== phases[phases.length - 1]) {
          phases.push(bar.phase);
        }
      }

      // Should now be in 'out' phase
      expect(bar.phase).toBe('out');

      // Simulate through 'out' phase
      elapsed = 0;
      while (bar.active && elapsed < outDuration + 0.5) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Should now be inactive (bar completes by setting active=false)
      expect(bar.active).toBe(false);

      // Verify phase progression order
      expect(phases).toEqual(['in', 'pause', 'out']);
    });

    it('should become inactive after completing out phase', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new StingerBar(ctx, canvas, 'slanted', 0, 5, baseHSL, 1000, {});

      // Fast-forward through all phases
      const totalDuration = bar.inDuration + bar.pauseDuration + bar.outDuration + 1.0;
      let elapsed = 0;
      while (elapsed < totalDuration) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Bar should be inactive
      expect(bar.active).toBe(false);

      // Track position after inactive
      const finalX = bar.x;

      // Continue updating - position should not change when inactive
      for (let i = 0; i < 60; i++) {
        bar.update(0.016);
      }

      expect(bar.x).toBeCloseTo(finalX, 2);
      expect(bar.active).toBe(false);
    });
  });

  describe('horizontal bar lifecycle', () => {
    it('should deactivate when off-screen or duration exceeded', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Create horizontal bar
      const bar = new StingerBar(ctx, canvas, 'horizontal', 0, 5, baseHSL, 1000, {});

      expect(bar.active).toBe(true);

      // Fast-forward until bar deactivates
      const maxDuration = 5.0; // 5 seconds should be more than enough
      let elapsed = 0;
      while (bar.active && elapsed < maxDuration) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Bar should be inactive after moving off screen
      expect(bar.active).toBe(false);
    });
  });

  describe('position bounds', () => {
    it('should maintain positions within reasonable canvas bounds throughout lifecycle - slanted', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new StingerBar(ctx, canvas, 'slanted', 0, 5, baseHSL, 1000, {});

      // Coordinate system contract: Origin at top-left (0,0)
      // X increases rightward (0 to canvas.width)
      // Y increases downward (0 to canvas.height)
      // StingerBar uses inherited AnimatedBar positioning

      // Sample positions throughout full lifecycle
      const positions = [];
      const totalDuration = bar.inDuration + bar.pauseDuration + bar.outDuration;
      let elapsed = 0;

      while (elapsed < totalDuration + 1.0 && bar.active) {
        positions.push({ x: bar.x, y: bar.y, phase: bar.phase });
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Verify all positions remain within reasonable bounds
      // StingerBar can start off-screen and move across, so allow 2x canvas for off-screen rendering
      const maxBound = Math.max(canvas.width, canvas.height) * 2;
      positions.forEach(pos => {
        expect(Math.abs(pos.x)).toBeLessThan(maxBound);
        expect(Math.abs(pos.y)).toBeLessThan(maxBound);
      });
    });

    it('should maintain positions within reasonable canvas bounds throughout lifecycle - horizontal', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new StingerBar(ctx, canvas, 'horizontal', 0, 5, baseHSL, 1000, {});

      // Sample positions throughout full lifecycle
      const positions = [];
      let elapsed = 0;

      while (elapsed < 5.0 && bar.active) {
        positions.push({ x: bar.x, y: bar.y });
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Verify all positions remain within reasonable bounds
      const maxBound = Math.max(canvas.width, canvas.height) * 2;
      positions.forEach(pos => {
        expect(Math.abs(pos.x)).toBeLessThan(maxBound);
        expect(Math.abs(pos.y)).toBeLessThan(maxBound);
      });
    });
  });

  describe('timing behavior', () => {
    it('should transition from in to pause phase at expected time', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new StingerBar(ctx, canvas, 'slanted', 0, 5, baseHSL, 1000, {});

      const inDuration = bar.inDuration;

      // Simulate to just before in->pause transition (account for start delay)
      const startDelay = bar.startDelay / 60; // Convert frames to seconds
      let elapsed = 0;
      while (elapsed < startDelay + inDuration - 0.05) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Should still be in 'in' phase
      expect(bar.phase).toBe('in');

      // Advance past transition point
      while (elapsed < startDelay + inDuration + 0.1) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Should now be in 'pause' phase
      expect(bar.phase).toBe('pause');
    });

    it('should transition from pause to out phase at expected time', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new StingerBar(ctx, canvas, 'slanted', 0, 5, baseHSL, 1000, {});

      const inDuration = bar.inDuration;
      const pauseDuration = bar.pauseDuration;
      const startDelay = bar.startDelay / 60;

      // Fast-forward to pause phase
      let elapsed = 0;
      while (elapsed < startDelay + inDuration + 0.05) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      expect(bar.phase).toBe('pause');

      // Simulate to just before pause->out transition
      while (elapsed < startDelay + inDuration + pauseDuration - 0.05) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Should still be in 'pause' phase
      expect(bar.phase).toBe('pause');

      // Advance past transition point
      while (elapsed < startDelay + inDuration + pauseDuration + 0.1) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Should now be in 'out' phase
      expect(bar.phase).toBe('out');
    });
  });

  describe('opacity behavior', () => {
    it('should maintain consistent opacity throughout lifecycle', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new StingerBar(ctx, canvas, 'slanted', 0, 5, baseHSL, 1000, {});

      // StingerBar sets a random opacity during init and maintains it
      const initialOpacity = bar.opacity;
      expect(initialOpacity).toBeGreaterThanOrEqual(0.6);
      expect(initialOpacity).toBeLessThanOrEqual(1.0);

      // Sample opacity throughout lifecycle
      const opacities = [];
      let elapsed = 0;
      while (elapsed < 3.0 && bar.active) {
        opacities.push(bar.opacity);
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Opacity should remain constant (StingerBar doesn't fade like BackgroundBar)
      opacities.forEach(opacity => {
        expect(opacity).toBeCloseTo(initialOpacity, 2);
      });
    });
  });
});

describe('StingerBar property-based tests', () => {
  test.prop([
    fc.integer({ min: 500, max: 2000 }), // duration in ms
    fc.integer({ min: 0, max: 4 })       // index in sequence
  ], { seed: 53, numRuns: 100 })(
    'slanted bars progress through all phases regardless of duration',
    (duration, index) => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new StingerBar(ctx, canvas, 'slanted', index, 5, baseHSL, duration, {});

      const phases = new Set();
      const totalDuration = bar.inDuration + bar.pauseDuration + bar.outDuration + 1.0;
      let elapsed = 0;

      while (elapsed < totalDuration) {
        phases.add(bar.phase);
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Bar should have passed through all three phases
      expect(phases.has('in')).toBe(true);
      expect(phases.has('pause')).toBe(true);
      expect(phases.has('out')).toBe(true);

      // Bar should be inactive at the end
      expect(bar.active).toBe(false);
    }
  );

  test.prop([
    fc.integer({ min: 500, max: 2000 }), // duration in ms
    fc.float({ min: 0.5, max: 3.0 })     // elapsed time
  ], { seed: 54, numRuns: 100 })(
    'positions remain bounded during animation',
    (duration, elapsedTime) => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      // Test both slanted and horizontal bars
      const barSlanted = new StingerBar(ctx, canvas, 'slanted', 0, 5, baseHSL, duration, {});
      const barHorizontal = new StingerBar(ctx, canvas, 'horizontal', 0, 5, baseHSL, duration, {});

      // Simulate animation for slanted bar
      const stepsSlanted = Math.floor(elapsedTime / 0.016);
      for (let i = 0; i < stepsSlanted; i++) {
        barSlanted.update(0.016);
      }

      // Simulate animation for horizontal bar
      const stepsHorizontal = Math.floor(elapsedTime / 0.016);
      for (let i = 0; i < stepsHorizontal; i++) {
        barHorizontal.update(0.016);
      }

      // Positions should remain within reasonable bounds
      const maxBound = Math.max(canvas.width, canvas.height) * 2;

      expect(Math.abs(barSlanted.x)).toBeLessThan(maxBound);
      expect(Math.abs(barSlanted.y)).toBeLessThan(maxBound);

      expect(Math.abs(barHorizontal.x)).toBeLessThan(maxBound);
      expect(Math.abs(barHorizontal.y)).toBeLessThan(maxBound);
    }
  );

  test.prop([
    fc.integer({ min: 0, max: 9 })  // index in sequence (0-9)
  ], { seed: 55, numRuns: 100 })(
    'slanted bars alternate direction based on index',
    (index) => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };

      const bar = new StingerBar(ctx, canvas, 'slanted', index, 10, baseHSL, 1000, {});

      // Even indices should have direction 1, odd indices should have direction -1
      if (index % 2 === 0) {
        expect(bar.direction).toBe(1);
      } else {
        expect(bar.direction).toBe(-1);
      }
    }
  );
});
