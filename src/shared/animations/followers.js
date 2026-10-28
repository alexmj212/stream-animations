/**
 * Follower-goal bar math: pure functions of the count, the goal and time,
 * so the scene (src/followers/) only holds state and draws.
 */

/**
 * The goal to show for a count. With a step, a reached goal rolls on to
 * the next multiple of the step above the count; without one it stays put
 * (the bar then shows full and the count past the goal).
 * @param {number} count - Current followers
 * @param {number} goal - Configured goal (?goal=)
 * @param {number} [step=0] - Roll-on step (?goalstep=); 0 = never roll on
 * @returns {number}
 */
export function goalFor(count, goal, step = 0) {
    if (!(step > 0) || count < goal) return goal;
    return (Math.floor(count / step) + 1) * step;
}

/**
 * Share of the goal reached, clamped to 0..1.
 * @param {number} count
 * @param {number} goal
 * @returns {number}
 */
export function progressFraction(count, goal) {
    if (!(goal > 0)) return 0;
    return Math.min(1, Math.max(0, count / goal));
}

/** Ease-out cubic: fast start, gentle landing (docs/MOTION.md). */
export function easeOutCubic(p) {
    const q = 1 - Math.min(1, Math.max(0, p));
    return 1 - q * q * q;
}

/** Ease-in-out cubic. */
export function easeInOutCubic(p) {
    const x = Math.min(1, Math.max(0, p));
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Timeline of one count change, in seconds from its start. The sweep (a
 * light band along the bar) runs first; the fill and the number follow it
 * so the new count lands as the band reaches the bar's front.
 * @param {Object} timing - config.followers.timing
 * @returns {{sweepEnd: number, fillStart: number, fillEnd: number, T: number}}
 */
export function planChange(timing) {
    const sweepEnd = timing.sweepMs / 1000;
    const fillStart = timing.fillDelayMs / 1000;
    const fillEnd = fillStart + timing.fillMs / 1000;
    return { sweepEnd, fillStart, fillEnd, T: Math.max(sweepEnd, fillEnd) };
}

/**
 * Value shown while ticking from one count to the next: whole numbers,
 * eased, landing exactly on `to`.
 * @param {number} from
 * @param {number} to
 * @param {Object} plan - planChange()
 * @param {number} t - Seconds since the change
 * @returns {number}
 */
export function countAt(from, to, plan, t) {
    if (t >= plan.fillEnd) return to;
    if (t <= plan.fillStart) return from;
    const p = easeOutCubic((t - plan.fillStart) / (plan.fillEnd - plan.fillStart));
    return Math.round(from + (to - from) * p);
}

/**
 * Fill fraction while growing (or shrinking) between two fractions.
 * @param {number} from - 0..1
 * @param {number} to - 0..1
 * @param {Object} plan - planChange()
 * @param {number} t - Seconds since the change
 * @returns {number}
 */
export function fillAt(from, to, plan, t) {
    if (t >= plan.fillEnd) return to;
    if (t <= plan.fillStart) return from;
    return from + (to - from) * easeInOutCubic((t - plan.fillStart) / (plan.fillEnd - plan.fillStart));
}

/**
 * Where the sweep band's leading edge is, as a share of the bar's travel
 * (0 = behind the left end, 1 = past the right end), or null when done.
 * @param {Object} plan - planChange()
 * @param {number} t - Seconds since the change
 * @returns {number|null}
 */
export function sweepAt(plan, t) {
    if (t < 0 || t >= plan.sweepEnd) return null;
    return easeInOutCubic(t / plan.sweepEnd);
}

/**
 * Read a follower count out of a Mix It Up Developer API counter response
 * (GET /api/v2/counters/{name} answers {"Counter": {"Name", "Amount"}}, MIU
 * 1.8.203, 2026-10-28), a flat {Amount}, or a bare number. Null when unusable.
 * @param {*} body - Parsed JSON
 * @returns {number|null}
 */
export function parseCount(body) {
    if (typeof body === 'object' && body !== null && typeof body.Counter === 'object') body = body.Counter;
    const raw = typeof body === 'object' && body !== null
        ? (body.Amount ?? body.amount ?? body.Value ?? body.value)
        : body;
    // Number('') is 0: an empty ?count= must not read as zero followers
    const n = typeof raw === 'string' ? (raw.trim() === '' ? null : Number(raw.trim())) : raw;
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * Delay before the next poll: the normal interval while it works, backing
 * off (doubling, capped) after failures so a closed MIU costs nothing.
 * @param {number} failures - Consecutive failed polls
 * @param {number} intervalMs
 * @param {number} maxMs
 * @returns {number}
 */
export function pollDelay(failures, intervalMs, maxMs) {
    if (failures <= 0) return intervalMs;
    return Math.min(maxMs, intervalMs * Math.pow(2, failures));
}

/**
 * Text for the bar, e.g. "946 / 1000 GOOBERS".
 * @param {number} count
 * @param {number} goal
 * @param {string} label
 * @returns {string}
 */
export function goalText(count, goal, label) {
    return `${count} / ${goal}${label ? ` ${label}` : ''}`;
}
