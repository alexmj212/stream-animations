import { describe, it, expect } from 'vitest';
import {
  cornerLightPositions,
  lightFalloff,
  computeLightColors,
  chasePattern,
  pulsePattern,
  diagonalPattern,
  getPattern,
  shadeFacet
} from '../../src/epcot/lighting.js';

describe('cornerLightPositions', () => {
  it('places each light slightly beyond its corner, clockwise from top-left', () => {
    const [tl, tr, br, bl] = cornerLightPositions(1000, 500, 0.05, 0.35);

    expect(tl.x).toBeLessThan(0);
    expect(tl.y).toBeLessThan(0);

    expect(tr.x).toBeGreaterThan(1000);
    expect(tr.y).toBeLessThan(0);

    expect(br.x).toBeGreaterThan(1000);
    expect(br.y).toBeGreaterThan(500);

    expect(bl.x).toBeLessThan(0);
    expect(bl.y).toBeGreaterThan(500);
  });

  it('raises all lights to the same height, proportional to canvas width', () => {
    const lights = cornerLightPositions(1000, 500, 0.05, 0.35);
    for (const light of lights) {
      expect(light.z).toBeCloseTo(1000 * 0.35, 5);
    }
  });
});

describe('lightFalloff', () => {
  it('scales with the canvas diagonal', () => {
    const falloff = lightFalloff(1920, 1080, 0.45);
    expect(falloff).toBeCloseTo(Math.hypot(1920, 1080) * 0.45, 5);
  });
});

describe('computeLightColors', () => {
  it('returns 4 RGB colors offset in hue from the base color', () => {
    const colors = computeLightColors({ h: 200, s: 60, l: 50 }, [-20, 0, 20, 40]);
    expect(colors).toHaveLength(4);
    for (const c of colors) {
      expect(c.r).toBeGreaterThanOrEqual(0);
      expect(c.r).toBeLessThanOrEqual(1);
      expect(c.g).toBeGreaterThanOrEqual(0);
      expect(c.g).toBeLessThanOrEqual(1);
      expect(c.b).toBeGreaterThanOrEqual(0);
      expect(c.b).toBeLessThanOrEqual(1);
    }
    // Different hue offsets should (generally) produce different colors
    expect(colors[0]).not.toEqual(colors[1]);
    expect(colors[1]).not.toEqual(colors[2]);
  });
});

describe('pattern functions', () => {
  const cycleDuration = 24;
  const patterns = { chasePattern, pulsePattern, diagonalPattern };

  for (const [name, fn] of Object.entries(patterns)) {
    describe(name, () => {
      it('is periodic with period = cycleDuration', () => {
        for (const t of [0, 1.3, 7, 12.75, 23.9]) {
          const a = fn(t, cycleDuration);
          const b = fn(t + cycleDuration, cycleDuration);
          for (let i = 0; i < 4; i++) {
            expect(b[i]).toBeCloseTo(a[i], 4);
          }
        }
      });

      it('stays within [0, 1] across a full cycle', () => {
        for (let t = 0; t < cycleDuration; t += 0.37) {
          const intensities = fn(t, cycleDuration);
          expect(intensities).toHaveLength(4);
          for (const v of intensities) {
            expect(v).toBeGreaterThanOrEqual(-1e-9);
            expect(v).toBeLessThanOrEqual(1 + 1e-9);
          }
        }
      });
    });
  }

  it('chase pattern intensities sum to ~1 at any time', () => {
    for (let t = 0; t < cycleDuration; t += 0.13) {
      const [i0, i1, i2, i3] = chasePattern(t, cycleDuration);
      expect(i0 + i1 + i2 + i3).toBeCloseTo(1, 4);
    }
  });

  it('chase pattern sweeps clockwise: light 0 peaks before light 1', () => {
    const atStart = chasePattern(0, cycleDuration);
    expect(atStart[0]).toBeCloseTo(1, 4);
    expect(atStart[1]).toBeCloseTo(0, 4);

    const atQuarter = chasePattern(cycleDuration / 4, cycleDuration);
    expect(atQuarter[1]).toBeCloseTo(1, 4);
  });

  it('diagonal pattern keeps opposite corners in phase (0 with 2, 1 with 3)', () => {
    for (let t = 0; t < cycleDuration; t += 0.5) {
      const [i0, i1, i2, i3] = diagonalPattern(t, cycleDuration);
      expect(i0).toBeCloseTo(i2, 6);
      expect(i1).toBeCloseTo(i3, 6);
      expect(i0).toBeCloseTo(1 - i1, 6);
    }
  });

  it('pulse pattern offsets each corner by a quarter cycle', () => {
    const a = pulsePattern(0, cycleDuration);
    const b = pulsePattern(cycleDuration / 4, cycleDuration);
    // Advancing time by a quarter cycle shifts every light's phase forward
    // by pi/2, which is the same as reading the *next* light's phase now:
    // b[i](t) === a[i+1](t)
    expect(b[0]).toBeCloseTo(a[1], 4);
    expect(b[1]).toBeCloseTo(a[2], 4);
    expect(b[2]).toBeCloseTo(a[3], 4);
  });
});

describe('getPattern', () => {
  it('resolves known pattern names', () => {
    expect(getPattern('chase')).toBe(chasePattern);
    expect(getPattern('pulse')).toBe(pulsePattern);
    expect(getPattern('diagonal')).toBe(diagonalPattern);
  });

  it('falls back to chase for unknown names', () => {
    expect(getPattern('nonexistent')).toBe(chasePattern);
    expect(getPattern(undefined)).toBe(chasePattern);
  });
});

describe('shadeFacet', () => {
  // 4 lights: [x,y,z,r,g,b,intensity] each
  function makeLights({ intensities = [0, 0, 0, 0] } = {}) {
    const lights = new Float32Array(4 * 7);
    const positions = [
      [-100, -100, 500],
      [1100, -100, 500],
      [1100, 700, 500],
      [-100, 700, 500]
    ];
    for (let i = 0; i < 4; i++) {
      lights[i * 7] = positions[i][0];
      lights[i * 7 + 1] = positions[i][1];
      lights[i * 7 + 2] = positions[i][2];
      lights[i * 7 + 3] = 1; // r
      lights[i * 7 + 4] = 1; // g
      lights[i * 7 + 5] = 1; // b
      lights[i * 7 + 6] = intensities[i];
    }
    return lights;
  }

  it('with all lights off, returns the ambient-only dark base color (never pure black)', () => {
    const lights = makeLights();
    const out = new Float32Array(3);
    shadeFacet(0, 0, 1, 500, 300, 0, lights, 0.2, 0.5, 0.8, 0.08, 24, 500, out);

    expect(out[0]).toBeCloseTo(0.08 * 0.2 * 255, 3);
    expect(out[1]).toBeCloseTo(0.08 * 0.5 * 255, 3);
    expect(out[2]).toBeCloseTo(0.08 * 0.8 * 255, 3);
    // Never pure black as long as base color isn't pure black
    expect(out[0] + out[1] + out[2]).toBeGreaterThan(0);
  });

  it('a facet facing directly at a fully-lit corner light is brighter than one facing away', () => {
    const lights = makeLights({ intensities: [1, 0, 0, 0] });
    const outToward = new Float32Array(3);
    const outAway = new Float32Array(3);

    // Facet centered on the canvas, normal pointing toward light 0 (up-left-ish, +z)
    shadeFacet(-0.3, -0.3, 0.9, 500, 300, 0, lights, 0.5, 0.5, 0.5, 0.08, 24, 500, outToward);
    // Same facet, normal pointing away from every light (straight down the -z axis component is impossible since z>=0 required in practice, use a grazing/opposite tangent normal instead)
    shadeFacet(0.3, 0.3, 0.9, 500, 300, 0, lights, 0.5, 0.5, 0.5, 0.08, 24, 500, outAway);

    const sumToward = outToward[0] + outToward[1] + outToward[2];
    const sumAway = outAway[0] + outAway[1] + outAway[2];
    expect(sumToward).toBeGreaterThan(sumAway);
  });

  it('clamps output to [0, 255] even with extreme inputs', () => {
    const lights = makeLights({ intensities: [50, 50, 50, 50] });
    const out = new Float32Array(3);
    shadeFacet(0, 0, 1, 500, 300, 0, lights, 1, 1, 1, 0.08, 24, 50, out);

    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });

  it('a light behind the terminator (diffuse <= 0) contributes no diffuse or specular', () => {
    const lightsOff = makeLights({ intensities: [0, 0, 0, 0] });
    const lightsOn = makeLights({ intensities: [1, 0, 0, 0] });
    const outOff = new Float32Array(3);
    const outOn = new Float32Array(3);

    // Normal pointing straight away from light 0 in x/y, but still z>0
    // (light 0 is up-left of canvas; point this facet's normal down-right)
    shadeFacet(1, 1, 0.01, 500, 300, 0, lightsOff, 0.5, 0.5, 0.5, 0.08, 24, 500, outOff);
    shadeFacet(1, 1, 0.01, 500, 300, 0, lightsOn, 0.5, 0.5, 0.5, 0.08, 24, 500, outOn);

    // Facet faces away from light 0, so turning that light on should not change the result
    expect(outOn[0]).toBeCloseTo(outOff[0], 3);
    expect(outOn[1]).toBeCloseTo(outOff[1], 3);
    expect(outOn[2]).toBeCloseTo(outOff[2], 3);
  });
});
