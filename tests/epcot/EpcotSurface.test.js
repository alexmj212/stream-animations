import { describe, it, expect, vi } from 'vitest';
import { EpcotSurface } from '../../src/epcot/EpcotSurface.js';
import { buildTriangleGrid } from '../../src/epcot/geometry.js';
import { cornerLightPositions } from '../../src/epcot/lighting.js';
import { config } from '../../src/config/config.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

function seededRandom(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe('EpcotSurface', () => {
  it('builds a facet for every sub-triangle of the base grid on construction', () => {
    const canvas = createMockCanvas(400, 300);
    const ctx = createMockContext(canvas);
    const size = 90;

    const surface = new EpcotSurface(ctx, canvas, { size, random: seededRandom() });
    const { triCount } = buildTriangleGrid(400, 300, size);

    expect(surface.facetCount).toBe(triCount * 3);
    expect(surface.paths).toHaveLength(surface.facetCount);
    expect(surface.normals.length).toBe(surface.facetCount * 3);
  });

  it('is deterministic given the same seeded random function', () => {
    const canvasA = createMockCanvas(400, 300);
    const canvasB = createMockCanvas(400, 300);
    const a = new EpcotSurface(createMockContext(canvasA), canvasA, { size: 90, random: seededRandom(7) });
    const b = new EpcotSurface(createMockContext(canvasB), canvasB, { size: 90, random: seededRandom(7) });

    expect(Array.from(a.centroids3D)).toEqual(Array.from(b.centroids3D));
    expect(Array.from(a.normals)).toEqual(Array.from(b.normals));
  });

  it('rebuild() regenerates geometry for the current canvas size', () => {
    const canvas = createMockCanvas(400, 300);
    const ctx = createMockContext(canvas);
    const surface = new EpcotSurface(ctx, canvas, { size: 90, random: seededRandom() });
    const initialFacetCount = surface.facetCount;

    canvas.width = 1200;
    canvas.height = 900;
    surface.rebuild();

    expect(surface.facetCount).toBeGreaterThan(initialFacetCount);
    expect(surface.paths).toHaveLength(surface.facetCount);
  });

  it('update() advances the pattern clock by deltaTime * speed', () => {
    const canvas = createMockCanvas(200, 200);
    const ctx = createMockContext(canvas);
    const surface = new EpcotSurface(ctx, canvas, { size: 90, random: seededRandom(), speed: 2 });

    expect(surface.clock).toBe(0);
    surface.update(0.5);
    expect(surface.clock).toBeCloseTo(1.0, 5);
    surface.update(0.25);
    expect(surface.clock).toBeCloseTo(1.5, 5);
  });

  it('draw() fills every facet without throwing, and does not stroke (seams are hidden via geometric inflation, not stroke())', () => {
    const canvas = createMockCanvas(200, 200);
    const ctx = createMockContext(canvas);
    const surface = new EpcotSurface(ctx, canvas, { size: 90, random: seededRandom() });

    const fillSpy = vi.spyOn(ctx, 'fill');
    const strokeSpy = vi.spyOn(ctx, 'stroke');

    surface.update(0.016);
    expect(() => surface.draw()).not.toThrow();

    expect(fillSpy).toHaveBeenCalledTimes(surface.facetCount);
    expect(strokeSpy).not.toHaveBeenCalled();
  });

  it('inflates each facet outward from its own centroid so adjacent triangles overlap slightly', () => {
    const canvas = createMockCanvas(200, 200);
    const ctx = createMockContext(canvas);
    const surface = new EpcotSurface(ctx, canvas, { size: 90, random: seededRandom(), seamInflatePx: 5 });

    // First facet's raw (un-inflated) triangle from positions2D
    const [ax, ay, bx, by, cx0, cy0] = surface.positions2D.slice(0, 6);
    const centroidX = (ax + bx + cx0) / 3;
    const centroidY = (ay + by + cy0) / 3;
    const rawDistA = Math.hypot(ax - centroidX, ay - centroidY);

    // The corresponding Path2D vertex should be strictly farther from the
    // centroid than the raw vertex once inflated outward.
    const path = surface.paths[0];
    expect(path).toBeInstanceOf(Path2D);
    // vitest-canvas-mock's Path2D stores its recorded operations in _path
    const moveToOp = path._path.find((op) => op.type === 'moveTo');
    expect(moveToOp).toBeDefined();
    const inflatedDist = Math.hypot(moveToOp.props.x - centroidX, moveToOp.props.y - centroidY);
    expect(inflatedDist).toBeGreaterThan(rawDistA);
    expect(inflatedDist - rawDistA).toBeCloseTo(5, 1);
  });

  it('rebuild() repositions the corner lights for new canvas dimensions', () => {
    const canvas = createMockCanvas(400, 300);
    const ctx = createMockContext(canvas);
    const surface = new EpcotSurface(ctx, canvas, { size: 90, random: seededRandom() });

    const before = Array.from(surface._lights.slice(0, 3)); // light 0 (top-left) x,y,z

    canvas.width = 1600;
    canvas.height = 1000;
    surface.rebuild();

    const after = Array.from(surface._lights.slice(0, 3));
    expect(after).not.toEqual(before);

    const expected = cornerLightPositions(1600, 1000, config.epcot.lighting.cornerMargin, config.epcot.lighting.zHeightRatio);
    for (let i = 0; i < 4; i++) {
      const o = i * 7;
      expect(surface._lights[o]).toBeCloseTo(expected[i].x, 3);
      expect(surface._lights[o + 1]).toBeCloseTo(expected[i].y, 3);
      expect(surface._lights[o + 2]).toBeCloseTo(expected[i].z, 3);
    }
  });

  it('accepts chase, pulse, and diagonal patterns without error', () => {
    for (const pattern of ['chase', 'pulse', 'diagonal']) {
      const canvas = createMockCanvas(200, 200);
      const ctx = createMockContext(canvas);
      const surface = new EpcotSurface(ctx, canvas, { size: 90, random: seededRandom(), pattern });
      surface.update(1);
      expect(() => surface.draw()).not.toThrow();
    }
  });
});
