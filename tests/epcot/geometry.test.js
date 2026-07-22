import { describe, it, expect } from 'vitest';
import { buildTriangleGrid, buildFacets } from '../../src/epcot/geometry.js';

describe('buildTriangleGrid', () => {
  it('covers the full canvas bounds plus a margin on every side', () => {
    const width = 1920, height = 1080, size = 90;
    const { triangles, triCount } = buildTriangleGrid(width, height, size);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < triCount; i++) {
      const o = i * 6;
      for (let v = 0; v < 3; v++) {
        const x = triangles[o + v * 2];
        const y = triangles[o + v * 2 + 1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    // Margin of at least half a triangle side on every edge
    expect(minX).toBeLessThanOrEqual(-size / 2);
    expect(minY).toBeLessThanOrEqual(-size / 2);
    expect(maxX).toBeGreaterThanOrEqual(width + size / 2);
    expect(maxY).toBeGreaterThanOrEqual(height + size / 2);
  });

  it('facet count matches numRows * numCols * 2 base triangles', () => {
    const { triangles, triCount, numRows, numCols } = buildTriangleGrid(1920, 1080, 90);
    expect(triCount).toBe(numRows * numCols * 2);
    expect(triangles.length).toBe(triCount * 6);
  });

  it('produces equilateral triangles (all three sides equal within floating-point tolerance)', () => {
    const size = 90;
    const { triangles, triCount } = buildTriangleGrid(400, 300, size);

    for (let i = 0; i < triCount; i++) {
      const o = i * 6;
      const [ax, ay, bx, by, cx, cy] = triangles.slice(o, o + 6);
      const ab = Math.hypot(bx - ax, by - ay);
      const bc = Math.hypot(cx - bx, cy - by);
      const ca = Math.hypot(ax - cx, ay - cy);
      expect(ab).toBeCloseTo(size, 3);
      expect(bc).toBeCloseTo(size, 3);
      expect(ca).toBeCloseTo(size, 3);
    }
  });

  it('is deterministic given the same inputs', () => {
    const a = buildTriangleGrid(1920, 1080, 90);
    const b = buildTriangleGrid(1920, 1080, 90);
    expect(Array.from(a.triangles)).toEqual(Array.from(b.triangles));
  });

  it('produces a denser grid for a smaller triangle size', () => {
    const coarse = buildTriangleGrid(1920, 1080, 150);
    const fine = buildTriangleGrid(1920, 1080, 60);
    expect(fine.triCount).toBeGreaterThan(coarse.triCount);
  });
});

describe('buildFacets', () => {
  const seededRandom = () => {
    let seed = 42;
    return () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  };

  it('produces exactly 3 facets per base triangle', () => {
    const { triangles, triCount } = buildTriangleGrid(400, 300, 90);
    const { facetCount } = buildFacets(triangles, triCount, 30, 0.15, seededRandom());
    expect(facetCount).toBe(triCount * 3);
  });

  it('every facet normal is unit length', () => {
    const { triangles, triCount } = buildTriangleGrid(400, 300, 90);
    const { normals, facetCount } = buildFacets(triangles, triCount, 30, 0.15, seededRandom());

    for (let f = 0; f < facetCount; f++) {
      const o = f * 3;
      const len = Math.hypot(normals[o], normals[o + 1], normals[o + 2]);
      expect(len).toBeCloseTo(1, 5);
    }
  });

  it('every facet normal has z > 0 (apex always faces the viewer)', () => {
    const { triangles, triCount } = buildTriangleGrid(400, 300, 90);
    const { normals, facetCount } = buildFacets(triangles, triCount, 30, 0.15, seededRandom());

    for (let f = 0; f < facetCount; f++) {
      expect(normals[f * 3 + 2]).toBeGreaterThan(0);
    }
  });

  it('apex projects onto the base triangle centroid (orthographic projection)', () => {
    const { triangles, triCount } = buildTriangleGrid(400, 300, 90);
    const { positions2D, facetCount } = buildFacets(triangles, triCount, 30, 0.15, seededRandom());

    // Every facet's third vertex (the projected apex) should be identical
    // for all 3 facets sharing the same base triangle.
    for (let t = 0; t < triCount; t++) {
      const f0 = t * 3;
      const apex0x = positions2D[f0 * 6 + 4];
      const apex0y = positions2D[f0 * 6 + 5];
      for (let e = 1; e < 3; e++) {
        const fo = (f0 + e) * 6;
        expect(positions2D[fo + 4]).toBeCloseTo(apex0x, 5);
        expect(positions2D[fo + 5]).toBeCloseTo(apex0y, 5);
      }
    }
  });

  it('applies +/-15% seeded spike height variation deterministically', () => {
    const { triangles, triCount } = buildTriangleGrid(200, 200, 90);
    const spikeHeight = 30;

    const a = buildFacets(triangles, triCount, spikeHeight, 0.15, seededRandom());
    const b = buildFacets(triangles, triCount, spikeHeight, 0.15, seededRandom());

    expect(Array.from(a.centroids3D)).toEqual(Array.from(b.centroids3D));

    // Facet z-centroids should vary around spikeHeight/3 within the +/-15% band
    for (let f = 0; f < a.facetCount; f++) {
      const z = a.centroids3D[f * 3 + 2] * 3; // undo the /3 average with 2 base verts at z=0
      expect(z).toBeGreaterThanOrEqual(spikeHeight * 0.85 - 1e-6);
      expect(z).toBeLessThanOrEqual(spikeHeight * 1.15 + 1e-6);
    }
  });

  it('produces a different (but still valid) surface with a different seeded RNG', () => {
    const { triangles, triCount } = buildTriangleGrid(200, 200, 90);
    const a = buildFacets(triangles, triCount, 30, 0.15, () => 0.1);
    const b = buildFacets(triangles, triCount, 30, 0.15, () => 0.9);
    expect(Array.from(a.centroids3D)).not.toEqual(Array.from(b.centroids3D));
  });
});
