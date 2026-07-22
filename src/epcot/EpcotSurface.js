/**
 * Epcot Spaceship Earth scene: a flattened tetrahedron-grid surface shaded
 * with real 3D lighting from four corner point lights that cycle in
 * intensity over time.
 *
 * Follows the repo's animation-object contract: constructor(ctx, canvas,
 * options) with options.random for deterministic RNG, update(deltaTime) in
 * seconds, draw().
 */
import { config } from '../config/config.js';
import { hslToRgb } from '../shared/colors.js';
import { buildTriangleGrid, buildFacets, inflatePoint } from './geometry.js';
import { cornerLightPositions, lightFalloff, computeLightColors, getPattern, shadeFacet } from './lighting.js';

export class EpcotSurface {
    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {Object} options - Optional configuration
     * @param {Function} options.random - Random number generator (default: Math.random)
     * @param {number} options.size - Triangle side length in pixels
     * @param {{h:number,s:number,l:number}} options.baseHSL - Base scene color
     * @param {string} options.pattern - 'chase' | 'pulse' | 'diagonal'
     * @param {number} options.speed - Multiplier applied to the light cycle rate
     * @param {number} options.cycleDuration - Full pattern cycle duration in seconds
     * @param {number} options.brightness - Multiplier applied on top of config.epcot.lighting.intensity (default 1.0)
     */
    constructor(ctx, canvas, options = {}) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.random = options.random || Math.random.bind(Math);

        const cfg = config.epcot;
        this.size = options.size ?? cfg.size.default;
        this.spikeHeightRatio = options.spikeHeightRatio ?? cfg.spikeHeightRatio;
        this.spikeVariation = options.spikeVariation ?? cfg.spikeVariation;
        this.shininess = options.shininess ?? cfg.lighting.shininess;
        this.ambient = options.ambient ?? cfg.lighting.ambient;
        this.cycleDuration = options.cycleDuration ?? cfg.cycleDuration;
        this.speed = options.speed ?? 1.0;
        this.brightness = options.brightness ?? 1.0;
        this.seamInflatePx = options.seamInflatePx ?? cfg.seamInflatePx;
        this.patternName = options.pattern ?? cfg.pattern.default;
        this.patternFn = getPattern(this.patternName);

        this.baseHSL = options.baseHSL ?? { h: 195, s: 55, l: 42 };
        const baseRGB = hslToRgb(this.baseHSL.h, this.baseHSL.s, this.baseHSL.l);
        this.baseR = baseRGB.r;
        this.baseG = baseRGB.g;
        this.baseB = baseRGB.b;

        // Flat per-light buffer: [x, y, z, r, g, b, intensity] * 4 lights.
        // Position/color are stable per canvas size; intensity is written
        // fresh every draw() call from the pattern function.
        this._lights = new Float32Array(4 * 7);
        const lightColors = computeLightColors(this.baseHSL, cfg.lighting.hueOffsets);
        for (let i = 0; i < 4; i++) {
            this._lights[i * 7 + 3] = lightColors[i].r;
            this._lights[i * 7 + 4] = lightColors[i].g;
            this._lights[i * 7 + 5] = lightColors[i].b;
        }

        this.clock = 0;
        this._colorScratch = new Float32Array(3);
        this._patternScratch = [0, 0, 0, 0];
        this._colorCache = new Map();

        this.rebuild();
    }

    /**
     * (Re)build the triangle grid, facets, and light corner positions for
     * the current canvas size. Call on init and whenever the canvas resizes.
     */
    rebuild() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cfg = config.epcot;

        const grid = buildTriangleGrid(width, height, this.size);
        const facets = buildFacets(
            grid.triangles,
            grid.triCount,
            this.size * this.spikeHeightRatio,
            this.spikeVariation,
            this.random
        );

        this.facetCount = facets.facetCount;
        this.normals = facets.normals;
        this.centroids3D = facets.centroids3D;
        this.positions2D = facets.positions2D;

        // Path2D objects are the only canvas-dependent piece of geometry;
        // built here (not in geometry.js) so the geometry math stays
        // testable without a canvas.
        //
        // Each triangle is expanded outward from its own 2D centroid by
        // `seamInflatePx` before building the path. This makes adjacent
        // facets overlap by a fraction of a pixel instead of exactly
        // abutting, which hides the hairline anti-aliasing gaps that
        // otherwise appear between fills - without the per-facet stroke()
        // pass this used to require (measured at ~31% of frame time).
        const inflate = this.seamInflatePx;
        const positions2D = this.positions2D;
        this.paths = new Array(this.facetCount);
        for (let f = 0; f < this.facetCount; f++) {
            const o = f * 6;
            const ax = positions2D[o], ay = positions2D[o + 1];
            const bx = positions2D[o + 2], by = positions2D[o + 3];
            const cx = positions2D[o + 4], cy = positions2D[o + 5];

            const cx0 = (ax + bx + cx) / 3;
            const cy0 = (ay + by + cy) / 3;

            const path = new Path2D();
            path.moveTo(...inflatePoint(ax, ay, cx0, cy0, inflate));
            path.lineTo(...inflatePoint(bx, by, cx0, cy0, inflate));
            path.lineTo(...inflatePoint(cx, cy, cx0, cy0, inflate));
            path.closePath();
            this.paths[f] = path;
        }

        const corners = cornerLightPositions(width, height, cfg.lighting.cornerMargin, cfg.lighting.zHeightRatio);
        for (let i = 0; i < 4; i++) {
            this._lights[i * 7] = corners[i].x;
            this._lights[i * 7 + 1] = corners[i].y;
            this._lights[i * 7 + 2] = corners[i].z;
        }
        this.falloff = lightFalloff(width, height, cfg.lighting.falloffRatio);

        // Quantized color strings are keyed only by RGB value, which is
        // stable across geometry rebuilds, but clearing keeps memory bounded
        // and avoids stale entries lingering across a long stream session.
        this._colorCache.clear();
    }

    /**
     * Advance the light-pattern clock.
     * @param {number} deltaTime - Time elapsed since last frame, in seconds
     */
    update(deltaTime) {
        this.clock += deltaTime * this.speed;
    }

    /**
     * Shade and fill every facet for the current frame.
     */
    draw() {
        const intensities = this.patternFn(this.clock, this.cycleDuration, this._patternScratch);
        const peak = config.epcot.lighting.intensity * this.brightness;
        const lights = this._lights;
        for (let i = 0; i < 4; i++) {
            lights[i * 7 + 6] = intensities[i] * peak;
        }

        const ctx = this.ctx;
        const normals = this.normals;
        const centroids = this.centroids3D;
        const paths = this.paths;
        const scratch = this._colorScratch;
        const cache = this._colorCache;
        const ambient = this.ambient;
        const shininess = this.shininess;
        const falloff = this.falloff;
        const baseR = this.baseR, baseG = this.baseG, baseB = this.baseB;
        const facetCount = this.facetCount;

        for (let f = 0; f < facetCount; f++) {
            const no = f * 3;
            shadeFacet(
                normals[no], normals[no + 1], normals[no + 2],
                centroids[no], centroids[no + 1], centroids[no + 2],
                lights, baseR, baseG, baseB, ambient, shininess, falloff, scratch
            );

            // Quantize to integer RGB and cache the built string - many
            // facets (especially ambient-only ones far from any lit corner)
            // land on the same quantized color across frames.
            const r = scratch[0] | 0;
            const g = scratch[1] | 0;
            const b = scratch[2] | 0;
            const key = (r << 16) | (g << 8) | b;

            let color = cache.get(key);
            if (color === undefined) {
                color = `rgb(${r},${g},${b})`;
                if (cache.size < 20000) cache.set(key, color);
            }

            ctx.fillStyle = color;
            ctx.fill(paths[f]);
        }
    }
}
