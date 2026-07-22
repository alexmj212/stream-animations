/**
 * Pure lighting functions for the EPCOT Spaceship Earth scene.
 *
 * Everything here is plain math (no canvas/DOM), so light placement,
 * pattern functions, and the shading formula are all unit-testable without
 * a canvas (see tests/epcot/lighting.test.js).
 */

import { hslToRgb } from '../shared/colors.js';

/**
 * Compute the four corner light positions, each pushed slightly outside the
 * canvas bounds and raised above the surface plane (z ≈ zHeightRatio * width).
 *
 * Order is clockwise starting top-left, matching the pattern functions below:
 * [0] top-left, [1] top-right, [2] bottom-right, [3] bottom-left.
 *
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} marginRatio - Fraction beyond each corner (e.g. 0.05 = 5%)
 * @param {number} zHeightRatio - Light height as a fraction of canvas width
 * @returns {Array<{x:number,y:number,z:number}>} 4 light positions
 */
export function cornerLightPositions(width, height, marginRatio = 0.05, zHeightRatio = 0.35) {
  const mx = width * marginRatio;
  const my = height * marginRatio;
  const z = width * zHeightRatio;

  return [
    { x: -mx, y: -my, z },                    // top-left
    { x: width + mx, y: -my, z },              // top-right
    { x: width + mx, y: height + my, z },      // bottom-right
    { x: -mx, y: height + my, z }              // bottom-left
  ];
}

/**
 * Distance falloff radius used for light attenuation: att = 1 / (1 + (d/falloff)^2)
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} falloffRatio - Fraction of the canvas diagonal (e.g. 0.45)
 * @returns {number} Falloff distance in pixels
 */
export function lightFalloff(width, height, falloffRatio = 0.45) {
  return Math.hypot(width, height) * falloffRatio;
}

/**
 * Derive the four corner light colors from the scene's base color by
 * applying a per-corner hue offset, so each corner's reflection is visually
 * distinguishable from the others.
 *
 * @param {{h:number,s:number,l:number}} baseHSL - Scene base color
 * @param {number[]} hueOffsets - Per-corner hue offset in degrees, e.g. [-20,0,20,40]
 * @returns {Array<{r:number,g:number,b:number}>} 4 RGB colors (0..1 floats)
 */
export function computeLightColors(baseHSL, hueOffsets = [-20, 0, 20, 40]) {
  return hueOffsets.map((offset) => hslToRgb(baseHSL.h + offset, baseHSL.s, baseHSL.l));
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

const PATTERNS = {
  chase: chasePattern,
  pulse: pulsePattern,
  diagonal: diagonalPattern
};

/**
 * Look up a pattern function by name, falling back to `chase`.
 * @param {string} name - 'chase' | 'pulse' | 'diagonal'
 * @returns {Function} Pattern function (t, cycleDuration) => number[4]
 */
export function getPattern(name) {
  return PATTERNS[name] || chasePattern;
}

/**
 * Shade a single facet: ambient + per-light diffuse + Blinn-Phong specular,
 * with distance attenuation. Writes the result (0..255, clamped) into `out`
 * and returns it, so callers can reuse a single scratch buffer per frame and
 * avoid allocating in the hot per-facet loop.
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
 * @param {Float32Array} lights - Flat [x,y,z,r,g,b,intensity] * 4
 * @param {number} baseR - Base color red, 0..1
 * @param {number} baseG - Base color green, 0..1
 * @param {number} baseB - Base color blue, 0..1
 * @param {number} ambient - Ambient contribution, 0..1 (e.g. 0.08)
 * @param {number} shininess - Blinn-Phong specular exponent
 * @param {number} falloff - Distance falloff radius (see lightFalloff)
 * @param {Float32Array|number[]} out - Length-3 buffer to receive [r,g,b] in 0..255
 * @returns {Float32Array|number[]} `out`, filled with the clamped RGB color
 */
export function shadeFacet(nx, ny, nz, fx, fy, fz, lights, baseR, baseG, baseB, ambient, shininess, falloff, out) {
  let r = ambient * baseR;
  let g = ambient * baseG;
  let b = ambient * baseB;

  const falloffSq = falloff * falloff;

  for (let i = 0; i < 4; i++) {
    const o = i * 7;
    const intensity = lights[o + 6];
    if (intensity <= 0) continue;

    const lx = lights[o], ly = lights[o + 1], lz = lights[o + 2];
    const lr = lights[o + 3], lg = lights[o + 4], lb = lights[o + 5];

    let dx = lx - fx, dy = ly - fy, dz = lz - fz;
    const distSq = dx * dx + dy * dy + dz * dz;
    const dist = Math.sqrt(distSq) || 1e-6;
    dx /= dist; dy /= dist; dz /= dist;

    const diffuse = nx * dx + ny * dy + nz * dz;
    if (diffuse <= 0) continue;

    const att = 1 / (1 + distSq / falloffSq);
    const k = intensity * att;

    r += k * diffuse * lr * baseR;
    g += k * diffuse * lg * baseG;
    b += k * diffuse * lb * baseB;

    // Blinn-Phong: H = normalize(L + V), V = (0,0,1)
    let hx = dx, hy = dy, hz = dz + 1;
    const hlen = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1e-6;
    hx /= hlen; hy /= hlen; hz /= hlen;

    const specDot = Math.max(0, nx * hx + ny * hy + nz * hz);
    const spec = Math.pow(specDot, shininess);

    r += k * spec * lr;
    g += k * spec * lg;
    b += k * spec * lb;
  }

  out[0] = Math.min(255, Math.max(0, r * 255));
  out[1] = Math.min(255, Math.max(0, g * 255));
  out[2] = Math.min(255, Math.max(0, b * 255));
  return out;
}
