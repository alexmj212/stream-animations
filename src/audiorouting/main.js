/**
 * Audio routing dock: a flow chart of OBS's sound, from every input with
 * audio (with its filter chain as icons), through the Game Switcher's
 * channels, to tracks 1-6 and the outputs that take them (stream, VOD,
 * recording, replay buffer) plus monitoring. Dragging a wire changes an
 * input's tracks in OBS (SetInputAudioTracks) or its monitoring. Runs as an
 * OBS Custom Browser Dock (docs/SCENES.md, "audiorouting"). Nothing about
 * any one OBS is built in: it reads every name from OBS.
 */

import { config } from '../config/config.js';
import { ObsSocket, EVENTS } from '../shared/obs.js';
import { createDebug } from '../shared/debug.js';
import { peakDb, activity, channelList, parseAppAudioName, tracksObject } from '../gamepicker/picker.js';
import {
    TRACKS, carriesSound, audioFilters, tracksOn, OUTPUT_PARAMS, outputsFrom, outputsOfTrack,
    changeTracks, channelTracks, touchesRunning, addsToVod, sortSources, wirePath
} from './routing.js';

const cfg = config.audioRouting;
const gcfg = config.gamePicker;
const debug = createDebug('audiorouting');
const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const REALM = 'OBS_WEBSOCKET_DATA_REALM_PROFILE';
const MON_NONE = 'OBS_MONITORING_TYPE_NONE';
const MON_ONLY = 'OBS_MONITORING_TYPE_MONITOR_ONLY';
const MON_BOTH = 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT';
const SVGNS = 'http://www.w3.org/2000/svg';

// One per-viewer preference; never the password (localStorage is shared by
// every page on the Pages origin: Code review, #111)
let prefs = { onProgram: false };
try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(cfg.storageKey) || '{}') }; } catch { /* private mode */ }
function savePrefs() {
    try { localStorage.setItem(cfg.storageKey, JSON.stringify(prefs)); } catch { /* private mode */ }
}

let obs = null;
let typedPassword = null;
let model = null;       // read(): { sources, channels, outputs, names, running }
let wires = [];         // { id, from: {kind, id}, to: {kind, id}, cls, track, src }
let selected = null;    // wire id
let drag = null;        // a drag in progress
let pending = null;     // a change waiting for the live confirm
let refreshTimer = null;
let lastPointerRead = 0;
const undoStack = [];
const levels = new Map();   // input name -> activity
const nodeEls = new Map();  // "kind:id" -> element

function setStatus(text, kind = '') {
    $('status').textContent = text;
    $('status').className = kind;
    $('dot').className = `dot ${kind}`;
}
function note(text) { $('note').textContent = text || ''; }

/** obs-websocket address: ?obs= only to this machine (#111). */
function obsUrl() {
    const asked = params.get('obs');
    if (!asked) return gcfg.obs.url;
    try {
        const u = new URL(asked);
        if (u.protocol === 'ws:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) return asked;
    } catch { /* not a URL */ }
    note(`Ignored ?obs=${asked}: only ws://127.0.0.1 or ws://localhost`);
    return gcfg.obs.url;
}

// ---- connection ----

// Meters cost 20 events a second, so only while the dock is on screen
const meterBit = () => (document.visibilityState === 'visible' ? EVENTS.INPUT_VOLUME_METERS : 0);

async function connect() {
    const password = typedPassword ?? params.get('password') ?? '';
    obs = new ObsSocket({ url: obsUrl(), password, events: EVENTS.ALL | meterBit() });
    obs.on('event', onEvent);
    obs.on('close', ({ reason }) => {
        setStatus(`OBS: ${reason}`, 'bad');
        debug.mark('close', { reason });
        if (reason === 'wrong password') {
            $('auth').hidden = false;
            return;
        }
        setTimeout(connect, gcfg.obs.reconnectMs);
    });
    setStatus('Connecting to OBS…');
    try {
        await obs.connect();
    } catch {
        return; // close handler shows why and retries
    }
    $('auth').hidden = true;
    setStatus('Connected to OBS', 'ok');
    debug.mark('connect', {});
    await refresh();
}

$('auth').addEventListener('submit', (e) => {
    e.preventDefault();
    typedPassword = $('password').value;
    connect();
});
document.addEventListener('visibilitychange', () => {
    if (!obs?.ready) return;
    obs.resubscribe(EVENTS.ALL | meterBit());
    if (document.visibilityState === 'visible') refresh();
});
// Output settings have no event: re-read as the pointer comes back
document.addEventListener('pointerenter', () => {
    if (obs?.ready && Date.now() - lastPointerRead > cfg.pointerRefreshMs) refresh();
});

const REFRESH_ON = new Set([
    'InputCreated', 'InputRemoved', 'InputNameChanged', 'InputSettingsChanged', 'InputAudioTracksChanged',
    'InputAudioMonitorTypeChanged', 'InputMuteStateChanged', 'SourceFilterCreated', 'SourceFilterRemoved',
    'SourceFilterNameChanged', 'SourceFilterEnableStateChanged', 'SourceFilterListReindexed',
    'StreamStateChanged', 'RecordStateChanged', 'ReplayBufferStateChanged', 'CurrentProgramSceneChanged',
    'SceneItemEnableStateChanged', 'SceneItemCreated', 'SceneItemRemoved', 'CurrentProfileChanged',
    'CurrentSceneCollectionChanged'
]);

function onEvent({ eventType, eventData }) {
    if (eventType === 'InputVolumeMeters') {
        for (const { inputName, inputLevelsMul } of eventData.inputs || []) {
            levels.set(inputName, activity(peakDb(inputLevelsMul, gcfg.meterFloorDb), gcfg.audio.quietDb));
        }
        paintLevels();
        return;
    }
    if (REFRESH_ON.has(eventType)) scheduleRefresh();
}

function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, cfg.refreshDebounceMs);
}

// ---- reading OBS ----

/** Everything the chart shows, read fresh. */
async function read() {
    const { inputs } = await obs.call('GetInputList');
    // Settings only where they decide it (a browser page's "Control audio
    // via OBS", a capture's "Capture audio")
    const maybe = inputs.filter(i => carriesSound(i.inputKind, { reroute_audio: true, capture_audio: true }));
    const read1 = async ({ inputName: name, inputKind: kind }) => {
        try {
            if (/^(browser_source|game_capture|window_capture)$/.test(kind)) {
                const { inputSettings } = await obs.call('GetInputSettings', { inputName: name });
                if (!carriesSound(kind, inputSettings)) return null;
            }
            const { inputAudioTracks } = await obs.call('GetInputAudioTracks', { inputName: name });
            const [filters, monitor, mute, active] = await Promise.all([
                obs.call('GetSourceFilterList', { sourceName: name }).then(r => r.filters, () => []),
                obs.call('GetInputAudioMonitorType', { inputName: name }).then(r => r.monitorType, () => MON_NONE),
                obs.call('GetInputMute', { inputName: name }).then(r => r.inputMuted, () => false),
                obs.call('GetSourceActive', { sourceName: name }).then(r => r.videoActive, () => true)
            ]);
            return { name, kind, tracks: tracksOn(inputAudioTracks), filters: audioFilters(filters), monitor, muted: mute, active };
        } catch {
            return null; // no audio (GetInputAudioTracks refuses), or gone meanwhile
        }
    };
    const profile = {};
    const [list, , saved, running] = await Promise.all([
        Promise.all(maybe.map(read1)),
        Promise.all(OUTPUT_PARAMS.map(([parameterCategory, parameterName]) =>
            obs.call('GetProfileParameter', { parameterCategory, parameterName })
                .then(v => { profile[`${parameterCategory}.${parameterName}`] = v; }, () => {}))),
        obs.call('GetPersistentData', { realm: REALM, slotName: gcfg.audio.dataSlot }).then(r => r.slotValue, () => null),
        readRunning()
    ]);
    const sources = sortSources(list.filter(Boolean));
    // The Game Switcher's channels: its App Audio inputs hang off them
    const chans = channelList(saved).map(c => ({ ...c, members: [] }));
    const hasSlot = saved && typeof saved === 'object' && Object.keys(saved).length > 0;
    for (const s of sources) {
        const parsed = parseAppAudioName(s.name, gcfg.audio.prefix);
        if (!parsed) continue;
        let ch = chans.find(c => c.label === parsed.label);
        if (!ch) chans.push(ch = { id: `label:${parsed.label}`, label: parsed.label, tracks: null, members: [], unsaved: true });
        ch.members.push(s.name);
        s.channel = ch.id;
    }
    const channels = chans.filter(c => c.members.length || hasSlot);
    for (const c of channels) {
        c.flow = channelTracks(c.members.map(m => sources.find(s => s.name === m).tracks), c.tracks);
    }
    const { names, mode } = outputsFrom(profile);
    const outputs = outputsFrom(profile).outputs.filter(o => running[o.id] !== null);
    return { sources, channels, outputs, names, mode, running, saved };
}

async function readRunning() {
    // null: OBS has no such output (the replay buffer is off in settings)
    const status = (req) => obs.call(req).then(r => !!r.outputActive, () => null);
    const [stream, record, replay] = await Promise.all([
        status('GetStreamStatus'), status('GetRecordStatus'), status('GetReplayBufferStatus')
    ]);
    return { stream, vod: stream, record, replay };
}

let refreshing = null;
async function refresh() {
    if (!obs?.ready) return;
    lastPointerRead = Date.now();
    if (refreshing) { scheduleRefresh(); return; }
    refreshing = (async () => {
        try {
            model = await read();
            // Mid-drag the chart stays put; it redraws when the drag ends
            if (!drag) render();
            debug.mark('read', { sources: model.sources.length, channels: model.channels.length });
        } catch (err) {
            note(`Couldn't read OBS: ${err.message}`);
        }
    })();
    await refreshing;
    refreshing = null;
}

// ---- drawing ----

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
}

function fxIcons(filters) {
    const box = el('div', 'fx');
    for (const f of filters) {
        const svg = document.createElementNS(SVGNS, 'svg');
        svg.setAttribute('viewBox', '0 0 16 16');
        if (!f.enabled) svg.classList.add('off');
        const title = document.createElementNS(SVGNS, 'title');
        title.textContent = `${f.name}: ${f.label}${f.enabled ? '' : ' (off)'}`;
        const use = document.createElementNS(SVGNS, 'use');
        use.setAttribute('href', `#i-${f.icon}`);
        svg.append(title, use);
        svg.dataset.icon = f.icon;
        box.append(svg);
    }
    return box;
}

function node({ kind, id, name, sub, cls = '', ports = [], drop = false }) {
    const n = el('div', `node ${kind} ${cls}`.trim());
    n.dataset.kind = kind;
    n.dataset.id = id;
    if (drop) n.dataset.drop = kind;
    const line = el('div', 'name');
    line.append(el('span', 'sig'), el('span', null, name));
    n.append(line);
    if (sub) n.append(typeof sub === 'string' ? el('div', 'sub', sub) : sub);
    for (const side of ports) {
        const p = el('span', `port ${side}`);
        p.dataset.kind = kind;
        p.dataset.id = id;
        p.title = side === 'out' ? 'Drag to a track to connect' : 'Drag to a source to connect';
        n.append(p);
    }
    nodeEls.set(`${kind}:${id}`, n);
    return n;
}

function shownSources() {
    return model.sources.filter(s => !prefs.onProgram || s.active || s.channel);
}

/** A channel: one box, its apps inside with their own light and filters. */
function channelNode(c) {
    const box = el('div');
    if (!c.members.length) box.append(el('div', 'sub', c.tracks ? 'no apps yet; the next one gets these tracks' : 'no apps yet'));
    for (const name of c.members) {
        const s = model.sources.find(x => x.name === name);
        const row = el('div', `member ${s.muted ? 'muted' : ''} ${s.active ? '' : 'off'}`);
        row.title = name;
        const line = el('div', 'name');
        line.append(el('span', 'sig'), el('span', null, parseAppAudioName(name, gcfg.audio.prefix)?.exe || name));
        row.append(line);
        if (s.filters.length) row.append(fxIcons(s.filters));
        nodeEls.set(`src:${name}`, row);
        box.append(row);
    }
    const n = node({ kind: 'chan', id: c.id, name: c.label, sub: box, ports: ['out'] });
    return n;
}

function render() {
    nodeEls.clear();
    const m = model;
    const srcCol = $('colSources'), trCol = $('colTracks'), outCol = $('colOutputs');
    for (const c of [srcCol, trCol, outCol]) c.replaceChildren(c.querySelector('h2'));

    // Sources by group; the Game Switcher's channels follow the desktop and
    // app captures, each a box holding its apps (they share its wires)
    const shown = shownSources().filter(s => !s.channel);
    const at = shown.findIndex(s => s.rank > 1);
    const order = [...shown];
    if (m.channels.length) order.splice(at < 0 ? order.length : at, 0, 'channels');
    let group = null;
    for (const s of order) {
        if (s === 'channels') {
            srcCol.append(el('div', 'group', group = 'Game Switcher channels'));
            for (const c of m.channels) srcCol.append(channelNode(c));
            continue;
        }
        if (s.group !== group) srcCol.append(el('div', 'group', group = s.group));
        const sub = el('div');
        const text = [s.monitor === MON_ONLY ? 'monitor only' : '', s.active ? '' : 'not in program'].filter(Boolean).join(' · ');
        if (text) sub.append(el('div', 'sub', text));
        if (s.filters.length) sub.append(fxIcons(s.filters));
        srcCol.append(node({
            kind: 'src', id: s.name, name: s.name, sub: sub.childNodes.length ? sub : null,
            cls: `${s.active ? '' : 'off'} ${s.muted ? 'muted' : ''}`, ports: ['out']
        }));
    }
    if (!order.length) srcCol.append(el('div', 'sub', prefs.onProgram ? 'No source with sound in the program scene.' : 'No source with sound in OBS.'));

    for (const n of TRACKS) {
        const outs = outputsOfTrack(n, m.outputs);
        const badges = el('div', 'badges');
        for (const id of outs) {
            const o = m.outputs.find(x => x.id === id);
            badges.append(el('span', `badge ${m.running[id] ? 'run' : ''}`, o.label.replace('Replay buffer', 'Replay').replace('Twitch VOD', 'VOD').replace('Recording', 'Rec')));
        }
        if (!outs.length) badges.append(el('span', 'badge', 'unused'));
        const t = node({ kind: 'track', id: String(n), name: m.names[n], sub: badges, cls: outs.length ? '' : 'unused', ports: ['in', 'out'], drop: true });
        t.style.setProperty('--tc', `var(--t${n})`);
        trCol.append(t);
    }

    for (const o of m.outputs) {
        const run = m.running[o.id];
        const n = node({
            kind: 'output', id: o.id, name: o.label,
            sub: `track${o.tracks.length > 1 ? 's' : ''} ${o.tracks.join(' ')}`, cls: run ? 'running' : '', ports: ['in']
        });
        const state = el('span', 'state', run ? (o.id === 'record' ? 'REC' : 'LIVE') : 'off');
        n.querySelector('.name').append(state);
        outCol.append(n);
    }
    const monCount = m.sources.filter(s => s.monitor !== MON_NONE).length;
    outCol.append(node({ kind: 'monitor', id: 'monitor', name: 'Monitor', sub: `your headphones · ${monCount} source${monCount === 1 ? '' : 's'}`, ports: ['in'], drop: true }));

    $('liveBadge').hidden = !m.running.stream;
    buildWires();
    layoutWires();
    paintLevels(true);
}

function buildWires() {
    const m = model;
    const shown = new Set(shownSources().map(s => s.name));
    wires = [];
    for (const s of m.sources) {
        if (!shown.has(s.name)) continue;
        const quiet = s.muted || !s.active || s.monitor === MON_ONLY;
        if (!s.channel) {
            for (const t of s.tracks) {
                wires.push({ id: `t:${s.name}:${t}`, from: { kind: 'src', id: s.name }, to: { kind: 'track', id: String(t) }, track: t, cls: `${quiet ? 'dim' : ''} ${s.monitor === MON_ONLY ? 'dashed' : ''}`, src: s.name });
            }
        }
        if (s.monitor !== MON_NONE) {
            wires.push({ id: `mon:${s.name}`, from: { kind: 'src', id: s.name }, to: { kind: 'monitor', id: 'monitor' }, monitor: true, cls: s.muted ? 'dim' : '', src: s.name });
        }
    }
    for (const c of m.channels) {
        for (const t of c.flow.all) wires.push({ id: `c:${c.id}:${t}`, from: { kind: 'chan', id: c.id }, to: { kind: 'track', id: String(t) }, track: t, cls: c.flow.planned ? 'dashed dim' : '', chan: c.id });
        for (const t of c.flow.some) wires.push({ id: `c:${c.id}:${t}`, from: { kind: 'chan', id: c.id }, to: { kind: 'track', id: String(t) }, track: t, cls: 'dashed', chan: c.id, partial: true });
    }
    for (const o of m.outputs) {
        for (const t of o.tracks) wires.push({ id: `o:${o.id}:${t}`, from: { kind: 'track', id: String(t) }, to: { kind: 'output', id: o.id }, track: t, cls: `out ${m.running[o.id] ? '' : 'dim'}`, fixed: true });
    }
}

/** A port's centre in the grid's coordinates. */
function portAt(kind, id, side) {
    const n = nodeEls.get(`${kind}:${id}`);
    if (!n) return null;
    const p = n.querySelector(`:scope > .port.${side}`);
    const r = (p || n).getBoundingClientRect(), g = $('grid').getBoundingClientRect();
    // an app inside a channel box has no dot: its monitor wire leaves the box's edge
    const x = p ? r.left + r.width / 2 : n.closest('.node').getBoundingClientRect().right;
    return { x: x - g.left, y: r.top + r.height / 2 - g.top };
}

function layoutWires() {
    const svg = $('wires'), grid = $('grid');
    svg.setAttribute('width', grid.scrollWidth);
    svg.setAttribute('height', grid.scrollHeight);
    svg.replaceChildren();
    for (const w of wires) {
        const a = portAt(w.from.kind, w.from.id, 'out');
        const b = portAt(w.to.kind, w.to.id, 'in');
        if (!a || !b) continue;
        const d = wirePath(a.x, a.y, b.x, b.y);
        const path = document.createElementNS(SVGNS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', `w ${w.cls || ''} ${w.id === selected ? 'sel' : ''}`);
        path.style.stroke = w.monitor ? 'var(--monitor)' : w.track ? `var(--t${w.track})` : '';
        path.dataset.wire = w.id;
        w.path = path;
        svg.append(path);
        if (!w.fixed) {
            const hit = document.createElementNS(SVGNS, 'path');
            hit.setAttribute('d', d);
            hit.setAttribute('class', 'hit');
            hit.dataset.wire = w.id;
            const title = document.createElementNS(SVGNS, 'title');
            title.textContent = wireLabel(w) + (w.partial ? ' (some apps)' : '') + '. Drag away or click to disconnect';
            hit.append(title);
            svg.append(hit);
        }
    }
    placeUnplug();
    if (focused) paintFocus();
}

function wireLabel(w) {
    const from = w.chan ? `${model.channels.find(c => c.id === w.chan)?.label} channel` : w.from.id;
    return w.monitor ? `${from} → Monitor` : `${from} → ${model.names[w.track]}`;
}

function placeUnplug() {
    const btn = $('unplug');
    const w = wires.find(x => x.id === selected);
    if (!w?.path) { btn.hidden = true; return; }
    const len = w.path.getTotalLength();
    const pt = w.path.getPointAtLength(len / 2);
    btn.style.left = `${pt.x}px`;
    btn.style.top = `${pt.y}px`;
    btn.title = `Disconnect ${wireLabel(w)}`;
    btn.hidden = false;
}

let lastPaint = new Map();
/** Lights only: changes a class where one changed, nothing else. */
function paintLevels(all = false) {
    if (!model) return;
    if (all) lastPaint = new Map();
    const set = (key, act) => {
        if (lastPaint.get(key) === act) return;
        lastPaint.set(key, act);
        const n = nodeEls.get(key);
        if (n) n.dataset.act = act;
    };
    const rank = { idle: 0, live: 1, red: 2 };
    const best = (a, b) => (rank[b] > rank[a] ? b : a);
    const trackAct = Object.fromEntries(TRACKS.map(t => [t, 'idle']));
    const chanAct = {};
    for (const s of model.sources) {
        const act = levels.get(s.name) || 'idle';
        set(`src:${s.name}`, act);
        const heard = !s.muted && s.active && s.monitor !== MON_ONLY ? act : 'idle';
        if (s.channel) chanAct[s.channel] = best(chanAct[s.channel] || 'idle', heard);
        else for (const t of s.tracks) trackAct[t] = best(trackAct[t], heard);
    }
    for (const c of model.channels) {
        set(`chan:${c.id}`, chanAct[c.id] || 'idle');
        for (const t of c.flow.all.concat(c.flow.some)) if (!c.flow.planned) trackAct[t] = best(trackAct[t], chanAct[c.id] || 'idle');
    }
    for (const t of TRACKS) set(`track:${t}`, trackAct[t]);
    for (const w of wires) {
        if (!w.path) continue;
        const act = w.src ? (levels.get(w.src) || 'idle') : w.chan ? (chanAct[w.chan] || 'idle') : w.from.kind === 'track' ? trackAct[w.track] : 'idle';
        const key = `w:${w.id}`;
        if (lastPaint.get(key) === act) continue;
        lastPaint.set(key, act);
        w.path.classList.toggle('live', act !== 'idle' && !w.cls?.includes('dim'));
    }
}

// Hovering a source, channel or track brings its wires forward
let focused = null;
$('grid').addEventListener('pointerover', (e) => {
    if (drag) return;
    const n = e.target.closest?.('.node, .member');
    const key = n ? `${n.dataset.kind || 'src'}:${n.dataset.id || n.title}` : null;
    if (key === focused) return;
    focused = key;
    paintFocus();
});
$('grid').addEventListener('pointerleave', () => { focused = null; paintFocus(); });

function paintFocus() {
    $('wires').classList.toggle('focus', !!focused);
    for (const w of wires) {
        if (!w.path) continue;
        const ends = [`${w.from.kind}:${w.from.id}`, `${w.to.kind}:${w.to.id}`];
        // an app inside a channel box lights its channel's wires
        const member = focused?.startsWith('src:') && w.chan && model.sources.find(s => `src:${s.name}` === focused)?.channel === w.chan;
        w.path.classList.toggle('hl', !!focused && (ends.includes(focused) || member || w.id === selected));
    }
}

let layoutQueued = false;
function queueLayout() {
    if (layoutQueued || !model) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
        layoutQueued = false;
        if (!drag) layoutWires();
    });
}
$('chart').addEventListener('scroll', queueLayout, { passive: true });
new ResizeObserver(queueLayout).observe($('grid'));

$('onProgram').checked = prefs.onProgram;
$('onProgram').addEventListener('change', () => {
    prefs.onProgram = $('onProgram').checked;
    savePrefs();
    if (model) render();
});

// ---- changes ----

/**
 * A change: what to set, the tracks it touches (for the live confirm) and
 * how to put it back.
 */
function planChange(action) {
    const m = model;
    const src = id => m.sources.find(s => s.name === id);
    if (action.type === 'monitor') {
        const s = src(action.source);
        // A Monitor Only source plays on no track; taking its monitoring
        // off puts it on every track it's ticked on (code review, #131)
        const onAir = !action.on && s.monitor === MON_ONLY ? s.tracks : [];
        const label = action.on ? `Monitor ${s.name}`
            : onAir.length ? `Stop monitoring ${s.name}: it starts playing on ${onAir.map(n => m.names[n]).join(', ')}`
                : `Stop monitoring ${s.name}`;
        return {
            label, tracks: onAir, adds: onAir, undoAdds: [],
            inputs: [{ name: s.name, monitor: action.on ? (s.monitor === MON_NONE ? MON_BOTH : s.monitor) : MON_NONE, before: { monitor: s.monitor } }]
        };
    }
    // tracks: a source, or every app in a channel
    const { add, remove } = action;
    const touched = [add, remove].filter(Boolean);
    // what a change, or its undo, newly puts on a track
    const adds = add ? [add] : [], undoAdds = remove ? [remove] : [];
    if (action.channel) {
        const c = m.channels.find(x => x.id === action.channel);
        const inputs = c.members.map(n => {
            const s = src(n);
            return { name: n, tracks: changeTracks(s.tracks, { add, remove }), before: { tracks: s.tracks } };
        });
        const saved = c.unsaved ? null : changeTracks(c.flow.all.concat(c.flow.planned ? [] : c.flow.some), { add, remove });
        return { label: describe(`${c.label} channel`, add, remove), tracks: touched, adds, undoAdds, inputs, channel: c.unsaved ? null : { id: c.id, tracks: saved, before: c.tracks } };
    }
    const s = src(action.source);
    return { label: describe(s.name, add, remove), tracks: touched, adds, undoAdds, inputs: [{ name: s.name, tracks: changeTracks(s.tracks, { add, remove }), before: { tracks: s.tracks } }] };
}

function describe(what, add, remove) {
    const nm = n => model.names[n];
    if (add && remove) return `${what}: ${nm(remove)} → ${nm(add)}`;
    if (add) return `${what} → ${nm(add)}`;
    return `${what} off ${nm(remove)}`;
}

/**
 * Ask once while a running output would hear it, or before anything joins
 * the Twitch VOD track (QA, #131: music on the VOD can get the VOD muted,
 * which is why a streamer keeps music off it); otherwise apply.
 */
function request(action) {
    const change = planChange(action);
    if (!change.inputs.length && !change.channel) return;
    gate(change, false);
}

/**
 * Every path to a track goes through here, Undo included (code review,
 * #131): a running output it touches, or anything newly on the VOD track,
 * waits for one tap.
 */
function gate(change, isUndo) {
    const hit = touchesRunning(change.tracks, model.outputs, model.running);
    const vod = (isUndo ? change.undoAdds : change.adds).some(t => addsToVod(t, model.outputs));
    if (hit.length || vod) {
        pending = { change, isUndo };
        const why = [
            hit.length ? `${hit.join(' and ')} ${hit.length > 1 ? 'are' : 'is'} running.` : '',
            vod ? 'That puts it on the Twitch VOD track: music on it can get the VOD muted.' : ''
        ].filter(Boolean).join(' ');
        $('confirmText').textContent = `${isUndo ? 'Undo: ' : ''}${change.label}? ${why}`;
        $('confirm').hidden = false;
        return false;
    }
    apply(change, isUndo);
    return true;
}
$('confirmYes').addEventListener('click', () => {
    const p = pending;
    closeConfirm();
    if (!p) return;
    // by identity: a change applied while this confirm was open is on top now (code review, #131)
    if (p.isUndo) dropUndo(p.change);
    apply(p.change, p.isUndo);
});
$('confirmNo').addEventListener('click', closeConfirm);
function closeConfirm() { pending = null; $('confirm').hidden = true; }

/**
 * Set each input; if one fails, put back the ones already set, so a
 * channel never ends up half changed with nothing to undo (code review, #131).
 */
async function setInputs(inputs, which) {
    const done = [];
    const set = async (i, want) => {
        if (want.tracks) await obs.call('SetInputAudioTracks', { inputName: i.name, inputAudioTracks: tracksObject(want.tracks) });
        if (want.monitor) await obs.call('SetInputAudioMonitorType', { inputName: i.name, monitorType: want.monitor });
    };
    try {
        for (const i of inputs) {
            await set(i, which === 'before' ? i.before : i);
            done.push(i);
        }
    } catch (err) {
        for (const i of done.reverse()) await set(i, which === 'before' ? i : i.before).catch(() => {});
        throw err;
    }
}

/** Keep the Game Switcher's saved channel tracks in step, so its next app gets them. */
async function saveChannelTracks(id, tracks) {
    const { slotValue } = await obs.call('GetPersistentData', { realm: REALM, slotName: gcfg.audio.dataSlot });
    if (!slotValue || !Array.isArray(slotValue.channels)) return;
    const ch = slotValue.channels.find(c => c.id === id);
    if (!ch) return;
    ch.tracks = tracks && tracks.length ? tracks : null;
    await obs.call('SetPersistentData', { realm: REALM, slotName: gcfg.audio.dataSlot, slotValue });
}

async function apply(change, isUndo = false) {
    document.body.classList.add('busy');
    selected = null;
    try {
        await setInputs(change.inputs, isUndo ? 'before' : 'after');
        if (change.channel) await saveChannelTracks(change.channel.id, isUndo ? change.channel.before : change.channel.tracks);
        if (!isUndo) {
            undoStack.push(change);
            if (undoStack.length > cfg.undoMax) undoStack.shift();
        }
        note('');
        debug.mark(isUndo ? 'undo' : 'change', { label: change.label });
    } catch (err) {
        note(`Couldn't change it: ${err.message}`);
    } finally {
        document.body.classList.remove('busy');
        updateUndo();
        await refresh();
    }
}

function dropUndo(change) {
    const i = undoStack.lastIndexOf(change);
    if (i >= 0) undoStack.splice(i, 1);
}

function updateUndo() {
    const last = undoStack[undoStack.length - 1];
    $('undo').disabled = !last;
    $('undo').title = last ? `Undo: ${last.label}` : 'Nothing to undo';
}
$('undo').addEventListener('click', () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    // popped once applied (here or after the confirm), so Cancel keeps it
    if (gate(last, true)) dropUndo(last);
});

function disconnect(w, moveTo = null) {
    if (w.monitor) return request({ type: 'monitor', source: w.src, on: false });
    const action = { remove: w.track, add: moveTo };
    if (w.chan) action.channel = w.chan; else action.source = w.src;
    request(action);
}

$('unplug').addEventListener('click', () => {
    const w = wires.find(x => x.id === selected);
    if (w) disconnect(w);
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { selected = null; closeConfirm(); layoutWires(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected && document.activeElement?.tagName !== 'INPUT') {
        const w = wires.find(x => x.id === selected);
        if (w) disconnect(w);
    }
});

// ---- dragging ----
// From a port: a new connection. From a wire: unplug it (drop on another
// track to move it, anywhere else to disconnect); a click selects it.

function gridPoint(e) {
    const g = $('grid').getBoundingClientRect();
    return { x: e.clientX - g.left, y: e.clientY - g.top };
}

function dropTarget(e, wanted) {
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.node');
    if (!hit || !wanted.includes(hit.dataset.kind)) return null;
    return hit;
}

/**
 * The wire under the pointer. Wires cross and their 12 px grab areas
 * overlap, so the nearest one wins, not the one drawn last.
 */
function nearestWire(e) {
    const p = gridPoint(e);
    let best = null, bestD = Infinity;
    for (const elx of document.elementsFromPoint(e.clientX, e.clientY)) {
        if (!elx.matches?.('path.hit')) continue;
        const w = wires.find(x => x.id === elx.dataset.wire);
        if (!w) continue;
        const len = elx.getTotalLength();
        for (let i = 0; i <= 60; i++) {
            const q = elx.getPointAtLength(len * i / 60);
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d < bestD) { bestD = d; best = w; }
        }
    }
    return best;
}

function markTargets(kinds) {
    for (const n of nodeEls.values()) n.classList.toggle('drop-ok', kinds.includes(n.dataset.kind));
}

function clearMarks() {
    for (const n of nodeEls.values()) n.classList.remove('drop-ok', 'drop-hot');
}

$('grid').addEventListener('pointerdown', (e) => {
    if (!model || e.button !== 0 || e.target.closest('#unplug')) return;
    const port = e.target.closest('.port');
    const hit = e.target.closest?.('path.hit') && nearestWire(e);
    if (port) {
        const kind = port.dataset.kind, id = port.dataset.id;
        // sources and channels connect to tracks (sources to Monitor too);
        // a track's dot connects back to a source or channel
        const targets = kind === 'src' ? ['track', 'monitor'] : kind === 'chan' ? ['track'] : kind === 'track' ? ['src', 'chan'] : [];
        if (!targets.length || (kind === 'src' && model.sources.find(s => s.name === id)?.channel)) {
            if (kind === 'src') note('This app is in a Game Switcher channel: connect the channel instead, or move the app in the Game Switcher.');
            return;
        }
        const side = port.classList.contains('out') ? 'out' : 'in';
        if (kind === 'track' && side === 'out') return; // a track's outputs come from OBS's output settings
        drag = { type: 'new', kind, id, targets, from: portAt(kind, id, side) };
    } else if (hit) {
        const w = hit;
        drag = { type: 'wire', wire: w, start: gridPoint(e), moved: false, targets: w.monitor ? ['monitor'] : ['track'], from: portAt(w.from.kind, w.from.id, 'out') };
    } else {
        if (selected) { selected = null; layoutWires(); }
        return;
    }
    e.preventDefault();
    $('grid').setPointerCapture(e.pointerId);
    markTargets(drag.targets);
});

$('grid').addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = gridPoint(e);
    if (drag.type === 'wire' && !drag.moved) {
        if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 6) return;
        drag.moved = true;
        drag.wire.path?.classList.add('ghost');
        $('unplug').hidden = true;
    }
    let line = $('wires').querySelector('path.drag');
    if (!line) {
        line = document.createElementNS(SVGNS, 'path');
        line.setAttribute('class', 'drag');
        $('wires').append(line);
    }
    const a = drag.from;
    line.setAttribute('d', p.x >= a.x ? wirePath(a.x, a.y, p.x, p.y) : wirePath(p.x, p.y, a.x, a.y));
    for (const n of nodeEls.values()) n.classList.remove('drop-hot');
    dropTarget(e, drag.targets)?.classList.add('drop-hot');
});

function endDrag(e, cancelled = false) {
    if (!drag) return;
    const d = drag;
    drag = null;
    clearMarks();
    $('wires').querySelector('path.drag')?.remove();
    const target = cancelled ? null : dropTarget(e, d.targets);
    if (d.type === 'wire' && !d.moved) {
        selected = selected === d.wire.id ? null : d.wire.id;
        layoutWires();
        return;
    }
    if (d.type === 'wire') {
        const w = d.wire;
        if (cancelled) { layoutWires(); return; }
        if (target && (w.monitor || Number(target.dataset.id) === w.track)) { layoutWires(); return; }
        disconnect(w, target && !w.monitor ? Number(target.dataset.id) : null);
        return;
    }
    if (!target) { layoutWires(); return; }
    // new connection, from whichever end was dragged
    let from = { kind: d.kind, id: d.id }, to = { kind: target.dataset.kind, id: target.dataset.id };
    if (d.kind === 'track') [from, to] = [to, from];
    if (to.kind === 'monitor') return request({ type: 'monitor', source: from.id, on: true });
    const track = Number(to.id);
    if (from.kind === 'chan') return request({ channel: from.id, add: track });
    const s = model.sources.find(x => x.name === from.id);
    if (s?.channel) { note('This app is in a Game Switcher channel: connect the channel instead.'); layoutWires(); return; }
    if (s && !s.tracks.includes(track)) return request({ source: from.id, add: track });
    layoutWires();
}
$('grid').addEventListener('pointerup', e => endDrag(e));
$('grid').addEventListener('pointercancel', e => endDrag(e, true));

window.__audioRouting = { get model() { return model; }, get wires() { return wires.map(({ path, ...w }) => w); }, refresh };

connect();
