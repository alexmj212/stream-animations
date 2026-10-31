/**
 * Pure logic for the audio routing dock: which inputs carry sound, what
 * their filters are, which tracks each output takes, and how a drag
 * changes an input's tracks. No OBS calls here; src/audiorouting/main.js
 * does those (unit tests: tests/audiorouting/routing.test.js).
 */

export const TRACKS = Object.freeze([1, 2, 3, 4, 5, 6]);

/**
 * Whether an input's sound reaches OBS's tracks. A browser source plays to
 * the desktop unless "Control audio via OBS" is on, and a window or game
 * capture only carries sound with its "Capture audio" box ticked, so those
 * are left out otherwise (AJ's OBS has ~40 browser sources, 4 with sound
 * through OBS: Archive_1-20261031.json).
 * @param {string} kind - inputKind
 * @param {Object} [settings] - inputSettings
 * @returns {boolean}
 */
export function carriesSound(kind, settings = {}) {
    const k = kind || '';
    if (k === 'browser_source') return settings.reroute_audio === true;
    if (/^(game_capture|window_capture)$/.test(k)) return settings.capture_audio === true;
    if (/^(image_source|color_source|text_|scene|group|monitor_capture|slideshow)/.test(k)) return false;
    return true;
}

/**
 * Where a source sits in the left column: microphones and devices first,
 * then desktop and app captures, media, browser pages and the rest.
 * @param {string} kind
 * @returns {{rank: number, group: string}}
 */
export function sourceGroup(kind) {
    const k = kind || '';
    if (/input_capture|coreaudio_input|pulse_input|alsa|jack|asio/.test(k)) return { rank: 0, group: 'Inputs' };
    if (/output_capture|process_output|sck_audio|pulse_output|coreaudio_output/.test(k)) return { rank: 1, group: 'Desktop and apps' };
    if (/ffmpeg|vlc|media/.test(k)) return { rank: 2, group: 'Media' };
    if (k === 'browser_source') return { rank: 3, group: 'Browser' };
    return { rank: 4, group: 'Devices and other' };
}

// Audio filters by kind, with the icon each shows. Kinds from OBS 33 and
// the plugins in AJ's OBS (Archive_1-20261031.json); Move filters that fade
// a volume are "automation"
const FILTER_ICONS = {
    noise_suppress_filter: 'denoise', noise_suppress_filter_v2: 'denoise', nvidia_audiofx_filter: 'denoise',
    noise_gate_filter: 'gate',
    compressor_filter: 'compressor',
    upward_compressor_filter: 'upward',
    expander_filter: 'expander',
    limiter_filter: 'limiter',
    gain_filter: 'gain',
    basic_eq_filter: 'eq', '3band_eq_filter': 'eq',
    vst_filter: 'vst',
    async_delay_filter: 'delay',
    invert_polarity_filter: 'invert',
    move_audio_value_filter: 'automation', audio_move_filter: 'automation'
};
const ICON_LABELS = {
    denoise: 'Noise suppression', gate: 'Noise gate', compressor: 'Compressor', upward: 'Upward compressor',
    expander: 'Expander', limiter: 'Limiter', gain: 'Gain', eq: 'EQ', vst: 'VST plugin', delay: 'Delay',
    invert: 'Invert polarity', automation: 'Volume automation', other: 'Audio filter'
};

/**
 * The audio filters of a source, in chain order, each with its icon. Video
 * filters (crop, colour key, stroke...) are left out: the chart is sound.
 * An unknown kind counts as audio when its name says so.
 * @param {Array<{filterName: string, filterKind: string, filterEnabled: boolean}>} filters
 * @returns {Array<{name: string, kind: string, icon: string, label: string, enabled: boolean}>}
 */
export function audioFilters(filters) {
    const out = [];
    for (const f of filters || []) {
        let icon = FILTER_ICONS[f.filterKind];
        if (!icon && /audio|sound|vst|eq|compress|gate|limit|gain|noise|denois|reverb/i.test(f.filterKind || '')) icon = 'other';
        if (!icon) continue;
        out.push({ name: f.filterName, kind: f.filterKind, icon, label: ICON_LABELS[icon], enabled: f.filterEnabled !== false });
    }
    return out;
}

/**
 * Track numbers from an OBS mixer bitmask (bit 0 is track 1).
 * @param {number|string|null} mask
 * @returns {number[]}
 */
export function tracksFromMask(mask) {
    const m = Number(mask);
    if (!Number.isFinite(m)) return [];
    return TRACKS.filter(n => m & (1 << (n - 1)));
}

/**
 * The tracks an input is on, from GetInputAudioTracks.
 * @param {Object<string, boolean>} inputAudioTracks
 * @returns {number[]}
 */
export function tracksOn(inputAudioTracks) {
    return TRACKS.filter(n => inputAudioTracks?.[String(n)] === true);
}

/**
 * A profile parameter's value: what's set, else OBS's default.
 * @param {Object<string, {parameterValue: ?string, defaultParameterValue: ?string}>} p
 * @param {string} key - "Category.Name"
 * @returns {?string}
 */
function param(p, key) {
    const v = p[key];
    if (!v) return null;
    return v.parameterValue ?? v.defaultParameterValue ?? null;
}

/** The profile parameters outputsFrom reads, as [category, name]. */
export const OUTPUT_PARAMS = Object.freeze([
    ['Output', 'Mode'],
    ['AdvOut', 'TrackIndex'], ['AdvOut', 'VodTrackEnabled'], ['AdvOut', 'VodTrackIndex'],
    ['AdvOut', 'RecType'], ['AdvOut', 'RecTracks'], ['AdvOut', 'FFAudioMixes'],
    ['SimpleOutput', 'RecQuality'], ['SimpleOutput', 'RecTracks'],
    ...TRACKS.map(n => ['AdvOut', `Track${n}Name`])
]);

/**
 * Which tracks each output takes and what each track is called, from the
 * profile's output settings. Simple mode streams track 1 and records track
 * 1 unless a recording quality of its own sets tracks.
 * @param {Object<string, {parameterValue: ?string, defaultParameterValue: ?string}>} p - by "Category.Name"
 * @returns {{mode: string, names: Object<number, string>, outputs: Array<{id: string, label: string, tracks: number[]}>}}
 */
export function outputsFrom(p) {
    const mode = /^adv/i.test(param(p, 'Output.Mode') || '') ? 'Advanced' : 'Simple';
    const names = {};
    for (const n of TRACKS) names[n] = (mode === 'Advanced' && param(p, `AdvOut.Track${n}Name`)) || `Track ${n}`;
    const outputs = [];
    if (mode === 'Advanced') {
        const stream = Number(param(p, 'AdvOut.TrackIndex')) || 1;
        outputs.push({ id: 'stream', label: 'Stream', tracks: [stream] });
        if (/^(true|1)$/i.test(param(p, 'AdvOut.VodTrackEnabled') || '')) {
            outputs.push({ id: 'vod', label: 'Twitch VOD', tracks: [Number(param(p, 'AdvOut.VodTrackIndex')) || 2] });
        }
        const ffmpeg = /ffmpeg/i.test(param(p, 'AdvOut.RecType') || '');
        const rec = tracksFromMask(param(p, ffmpeg ? 'AdvOut.FFAudioMixes' : 'AdvOut.RecTracks') ?? 1);
        outputs.push({ id: 'record', label: 'Recording', tracks: rec.length ? rec : [1] });
        if (!ffmpeg) outputs.push({ id: 'replay', label: 'Replay buffer', tracks: rec.length ? rec : [1] });
    } else {
        outputs.push({ id: 'stream', label: 'Stream', tracks: [1] });
        const own = !/stream/i.test(param(p, 'SimpleOutput.RecQuality') || 'Stream');
        const rec = own ? tracksFromMask(param(p, 'SimpleOutput.RecTracks') ?? 1) : [1];
        outputs.push({ id: 'record', label: 'Recording', tracks: rec.length ? rec : [1] });
        outputs.push({ id: 'replay', label: 'Replay buffer', tracks: rec.length ? rec : [1] });
    }
    return { mode, names, outputs };
}

/**
 * The outputs a track feeds, for the labels on each track.
 * @param {number} track
 * @param {Array<{id: string, label: string, tracks: number[]}>} outputs
 * @returns {string[]} output ids
 */
export function outputsOfTrack(track, outputs) {
    return outputs.filter(o => o.tracks.includes(track)).map(o => o.id);
}

/**
 * An input's tracks after a drag: a track added, taken off, or moved from
 * one track to another.
 * @param {number[]} current
 * @param {{add?: number, remove?: number}} change
 * @returns {number[]} sorted
 */
export function changeTracks(current, { add, remove } = {}) {
    const set = new Set(current);
    if (remove) set.delete(remove);
    if (add) set.add(add);
    return TRACKS.filter(n => set.has(n));
}

/**
 * The tracks a channel feeds, from its apps' own tracks: `all` are on
 * every app, `some` on only part of them (drawn dashed). With no apps,
 * the saved tracks are what the next app gets.
 * @param {number[][]} memberTracks
 * @param {number[]|null} saved
 * @returns {{all: number[], some: number[], planned: boolean}}
 */
export function channelTracks(memberTracks, saved) {
    if (!memberTracks.length) return { all: saved ? [...saved] : [], some: [], planned: true };
    const all = TRACKS.filter(n => memberTracks.every(t => t.includes(n)));
    const some = TRACKS.filter(n => !all.includes(n) && memberTracks.some(t => t.includes(n)));
    return { all, some, planned: false };
}

/**
 * Whether a change would alter something running: a track a running
 * output takes. While live that needs one confirm tap (plan, 2026-10-31).
 * Monitoring never reaches an output.
 * @param {number[]} tracks - the tracks the change adds or takes off
 * @param {Array<{id: string, label: string, tracks: number[]}>} outputs
 * @param {Object<string, boolean>} running - by output id
 * @returns {string[]} labels of the running outputs it touches
 */
export function touchesRunning(tracks, outputs, running) {
    return outputs.filter(o => running[o.id] && o.tracks.some(t => tracks.includes(t))).map(o => o.label);
}

/**
 * Sort the chart's sources: by group, then name, with App Audio inputs
 * (shown under their channel) last.
 * @param {Array<{name: string, kind: string}>} sources
 * @returns {Array<{name: string, kind: string, group: string}>}
 */
export function sortSources(sources) {
    return sources
        .map(s => ({ ...s, ...sourceGroup(s.kind) }))
        .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/**
 * A cubic wire from (x1, y1) to (x2, y2), leaving and arriving level.
 * @returns {string} SVG path data
 */
export function wirePath(x1, y1, x2, y2) {
    const dx = Math.max(24, Math.abs(x2 - x1) * 0.5);
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}
