import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { SidebarBar } from '../../src/sidebar/SidebarBar.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

describe('SidebarBar animation sequence', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sequence phases', () => {
    it('should progress through in -> hold -> out -> inactive', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };
      const duration = 3000; // 3 seconds total

      // SidebarBar constructor: (ctx, canvas, type, index, total, baseHSL, duration, options)
      const bar = new SidebarBar(ctx, canvas, 'horizontal', 0, 1, baseHSL, duration, {});

      // Track phase progression
      const phases = [bar.phase];

      // Get durations from bar
      const slideInDuration = bar.slideInDuration;
      const holdDuration = bar.holdDuration;
      const slideOutDuration = bar.slideOutDuration;

      // Simulate through slideIn phase (phase = 'in')
      let elapsed = 0;
      while (bar.phase === 'in' && elapsed < slideInDuration + 0.1) {
        bar.update(0.016);
        elapsed += 0.016;
        if (bar.phase !== phases[phases.length - 1]) {
          phases.push(bar.phase);
        }
      }

      // Should now be in hold phase
      expect(bar.phase).toBe('hold');

      // Simulate through hold phase
      elapsed = 0;
      while (bar.phase === 'hold' && elapsed < holdDuration + 0.1) {
        bar.update(0.016);
        elapsed += 0.016;
        if (bar.phase !== phases[phases.length - 1]) {
          phases.push(bar.phase);
        }
      }

      // Should now be in slideOut phase (phase = 'out')
      expect(bar.phase).toBe('out');

      // Simulate through slideOut phase
      elapsed = 0;
      while (bar.phase === 'out' && elapsed < slideOutDuration + 0.1 && bar.active) {
        bar.update(0.016);
        elapsed += 0.016;
        if (bar.phase !== phases[phases.length - 1]) {
          phases.push(bar.phase);
        }
      }

      // Should now be inactive (active = false)
      expect(bar.active).toBe(false);

      // Verify phase progression order
      expect(phases).toEqual(['in', 'hold', 'out']);
    });

    it('should maintain constant position during hold phase', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };
      const duration = 3000;

      // Test with a background bar (isBackground option) which doesn't move during hold
      const bar = new SidebarBar(ctx, canvas, 'horizontal', 0, 1, baseHSL, duration, {});
      // Mark as background to disable hold movement
      bar.isBackground = true;

      // Fast-forward to hold phase
      const slideInDuration = bar.slideInDuration;
      let elapsed = 0;
      while (elapsed < slideInDuration) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      expect(bar.phase).toBe('hold');

      // Record position at start of hold
      const holdStartX = bar.x;
      const holdStartY = bar.y;

      // Simulate through hold phase
      const holdDuration = bar.holdDuration;
      elapsed = 0;
      const positions = [];
      while (bar.phase === 'hold' && elapsed < holdDuration + 0.1) {
        positions.push({ x: bar.x, y: bar.y });
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Verify position remained constant throughout hold (background bar doesn't move)
      positions.forEach(pos => {
        expect(pos.x).toBeCloseTo(holdStartX, 2);
        expect(pos.y).toBeCloseTo(holdStartY, 2);
      });
    });

    it('should stop updating after becoming inactive', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };
      const duration = 3000;

      const bar = new SidebarBar(ctx, canvas, 'horizontal', 0, 1, baseHSL, duration, {});

      // Fast-forward to inactive state
      const totalDuration = bar.slideInDuration + bar.holdDuration + bar.slideOutDuration;
      let elapsed = 0;
      while (elapsed < totalDuration + 1.0 && bar.active) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      expect(bar.active).toBe(false);

      // Track position after inactive
      const finalX = bar.x;
      const finalY = bar.y;

      // Continue updating - position should not change (update() returns early when !active)
      for (let i = 0; i < 60; i++) {
        bar.update(0.016);
      }

      expect(bar.x).toBeCloseTo(finalX, 2);
      expect(bar.y).toBeCloseTo(finalY, 2);
      expect(bar.active).toBe(false);
    });
  });

  describe('easing behavior', () => {
    it('should use easing for smooth slideIn transition', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };
      const duration = 3000;

      const bar = new SidebarBar(ctx, canvas, 'horizontal', 0, 1, baseHSL, duration, {});

      const startX = bar.x;
      const positions = [];

      // Sample positions throughout slideIn (phase = 'in')
      let elapsed = 0;
      while (bar.phase === 'in' && elapsed < bar.slideInDuration + 0.1) {
        positions.push(bar.x);
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Verify movement occurred (not static)
      expect(positions[positions.length - 1]).not.toBeCloseTo(startX, 2);

      // Verify easing (acceleration/deceleration, not linear)
      // Calculate deltas between consecutive positions
      const deltas = [];
      for (let i = 1; i < positions.length; i++) {
        deltas.push(Math.abs(positions[i] - positions[i - 1]));
      }

      // Easing should show variation in movement speed (not constant delta)
      const avgDelta = deltas.reduce((a, b) => a + b) / deltas.length;
      const variance = deltas.reduce((sum, d) => sum + Math.pow(d - avgDelta, 2), 0) / deltas.length;

      // Variance > 0 indicates non-linear movement (easing)
      expect(variance).toBeGreaterThan(0);
    });

    it('should use easing for smooth slideOut transition', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };
      const duration = 3000;

      const bar = new SidebarBar(ctx, canvas, 'horizontal', 0, 1, baseHSL, duration, {});

      // Fast-forward to slideOut phase (phase = 'out')
      const skipDuration = bar.slideInDuration + bar.holdDuration;
      let elapsed = 0;
      while (elapsed < skipDuration) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      expect(bar.phase).toBe('out');

      const startX = bar.x;
      const positions = [];

      // Sample positions throughout slideOut
      elapsed = 0;
      while (bar.phase === 'out' && elapsed < bar.slideOutDuration + 0.1 && bar.active) {
        positions.push(bar.x);
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Verify movement occurred
      expect(positions[positions.length - 1]).not.toBeCloseTo(startX, 2);

      // Verify easing (non-linear movement)
      const deltas = [];
      for (let i = 1; i < positions.length; i++) {
        deltas.push(Math.abs(positions[i] - positions[i - 1]));
      }

      const avgDelta = deltas.reduce((a, b) => a + b) / deltas.length;
      const variance = deltas.reduce((sum, d) => sum + Math.pow(d - avgDelta, 2), 0) / deltas.length;

      expect(variance).toBeGreaterThan(0);
    });
  });

  describe('position bounds', () => {
    it('should maintain positions within reasonable canvas bounds throughout sequence', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };
      const duration = 3000;

      const bar = new SidebarBar(ctx, canvas, 'horizontal', 0, 1, baseHSL, duration, {});

      // Coordinate system contract: Origin at top-left (0,0)
      // X increases rightward (0 to canvas.width)
      // Y increases downward (0 to canvas.height)
      // SidebarBar slides in/out horizontally (X changes, Y stable for horizontal bars)

      // Sample positions throughout full sequence
      const positions = [];
      const totalDuration = bar.slideInDuration + bar.holdDuration + bar.slideOutDuration;
      let elapsed = 0;

      while (elapsed < totalDuration + 0.5 && bar.active) {
        positions.push({ x: bar.x, y: bar.y, phase: bar.phase });
        bar.update(0.016);
        elapsed += 0.016;
      }

      // Verify all positions remain within reasonable bounds
      // SidebarBar slides in from off-screen, so X may exceed canvas bounds temporarily
      const maxBound = Math.max(canvas.width, canvas.height) * 2; // Allow 2x canvas for off-screen positions
      positions.forEach(pos => {
        expect(Math.abs(pos.x)).toBeLessThan(maxBound);
        expect(Math.abs(pos.y)).toBeLessThan(maxBound);
      });
    });
  });
});

describe('SidebarBar property-based tests', () => {
  test.prop([
    fc.float({ min: 0.5, max: 2.0, noNaN: true }) // speed multiplier (affects duration)
  ], { seed: 54, numRuns: 100 })(
    'hold phase duration is consistent',
    (speedMultiplier) => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };
      // Duration is in milliseconds, speed affects it
      const baseDuration = 3000;
      const duration = baseDuration / speedMultiplier;

      const bar = new SidebarBar(ctx, canvas, 'horizontal', 0, 1, baseHSL, duration, {});

      // Fast-forward to hold phase
      let elapsed = 0;
      while (bar.phase !== 'hold' && elapsed < 10) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      expect(bar.phase).toBe('hold');

      // Measure hold phase duration
      const holdStart = elapsed;
      while (bar.phase === 'hold' && elapsed < 30) {
        bar.update(0.016);
        elapsed += 0.016;
      }
      const holdEnd = elapsed;
      const measuredHoldDuration = holdEnd - holdStart;

      // Should match configured duration (within tolerance for frame timing)
      expect(measuredHoldDuration).toBeCloseTo(bar.holdDuration, 1);
    }
  );

  test.prop([
    fc.float({ min: 0.5, max: 2.0, noNaN: true }) // speed multiplier
  ], { seed: 55, numRuns: 100 })(
    'complete sequence completes in expected total time',
    (speedMultiplier) => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };
      const baseDuration = 3000;
      const duration = baseDuration / speedMultiplier;

      const bar = new SidebarBar(ctx, canvas, 'horizontal', 0, 1, baseHSL, duration, {});

      const expectedTotalDuration = bar.slideInDuration + bar.holdDuration + bar.slideOutDuration;

      // Simulate until inactive
      let elapsed = 0;
      while (bar.active && elapsed < expectedTotalDuration + 2.0) {
        bar.update(0.016);
        elapsed += 0.016;
      }

      expect(bar.active).toBe(false);

      // Should complete within reasonable tolerance of expected duration
      expect(elapsed).toBeCloseTo(expectedTotalDuration, 0); // 1 second tolerance
    }
  );

  test.prop([
    fc.float({ min: 0.5, max: 2.0, noNaN: true }),   // speed multiplier
    fc.float({ min: 1.0, max: 10.0, noNaN: true })   // elapsed time
  ], { seed: 56, numRuns: 100 })(
    'positions remain bounded during animation',
    (speedMultiplier, elapsedTime) => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const baseHSL = { h: 180, s: 50, l: 50 };
      const baseDuration = 3000;
      const duration = baseDuration / speedMultiplier;

      const bar = new SidebarBar(ctx, canvas, 'horizontal', 0, 1, baseHSL, duration, {});

      // Simulate animation
      const steps = Math.floor(elapsedTime / 0.016);
      for (let i = 0; i < steps && bar.active; i++) {
        bar.update(0.016);
      }

      // Positions should remain within reasonable bounds
      const maxBound = Math.max(canvas.width, canvas.height) * 2;
      expect(Math.abs(bar.x)).toBeLessThan(maxBound);
      expect(Math.abs(bar.y)).toBeLessThan(maxBound);
    }
  );
});
