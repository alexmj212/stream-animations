import { describe, it, expect } from 'vitest';
import { easings, hermite, hermitePeakSpeed, createRandom, seedFromURL, stratified } from '../../src/shared/motion.js';

describe('easings', () => {
  it.each(Object.entries(easings))('%s maps 0→0 and 1→1 and clamps', (name, fn) => {
    expect(fn(0)).toBeCloseTo(0, 6);
    expect(fn(1)).toBeCloseTo(1, 6);
    expect(fn(-1)).toBeCloseTo(0, 6);
    expect(fn(2)).toBeCloseTo(1, 6);
  });
});

describe('hermite', () => {
  it('hits both endpoints', () => {
    expect(hermite(10, 90, 0, 0, 1, 0)).toBe(10);
    expect(hermite(10, 90, 0, 0, 1, 1)).toBeCloseTo(90);
  });

  it('leaves and arrives with the requested velocities', () => {
    const d = 0.5;
    const eps = 1e-4;
    const v0 = (hermite(0, 100, 300, -50, d, eps) - hermite(0, 100, 300, -50, d, 0)) / eps;
    const v1 = (hermite(0, 100, 300, -50, d, d) - hermite(0, 100, 300, -50, d, d - eps)) / eps;
    expect(v0).toBeCloseTo(300, 0);
    expect(v1).toBeCloseTo(-50, 0);
  });

  it('chained segments are velocity-continuous', () => {
    // segment A ends at velocity 120, segment B starts at 120
    const a = (t) => hermite(0, 500, 0, 120, 0.4, t);
    const b = (t) => hermite(500, 560, 120, 120, 0.5, t);
    const eps = 1e-4;
    const vEndA = (a(0.4) - a(0.4 - eps)) / eps;
    const vStartB = (b(eps) - b(0)) / eps;
    expect(Math.abs(vEndA - vStartB)).toBeLessThan(2);
  });

  it('peak speed of smoothstep is 1.5x the average', () => {
    expect(hermitePeakSpeed(0, 100, 0, 0, 1)).toBeCloseTo(150, -1);
  });
});

describe('createRandom', () => {
  it('is deterministic per seed and in [0,1)', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(createRandom(1)()).not.toBe(createRandom(2)());
  });
});

describe('seedFromURL', () => {
  it('parses integers and returns null otherwise', () => {
    expect(seedFromURL('?seed=12')).toBe(12);
    expect(seedFromURL('?color=%23fff')).toBeNull();
    expect(seedFromURL('?seed=abc')).toBeNull();
  });
});

describe('stratified', () => {
  it('puts exactly one point in each slot', () => {
    const pts = stratified(5, 0, 100, createRandom(3));
    const slots = pts.map(p => Math.floor(p / 20)).sort();
    expect(slots).toEqual([0, 1, 2, 3, 4]);
  });
});
