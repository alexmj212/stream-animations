/**
 * Epcot Spaceship Earth scene: a flattened triangular-lattice surface where
 * each triangle is raised into a tetrahedral spike and shaded as polished
 * metal by point-light "bulbs" sitting at every lattice vertex - like the
 * fixtures on the real ball. Every bulb is identical in configuration;
 * brightness differences come only from the light pattern's current value
 * at that bulb. Each lit bulb renders as a white-hot core in a colored glow
 * with side-firing beams (star effect), casts specular glints on the
 * adjacent facets, and its panels spill one-bounce indirect light onto
 * neighboring panels.
 *
 * Patterns (all position+time driven, every bulb runs the same formula):
 *   chase    - one bloom orbiting the screen perimeter clockwise
 *   orbit    - two opposite blooms orbiting together
 *   pulse    - center-weighted breathing
 *   diagonal - opposite corner pairs alternating
 *   wave     - diagonal band sweeping across
 *   cascade  - horizontal band falling top to bottom
 *   scanner  - vertical band ping-ponging left/right
 *   spiral   - rotating radar beam around the center
 *   radial   - concentric rings expanding from center
 *   auto     - cycles through all of the above with smooth crossfades
 *
 * Color schemes: classic (hue drift toward each corner), mono, duo
 * (complementary split), rainbow (hue wheel by angle), cycle (classic
 * distribution rotating through the wheel over time).
 *
 * Follows the repo's animation-object contract: constructor(ctx, canvas,
 * options) with options.random for deterministic RNG, update(deltaTime) in
 * seconds, draw(). Live-updatable via applySettings(partial).
 */
import { config } from '../config/config.js';
import { hslToRgb } from '../shared/colors.js';
import { buildTriangleGrid, buildLatticeVertices, buildFacets, buildTriangleAdjacency, inflatePoint } from './geometry.js';
import { computeCornerWeights, radialField, shadeFacet } from './lighting.js';

// Deterministic 2D integer hash for palette patchwork blocks
function hash2(x, y) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0);
}

function hexToRgbFloats(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

// RGB floats (0..1) -> HSL (deg, 0-100, 0-100), matching hslToRgb's units
function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: l * 100 };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return { h: h * 360, s: s * 100, l: l * 100 };
}

// Scale a color's saturation by `mult` (clamped to fully saturated)
function boostSaturation(c, mult) {
    if (mult === 1) return c;
    const hsl = rgbToHsl(c.r, c.g, c.b);
    return hslToRgb(hsl.h, Math.min(100, hsl.s * mult), hsl.l);
}

// Sample an evenly-spaced multi-stop gradient at t (0..1), writing rgb
// into vertexLights at `lo` and returning the nearest stop index (for
// sprite bucket selection). No allocation.
function sampleStops(stops, t, vertexLights, lo) {
    const n = stops.length;
    const x = Math.min(1, Math.max(0, t)) * (n - 1);
    let i = x | 0;
    if (i > n - 2) i = n - 2;
    const f = x - i;
    const a = stops[i], b = stops[i + 1];
    vertexLights[lo] = a.r + (b.r - a.r) * f;
    vertexLights[lo + 1] = a.g + (b.g - a.g) * f;
    vertexLights[lo + 2] = a.b + (b.b - a.b) * f;
    return Math.round(x);
}

// Patterns auto mode cycles through (everything except 'auto' itself)
const AUTO_PATTERNS = ['chase', 'split', 'orbit', 'bands', 'pulse', 'sweep', 'diagonal', 'wave', 'mix', 'cascade', 'scanner', 'spiral', 'radial'];

// Color patterns keep every bulb lit and animate WHICH of the scheme's
// two color groups each bulb shows; intensity patterns move light around.
const COLOR_PATTERNS = new Set(['split', 'sweep', 'bands', 'mix']);

// Every intensity pattern pairs with a color animation running on its
// OWN clock (rate = multiple of the pattern cycle; negative counter-
// rotates) - brightness and color both animate, independently, per the
// character of each animation.
const COMBO_COLOR = {
    chase: { c: 'sweep', rate: 0.5 },     // bloom orbits; color wheel rotates at half speed
    orbit: { c: 'sweep', rate: -0.35 },   // twin blooms orbit; colors counter-rotate slowly
    pulse: { c: 'mix', rate: 0.25 },      // breathing light over a slow color-balance drift
    diagonal: { c: 'split', rate: 0.5 },
    wave: { c: 'bands', rate: -0.7 },     // band travels one way, color bands scroll the other
    cascade: { c: 'split', rate: 0.4 },
    scanner: { c: 'bands', rate: 0.6 },
    spiral: { c: 'sweep', rate: 1.6 },    // color wheel spins faster than the beam
    radial: { c: 'mix', rate: 0.3 }
};

// Star effect definitions: arms, angular offset, and length/width scale
// relative to the configured beam length/width.
const STAR_STYLES = {
    star6: { arms: 6, offset: 0, lengthScale: 1.0, widthScale: 1.0 },
    star4: { arms: 4, offset: 0, lengthScale: 1.1, widthScale: 1.0 },
    burst: { arms: 12, offset: Math.PI / 12, lengthScale: 0.55, widthScale: 0.75 },
    rays: { arms: 6, offset: 0, lengthScale: 1.7, widthScale: 0.55 },
    none: { arms: 0, offset: 0, lengthScale: 1.0, widthScale: 1.0 }
};

const HUE_BUCKETS = 12; // pre-rendered sprite hues, every 30 degrees

// Raised-cosine band: 1 at the center, smoothly 0 at +/- halfWidth.
function band(p, center, halfWidth) {
    const d = Math.abs(p - center);
    return d < halfWidth ? Math.cos((d / halfWidth) * (Math.PI / 2)) ** 2 : 0;
}

export class EpcotSurface {
    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {Object} options - Optional configuration (see config.epcot for defaults)
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
        this.diffuseWeight = options.diffuseWeight ?? cfg.lighting.diffuseWeight;
        this.specularWeight = options.specularWeight ?? cfg.lighting.specularWeight;
        this.vertexHeightRatio = options.vertexHeightRatio ?? cfg.lighting.vertexHeightRatio;
        this.falloffSizeRatio = options.falloffSizeRatio ?? cfg.lighting.falloffSizeRatio;
        this.cornerWeightFalloffRatio = options.cornerWeightFalloffRatio ?? cfg.lighting.cornerWeightFalloffRatio;
        this.vertexEpsilon = options.vertexEpsilon ?? cfg.vertexEpsilon;
        this.cycleDuration = options.cycleDuration ?? cfg.cycleDuration;
        this.speed = options.speed ?? 1.0;
        this.brightness = options.brightness ?? 1.0;
        this.seamInflatePx = options.seamInflatePx ?? cfg.seamInflatePx;
        this.patternName = options.pattern ?? cfg.pattern.default;
        this.scheme = options.scheme ?? cfg.scheme.default;
        this.autoSegmentDuration = options.autoSegmentDuration ?? cfg.pattern.autoSegmentDuration;
        this.autoFadeDuration = options.autoFadeDuration ?? cfg.pattern.autoFadeDuration;

        this.bounceEnabled = options.bounceEnabled ?? cfg.bounce.enabled;
        this.bounceStrength = options.bounceStrength ?? cfg.bounce.strength;

        this.gapEnabled = options.gapEnabled ?? cfg.gap.enabled;
        this.gapWidth = options.gapWidth ?? cfg.gap.width;
        this.gapInternalWidthRatio = options.gapInternalWidthRatio ?? cfg.gap.internalWidthRatio;
        this.gapLightnessRatio = options.gapLightnessRatio ?? cfg.gap.lightnessRatio;

        this.showBulbs = options.showVertexDots ?? cfg.bulbs.enabled;
        this.bulbStyle = options.bulbStyle ?? cfg.bulbs.style;
        this.coreStyle = options.coreStyle ?? cfg.bulbs.coreStyle;
        this.overlayPattern = options.overlayPattern ?? cfg.bulbs.overlay;
        this.shadowsEnabled = options.shadowsEnabled ?? cfg.shadows.enabled;
        this.bulbGlowRadiusRatio = options.bulbGlowRadiusRatio ?? cfg.bulbs.glowRadiusRatio;
        this.bulbCoreRadiusRatio = options.bulbCoreRadiusRatio ?? cfg.bulbs.coreRadiusRatio;
        this.beamLengthRatio = options.beamLengthRatio ?? cfg.bulbs.beamLengthRatio;
        this.beamWidthPx = options.beamWidthPx ?? cfg.bulbs.beamWidthPx;
        this.beamAlpha = options.beamAlpha ?? cfg.bulbs.beamAlpha;
        this.bulbThreshold = options.bulbThreshold ?? cfg.bulbs.intensityThreshold;
        this.bulbFloor = options.bulbFloor ?? cfg.bulbs.floor;

        this.meteorInterval = options.meteorInterval ?? cfg.bulbs.meteorInterval;
        this.meteorSpeed = options.meteorSpeed ?? cfg.bulbs.meteorSpeed;
        this.meteorTail = options.meteorTail ?? cfg.bulbs.meteorTail;
        this.meteorLife = options.meteorLife ?? cfg.bulbs.meteorLife;
        this.meteorTracks = options.meteorTracks ?? cfg.bulbs.meteorTracks;
        this.meteorDirection = options.meteorDirection ?? cfg.bulbs.meteorDirection;
        this.overlaySurfaceLight = options.overlaySurfaceLight ?? cfg.bulbs.overlaySurfaceLight;
        this.overlayLocalLift = options.overlayLocalLift ?? cfg.bulbs.overlayLocalLift;

        this.fisheye = options.fisheye ?? cfg.fisheye.enabled;
        this.fisheyeStrength = options.fisheyeStrength ?? cfg.fisheye.strength;

        this.baseHSL = options.baseHSL ?? { h: 195, s: 55, l: 42 };
        this.saturation = options.saturation ?? cfg.color.saturationBoost;
        this.colorBlend = options.colorBlend ?? cfg.colorBlend;

        this.clock = 0;
        this._colorScratch = new Float32Array(3);
        this._colorCache = new Map();

        // Reused offscreen canvases: the static panel-gap layer, and the
        // baked floor-light layer (facet illumination + bounce from every
        // bulb idling at the visibility floor - constant, so it's rendered
        // once per rebuild and composited with one drawImage per frame).
        this._gapCanvas = document.createElement('canvas');
        this._floorCanvas = document.createElement('canvas');
        this._idleBulbCanvas = document.createElement('canvas');
        this._idleBulbValid = false;
        this._floorSurfaceIntensity = 0;

        // Set whenever settings/geometry change; the host loop can skip
        // redrawing static scenes (steady pattern, no overlay) until the
        // next change.
        this.frameDirty = true;

        this._recomputeBaseColors();
        this.rebuild();
    }

    /**
     * Recompute everything derived from the base color: base RGB floats,
     * the gap-line color, and the flat ambient background color.
     * @private
     */
    _recomputeBaseColors() {
        const baseRGB = hslToRgb(this.baseHSL.h, this.baseHSL.s, this.baseHSL.l);
        this.baseR = baseRGB.r;
        this.baseG = baseRGB.g;
        this.baseB = baseRGB.b;

        const gapLightness = this.baseHSL.l * this.gapLightnessRatio;
        const gapRGB = hslToRgb(this.baseHSL.h, this.baseHSL.s, gapLightness);
        this.gapColor = `rgb(${Math.round(gapRGB.r * 255)},${Math.round(gapRGB.g * 255)},${Math.round(gapRGB.b * 255)})`;

        const ar = Math.min(255, this.ambient * this.baseR * 255) | 0;
        const ag = Math.min(255, this.ambient * this.baseG * 255) | 0;
        const ab = Math.min(255, this.ambient * this.baseB * 255) | 0;
        this._ambientColor = `rgb(${ar},${ag},${ab})`;
    }

    /**
     * Apply a partial settings object live (from the control panel). Cheap
     * fields are assigned directly; anything that alters geometry, colors,
     * or sprites triggers a rebuild.
     * @param {Object} s - Partial settings: any of pattern, scheme, colorHSL,
     *   speed, brightness, size, gapWidth, bulbStyle, showBulbs, bounceStrength,
     *   beamLengthRatio, glowRadiusRatio, specularWeight
     */
    applySettings(s) {
        let needsRebuild = false;

        if (s.pattern !== undefined) this.patternName = s.pattern;
        if (s.colorBlend !== undefined) this.colorBlend = s.colorBlend;
        if (s.coreStyle !== undefined) this.coreStyle = s.coreStyle;
        if (s.overlayPattern !== undefined) this.overlayPattern = s.overlayPattern;
        if (s.meteorInterval !== undefined) this.meteorInterval = s.meteorInterval;
        if (s.meteorSpeed !== undefined) this.meteorSpeed = s.meteorSpeed;
        if (s.meteorTail !== undefined) this.meteorTail = s.meteorTail;
        if (s.meteorLife !== undefined) this.meteorLife = s.meteorLife;
        if (s.meteorTracks !== undefined) this.meteorTracks = s.meteorTracks;
        if (s.meteorDirection !== undefined) this.meteorDirection = s.meteorDirection;
        if (s.overlaySurfaceLight !== undefined) this.overlaySurfaceLight = s.overlaySurfaceLight;
        if (s.overlayLocalLift !== undefined) this.overlayLocalLift = s.overlayLocalLift;
        if (s.shadowsEnabled !== undefined && s.shadowsEnabled !== this.shadowsEnabled) { this.shadowsEnabled = s.shadowsEnabled; needsRebuild = true; }
        if (s.speed !== undefined) this.speed = s.speed;
        if (s.brightness !== undefined) this.brightness = s.brightness;
        if (s.bounceStrength !== undefined) { this.bounceStrength = s.bounceStrength; this.bounceEnabled = s.bounceStrength > 0; }
        if (s.specularWeight !== undefined) this.specularWeight = s.specularWeight;
        if (s.showBulbs !== undefined) this.showBulbs = s.showBulbs;
        if (s.bulbFloor !== undefined && s.bulbFloor !== this.bulbFloor) {
            this.bulbFloor = s.bulbFloor;
            this._rebuildFloorLayer();
        }
        if (s.brightness !== undefined || s.specularWeight !== undefined || s.bounceStrength !== undefined) {
            // Floor-layer bake depends on these; re-bake without a full rebuild
            this._rebuildFloorLayer();
        }

        if (s.scheme !== undefined && s.scheme !== this.scheme) { this.scheme = s.scheme; needsRebuild = true; }
        if (s.saturation !== undefined && s.saturation !== this.saturation) { this.saturation = s.saturation; needsRebuild = true; }
        if (s.colorHSL !== undefined) { this.baseHSL = s.colorHSL; this._recomputeBaseColors(); needsRebuild = true; }
        if (s.size !== undefined && s.size !== this.size) { this.size = s.size; needsRebuild = true; }
        if (s.gapWidth !== undefined && s.gapWidth !== this.gapWidth) { this.gapWidth = s.gapWidth; this.gapEnabled = s.gapWidth > 0; needsRebuild = true; }
        if (s.bulbStyle !== undefined && s.bulbStyle !== this.bulbStyle) { this.bulbStyle = s.bulbStyle; needsRebuild = true; }
        if (s.beamLengthRatio !== undefined && s.beamLengthRatio !== this.beamLengthRatio) { this.beamLengthRatio = s.beamLengthRatio; needsRebuild = true; }
        if (s.fisheye !== undefined && s.fisheye !== this.fisheye) { this.fisheye = s.fisheye; needsRebuild = true; }
        if (s.fisheyeStrength !== undefined && s.fisheyeStrength !== this.fisheyeStrength) { this.fisheyeStrength = s.fisheyeStrength; needsRebuild = true; }
        if (s.glowRadiusRatio !== undefined && s.glowRadiusRatio !== this.bulbGlowRadiusRatio) { this.bulbGlowRadiusRatio = s.glowRadiusRatio; needsRebuild = true; }

        if (needsRebuild) this.rebuild();
        this.frameDirty = true;
    }

    /**
     * True when the current configuration renders an identical frame every
     * time (steady pattern, no overlay, no time-varying scheme) - the host
     * loop can render once and stop until settings change.
     */
    isStatic() {
        return this.patternName === 'steady'
            && (!this.overlayPattern || this.overlayPattern === 'none')
            && this.scheme !== 'cycle';
    }

    /**
     * (Re)build the triangle grid, facets, vertex lights, bulb sprites, and
     * gap-line layer for the current canvas size. Call on init and whenever
     * the canvas resizes.
     */
    rebuild() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        const grid = buildTriangleGrid(width, height, this.size);
        const lattice = buildLatticeVertices(grid.triangles, grid.triCount, this.vertexEpsilon);

        // Fisheye: a PURE DISPLAY PROJECTION. All lighting, shading,
        // shadows, and pattern math run on the original flat lattice -
        // identical to the non-fisheye look - and only the DRAWING
        // coordinates (facet paths, seams, bulb positions, beam paths)
        // are warped. Warping the simulation itself makes every triangle
        // scalene: facet normals, spike slopes, and light distances go
        // irregular, producing bright sliver facets and broken specular
        // chains that read as phantom extra beams.
        this._warpPoint = null;
        this._originalPositions = null;
        let drawTriangles = grid.triangles;
        this._vertexDrawPos = lattice.positions;
        if (this.fisheye) {
            const cx = width / 2, cy = height / 2;
            const R = Math.hypot(cx, cy) * 1.18; // margin triangles stay inside r=1
            const s = this.fisheyeStrength;
            const warp = (x, y, out) => {
                const dx = x - cx, dy = y - cy;
                const dist = Math.hypot(dx, dy);
                if (dist < 1e-6) { out[0] = x; out[1] = y; return; }
                const r = Math.min(1, dist / R);
                // s <= 1: blend flat -> spherical projection.
                // s > 1: raise the projection to 1/s - a steeper bulge
                // (center magnified harder, edges crushed further) that
                // stays monotonic, for the beyond-spherical look.
                const sphere = Math.sin(r * Math.PI / 2);
                const rw = s <= 1
                    ? (1 - s) * r + s * sphere
                    : Math.pow(sphere, 1 / s);
                const f = (rw * R) / dist;
                out[0] = cx + dx * f;
                out[1] = cy + dy * f;
            };
            this._warpPoint = warp;
            // Originals feed the simulation and the beam-path tracer; the
            // warped copies are used ONLY for drawing.
            this._originalPositions = lattice.positions;

            const w2 = [0, 0];
            drawTriangles = Float32Array.from(grid.triangles);
            for (let i = 0; i < drawTriangles.length; i += 2) {
                warp(drawTriangles[i], drawTriangles[i + 1], w2);
                drawTriangles[i] = w2[0];
                drawTriangles[i + 1] = w2[1];
            }
            const drawPos = Float32Array.from(lattice.positions);
            for (let i = 0; i < drawPos.length; i += 2) {
                warp(drawPos[i], drawPos[i + 1], w2);
                drawPos[i] = w2[0];
                drawPos[i + 1] = w2[1];
            }
            this._vertexDrawPos = drawPos;
        }

        const facets = buildFacets(
            grid.triangles,
            grid.triCount,
            this.size * this.spikeHeightRatio,
            this.spikeVariation,
            this.random
        );

        this.triCount = grid.triCount;
        this.facetCount = facets.facetCount;
        this.normals = facets.normals;
        this.centroids3D = facets.centroids3D;
        this.positions2D = facets.positions2D;
        this.triNeighbors = buildTriangleAdjacency(lattice.triVertexIndex, grid.triCount);

        // Light gathering: for each triangle, precompute the list of bulbs
        // within `lightReachRatio` triangle-sizes of its centroid (via a
        // spatial hash). Every facet of the triangle is shaded by ALL of
        // those bulbs - so a bright bulb throws glints across facets
        // several rows away, not just its own triangle's corners.
        {
            const reach = (config.epcot.lightReachRatio ?? 2.2) * this.size;
            const reachSq = reach * reach;
            const buckets = new Map();
            const bkey = (bx, by) => bx * 100000 + by;
            for (let v = 0; v < lattice.count; v++) {
                const bx = Math.floor(lattice.positions[v * 2] / reach);
                const by = Math.floor(lattice.positions[v * 2 + 1] / reach);
                const key = bkey(bx, by);
                let list = buckets.get(key);
                if (list === undefined) { list = []; buckets.set(key, list); }
                list.push(v);
            }

            const idxList = [];
            this._triLightStart = new Int32Array(grid.triCount);
            this._triLightCount = new Int32Array(grid.triCount);
            for (let t = 0; t < grid.triCount; t++) {
                const o = t * 6;
                const cx = (grid.triangles[o] + grid.triangles[o + 2] + grid.triangles[o + 4]) / 3;
                const cy = (grid.triangles[o + 1] + grid.triangles[o + 3] + grid.triangles[o + 5]) / 3;
                const bx = Math.floor(cx / reach);
                const by = Math.floor(cy / reach);
                this._triLightStart[t] = idxList.length;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        const list = buckets.get(bkey(bx + dx, by + dy));
                        if (!list) continue;
                        for (const v of list) {
                            const vx = lattice.positions[v * 2] - cx;
                            const vy = lattice.positions[v * 2 + 1] - cy;
                            if (vx * vx + vy * vy <= reachSq) idxList.push(v);
                        }
                    }
                }
                this._triLightCount[t] = idxList.length - this._triLightStart[t];
            }
            this._triLightIdx = Int32Array.from(idxList);
        }

        // Cast shadows: precompute a static occlusion factor per
        // (triangle, gathered bulb) pair. The bulbs sit low (below the
        // spike apexes), so a spike standing between a bulb and a panel
        // blocks its grazing light. We march along the 2D segment from
        // panel centroid to bulb, and every intervening spike whose apex
        // rises above the ray's height multiplies the light down. Spike
        // rows leave corridors along the lattice axes, so light spills in
        // natural star-shaped alleys, and facets tucked behind spikes fall
        // into real directional shadow.
        {
            const shadowCfg = config.epcot.shadows;
            this._triLightShadow = new Float32Array(this._triLightIdx.length).fill(1);

            if (this.shadowsEnabled) {
                const size = this.size;
                // Triangle centroid spatial hash (cell = one triangle size)
                const cellSize = size;
                const triBuckets = new Map();
                const tkey = (bx, by) => bx * 100000 + by;
                const triCX = new Float32Array(grid.triCount);
                const triCY = new Float32Array(grid.triCount);
                const triApexZ = new Float32Array(grid.triCount);
                for (let t = 0; t < grid.triCount; t++) {
                    const o = t * 6;
                    triCX[t] = (grid.triangles[o] + grid.triangles[o + 2] + grid.triangles[o + 4]) / 3;
                    triCY[t] = (grid.triangles[o + 1] + grid.triangles[o + 3] + grid.triangles[o + 5]) / 3;
                    // centroids3D z of any facet is apexZ/3 (base verts at z=0)
                    triApexZ[t] = facets.centroids3D[t * 9 + 2] * 3;
                    const key = tkey(Math.floor(triCX[t] / cellSize), Math.floor(triCY[t] / cellSize));
                    let list = triBuckets.get(key);
                    if (list === undefined) { list = []; triBuckets.set(key, list); }
                    list.push(t);
                }

                const vertexZShadow = this.size * this.spikeHeightRatio * this.vertexHeightRatio;
                const blockRadius = 0.5 * size;
                const blockRadiusSq = blockRadius * blockRadius;
                const step = 0.7 * size;

                for (let t = 0; t < grid.triCount; t++) {
                    const start = this._triLightStart[t];
                    const count = this._triLightCount[t];
                    const px = triCX[t], py = triCY[t];
                    const pz = triApexZ[t] / 3; // facet mid-height
                    for (let k = 0; k < count; k++) {
                        const li = this._triLightIdx[start + k];
                        const lx = lattice.positions[li * 2];
                        const ly = lattice.positions[li * 2 + 1];
                        const dx = lx - px, dy = ly - py;
                        const dist = Math.hypot(dx, dy);
                        if (dist < 1.15 * size) continue; // own/adjacent bulbs are never occluded

                        let factor = 1;
                        // March from 20% to 85% of the way toward the bulb
                        for (let sPos = Math.max(step * 0.5, dist * 0.2); sPos < dist * 0.85; sPos += step) {
                            const qx = px + (dx / dist) * sPos;
                            const qy = py + (dy / dist) * sPos;
                            const rayZ = pz + (vertexZShadow - pz) * (sPos / dist);
                            const bx = Math.floor(qx / cellSize);
                            const by = Math.floor(qy / cellSize);
                            let blocked = false;
                            for (let ddx = -1; ddx <= 1 && !blocked; ddx++) {
                                for (let ddy = -1; ddy <= 1 && !blocked; ddy++) {
                                    const list = triBuckets.get(tkey(bx + ddx, by + ddy));
                                    if (!list) continue;
                                    for (const b of list) {
                                        if (b === t) continue;
                                        const ex = triCX[b] - qx, ey = triCY[b] - qy;
                                        if (ex * ex + ey * ey > blockRadiusSq) continue;
                                        if (triApexZ[b] * 0.85 > rayZ) { blocked = true; break; }
                                    }
                                }
                            }
                            if (blocked) {
                                factor *= shadowCfg.occluderFactor;
                                if (factor <= shadowCfg.floor) { factor = shadowCfg.floor; break; }
                            }
                        }
                        this._triLightShadow[start + k] = factor;
                    }
                }
            }
        }

        this.vertexCount = lattice.count;
        this.vertexPositions = lattice.positions; // flat [x,y,...]
        this._triVertexIndex = lattice.triVertexIndex; // each triangle's own 3 vertices

        // Static per-vertex light data: position (x,y,z) is fixed per
        // rebuild; rgb (3..5) is set by the color scheme below (per-frame
        // only for the 'cycle' scheme); intensity (6) is recomputed every
        // frame from the pattern.
        const nominalSpikeHeight = this.size * this.spikeHeightRatio;
        const vertexZ = nominalSpikeHeight * this.vertexHeightRatio;
        this._vertexLights = new Float32Array(this.vertexCount * 7);
        for (let v = 0; v < this.vertexCount; v++) {
            const o = v * 7;
            this._vertexLights[o] = this.vertexPositions[v * 2];
            this._vertexLights[o + 1] = this.vertexPositions[v * 2 + 1];
            this._vertexLights[o + 2] = vertexZ;
        }

        // Static per-vertex spatial coordinates used by patterns and color
        // schemes: [proj, distN, xn, yn, angleN] per vertex.
        //   proj   - normalized diagonal projection (wave)
        //   distN  - normalized distance from canvas center (pulse/radial)
        //   xn/yn  - normalized x/y (scanner/cascade)
        //   angleN - angle around canvas center, normalized to 0..1 (spiral/rainbow)
        this._vertexCoord = new Float32Array(this.vertexCount * 5);
        const cx = width / 2, cy = height / 2;
        const maxDist = Math.hypot(cx, cy) || 1;
        const projDenom = width + height || 1;
        for (let v = 0; v < this.vertexCount; v++) {
            const x = this.vertexPositions[v * 2];
            const y = this.vertexPositions[v * 2 + 1];
            const o = v * 5;
            this._vertexCoord[o] = (x + y) / projDenom;
            this._vertexCoord[o + 1] = Math.hypot(x - cx, y - cy) / maxDist;
            this._vertexCoord[o + 2] = x / (width || 1);
            this._vertexCoord[o + 3] = y / (height || 1);
            this._vertexCoord[o + 4] = (Math.atan2(y - cy, x - cx) / (2 * Math.PI) + 1) % 1;
        }

        // Normalized corner weights (for the classic/cycle hue drift) and
        // raw corner Gaussians (for the diagonal pattern's intensity).
        this._vertexWeights = new Float32Array(this.vertexCount * 4);
        this._vertexCornerGauss = new Float32Array(this.vertexCount * 4);
        const diag = Math.hypot(width, height) || 1;
        const sigma = Math.max(diag * this.cornerWeightFalloffRatio, 1e-3);
        const twoSigmaSq = 2 * sigma * sigma;
        this._anchorTwoSigmaSq = twoSigmaSq;
        const cornerX = [0, width, width, 0];
        const cornerY = [0, 0, height, height];
        const weightScratch = [0, 0, 0, 0];
        for (let v = 0; v < this.vertexCount; v++) {
            const x = this.vertexPositions[v * 2];
            const y = this.vertexPositions[v * 2 + 1];
            computeCornerWeights(x, y, width, height, this.cornerWeightFalloffRatio, weightScratch);
            const o = v * 4;
            for (let i = 0; i < 4; i++) {
                this._vertexWeights[o + i] = weightScratch[i];
                const dx = x - cornerX[i];
                const dy = y - cornerY[i];
                this._vertexCornerGauss[o + i] = Math.exp(-(dx * dx + dy * dy) / twoSigmaSq);
            }
        }

        this.falloff = this.falloffSizeRatio * this.size;

        // Color scheme: static per-vertex hue -> rgb + sprite hue bucket.
        // The 'cycle' scheme re-derives rgb/bucket per frame from these
        // base hues; every other scheme uses them as-is. _vertexBaseColor
        // keeps the pristine scheme color so per-frame overlay blending
        // (white light mixed in) can be undone next frame.
        this._vertexHue = new Float32Array(this.vertexCount);
        this._vertexBucket = new Uint8Array(this.vertexCount);
        this._vertexBaseColor = new Float32Array(this.vertexCount * 3);
        this._lightColorsDirty = false;

        // Static per-vertex hashes for the color patterns: a uniform
        // random (group assignment/dithered boundaries in mix/split) and a
        // variant index (which color within a group this bulb prefers).
        this._vertexRand = new Float32Array(this.vertexCount);
        this._vertexVariant = new Uint8Array(this.vertexCount);
        for (let v = 0; v < this.vertexCount; v++) {
            this._vertexRand[v] = (hash2(v, 0xc2b2ae) % 10000) / 10000;
            this._vertexVariant[v] = hash2(v, 0x6c62272e) % 251;
        }

        this._applyScheme();
        this._vertexBaseBucket = Uint8Array.from(this._vertexBucket);

        // Inverse lattice mapping: which triangles touch each vertex
        // (~6 for interior vertices). Used by the overlay's local surface
        // lift - the shimmer applied directly to a star's own triangles.
        {
            const tvi = lattice.triVertexIndex;
            const counts = new Int32Array(this.vertexCount);
            for (let i = 0; i < tvi.length; i++) counts[tvi[i]]++;
            this._vertexTriStart = new Int32Array(this.vertexCount);
            for (let v = 1; v < this.vertexCount; v++) {
                this._vertexTriStart[v] = this._vertexTriStart[v - 1] + counts[v - 1];
            }
            this._vertexTriIdx = new Int32Array(tvi.length);
            const cursor = Int32Array.from(this._vertexTriStart);
            for (let t = 0; t < grid.triCount; t++) {
                for (let c = 0; c < 3; c++) {
                    this._vertexTriIdx[cursor[tvi[t * 3 + c]]++] = t;
                }
            }
            this._vertexTriCount = counts;
        }

        // Per-frame buffers: field intensities (A/B for auto-crossfade, C
        // for the star overlay), direct facet colors, per-triangle
        // sums/bounce, active flags.
        this._fieldA = new Float32Array(this.vertexCount);
        this._fieldB = new Float32Array(this.vertexCount);
        this._fieldC = new Float32Array(this.vertexCount);

        // Per-bulb twinkle timing: deterministic phase + period jitter so
        // every bulb flares on its own schedule (individually addressable,
        // no two in lockstep) while remaining fully reproducible.
        this._twinklePhase = new Float32Array(this.vertexCount);
        this._twinklePeriod = new Float32Array(this.vertexCount);
        {
            const basePeriod = config.epcot.bulbs.twinklePeriod ?? 9;
            for (let v = 0; v < this.vertexCount; v++) {
                this._twinklePhase[v] = (hash2(v, 0x9e3779) % 10000) / 10000;
                this._twinklePeriod[v] = basePeriod * (0.65 + 0.7 * ((hash2(v, 0x85ebca) % 10000) / 10000));
            }
        }
        this._directColors = new Float32Array(this.facetCount * 3);
        this._triSums = new Float32Array(this.triCount * 3);
        this._triBounce = new Float32Array(this.triCount * 3);
        this._triActive = new Uint8Array(this.triCount);

        // Path2D objects are the only canvas-dependent piece of geometry;
        // built here (not in geometry.js) so the geometry math stays
        // testable without a canvas. Each facet is inflated outward from
        // its own 2D centroid so adjacent facets overlap by a fraction of a
        // pixel - hides hairline anti-aliasing seams without a per-facet
        // stroke() pass (measured at ~31% of frame time).
        const inflate = this.seamInflatePx;
        const positions2D = this.positions2D;
        const warpFn = this._warpPoint;
        const wp = [0, 0];
        this.paths = new Array(this.facetCount);
        for (let f = 0; f < this.facetCount; f++) {
            const o = f * 6;
            let ax = positions2D[o], ay = positions2D[o + 1];
            let bx = positions2D[o + 2], by = positions2D[o + 3];
            let cxx = positions2D[o + 4], cyy = positions2D[o + 5];

            // Fisheye: warp only the drawn outline; the shading math keeps
            // the original coordinates.
            if (warpFn) {
                warpFn(ax, ay, wp); ax = wp[0]; ay = wp[1];
                warpFn(bx, by, wp); bx = wp[0]; by = wp[1];
                warpFn(cxx, cyy, wp); cxx = wp[0]; cyy = wp[1];
            }

            const cx0 = (ax + bx + cxx) / 3;
            const cy0 = (ay + by + cyy) / 3;

            const path = new Path2D();
            path.moveTo(...inflatePoint(ax, ay, cx0, cy0, inflate));
            path.lineTo(...inflatePoint(bx, by, cx0, cy0, inflate));
            path.lineTo(...inflatePoint(cxx, cyy, cx0, cy0, inflate));
            path.closePath();
            this.paths[f] = path;
        }

        this._colorCache.clear();

        this._rebuildGapLayer({ triangles: drawTriangles, triCount: grid.triCount }, width, height);
        this._rebuildBulbSprites();
        this._buildCurvedBeamPaths();
        this._rebuildFloorLayer();
        this._rebuildIdleBulbLayer();
        this.frameDirty = true;
    }

    /**
     * Bake the IDLE bulb layer: every bulb's floor-level point and radial
     * beams are constant, so they render once here and composite as a
     * single additive drawImage per frame. The per-frame bulb pass then
     * draws only the DELTA above the floor for driven bulbs - exact under
     * the additive blend (same sprites/paints, alpha = target - idle) -
     * and skips undriven bulbs entirely.
     * @private
     */
    _rebuildIdleBulbLayer() {
        const canvas = this._idleBulbCanvas;
        canvas.width = this.canvas.width;
        canvas.height = this.canvas.height;
        this._idleBulbValid = false;
        this._idleBeamAlpha = 0;
        if (!this.showBulbs || this.bulbFloor <= 0) return;

        const ictx = canvas.getContext('2d');
        ictx.clearRect(0, 0, canvas.width, canvas.height);
        ictx.globalCompositeOperation = 'lighter';

        const pointA = this.bulbFloor;
        const beamA = Math.sqrt(this.bulbFloor * 0.45) * this.beamAlpha;
        this._idleBeamAlpha = beamA;
        const hasBeams = this._starArms > 0;
        const curved = this.fisheye && this._beamPathFull !== null;
        const drawPos = this._vertexDrawPos;
        const buckets = this._vertexBucket;
        const pointR = this._pointRadius;
        const beamL = this._beamLength;
        const beamBaseW = this.beamWidthPx * this._starWidthScale;

        if (curved) ictx.lineCap = 'round';
        for (let v = 0; v < this.vertexCount; v++) {
            const x = drawPos[v * 2];
            const y = drawPos[v * 2 + 1];
            const c = buckets[v];

            ictx.globalAlpha = pointA;
            ictx.drawImage(this._pointSprites[c], (x - pointR - 1) | 0, (y - pointR - 1) | 0);

            if (hasBeams && beamA >= 0.03) {
                ictx.globalAlpha = beamA;
                if (curved) {
                    const stops = this._strokeGradStops[c];
                    const g = ictx.createRadialGradient(x, y, 0, x, y, this._beamGradRadius[v]);
                    g.addColorStop(0, stops[0]);
                    g.addColorStop(0.35, stops[1]);
                    g.addColorStop(1, stops[2]);
                    ictx.strokeStyle = g;
                    ictx.lineWidth = beamBaseW * this._beamWidthScale[v];
                    ictx.stroke(this._beamPathFull[v]);
                } else {
                    ictx.drawImage(this._beamSprites[c], (x - beamL - 1) | 0, (y - beamL - 1) | 0);
                }
            }
        }
        this._idleBulbValid = true;
    }

    /**
     * Fisheye beam paths: under the warp, lattice rows curve - so beam
     * arms can't be straight sprites. Each arm is traced in the ORIGINAL
     * (pre-warp) space along its axis, sampled, and passed point-by-point
     * through the warp, producing arms that bend exactly with the rows
     * they run along. Split into three non-overlapping taper segments per
     * bulb so the per-frame strokes approximate the sprite gradient's
     * fade in both alpha and width.
     * @private
     */
    _buildCurvedBeamPaths() {
        this._beamPathFull = null;
        this._beamGradRadius = null;
        this._beamWidthScale = null;
        if (!this.fisheye || !this._warpPoint || this._starArms === 0) return;

        const warp = this._warpPoint;
        const orig = this._originalPositions;
        const arms = this._starArms;
        const offset = this._starOffset;
        const L = this._beamLength;
        const w2 = [0, 0];

        // The lattice EDGES render as straight chords between warped
        // vertices, so an arm must follow the polyline of chords through
        // successive lattice steps (bulb -> neighbor -> next...), with
        // partial lengths stopping PART-WAY ALONG a chord - never a
        // direct line to the warped endpoint, which cuts corners across
        // curved rows whenever the beam length isn't exactly one step.
        const step = this.size;
        const wA = [0, 0], wB = [0, 0];
        // Point at original-space distance t along the arm, ON the chord
        // polyline (lerp between the bracketing warped lattice points).
        const chordPoint = (ox, oy, ax, ay, t, out) => {
            const i = Math.floor(t / step);
            const f = t / step - i;
            warp(ox + ax * step * i, oy + ay * step * i, wA);
            if (f < 1e-6) { out[0] = wA[0]; out[1] = wA[1]; return; }
            warp(ox + ax * step * (i + 1), oy + ay * step * (i + 1), wB);
            out[0] = wA[0] + (wB[0] - wA[0]) * f;
            out[1] = wA[1] + (wB[1] - wA[1]) * f;
        };
        const traceArm = (path, ox, oy, ax, ay, t0, t1) => {
            chordPoint(ox, oy, ax, ay, t0, w2);
            path.moveTo(w2[0], w2[1]);
            // interior lattice points between t0 and t1
            for (let m = Math.floor(t0 / step) + 1; m * step < t1; m++) {
                warp(ox + ax * step * m, oy + ay * step * m, wA);
                path.lineTo(wA[0], wA[1]);
            }
            chordPoint(ox, oy, ax, ay, t1, w2);
            path.lineTo(w2[0], w2[1]);
        };

        // ONE path per bulb containing all its arms, stroked once per
        // frame with a radial gradient centered on the bulb - a true
        // continuous light falloff. (Any segmented-stroke approximation
        // kinks at joints, gaps at caps, and steps in width - along
        // shared rows the interleaved segments of opposing arms read as
        // broken double lines.)
        // Local warp magnification per bulb: scales beam width so rays
        // thicken with the magnified center triangles and thin toward the
        // compressed rim, instead of one constant width everywhere.
        const widthScale = new Float32Array(this.vertexCount);
        const fullPaths = new Array(this.vertexCount);
        const gradRadius = new Float32Array(this.vertexCount);
        for (let v = 0; v < this.vertexCount; v++) {
            const ox = orig[v * 2], oy = orig[v * 2 + 1];
            const path = new Path2D();
            let chordSum = 0;
            let maxR = 1;
            warp(ox, oy, wA);
            const sx = wA[0], sy = wA[1];
            for (let a = 0; a < arms; a++) {
                const ang = offset + (a * 2 * Math.PI) / arms;
                const ax = Math.cos(ang), ay = Math.sin(ang);
                traceArm(path, ox, oy, ax, ay, 0, L);
                warp(ox + ax * step, oy + ay * step, wB);
                chordSum += Math.hypot(wB[0] - wA[0], wB[1] - wA[1]);
                warp(ox + ax * L, oy + ay * L, wB);
                const armR = Math.hypot(wB[0] - sx, wB[1] - sy);
                if (armR > maxR) maxR = armR;
            }
            widthScale[v] = Math.max(0.35, Math.min(2.2, chordSum / (arms * step)));
            fullPaths[v] = path;
            gradRadius[v] = maxR;
        }
        this._beamPathFull = fullPaths;
        this._beamGradRadius = gradRadius;
        this._beamWidthScale = widthScale;
        // Per-bulb gradient caches: position/radius are static per
        // rebuild, only the color bucket varies - so each (vertex, bucket)
        // gradient is created once, not per frame (the visibility floor
        // makes essentially every bulb stroke every frame).
        this._beamGradCache = new Array(this.vertexCount);
        this._beamGradWhite = new Array(this.vertexCount);
    }

    /**
     * Bake the floor light's surface effect: every bulb idling at the
     * visibility floor shades its facets (radial light) and spills bounce,
     * exactly like live light but constant - so it renders once here and
     * composites as the background each frame. Live-shaded facets add the
     * same floor intensity into their light sum, so the seam between
     * baked and live regions is invisible.
     * @private
     */
    _rebuildFloorLayer() {
        const canvas = this._floorCanvas;
        canvas.width = this.canvas.width;
        canvas.height = this.canvas.height;
        const fctx = canvas.getContext('2d');

        fctx.fillStyle = this._ambientColor;
        fctx.fillRect(0, 0, canvas.width, canvas.height);

        const peak = config.epcot.lighting.intensity * this.brightness;
        const floorI = this.bulbFloor * 0.5 * peak;
        this._floorSurfaceIntensity = floorI;
        if (floorI <= 0 || !this.paths) return;

        const vertexLights = this._vertexLights;
        for (let v = 0; v < this.vertexCount; v++) {
            vertexLights[v * 7 + 6] = floorI;
        }

        const scratch = this._colorScratch;
        const normals = this.normals;
        const centroids = this.centroids3D;
        const triSums = this._triSums;
        const triBounce = this._triBounce;
        const triNeighbors = this.triNeighbors;
        const directColors = this._directColors;
        const baseR = this.effBaseR, baseG = this.effBaseG, baseB = this.effBaseB;
        const ambR = this.ambient * this.baseR * 255;
        const ambG = this.ambient * this.baseG * 255;
        const ambB = this.ambient * this.baseB * 255;

        // Gathered light lists, not just each triangle's own corners: a
        // facet's own bulbs graze it edge-on (near-zero diffuse) - its
        // real illumination comes from bulbs a row or two away that face
        // it. Shadows included, matching the live gathered path.
        for (let t = 0; t < this.triCount; t++) {
            const t3 = t * 3;
            triSums[t3] = triSums[t3 + 1] = triSums[t3 + 2] = 0;
            for (let k = 0; k < 3; k++) {
                const no = (t * 3 + k) * 3;
                shadeFacet(
                    normals[no], normals[no + 1], normals[no + 2],
                    centroids[no], centroids[no + 1], centroids[no + 2],
                    vertexLights, this._triLightIdx, this._triLightStart[t], this._triLightCount[t],
                    baseR, baseG, baseB, 0, this.shininess, this.falloff,
                    this.diffuseWeight, this.specularWeight, scratch, this._triLightShadow
                );
                directColors[no] = scratch[0];
                directColors[no + 1] = scratch[1];
                directColors[no + 2] = scratch[2];
                triSums[t3] += scratch[0];
                triSums[t3 + 1] += scratch[1];
                triSums[t3 + 2] += scratch[2];
            }
        }

        const bounceOn = this.bounceEnabled;
        for (let t = 0; t < this.triCount; t++) {
            const no = t * 3;
            let br = 0, bg = 0, bb = 0, n = 0;
            if (bounceOn) {
                for (let e = 0; e < 3; e++) {
                    const nt = triNeighbors[no + e];
                    if (nt < 0) continue;
                    n++;
                    const nn = nt * 3;
                    br += triSums[nn];
                    bg += triSums[nn + 1];
                    bb += triSums[nn + 2];
                }
            }
            const s = n > 0 ? this.bounceStrength / (3 * n) : 0;
            triBounce[no] = br * s;
            triBounce[no + 1] = bg * s;
            triBounce[no + 2] = bb * s;

            for (let k = 0; k < 3; k++) {
                const no2 = (t * 3 + k) * 3;
                let dr = ambR + directColors[no2] + triBounce[no];
                let dg = ambG + directColors[no2 + 1] + triBounce[no + 1];
                let db = ambB + directColors[no2 + 2] + triBounce[no + 2];
                const m = Math.max(dr, dg, db);
                if (m > 191) {
                    const mn = m / 255;
                    const compressed = 0.75 + 0.25 * (1 - Math.exp(-(mn - 0.75) / 0.5));
                    const scale = (compressed * 255) / m;
                    dr *= scale; dg *= scale; db *= scale;
                }
                fctx.fillStyle = `rgb(${dr | 0},${dg | 0},${db | 0})`;
                fctx.fill(this.paths[t * 3 + k]);
            }
        }
    }

    /**
     * Compute each vertex's base hue from the active color scheme, then
     * derive its light RGB and sprite hue bucket.
     * @private
     */
    _applyScheme() {
        const palette = config.epcot.palettes[this.scheme];

        if (palette) {
            // Palette scheme: discrete color combinations assigned in
            // patchwork blocks (deterministic spatial hash), like the real
            // ball's panel-region lighting programs. The surface shades
            // with a neutral metal base so bulb colors read true instead
            // of being tinted by the scene base color.
            const colors = palette.map((hex) => boostSaturation(hexToRgbFloats(hex), this.saturation));
            this._spriteColors = colors;
            this.effBaseR = 0.72;
            this.effBaseG = 0.75;
            this.effBaseB = 0.78;

            const isGradient = (config.epcot.gradientSchemes ?? []).includes(this.scheme);
            const cell = Math.max(1, this.size * (config.epcot.paletteCellRatio ?? 2.6));
            const height = this.canvas.height || 1;
            for (let v = 0; v < this.vertexCount; v++) {
                const x = this.vertexPositions[v * 2];
                const y = this.vertexPositions[v * 2 + 1];
                const lo = v * 7;
                let idx;
                if (isGradient) {
                    // Static top-to-bottom gradient through ALL the
                    // palette's colors, like the real ball's night look.
                    idx = sampleStops(colors, y / height, this._vertexLights, lo + 3);
                } else {
                    // Patchwork blocks (deterministic spatial hash)
                    idx = hash2(Math.floor(x / cell), Math.floor(y / cell)) % colors.length;
                    const c = colors[idx];
                    this._vertexLights[lo + 3] = c.r;
                    this._vertexLights[lo + 4] = c.g;
                    this._vertexLights[lo + 5] = c.b;
                }
                this._vertexBaseColor[v * 3] = this._vertexLights[lo + 3];
                this._vertexBaseColor[v * 3 + 1] = this._vertexLights[lo + 4];
                this._vertexBaseColor[v * 3 + 2] = this._vertexLights[lo + 5];
                this._vertexBucket[v] = idx;
                this._vertexHue[v] = 0;
            }

            // Color-pattern data: the full stop list (blend mode samples
            // the whole gradient - no hard group lines) and the two
            // halves (sharp mode trades discrete groups).
            this._stopColors = colors.map((c, i) => ({ ...c, bucket: i }));
            const half = Math.ceil(colors.length / 2);
            this._groupA = this._stopColors.slice(0, half);
            this._groupB = this._stopColors.slice(half);
            return;
        }

        // Wheel scheme: hues derived from the base color; sprites cover
        // the full wheel in HUE_BUCKETS steps. Saturation boost applies to
        // the light colors (not the surface base).
        this._spriteColors = null;
        this.effBaseR = this.baseR;
        this.effBaseG = this.baseG;
        this.effBaseB = this.baseB;
        this._effS = Math.min(100, this.baseHSL.s * this.saturation);

        const baseHue = this.baseHSL.h;
        const hueOffsets = config.epcot.lighting.hueOffsets;
        const weights = this._vertexWeights;
        const coord = this._vertexCoord;

        for (let v = 0; v < this.vertexCount; v++) {
            let hue;
            switch (this.scheme) {
                case 'mono':
                    hue = baseHue;
                    break;
                case 'duo': {
                    // Complementary split across the diagonal, smoothed
                    const p = coord[v * 5];
                    const t = Math.min(1, Math.max(0, (p - 0.38) / 0.24));
                    hue = baseHue + 180 * (t * t * (3 - 2 * t));
                    break;
                }
                case 'rainbow':
                    hue = baseHue + coord[v * 5 + 4] * 360;
                    break;
                case 'classic':
                case 'cycle':
                default: {
                    const o = v * 4;
                    hue = baseHue +
                        weights[o] * hueOffsets[0] + weights[o + 1] * hueOffsets[1] +
                        weights[o + 2] * hueOffsets[2] + weights[o + 3] * hueOffsets[3];
                    break;
                }
            }
            hue = ((hue % 360) + 360) % 360;
            this._vertexHue[v] = hue;
            const rgb = hslToRgb(hue, this._effS, this.baseHSL.l);
            const lo = v * 7;
            this._vertexLights[lo + 3] = rgb.r;
            this._vertexLights[lo + 4] = rgb.g;
            this._vertexLights[lo + 5] = rgb.b;
            this._vertexBaseColor[v * 3] = rgb.r;
            this._vertexBaseColor[v * 3 + 1] = rgb.g;
            this._vertexBaseColor[v * 3 + 2] = rgb.b;
            this._vertexBucket[v] = Math.round(hue / (360 / HUE_BUCKETS)) % HUE_BUCKETS;
        }

        // Color-pattern groups for wheel schemes: base hue vs complement.
        const s2 = this._effS, l2 = this.baseHSL.l;
        const compHue = (baseHue + 180) % 360;
        this._groupA = [{ ...hslToRgb(baseHue, s2, l2), bucket: Math.round(baseHue / (360 / HUE_BUCKETS)) % HUE_BUCKETS }];
        this._groupB = [{ ...hslToRgb(compHue, s2, l2), bucket: Math.round(compHue / (360 / HUE_BUCKETS)) % HUE_BUCKETS }];
        this._stopColors = [this._groupA[0], this._groupB[0]];
    }

    /**
     * Color patterns: every bulb stays lit; what animates is WHICH of the
     * scheme's two color groups each bulb currently shows. The proportion
     * p(t) of group A cycles over time, so the colors trade territory -
     * e.g. illuminations 'split': purple on top, orange below, with the
     * boundary sweeping up and down.
     *
     * With a `drive` field (combo mode for intensity patterns), each
     * bulb blends from its base scheme color toward the pattern's color
     * proportionally to its current drive - the moving light carries the
     * color shift with it while idle bulbs keep the scheme.
     * @private
     */
    _applyColorPattern(name, t, drive = null) {
        const phase = (((t / this.cycleDuration) % 1) + 1) % 1;
        const p = 0.5 + 0.42 * Math.sin(2 * Math.PI * phase);
        const A = this._groupA, B = this._groupB;
        const coord = this._vertexCoord;
        const rand = this._vertexRand;
        const variant = this._vertexVariant;
        const vertexLights = this._vertexLights;
        const buckets = this._vertexBucket;

        const blend = this.colorBlend;
        for (let v = 0; v < this.vertexCount; v++) {
            // w = 0 -> fully group A, 1 -> fully group B
            let w;
            switch (name) {
                case 'sweep': {
                    let a = coord[v * 5 + 4] - phase;
                    a -= Math.floor(a);
                    if (blend) {
                        // Full rotating angular gradient: colors
                        // continuously interpolate A -> B -> A around the
                        // circle, spinning with the phase.
                        w = 0.5 - 0.5 * Math.cos(2 * Math.PI * a);
                    } else {
                        // Rotating hard boundary; slice width follows p
                        w = a < p ? 0 : 1;
                    }
                    break;
                }
                case 'bands': {
                    if (blend) {
                        // Flowing gradient stripes
                        w = 0.5 + 0.5 * Math.sin(2 * Math.PI * (coord[v * 5 + 3] * 3 + phase * 3));
                    } else {
                        // Scrolling stripes, dithered edges
                        const b = Math.floor(coord[v * 5 + 3] * 6 + phase * 6 + (rand[v] - 0.5) * 0.2);
                        w = ((b % 2) + 2) % 2 === 0 ? 0 : 1;
                    }
                    break;
                }
                case 'mix':
                    if (blend) {
                        // Every bulb glides toward the dominant group
                        w = Math.min(1, Math.max(0, (1 - p) + (rand[v] - 0.5) * 0.5));
                    } else {
                        // Spatially random; the A/B balance shifts over time
                        w = rand[v] < p ? 0 : 1;
                    }
                    break;
                case 'split':
                default:
                    if (blend) {
                        // Full-height vertical gradient A -> B whose
                        // center tracks the sweeping balance point p.
                        const m = Math.min(1, Math.max(0, (coord[v * 5 + 3] - p) / 1.0 + 0.5));
                        w = m * m * (3 - 2 * m);
                    } else {
                        // Group A above the boundary, B below; dithered edge
                        w = coord[v * 5 + 3] + (rand[v] - 0.5) * 0.08 < p ? 0 : 1;
                    }
                    break;
            }

            const lo = v * 7;
            if (blend) {
                // Blend mode: sample the FULL multi-stop gradient at w -
                // every palette color participates in one continuous
                // gradient, with no group or patchwork-variant hard lines.
                buckets[v] = sampleStops(this._stopColors, w, vertexLights, lo + 3);
                buckets[v] = this._stopColors[buckets[v]].bucket;
            } else {
                const g = w < 0.5 ? A : B;
                const c = g[variant[v] % g.length];
                vertexLights[lo + 3] = c.r;
                vertexLights[lo + 4] = c.g;
                vertexLights[lo + 5] = c.b;
                buckets[v] = c.bucket;
            }

            // Combo mode: pull back toward the base scheme color by how
            // little this bulb is driven right now.
            if (drive) {
                const m = Math.min(1, drive[v] * 1.5);
                if (m < 1) {
                    const b3 = v * 3;
                    const baseCol = this._vertexBaseColor;
                    vertexLights[lo + 3] = baseCol[b3] + (vertexLights[lo + 3] - baseCol[b3]) * m;
                    vertexLights[lo + 4] = baseCol[b3 + 1] + (vertexLights[lo + 4] - baseCol[b3 + 1]) * m;
                    vertexLights[lo + 5] = baseCol[b3 + 2] + (vertexLights[lo + 5] - baseCol[b3 + 2]) * m;
                    if (m < 0.5) buckets[v] = this._vertexBaseBucket[v];
                }
            }
        }
        this._lightColorsDirty = true;
    }

    /**
     * Render the static panel-gap layer once into an offscreen canvas:
     * base-triangle perimeter edges (the panel outlines) plus the thinner
     * internal facet edges (vertex-to-apex creases within each panel).
     * Composited over the facet fills with a single drawImage() per frame.
     * @private
     */
    _rebuildGapLayer(grid, width, height) {
        const gapCanvas = this._gapCanvas;
        gapCanvas.width = width;
        gapCanvas.height = height;

        if (!this.gapEnabled) return;

        const gctx = gapCanvas.getContext('2d');
        gctx.clearRect(0, 0, width, height);

        const triangles = grid.triangles;
        const triCount = grid.triCount;

        const perimeterPath = new Path2D();
        const internalPath = new Path2D();

        for (let t = 0; t < triCount; t++) {
            const o = t * 6;
            const ax = triangles[o], ay = triangles[o + 1];
            const bx = triangles[o + 2], by = triangles[o + 3];
            const cx = triangles[o + 4], cy = triangles[o + 5];

            perimeterPath.moveTo(ax, ay);
            perimeterPath.lineTo(bx, by);
            perimeterPath.lineTo(cx, cy);
            perimeterPath.closePath();

            const centroidX = (ax + bx + cx) / 3;
            const centroidY = (ay + by + cy) / 3;
            internalPath.moveTo(ax, ay);
            internalPath.lineTo(centroidX, centroidY);
            internalPath.moveTo(bx, by);
            internalPath.lineTo(centroidX, centroidY);
            internalPath.moveTo(cx, cy);
            internalPath.lineTo(centroidX, centroidY);
        }

        gctx.strokeStyle = this.gapColor;
        gctx.lineWidth = this.gapWidth;
        gctx.stroke(perimeterPath);

        gctx.lineWidth = this.gapWidth * this.gapInternalWidthRatio;
        gctx.stroke(internalPath);
    }

    /**
     * Pre-render one glow sprite and one beam sprite per hue bucket (12
     * hues, every 30deg). Every bulb draws the sprite of its hue bucket,
     * faded by its current intensity - drawImage of a cached sprite is far
     * cheaper than per-bulb gradients. The glow sprite has a white-hot
     * center so a fully driven bulb reads as an extremely bright point; the
     * beam sprite's arms follow the active star style.
     * @private
     */
    _rebuildBulbSprites() {
        const style = STAR_STYLES[this.bulbStyle] || STAR_STYLES.star6;
        const glowR = Math.max(4, this.size * this.bulbGlowRadiusRatio);
        const coreR = Math.max(1.5, this.size * this.bulbCoreRadiusRatio);
        const beamL = Math.max(8, this.size * this.beamLengthRatio * style.lengthScale);

        this._glowRadius = glowR;
        this._beamLength = beamL;
        this._starArms = style.arms;
        this._starOffset = style.offset;
        this._starWidthScale = style.widthScale;
        this._glowSprites = [];
        this._beamSprites = [];
        this._pointSprites = [];
        this._strokeGradStops = [];
        this._pointRadius = Math.max(2, coreR * 0.55);

        // Sprite color list: exact palette colors for palette schemes, or
        // the full hue wheel (at the base color's boosted S) for wheel
        // schemes.
        const s = this._effS ?? this.baseHSL.s;
        const l = Math.min(62, Math.max(42, this.baseHSL.l));
        const spriteColors = this._spriteColors
            ? this._spriteColors
            : Array.from({ length: HUE_BUCKETS }, (_, c) => hslToRgb(c * (360 / HUE_BUCKETS), s, l));
        this._spriteCount = spriteColors.length;

        for (let c = 0; c < spriteColors.length; c++) {
            const col = spriteColors[c];
            const r255 = Math.round(col.r * 255);
            const g255 = Math.round(col.g * 255);
            const b255 = Math.round(col.b * 255);

            // Gradient stop strings for fisheye's curved beam strokes:
            // bright near the bulb, fading continuously to transparent
            const br = Math.min(255, r255 + 90), bg = Math.min(255, g255 + 90), bb = Math.min(255, b255 + 90);
            this._strokeGradStops.push([
                `rgba(${br},${bg},${bb},0.95)`,
                `rgba(${r255},${g255},${b255},0.45)`,
                `rgba(${r255},${g255},${b255},0)`
            ]);

            // Glow: white-hot core -> saturated color -> transparent
            const glowCanvas = document.createElement('canvas');
            glowCanvas.width = glowCanvas.height = Math.ceil(glowR * 2) + 2;
            const gc = glowCanvas.getContext('2d');
            const gcx = glowCanvas.width / 2;
            const grad = gc.createRadialGradient(gcx, gcx, 0, gcx, gcx, glowR);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(Math.min(0.9, coreR / glowR), `rgba(${Math.min(255, r255 + 130)},${Math.min(255, g255 + 130)},${Math.min(255, b255 + 130)},0.95)`);
            grad.addColorStop(0.45, `rgba(${r255},${g255},${b255},0.5)`);
            grad.addColorStop(1, `rgba(${r255},${g255},${b255},0)`);
            gc.fillStyle = grad;
            gc.fillRect(0, 0, glowCanvas.width, glowCanvas.height);
            this._glowSprites.push(glowCanvas);

            // LED point: a small crisp dot that idles at the visibility
            // floor - a real LED at minimum drive is still a visible
            // point; only the bloom collapses.
            const pointR = Math.max(2, coreR * 0.55);
            const pointCanvas = document.createElement('canvas');
            pointCanvas.width = pointCanvas.height = Math.ceil(pointR * 2) + 2;
            const pc = pointCanvas.getContext('2d');
            const pcx = pointCanvas.width / 2;
            const pgrad = pc.createRadialGradient(pcx, pcx, 0, pcx, pcx, pointR);
            pgrad.addColorStop(0, `rgba(${Math.min(255, r255 + 170)},${Math.min(255, g255 + 170)},${Math.min(255, b255 + 170)},1)`);
            pgrad.addColorStop(0.55, `rgba(${r255},${g255},${b255},0.85)`);
            pgrad.addColorStop(1, `rgba(${r255},${g255},${b255},0)`);
            pc.fillStyle = pgrad;
            pc.fillRect(0, 0, pointCanvas.width, pointCanvas.height);
            this._pointSprites.push(pointCanvas);

            // Beams: arms stroked with a linear gradient fading from the
            // bulb color at the center to transparent at the tip.
            const beamCanvas = document.createElement('canvas');
            beamCanvas.width = beamCanvas.height = Math.ceil(beamL * 2) + 2;
            if (style.arms > 0) {
                const bc = beamCanvas.getContext('2d');
                const bcx = beamCanvas.width / 2;
                bc.lineWidth = this.beamWidthPx * style.widthScale;
                bc.lineCap = 'round';
                for (let a = 0; a < style.arms; a++) {
                    const angle = style.offset + (a * 2 * Math.PI) / style.arms;
                    const tx = bcx + Math.cos(angle) * beamL;
                    const ty = bcx + Math.sin(angle) * beamL;
                    const bgrad = bc.createLinearGradient(bcx, bcx, tx, ty);
                    bgrad.addColorStop(0, `rgba(${Math.min(255, r255 + 90)},${Math.min(255, g255 + 90)},${Math.min(255, b255 + 90)},0.9)`);
                    bgrad.addColorStop(0.35, `rgba(${r255},${g255},${b255},0.45)`);
                    bgrad.addColorStop(1, `rgba(${r255},${g255},${b255},0)`);
                    bc.strokeStyle = bgrad;
                    bc.beginPath();
                    bc.moveTo(bcx, bcx);
                    bc.lineTo(tx, ty);
                    bc.stroke();
                }
            }
            this._beamSprites.push(beamCanvas);
        }

        // Pure-white glow sprite for the forward-core layer ('white' core
        // style and the star overlay both draw with it).
        const whiteCanvas = document.createElement('canvas');
        whiteCanvas.width = whiteCanvas.height = Math.ceil(glowR * 2) + 2;
        const wc = whiteCanvas.getContext('2d');
        const wcx = whiteCanvas.width / 2;
        // Steeper falloff than the colored bulb glow: overlay stars read
        // as tight points whose light dies quickly with distance.
        const wgrad = wc.createRadialGradient(wcx, wcx, 0, wcx, wcx, glowR);
        wgrad.addColorStop(0, 'rgba(255,255,255,1)');
        wgrad.addColorStop(Math.min(0.9, coreR / glowR), 'rgba(255,255,255,0.9)');
        wgrad.addColorStop(0.28, 'rgba(235,245,255,0.3)');
        wgrad.addColorStop(0.6, 'rgba(230,242,255,0.07)');
        wgrad.addColorStop(1, 'rgba(225,240,255,0)');
        wc.fillStyle = wgrad;
        wc.fillRect(0, 0, whiteCanvas.width, whiteCanvas.height);
        this._whiteGlowSprite = whiteCanvas;

        // Matching white beam sprite so overlay stars (twinkle/meteor)
        // flare with the full star effect, not just a round glow.
        const whiteBeamCanvas = document.createElement('canvas');
        whiteBeamCanvas.width = whiteBeamCanvas.height = Math.ceil(beamL * 2) + 2;
        if (style.arms > 0) {
            const wb = whiteBeamCanvas.getContext('2d');
            const wbx = whiteBeamCanvas.width / 2;
            wb.lineWidth = this.beamWidthPx * style.widthScale;
            wb.lineCap = 'round';
            for (let a = 0; a < style.arms; a++) {
                const angle = style.offset + (a * 2 * Math.PI) / style.arms;
                const tx = wbx + Math.cos(angle) * beamL;
                const ty = wbx + Math.sin(angle) * beamL;
                const bgrad = wb.createLinearGradient(wbx, wbx, tx, ty);
                bgrad.addColorStop(0, 'rgba(255,255,255,0.95)');
                bgrad.addColorStop(0.35, 'rgba(240,248,255,0.5)');
                bgrad.addColorStop(1, 'rgba(230,242,255,0)');
                wb.strokeStyle = bgrad;
                wb.beginPath();
                wb.moveTo(wbx, wbx);
                wb.lineTo(tx, ty);
                wb.stroke();
            }
        }
        this._whiteBeamSprite = whiteBeamCanvas;
    }

    /**
     * Advance the light-pattern clock.
     * @param {number} deltaTime - Time elapsed since last frame, in seconds
     */
    update(deltaTime) {
        this.clock += deltaTime * this.speed;
    }

    /**
     * Fill `out` (Float32Array per vertex) with a pattern's raw intensity
     * field, 0..1, at time `t`. Every bulb runs the same formula - only its
     * position differs.
     * @private
     */
    _fillField(name, t, out) {
        const vertexCount = this.vertexCount;
        const coord = this._vertexCoord;
        const vertexLights = this._vertexLights;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const phase = (((t / this.cycleDuration) % 1) + 1) % 1;

        switch (name) {
            case 'orbit':
            case 'chase': {
                const theta = -0.75 * Math.PI + 2 * Math.PI * phase;
                const ax = width / 2 + Math.cos(theta) * (width / 2) * 1.05;
                const ay = height / 2 + Math.sin(theta) * (height / 2) * 1.05;
                const twoSigmaSq = this._anchorTwoSigmaSq * 2.25;
                const dual = name === 'orbit';
                const bx = width - ax, by = height - ay; // opposite anchor
                for (let v = 0; v < vertexCount; v++) {
                    const x = vertexLights[v * 7], y = vertexLights[v * 7 + 1];
                    const dxa = x - ax, dya = y - ay;
                    let I = Math.exp(-(dxa * dxa + dya * dya) / twoSigmaSq);
                    if (dual) {
                        const dxb = x - bx, dyb = y - by;
                        I = Math.min(1, I + Math.exp(-(dxb * dxb + dyb * dyb) / twoSigmaSq));
                    }
                    out[v] = I;
                }
                break;
            }
            case 'pulse': {
                const breathe = 0.5 + 0.5 * Math.sin(2 * Math.PI * phase);
                for (let v = 0; v < vertexCount; v++) {
                    const dn = coord[v * 5 + 1];
                    out[v] = breathe * Math.exp(-(dn * dn) / (2 * 0.34 * 0.34));
                }
                break;
            }
            case 'diagonal': {
                const a = 0.5 + 0.5 * Math.sin(2 * Math.PI * phase);
                const b = 1 - a;
                const gauss = this._vertexCornerGauss;
                for (let v = 0; v < vertexCount; v++) {
                    const o = v * 4;
                    out[v] = Math.min(1, a * (gauss[o] + gauss[o + 2]) + b * (gauss[o + 1] + gauss[o + 3]));
                }
                break;
            }
            case 'wave': {
                const w = 0.16;
                const center = -w + phase * (1 + 2 * w);
                for (let v = 0; v < vertexCount; v++) {
                    out[v] = band(coord[v * 5], center, w);
                }
                break;
            }
            case 'cascade': {
                const w = 0.14;
                const center = -w + phase * (1 + 2 * w);
                for (let v = 0; v < vertexCount; v++) {
                    out[v] = band(coord[v * 5 + 3], center, w);
                }
                break;
            }
            case 'scanner': {
                const w = 0.12;
                // Triangle wave: sweeps right then back left each cycle
                const c = 1 - Math.abs(1 - 2 * phase);
                for (let v = 0; v < vertexCount; v++) {
                    out[v] = band(coord[v * 5 + 2], c, w);
                }
                break;
            }
            case 'spiral': {
                const sigmaA = 0.075; // angular width, in turns
                for (let v = 0; v < vertexCount; v++) {
                    let d = Math.abs(coord[v * 5 + 4] - phase);
                    if (d > 0.5) d = 1 - d;
                    out[v] = Math.exp(-(d * d) / (2 * sigmaA * sigmaA));
                }
                break;
            }
            case 'steady': {
                // Fully lit, motionless - shows the scheme exactly as-is
                // (with a gradient scheme: the flat static gradient).
                for (let v = 0; v < vertexCount; v++) {
                    out[v] = 0.9;
                }
                break;
            }
            case 'split':
            case 'sweep':
            case 'bands':
            case 'mix': {
                // Color patterns: every bulb stays fully driven (the
                // animation is in the color assignment); a gentle ripple
                // keeps the surface alive. Facet exposure stays in range
                // because these patterns shade from each triangle's own 3
                // bulbs only (see draw()), not the long-range gather.
                for (let v = 0; v < vertexCount; v++) {
                    out[v] = 0.92 + 0.08 * Math.sin(2 * Math.PI * (2 * phase + coord[v * 5] * 2.5));
                }
                break;
            }
            case 'radial':
            default: {
                for (let v = 0; v < vertexCount; v++) {
                    out[v] = radialField(coord[v * 5 + 1], t, this.cycleDuration);
                }
                break;
            }
        }
    }

    /**
     * Fill `out` with the star overlay's per-bulb intensities at time `t`.
     * Unlike the base patterns (broad fields), these address bulbs
     * individually: twinkle flares single bulbs on staggered schedules;
     * meteor lights a sequence of bulbs along a moving streak.
     * @private
     */
    _fillOverlay(name, t, out) {
        out.fill(0);
        const vertexCount = this.vertexCount;
        const vertexLights = this._vertexLights;
        const cfg = config.epcot.bulbs;

        if (name === 'twinkle' || name === 'night') {
            const k = cfg.twinkleSharpness ?? 140;
            const phase = this._twinklePhase;
            const period = this._twinklePeriod;
            for (let v = 0; v < vertexCount; v++) {
                const base = 0.5 + 0.5 * Math.sin(2 * Math.PI * (t / period[v] + phase[v]));
                const I = Math.pow(base, k);
                if (I > 0.02) out[v] = Math.min(1, I);
            }
        }

        if (name === 'meteor' || name === 'night') {
            const interval = Math.max(0.5, this.meteorInterval);
            const speed = this.meteorSpeed * this.size;
            const tail = this.meteorTail * this.size;
            const life = this.meteorLife;
            const tracks = Math.max(1, Math.min(4, this.meteorTracks | 0));
            const width = this.canvas.width;
            const height = this.canvas.height;
            const corridor = 0.42 * this.size;

            // Fixed direction, or -1 for random-per-meteor. Directions are
            // the 6 lattice axes so streaks run along actual bulb rows.
            const dirNames = config.epcot.bulbs.meteorDirectionOptions;
            const fixedDir = dirNames.indexOf(this.meteorDirection) - 1; // 'random' -> -1

            // Staggered tracks so a new streak can start while the
            // previous one finishes.
            for (let j = 0; j < tracks; j++) {
                const tj = t + (j * interval) / tracks;
                const m = Math.floor(tj / interval);
                const tau = tj - m * interval;
                if (tau > life) continue;

                // Deterministic per-meteor parameters
                const h1 = hash2(m, 0x27d4eb + j);
                const h2 = hash2(m, 0x165667 + j);
                const h3 = hash2(m, 0xfd7046 + j);
                const angle = ((fixedDir >= 0 ? fixedDir : h3 % 6) * Math.PI) / 3;
                const dx = Math.cos(angle), dy = Math.sin(angle);

                // Spawn on the canvas edge the meteor travels INTO from,
                // never mid-canvas: a direction with a positive x-component
                // enters from the left edge, negative from the right, and
                // likewise for y/top/bottom. Diagonal lattice directions
                // (e.g. down-right) are valid from either of two edges - h1
                // picks between them deterministically; h2 then picks the
                // position along the chosen edge. The start is offset one
                // tail-length outside that edge so the head slides IN from
                // off-canvas rather than igniting mid-air.
                const enterLeft = dx > 1e-6, enterRight = dx < -1e-6;
                const enterTop = dy > 1e-6, enterBottom = dy < -1e-6;
                const xEdge = enterLeft ? 0 : enterRight ? width : null;
                const yEdge = enterTop ? 0 : enterBottom ? height : null;
                const useXEdge = xEdge !== null && (yEdge === null || (h1 % 2) === 0);
                let x0, y0;
                if (useXEdge) {
                    x0 = xEdge === 0 ? -tail : width + tail;
                    y0 = ((h2 % 10000) / 10000) * height;
                } else {
                    y0 = yEdge === 0 ? -tail : height + tail;
                    x0 = ((h2 % 10000) / 10000) * width;
                }

                const head = speed * tau;
                // Fade the whole streak in fast and out at end of life
                const window = Math.min(1, tau / 0.12, (life - tau) / 0.35);
                if (window <= 0) continue;

                for (let v = 0; v < vertexCount; v++) {
                    const px = vertexLights[v * 7] - x0;
                    const py = vertexLights[v * 7 + 1] - y0;
                    const along = px * dx + py * dy;
                    if (along > head || head - along > tail) continue;
                    const perp = Math.abs(px * -dy + py * dx);
                    if (perp > corridor) continue;
                    const I = (1 - (head - along) / tail) * window;
                    if (I > out[v]) out[v] = I;
                }
            }
        }
    }

    /**
     * Shade and fill every facet (direct + one-bounce indirect), composite
     * the static gap-line layer, then draw the bulbs (glow + star beams)
     * additively on top.
     */
    draw() {
        const peak = config.epcot.lighting.intensity * this.brightness;
        const vertexLights = this._vertexLights;
        const vertexCount = this.vertexCount;

        // Restore pristine scheme colors/buckets if a previous frame
        // mutated them (color patterns, overlay white blending).
        if (this._lightColorsDirty) {
            const baseCol = this._vertexBaseColor;
            const baseBuckets = this._vertexBaseBucket;
            for (let v = 0; v < vertexCount; v++) {
                const lo = v * 7;
                vertexLights[lo + 3] = baseCol[v * 3];
                vertexLights[lo + 4] = baseCol[v * 3 + 1];
                vertexLights[lo + 5] = baseCol[v * 3 + 2];
                this._vertexBucket[v] = baseBuckets[v];
            }
            this._lightColorsDirty = false;
        }

        // 'cycle' scheme: rotate every vertex's hue through the wheel over
        // time (slow - one full wheel per 3 pattern cycles).
        let bucketShift = 0;
        if (this.scheme === 'cycle') {
            const hueShift = ((this.clock / (this.cycleDuration * 3)) * 360) % 360;
            bucketShift = Math.round(hueShift / (360 / HUE_BUCKETS)) % HUE_BUCKETS;
            const baseCol = this._vertexBaseColor;
            for (let v = 0; v < vertexCount; v++) {
                const rgb = hslToRgb(this._vertexHue[v] + hueShift, this._effS, this.baseHSL.l);
                const lo = v * 7;
                vertexLights[lo + 3] = rgb.r;
                vertexLights[lo + 4] = rgb.g;
                vertexLights[lo + 5] = rgb.b;
                baseCol[v * 3] = rgb.r;
                baseCol[v * 3 + 1] = rgb.g;
                baseCol[v * 3 + 2] = rgb.b;
            }
        }

        // Pattern field, with auto-mode crossfading between patterns.
        // Color patterns additionally reassign each bulb's color group; in
        // auto mode the dominant side of the crossfade wins the colors.
        const fieldA = this._fieldA;
        let colorPatternName = null;
        let comboBase = this.patternName;
        if (this.patternName === 'auto') {
            const seg = this.autoSegmentDuration;
            const fade = Math.min(this.autoFadeDuration, seg / 2);
            const idx = Math.floor(this.clock / seg);
            const cur = AUTO_PATTERNS[((idx % AUTO_PATTERNS.length) + AUTO_PATTERNS.length) % AUTO_PATTERNS.length];
            const next = AUTO_PATTERNS[(((idx + 1) % AUTO_PATTERNS.length) + AUTO_PATTERNS.length) % AUTO_PATTERNS.length];
            const local = this.clock - idx * seg;

            this._fillField(cur, this.clock, fieldA);
            let sm = 0;
            if (local > seg - fade) {
                const fieldB = this._fieldB;
                this._fillField(next, this.clock, fieldB);
                const m = (local - (seg - fade)) / fade;
                sm = m * m * (3 - 2 * m); // smoothstep
                for (let v = 0; v < vertexCount; v++) {
                    fieldA[v] = fieldA[v] * (1 - sm) + fieldB[v] * sm;
                }
            }
            // Colors follow the dominant side of the crossfade: cur's
            // color pattern holds until mid-fade, then next's (or the base
            // scheme, if next isn't a color pattern) takes over.
            if (sm >= 0.5 && COLOR_PATTERNS.has(next)) colorPatternName = next;
            else if (sm < 0.5 && COLOR_PATTERNS.has(cur)) colorPatternName = cur;
            comboBase = sm >= 0.5 ? next : cur;
        } else {
            this._fillField(this.patternName, this.clock, fieldA);
            if (COLOR_PATTERNS.has(this.patternName)) colorPatternName = this.patternName;
        }

        let comboActive = false;
        if (colorPatternName) {
            this._applyColorPattern(colorPatternName, this.clock);
        } else if (this.patternName !== 'steady') {
            // Combo mode: intensity patterns also animate color, on an
            // independent clock - almost every animation shifts
            // brightness AND color, each with its own motion. The drive
            // mask (fieldA) is essential for correctness, not just taste:
            // bulbs at zero drive keep their EXACT base scheme colors, so
            // live-shaded facets at the culling boundary match the baked
            // floor layer behind them - otherwise facets pop to the baked
            // base colors the moment their light moves off.
            const combo = COMBO_COLOR[comboBase];
            if (combo) {
                this._applyColorPattern(combo.c, this.clock * combo.rate, fieldA);
                comboActive = true;
            }
        }

        // Apply peak scaling plus a soft cutoff: subtract a small floor so
        // Gaussian tails reach *exactly* zero in the far field. Without
        // this, triangles far from the bloom receive ~0.4% intensity which
        // quantizes to +/-2 RGB units of per-facet contrast - a visible
        // sawtooth of noise across large dark areas. Intensity approaches
        // the cutoff smoothly, so the lit/unlit boundary has no seam.
        const cut = 0.01;
        for (let v = 0; v < vertexCount; v++) {
            const I = fieldA[v];
            vertexLights[v * 7 + 6] = I > cut ? (I - cut) * peak : 0;
        }

        // Star overlay: per-bulb effects driving ONLY the white forward
        // cores - never the facet lighting, so the radial (surface) light
        // and the camera-facing light stay separate layers.
        const hasOverlay = this.overlayPattern && this.overlayPattern !== 'none';
        const fieldC = this._fieldC;
        if (hasOverlay) {
            this._fillOverlay(this.overlayPattern, this.clock, fieldC);

            // Overlay stars also cast light on the surface - PURELY
            // ADDITIVELY: extra intensity through the bulb's existing
            // scheme color, never recoloring the light. (Blending the
            // light color toward white overwrote the facets' colors,
            // graying or blowing out everything near a star.)
            const k = this.overlaySurfaceLight;
            if (k > 0) {
                for (let v = 0; v < vertexCount; v++) {
                    const oNorm = fieldC[v];
                    if (oNorm <= 0.02) continue;
                    vertexLights[v * 7 + 6] += Math.min(1, oNorm) * peak * k;
                }
            }
        }

        const ctx = this.ctx;
        const normals = this.normals;
        const centroids = this.centroids3D;
        const paths = this.paths;
        const scratch = this._colorScratch;
        const cache = this._colorCache;
        const ambient = this.ambient;
        const shininess = this.shininess;
        const diffuseWeight = this.diffuseWeight;
        const specularWeight = this.specularWeight;
        const falloff = this.falloff;
        // Shading base: neutral metal for palette schemes (so bulb colors
        // read true), the scene base color otherwise. The ambient floor is
        // added separately in pass 3 from the scene base color, so unlit
        // facets always match the background fill exactly.
        const baseR = this.effBaseR, baseG = this.effBaseG, baseB = this.effBaseB;
        const ambR = ambient * this.baseR * 255;
        const ambG = ambient * this.baseG * 255;
        const ambB = ambient * this.baseB * 255;
        const triLightIdx = this._triLightIdx;
        const triLightStart = this._triLightStart;
        const triLightCount = this._triLightCount;
        const triCount = this.triCount;
        const directColors = this._directColors;
        const triSums = this._triSums;
        const triBounce = this._triBounce;
        const triNeighbors = this.triNeighbors;
        const bounceEnabled = this.bounceEnabled;
        const bounceStrength = this.bounceStrength;

        // Pass 0: active-triangle culling. A triangle needs real shading
        // only if one of its vertices carries light; everything else is the
        // uniform ambient color, covered by one background fillRect. Bounce
        // receivers (neighbors of lit triangles) are activated in a second
        // sweep so light still spills onto otherwise-dark panels.
        const triActive = this._triActive;
        for (let t = 0; t < triCount; t++) {
            const start = triLightStart[t];
            const end = start + triLightCount[t];
            let active = 0;
            for (let i = start; i < end; i++) {
                if (vertexLights[triLightIdx[i] * 7 + 6] > 0) { active = 1; break; }
            }
            triActive[t] = active;
        }
        if (bounceEnabled) {
            for (let t = 0; t < triCount; t++) {
                if (triActive[t] !== 1) continue;
                const no = t * 3;
                for (let e = 0; e < 3; e++) {
                    const nt = triNeighbors[no + e];
                    if (nt >= 0 && triActive[nt] === 0) triActive[nt] = 2; // bounce-only receiver
                }
            }
        }

        // Floor light: added into every bulb AFTER culling (the baked
        // floor layer already covers inactive facets), so live-shaded
        // facets carry the same idle radial light and bounce as the baked
        // background - no seam at the active/inactive boundary.
        const floorI = this._floorSurfaceIntensity;
        if (floorI > 0) {
            for (let v = 0; v < vertexCount; v++) {
                vertexLights[v * 7 + 6] += floorI;
            }
        }

        // Pass 1: direct lighting per facet of active triangles (unclamped,
        // so bounce sees true energy from very hot facets), accumulated per
        // base triangle. Color patterns light the whole lattice uniformly,
        // so long-range gathering adds cost but no look - facets shade from
        // just their own triangle's 3 bulbs there (shadows moot: no
        // occlusion contrast when every bulb is lit).
        const localLights = colorPatternName !== null || this.patternName === 'steady';
        const ownVerts = this._triVertexIndex;
        for (let t = 0; t < triCount; t++) {
            if (!triActive[t]) continue;
            const t3 = t * 3;
            triSums[t3] = triSums[t3 + 1] = triSums[t3 + 2] = 0;
            for (let k = 0; k < 3; k++) {
                const f = t * 3 + k;
                const no = f * 3;
                shadeFacet(
                    normals[no], normals[no + 1], normals[no + 2],
                    centroids[no], centroids[no + 1], centroids[no + 2],
                    vertexLights,
                    localLights ? ownVerts : triLightIdx,
                    localLights ? t * 3 : triLightStart[t],
                    localLights ? 3 : triLightCount[t],
                    baseR, baseG, baseB, 0, shininess, falloff, diffuseWeight, specularWeight, scratch,
                    localLights ? null : this._triLightShadow
                );
                directColors[no] = scratch[0];
                directColors[no + 1] = scratch[1];
                directColors[no + 2] = scratch[2];
                triSums[t3] += scratch[0];
                triSums[t3 + 1] += scratch[1];
                triSums[t3 + 2] += scratch[2];
            }
        }

        // Overlay local lift: ADDITIVE brightness in each facet's OWN
        // color - the facet's current lit color is scaled up, never
        // shifted toward white (flat white addition grayed dark saturated
        // facets). Physically: a metal facet reflects the star's light
        // tinted by its own color. Feeds triSums so bounce and tone
        // mapping see it like any other light.
        if (hasOverlay) {
            const lift = this.overlayLocalLift;
            if (lift > 0) {
                const vtStart = this._vertexTriStart;
                const vtCount = this._vertexTriCount;
                const vtIdx = this._vertexTriIdx;
                for (let v = 0; v < vertexCount; v++) {
                    const oNorm = fieldC[v];
                    if (oNorm <= 0.02) continue;
                    const strength = Math.min(1, oNorm) * lift;
                    const s0 = vtStart[v];
                    const s1 = s0 + vtCount[v];
                    for (let i = s0; i < s1; i++) {
                        const t = vtIdx[i];
                        if (!triActive[t]) continue;
                        const t3 = t * 3;
                        for (let k2 = 0; k2 < 3; k2++) {
                            const no = (t * 3 + k2) * 3;
                            // Orientation-weighted multiplicative boost:
                            // camera-facing facets catch the most, and the
                            // gain is proportional to the facet's existing
                            // color - hue and saturation are preserved.
                            const m = strength * (0.06 + 0.94 * normals[no + 2]);
                            const dr = directColors[no] * m;
                            const dg = directColors[no + 1] * m;
                            const db = directColors[no + 2] * m;
                            directColors[no] += dr;
                            directColors[no + 1] += dg;
                            directColors[no + 2] += db;
                            triSums[t3] += dr;
                            triSums[t3 + 1] += dg;
                            triSums[t3 + 2] += db;
                        }
                    }
                }
            }
        }

        // Background: the baked floor-light layer covers every inactive
        // facet (ambient + idle radial light + bounce in one drawImage).
        ctx.drawImage(this._floorCanvas, 0, 0);

        // Pass 2: one-bounce indirect - each active panel receives a
        // fraction of its lit edge-neighbors' average direct light.
        if (bounceEnabled) {
            for (let t = 0; t < triCount; t++) {
                if (!triActive[t]) continue;
                const no = t * 3;
                let br = 0, bg = 0, bb = 0, n = 0;
                for (let e = 0; e < 3; e++) {
                    const nt = triNeighbors[no + e];
                    if (nt < 0) continue;
                    n++;
                    if (triActive[nt] !== 1) continue; // unlit neighbors carry ~ambient only
                    const nn = nt * 3;
                    br += triSums[nn];
                    bg += triSums[nn + 1];
                    bb += triSums[nn + 2];
                }
                if (n > 0) {
                    const s = bounceStrength / (3 * n);
                    triBounce[no] = br * s;
                    triBounce[no + 1] = bg * s;
                    triBounce[no + 2] = bb * s;
                } else {
                    triBounce[no] = triBounce[no + 1] = triBounce[no + 2] = 0;
                }
            }
        }

        // Pass 3: clamp, quantize, fill - active triangles' facets only
        // (both lit and bounce-only receivers were shaded in pass 1).
        for (let t = 0; t < triCount; t++) {
            if (!triActive[t]) continue;
            const t3 = t * 3;
            const bounceR = bounceEnabled ? triBounce[t3] : 0;
            const bounceG = bounceEnabled ? triBounce[t3 + 1] : 0;
            const bounceB = bounceEnabled ? triBounce[t3 + 2] : 0;
            for (let k = 0; k < 3; k++) {
                const f = t * 3 + k;
                const no = f * 3;
                let dr = ambR + directColors[no] + bounceR;
                let dg = ambG + directColors[no + 1] + bounceG;
                let db = ambB + directColors[no + 2] + bounceB;

                // Hue-preserving soft-knee tone map: when many gathered
                // bulbs of different colors sum past full brightness, a
                // hard per-channel clip washes the facet out to white.
                // Instead compress the max channel above the knee and scale
                // all three channels by the same factor - hot facets get a
                // brighter version of their own color, and only genuinely
                // white light reaches white.
                const m = Math.max(dr, dg, db);
                if (m > 191) {
                    const mn = m / 255;
                    const compressed = 0.75 + 0.25 * (1 - Math.exp(-(mn - 0.75) / 0.5));
                    const scale = (compressed * 255) / m;
                    dr *= scale;
                    dg *= scale;
                    db *= scale;
                }

                const r = dr | 0;
                const g = dg | 0;
                const b = db | 0;
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

        if (this.gapEnabled) {
            ctx.drawImage(this._gapCanvas, 0, 0);
        }

        // Bulbs: additive glow + star beams per lit vertex. Every bulb uses
        // the same sprites and rules; only the pattern's per-vertex
        // intensity (and hue bucket) differs.
        if (this.showBulbs && peak > 0) {
            const glowSprites = this._glowSprites;
            const beamSprites = this._beamSprites;
            const buckets = this._vertexBucket;
            const glowR = this._glowRadius;
            const beamL = this._beamLength;
            const threshold = this.bulbThreshold;
            const beamAlpha = this.beamAlpha;
            const hasBeams = this._starArms > 0;

            const whiteCore = this.coreStyle === 'white';
            const whiteSprite = this._whiteGlowSprite;
            const bulbFloor = this.bulbFloor;
            const pointSprites = this._pointSprites;
            const pointR = this._pointRadius;
            const curvedBeams = this.fisheye && hasBeams && this._beamPathFull !== null;
            const drawPos = this._vertexDrawPos;
            const beamPaths = this._beamPathFull;
            const beamGradR = this._beamGradRadius;
            const beamWScale = this._beamWidthScale;
            const beamBaseW = this.beamWidthPx * this._starWidthScale;
            const gradStops = this._strokeGradStops;

            // With the idle layer baked (and colors static this frame),
            // composite it once and draw only per-bulb DELTAS above the
            // floor - undriven bulbs skip entirely.
            // Combo colors are drive-masked (idle bulbs keep base colors),
            // so the idle bake stays valid during combo animation.
            const idleBaked = this._idleBulbValid && bucketShift === 0 && !colorPatternName;
            const idleBeamA = this._idleBeamAlpha;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            if (idleBaked) {
                ctx.globalAlpha = 1;
                ctx.drawImage(this._idleBulbCanvas, 0, 0);
            }
            if (curvedBeams) ctx.lineCap = 'round';
            for (let v = 0; v < vertexCount; v++) {
                const o = v * 7;
                // Pattern drive only - the floor's sprite visibility is
                // handled by bulbFloor below, not double-counted from the
                // surface floor intensity added for facet shading.
                const norm = Math.min(1, Math.max(0, vertexLights[o + 6] - floorI) / peak);
                const overlayNorm = hasOverlay ? Math.min(1, fieldC[v]) : 0;
                if (idleBaked && norm < 0.02 && overlayNorm < 0.02) continue;

                // Draw at the (possibly warped) display position; shading
                // used the original coordinates.
                const x = drawPos[v * 2];
                const y = drawPos[v * 2 + 1];
                const c = (buckets[v] + bucketShift) % this._spriteCount;

                // LED point: a bulb at its lowest never goes transparent -
                // the small point stays at least `bulbFloor` visible while
                // the bloom below collapses with drive. Floor 0 disables.
                // (When the idle layer is baked, only the delta above the
                // floor is drawn here.)
                const pAlpha = bulbFloor + (1 - bulbFloor) * norm - (idleBaked ? bulbFloor : 0);
                if (pAlpha > 0.01) {
                    ctx.globalAlpha = pAlpha;
                    ctx.drawImage(pointSprites[c], (x - pointR - 1) | 0, (y - pointR - 1) | 0);
                }

                // Perceptual response: drawn alpha follows sqrt(intensity)
                // so a half-driven bulb still reads clearly lit (~70%
                // apparent brightness) instead of looking mostly off -
                // light output isn't perceived linearly. The floor also
                // feeds the beams at reduced strength, so idle bulbs keep
                // a faint radial star, not just the bare point.
                if (hasBeams) {
                    const bNorm = bulbFloor * 0.45 + (1 - bulbFloor * 0.45) * norm;
                    const beamDelta = Math.sqrt(bNorm) * beamAlpha - (idleBaked ? idleBeamA : 0);
                    if (bNorm >= 0.03 && beamDelta > 0.01) {
                        if (curvedBeams) {
                            // Curved arms following the warped lattice,
                            // one stroke through a cached radial gradient
                            let entry = this._beamGradCache[v];
                            if (entry === undefined) entry = this._beamGradCache[v] = {};
                            let g = entry[c];
                            if (g === undefined) {
                                const stops = gradStops[c];
                                g = ctx.createRadialGradient(x, y, 0, x, y, beamGradR[v]);
                                g.addColorStop(0, stops[0]);
                                g.addColorStop(0.35, stops[1]);
                                g.addColorStop(1, stops[2]);
                                entry[c] = g;
                            }
                            ctx.strokeStyle = g;
                            ctx.globalAlpha = beamDelta;
                            ctx.lineWidth = beamBaseW * beamWScale[v];
                            ctx.stroke(beamPaths[v]);
                        } else {
                            ctx.globalAlpha = beamDelta;
                            ctx.drawImage(beamSprites[c], (x - beamL - 1) | 0, (y - beamL - 1) | 0);
                        }
                    }
                }

                // Bloom: both alpha AND size scale with drive (no floor) -
                // a near-off bulb is a crisp point with a small dim halo
                // that grows and brightens as the bulb is driven. Carries
                // the bulb's color (or white when coreStyle is 'white').
                if (norm >= 0.02) {
                    const gs = glowR * (0.35 + 0.65 * norm);
                    ctx.globalAlpha = Math.sqrt(norm);
                    ctx.drawImage(whiteCore ? whiteSprite : glowSprites[c], (x - gs) | 0, (y - gs) | 0, (gs * 2) | 0, (gs * 2) | 0);
                }

                // Star overlay: independent white stars with the full star
                // effect (beams + core). The forward core runs bigger and
                // hotter than base bulbs - a star flare should dominate
                // its bulb - drawn twice (halo + concentrated core).
                if (overlayNorm >= 0.02) {
                    const oa = Math.sqrt(overlayNorm);
                    if (hasBeams && overlayNorm >= 0.05) {
                        if (curvedBeams) {
                            let g = this._beamGradWhite[v];
                            if (g === undefined) {
                                g = ctx.createRadialGradient(x, y, 0, x, y, beamGradR[v]);
                                g.addColorStop(0, 'rgba(240,248,255,0.95)');
                                g.addColorStop(0.35, 'rgba(240,248,255,0.45)');
                                g.addColorStop(1, 'rgba(240,248,255,0)');
                                this._beamGradWhite[v] = g;
                            }
                            ctx.strokeStyle = g;
                            ctx.globalAlpha = oa * beamAlpha;
                            ctx.lineWidth = beamBaseW * beamWScale[v];
                            ctx.stroke(beamPaths[v]);
                        } else {
                            ctx.globalAlpha = oa * beamAlpha;
                            ctx.drawImage(this._whiteBeamSprite, (x - beamL - 1) | 0, (y - beamL - 1) | 0);
                        }
                    }
                    const os = glowR * 1.35 * (0.4 + 0.6 * overlayNorm);
                    ctx.globalAlpha = Math.min(1, oa * 1.25);
                    ctx.drawImage(whiteSprite, (x - os) | 0, (y - os) | 0, (os * 2) | 0, (os * 2) | 0);
                    const oc = os * 0.5;
                    ctx.globalAlpha = oa;
                    ctx.drawImage(whiteSprite, (x - oc) | 0, (y - oc) | 0, (oc * 2) | 0, (oc * 2) | 0);
                }
            }
            ctx.restore();
        }
    }
}
