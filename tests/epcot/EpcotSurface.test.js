import { describe, it, expect, vi } from 'vitest';
import { EpcotSurface } from '../../src/epcot/EpcotSurface.js';
import { buildTriangleGrid, buildLatticeVertices } from '../../src/epcot/geometry.js';
import { computeCornerWeights } from '../../src/epcot/lighting.js';
import { config } from '../../src/config/config.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

const cfg = config.epcot;

function seededRandom(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function makeSurface(overrides = {}) {
  const canvas = createMockCanvas(overrides.width ?? 300, overrides.height ?? 220);
  const ctx = createMockContext(canvas);
  const surface = new EpcotSurface(ctx, canvas, { size: 90, random: seededRandom(), ...overrides });
  return { canvas, ctx, surface };
}

describe('EpcotSurface', () => {
  describe('construction / geometry', () => {
    it('builds a facet for every sub-triangle of the base grid on construction', () => {
      const canvas = createMockCanvas(400, 300);
      const ctx = createMockContext(canvas);
      const size = 90;

      const surface = new EpcotSurface(ctx, canvas, { size, random: seededRandom() });
      const { triCount } = buildTriangleGrid(400, 300, size);

      expect(surface.facetCount).toBe(triCount * 3);
      expect(surface.paths).toHaveLength(surface.facetCount);
      expect(surface.normals.length).toBe(surface.facetCount * 3);
      expect(surface.triCount).toBe(triCount);
    });

    it('builds one vertex light per unique lattice vertex, matching buildLatticeVertices', () => {
      const canvas = createMockCanvas(400, 300);
      const ctx = createMockContext(canvas);
      const size = 90;

      const surface = new EpcotSurface(ctx, canvas, { size, random: seededRandom() });
      const { triangles, triCount } = buildTriangleGrid(400, 300, size);
      const { count } = buildLatticeVertices(triangles, triCount, surface.vertexEpsilon);

      expect(surface.vertexCount).toBe(count);
      expect(surface._vertexLights.length).toBe(count * 7);
      expect(surface._vertexWeights.length).toBe(count * 4);
    });

    it('every base triangle\'s 3 facets reference that triangle\'s own 3 vertex indices (_triVertexIndex)', () => {
      const { surface } = makeSurface();

      for (let t = 0; t < surface.triCount; t++) {
        const i0 = surface._triVertexIndex[t * 3];
        const i1 = surface._triVertexIndex[t * 3 + 1];
        const i2 = surface._triVertexIndex[t * 3 + 2];
        for (const vi of [i0, i1, i2]) {
          expect(vi).toBeGreaterThanOrEqual(0);
          expect(vi).toBeLessThan(surface.vertexCount);
        }
      }
    });

    it('precomputes per-vertex corner weights that sum to 1, matching the pure function', () => {
      const { surface } = makeSurface();

      for (let v = 0; v < surface.vertexCount; v++) {
        const o = v * 4;
        const sum = surface._vertexWeights[o] + surface._vertexWeights[o + 1] + surface._vertexWeights[o + 2] + surface._vertexWeights[o + 3];
        expect(sum).toBeCloseTo(1, 5);
      }

      const expected = computeCornerWeights(surface.vertexPositions[0], surface.vertexPositions[1], surface.canvas.width, surface.canvas.height, surface.cornerWeightFalloffRatio);
      expect(surface._vertexWeights[0]).toBeCloseTo(expected[0], 5);
      expect(surface._vertexWeights[1]).toBeCloseTo(expected[1], 5);
      expect(surface._vertexWeights[2]).toBeCloseTo(expected[2], 5);
      expect(surface._vertexWeights[3]).toBeCloseTo(expected[3], 5);
    });

    it('places vertex lights at z = vertexHeightRatio * nominal spike height', () => {
      const { surface } = makeSurface({ vertexHeightRatio: 0.5 });

      const expectedZ = 90 * surface.spikeHeightRatio * 0.5;
      for (let v = 0; v < surface.vertexCount; v++) {
        expect(surface._vertexLights[v * 7 + 2]).toBeCloseTo(expectedZ, 4);
      }
    });

    it('is deterministic given the same seeded random function', () => {
      const canvasA = createMockCanvas(400, 300);
      const canvasB = createMockCanvas(400, 300);
      const a = new EpcotSurface(createMockContext(canvasA), canvasA, { size: 90, random: seededRandom(7) });
      const b = new EpcotSurface(createMockContext(canvasB), canvasB, { size: 90, random: seededRandom(7) });

      expect(Array.from(a.centroids3D)).toEqual(Array.from(b.centroids3D));
      expect(Array.from(a.normals)).toEqual(Array.from(b.normals));
      expect(Array.from(a._triVertexIndex)).toEqual(Array.from(b._triVertexIndex));
      expect(Array.from(a.vertexPositions)).toEqual(Array.from(b.vertexPositions));
    });

    it('rebuild() regenerates geometry for the current canvas size', () => {
      const { canvas, surface } = makeSurface({ width: 400, height: 300 });
      const initialFacetCount = surface.facetCount;
      const initialVertexCount = surface.vertexCount;

      canvas.width = 1200;
      canvas.height = 900;
      surface.rebuild();

      expect(surface.facetCount).toBeGreaterThan(initialFacetCount);
      expect(surface.vertexCount).toBeGreaterThan(initialVertexCount);
      expect(surface.paths).toHaveLength(surface.facetCount);
    });

    it('rebuild() repositions vertex lights and recomputes their corner weights for new canvas dimensions', () => {
      const { canvas, surface } = makeSurface({ width: 400, height: 300 });

      const beforePositions = Array.from(surface.vertexPositions);

      canvas.width = 1600;
      canvas.height = 1000;
      surface.rebuild();

      const afterPositions = Array.from(surface.vertexPositions);
      expect(afterPositions).not.toEqual(beforePositions);

      for (let v = 0; v < surface.vertexCount; v++) {
        const x = surface.vertexPositions[v * 2], y = surface.vertexPositions[v * 2 + 1];
        const expected = computeCornerWeights(x, y, 1600, 1000, surface.cornerWeightFalloffRatio);
        const o = v * 4;
        expect(surface._vertexWeights[o]).toBeCloseTo(expected[0], 5);
        expect(surface._vertexWeights[o + 1]).toBeCloseTo(expected[1], 5);
        expect(surface._vertexWeights[o + 2]).toBeCloseTo(expected[2], 5);
        expect(surface._vertexWeights[o + 3]).toBeCloseTo(expected[3], 5);
      }
    });

    it('inflates each facet outward from its own centroid so adjacent triangles overlap slightly', () => {
      const { surface } = makeSurface({ width: 200, height: 200, seamInflatePx: 5 });

      const [ax, ay, bx, by, cx0, cy0] = surface.positions2D.slice(0, 6);
      const centroidX = (ax + bx + cx0) / 3;
      const centroidY = (ay + by + cy0) / 3;
      const rawDistA = Math.hypot(ax - centroidX, ay - centroidY);

      const path = surface.paths[0];
      expect(path).toBeInstanceOf(Path2D);
      const moveToOp = path._path.find((op) => op.type === 'moveTo');
      expect(moveToOp).toBeDefined();
      const inflatedDist = Math.hypot(moveToOp.props.x - centroidX, moveToOp.props.y - centroidY);
      expect(inflatedDist).toBeGreaterThan(rawDistA);
      expect(inflatedDist - rawDistA).toBeCloseTo(5, 1);
    });
  });

  describe('gathered light lists', () => {
    it('every triangle gathers at least 3 lights within reach, including all 3 of its own vertices', () => {
      const { surface } = makeSurface({ width: 400, height: 300 });

      for (let t = 0; t < surface.triCount; t++) {
        const start = surface._triLightStart[t];
        const count = surface._triLightCount[t];
        expect(count).toBeGreaterThanOrEqual(3);

        const gathered = new Set();
        for (let k = 0; k < count; k++) gathered.add(surface._triLightIdx[start + k]);

        const own = [surface._triVertexIndex[t * 3], surface._triVertexIndex[t * 3 + 1], surface._triVertexIndex[t * 3 + 2]];
        for (const v of own) {
          expect(gathered.has(v)).toBe(true);
        }
      }
    });

    it('_triLightIdx entries are always valid vertex indices', () => {
      const { surface } = makeSurface({ width: 400, height: 300 });
      for (let i = 0; i < surface._triLightIdx.length; i++) {
        const vi = surface._triLightIdx[i];
        expect(vi).toBeGreaterThanOrEqual(0);
        expect(vi).toBeLessThan(surface.vertexCount);
      }
    });
  });

  describe('shadow occlusion', () => {
    it('every precomputed shadow factor lies within [shadows.floor, 1]', () => {
      const { surface } = makeSurface({ width: 500, height: 400, size: 70, shadowsEnabled: true });

      const floor = config.epcot.shadows.floor;
      expect(surface._triLightShadow.length).toBe(surface._triLightIdx.length);
      for (const f of surface._triLightShadow) {
        expect(f).toBeGreaterThanOrEqual(floor - 1e-9);
        expect(f).toBeLessThanOrEqual(1 + 1e-9);
      }
    });

    it('shadows disabled leaves every factor at exactly 1 (no occlusion)', () => {
      const { surface } = makeSurface({ width: 500, height: 400, size: 70, shadowsEnabled: false });
      for (const f of surface._triLightShadow) {
        expect(f).toBe(1);
      }
    });
  });

  describe('update()', () => {
    it('advances the pattern clock by deltaTime * speed', () => {
      const { surface } = makeSurface({ width: 200, height: 200, speed: 2 });

      expect(surface.clock).toBe(0);
      surface.update(0.5);
      expect(surface.clock).toBeCloseTo(1.0, 5);
      surface.update(0.25);
      expect(surface.clock).toBeCloseTo(1.5, 5);
    });
  });

  describe('draw()', () => {
    it('fills exactly the active triangles\' facets (3 per active triangle), and never strokes the main canvas', () => {
      const { ctx, surface } = makeSurface({ width: 200, height: 200 });

      const fillSpy = vi.spyOn(ctx, 'fill');
      const strokeSpy = vi.spyOn(ctx, 'stroke');

      surface.update(0.016);
      expect(() => surface.draw()).not.toThrow();

      let activeCount = 0;
      for (let t = 0; t < surface.triCount; t++) if (surface._triActive[t]) activeCount++;

      expect(fillSpy).toHaveBeenCalledTimes(activeCount * 3);
      expect(fillSpy.mock.calls.length).toBeLessThanOrEqual(surface.facetCount);
      expect(strokeSpy).not.toHaveBeenCalled();
    });

    it('composites the baked floor layer and the gap layer, each with exactly one drawImage() call', () => {
      // Bulbs disabled here so the only drawImage() calls are the two baked
      // layers - bulb sprite compositing is covered separately below.
      const { ctx, surface } = makeSurface({ width: 200, height: 200, showVertexDots: false });

      const drawImageSpy = vi.spyOn(ctx, 'drawImage');
      surface.update(0.016);
      surface.draw();

      // Note: two identically-sized-and-attributed <canvas> elements are
      // structurally equal under vitest's deep-equality matchers, so
      // toHaveBeenCalledWith(surface._gapCanvas, ...) would pass even for a
      // call that actually passed _floorCanvas. Assert by object identity
      // instead to genuinely distinguish which canvas was composited.
      expect(drawImageSpy).toHaveBeenCalledTimes(2);
      expect(drawImageSpy.mock.calls[0][0]).toBe(surface._floorCanvas);
      expect(drawImageSpy.mock.calls[0][1]).toBe(0);
      expect(drawImageSpy.mock.calls[0][2]).toBe(0);
      expect(drawImageSpy.mock.calls[1][0]).toBe(surface._gapCanvas);
      expect(drawImageSpy.mock.calls[1][1]).toBe(0);
      expect(drawImageSpy.mock.calls[1][2]).toBe(0);
    });

    it('gap layer is rendered once at rebuild(), not redrawn on every draw() call', () => {
      const { surface } = makeSurface({ width: 200, height: 200 });

      // gapCtx.stroke is already a persistent vitest-canvas-mock vi.fn() with
      // calls recorded from rebuild() inside the constructor (perimeter +
      // internal edges) - vi.spyOn() on an already-mocked function returns it
      // as-is, carrying that history forward, so clear it explicitly rather
      // than asserting an absolute zero count.
      const gapCtx = surface._gapCanvas.getContext('2d');
      gapCtx.stroke.mockClear();

      surface.update(0.016);
      surface.draw();
      surface.update(0.016);
      surface.draw();
      surface.update(0.016);
      surface.draw();

      expect(gapCtx.stroke).not.toHaveBeenCalled();
    });

    it('gap layer can be disabled entirely (floor layer still composites, but never the gap canvas)', () => {
      const { ctx, surface } = makeSurface({ width: 200, height: 200, gapEnabled: false, showVertexDots: false });

      const drawImageSpy = vi.spyOn(ctx, 'drawImage');
      surface.update(0.016);
      surface.draw();

      // Object-identity check - see note above on why toHaveBeenCalledWith
      // can't distinguish two structurally-identical <canvas> elements.
      const canvasArgs = drawImageSpy.mock.calls.map((c) => c[0]);
      expect(canvasArgs).toContain(surface._floorCanvas);
      expect(canvasArgs).not.toContain(surface._gapCanvas);
    });

    it('bulbs: showBulbs draws additional sprites beyond the floor+gap baseline; brightness=0 draws none', () => {
      const { ctx, surface } = makeSurface({ width: 200, height: 200, pattern: 'chase', showVertexDots: true });

      const drawImageSpy = vi.spyOn(ctx, 'drawImage');
      surface.update(0); // t=0: chase pattern's corner 0 is at full intensity
      surface.draw();
      expect(drawImageSpy.mock.calls.length).toBeGreaterThan(2); // > floor+gap baseline

      const { ctx: ctxDark, surface: surfaceDark } = makeSurface({ width: 200, height: 200, pattern: 'chase', showVertexDots: true, brightness: 0 });
      const drawImageSpyDark = vi.spyOn(ctxDark, 'drawImage');
      surfaceDark.update(0);
      surfaceDark.draw();
      expect(drawImageSpyDark.mock.calls.length).toBe(2); // only floor+gap; peak=0 skips the whole bulb block
    });

    it('bulbs are skipped entirely when showBulbs is false', () => {
      const { ctx, surface } = makeSurface({ width: 200, height: 200, pattern: 'chase', showVertexDots: false });

      const drawImageSpy = vi.spyOn(ctx, 'drawImage');
      surface.update(0);
      surface.draw();

      expect(drawImageSpy.mock.calls.length).toBe(2); // only floor+gap
    });
  });

  describe('color patterns keep every bulb lit', () => {
    for (const pattern of ['split', 'sweep', 'bands', 'mix']) {
      it(`'${pattern}' pattern: every vertex has intensity > 0 after draw()`, () => {
        const { surface } = makeSurface({ width: 300, height: 220, pattern });
        surface.update(1.3);
        surface.draw();

        for (let v = 0; v < surface.vertexCount; v++) {
          expect(surface._vertexLights[v * 7 + 6]).toBeGreaterThan(0);
        }
      });
    }

    it('a non-color intensity pattern (chase) does NOT keep every bulb lit', () => {
      // Sanity check that the above is a real property of color patterns,
      // not just true for every pattern (floor lift aside, which is added
      // after this snapshot would be taken - here we check the pattern's
      // own field response directly for a sparse-lighting pattern).
      const { surface } = makeSurface({ width: 300, height: 220, pattern: 'chase', bulbFloor: 0 });
      surface.applySettings({ bulbFloor: 0 }); // re-bake floor layer with floor 0 -> no idle floor light
      surface.update(0.5);
      surface.draw();

      let anyDark = false;
      for (let v = 0; v < surface.vertexCount; v++) {
        if (surface._vertexLights[v * 7 + 6] <= 0) { anyDark = true; break; }
      }
      expect(anyDark).toBe(true);
    });
  });

  describe('floor light layer', () => {
    it('with bulbFloor=0, the floor layer paints only the flat ambient background (no per-facet fills)', () => {
      const { surface } = makeSurface({ width: 300, height: 220, bulbFloor: 0.35 });
      const floorCtx = surface._floorCanvas.getContext('2d');
      const fillSpy = vi.spyOn(floorCtx, 'fill');
      const fillRectSpy = vi.spyOn(floorCtx, 'fillRect');
      // vi.spyOn() on an already-mocked function (getContext returns a
      // persistent vitest-canvas-mock instance) carries forward its call
      // history from construction's initial bake - clear it so we only
      // observe the applySettings() call below.
      fillSpy.mockClear();
      fillRectSpy.mockClear();

      surface.applySettings({ bulbFloor: 0 });

      expect(fillRectSpy).toHaveBeenCalled(); // the flat ambient background
      expect(fillSpy).not.toHaveBeenCalled(); // early-returns before any per-facet fill
    });

    it('with bulbFloor > 0, the floor layer is non-uniform: some facet is strictly brighter than pure ambient', () => {
      const { surface } = makeSurface({ width: 300, height: 220, bulbFloor: 0 });
      const floorCtx = surface._floorCanvas.getContext('2d');

      // Capture fillStyle AT the moment each fill() call happens (reading
      // ctx.fillStyle only after the loop, once fill() has already been
      // called many times, would just see the LAST facet's color for every
      // entry) by wrapping the real mock implementation.
      // floorCtx.fill is already a persistent vitest-canvas-mock vi.fn();
      // mockImplementation() here just records, without needing to call
      // through (the mock's fill() doesn't rasterize pixels either way -
      // see getImageData's always-blank return - so there's no real
      // side effect to preserve for this test).
      const capturedStyles = [];
      vi.spyOn(floorCtx, 'fill').mockImplementation(() => {
        capturedStyles.push(floorCtx.fillStyle);
      });

      surface.applySettings({ bulbFloor: 0.5 });

      expect(capturedStyles.length).toBeGreaterThan(0);

      // The mock's fillStyle setter normalizes to '#rrggbb' hex; parse both
      // that and 'rgb(...)' defensively.
      const parseColor = (s) => {
        const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
        if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
        const rgb = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s);
        if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
        return null;
      };

      const ambient = parseColor(surface._ambientColor);
      const ambientSum = ambient ? ambient[0] + ambient[1] + ambient[2] : 0;

      let brighterThanAmbientFound = false;
      for (const s of capturedStyles) {
        const c = parseColor(s);
        if (!c) continue;
        if (c[0] + c[1] + c[2] > ambientSum) { brighterThanAmbientFound = true; break; }
      }
      expect(brighterThanAmbientFound).toBe(true);
    });
  });

  describe('applySettings()', () => {
    it('pattern, speed, brightness, colorBlend, coreStyle, overlayPattern, showBulbs: live-updated, no rebuild', () => {
      const { surface } = makeSurface();
      const spy = vi.spyOn(surface, 'rebuild');

      surface.applySettings({ pattern: 'wave' });
      surface.applySettings({ speed: 2.5 });
      surface.applySettings({ brightness: 1.8 });
      surface.applySettings({ colorBlend: true });
      surface.applySettings({ coreStyle: 'white' });
      surface.applySettings({ overlayPattern: 'twinkle' });
      surface.applySettings({ showBulbs: false });

      expect(surface.patternName).toBe('wave');
      expect(surface.speed).toBe(2.5);
      expect(surface.brightness).toBe(1.8);
      expect(surface.colorBlend).toBe(true);
      expect(surface.coreStyle).toBe('white');
      expect(surface.overlayPattern).toBe('twinkle');
      expect(surface.showBulbs).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });

    it('meteor* settings (interval/speed/tail/tracks/direction) are live-updated, no rebuild', () => {
      const { surface } = makeSurface();
      const spy = vi.spyOn(surface, 'rebuild');

      surface.applySettings({ meteorInterval: 5 });
      surface.applySettings({ meteorSpeed: 20 });
      surface.applySettings({ meteorTail: 4 });
      surface.applySettings({ meteorTracks: 3 });
      surface.applySettings({ meteorDirection: 'down-left' });

      expect(surface.meteorInterval).toBe(5);
      expect(surface.meteorSpeed).toBe(20);
      expect(surface.meteorTail).toBe(4);
      expect(surface.meteorTracks).toBe(3);
      expect(surface.meteorDirection).toBe('down-left');
      expect(spy).not.toHaveBeenCalled();
    });

    it('fisheye/fisheyeStrength changes trigger a full rebuild', () => {
      const { surface } = makeSurface({ fisheye: false });
      const spy = vi.spyOn(surface, 'rebuild');

      surface.applySettings({ fisheye: true });
      expect(spy).toHaveBeenCalledTimes(1);

      surface.applySettings({ fisheyeStrength: 1.4 });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(surface.fisheyeStrength).toBe(1.4);
    });

    it('fisheye/fisheyeStrength set to their current value do NOT rebuild', () => {
      const { surface } = makeSurface({ fisheye: true, fisheyeStrength: 0.8 });
      const spy = vi.spyOn(surface, 'rebuild');

      surface.applySettings({ fisheye: true });
      surface.applySettings({ fisheyeStrength: 0.8 });

      expect(spy).not.toHaveBeenCalled();
    });

    it('brightness/specularWeight/bounceStrength re-bake the floor layer without a full rebuild', () => {
      const { surface } = makeSurface();
      const rebuildSpy = vi.spyOn(surface, 'rebuild');
      const floorSpy = vi.spyOn(surface, '_rebuildFloorLayer');

      surface.applySettings({ brightness: 1.5 });
      expect(floorSpy).toHaveBeenCalledTimes(1);
      surface.applySettings({ specularWeight: 3 });
      expect(floorSpy).toHaveBeenCalledTimes(2);
      surface.applySettings({ bounceStrength: 0.2 });
      expect(floorSpy).toHaveBeenCalledTimes(3);

      expect(rebuildSpy).not.toHaveBeenCalled();
    });

    it('bulbFloor change re-bakes the floor layer, not a full rebuild', () => {
      const { surface } = makeSurface({ bulbFloor: 0.35 });
      const rebuildSpy = vi.spyOn(surface, 'rebuild');
      const floorSpy = vi.spyOn(surface, '_rebuildFloorLayer');

      surface.applySettings({ bulbFloor: 0.1 });

      expect(floorSpy).toHaveBeenCalled();
      expect(rebuildSpy).not.toHaveBeenCalled();
      expect(surface.bulbFloor).toBe(0.1);
    });

    it('bulbFloor set to its current value is a no-op (no re-bake)', () => {
      const { surface } = makeSurface({ bulbFloor: 0.35 });
      const floorSpy = vi.spyOn(surface, '_rebuildFloorLayer');

      surface.applySettings({ bulbFloor: 0.35 });

      expect(floorSpy).not.toHaveBeenCalled();
    });

    it('scheme, saturation, size, gapWidth, bulbStyle, beamLengthRatio, glowRadiusRatio, shadowsEnabled changes trigger a full rebuild', () => {
      const cases = [
        { scheme: 'rainbow' },
        { saturation: 2.0 },
        { size: 120 },
        { gapWidth: 3 },
        { bulbStyle: 'burst' },
        { beamLengthRatio: 1.5 },
        { glowRadiusRatio: 0.6 },
        { shadowsEnabled: false },
        { fisheye: true },
        { fisheyeStrength: 1.5 }
      ];

      for (const partial of cases) {
        const { surface } = makeSurface();
        const spy = vi.spyOn(surface, 'rebuild');
        surface.applySettings(partial);
        expect(spy, `applySettings(${JSON.stringify(partial)}) should rebuild`).toHaveBeenCalledTimes(1);
      }
    });

    it('scheme/saturation/size/gapWidth/bulbStyle/beamLengthRatio set to their current value do NOT rebuild', () => {
      const { surface } = makeSurface({ scheme: 'mono', saturation: 1.2, gapWidth: 2, bulbStyle: 'star4', beamLengthRatio: 1.0 });
      const spy = vi.spyOn(surface, 'rebuild');

      surface.applySettings({ scheme: 'mono' });
      surface.applySettings({ saturation: 1.2 });
      surface.applySettings({ size: surface.size });
      surface.applySettings({ gapWidth: 2 });
      surface.applySettings({ bulbStyle: 'star4' });
      surface.applySettings({ beamLengthRatio: 1.0 });

      expect(spy).not.toHaveBeenCalled();
    });

    it('colorHSL always rebuilds, even when the value is unchanged', () => {
      const { surface } = makeSurface();
      const spy = vi.spyOn(surface, 'rebuild');

      surface.applySettings({ colorHSL: { h: surface.baseHSL.h, s: surface.baseHSL.s, l: surface.baseHSL.l } });

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('draw() after applySettings() does not throw', () => {
      const { surface } = makeSurface();
      surface.applySettings({ pattern: 'radial', scheme: 'duo', brightness: 1.3, saturation: 1.6 });
      surface.update(0.5);
      expect(() => surface.draw()).not.toThrow();
    });
  });

  describe('constructs and draws without error across schemes and patterns', () => {
    for (const scheme of cfg.scheme.options) {
      for (const pattern of ['steady', 'chase', 'wave', 'auto', 'split']) {
        it(`scheme=${scheme}, pattern=${pattern}`, () => {
          const canvas = createMockCanvas(220, 160);
          const ctx = createMockContext(canvas);
          const surface = new EpcotSurface(ctx, canvas, { size: 90, random: seededRandom(), scheme, pattern });

          surface.update(0.5);
          expect(() => surface.draw()).not.toThrow();
        });
      }
    }
  });

  describe('constructs and draws without error across overlays, blend, and shadows', () => {
    for (const overlay of cfg.bulbs.overlayOptions) {
      for (const colorBlend of [false, true]) {
        it(`overlay=${overlay}, blend=${colorBlend}`, () => {
          const canvas = createMockCanvas(220, 160);
          const ctx = createMockContext(canvas);
          const surface = new EpcotSurface(ctx, canvas, {
            size: 90,
            random: seededRandom(),
            overlayPattern: overlay,
            colorBlend,
            pattern: 'split',
            scheme: 'illuminations',
            shadowsEnabled: true
          });

          surface.update(1);
          expect(() => surface.draw()).not.toThrow();
        });
      }
    }
  });

  describe('auto pattern crossfade', () => {
    it('runs multiple frames across several segment/crossfade boundaries without throwing', () => {
      const { surface } = makeSurface({
        pattern: 'auto',
        autoSegmentDuration: 1,
        autoFadeDuration: 0.3
      });

      for (let i = 0; i < 40; i++) {
        surface.update(0.1); // 4s total, crosses several 1s segment boundaries
        expect(() => surface.draw()).not.toThrow();
      }
    });

    it('crossfades smoothly: intensity field does not jump discontinuously across a segment boundary', () => {
      const { surface } = makeSurface({
        pattern: 'auto',
        autoSegmentDuration: 1,
        autoFadeDuration: 0.3,
        width: 300,
        height: 220
      });

      // Sample the pattern field just before and after a segment boundary
      // (t=1) at fine granularity; consecutive samples should stay close.
      let prevSum = null;
      for (let t = 0.85; t <= 1.15; t += 0.01) {
        surface.clock = t;
        surface.draw();
        let sum = 0;
        for (let v = 0; v < surface.vertexCount; v++) sum += surface._vertexLights[v * 7 + 6];
        if (prevSum !== null) {
          // No hard cliff: bounded relative change per 0.01s step.
          expect(Math.abs(sum - prevSum)).toBeLessThan(Math.max(50, prevSum * 0.6) + 1);
        }
        prevSum = sum;
      }
    });
  });

  describe('tone mapping (soft-knee, hue-preserving)', () => {
    // The tone-map is an inline formula in EpcotSurface.draw()'s pass 3
    // (not an exported function); this mirrors that exact formula to test
    // its mathematical properties in isolation. Keep in sync with the
    // "Hue-preserving soft-knee tone map" block in draw() if that formula
    // ever changes.
    function toneMap(dr, dg, db) {
      const m = Math.max(dr, dg, db);
      if (m > 191) {
        const mn = m / 255;
        const compressed = 0.75 + 0.25 * (1 - Math.exp(-(mn - 0.75) / 0.5));
        const scale = (compressed * 255) / m;
        return [dr * scale, dg * scale, db * scale];
      }
      return [dr, dg, db];
    }

    it('leaves channels untouched below the knee (m <= 191)', () => {
      const [r, g, b] = toneMap(100, 50, 150);
      expect([r, g, b]).toEqual([100, 50, 150]);
    });

    it('preserves channel ratios exactly above the knee (uniform per-channel scale)', () => {
      const [r, g, b] = toneMap(400, 200, 100);
      // scale is the same factor for all 3 channels, so ratios are exact.
      expect(r / g).toBeCloseTo(400 / 200, 6);
      expect(g / b).toBeCloseTo(200 / 100, 6);
    });

    it('compresses (does not clip) very hot input toward, but not touching, a bright but non-white cap', () => {
      const [r, g, b] = toneMap(4000, 2000, 1000);
      const max = Math.max(r, g, b);
      expect(max).toBeLessThan(4000); // compressed down from the raw input
      expect(max).toBeGreaterThan(191); // still bright, not crushed to the knee
      // Ratio still holds even at extreme input.
      expect(r / g).toBeCloseTo(2, 5);
      expect(g / b).toBeCloseTo(2, 5);
    });

    it('is monotonically increasing in the input magnitude (brighter stays brighter)', () => {
      const a = toneMap(200, 100, 50);
      const b = toneMap(600, 300, 150);
      expect(Math.max(...b)).toBeGreaterThan(Math.max(...a));
    });
  });

  describe('configurable meteors (config shape)', () => {
    it('config.epcot.bulbs exposes the meteor* keys with sane defaults', () => {
      const b = cfg.bulbs;
      expect(typeof b.meteorInterval).toBe('number');
      expect(typeof b.meteorSpeed).toBe('number');
      expect(typeof b.meteorTail).toBe('number');
      expect(b.meteorLife).toBeUndefined(); // lifetime is derived, not configured
      expect(typeof b.meteorTracks).toBe('number');
      expect(b.meteorTracks).toBeGreaterThanOrEqual(1);
      expect(b.meteorTracks).toBeLessThanOrEqual(4);
      expect(typeof b.meteorDirection).toBe('string');
      expect(Array.isArray(b.meteorDirectionOptions)).toBe(true);
      expect(b.meteorDirectionOptions).toContain(b.meteorDirection);
      expect(b.meteorDirectionOptions).toEqual(['random', 'right', 'down-right', 'down-left', 'left', 'up-left', 'up-right']);
    });

    it('constructor accepts every meteorDirection option without throwing', () => {
      for (const dir of cfg.bulbs.meteorDirectionOptions) {
        const { surface } = makeSurface({ overlayPattern: 'meteor', meteorDirection: dir });
        surface.update(0.5);
        expect(() => surface.draw()).not.toThrow();
      }
    });
  });

  describe('meteor overlay: fixed direction locks streaks to that lattice axis', () => {
    // Deterministic per-meteor spawn point/direction come from a hash of
    // the meteor index only (not the seeded RNG), so the same
    // (direction, canvas size, meteor params) always produces the same
    // streak - these parameters were chosen empirically to land a
    // non-trivial, in-bounds streak for every fixed direction.
    const METEOR_OPTS = {
      width: 1400, height: 1400,
      overlayPattern: 'meteor',
      meteorTracks: 1,
      meteorSpeed: 6,
      meteorTail: 3,
      meteorInterval: 3.6
    };

    function angleFor(dir) {
      const dirNames = cfg.bulbs.meteorDirectionOptions;
      const fixedDir = dirNames.indexOf(dir) - 1;
      return (fixedDir * Math.PI) / 3;
    }

    function collectLitPositions(surface) {
      const out = new Float32Array(surface.vertexCount);
      const lit = new Map();
      for (let tau = 0.2; tau <= 1.1; tau += 0.1) {
        surface._fillOverlay('meteor', tau, out);
        for (let v = 0; v < surface.vertexCount; v++) {
          if (out[v] > 0.02) lit.set(v, [surface.vertexPositions[v * 2], surface.vertexPositions[v * 2 + 1]]);
        }
      }
      return [...lit.values()];
    }

    for (const dir of ['right', 'down-right', 'down-left', 'left', 'up-left', 'up-right']) {
      it(`direction='${dir}': every lit vertex lies on the ${dir} lattice axis`, () => {
        const { surface } = makeSurface({ ...METEOR_OPTS, meteorDirection: dir });
        const points = collectLitPositions(surface);

        expect(points.length).toBeGreaterThanOrEqual(3);

        const angle = angleFor(dir);
        const axisX = Math.cos(angle), axisY = Math.sin(angle);

        // Every pairwise vector between lit points must be (anti-)parallel
        // to the fixed axis - i.e. all lit bulbs sit on one straight line
        // running along that direction, not scattered off-axis.
        for (let i = 0; i < points.length; i++) {
          for (let j = i + 1; j < points.length; j++) {
            const dx = points[j][0] - points[i][0];
            const dy = points[j][1] - points[i][1];
            const len = Math.hypot(dx, dy);
            if (len < 1) continue; // skip near-duplicate points
            const dot = (dx / len) * axisX + (dy / len) * axisY;
            expect(Math.abs(dot)).toBeGreaterThan(0.99);
          }
        }
      });
    }
  });

  describe('meteor overlay: streaks always originate on a canvas edge (origin invariant)', () => {
    // Regression test: meteor start points used to be a hash-random point
    // ANYWHERE on the canvas, so streaks could ignite mid-screen. Now each
    // meteor spawns just outside the edge its direction travels INTO, and
    // slides onto the canvas from there - so the very first vertices any
    // given streak lights should sit near a canvas edge, never deep in the
    // interior.
    //
    // There is no configured meteorLife any more - each streak's lifetime
    // is derived from how far its ray must travel to fully exit the
    // canvas (plus one tail-length). For this test's fixed canvas/speed/
    // tail, that derived lifetime is bounded well under MAX_LIFE below
    // (verified empirically: actual max ~2.67s for a 900x700 canvas at
    // this speed) - used only to (a) cap the ignition-search scan and
    // (b) space out staggered tracks far enough apart that they never
    // overlap, so each track's own earliest ignition can be observed in
    // isolation through the public _fillOverlay API.
    const WIDTH = 900, HEIGHT = 700, SIZE = 90;
    const EDGE_TOLERANCE = 1.5 * SIZE;
    const SPEED = 6, TAIL = 3;
    const MAX_LIFE = (WIDTH + HEIGHT + TAIL * SIZE) / (SPEED * SIZE); // generous upper bound

    function distToEdge(x, y) {
      return Math.min(x, WIDTH - x, y, HEIGHT - y);
    }

    // Earliest tau (from a given base time) at which any vertex lights,
    // and the (x,y) of every vertex lit at that first moment. Ignition
    // always happens quickly relative to a streak's full lifetime, so a
    // short scan window well under MAX_LIFE is enough to find it.
    function earliestLitPositions(surface, base) {
      const out = new Float32Array(surface.vertexCount);
      for (let tau = 0.01; tau <= 1.5; tau += 0.02) {
        surface._fillOverlay('meteor', base + tau, out);
        const positions = [];
        for (let v = 0; v < surface.vertexCount; v++) {
          if (out[v] > 0.02) {
            positions.push([surface.vertexPositions[v * 2], surface.vertexPositions[v * 2 + 1]]);
          }
        }
        if (positions.length > 0) return positions;
      }
      return null; // never ignited within the sampled window
    }

    const FIXED_DIRS = ['right', 'down-right', 'down-left', 'left', 'up-left', 'up-right'];

    for (const dir of FIXED_DIRS) {
      it(`direction='${dir}': earliest-lit vertices across several meteor indices sit within 1.5 triangle-sizes of a canvas edge`, () => {
        const { surface } = makeSurface({
          width: WIDTH, height: HEIGHT, size: SIZE,
          overlayPattern: 'meteor',
          meteorDirection: dir,
          meteorTracks: 1, // single track: no stagger overlap to disentangle
          meteorSpeed: SPEED,
          meteorTail: TAIL,
          meteorInterval: 3.6
        });
        const interval = Math.max(0.5, surface.meteorInterval);

        let ignitedAtLeastOnce = false;
        for (let m = 0; m < 5; m++) {
          const positions = earliestLitPositions(surface, m * interval);
          if (!positions) continue;
          ignitedAtLeastOnce = true;
          for (const [x, y] of positions) {
            expect(distToEdge(x, y)).toBeLessThanOrEqual(EDGE_TOLERANCE);
          }
        }
        expect(ignitedAtLeastOnce).toBe(true);
      });
    }

    it("direction='random': earliest-lit vertices sit near a canvas edge regardless of which axis each meteor picks", () => {
      const { surface } = makeSurface({
        width: WIDTH, height: HEIGHT, size: SIZE,
        overlayPattern: 'meteor',
        meteorDirection: 'random',
        meteorTracks: 1,
        meteorSpeed: SPEED,
        meteorTail: TAIL,
        meteorInterval: 3.6
      });
      const interval = Math.max(0.5, surface.meteorInterval);

      let ignitedAtLeastOnce = false;
      for (let m = 0; m < 12; m++) {
        const positions = earliestLitPositions(surface, m * interval);
        if (!positions) continue;
        ignitedAtLeastOnce = true;
        for (const [x, y] of positions) {
          expect(distToEdge(x, y)).toBeLessThanOrEqual(EDGE_TOLERANCE);
        }
      }
      expect(ignitedAtLeastOnce).toBe(true);
    });

    it('multiple tracks (varying j): every staggered track\'s own earliest ignition is still near a canvas edge', () => {
      // Space the stagger interval wide enough that at most one track is
      // ever mid-life at a time (spacing = interval/tracks > MAX_LIFE), so
      // each track's own ignition can be observed in isolation via the
      // public _fillOverlay API instead of the internal per-track hash.
      const tracks = 4;
      const spacing = MAX_LIFE + 2; // comfortable margin over the derived max life
      const interval = spacing * tracks;
      const { surface } = makeSurface({
        width: WIDTH, height: HEIGHT, size: SIZE,
        overlayPattern: 'meteor',
        meteorDirection: 'random',
        meteorTracks: tracks,
        meteorSpeed: SPEED,
        meteorTail: TAIL,
        meteorInterval: interval
      });

      let ignitedAtLeastOnce = false;
      for (let j = 0; j < tracks; j++) {
        for (let m = 0; m < 2; m++) {
          const base = m * interval + (j * interval) / tracks;
          const positions = earliestLitPositions(surface, base);
          if (!positions) continue;
          ignitedAtLeastOnce = true;
          for (const [x, y] of positions) {
            expect(distToEdge(x, y)).toBeLessThanOrEqual(EDGE_TOLERANCE);
          }
        }
      }
      expect(ignitedAtLeastOnce).toBe(true);
    });
  });

  describe('meteor overlay: track/interval clamping', () => {
    // Streak lifetime is now derived from how far a ray must travel to
    // exit the canvas (there is no configured meteorLife any more), so at
    // the suite's default small canvas (300x220) and default meteorSpeed
    // every streak's life is very short - too short for staggered tracks
    // to ever overlap within T_SAMPLES, which would make the "more tracks
    // differs from fewer tracks" test vacuously true (identically empty)
    // by accident rather than by exercising real overlap. A slower default
    // speed (overridable per-test like every other param) stretches every
    // streak's derived life comfortably across the sampled window without
    // inflating canvas/grid size.
    function sampleOverlay(overrides, tSamples) {
      const { surface } = makeSurface({ overlayPattern: 'meteor', meteorSpeed: 2, ...overrides });
      const out = new Float32Array(surface.vertexCount);
      const snapshots = [];
      for (const t of tSamples) {
        surface._fillOverlay('meteor', t, out);
        snapshots.push(Array.from(out));
      }
      return snapshots;
    }

    const T_SAMPLES = [0.3, 0.9, 1.6, 2.4, 3.1];

    it('meteorTracks is clamped to a max of 4: 10 tracks behaves identically to 4', () => {
      const a = sampleOverlay({ meteorTracks: 4 }, T_SAMPLES);
      const b = sampleOverlay({ meteorTracks: 10 }, T_SAMPLES);
      expect(b).toEqual(a);
    });

    it('meteorTracks is clamped to a min of 1: 0 and -3 tracks both behave like 1', () => {
      const a = sampleOverlay({ meteorTracks: 1 }, T_SAMPLES);
      const b = sampleOverlay({ meteorTracks: 0 }, T_SAMPLES);
      const c = sampleOverlay({ meteorTracks: -3 }, T_SAMPLES);
      expect(b).toEqual(a);
      expect(c).toEqual(a);
    });

    it('meteorTracks=10 differs from meteorTracks=1 (clamping isn\'t just always collapsing to 1)', () => {
      const a = sampleOverlay({ meteorTracks: 1 }, T_SAMPLES);
      const b = sampleOverlay({ meteorTracks: 10 }, T_SAMPLES);
      expect(b).not.toEqual(a);
    });

    it('meteorInterval is floored at 0.5s: 0.1 behaves identically to 0.5', () => {
      const a = sampleOverlay({ meteorInterval: 0.5 }, T_SAMPLES);
      const b = sampleOverlay({ meteorInterval: 0.1 }, T_SAMPLES);
      expect(b).toEqual(a);
    });

    it('a larger meteorTail only ever lights a superset of a smaller tail\'s vertices (same head position)', () => {
      const { surface } = makeSurface({ overlayPattern: 'meteor', meteorTracks: 1, meteorTail: 1 });
      const outSmall = new Float32Array(surface.vertexCount);
      surface._fillOverlay('meteor', 0.6, outSmall);

      surface.applySettings({ meteorTail: 6 });
      const outLarge = new Float32Array(surface.vertexCount);
      surface._fillOverlay('meteor', 0.6, outLarge);

      let smallCount = 0, largeCount = 0;
      for (let v = 0; v < surface.vertexCount; v++) {
        if (outSmall[v] > 0.02) { smallCount++; expect(outLarge[v]).toBeGreaterThan(0.02); }
        if (outLarge[v] > 0.02) largeCount++;
      }
      expect(largeCount).toBeGreaterThanOrEqual(smallCount);
    });
  });

  describe('fisheye: pure display projection', () => {
    it('KEY INVARIANT: simulation geometry (vertex positions, normals, centroids) is IDENTICAL with fisheye on vs off, same seed', () => {
      const canvasFlat = createMockCanvas(400, 300);
      const flat = new EpcotSurface(createMockContext(canvasFlat), canvasFlat, { size: 90, random: seededRandom(5), fisheye: false });

      const canvasFish = createMockCanvas(400, 300);
      const fish = new EpcotSurface(createMockContext(canvasFish), canvasFish, { size: 90, random: seededRandom(5), fisheye: true, fisheyeStrength: 0.8 });

      expect(Array.from(fish.vertexPositions)).toEqual(Array.from(flat.vertexPositions));
      expect(Array.from(fish.normals)).toEqual(Array.from(flat.normals));
      expect(Array.from(fish.centroids3D)).toEqual(Array.from(flat.centroids3D));

      // Vertex-light x/y (fed into shading, not drawing) must also match.
      for (let v = 0; v < flat.vertexCount; v++) {
        expect(fish._vertexLights[v * 7]).toBeCloseTo(flat._vertexLights[v * 7], 6);
        expect(fish._vertexLights[v * 7 + 1]).toBeCloseTo(flat._vertexLights[v * 7 + 1], 6);
      }
    });

    it('_vertexDrawPos === vertexPositions (same array, not a copy) when fisheye is off', () => {
      const { surface } = makeSurface({ fisheye: false });
      expect(surface._vertexDrawPos).toBe(surface.vertexPositions);
    });

    it('_vertexDrawPos is a distinct, warped copy when fisheye is on', () => {
      const { surface } = makeSurface({ fisheye: true, fisheyeStrength: 0.8 });
      expect(surface._vertexDrawPos).not.toBe(surface.vertexPositions);
      expect(Array.from(surface._vertexDrawPos)).not.toEqual(Array.from(surface.vertexPositions));
    });

    it('warp is monotonic radially (no folding) for strengths across 0.1..2', () => {
      const width = 400, height = 300;
      const cx = width / 2, cy = height / 2;

      for (const strength of [0.1, 0.5, 0.8, 1, 1.2, 1.5, 2]) {
        const { surface } = makeSurface({ width, height, fisheye: true, fisheyeStrength: strength });
        const out = [0, 0];
        let prevR = -Infinity;
        for (let d = 5; d <= 260; d += 5) {
          surface._warpPoint(cx + d, cy, out);
          const r = Math.hypot(out[0] - cx, out[1] - cy);
          expect(r).toBeGreaterThanOrEqual(prevR - 1e-6);
          prevR = r;
        }
      }
    });

    it('warps the canvas corners to within the projection\'s bounding radius', () => {
      const width = 400, height = 300;
      const cx = width / 2, cy = height / 2;
      const R = Math.hypot(cx, cy) * 1.18; // matches the internal R = hypot(cx,cy)*1.18

      for (const strength of [0.1, 0.8, 1, 2]) {
        const { surface } = makeSurface({ width, height, fisheye: true, fisheyeStrength: strength });
        const out = [0, 0];
        for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) {
          surface._warpPoint(x, y, out);
          const r = Math.hypot(out[0] - cx, out[1] - cy);
          expect(r).toBeLessThanOrEqual(R + 1e-6);
        }
      }
    });
  });

  describe('curved beam paths (fisheye + starred bulb style)', () => {
    it('populates _beamPathFull/_beamGradRadius/_beamWidthScale with one entry per vertex when fisheye is on and the style has arms', () => {
      const { surface } = makeSurface({ fisheye: true, fisheyeStrength: 0.8, bulbStyle: 'star6' });

      expect(surface._beamPathFull).not.toBeNull();
      expect(surface._beamPathFull).toHaveLength(surface.vertexCount);
      for (const p of surface._beamPathFull) expect(p).toBeInstanceOf(Path2D);

      expect(surface._beamGradRadius).toHaveLength(surface.vertexCount);
      for (const r of surface._beamGradRadius) expect(r).toBeGreaterThanOrEqual(1);

      expect(surface._beamWidthScale).toHaveLength(surface.vertexCount);
      for (const w of surface._beamWidthScale) {
        // Float32Array storage rounds 0.35/2.2 to their nearest float32
        // representation (e.g. 0.3499999940...), so allow a tiny epsilon.
        expect(w).toBeGreaterThanOrEqual(0.35 - 1e-5);
        expect(w).toBeLessThanOrEqual(2.2 + 1e-5);
      }
    });

    it('is null when fisheye is off', () => {
      const { surface } = makeSurface({ fisheye: false, bulbStyle: 'star6' });
      expect(surface._beamPathFull).toBeNull();
      expect(surface._beamGradRadius).toBeNull();
      expect(surface._beamWidthScale).toBeNull();
    });

    it('is null when the bulb style has no arms (style "none"), even with fisheye on', () => {
      const { surface } = makeSurface({ fisheye: true, bulbStyle: 'none' });
      expect(surface._beamPathFull).toBeNull();
      expect(surface._beamGradRadius).toBeNull();
      expect(surface._beamWidthScale).toBeNull();
    });

    it('draw() with fisheye + curved beams does not throw across a few frames', () => {
      const { surface } = makeSurface({ fisheye: true, fisheyeStrength: 1.1, bulbStyle: 'star6', pattern: 'chase' });
      for (let i = 0; i < 5; i++) {
        surface.update(0.1);
        expect(() => surface.draw()).not.toThrow();
      }
    });
  });

  describe('buildFacets heightScales integration (via fisheye config, currently unused)', () => {
    it('EpcotSurface does not currently pass heightScales to buildFacets - spike heights are identical with fisheye on vs off', () => {
      // See geometry.test.js's "buildFacets heightScales" suite for the
      // pure-function behavior; this just confirms EpcotSurface's own
      // call site (rebuild()) doesn't wire it up yet, consistent with the
      // "pure display projection" design (fisheye never touches the
      // simulation, including spike heights) - flagged in the report as a
      // fully unused parameter from EpcotSurface's perspective.
      const canvasFlat = createMockCanvas(300, 220);
      const flat = new EpcotSurface(createMockContext(canvasFlat), canvasFlat, { size: 90, random: seededRandom(3), fisheye: false });
      const canvasFish = createMockCanvas(300, 220);
      const fish = new EpcotSurface(createMockContext(canvasFish), canvasFish, { size: 90, random: seededRandom(3), fisheye: true, fisheyeStrength: 1.5 });

      expect(Array.from(fish.centroids3D)).toEqual(Array.from(flat.centroids3D));
    });
  });
});
