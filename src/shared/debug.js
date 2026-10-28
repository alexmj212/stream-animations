/**
 * Shared debug signals for every scene.
 *
 * AJ's rule (2026-10-28): any agent may add signals to the scene code to
 * measure or check whatever it needs, so it can verify without asking AJ.
 * This module is the one convention for that, so every scene and tool reads
 * signals the same way. Off by default: without `?debug=` it returns a no-op
 * and production pages pay nothing.
 *
 * URL:
 *   ?debug=1 | all            every channel
 *   ?debug=events,frames      a comma list of channels
 *   ?debugReport=<url>        also POST each event, and a frame summary every
 *                             60s, to a collector (tools/debug/collect.js), for
 *                             checks inside OBS and long soak runs
 *
 * Channels:
 *   events  timestamped scene events (trigger received, start, end, ...)
 *   frames  frame-time stats: count, mean, max, long frames, gaps
 *   log     echo events to the console as `[scene:debug] name {data}`
 *   build   show the build stamp on screen (drawn by the build script in
 *           vite.config.js; every snapshot carries the stamp regardless)
 *   zones   draw the screen areas other overlays cover (sidebar: where Mix
 *           It Up puts its images, config.sidebar.miuZones)
 *
 * Read it from a page, the harness, Playwright or a CDP client:
 *   window.__debug[scene].snapshot()
 *
 * Adding a signal: call `debug.mark('name', {data})` where it happens. New
 * channels go in DEBUG_CHANNELS and docs/VALIDATION.md.
 */

export const DEBUG_CHANNELS = ['events', 'frames', 'log', 'build', 'zones'];

/** A frame slower than this counts as long (two 60Hz frames, with slack). */
export const LONG_FRAME_MS = 34;

/** A pause longer than this is the scene idling between plays, not a frame. */
export const IDLE_GAP_MS = 1000;

const MAX_EVENTS = 1000;
const REPORT_INTERVAL_MS = 60000;

/** `<meta name="build" content="<version> <sha>">` from the build, or null. */
function buildStamp() {
    if (typeof document === 'undefined') return null;
    return document.querySelector('meta[name="build"]')?.getAttribute('content') ?? null;
}

const NOOP = Object.freeze({
    enabled: false,
    on: () => false,
    mark: () => {},
    frame: () => {},
    snapshot: () => null
});

/**
 * Parse `?debug=` into a Set of channel names. Empty when absent or "0".
 * @param {string} search - location.search
 */
export function debugChannels(search = typeof window !== 'undefined' ? window.location.search : '') {
    const raw = new URLSearchParams(search).get('debug');
    if (raw === null || raw === '' || raw === '0' || raw === 'false') return new Set();
    if (raw === '1' || raw === 'true' || raw === 'all') return new Set(DEBUG_CHANNELS);
    return new Set(raw.split(',').map(s => s.trim()).filter(c => DEBUG_CHANNELS.includes(c)));
}

/**
 * Create the debug recorder for one scene and expose it on
 * `window.__debug[scene]`.
 *
 * @param {string} scene - Scene name (stinger, sidebar, shade, ...)
 * @param {Object} [opts]
 * @param {string} [opts.search] - location.search to read flags from
 * @param {() => number} [opts.now] - Clock in ms (default performance.now)
 * @param {(url: string, body: string) => void} [opts.send] - Report transport
 * @returns {{enabled: boolean, on: (c: string) => boolean, mark: Function, frame: Function, snapshot: Function}}
 */
export function createDebug(scene, opts = {}) {
    const search = opts.search ?? (typeof window !== 'undefined' ? window.location.search : '');
    const channels = debugChannels(search);
    if (channels.size === 0) return NOOP;

    const now = opts.now ?? (() => performance.now());
    const reportUrl = new URLSearchParams(search).get('debugReport');
    const send = opts.send ?? ((url, body) => {
        try {
            fetch(url, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {});
        } catch { /* reporting must never break the scene */ }
    });

    const events = [];
    const frames = { count: 0, totalMs: 0, maxMs: 0, long: 0, gaps: 0 };
    let lastFrameAt = null;
    let lastReportAt = now();

    const report = (kind, payload) => {
        if (!reportUrl) return;
        send(reportUrl, JSON.stringify({ scene, kind, wall: Date.now(), ...payload }));
    };

    const api = {
        enabled: true,
        on: (channel) => channels.has(channel),

        /** Record a named event with optional data. */
        mark(name, data = {}) {
            const event = { t: now(), name, data };
            if (channels.has('events')) {
                events.push(event);
                if (events.length > MAX_EVENTS) events.shift();
                report('event', event);
            }
            if (channels.has('log')) console.log(`[${scene}:debug] ${name}`, data);
        },

        /** Call once per rendered frame with the rAF timestamp. */
        frame(timestamp) {
            if (!channels.has('frames')) return;
            if (lastFrameAt !== null) {
                const dt = timestamp - lastFrameAt;
                if (dt > IDLE_GAP_MS) {
                    frames.gaps++;
                } else {
                    frames.count++;
                    frames.totalMs += dt;
                    if (dt > frames.maxMs) frames.maxMs = dt;
                    if (dt > LONG_FRAME_MS) frames.long++;
                }
            }
            lastFrameAt = timestamp;
            const t = now();
            if (t - lastReportAt >= REPORT_INTERVAL_MS) {
                lastReportAt = t;
                report('frames', { t, frames: api.snapshot().frames });
            }
        },

        /** Plain-object copy of everything recorded so far. */
        snapshot() {
            return {
                scene,
                build: buildStamp(),
                channels: [...channels],
                events: events.slice(),
                frames: {
                    ...frames,
                    meanMs: frames.count ? frames.totalMs / frames.count : 0
                }
            };
        }
    };

    if (typeof window !== 'undefined') {
        window.__debug = window.__debug || {};
        window.__debug[scene] = api;
    }
    api.mark('init', { url: typeof window !== 'undefined' ? window.location.href : '' });
    return api;
}
