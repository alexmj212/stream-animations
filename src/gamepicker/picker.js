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
 * The stored form of a window, the inverse of parseWindowValue.
 * @param {{title: string, cls: string, exe: string}} w
 * @returns {string}
 */
export function windowValue({ title, cls, exe }) {
    const encode = s => (s || '').replace(/#/g, '#22').replace(/:/g, '#3A');
    return `${encode(title)}:${encode(cls)}:${encode(exe)}`;
}

/**
 * What window capture should look for to show a listed window. A Store
 * (UWP) app is listed by its inner CoreWindow, which OBS finds but can't
 * capture; window capture shows it through the frame around it, which
 * ApplicationFrameHost.exe owns and which has the same title (Defiant,
 * 2026-10-30: Realtek Audio Console gave no picture until Window Capture
 * pointed at its outer window). Every Store app shares that class and
 * executable, so the frame is matched by title (WINDOW_PRIORITY_TITLE).
 * @param {string} value - "title:class:exe" from the window list
 * @param {number} priority - the usual match priority
 * @returns {{value: string, priority: number}}
 */
export function windowCaptureTarget(value, priority) {
    const w = parseWindowValue(value);
    if (w.cls !== 'Windows.UI.Core.CoreWindow') return { value, priority };
    return { value: windowValue({ title: w.title, cls: 'ApplicationFrameWindow', exe: 'ApplicationFrameHost.exe' }), priority: 1 };
}

/**
 * One list from both captures' own `window` lists. They differ: the game
 * capture leaves out browsers, Explorer, Discord and other apps it can't
 * hook (win-capture's blacklist), and each lists some windows the other
 * doesn't (AJ, 2026-10-30: the dock showed 3 windows where OBS showed 9,
 * and a Telegram window the window capture couldn't find). Each entry says
 * which capture can see it.
 *
 * @param {Array<{itemValue: string, itemEnabled?: boolean}>} hookItems
 * @param {Array<{itemValue: string, itemEnabled?: boolean}>} windowItems
 * @returns {Array<{itemValue: string, inHook: boolean, inWindow: boolean}>}
 */
export function mergeWindowLists(hookItems, windowItems) {
    const byValue = new Map();
    const add = (items, flag) => {
        for (const item of items || []) {
            if (!item.itemValue || item.itemEnabled === false) continue;
            const e = byValue.get(item.itemValue) || { itemValue: item.itemValue, inHook: false, inWindow: false };
            e[flag] = true;
            byValue.set(item.itemValue, e);
        }
    };
    add(hookItems, 'inHook');
    add(windowItems, 'inWindow');
    return [...byValue.values()];
}

/**
 * Whether two stored windows are the same window: the same value, or the
 * same executable and class (a title like Telegram's "General - (11976)"
 * changes with the unread count; OBS's executable match finds it anyway).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function sameWindow(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const x = parseWindowValue(a), y = parseWindowValue(b);
    return !!x.exe && x.exe.toLowerCase() === y.exe.toLowerCase() && x.cls === y.cls;
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
        list.push({
            value, ...w, recent: recents.includes(exe),
            inHook: item.inHook ?? true, inWindow: item.inWindow ?? true
        });
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
 * Which capture shows this window: a capture that can't see the window is
 * never picked; then a remembered per-exe choice; then window capture.
 * Window capture (Windows Graphics Capture) shows any app; the game hook
 * shows nothing for desktop apps and is only needed for games that window
 * capture shows black (Defiant, 2026-10-30: the hook got nothing for
 * Claude, Steam, Mix It Up, Telegram, Spotify and Realtek; window capture
 * showed all 7 of its windows).
 * @param {string} exe
 * @param {Object} opts
 * @param {Object<string, 'hook'|'window'>} [opts.remembered] - per-exe choice
 * @param {boolean} [opts.inHook] - the game capture lists this window
 * @param {boolean} [opts.inWindow] - the window capture lists this window
 * @returns {'hook'|'window'}
 */
export function chooseMethod(exe, { remembered = {}, inHook = true, inWindow = true } = {}) {
    if (!inHook && inWindow) return 'window';
    if (!inWindow && inHook) return 'hook';
    const key = String(exe || '').toLowerCase();
    if (remembered[key] === 'hook' || remembered[key] === 'window') return remembered[key];
    return 'window';
}

/**
 * Whether a capture check means the picture failed: OBS couldn't render a
 * screenshot (null: a hook that never attached, a hidden or minimised
 * window) or almost no pixel is lit. A failed capture is solid black; a
 * dark app or a night scene still has some lit text or detail (Defiant,
 * 2026-10-30: Realtek Audio Console's dark UI averaged under the old
 * mean-luma bar and was called black).
 * @param {number|null} lit - litFraction of the screenshot, or null when none
 * @param {number} minLit - under this share of lit pixels counts as black
 * @returns {boolean}
 */
export function captureFailed(lit, minLit) {
    return lit === null || lit < minLit;
}

/**
 * Share (0-1) of RGBA pixels with Rec. 601 luma at or over `minLuma`,
 * alpha ignored.
 * @param {Uint8ClampedArray|number[]} rgba
 * @param {number} minLuma - 0-255
 * @returns {number}
 */
export function litFraction(rgba, minLuma) {
    const n = Math.floor(rgba.length / 4);
    if (n === 0) return 0;
    let lit = 0;
    for (let i = 0; i < n * 4; i += 4) {
        if (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2] >= minLuma) lit++;
    }
    return lit / n;
}

/**
 * Name of the dock's audio input for one app and destination, as the OBS
 * mixer shows it: "App Audio: firefox.exe (Music)".
 * @param {string} prefix
 * @param {string} exe
 * @param {string} label - destination label
 * @returns {string}
 */
export function appAudioName(prefix, exe, label) {
    return `${prefix}${exe} (${label})`;
}

/**
 * The app and channel label of an input the dock made, or null for any
 * other input. The label is matched to a channel by the caller, so an input
 * whose channel isn't saved (made by an older dock) still shows.
 * @param {string} name
 * @param {string} prefix
 * @returns {{exe: string, label: string}|null}
 */
export function parseAppAudioName(name, prefix) {
    if (!name || !name.startsWith(prefix)) return null;
    const m = /^(.*) \(([^()]*)\)$/.exec(name.slice(prefix.length));
    return m && m[2] ? { exe: m[1], label: m[2] } : null;
}

/**
 * The filters to copy from a channel's "copy from" source onto an app's
 * audio input: everything but Move filters, which animate that source
 * itself (a music fade, say) and mean nothing on a copy.
 * @param {Array<{filterKind: string}>} filters - GetSourceFilterList
 * @param {string[]} skipKinds
 * @returns {Array}
 */
export function copyableFilters(filters, skipKinds) {
    return (filters || []).filter(f => !skipKinds.includes(f.filterKind));
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
    const target = windowCaptureTarget(value, priority);
    return { window: target.value, priority: target.priority, method: 2 };
}

/**
 * Which scene items to show and hide so only `target` is visible. The
 * dock's own sources (its captures and pinned sources) are hidden; with
 * `hideOthers`, every other window, game and display capture in the scene
 * too. Anything else in the scene is never touched.
 *
 * @param {Array<{sceneItemId: number, sourceName: string, inputKind?: string|null, sceneItemEnabled: boolean}>} items
 * @param {string} target - source name to show
 * @param {Object} opts
 * @param {string[]} [opts.sources] - the dock's own source names
 * @param {boolean} [opts.hideOthers] - also hide the scene's other captures
 * @returns {Array<{sceneItemId: number, sourceName: string, enabled: boolean}>} only the changes
 */
export function visibilityChanges(items, target, { sources = [], hideOthers = false } = {}) {
    const captureKinds = new Set(['game_capture', 'window_capture', 'monitor_capture']);
    const changes = [];
    for (const it of items || []) {
        const ours = it.sourceName === target || sources.includes(it.sourceName) || (hideOthers && captureKinds.has(it.inputKind));
        if (!ours) continue;
        const enabled = it.sourceName === target;
        if (it.sceneItemEnabled !== enabled) changes.push({ sceneItemId: it.sceneItemId, sourceName: it.sourceName, enabled });
    }
    return changes;
}

/**
 * The dock's settings for this OBS, from persistent data, filled in and
 * checked. Nothing about any one streamer's OBS is built in (AJ,
 * 2026-10-30: "assume someone is coming in with an entire different setup").
 * @param {*} raw
 * @param {number} [defaultMaxDb] - fader max when none is saved
 * @returns {{scene: string, window: string|null, hook: string|null, pinned: string[], hideOthers: boolean, sound: boolean, audioScene: string, faderMaxDb: number}|null}
 *   null until a scene and at least one capture are set
 */
export function readSetup(raw, defaultMaxDb = -12) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const str = v => (typeof v === 'string' && v ? v : null);
    const scene = str(s.scene);
    const window = str(s.window);
    const hook = str(s.hook);
    if (!scene || (!window && !hook)) return null;
    return {
        scene, window, hook,
        pinned: Array.isArray(s.pinned) ? s.pinned.filter(p => str(p) && p !== window && p !== hook) : [],
        hideOthers: s.hideOthers === true,
        sound: s.sound !== false,
        audioScene: str(s.audioScene) || scene,
        faderMaxDb: Number.isFinite(s.faderMaxDb) ? Math.min(0, s.faderMaxDb) : defaultMaxDb
    };
}

/**
 * A first guess at the setup from the scenes in OBS, so a streamer mostly
 * checks and saves (QA, #120: it should be right for AJ's OBS as it is):
 *   - the scene with the most window and game captures;
 *   - of each kind, a shown one, else one pointed at a window, else the
 *     first (a hidden duplicate with no window is the last pick);
 *   - other captures hidden too when the scene has more than those two;
 *   - app sound in the scene nested in the most other scenes (one live
 *     whenever any of them is), else the capture scene.
 * @param {Array<{sceneName: string, items: Array<{sourceName: string, inputKind?: string|null, sceneItemEnabled?: boolean, hasWindow?: boolean}>}>} scenes
 * @param {number} [faderMaxDb]
 * @returns {{scene: string|null, window: string|null, hook: string|null, pinned: string[], hideOthers: boolean, sound: boolean, audioScene: string|null, faderMaxDb: number}}
 */
export function guessSetup(scenes, faderMaxDb = -12) {
    const isCapture = i => i.inputKind === 'window_capture' || i.inputKind === 'game_capture';
    const count = sc => sc.items.filter(isCapture).length;
    let best = null;
    for (const sc of scenes || []) if (count(sc) > 0 && (!best || count(sc) > count(best))) best = sc;
    const score = i => (i.sceneItemEnabled ? 2 : 0) + (i.hasWindow ? 1 : 0);
    const first = (kind) => {
        let pick = null;
        for (const i of best?.items || []) if (i.inputKind === kind && (!pick || score(i) > score(pick))) pick = i;
        return pick?.sourceName || null;
    };
    const window = first('window_capture');
    const hook = first('game_capture');
    const names = new Set((scenes || []).map(sc => sc.sceneName));
    const nestedIn = new Map();
    for (const sc of scenes || []) {
        for (const i of sc.items) if (names.has(i.sourceName) && i.sourceName !== sc.sceneName) nestedIn.set(i.sourceName, (nestedIn.get(i.sourceName) || 0) + 1);
    }
    let audioScene = best?.sceneName || null;
    let most = 0;
    for (const [name, n] of nestedIn) if (n > most) [audioScene, most] = [name, n];
    return {
        scene: best?.sceneName || null,
        window, hook,
        pinned: [],
        hideOthers: best ? count(best) > [window, hook].filter(Boolean).length : false,
        sound: true,
        audioScene,
        faderMaxDb
    };
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

/**
 * The channels a new dock offers until the streamer changes them: Game and
 * Music, both plain and removable (AJ, 2026-10-30: "music + game as the
 * offered defaults but if they want another, they should be able to make
 * it"). The ids match the older dock's built-ins, so saved faders carry over.
 */
export const DEFAULT_CHANNELS = Object.freeze([
    Object.freeze({ id: 'game', label: 'Game', tracks: null, copyFrom: null }),
    Object.freeze({ id: 'music', label: 'Music', tracks: null, copyFrom: null })
]);

/**
 * Tracks as OBS track numbers 1-6, sorted, or null for OBS's defaults.
 * @param {*} tracks
 * @returns {number[]|null}
 */
export function cleanTracks(tracks) {
    if (!Array.isArray(tracks)) return null;
    const t = [...new Set(tracks.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 6))].sort((a, b) => a - b);
    return t.length ? t : null;
}

/**
 * The audio channels, with their saved fader and mute. A channel is the set
 * of App Audio inputs whose name ends in its label, so several apps share
 * it; OBS has no audio bus, so the dock keeps each member's volume, mute,
 * tracks and filters in step. Nothing saved yet means the offered Game and
 * Music; none needs extra Windows audio devices.
 * @param {*} saved - persistent data: {channels: [{id, label, tracks, copyFrom}], mix: {id: {volumeMul, muted}}};
 *   an older dock's {custom: [{id, label}]} is read as Game, Music and those
 * @returns {Array<{id: string, label: string, tracks: number[]|null, copyFrom: string|null, volumeMul: number|null, muted: boolean}>}
 */
export function channelList(saved) {
    const s = saved && typeof saved === 'object' ? saved : {};
    const mix = s.mix && typeof s.mix === 'object' ? s.mix : {};
    const raw = Array.isArray(s.channels) ? s.channels
        : Array.isArray(s.custom) ? [...DEFAULT_CHANNELS, ...s.custom] : DEFAULT_CHANNELS;
    const list = [];
    for (const c of raw) {
        if (!c || typeof c.id !== 'string' || typeof c.label !== 'string' || !c.label) continue;
        if (list.some(x => x.id === c.id || x.label === c.label)) continue;
        list.push({
            id: c.id, label: c.label,
            tracks: cleanTracks(c.tracks),
            copyFrom: typeof c.copyFrom === 'string' && c.copyFrom ? c.copyFrom : null,
            volumeMul: Number.isFinite(mix[c.id]?.volumeMul) ? mix[c.id].volumeMul : null,
            muted: mix[c.id]?.muted === true
        });
    }
    return list;
}

/**
 * A new channel from what was typed, or the reason it can't be made. Labels
 * end input names ("App Audio: firefox.exe (Browser)"), so no brackets.
 * @param {string} name
 * @param {Array<{id: string, label: string}>} existing
 * @param {{tracks?: number[]|null, copyFrom?: string|null}} [opts]
 * @returns {{channel?: {id: string, label: string, tracks: number[]|null, copyFrom: string|null}, error?: string}}
 */
export function newChannel(name, existing, { tracks = null, copyFrom = null } = {}) {
    const label = String(name || '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!label) return { error: 'Give the channel a name.' };
    if (existing.some(c => c.label.toLowerCase() === label.toLowerCase())) return { error: `There's already a ${label} channel.` };
    if (Array.isArray(tracks) && !cleanTracks(tracks)) return { error: 'Tick at least one track.' };
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'channel';
    let id = `ch-${slug}`;
    for (let n = 2; existing.some(c => c.id === id); n++) id = `ch-${slug}-${n}`;
    return { channel: { id, label, tracks: cleanTracks(tracks), copyFrom: copyFrom || null } };
}

/**
 * OBS's inputAudioTracks object for a track list.
 * @param {number[]} tracks
 * @returns {Object<string, boolean>}
 */
export function tracksObject(tracks) {
    return Object.fromEntries([1, 2, 3, 4, 5, 6].map(n => [String(n), tracks.includes(n)]));
}

/**
 * Whether a channel is working, at a glance: idle (nothing playing), live,
 * or red (too loud). All the dock shows of levels (AJ, 2026-10-30: "focus
 * on indicators that show it's working").
 * @param {number} db - peak dBFS
 * @param {number} [quietDb] - under this counts as nothing playing
 * @returns {'idle'|'live'|'red'}
 */
export function activity(db, quietDb = -50) {
    if (meterZone(db) === 'red') return 'red';
    return db > quietDb ? 'live' : 'idle';
}

/**
 * A channel fader position, kept at or under `maxDb` (the setup's fader
 * max: a streamer with a limiter on the copied source can cap it so a
 * full-scale app stays out of the red; AJ's is -12 dB under a -7 dB
 * Limiter, Defiant 2026-10-30).
 * @param {number} db
 * @param {number} floorDb
 * @param {number} maxDb
 * @returns {number} volume multiplier (0 at the floor)
 */
export function faderMul(db, floorDb, maxDb) {
    const d = Math.min(maxDb, Number(db));
    if (!Number.isFinite(d) || d <= floorDb) return 0;
    return 10 ** (d / 20);
}
