/**
 * Game picker logic, kept pure so it is unit-tested (tests/gamepicker).
 * The dock UI (main.js) only wires these to obs-websocket and the DOM.
 */

/**
 * OBS stores a window as "title:class:exe", with '#' written as "#22" and
 * ':' as "#3A" inside each part (win-capture's window-helpers.c).
 * @param {string} value
 * @returns {{title: string, cls: string, exe: string}}
 */
export function parseWindowValue(value) {
    const decode = s => (s || '').replace(/#3A/g, ':').replace(/#22/g, '#');
    const [title, cls, exe] = String(value || '').split(':');
    return { title: decode(title), cls: decode(cls), exe: decode(exe) };
}

/**
 * The window list to show, from GetInputPropertiesListPropertyItems on the
 * `window` property. Recent executables first (most recent on top), then
 * the rest by executable and title. Ignored executables are dropped unless
 * `showAll`; duplicates (same value) are dropped.
 *
 * @param {Array<{itemName: string, itemValue: string, itemEnabled?: boolean}>} items
 * @param {Object} opts
 * @param {string[]} [opts.ignoreExes] - lower-case executable names
 * @param {string[]} [opts.recents] - lower-case executables, most recent first
 * @param {boolean} [opts.showAll]
 * @param {string} [opts.query] - case-insensitive filter on title or exe
 * @returns {Array<{value: string, title: string, exe: string, cls: string, recent: boolean}>}
 */
export function buildWindowList(items, { ignoreExes = [], recents = [], showAll = false, query = '' } = {}) {
    const ignore = new Set(ignoreExes.map(e => e.toLowerCase()));
    const q = query.trim().toLowerCase();
    const seen = new Set();
    const list = [];
    for (const item of items || []) {
        const value = item.itemValue;
        if (!value || item.itemEnabled === false || seen.has(value)) continue;
        seen.add(value);
        const w = parseWindowValue(value);
        const exe = w.exe.toLowerCase();
        if (!exe) continue;
        if (!showAll && ignore.has(exe)) continue;
        if (q && !w.title.toLowerCase().includes(q) && !exe.includes(q)) continue;
        list.push({ value, ...w, recent: recents.includes(exe) });
    }
    const rank = w => {
        const i = recents.indexOf(w.exe.toLowerCase());
        return i === -1 ? Infinity : i;
    };
    return list.sort((a, b) =>
        rank(a) - rank(b) ||
        a.exe.localeCompare(b.exe, undefined, { sensitivity: 'base' }) ||
        a.title.localeCompare(b.title));
}

/**
 * Which capture shows this executable: 'window' for browsers and anything
 * the hook showed black before, else 'hook' (game capture).
 * @param {string} exe
 * @param {Object} opts
 * @param {string[]} [opts.windowExes] - always window capture
 * @param {Object<string, 'hook'|'window'>} [opts.remembered] - per-exe choice
 * @returns {'hook'|'window'}
 */
export function chooseMethod(exe, { windowExes = [], remembered = {} } = {}) {
    const key = String(exe || '').toLowerCase();
    if (remembered[key] === 'hook' || remembered[key] === 'window') return remembered[key];
    return windowExes.map(e => e.toLowerCase()).includes(key) ? 'window' : 'hook';
}

/**
 * Settings for the capture input that shows `value`.
 * @param {'hook'|'window'} method
 * @param {string} value - "title:class:exe"
 * @param {number} priority - window match priority
 * @returns {Object} inputSettings for SetInputSettings (overlay)
 */
export function captureSettings(method, value, priority) {
    if (method === 'hook') return { capture_mode: 'window', window: value, priority };
    // method 2: Windows 10 (1903 and up), the one that captures browsers
    // without a black picture (the existing Window Capture uses it)
    return { window: value, priority, method: 2 };
}

/**
 * Which scene items to show and hide so only `target` is visible.
 * Every other capture (game, window, capture card, and nested scenes listed
 * as sources) is hidden; items in `keep` are left as they are.
 *
 * @param {Array<{sceneItemId: number, sourceName: string, inputKind?: string|null, sceneItemEnabled: boolean}>} items
 * @param {string} target - source name to show
 * @param {Object} opts
 * @param {string[]} [opts.sources] - the picker's own source names
 * @param {string[]} [opts.keep] - never touched
 * @returns {Array<{sceneItemId: number, sourceName: string, enabled: boolean}>} only the changes
 */
export function visibilityChanges(items, target, { sources = [], keep = [] } = {}) {
    const captureKinds = new Set(['game_capture', 'window_capture', 'monitor_capture']);
    const changes = [];
    for (const it of items || []) {
        if (keep.includes(it.sourceName)) continue;
        const ours = it.sourceName === target || sources.includes(it.sourceName) || captureKinds.has(it.inputKind);
        if (!ours) continue;
        const enabled = it.sourceName === target;
        if (it.sceneItemEnabled !== enabled) changes.push({ sceneItemId: it.sceneItemId, sourceName: it.sourceName, enabled });
    }
    return changes;
}

/**
 * Mean Rec. 601 luma (0-255) of RGBA pixels, alpha ignored.
 * @param {Uint8ClampedArray|number[]} rgba
 * @returns {number}
 */
export function meanLuma(rgba) {
    const n = Math.floor(rgba.length / 4);
    if (n === 0) return 0;
    let sum = 0;
    for (let i = 0; i < n * 4; i += 4) sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    return sum / n;
}

/**
 * Peak level in dBFS across channels from an InputVolumeMeters entry.
 * Each channel is [magnitude, peak, inputPeak] as multipliers (post-fader
 * peak is index 1, what OBS's meter shows).
 * @param {number[][]} inputLevelsMul
 * @param {number} floorDb
 * @returns {number}
 */
export function peakDb(inputLevelsMul, floorDb = -60) {
    let peak = 0;
    for (const ch of inputLevelsMul || []) peak = Math.max(peak, ch?.[1] || 0);
    if (peak <= 0) return floorDb;
    return Math.max(floorDb, 20 * Math.log10(peak));
}

/**
 * OBS's meter zone for a level: green below -20 dBFS, yellow to -9, red above
 * (docs/AUDIO.md "Levels and clipping").
 * @param {number} db
 * @returns {'green'|'yellow'|'red'}
 */
export function meterZone(db) {
    if (db > -9) return 'red';
    if (db >= -20) return 'yellow';
    return 'green';
}

/**
 * Move `exe` to the front of the recents list.
 * @param {string[]} recents
 * @param {string} exe
 * @param {number} max
 * @returns {string[]}
 */
export function pushRecent(recents, exe, max) {
    const key = String(exe || '').toLowerCase();
    if (!key) return recents.slice(0, max);
    return [key, ...recents.filter(e => e !== key)].slice(0, max);
}
