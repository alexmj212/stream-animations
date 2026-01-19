import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { ShadeBar } from '../../src/shade/ShadeBar.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

describe('ShadeBar', () => {
  describe('calculateHoldDuration', () => {
    it('returns minimum duration for empty text', () => {
      const duration = ShadeBar.calculateHoldDuration('', 200, 3000);
      expect(duration).toBe(3000);
    });

    it('returns minimum duration for whitespace-only text', () => {
      const duration = ShadeBar.calculateHoldDuration('   ', 200, 3000);
      expect(duration).toBe(3000);
    });

    it('returns minimum duration for short text (1-2 words)', () => {
      const duration = ShadeBar.calculateHoldDuration('Hello', 200, 3000);
      expect(duration).toBe(3000); // 1 word * 200ms = 200ms → 3000ms enforced

      const duration2 = ShadeBar.calculateHoldDuration('Hello world', 200, 3000);
      expect(duration2).toBe(3000); // 2 words * 200ms = 400ms → 3000ms enforced
    });

    it('scales duration with word count for long text', () => {
      // 18 words * 200ms = 3600ms (exceeds 3000ms minimum)
      const longText = 'This is a very long celebratory message for a major raid with lots of text to scroll across';
      const duration = ShadeBar.calculateHoldDuration(longText, 200, 3000);
      expect(duration).toBeGreaterThan(3000);
      expect(duration).toBe(3600); // 18 words * 200ms
    });

    it('handles multiple spaces between words', () => {
      const duration = ShadeBar.calculateHoldDuration('Hello    world', 200, 3000);
      expect(duration).toBe(3000); // Still 2 words
    });

    it('respects custom msPerWord parameter', () => {
      const duration = ShadeBar.calculateHoldDuration('one two three four five', 500, 3000);
      expect(duration).toBe(3000); // 5 words * 500ms = 2500ms → 3000ms enforced

      const duration2 = ShadeBar.calculateHoldDuration('one two three four five six seven', 500, 3000);
      expect(duration2).toBe(3500); // 7 words * 500ms = 3500ms
    });

    it('respects custom minDurationMs parameter', () => {
      const duration = ShadeBar.calculateHoldDuration('Hello', 200, 5000);
      expect(duration).toBe(5000); // 1 word * 200ms = 200ms → 5000ms enforced
    });

    it('handles text with newlines and tabs', () => {
      const duration = ShadeBar.calculateHoldDuration('Hello\nworld\ttest', 200, 3000);
      expect(duration).toBe(3000); // 3 words * 200ms = 600ms → 3000ms enforced
    });

    it('handles text with leading/trailing whitespace', () => {
      const duration = ShadeBar.calculateHoldDuration('   Hello world   ', 200, 3000);
      expect(duration).toBe(3000); // 2 words (trim handles whitespace)
    });
  });

  describe('calculateScrollSpeed', () => {
    it('calculates speed to cover text width + canvas width', () => {
      const textWidth = 1200;
      const canvasWidth = 1920;
      const holdDurationMs = 5000;

      const speed = ShadeBar.calculateScrollSpeed(textWidth, canvasWidth, holdDurationMs);

      // Total distance: 1200 + 1920 = 3120 pixels
      // Time: 5000ms = 5 seconds
      // Speed: 3120 / 5 = 624 px/s
      expect(speed).toBeCloseTo(624, 1);
    });

    it('returns higher speed for shorter hold duration', () => {
      const textWidth = 1000;
      const canvasWidth = 1920;

      const speed3s = ShadeBar.calculateScrollSpeed(textWidth, canvasWidth, 3000);
      const speed5s = ShadeBar.calculateScrollSpeed(textWidth, canvasWidth, 5000);

      expect(speed3s).toBeGreaterThan(speed5s);
    });

    it('returns higher speed for longer text', () => {
      const canvasWidth = 1920;
      const holdDurationMs = 5000;

      const speedShort = ShadeBar.calculateScrollSpeed(500, canvasWidth, holdDurationMs);
      const speedLong = ShadeBar.calculateScrollSpeed(2000, canvasWidth, holdDurationMs);

      expect(speedLong).toBeGreaterThan(speedShort);
    });

    it('handles edge case of very short text', () => {
      const textWidth = 50;
      const canvasWidth = 1920;
      const holdDurationMs = 3000;

      const speed = ShadeBar.calculateScrollSpeed(textWidth, canvasWidth, holdDurationMs);

      // Total distance: 50 + 1920 = 1970 pixels
      // Speed: 1970 / 3 = 656.67 px/s
      expect(speed).toBeCloseTo(656.67, 1);
      expect(speed).toBeGreaterThan(0);
    });

    it('handles edge case of very long text', () => {
      const textWidth = 5000;
      const canvasWidth = 1920;
      const holdDurationMs = 10000;

      const speed = ShadeBar.calculateScrollSpeed(textWidth, canvasWidth, holdDurationMs);

      // Total distance: 5000 + 1920 = 6920 pixels
      // Speed: 6920 / 10 = 692 px/s
      expect(speed).toBeCloseTo(692, 1);
      expect(speed).toBeGreaterThan(0);
    });
  });

  describe('ShadeBar instance', () => {
    it('creates instance with provided text and color', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'Test Message', '#ff6600', null);

      expect(bar.text).toBe('Test Message');
      expect(bar.color).toBe('#ff6600');
    });

    it('auto-calculates hold duration when not provided', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'one two three four five', '#ffffff', null);

      // 5 words * 200ms = 1000ms → 3000ms enforced
      expect(bar.holdDurationMs).toBe(3000);
    });

    it('uses provided hold duration when specified', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'Test', '#ffffff', 8000);

      expect(bar.holdDurationMs).toBe(8000);
    });

    it('initializes position at canvas right edge', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'Test', '#ffffff', null);

      expect(bar.x).toBe(1920); // Offscreen right
      expect(bar.y).toBe(540); // Vertical center
    });

    it('starts in enter phase', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'Test', '#ffffff', null);

      expect(bar.phase).toBe('enter');
      expect(bar.elapsedTime).toBe(0);
    });

    it('initializes textWidth to 0 before init()', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'Test', '#ffffff', null);

      expect(bar.textWidth).toBe(0);
    });
  });

  describe('ShadeBar.init()', () => {
    it('measures text width after font loading', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'Test Message', '#ffffff', null);
      bar.init();

      // measureText should set textWidth to non-zero value
      expect(bar.textWidth).toBeGreaterThan(0);
    });

    it('calculates scroll speed based on text width', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'Test', '#ffffff', 5000);
      bar.init();

      // scrollSpeed should be calculated from textWidth + canvasWidth / holdDuration
      expect(bar.scrollSpeed).toBeGreaterThan(0);
    });

    it('stores phase durations from config', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'Test', '#ffffff', null);
      bar.init();

      // Phase durations should be set from config.shared.durations
      expect(bar.enterDurationMs).toBeDefined();
      expect(bar.exitDurationMs).toBeDefined();
      expect(bar.enterDurationMs).toBeGreaterThan(0);
      expect(bar.exitDurationMs).toBeGreaterThan(0);
    });
  });

  // Property-based tests (following Phase 02 pattern)
  test.prop([fc.string().filter(s => s.trim().length > 0)], { seed: 48, numRuns: 100 })(
    'duration always at least minDurationMs',
    (text) => {
      const duration = ShadeBar.calculateHoldDuration(text, 200, 3000);
      expect(duration).toBeGreaterThanOrEqual(3000);
    }
  );

  test.prop([
    fc.integer({ min: 1, max: 5000 }),
    fc.integer({ min: 1, max: 5000 }),
    fc.integer({ min: 1000, max: 30000 })
  ], { seed: 49, numRuns: 100 })(
    'scroll speed always positive',
    (textWidth, canvasWidth, holdDurationMs) => {
      const speed = ShadeBar.calculateScrollSpeed(textWidth, canvasWidth, holdDurationMs);
      expect(speed).toBeGreaterThan(0);
    }
  );

  test.prop([
    fc.string({ minLength: 1, maxLength: 200 }),
    fc.integer({ min: 50, max: 1000 }),
    fc.integer({ min: 1000, max: 10000 })
  ], { seed: 50, numRuns: 100 })(
    'duration scales proportionally with word count',
    (text, msPerWord, minDurationMs) => {
      const duration = ShadeBar.calculateHoldDuration(text, msPerWord, minDurationMs);

      const words = text.trim().split(/\s+/).filter(word => word.length > 0);
      const wordCount = words.length;
      const expectedDuration = Math.max(wordCount * msPerWord, minDurationMs);

      expect(duration).toBe(expectedDuration);
    }
  );

  test.prop([
    fc.integer({ min: 100, max: 5000 }),
    fc.integer({ min: 800, max: 3840 }),
    fc.integer({ min: 1000, max: 30000 })
  ], { seed: 51, numRuns: 100 })(
    'scroll speed calculation is deterministic',
    (textWidth, canvasWidth, holdDurationMs) => {
      const speed1 = ShadeBar.calculateScrollSpeed(textWidth, canvasWidth, holdDurationMs);
      const speed2 = ShadeBar.calculateScrollSpeed(textWidth, canvasWidth, holdDurationMs);

      // Same inputs should produce identical outputs
      expect(speed1).toBe(speed2);
    }
  );
});
