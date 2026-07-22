import { describe, it, expect } from 'vitest';
import { buildTriangleGrid, buildFacets, buildLatticeVertices, expandVertexIndexToFacets, buildTriangleAdjacency, inflatePoint } from '../../src/epcot/geometry.js';

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

describe('buildLatticeVertices', () => {
  it('deduplicates coincident vertices: every interior vertex is shared by exactly 6 triangles', () => {
    const size = 90;
    const { triangles, triCount } = buildTriangleGrid(1920, 1080, size);
    const { positions, count, triVertexIndex } = buildLatticeVertices(triangles, triCount, 0.01);

    expect(triVertexIndex.length).toBe(triCount * 3);

    // Count how many triangles reference each unique vertex.
    const touchCount = new Array(count).fill(0);
    for (let i = 0; i < triVertexIndex.length; i++) touchCount[triVertexIndex[i]]++;

    // A vertex near the canvas center is guaranteed interior (far from the
    // grid's margin/boundary), so it must be shared by exactly 6 triangles
    // (3 up-pointing + 3 down-pointing) in a proper triangular lattice.
    const cx = 1920 / 2, cy = 1080 / 2;
    let closest = -1, closestDist = Infinity;
    for (let v = 0; v < count; v++) {
      const d = Math.hypot(positions[v * 2] - cx, positions[v * 2 + 1] - cy);
      if (d < closestDist) { closestDist = d; closest = v; }
    }
    expect(touchCount[closest]).toBe(6);

    // Every unique vertex must be touched by at least 1 triangle and at
    // most 6 (never more - that would indicate a coordinate collision bug).
    for (const c of touchCount) {
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(6);
    }
  });

  it('dedup ratio matches the theoretical lattice (~2 triangles per interior vertex)', () => {
    // For a large, boundary-effects-are-small triangular mesh, Euler's
    // formula gives triCount ~= 2 * uniqueVertexCount (each interior vertex
    // has degree 6, each triangle has 3 corners: 3*triCount ~= 6*vertexCount).
    const { triangles, triCount } = buildTriangleGrid(1920, 1080, 90);
    const { count } = buildLatticeVertices(triangles, triCount, 0.01);

    const ratio = triCount / count;
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(2.2);
  });

  it('produces far fewer unique vertices than raw (triangle, corner) pairs', () => {
    const { triangles, triCount } = buildTriangleGrid(400, 300, 90);
    const { count } = buildLatticeVertices(triangles, triCount, 0.01);
    expect(count).toBeLessThan(triCount * 3);
  });

  it('is deterministic given the same inputs', () => {
    const { triangles, triCount } = buildTriangleGrid(800, 600, 90);
    const a = buildLatticeVertices(triangles, triCount, 0.01);
    const b = buildLatticeVertices(triangles, triCount, 0.01);
    expect(a.count).toBe(b.count);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.triVertexIndex)).toEqual(Array.from(b.triVertexIndex));
  });
});

// NOTE: expandVertexIndexToFacets is no longer imported/used by
// EpcotSurface.js (it now uses a gathered spatial-hash light list per
// triangle instead of a static "own 3 vertices, expanded per facet"
// mapping - see EpcotSurface.rebuild()'s "Light gathering" block). It
// remains exported and is still a well-defined pure function, so its test
// is kept as a straightforward unit test of that function in isolation;
// flagged here as dead-code-from-the-scene's-perspective for visibility.
describe('expandVertexIndexToFacets', () => {
  it('gives all 3 facets of a triangle the same 3 vertex-light indices', () => {
    const { triangles, triCount } = buildTriangleGrid(400, 300, 90);
    const { triVertexIndex } = buildLatticeVertices(triangles, triCount, 0.01);
    const facetVertexIndex = expandVertexIndexToFacets(triVertexIndex, triCount);

    expect(facetVertexIndex.length).toBe(triCount * 3 * 3);

    for (let t = 0; t < triCount; t++) {
      const expected = [triVertexIndex[t * 3], triVertexIndex[t * 3 + 1], triVertexIndex[t * 3 + 2]];
      for (let e = 0; e < 3; e++) {
        const f = t * 3 + e;
        expect(facetVertexIndex[f * 3]).toBe(expected[0]);
        expect(facetVertexIndex[f * 3 + 1]).toBe(expected[1]);
        expect(facetVertexIndex[f * 3 + 2]).toBe(expected[2]);
      }
    }
  });
});

describe('buildTriangleAdjacency', () => {
  it('every triangle has at most 3 neighbors, -1 padded', () => {
    const { triangles, triCount } = buildTriangleGrid(400, 300, 90);
    const { triVertexIndex } = buildLatticeVertices(triangles, triCount, 0.01);
    const neighbors = buildTriangleAdjacency(triVertexIndex, triCount);

    expect(neighbors.length).toBe(triCount * 3);
    for (let t = 0; t < triCount; t++) {
      for (let e = 0; e < 3; e++) {
        const n = neighbors[t * 3 + e];
        expect(n).toBeGreaterThanOrEqual(-1);
        expect(n).toBeLessThan(triCount);
      }
    }
  });

  it('is symmetric: if A lists B as a neighbor, B lists A too', () => {
    const { triangles, triCount } = buildTriangleGrid(400, 300, 90);
    const { triVertexIndex } = buildLatticeVertices(triangles, triCount, 0.01);
    const neighbors = buildTriangleAdjacency(triVertexIndex, triCount);

    for (let t = 0; t < triCount; t++) {
      for (let e = 0; e < 3; e++) {
        const n = neighbors[t * 3 + e];
        if (n < 0) continue;
        const backRefs = [neighbors[n * 3], neighbors[n * 3 + 1], neighbors[n * 3 + 2]];
        expect(backRefs).toContain(t);
      }
    }
  });

  it('an interior triangle has exactly 3 neighbors (fully surrounded)', () => {
    const { triangles, triCount } = buildTriangleGrid(1920, 1080, 90);
    const { triVertexIndex } = buildLatticeVertices(triangles, triCount, 0.01);
    const neighbors = buildTriangleAdjacency(triVertexIndex, triCount);

    // Find the triangle closest to canvas center - guaranteed interior.
    const cx = 1920 / 2, cy = 1080 / 2;
    let closest = -1, closestDist = Infinity;
    for (let t = 0; t < triCount; t++) {
      const o = t * 6;
      const tx = (triangles[o] + triangles[o + 2] + triangles[o + 4]) / 3;
      const ty = (triangles[o + 1] + triangles[o + 3] + triangles[o + 5]) / 3;
      const d = Math.hypot(tx - cx, ty - cy);
      if (d < closestDist) { closestDist = d; closest = t; }
    }

    const own = [neighbors[closest * 3], neighbors[closest * 3 + 1], neighbors[closest * 3 + 2]];
    expect(own.every((n) => n >= 0)).toBe(true);
    expect(new Set(own).size).toBe(3); // 3 distinct neighbors, no duplicates
  });

  it('is deterministic given the same inputs', () => {
    const { triangles, triCount } = buildTriangleGrid(400, 300, 90);
    const { triVertexIndex } = buildLatticeVertices(triangles, triCount, 0.01);
    const a = buildTriangleAdjacency(triVertexIndex, triCount);
    const b = buildTriangleAdjacency(triVertexIndex, triCount);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('inflatePoint', () => {
  it('moves the point directly away from the centroid by exactly `amount` pixels', () => {
    const [x, y] = inflatePoint(110, 100, 100, 100, 5);
    // Original point is 10px to the right of centroid (100,100); inflating
    // pushes it further in the same (+x) direction by exactly `amount`.
    expect(x).toBeCloseTo(115, 5);
    expect(y).toBeCloseTo(100, 5);
  });

  it('preserves direction from the centroid for an arbitrary diagonal offset', () => {
    const cx = 50, cy = 50;
    const [x, y] = inflatePoint(80, 90, cx, cy, 10);
    const originalAngle = Math.atan2(90 - cy, 80 - cx);
    const inflatedAngle = Math.atan2(y - cy, x - cx);
    expect(inflatedAngle).toBeCloseTo(originalAngle, 6);

    const inflatedDist = Math.hypot(x - cx, y - cy);
    const originalDist = Math.hypot(80 - cx, 90 - cy);
    expect(inflatedDist).toBeCloseTo(originalDist + 10, 5);
  });

  it('falls back to a stable (non-NaN) result when the point coincides with the centroid', () => {
    const [x, y] = inflatePoint(50, 50, 50, 50, 5);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });

  it('amount=0 returns the original point unchanged', () => {
    const [x, y] = inflatePoint(123.4, 56.7, 100, 100, 0);
    expect(x).toBeCloseTo(123.4, 6);
    expect(y).toBeCloseTo(56.7, 6);
  });
});
