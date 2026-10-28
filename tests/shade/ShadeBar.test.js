import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { ShadeBar } from '../../src/shade/ShadeBar.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';
import { config } from '../../src/config/config.js';

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

  describe('ShadeBar instance', () => {
    it('creates instance with provided text', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'Test Message', null);

      expect(bar.text).toBe('Test Message');
    });

    it('auto-calculates hold duration when not provided', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'one two three four five', null);

      // 5 words * 200ms = 1000ms → 3000ms enforced
      expect(bar.holdDurationMs).toBe(3000);
    });

    it('uses provided hold duration when specified', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'Test', 8000);

      expect(bar.holdDurationMs).toBe(8000);
    });

    it('lasts enter + settle + hold + exit + the curtains opening', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const bar = new ShadeBar(ctx, canvas, 'Test', 3000);
      const { durationMs, settleMs } = config.design.motion;
      expect(bar.totalDurationMs).toBe(durationMs.enter + settleMs + 3000 + durationMs.exit + config.shade.curtainMoveMs);
    });

    it('ends before OBS hides the source (10s), however long the text', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);
      const bar = new ShadeBar(ctx, canvas, 'word '.repeat(80), null);
      expect(bar.totalDurationMs).toBeLessThanOrEqual(config.shade.timing.maxTotalMs);
      expect(config.shade.timing.maxTotalMs).toBeLessThan(10000);
    });

    it('starts with zero animation time and no measured text', () => {
      const canvas = createMockCanvas(1920, 1080);
      const ctx = createMockContext(canvas);

      const bar = new ShadeBar(ctx, canvas, 'Test', null);

      expect(bar.totalAnimationTime).toBe(0);
      expect(bar.textWidth).toBe(0);
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
});

describe('ShadeBar still text (design audit #33)', () => {
  // Every glyph 0.6em wide, so fitting is predictable under the canvas mock
  const make = async (text = 'NEW RAID INCOMING', holdMs = 3000) => {
    const canvas = createMockCanvas(1920, 1080);
    const ctx = createMockContext(canvas);
    ctx.measureText = (s) => {
      const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(ctx.font)[1]);
      return { width: s.length * px * 0.6, actualBoundingBoxAscent: px * 0.7, actualBoundingBoxDescent: px * 0.05 };
    };
    const bar = new ShadeBar(ctx, canvas, text, holdMs);
    await bar.init();
    return bar;
  };

  it('arrives from off the right edge and leaves past the left edge', async () => {
    const bar = await make();
    expect(bar.positionAt(0)).toBeGreaterThanOrEqual(1920);
    expect(bar.positionAt(bar.timeline.exitEnd) + bar.textWidth).toBeLessThanOrEqual(0);
  });

  it('holds still, centred, from the end of the enter to the start of the exit', async () => {
    const bar = await make();
    const { enterEnd, exitStart } = bar.timeline;
    expect(exitStart - enterEnd).toBeCloseTo((config.design.motion.settleMs + 3000) / 1000, 6);
    for (let t = enterEnd; t <= exitStart; t += 0.1) {
      expect(bar.positionAt(t)).toBeCloseTo((1920 - bar.textWidth) / 2, 6);
    }
  });

  it('eases into and out of the hold at rest', async () => {
    const bar = await make();
    const { enterEnd, exitStart } = bar.timeline;
    const v = (t) => (bar.positionAt(t + 1e-4) - bar.positionAt(t - 1e-4)) / 2e-4;
    expect(Math.abs(v(enterEnd - 2e-4))).toBeLessThan(50);
    expect(Math.abs(v(exitStart + 2e-4))).toBeLessThan(50);
  });

  it('stays inside title-safe at hero size when the line fits', async () => {
    const bar = await make('@aspiritualbumpit RAID!!');
    expect(bar.fontPx).toBe(config.design.type.sizes.hero);
    expect(bar.lines).toEqual(['@aspiritualbumpit RAID!!']);
    expect(bar.holdX).toBeGreaterThanOrEqual(96);
    expect(bar.holdX + bar.textWidth).toBeLessThanOrEqual(1824);
  });

  it('wraps a long line to two lines inside title-safe instead of scrolling', async () => {
    const bar = await make('@aspiritualbumpit gifted 50 tier 1 subs to the goobers thank you all!!');
    expect(bar.lines).toHaveLength(2);
    expect(bar.fontPx).toBeGreaterThanOrEqual(config.design.type.minPx);
    expect(bar.holdX).toBeGreaterThanOrEqual(96);
    expect(bar.holdX + bar.textWidth).toBeLessThanOrEqual(1824);
  });

  it('is inactive once the text has left', async () => {
    const bar = await make();
    bar.setTime(bar.timeline.exitEnd);
    expect(bar.active).toBe(false);
  });

  it('update(dt) and setTime(t) agree regardless of frame pacing', async () => {
    const a = await make();
    const b = await make();
    for (const dt of [0.016, 0.05, 0.002, 0.1, 0.033, 0.4]) a.update(dt);
    b.setTime(0.016 + 0.05 + 0.002 + 0.1 + 0.033 + 0.4);
    expect(a.x).toBeCloseTo(b.x, 6);
  });
});
