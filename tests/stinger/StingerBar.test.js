import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { StingerBar, planStinger } from '../../src/stinger/StingerBar.js';
import { createRandom } from '../../src/shared/motion.js';
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
    const make = (type = 'slanted', duration = 1000, layout = {}) => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      return new StingerBar(ctx, canvas, type, 0, 5, { h: 180, s: 50, l: 50 }, duration, { layout, random: createRandom(99) });
    };

    it('switches phases exactly at the shared timeline boundaries', () => {
      const bar = make('slanted', 1000);
      bar.setTime(bar.inEnd - 0.001);
      expect(bar.phase).toBe('in');
      bar.setTime(bar.inEnd + 0.001);
      expect(bar.phase).toBe('pause');
      bar.setTime(bar.outStart - 0.001);
      expect(bar.phase).toBe('pause');
      bar.setTime(bar.outStart + 0.001);
      expect(bar.phase).toBe('out');
    });

    it('phases add up to exactly the requested duration', () => {
      for (const duration of [600, 1000, 1500, 3000]) {
        const bar = make('slanted', duration);
        expect(bar.outEnd).toBeCloseTo(duration / 1000, 6);
        bar.setTime(duration / 1000 - 0.001);
        expect(bar.active).toBe(true);
        bar.setTime(duration / 1000);
        expect(bar.active).toBe(false);
      }
    });

    it('holds the cut point (50%) inside every bar\'s pause window', () => {
      for (let i = 0; i < 20; i++) {
        const bar = make(i % 2 ? 'slanted' : 'horizontal', 1500, { inDelay: 0.2, inEndScale: 0.85, exitDelay: 0.15 });
        expect(bar.inEnd).toBeLessThanOrEqual(0.75);
        expect(bar.outStart).toBeGreaterThanOrEqual(0.75);
      }
    });

    it('is velocity-continuous across phase changes', () => {
      for (const type of ['slanted', 'horizontal']) {
        const bar = make(type, 1500, { reverseOnExit: type === 'slanted' });
        const eps = 1e-4;
        for (const boundary of [bar.inEnd, bar.outStart]) {
          const before = (bar.positionAt(boundary - eps) - bar.positionAt(boundary - 2 * eps)) / eps;
          const after = (bar.positionAt(boundary + 2 * eps) - bar.positionAt(boundary + eps)) / eps;
          expect(Math.abs(after - before)).toBeLessThan(5);
        }
      }
    });

    it('update(dt) and setTime(t) agree', () => {
      const a = make('slanted', 1000);
      const b = make('slanted', 1000);
      for (let i = 0; i < 30; i++) a.update(1 / 60);
      b.setTime(30 / 60);
      expect(a.x).toBeCloseTo(b.x, 6);
    });
  });

  describe('planStinger', () => {
    const plan = (seed, duration = 1500) => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      return planStinger(ctx, canvas, { h: 24, s: 100, l: 50 }, duration, createRandom(seed));
    };

    it('is deterministic for a seed', () => {
      const a = plan(7).map(b => [b.type, b.targetX, b.y, b.isWhite]);
      const b = plan(7).map(b => [b.type, b.targetX, b.y, b.isWhite]);
      expect(a).toEqual(b);
    });

    it('always has two curtains first, 6 accents, ≥2 white, 2-3 slanted', () => {
      for (let seed = 1; seed <= 50; seed++) {
        const bars = plan(seed);
        expect(bars.slice(0, 2).every(b => b.isBackground)).toBe(true);
        const accents = bars.slice(2);
        expect(accents.length).toBe(6);
        expect(accents.filter(b => b.isWhite).length).toBeGreaterThanOrEqual(2);
        const slanted = accents.filter(b => b.type === 'slanted').length;
        expect(slanted).toBeGreaterThanOrEqual(2);
        expect(slanted).toBeLessThanOrEqual(3);
      }
    });

    it('spreads horizontal bars over the height (no clumping)', () => {
      for (let seed = 1; seed <= 50; seed++) {
        const ys = plan(seed).filter(b => b.type === 'horizontal').map(b => b.y).sort((x, y) => x - y);
        const span = ys[ys.length - 1] - ys[0];
        expect(span).toBeGreaterThan(1080 * 0.3);
      }
    });

    it('horizontal bars span the whole screen through the hold at any duration', () => {
      const tan = Math.abs(Math.tan(15 * Math.PI / 180));
      for (const duration of [1000, 1500, 3000, 5000, 8000]) {
        for (let seed = 1; seed <= 50; seed++) {
          for (const bar of plan(seed, duration).filter(b => b.type === 'horizontal')) {
            for (let t = bar.inEnd; t <= bar.outStart; t += (bar.outStart - bar.inEnd) / 10) {
              bar.setTime(t);
              const skew = tan * bar.height / 2;
              expect(bar.x + skew).toBeLessThanOrEqual(0);
              expect(bar.x + bar.width - skew).toBeGreaterThanOrEqual(1920);
            }
          }
        }
      }
    });

    it('curtains cover the screen edge to edge on wide and tall canvases', () => {
      // The Aitum Vertical canvas runs this stinger at 1080x1920, where the
      // 15° slant pulled the right curtain's bottom corner on screen (QA
      // export 2026-10-28: 95.9% coverage at the cut, never 100%)
      const tan = Math.tan(15 * Math.PI / 180);
      const cos = Math.cos(15 * Math.PI / 180);
      for (const [W, H] of [[1920, 1080], [1080, 1920]]) {
        const canvas = createMockCanvas(W, H);
        const ctx = createMockContext(canvas);
        const [left, right] = planStinger(ctx, canvas, { h: 24, s: 100, l: 50 }, 1200, createRandom(1));
        left.setTime(0.5);
        right.setTime(0.5);
        // Far edge of the right curtain at the bottom of the screen, and
        // near edge of the left curtain at the top
        expect(right.x + right.width / cos - H * tan).toBeGreaterThanOrEqual(W);
        expect(left.x).toBeLessThanOrEqual(0);
        // Seam overlap holds too, at the top and bottom
        const sin = Math.sin(15 * Math.PI / 180);
        for (const Y of [0, H]) {
          const leftEdge = left.x + left.width * cos - (Y - left.width * sin) * tan;
          const rightEdge = right.x - Y * tan;
          expect(leftEdge - rightEdge).toBeGreaterThan(20);
        }
      }
    });

    it('curtains meet with overlap so the seam never shows', () => {
      const [left, right] = plan(1);
      left.setTime(0.75);
      right.setTime(0.75);
      // Right edge of the left curtain vs left edge of the right curtain, at
      // the top and bottom of the screen (both slant 15°)
      const tan = Math.tan(15 * Math.PI / 180);
      const cos = Math.cos(15 * Math.PI / 180);
      const sin = Math.sin(15 * Math.PI / 180);
      for (const Y of [0, 1080]) {
        const leftEdge = left.x + left.width * cos - (Y - left.width * sin) * tan;
        const rightEdge = right.x - Y * tan;
        expect(leftEdge - rightEdge).toBeGreaterThan(20);
      }
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
