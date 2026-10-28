/**
 * Palette color layout shared by the stinger, sidebar and shade.
 *
 * AJ (2026-10-28): "i want the same color layout as the illuminations epcot
 * ball on the 3 other animations". The epcot scene's illuminations scheme is
 * a STATIC top-to-bottom gradient through its palette (violet crown down to
 * an amber base). These helpers paint bars from that same screen-fixed
 * gradient: a bar shows the palette color of the screen height it covers, so
 * the scene as a whole reads as the ball's gradient.
 *
 * Pure functions (no DOM) except paletteGradient(), which only needs a 2D
 * context to create the CanvasGradient, and paletteFromURL().
 */
import { hexToHSL, cssColorToHex } from './colors.js';
import { config } from '../config/config.js';

/**
 * Work out how a scene should color itself from its URL params.
 *
 * - ?scheme=mono (or an unknown palette) keeps the single-hue look the
 *   scenes had before palettes: every bar varies around ?color=.
 * - ?scheme=<palette> (default from config) paints the palette gradient.
 *   A passed ?color= then follows `colorMode` (?colormode= overrides):
 *   'shift' rotates every stop's hue so the anchor stop lands on the
 *   color's hue, 'ignore' keeps the palette exact, 'mono' uses the old
 *   single-hue look whenever a color is passed.
 *
 * @param {Object} opts
 * @param {string|null} opts.scheme - ?scheme= value, or null
 * @param {string|null} opts.colorHex - ?color= as 6-digit hex, or null when absent
 * @param {string|null} [opts.colorMode] - ?colormode= value, or null
 * @param {Object<string, string[]>} opts.palettes - palette name -> hex stops, top to bottom
 * @param {Object} opts.defaults - config.palette ({ default, colorMode, anchorIndex, minShiftSaturation })
 * @returns {{scheme: string, stops: Array<{h:number,s:number,l:number}>|null, hueShift: number}}
 *   stops is null for the single-hue look
 */
export function resolvePalette({ scheme, colorHex, colorMode, palettes, defaults }) {
    const name = scheme || defaults.default;
    const mode = colorMode || defaults.colorMode;
    const hexes = palettes[name];
    if (!hexes || name === 'mono' || (mode === 'mono' && colorHex)) {
        return { scheme: 'mono', stops: null, hueShift: 0 };
    }
    let stops = hexes.map(hexToHSL);
    let hueShift = 0;
    if (colorHex && mode === 'shift') {
        const passed = hexToHSL(colorHex);
        // A gray or white color has no meaningful hue: keep the palette
        if (passed.s >= defaults.minShiftSaturation) {
            const anchor = stops[Math.min(defaults.anchorIndex, stops.length - 1)];
            hueShift = wrapHue(passed.h - anchor.h);
            if (hueShift > 180) hueShift -= 360;
            stops = stops.map(c => ({ ...c, h: wrapHue(c.h + hueShift) }));
        }
    }
    return { scheme: name, stops, hueShift };
}

/**
 * Palette color at t (0 = top of the screen, 1 = bottom), interpolating
 * hue along the shorter way round the wheel.
 * @param {Array<{h:number,s:number,l:number}>} stops - top to bottom
 * @param {number} t - 0-1, clamped
 * @returns {{h:number,s:number,l:number}}
 */
export function samplePalette(stops, t) {
    if (stops.length === 1) return { ...stops[0] };
    const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(x));
    const f = x - i;
    const a = stops[i], b = stops[i + 1];
    let dh = b.h - a.h;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    return {
        h: Math.round(wrapHue(a.h + dh * f)),
        s: Math.round(a.s + (b.s - a.s) * f),
        l: Math.round(a.l + (b.l - a.l) * f)
    };
}

/**
 * Adjust every stop the way the single-hue scenes adjust their base color:
 * lightness offset, then the scene's brightness multiplier, with a floor.
 * @param {Array<{h:number,s:number,l:number}>} stops
 * @param {Object} shade
 * @param {number} [shade.dl=0] - lightness offset (percentage points)
 * @param {number} [shade.ds=0] - saturation offset (percentage points)
 * @param {number} [shade.brightness=1] - multiplier applied after dl
 * @param {number} [shade.floor=0] - minimum lightness
 * @returns {Array<{h:number,s:number,l:number}>}
 */
export function shadeStops(stops, { dl = 0, ds = 0, brightness = 1, floor = 0 } = {}) {
    return stops.map(c => ({
        h: c.h,
        s: Math.min(100, Math.max(0, c.s + ds)),
        l: Math.round(Math.min(100, Math.max(floor, (c.l + dl) * brightness)))
    }));
}

/**
 * Gradient endpoints, in a bar's local drawing space, that run from the top
 * of the screen (y = 0) to the bottom (y = screenHeight). Lines of equal
 * color are horizontal on screen whatever the bar's transform, so every bar
 * shows the same screen-fixed palette.
 *
 * Slanted bars draw after translate(x, y) + rotate(angle): local point
 * s * (sin a, cos a) lands s px below y on screen. Horizontal bars draw
 * after translate(x, y) + a horizontal skew, which leaves local y as screen
 * y minus y.
 *
 * @param {'slanted'|'horizontal'} type
 * @param {number} angleDeg - rotation (slanted) or skew (horizontal), degrees
 * @param {number} y - the bar's translate y
 * @param {number} screenHeight
 * @returns {[number, number, number, number]} x0, y0, x1, y1
 */
export function screenGradientLine(type, angleDeg, y, screenHeight) {
    if (type === 'slanted') {
        const rad = angleDeg * Math.PI / 180;
        const sin = Math.sin(rad), cos = Math.cos(rad);
        return [-y * sin, -y * cos, (screenHeight - y) * sin, (screenHeight - y) * cos];
    }
    return [0, -y, 0, screenHeight - y];
}

/**
 * CanvasGradient through every stop, evenly spaced.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{h:number,s:number,l:number}>} stops
 * @param {[number, number, number, number]} line - from screenGradientLine()
 * @param {number} [alpha=1] - baked into the stops (hsla, not globalAlpha)
 * @returns {CanvasGradient}
 */
export function paletteGradient(ctx, stops, line, alpha = 1) {
    const g = ctx.createLinearGradient(line[0], line[1], line[2], line[3]);
    const n = stops.length - 1 || 1;
    stops.forEach((c, i) => g.addColorStop(i / n, `hsla(${c.h}, ${c.s}%, ${c.l}%, ${alpha})`));
    return g;
}

function wrapHue(h) {
    return ((h % 360) + 360) % 360;
}

/**
 * resolvePalette() for the current page's ?scheme=, ?color= and ?colormode=.
 * @param {string} [search=window.location.search]
 * @returns {{scheme: string, stops: Array<{h:number,s:number,l:number}>|null, hueShift: number}}
 */
export function paletteFromURL(search = window.location.search) {
    const params = new URLSearchParams(search);
    const color = params.get('color');
    return resolvePalette({
        scheme: params.get('scheme'),
        colorHex: color ? cssColorToHex(color) : null,
        colorMode: params.get('colormode'),
        palettes: config.epcot.palettes,
        defaults: config.palette
    });
}
