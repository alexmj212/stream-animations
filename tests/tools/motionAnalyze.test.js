import { describe, it, expect } from 'vitest';
import { findVelocitySteps, coverageTimeline, evaluate, percentile } from '../../tools/motion/analyze.js';
import { easings, hermite } from '../../src/shared/motion.js';

const FRAME = 1000 / 60;
const trackFrom = (fn, ms) => {
  const out = [];
  for (let t = 0; t <= ms; t += FRAME) out.push({ t, x: fn(t / 1000), y: 0, onscreen: true });
  return out;
};

describe('findVelocitySteps', () => {
  it('passes smooth eased motion', () => {
    const track = trackFrom(t => 2000 * easings.easeInOutCubic(t / 0.6), 600);
    expect(findVelocitySteps(track)).toEqual([]);
  });

  it('flags ease-to-stop followed by an instant drift', () => {
    // 0.4s ease in, then constant 120px/s drift
    const track = trackFrom(t => t < 0.4 ? 1000 * easings.easeInOutCubic(t / 0.4) : 1000 + 120 * (t - 0.4), 800);
    const steps = findVelocitySteps(track);
    expect(steps.length).toBe(1);
    expect(steps[0].t).toBeGreaterThan(390);
    expect(steps[0].t).toBeLessThan(440);
  });

  it('passes velocity-matched hermite hand-off', () => {
    const track = trackFrom(t => t < 0.4 ? hermite(0, 1000, 0, 120, 0.4, t) : 1000 + 120 * (t - 0.4), 800);
    expect(findVelocitySteps(track)).toEqual([]);
  });

  it('ignores off-screen jumps and wrap-arounds', () => {
    const track = trackFrom(t => t < 0.4 ? 0 : 120 * (t - 0.4), 800).map(p => ({ ...p, onscreen: false }));
    expect(findVelocitySteps(track)).toEqual([]);
    const wrap = trackFrom(t => (t * 3000) % 2400, 2000);
    expect(findVelocitySteps(wrap)).toEqual([]);
  });
});

describe('coverageTimeline / evaluate', () => {
  const frames = [];
  for (let i = 1; i <= 120; i++) {
    const t = i * FRAME;
    const opaque = t >= 400 && t <= 1100 ? 1 : t < 1500 ? 0.5 : 0;
    frames.push({ t, workMs: 0.5, ran: 1, pixels: { opaque, visible: opaque }, samples: [] });
  }

  it('finds visibility bounds and cover windows', () => {
    const tl = coverageTimeline(frames);
    expect(tl.firstVisibleMs).toBeCloseTo(FRAME);
    expect(tl.lastVisibleMs).toBeLessThan(1500);
    expect(tl.coverWindows.length).toBe(1);
    expect(tl.endsClear).toBe(true);
  });

  it('evaluates duration and cut-point checks', () => {
    const { results } = evaluate({ fps: 60, checks: { totalDurationMs: 1500, endsClear: true, fullCoverAtMs: 750, fullCoverMinMs: 300, workP95Ms: 1 } }, frames);
    expect(results.every(r => r.pass)).toBe(true);
    const late = evaluate({ fps: 60, checks: { totalDurationMs: 1000 } }, frames).results[0];
    expect(late.pass).toBe(false);
  });
});

describe('percentile', () => {
  it('nearest-rank', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([], 50)).toBe(0);
  });
});

describe('findVelocitySteps edge cases', () => {
  it('passes fast short eases (acceleration flips mid-move are not lurches)', () => {
    for (const ms of [200, 350, 600]) {
      const track = trackFrom(t => 1900 * easings.easeInOutCubic(t / (ms / 1000)), ms + 100);
      expect(findVelocitySteps(track)).toEqual([]);
    }
  });

  it('flags a stop-and-restart (drift into an eased exit from rest)', () => {
    // drift at 120px/s, then an exit that starts from zero velocity
    const track = trackFrom(t => t < 0.3 ? 120 * t : 36 + 2000 * easings.easeInOutCubic((t - 0.3) / 0.6), 900);
    expect(findVelocitySteps(track).length).toBeGreaterThanOrEqual(1);
  });
});

describe('debugEvents check', () => {
  const spec = { fps: 60, checks: { debugEvents: { start: 1, end: 1 } } };
  const snap = (...names) => ({ events: names.map((name, t) => ({ t, name, data: {} })) });

  it('passes exact counts and fails a double start or a missing snapshot', () => {
    expect(evaluate(spec, [], snap('init', 'start', 'end')).results[0].pass).toBe(true);
    expect(evaluate(spec, [], snap('init', 'start', 'start', 'end')).results[0].pass).toBe(false);
    expect(evaluate(spec, [], null).results[0].pass).toBe(false);
  });
});

describe('textOverPanel check', () => {
  const spec = { fps: 60, checks: { textOverPanel: { fromMs: 100, toMs: 200, label: 'the panel' } } };
  const f = (t, textGaps) => ({ t, pixels: { opaque: 0, visible: 0.5, textGaps } });

  it('passes when the canvas is opaque under the text throughout the window', () => {
    expect(evaluate(spec, [f(50, 9), f(100, 0), f(150, 0), f(200, 0)]).results[0].pass).toBe(true);
  });

  it('fails a gap under the text, or text that never shows', () => {
    expect(evaluate(spec, [f(100, 0), f(150, 3), f(200, 0)]).results[0].pass).toBe(false);
    expect(evaluate(spec, [f(100, null), f(150, null)]).results[0].pass).toBe(false);
  });
});
