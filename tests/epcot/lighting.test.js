import { describe, it, expect } from 'vitest';
import {
  computeLightColors,
  computeCornerWeights,
  chasePattern,
  pulsePattern,
  diagonalPattern,
  waveField,
  radialField,
  isFieldPattern,
  getPattern,
  shadeFacet
} from '../../src/epcot/lighting.js';

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

describe('computeCornerWeights', () => {
  it('weights sum to exactly 1 everywhere (partition of unity)', () => {
    const width = 1920, height = 1080;
    const points = [
      [0, 0], [width, 0], [width, height], [0, height],
      [width / 2, height / 2], [100, 900], [1800, 50], [-50, -50], [width + 50, height + 50]
    ];
    for (const [x, y] of points) {
      const [w0, w1, w2, w3] = computeCornerWeights(x, y, width, height);
      expect(w0 + w1 + w2 + w3).toBeCloseTo(1, 6);
    }
  });

  it('strongly favors the matching corner at that corner, with the opposite corner near zero', () => {
    const width = 1000, height = 500;
    const [tl0, tl1, tl2, tl3] = computeCornerWeights(0, 0, width, height);
    // Sharp (non-bilinear) falloff: dominant but not necessarily ~1, since
    // some energy still reaches the two adjacent corners at this radius.
    expect(tl0).toBeGreaterThan(0.8);
    expect(tl2).toBeLessThan(0.001); // diagonally opposite corner: negligible
    expect(tl0).toBeGreaterThan(tl1);
    expect(tl0).toBeGreaterThan(tl3);

    const [, tr1] = computeCornerWeights(width, 0, width, height);
    expect(tr1).toBeGreaterThan(0.8);

    const [, , br2] = computeCornerWeights(width, height, width, height);
    expect(br2).toBeGreaterThan(0.8);

    const [, , , bl3] = computeCornerWeights(0, height, width, height);
    expect(bl3).toBeGreaterThan(0.8);
  });

  it('gives equal weight to all 4 corners at the exact center (equidistant, by symmetry)', () => {
    const width = 1000, height = 500;
    const weights = computeCornerWeights(width / 2, height / 2, width, height);
    for (const w of weights) {
      expect(w).toBeCloseTo(0.25, 6);
    }
  });

  it('is a genuinely sharp (localized) falloff: a point 25% of the diagonal from a corner is still corner-dominant, but far less so than at the corner itself', () => {
    const width = 1920, height = 1080;
    const atCorner = computeCornerWeights(0, 0, width, height)[0];
    const quarterAway = computeCornerWeights(width * 0.15, height * 0.15, width, height)[0];
    expect(quarterAway).toBeLessThan(atCorner);
    expect(quarterAway).toBeGreaterThan(0.5); // still corner-dominant at this modest distance
  });

  it('does not produce negative weights for points outside the canvas bounds', () => {
    const width = 1000, height = 500;
    const weights = computeCornerWeights(-200, -200, width, height);
    for (const w of weights) {
      expect(w).toBeGreaterThanOrEqual(0);
    }
    expect(weights[0]).toBeGreaterThan(weights[1]);
    expect(weights[0]).toBeGreaterThan(weights[3]);
  });

  it('writes into a provided output buffer without allocating a new one', () => {
    const out = [0, 0, 0, 0];
    const result = computeCornerWeights(500, 250, 1000, 500, 0.22, out);
    expect(result).toBe(out);
  });

  it('a smaller falloffRatio makes the field sharper: the nearest corner more completely dominates at a fixed point', () => {
    const width = 1920, height = 1080;
    // A point roughly a third of the way in from top-left - close enough to
    // still be top-left-dominant under both falloffs, far enough that the
    // other 3 corners' competing contribution differs noticeably.
    const point = [width * 0.3, height * 0.3];
    const sharp = computeCornerWeights(point[0], point[1], width, height, 0.1)[0];
    const soft = computeCornerWeights(point[0], point[1], width, height, 0.4)[0];
    // A smaller falloffRatio makes EVERY corner's raw weight decay faster
    // with distance - including the competing corners, which are farther
    // away and so lose influence faster than the near one does. After
    // renormalizing to sum to 1, that makes the near corner's *share* of
    // the total higher (more localized/dominant), not lower.
    expect(sharp).toBeGreaterThan(soft);
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

  it('accepts an explicit output buffer and returns it (avoids per-frame allocation)', () => {
    const out = [0, 0, 0, 0];
    for (const fn of [chasePattern, pulsePattern, diagonalPattern]) {
      const result = fn(1.23, cycleDuration, out);
      expect(result).toBe(out);
    }
  });
});

// waveField/radialField are per-vertex field patterns: unlike the 4-corner
// blend patterns above, they take a precomputed spatial coordinate (not
// x/y directly) and return a single intensity. radialField is still wired
// up in EpcotSurface's 'radial' pattern; waveField is currently unused
// there (the 'wave' pattern reimplements an equivalent band() inline) but
// remains exported and correct, so it's tested the same as any other pure
// function here.
describe('waveField', () => {
  const cycleDuration = 24;

  it('stays within [0, 1] across a full cycle and the full proj range', () => {
    for (let t = 0; t < cycleDuration; t += 0.7) {
      for (let proj = -0.1; proj <= 1.1; proj += 0.1) {
        const v = waveField(proj, t, cycleDuration);
        expect(v).toBeGreaterThanOrEqual(-1e-9);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('is periodic with period = cycleDuration', () => {
    for (const proj of [0, 0.25, 0.5, 0.75, 1]) {
      const a = waveField(proj, 3.3, cycleDuration);
      const b = waveField(proj, 3.3 + cycleDuration, cycleDuration);
      expect(b).toBeCloseTo(a, 4);
    }
  });

  it('peaks (=1) exactly when proj equals the band center', () => {
    // At phase=0 the band center is at proj = -bandWidth; sweep forward to
    // phase=0.5 where the center sits mid-canvas for a predictable peak.
    const bandWidth = 0.16;
    const phaseHalf = 0.5;
    const center = -bandWidth + phaseHalf * (1 + 2 * bandWidth);
    const v = waveField(center, phaseHalf * cycleDuration, cycleDuration, bandWidth);
    expect(v).toBeCloseTo(1, 5);
  });

  it('is zero outside the band half-width', () => {
    const bandWidth = 0.16;
    const v = waveField(0.9, 0, cycleDuration, bandWidth); // band starts near proj=-bandWidth at t=0
    expect(v).toBe(0);
  });
});

describe('radialField', () => {
  const cycleDuration = 24;

  it('stays within [0, 1] across a full cycle and the full distance range', () => {
    for (let t = 0; t < cycleDuration; t += 0.9) {
      for (let dist = 0; dist <= 1; dist += 0.1) {
        const v = radialField(dist, t, cycleDuration);
        expect(v).toBeGreaterThanOrEqual(-1e-9);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('is periodic with period = cycleDuration', () => {
    for (const dist of [0, 0.2, 0.5, 0.8, 1]) {
      const a = radialField(dist, 5.5, cycleDuration);
      const b = radialField(dist, 5.5 + cycleDuration, cycleDuration);
      expect(b).toBeCloseTo(a, 4);
    }
  });

  it('rings repeat outward: a fixed time produces multiple lit distances, not just one', () => {
    const hits = [];
    for (let dist = 0; dist <= 1; dist += 0.01) {
      if (radialField(dist, 0, cycleDuration, 2, 0.18) > 0.99) hits.push(dist);
    }
    // ringCount=2 -> the ring lattice repeats twice across [0,1], so more
    // than one distinct peak distance should be found.
    const distinctPeaks = hits.filter((d, i) => i === 0 || d - hits[i - 1] > 0.05);
    expect(distinctPeaks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('isFieldPattern', () => {
  it('is true for wave and radial', () => {
    expect(isFieldPattern('wave')).toBe(true);
    expect(isFieldPattern('radial')).toBe(true);
  });

  it('is false for corner-blend patterns and unknown names', () => {
    expect(isFieldPattern('chase')).toBe(false);
    expect(isFieldPattern('pulse')).toBe(false);
    expect(isFieldPattern('diagonal')).toBe(false);
    expect(isFieldPattern('nonexistent')).toBe(false);
    expect(isFieldPattern(undefined)).toBe(false);
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
  // A single vertex light buffer with N vertices: [x,y,z,r,g,b,intensity] each
  function makeVertexLights(vertexDefs) {
    const lights = new Float32Array(vertexDefs.length * 7);
    vertexDefs.forEach((v, i) => {
      const o = i * 7;
      lights[o] = v.x; lights[o + 1] = v.y; lights[o + 2] = v.z;
      lights[o + 3] = v.r ?? 1; lights[o + 4] = v.g ?? 1; lights[o + 5] = v.b ?? 1;
      lights[o + 6] = v.intensity ?? 0;
    });
    return lights;
  }

  // lightIdx is a gathered index list into vertexLights (see EpcotSurface's
  // spatial-hash gather); the identity mapping [0,1,2,...] reproduces the
  // pre-gather "own 3 vertices" case used throughout these tests.
  const identityIdx = Int32Array.from([0, 1, 2]);

  const DW = 0.65; // diffuseWeight, matches config.epcot.lighting.diffuseWeight
  const SW = 2.4;  // specularWeight, matches config.epcot.lighting.specularWeight

  it('with zero gathered lights (count=0), returns exactly the ambient-only base color', () => {
    const lights = makeVertexLights([
      { x: 480, y: 280, z: 20, intensity: 5 }, // even a lit vertex is ignored when count=0
      { x: 520, y: 280, z: 20, intensity: 5 },
      { x: 500, y: 320, z: 20, intensity: 5 }
    ]);
    const out = new Float32Array(3);
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 0, 0.2, 0.5, 0.8, 0.08, 24, 90, DW, SW, out);

    expect(out[0]).toBeCloseTo(0.08 * 0.2 * 255, 3);
    expect(out[1]).toBeCloseTo(0.08 * 0.5 * 255, 3);
    expect(out[2]).toBeCloseTo(0.08 * 0.8 * 255, 3);
  });

  it('with all 3 gathered lights off (intensity 0), returns the ambient-only dark base color (never pure black)', () => {
    const lights = makeVertexLights([
      { x: 480, y: 280, z: 20, intensity: 0 },
      { x: 520, y: 280, z: 20, intensity: 0 },
      { x: 500, y: 320, z: 20, intensity: 0 }
    ]);
    const out = new Float32Array(3);
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.2, 0.5, 0.8, 0.08, 24, 90, DW, SW, out);

    expect(out[0]).toBeCloseTo(0.08 * 0.2 * 255, 3);
    expect(out[1]).toBeCloseTo(0.08 * 0.5 * 255, 3);
    expect(out[2]).toBeCloseTo(0.08 * 0.8 * 255, 3);
    expect(out[0] + out[1] + out[2]).toBeGreaterThan(0);
  });

  it('output is monotonically non-decreasing as a single lit vertex\'s intensity rises', () => {
    const mkOut = (intensity) => {
      const lights = makeVertexLights([
        { x: 500, y: 300, z: 20, intensity },
        { x: 520, y: 300, z: 20, intensity: 0 },
        { x: 500, y: 320, z: 20, intensity: 0 }
      ]);
      const out = new Float32Array(3);
      shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, out);
      return out[0] + out[1] + out[2];
    };

    const levels = [0, 0.2, 0.5, 1, 2, 5];
    let prev = -Infinity;
    for (const i of levels) {
      const sum = mkOut(i);
      expect(sum).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = sum;
    }
    expect(mkOut(5)).toBeGreaterThan(mkOut(0));
  });

  it('a facet facing directly at its own lit vertex is brighter than one facing away', () => {
    // Vertex 0 sits right above the facet centroid, lit; vertices 1,2 off.
    const lights = makeVertexLights([
      { x: 500, y: 300, z: 20, intensity: 1 },
      { x: 520, y: 300, z: 20, intensity: 0 },
      { x: 500, y: 320, z: 20, intensity: 0 }
    ]);
    const outToward = new Float32Array(3);
    const outAway = new Float32Array(3);

    // Normal pointing up toward the lit vertex (mostly +z, since the light
    // is almost directly above the facet centroid)
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, outToward);
    // Normal tilted sharply away in x/y
    shadeFacet(0.9, 0.9, 0.1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, outAway);

    const sumToward = outToward[0] + outToward[1] + outToward[2];
    const sumAway = outAway[0] + outAway[1] + outAway[2];
    expect(sumToward).toBeGreaterThan(sumAway);
  });

  it('a short falloff means a distant lit vertex barely affects the facet', () => {
    // Vertex 0 is lit but far away (well beyond ~1 triangle size); vertex 1
    // (close) is lit too, for comparison.
    const farLights = makeVertexLights([
      { x: 500 + 2000, y: 300, z: 20, intensity: 1 },
      { x: 520, y: 300, z: 20, intensity: 0 },
      { x: 500, y: 320, z: 20, intensity: 0 }
    ]);
    const nearLights = makeVertexLights([
      { x: 520, y: 300, z: 20, intensity: 1 },
      { x: 520, y: 300, z: 20, intensity: 0 },
      { x: 500, y: 320, z: 20, intensity: 0 }
    ]);
    const outFar = new Float32Array(3);
    const outNear = new Float32Array(3);
    const falloff = 90; // ~1 triangle size

    shadeFacet(0, 0, 1, 500, 300, 0, farLights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, falloff, DW, SW, outFar);
    shadeFacet(0, 0, 1, 500, 300, 0, nearLights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, falloff, DW, SW, outNear);

    const sumFar = outFar[0] + outFar[1] + outFar[2];
    const sumNear = outNear[0] + outNear[1] + outNear[2];
    expect(sumNear).toBeGreaterThan(sumFar);
    // The far light's contribution should be nearly negligible (close to ambient-only)
    const ambientOnly = 0.08 * 0.5 * 255 * 3;
    expect(sumFar).toBeCloseTo(ambientOnly, 0);
  });

  it('output is NOT clamped high - very hot lights can exceed 255 (callers tone-map after the bounce pass)', () => {
    const lights = makeVertexLights([
      { x: 500, y: 300, z: 20, intensity: 500 },
      { x: 520, y: 300, z: 20, intensity: 500 },
      { x: 500, y: 320, z: 20, intensity: 500 }
    ]);
    const out = new Float32Array(3);
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 1, 1, 1, 0.08, 24, 90, DW, SW, out);

    const sum = out[0] + out[1] + out[2];
    expect(sum).toBeGreaterThan(255);
  });

  it('output is floor-clamped at 0 (never negative)', () => {
    const lights = makeVertexLights([
      { x: 480, y: 280, z: 20, intensity: 0 },
      { x: 520, y: 280, z: 20, intensity: 0 },
      { x: 500, y: 320, z: 20, intensity: 0 }
    ]);
    const out = new Float32Array(3);
    // ambient=0 and no active lights -> the formula's floor (Math.max(0, ...))
    // is what keeps this at exactly 0 rather than going negative.
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0, 24, 90, DW, SW, out);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
  });

  it('a vertex light behind the terminator (diffuse <= 0) contributes no diffuse or specular', () => {
    // Light sits close (well within the short falloff) but to the left of
    // the facet, not overhead, so a normal tilted hard toward +x faces
    // away from it - if the skip-when-diffuse<=0 branch were broken, a
    // nearby light like this would visibly brighten the result.
    const lightsOff = makeVertexLights([
      { x: 450, y: 300, z: 20, intensity: 0 },
      { x: 520, y: 300, z: 20, intensity: 0 },
      { x: 500, y: 320, z: 20, intensity: 0 }
    ]);
    const lightsOn = makeVertexLights([
      { x: 450, y: 300, z: 20, intensity: 1 },
      { x: 520, y: 300, z: 20, intensity: 0 },
      { x: 500, y: 320, z: 20, intensity: 0 }
    ]);
    const outOff = new Float32Array(3);
    const outOn = new Float32Array(3);

    // Facet normal tilted hard toward +x (away from the light at x=450)
    shadeFacet(1, 0.1, 0.01, 500, 300, 0, lightsOff, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, outOff);
    shadeFacet(1, 0.1, 0.01, 500, 300, 0, lightsOn, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, outOn);

    expect(outOn[0]).toBeCloseTo(outOff[0], 3);
    expect(outOn[1]).toBeCloseTo(outOff[1], 3);
    expect(outOn[2]).toBeCloseTo(outOff[2], 3);
  });

  it('only gathers `count` lights starting at `start` (start/count slice the shared lightIdx buffer)', () => {
    // 4 vertices in one buffer; lightIdx maps facet A to [0,1] and facet B
    // to [2,3] within the same underlying arrays, like EpcotSurface's
    // shared per-frame gather buffer.
    const lights = makeVertexLights([
      { x: 500, y: 300, z: 20, intensity: 3 },  // included for facet A only
      { x: 500, y: 300, z: 20, intensity: 0 },
      { x: 500, y: 300, z: 20, intensity: 0 },
      { x: 500, y: 300, z: 20, intensity: 0 }
    ]);
    const idx = Int32Array.from([0, 1, 2, 3]);
    const outA = new Float32Array(3);
    const outB = new Float32Array(3);
    // Facet A: start=0, count=1 -> sees the lit vertex 0
    shadeFacet(0, 0, 1, 500, 300, 0, lights, idx, 0, 1, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, outA);
    // Facet B: start=2, count=2 -> sees only vertices 2,3 (both off)
    shadeFacet(0, 0, 1, 500, 300, 0, lights, idx, 2, 2, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, outB);

    expect(outA[0] + outA[1] + outA[2]).toBeGreaterThan(outB[0] + outB[1] + outB[2]);
  });

  it('a shadow factor < 1 reduces a light\'s contribution proportionally', () => {
    const lights = makeVertexLights([
      { x: 500, y: 300, z: 20, intensity: 1 },
      { x: 520, y: 300, z: 20, intensity: 0 },
      { x: 500, y: 320, z: 20, intensity: 0 }
    ]);
    const outFull = new Float32Array(3);
    const outShadowed = new Float32Array(3);
    const outFloored = new Float32Array(3);

    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, outFull, null);
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, outShadowed, [0.5, 1, 1]);
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, outFloored, [0, 1, 1]);

    const sumFull = outFull[0] + outFull[1] + outFull[2];
    const sumShadowed = outShadowed[0] + outShadowed[1] + outShadowed[2];
    const sumFloored = outFloored[0] + outFloored[1] + outFloored[2];
    const ambientOnly = 0.08 * 0.5 * 255 * 3;

    expect(sumShadowed).toBeLessThan(sumFull);
    expect(sumShadowed).toBeGreaterThan(sumFloored);
    // Shadow factor 0 on the only lit vertex leaves just the ambient floor.
    expect(sumFloored).toBeCloseTo(ambientOnly, 3);
  });

  it('a missing/falsy shadows argument behaves identically to no shadowing', () => {
    const lights = makeVertexLights([
      { x: 500, y: 300, z: 20, intensity: 1 },
      { x: 520, y: 300, z: 20, intensity: 0 },
      { x: 500, y: 320, z: 20, intensity: 0 }
    ]);
    const outUndefined = new Float32Array(3);
    const outNull = new Float32Array(3);

    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, outUndefined);
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, DW, SW, outNull, null);

    expect(Array.from(outUndefined)).toEqual(Array.from(outNull));
  });

  it('diffuseWeight and specularWeight independently scale their respective contributions', () => {
    const lights = makeVertexLights([
      { x: 500, y: 300, z: 20, intensity: 1 },
      { x: 520, y: 300, z: 20, intensity: 0 },
      { x: 500, y: 320, z: 20, intensity: 0 }
    ]);
    const outLowDiffuse = new Float32Array(3);
    const outHighDiffuse = new Float32Array(3);
    const outLowSpec = new Float32Array(3);
    const outHighSpec = new Float32Array(3);

    // Isolate diffuse: specularWeight=0
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, 0.1, 0, outLowDiffuse);
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, 2.0, 0, outHighDiffuse);
    expect(outHighDiffuse[0] + outHighDiffuse[1] + outHighDiffuse[2])
      .toBeGreaterThan(outLowDiffuse[0] + outLowDiffuse[1] + outLowDiffuse[2]);

    // Isolate specular: diffuseWeight=0
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, 0, 0.5, outLowSpec);
    shadeFacet(0, 0, 1, 500, 300, 0, lights, identityIdx, 0, 3, 0.5, 0.5, 0.5, 0.08, 24, 90, 0, 4.0, outHighSpec);
    expect(outHighSpec[0] + outHighSpec[1] + outHighSpec[2])
      .toBeGreaterThan(outLowSpec[0] + outLowSpec[1] + outLowSpec[2]);
  });
});
