/**
 * Banner lane math (hype train banner, ad warning; issue #85): the lane's
 * geometry, the strip's entrance and the marquee scroll. Pure functions,
 * unit-tested in tests/banner/banner.test.js.
 */

/**
 * The ?kind= value, or 'hype' when it's missing or unknown.
 * @param {string|null} requested
 * @param {Object} kinds - config.banner.kinds
 * @returns {string}
 */
export function resolveBannerKind(requested, kinds) {
    const k = (requested || '').trim().toLowerCase();
    return Object.hasOwn(kinds, k) ? k : 'hype';
}

/**
 * The layout for this page size: 'vertical' (the Aitum Vertical canvas)
 * when asked for or when the page is taller than wide, else 'wide'.
 * @param {number} width
 * @param {number} height
 * @param {string|null} requested - ?layout= value ('vertical' | 'wide')
 * @param {Object} banner - config.banner
 * @param {string} [kind] - A kind with its own 16:9 `lane` (the ad) gets it
 * @returns {{name: string, refWidth: number, lane: Object, capPx: number, textClip: ?{x: number, width: number}}}
 */
export function bannerLayout(width, height, requested, banner, kind) {
    const vertical = requested === 'vertical' || (requested !== 'wide' && height > width);
    const own = kind && Object.hasOwn(banner.kinds, kind) ? banner.kinds[kind].lane : null;
    if (!vertical) return { name: 'wide', refWidth: 1920, lane: own || banner.lane, capPx: banner.text.capPx, textClip: null };
    const v = banner.vertical;
    return { name: 'vertical', refWidth: v.refWidth, lane: v.lane, capPx: v.capPx, textClip: v.textClip || null };
}

/**
 * The lane box on a canvas of this width (px).
 * The ends lean by `skewAngle` like the toast's: `lean` is how far the top
 * edge sits right of the mid-height x (and the bottom edge left of it).
 * @param {number} width - Canvas width
 * @param {{x: number, y: number, width: number, height: number, skewAngle?: number}} lane - px on refWidth, x at mid-height
 * @param {number} [refWidth=1920] - Canvas width the lane is measured on
 * @returns {{k: number, x: number, y: number, width: number, height: number, mid: number, lean: number}}
 */
export function bannerGeometry(width, lane, refWidth = 1920) {
    const k = width / refWidth;
    return {
        lean: -Math.tan((lane.skewAngle || 0) * Math.PI / 180) * lane.height * k / 2,
        k,
        x: lane.x * k,
        y: lane.y * k,
        width: lane.width * k,
        height: lane.height * k,
        mid: (lane.y + lane.height / 2) * k
    };
}

/**
 * Font size whose capitals measure `capPx`, from the font's cap height at
 * a known size (measureText('H').actualBoundingBoxAscent).
 * @param {number} capPx - Target cap height (px)
 * @param {number} measuredCap - Cap height measured at `atPx`
 * @param {number} atPx - Size the cap height was measured at
 * @returns {number} px
 */
export function fontPxForCap(capPx, measuredCap, atPx) {
    if (!(measuredCap > 0)) return capPx / 0.7; // Jost's caps are about 0.7em
    return capPx * atPx / measuredCap;
}

/**
 * How much of the strip has wiped in, from the goal bar's end (0-1).
 * @param {number} tMs - Since the banner started
 * @param {number} revealMs
 * @param {Function} ease - 0..1 -> 0..1 (the `enter` ease)
 * @returns {number}
 */
export function revealAt(tMs, revealMs, ease) {
    return ease(Math.min(1, Math.max(0, tMs / revealMs)));
}

/**
 * How far the marquee has scrolled left at time t, within one repeat of the
 * line: a constant speed that wraps every `unitPx`, so the tiled copies
 * join up seamlessly.
 * @param {number} tMs - Since the banner started
 * @param {number} unitPx - Width of one repeat (line plus its gap and separator)
 * @param {number} pxPerSec
 * @returns {number} px, 0 to unitPx
 */
export function marqueeOffsetAt(tMs, unitPx, pxPerSec) {
    if (!(unitPx > 0) || tMs <= 0) return 0;
    return (tMs * pxPerSec / 1000) % unitPx;
}

/**
 * Copies of a repeat needed to fill `width` at any offset.
 * @param {number} width - Lane width (px)
 * @param {number} unitPx
 * @returns {number}
 */
export function marqueeCopies(width, unitPx) {
    return Math.ceil(width / unitPx) + 1;
}

/**
 * Hue of the hype banner's colour at time t. The OBS group swept its Color
 * Correction hue shift from -180 to +180 degrees over 10 s and back again
 * (Move Value filters), so the colour runs through the whole wheel and
 * back: a triangle wave with no jump at either end.
 * @param {number} tMs - Since the banner started
 * @param {{baseHue: number, swingDeg: number, sweepMs: number}} cycle
 * @returns {number} degrees, 0-360
 */
export function hueAt(tMs, cycle) {
    const p = (Math.max(0, tMs) / cycle.sweepMs) % 2;
    const tri = p < 1 ? p : 2 - p;                // 0 -> 1 -> 0
    const shift = -cycle.swingDeg + 2 * cycle.swingDeg * tri;
    return (((cycle.baseHue + shift) % 360) + 360) % 360;
}

/**
 * The banner's opacity one frame on, fading toward 0 while a seam alert
 * plays and back to 1 once it's done, at a constant rate.
 * @param {number} alpha - Now, 0-1
 * @param {boolean} held - An alert holds the seam
 * @param {number} dtMs - Since the last frame
 * @param {number} fadeMs - A full fade
 * @returns {number}
 */
export function yieldAlphaStep(alpha, held, dtMs, fadeMs) {
    const step = fadeMs > 0 ? Math.max(0, dtMs) / fadeMs : 1;
    return held ? Math.max(0, alpha - step) : Math.min(1, alpha + step);
}
