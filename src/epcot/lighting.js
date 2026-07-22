/**
 * Pure lighting functions for the EPCOT Spaceship Earth scene.
 *
 * Everything here is plain math (no canvas/DOM), so the corner-weight
 * field, pattern functions, and the shading formula are all unit-testable
 * without a canvas (see tests/epcot/lighting.test.js).
 */

import { hslToRgb } from '../shared/colors.js';

/**
 * Derive the four "corner" reference colors from the scene's base color by
 * applying a per-corner hue offset, so each corner's influence is visually
 * distinguishable from the others as it sweeps across vertex lights.
 *
 * Order is clockwise starting top-left: [0] top-left, [1] top-right,
 * [2] bottom-right, [3] bottom-left - matching the pattern functions below
 * and computeCornerWeights().
 *
 * @param {{h:number,s:number,l:number}} baseHSL - Scene base color
 * @param {number[]} hueOffsets - Per-corner hue offset in degrees, e.g. [-20,0,20,40]
 * @returns {Array<{r:number,g:number,b:number}>} 4 RGB colors (0..1 floats)
 */
export function computeLightColors(baseHSL, hueOffsets = [-20, 0, 20, 40]) {
  return hueOffsets.map((offset) => hslToRgb(baseHSL.h + offset, baseHSL.s, baseHSL.l));
}

/**
 * Weights expressing how much each of the 4 screen corners (TL, TR, BR, BL)
 * "reaches" a point at (x,y), used to blend the pattern's 4 corner
 * intensities/colors into every vertex light. Deliberately a *sharp*
 * Gaussian falloff of physical distance (not a linear bilinear blend):
 * with a linear blend, every point on screen gets a meaningful contribution
 * from every corner at all times, which reads as a single soft "spotlight"
 * gradient washing the whole surface rather than distinct lights near the
 * active corner(s) blooming and fading as the pattern sweeps past them.
 * A tight Gaussian keeps far corners' contribution close to zero, so only
 * vertices genuinely near an active corner light up - individual glints,
 * not a floodlight - while still being a smooth, continuous falloff and
 * a true partition of unity (the 4 weights always sum to exactly 1).
 *
 * @param {number} x - Point x
 * @param {number} y - Point y
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} falloffRatio - Gaussian falloff radius, as a fraction of the canvas diagonal (smaller = sharper/more localized)
 * @param {number[]|Float32Array} [out] - Optional length-4 buffer to write into; defaults to a fresh array
 * @returns {number[]|Float32Array} `out`, filled with [wTL, wTR, wBR, wBL], summing to 1
 */
export function computeCornerWeights(x, y, width, height, falloffRatio = 0.22, out = [0, 0, 0, 0]) {
  const diag = Math.hypot(width, height) || 1;
  const sigma = Math.max(diag * falloffRatio, 1e-3);
  const twoSigmaSq = 2 * sigma * sigma;

  const cornerX = [0, width, width, 0];
  const cornerY = [0, 0, height, height];

  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const dx = x - cornerX[i];
    const dy = y - cornerY[i];
    const w = Math.exp(-(dx * dx + dy * dy) / twoSigmaSq);
    out[i] = w;
    sum += w;
  }

  for (let i = 0; i < 4; i++) {
    out[i] = sum > 0 ? out[i] / sum : 0.25;
  }
  return out;
}

/**
 * Chase pattern: corners light up one at a time, clockwise, with a smooth
 * crossfade between neighbors. Implemented as raised-cosine ("cos^2") pulses
 * spaced a quarter-cycle apart; because each pulse's half-width exactly
 * equals the spacing between centers, at every instant the two nearest
 * pulses satisfy cos^2(x) + sin^2(x) = 1, so the four intensities sum to
 * *exactly* 1 at all times (not just approximately) while still reading as
 * a smooth, smoothstep-like sweep.
 *
 * @param {number} t - Elapsed time in seconds
 * @param {number} cycleDuration - Full cycle duration in seconds
 * @param {number[]|Float32Array} [out] - Optional length-4 buffer to write into (avoids allocating in the hot path); defaults to a fresh array so callers/tests can use it without one
 * @returns {number[]|Float32Array} `out`, filled with 4 intensities in [0,1], summing to ~1
 */
export function chasePattern(t, cycleDuration, out = [0, 0, 0, 0]) {
  const phase = (((t / cycleDuration) % 1) + 1) % 1;

  for (let i = 0; i < 4; i++) {
    const center = i / 4;
    let d = Math.abs(phase - center);
    if (d > 0.5) d = 1 - d;
    out[i] = d < 0.25 ? Math.cos((d / 0.25) * (Math.PI / 2)) ** 2 : 0;
  }

  return out;
}

/**
 * Pulse pattern: all four corners breathe (sine 0..1), phase-offset by a
 * quarter cycle each so they don't move in lockstep.
 *
 * @param {number} t - Elapsed time in seconds
 * @param {number} cycleDuration - Full cycle duration in seconds
 * @param {number[]|Float32Array} [out] - Optional length-4 buffer to write into (avoids allocating in the hot path); defaults to a fresh array so callers/tests can use it without one
 * @returns {number[]|Float32Array} `out`, filled with 4 intensities in [0,1]
 */
export function pulsePattern(t, cycleDuration, out = [0, 0, 0, 0]) {
  const base = (2 * Math.PI * t) / cycleDuration;

  for (let i = 0; i < 4; i++) {
    out[i] = Math.sin(base + i * (Math.PI / 2)) * 0.5 + 0.5;
  }

  return out;
}

/**
 * Diagonal pattern: opposite corner pairs (top-left/bottom-right vs
 * top-right/bottom-left) alternate.
 *
 * @param {number} t - Elapsed time in seconds
 * @param {number} cycleDuration - Full cycle duration in seconds
 * @param {number[]|Float32Array} [out] - Optional length-4 buffer to write into (avoids allocating in the hot path); defaults to a fresh array so callers/tests can use it without one
 * @returns {number[]|Float32Array} `out`, filled with 4 intensities in [0,1]
 */
export function diagonalPattern(t, cycleDuration, out = [0, 0, 0, 0]) {
  const a = Math.sin((2 * Math.PI * t) / cycleDuration) * 0.5 + 0.5;
  const b = 1 - a;
  out[0] = a; out[1] = b; out[2] = a; out[3] = b;
  return out;
}

/**
 * Wave field: a soft diagonal band of light sweeping across the surface,
 * like the rolling washes on the real ball. Field patterns are evaluated
 * per-vertex (not per-corner): given a vertex's normalized projection along
 * the sweep direction (0..1, precomputed at rebuild), returns that vertex's
 * intensity in [0,1]. Every bulb is driven by the same formula - brightness
 * differences come only from where the band currently is.
 *
 * @param {number} proj - Vertex's normalized position along the sweep axis (0..1)
 * @param {number} t - Elapsed time in seconds
 * @param {number} cycleDuration - Full cycle duration in seconds
 * @param {number} bandWidth - Band half-width in normalized units (e.g. 0.16)
 * @returns {number} Intensity in [0,1]
 */
export function waveField(proj, t, cycleDuration, bandWidth = 0.16) {
  const phase = (((t / cycleDuration) % 1) + 1) % 1;
  // Sweep travels beyond both edges so the band fully exits before re-entering
  const center = -bandWidth + phase * (1 + 2 * bandWidth);
  const d = Math.abs(proj - center);
  return d < bandWidth ? Math.cos((d / bandWidth) * (Math.PI / 2)) ** 2 : 0;
}

/**
 * Radial field: concentric rings of light expanding outward from the canvas
 * center. Given a vertex's normalized distance from center (0..1 at the far
 * corner, precomputed at rebuild), returns intensity in [0,1].
 *
 * @param {number} dist - Vertex's normalized distance from canvas center (0..1)
 * @param {number} t - Elapsed time in seconds
 * @param {number} cycleDuration - Full cycle duration in seconds
 * @param {number} ringCount - Number of simultaneous rings across the radius
 * @param {number} ringWidth - Ring half-width as a fraction of ring spacing
 * @returns {number} Intensity in [0,1]
 */
export function radialField(dist, t, cycleDuration, ringCount = 2, ringWidth = 0.18) {
  const phase = (((t / cycleDuration) % 1) + 1) % 1;
  // Fractional position within the repeating ring lattice, moving outward
  let p = (dist * ringCount - phase * ringCount) % 1;
  if (p < 0) p += 1;
  const d = Math.min(p, 1 - p); // wrapped distance to nearest ring center
  return d < ringWidth ? Math.cos((d / ringWidth) * (Math.PI / 2)) ** 2 : 0;
}

const PATTERNS = {
  chase: chasePattern,
  pulse: pulsePattern,
  diagonal: diagonalPattern
};

// Field patterns are driven per-vertex by position, not by the 4-corner
// blend; EpcotSurface branches on this to pick the evaluation path.
const FIELD_PATTERNS = new Set(['wave', 'radial']);

/**
 * Whether a pattern name is a per-vertex field pattern (wave/radial) rather
 * than a corner-blend pattern (chase/pulse/diagonal).
 * @param {string} name - Pattern name
 * @returns {boolean}
 */
export function isFieldPattern(name) {
  return FIELD_PATTERNS.has(name);
}

/**
 * Look up a pattern function by name, falling back to `chase`.
 * @param {string} name - 'chase' | 'pulse' | 'diagonal'
 * @returns {Function} Pattern function (t, cycleDuration, out?) => number[4]
 */
export function getPattern(name) {
  return PATTERNS[name] || chasePattern;
}

/**
 * Shade a single facet: ambient + diffuse + Blinn-Phong specular from its
 * own 3 base-triangle vertex lights, with SHORT-range distance attenuation
 * (each vertex light is a local glint, not a floodlight). Writes the result
 * (0..255, clamped) into `out` and returns it, so callers can reuse a
 * single scratch buffer per frame and avoid allocating in the hot
 * per-facet loop.
 *
 * View vector is fixed at (0,0,1) (orthographic camera looking along -z).
 * Specular is skipped per-light when that light's diffuse term is <= 0
 * (facet facing away from the light), both for correctness (no unphysical
 * specular behind the terminator) and performance.
 *
 * @param {number} nx - Facet normal x
 * @param {number} ny - Facet normal y
 * @param {number} nz - Facet normal z
 * @param {number} fx - Facet centroid x (world)
 * @param {number} fy - Facet centroid y (world)
 * @param {number} fz - Facet centroid z (world)
 * @param {Float32Array} vertexLights - Flat [x,y,z,r,g,b,intensity] per unique lattice vertex
 * @param {Int32Array} lightIdx - Flat array of vertex-light indices (gathered per triangle)
 * @param {number} start - First index into lightIdx for this facet's triangle
 * @param {number} count - Number of lights to gather
 * @param {number} baseR - Base color red, 0..1
 * @param {number} baseG - Base color green, 0..1
 * @param {number} baseB - Base color blue, 0..1
 * @param {number} ambient - Ambient contribution, 0..1 (e.g. 0.08)
 * @param {number} shininess - Blinn-Phong specular exponent
 * @param {number} falloff - Distance falloff radius, short (~1 triangle size)
 * @param {number} diffuseWeight - Diffuse contribution weight; metals are specular-dominant, so this stays well below 1
 * @param {number} specularWeight - Specular contribution weight; the main driver of the metallic read
 * @param {Float32Array|number[]} out - Length-3 buffer to receive [r,g,b] in 0..255 (NOT clamped high - callers clamp after the bounce pass so bounce sees true energy)
 * @returns {Float32Array|number[]} `out`, filled with the RGB color (floor-clamped at 0 only)
 */
export function shadeFacet(nx, ny, nz, fx, fy, fz, vertexLights, lightIdx, start, count, baseR, baseG, baseB, ambient, shininess, falloff, diffuseWeight, specularWeight, out, shadows) {
  let r = ambient * baseR;
  let g = ambient * baseG;
  let b = ambient * baseB;

  const falloffSq = falloff * falloff;

  for (let k = 0; k < count; k++) {
    const li = lightIdx[start + k];
    const o = li * 7;
    let intensity = vertexLights[o + 6];
    if (intensity <= 0) continue;
    if (shadows) intensity *= shadows[start + k];

    const lx = vertexLights[o], ly = vertexLights[o + 1], lz = vertexLights[o + 2];
    const lr = vertexLights[o + 3], lg = vertexLights[o + 4], lb = vertexLights[o + 5];

    let dx = lx - fx, dy = ly - fy, dz = lz - fz;
    const distSq = dx * dx + dy * dy + dz * dz;
    const dist = Math.sqrt(distSq) || 1e-6;
    dx /= dist; dy /= dist; dz /= dist;

    const diffuse = nx * dx + ny * dy + nz * dz;
    if (diffuse <= 0) continue;

    const att = 1 / (1 + distSq / falloffSq);
    const k2 = intensity * att;

    const kd = k2 * diffuse * diffuseWeight;
    r += kd * lr * baseR;
    g += kd * lg * baseG;
    b += kd * lb * baseB;

    // Blinn-Phong: H = normalize(L + V), V = (0,0,1)
    let hx = dx, hy = dy, hz = dz + 1;
    const hlen = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1e-6;
    hx /= hlen; hy /= hlen; hz /= hlen;

    const specDot = Math.max(0, nx * hx + ny * hy + nz * hz);
    const spec = Math.pow(specDot, shininess) * specularWeight * k2;

    // Metallic reflection: tint the highlight toward the surface color
    // (metals color their reflections; dielectrics don't). Halfway blend
    // keeps hot highlights readable while still clearly "made of" the base.
    r += spec * lr * (0.55 + 0.45 * baseR);
    g += spec * lg * (0.55 + 0.45 * baseG);
    b += spec * lb * (0.55 + 0.45 * baseB);
  }

  out[0] = Math.max(0, r * 255);
  out[1] = Math.max(0, g * 255);
  out[2] = Math.max(0, b * 255);
  return out;
}
