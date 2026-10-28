/**
 * One alert at a time on the vertical canvas's seam (DESIGN.md ALERT-1,
 * issue #81). The portrait toast and sidebar are separate OBS browser
 * sources fired by separate Mix It Up commands, so a follow and a shoutout
 * can load at the same moment and stack on the seam. OBS browser sources
 * share one browser profile, so pages of one origin can take a Web Lock:
 * each alert waits for the one before it to finish, in arrival order.
 */

/** Lock name shared by every page that draws on the seam. */
export const SEAM_LOCK = 'stream-animations:vertical-seam';

/**
 * Play an alert once the seam is free.
 *
 * Without `enabled` (16:9, where the toast and the sidebar don't meet) or
 * without Web Locks, it plays at once. The lock is held until `play()`
 * settles, or `maxHoldMs` at most, so a stalled page can't block the queue
 * (unloading the page frees it too).
 *
 * @param {boolean} enabled - The page draws on the seam (portrait layout)
 * @param {() => Promise<void>} play - Starts the alert; resolves when it ends
 * @param {object} [opts]
 * @param {number} [opts.maxHoldMs=15000] - Longest the lock is held
 * @param {LockManager} [opts.locks] - navigator.locks by default
 * @param {(waitedMs: number) => void} [opts.onStart] - Called as it starts, with the wait
 * @param {() => number} [opts.now] - Clock (ms)
 * @param {typeof setTimeout} [opts.setTimer]
 * @returns {Promise<void>} Resolves when the alert has ended or the hold ran out
 */
export function playOnSeam(enabled, play, {
    maxHoldMs = 15000,
    locks = globalThis.navigator?.locks,
    onStart = () => {},
    now = () => performance.now(),
    setTimer = setTimeout
} = {}) {
    const asked = now();
    const run = () => {
        onStart(now() - asked);
        return Promise.race([
            Promise.resolve().then(play),
            new Promise(resolve => setTimer(resolve, maxHoldMs))
        ]);
    };
    if (!enabled || !locks) return run();
    return locks.request(SEAM_LOCK, run);
}
