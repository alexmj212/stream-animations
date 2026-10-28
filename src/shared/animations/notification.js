/**
 * Notifications toast timeline: pure functions of time, unit-tested in
 * tests/notifications/notification.test.js.
 *
 * Every layer grows out of the follower bar to its full length, holds still,
 * then shrinks back. Lengths come from cubic Hermite segments: each one leaves
 * fast (twice the average speed) and settles to a stop for the hold, then
 * leaves the hold at rest and speeds up on the way home, so the hold
 * hand-offs are velocity-matched at zero.
 */
import { hermite, easings } from '../motion.js';

/**
 * Default toast duration for a line of text: the configured default, or
 * longer when the text needs more hold time at the reading pace.
 * @param {string} text
 * @param {Object} timing - config.notifications.timing
 * @returns {number} ms
 */
export function notificationDurationMs(text, timing) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const holdMs = Math.max(timing.minHoldMs, words * timing.msPerWord);
    const holdShare = 1 - timing.inProportion - timing.outProportion;
    // The text shows for the bar's whole hold, fades included
    const neededMs = holdMs / holdShare;
    return Math.max(timing.defaultDurationMs, Math.ceil(neededMs / 100) * 100);
}

/**
 * Phase boundaries (seconds) for each layer. The gradient ("lead") leads out
 * and comes home last; the body trails it out and goes home first; the text
 * shows only while both are fully out. Everything ends at T.
 * @param {number} durationMs
 * @param {Object} timing - config.notifications.timing
 * @param {number} [wipeMs=0] - Write the text in with a sweep this long instead of a fade
 * @returns {{T: number, lead: Segment, body: Segment, text: {inStart: number, inEnd: number, outStart: number, outEnd: number}}}
 *   Segment = {inStart, inEnd, outStart, outEnd}
 */
export function planNotificationTimeline(durationMs, timing, wipeMs = 0) {
    const T = durationMs / 1000;
    const inT = T * timing.inProportion;
    const outT = T * timing.outProportion;
    const lag = timing.lagProportion;
    const outStart = T - outT;
    const lead = { inStart: 0, inEnd: inT * (1 - lag), outStart: outStart + outT * lag, outEnd: T };
    const body = { inStart: inT * lag, inEnd: inT, outStart, outEnd: T - outT * lag };
    // Fades never take more than a quarter of the hold each. With a wipe,
    // the text is written in by the sweep instead of fading in
    const hold = outStart - inT;
    const fade = Math.min(timing.textFadeMs / 1000, hold / 4);
    const textIn = wipeMs > 0 ? Math.min(wipeMs / 1000, hold / 4) : fade;
    const text = { inStart: inT, inEnd: inT + textIn, outStart: outStart - fade, outEnd: outStart };
    return { T, lead, body, text };
}

/**
 * Length of a layer at time t: 0 before it starts, out to `length` and back.
 * @param {{inStart: number, inEnd: number, outStart: number, outEnd: number}} seg
 * @param {number} length - Full length (px)
 * @param {number} t - Seconds since the toast started
 * @returns {number} px
 */
export function extentAt(seg, length, t) {
    if (t <= seg.inStart || t >= seg.outEnd) return 0;
    if (t < seg.inEnd) {
        const d = seg.inEnd - seg.inStart;
        return hermite(0, length, 2 * length / d, 0, d, t - seg.inStart);
    }
    if (t <= seg.outStart) return length;
    const d = seg.outEnd - seg.outStart;
    return hermite(length, 0, 0, -2 * length / d, d, t - seg.outStart);
}

/**
 * Text opacity (0-1) and its x offset (px, slides in from the left).
 * @param {{inStart: number, inEnd: number, outStart: number, outEnd: number}} seg
 * @param {number} slidePx
 * @param {number} t - Seconds since the toast started
 * @returns {{alpha: number, dx: number}}
 */
export function textStateAt(seg, slidePx, t) {
    if (t <= seg.inStart || t >= seg.outEnd) return { alpha: 0, dx: -slidePx };
    if (t < seg.inEnd) {
        const p = easings.easeOutCubic((t - seg.inStart) / (seg.inEnd - seg.inStart));
        return { alpha: p, dx: -slidePx * (1 - p) };
    }
    if (t <= seg.outStart) return { alpha: 1, dx: 0 };
    return { alpha: 1 - easings.easeInCubic((t - seg.outStart) / (seg.outEnd - seg.outStart)), dx: 0 };
}

/**
 * Front of a streak at time t (px, screen x). A streak leaves the follower
 * bar fast, settles into a slow drift at `rest`, then curves out of the
 * drift and speeds back home to `home`. Velocity-matched at both hand-offs.
 * @param {{home: number, rest: number, drift: number, inStart: number, inEnd: number,
 *   outStart: number, outEnd: number}} s - drift in px/s; times in seconds
 * @param {number} t - Seconds since the toast started
 * @returns {number} px
 */
export function streakFrontAt(s, t) {
    if (t <= s.inStart || t >= s.outEnd) return s.home;
    if (t < s.inEnd) {
        const d = s.inEnd - s.inStart;
        return hermite(s.home, s.rest, 2 * (s.rest - s.home) / d, s.drift, d, t - s.inStart);
    }
    const held = s.rest + s.drift * (Math.min(t, s.outStart) - s.inEnd);
    if (t <= s.outStart) return held;
    const d = s.outEnd - s.outStart;
    return hermite(held, s.home, s.drift, 2 * (s.home - held) / d, d, t - s.outStart);
}

/**
 * How far a scrolling line has moved left at time t: still for `pause` s
 * after the text is in, a smoothstep glide over the rest of the hold, still
 * for `pause` s before the text goes. 0 when nothing needs to scroll.
 * @param {{inEnd: number, outStart: number}} seg - text segment
 * @param {number} scrollPx - how much wider the line is than its room
 * @param {number} pause - seconds still at each end
 * @param {number} t - Seconds since the toast started
 * @returns {number} px (0 to scrollPx)
 */
export function scrollOffsetAt(seg, scrollPx, pause, t) {
    if (scrollPx <= 0) return 0;
    const a = seg.inEnd + pause;
    const b = Math.max(a, seg.outStart - pause);
    if (t <= a) return 0;
    if (t >= b) return scrollPx;
    const p = (t - a) / (b - a);
    return scrollPx * p * p * (3 - 2 * p);
}

/**
 * Extra bar length (px at 1920 wide) a line needs: enough for it to fit at
 * full size, capped so the bar's front stops at maxEndX. The bar grows
 * before the text shrinks.
 * @param {number} width - the line's width at full size (px)
 * @param {number} room - room for text in the standard bar (px)
 * @param {number} maxExtra - most the bar may grow (px)
 * @returns {number} px, 0 when the line already fits
 */
export function extraLengthFor(width, room, maxExtra) {
    return Math.max(0, Math.min(Math.ceil(width - room), maxExtra));
}

/**
 * Position of the light band that writes the text in: from `from` to `to`
 * (px) between seg.inStart and seg.inEnd, starting and ending at rest.
 * @param {{inStart: number, inEnd: number}} seg
 * @param {number} from
 * @param {number} to
 * @param {number} t - Seconds since the toast started
 * @returns {number|null} px, or null when the band isn't sweeping
 */
export function wipeAt(seg, from, to, t) {
    if (t <= seg.inStart || t >= seg.inEnd) return null;
    return hermite(from, to, 0, 0, seg.inEnd - seg.inStart, t - seg.inStart);
}
