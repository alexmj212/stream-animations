/**
 * Banner lane math (hype train banner, ad warning; issue #85): the lane's
 * geometry, the entrance and the scroll for a line too long for the lane.
 * Pure functions, unit-tested in tests/banner/banner.test.js. The banner
 * stays up for as long as OBS shows it, so after the entrance it only draws
 * for an occasional glint or a scrolling line.
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
 * Screen geometry of the plate for a canvas width (px). The plate is a slab
 * skewed like the toast: x0 and x1 are its ends at mid-height, and the
 * slanted ends reach `lean` either side, so the whole shape, corners
 * included, stays inside the lane box.
 * @param {number} width - Canvas width
 * @param {{x: number, y: number, width: number, height: number}} lane - px on 1920
 * @param {number} skewAngle - degrees (negative leans the top edge right)
 * @returns {{k: number, top: number, height: number, mid: number, x0: number, x1: number,
 *   length: number, lean: number, box: {x: number, y: number, width: number, height: number}}}
 */
export function bannerGeometry(width, lane, skewAngle) {
    const k = width / 1920;
    const height = lane.height * k;
    const top = lane.y * k;
    const lean = Math.abs(Math.tan(skewAngle * Math.PI / 180)) * height / 2;
    const x0 = lane.x * k + lean;
    const x1 = (lane.x + lane.width) * k - lean;
    return {
        k, top, height, mid: top + height / 2, x0, x1, length: x1 - x0, lean,
        box: { x: lane.x * k, y: top, width: lane.width * k, height }
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
 * Entrance at time t: the stripe leads out of the goal bar's end, the plate
 * follows a stagger behind, then the words slide and fade in once the plate
 * has settled. Extents are shares of the plate's length (0-1).
 * @param {number} tMs - Since the banner started
 * @param {{stripeMs: number, plateDelayMs: number, plateMs: number, textDelayMs: number,
 *   textMs: number, textSlidePx: number}} timing
 * @param {Function} ease - 0..1 -> 0..1 (the `enter` ease)
 * @returns {{stripe: number, plate: number, textAlpha: number, textDx: number, done: boolean, textInMs: number}}
 *   textInMs: when the words are fully in (ms)
 */
export function bannerEnterAt(tMs, timing, ease) {
    const clamp = (v) => Math.min(1, Math.max(0, v));
    const plateEnd = timing.plateDelayMs + timing.plateMs;
    const textStart = Math.max(timing.stripeMs, plateEnd) + timing.textDelayMs;
    const textInMs = textStart + timing.textMs;
    const q = ease(clamp((tMs - textStart) / timing.textMs));
    return {
        stripe: ease(clamp(tMs / timing.stripeMs)),
        plate: ease(clamp((tMs - timing.plateDelayMs) / timing.plateMs)),
        textAlpha: q,
        textDx: q >= 1 ? 0 : -timing.textSlidePx * (1 - q),
        done: tMs >= textInMs,
        textInMs
    };
}

/**
 * How far a line wider than its room has scrolled left at time t, looping:
 * still at the start, an eased glide to the end, still, an eased glide
 * back. Each glide starts and ends at rest, so there is never a jump.
 * @param {number} tMs - Since the line arrived
 * @param {number} scrollPx - How much wider the line is than its room
 * @param {{scrollPauseMs: number, scrollPxPerSec: number}} text - config.banner.text
 * @returns {number} px (0 to scrollPx)
 */
export function bannerScrollAt(tMs, scrollPx, text) {
    if (scrollPx <= 0 || tMs <= 0) return 0;
    const pause = text.scrollPauseMs;
    const glide = scrollPx / text.scrollPxPerSec * 1000;
    const cycle = 2 * (pause + glide);
    const c = tMs % cycle;
    const smooth = (p) => p * p * (3 - 2 * p);
    if (c < pause) return 0;
    if (c < pause + glide) return scrollPx * smooth((c - pause) / glide);
    if (c < 2 * pause + glide) return scrollPx;
    return scrollPx * (1 - smooth((c - 2 * pause - glide) / glide));
}

/**
 * Where a glint band's leading edge is, as a share of its travel (0 behind
 * the plate's left end, 1 past its right end), or null when it's over.
 * @param {number} tMs - Since the glint started
 * @param {number} glintMs
 * @returns {number|null}
 */
export function glintAt(tMs, glintMs) {
    if (tMs < 0 || tMs >= glintMs) return null;
    const p = tMs / glintMs;
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}
