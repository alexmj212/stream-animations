/**
 * Game picker dock: lists open windows and points a game scene's capture at
 * one in a click. Runs as an OBS Custom Browser Dock and talks to OBS over
 * obs-websocket (docs/SCENES.md, "gamepicker"). Which scene and captures it
 * drives comes from its setup screen, saved in OBS: nothing about any one
 * streamer's OBS is built in. Each window can also send its app's sound to
 * a channel (config.gamePicker.audio); the dock never changes anyone's own
 * audio sources, only its "App Audio:" inputs.
 */

import { config } from '../config/config.js';
import { ObsSocket, EVENTS } from '../shared/obs.js';
import { createDebug } from '../shared/debug.js';
import {
    buildWindowList, chooseMethod, captureSettings, visibilityChanges,
    litFraction, peakDb, meterZone, pushRecent, parseWindowValue,
    mergeWindowLists, sameWindow, windowCaptureTarget, captureFailed, appAudioName, parseAppAudioName,
    copyableFilters, channelList, newChannel, faderMul, readSetup, guessSetup, tracksObject, activity, cleanTracks
} from './picker.js';

const cfg = config.gamePicker;
const debug = createDebug('gamepicker');
const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);

// Per-viewer conveniences only (recents, per-exe method). The dock works
// without them. Never the password: localStorage is shared by every page on
// the Pages origin, and the password controls all of OBS (Code review, #111).
// It comes from ?password= in the dock URL (OBS keeps that URL in its own
// config, next to the password itself) or the box, held in memory only.
function loadState() {
    try {
        const { recents = [], remembered = {} } = JSON.parse(localStorage.getItem(cfg.storageKey) || '{}');
        return { recents, remembered };
    } catch {
        return { recents: [], remembered: {} };
    }
}
const state = loadState();
function saveState() {
    try { localStorage.setItem(cfg.storageKey, JSON.stringify(state)); } catch { /* private mode */ }
}
let typedPassword = null;

/**
 * The obs-websocket address: ?obs= only to this machine, so a crafted dock
 * link can't send the auth hash elsewhere for an offline guess (#111).
 */
function obsUrl() {
    const asked = params.get('obs');
    if (!asked) return cfg.obs.url;
    try {
        const u = new URL(asked);
        if (u.protocol === 'ws:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) return asked;
    } catch { /* not a URL */ }
    note(`Ignored ?obs=${asked}: only ws://127.0.0.1 or ws://localhost`);
    return cfg.obs.url;
}

let obs = null;
let windowItems = [];        // both captures' lists, merged (mergeWindowLists)
let showing = null;          // { method, value } or { method: 'pinned', name }
let busy = false;
let setup = null;            // readSetup(): the scene, captures and options picked in setup
const acfg = cfg.audio;
let routes = new Map();      // lower-case exe -> { exe, target, inputName }
let saved = {};              // persistent data: { channels, mix } (channelList)
let channels = channelList(saved);
let copyMul = {};            // "copy from" source -> its fader, the default for its channels
const channelEls = new Map(); // channel id -> { row }
const memberOf = new Map();  // App Audio input name -> channel id
const REALM = 'OBS_WEBSOCKET_DATA_REALM_PROFILE';

function setStatus(text, kind = '') {
    const el = $('status');
    el.textContent = text;
    el.className = kind;
    $('dot').className = `dot ${kind}`;
}

function note(text) {
    $('note').textContent = text || '';
}

// ---- connection ----

async function connect() {
    const password = typedPassword ?? params.get('password') ?? '';
    const url = obsUrl();
    obs = new ObsSocket({ url, password, events: EVENTS.ALL | meterBit() });
    obs.on('event', onEvent);
    obs.on('close', ({ reason }) => {
        setStatus(`OBS: ${reason}`, 'bad');
        debug.mark('close', { reason });
        if (reason === 'wrong password') {
            $('auth').hidden = false;
            return;
        }
        // OBS closed or not started yet: keep trying
        setTimeout(connect, cfg.obs.reconnectMs);
    });
    setStatus('Connecting to OBS…');
    try {
        await obs.connect();
    } catch {
        return; // close handler shows why and retries
    }
    $('auth').hidden = true;
    setStatus('Connected to OBS', 'ok');
    debug.mark('connect', { url });
    await start();
}

/** Read the saved setup and everything it points at; ask for one if none. */
async function start() {
    try {
        const { slotValue } = await obs.call('GetPersistentData', { realm: REALM, slotName: cfg.setupSlot });
        setup = readSetup(slotValue, acfg.defaultFaderMaxDb);
    } catch (err) {
        note(`Couldn't read the setup: ${err.message}`);
    }
    if (!setup) {
        await openSetup();
        return;
    }
    document.body.classList.toggle('nosound', !setup.sound);
    renderPinned();
    await Promise.all([refreshWindows(), readShowing(), readChannels().then(readRoutes)]);
}

$('auth').addEventListener('submit', (e) => {
    e.preventDefault();
    typedPassword = $('password').value;
    connect();
});

// Meters cost 20 events a second, so only while the dock is on screen
function meterBit() {
    return document.visibilityState === 'visible' ? EVENTS.INPUT_VOLUME_METERS : 0;
}
document.addEventListener('visibilitychange', () => {
    if (obs?.ready) obs.resubscribe(EVENTS.ALL | meterBit());
    if (document.visibilityState === 'visible' && obs?.ready) refreshWindows();
});

// OBS doesn't announce windows opening or closing, so the dock asks: on a
// timer while it's on screen, and as the pointer arrives. A refresh costs
// about 1 ms with no effect on OBS's frame times (Defiant, 2026-10-30).
// Skipped mid-pick, and while a Sound menu is open
function autoRefresh() {
    const menuOpen = document.activeElement?.matches?.('select.audio');
    if (obs?.ready && !busy && !menuOpen && document.visibilityState === 'visible') refreshWindows();
}
setInterval(autoRefresh, cfg.refreshMs);
document.addEventListener('pointerenter', autoRefresh);

function onEvent({ eventType, eventData }) {
    if (eventType === 'InputVolumeMeters') {
        // A channel's apps mix together on stream, so its meter adds their
        // peaks: the worst case of the mix, not the loudest app (Code
        // review, #118: two loud apps reach about -13 dBFS)
        const mix = new Map();   // channel id -> summed peak multiplier
        for (const input of eventData.inputs) {
            const ch = memberOf.get(input.inputName);
            if (ch) mix.set(ch, (mix.get(ch) || 0) + Math.max(0, ...(input.inputLevelsMul || []).map(c => c?.[1] || 0)));
        }
        // Only whether each channel works: a light, not a meter (AJ,
        // 2026-10-30: "focus on indicators that show it's working")
        for (const [id, m] of channelEls) {
            const act = activity(peakDb([[0, mix.get(id) || 0]], cfg.meterFloorDb), acfg.quietDb);
            m.row.dataset.act = act;
            // Nobody watches the dock live: a channel peak in the red stays
            // flagged until clicked (no clipping ever, docs/AUDIO.md; QA, #116)
            if (act === 'red') m.row.classList.add('clipped');
        }
    } else if (!setup) {
        // nothing to follow until set up
    } else if (eventType === 'SceneItemEnableStateChanged' && eventData.sceneName === setup.scene) {
        readShowing();
    } else if (eventType === 'InputSettingsChanged' && [setup.window, setup.hook].includes(eventData.inputName)) {
        // Changed in the source properties: show what OBS has, not what the
        // dock last set (AJ, 2026-10-30: they disagreed). The lists too, so
        // a window opened since is found (Code review, #114)
        refreshWindows().then(readShowing);
    } else if ((eventType === 'InputCreated' || eventType === 'InputRemoved' || eventType === 'InputNameChanged') && !busy) {
        // An App Audio input added or removed in OBS itself
        readRoutes();
    }
}

// ---- reading OBS ----

async function refreshWindows() {
    if (!setup) return;
    try {
        // A capture the setup leaves out lists nothing
        const list = name => (name
            ? obs.call('GetInputPropertiesListPropertyItems', { inputName: name, propertyName: 'window' }).then(r => r.propertyItems)
            : []);
        const [hookItems, winItems] = await Promise.all([list(setup.hook), list(setup.window)]);
        const next = mergeWindowLists(hookItems, winItems);
        // Redraw only on a change, so rows never jump under the pointer
        if (JSON.stringify(next) === JSON.stringify(windowItems)) return;
        windowItems = next;
        renderShowing();
        renderList();
    } catch (err) {
        note(`Couldn't list windows: ${err.message}`);
    }
}

async function sceneItems() {
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: setup.scene });
    return sceneItems;
}

async function readShowing() {
    if (!setup) return;
    try {
        const items = await sceneItems();
        const on = name => items.some(i => i.sourceName === name && i.sceneItemEnabled);
        const pinned = setup.pinned.find(on);
        if (pinned) {
            showing = { method: 'pinned', name: pinned };
        } else {
            const method = setup.hook && on(setup.hook) ? 'hook' : setup.window && on(setup.window) ? 'window' : null;
            if (method) {
                const { inputSettings } = await obs.call('GetInputSettings', { inputName: setup[method] });
                // A Store app's frame stands for its listed window
                const listed = method === 'window' && windowItems.find(i =>
                    i.itemValue !== inputSettings.window &&
                    windowCaptureTarget(i.itemValue, cfg.windowPriority).value === inputSettings.window);
                showing = { method, value: listed ? listed.itemValue : inputSettings.window };
            } else {
                showing = null;
            }
        }
        renderShowing();
        renderPinned();
        renderList();
    } catch (err) {
        note(`Couldn't read ${setup.scene}: ${err.message}`);
    }
}

/** One channel row: a working light, name, fader, dB and buttons. */
function chanRow(label, sub) {
    const row = document.createElement('div');
    row.className = 'chan';
    row.dataset.act = 'idle';
    row.innerHTML = '<span class="sig" aria-hidden="true"></span><span class="name"><b></b><span class="apps"></span></span>' +
        '<span class="track"></span><span class="db"></span><span class="btns"></span>';
    row.querySelector('b').textContent = label;
    row.querySelector('.apps').textContent = sub;
    return row;
}

// Chip colours for the Sound menus, one per channel in turn
const CHIPS = [['#4fd18b', '#1f3a2c', '#bff0d4'], ['#e3a43a', '#3a2a14', '#f6dcae'], ['#6ea8ff', '#1f2c44', '#cfe0ff'],
    ['#e07ad8', '#3a1f3a', '#f6cff2'], ['#4fd1d1', '#173538', '#c4f2f2']];
function chipOf(id) {
    const i = channels.findIndex(c => c.id === id);
    return i < 0 ? null : CHIPS[i % CHIPS.length];
}

// ---- channels ----

/** Channels and their faders, from OBS's persistent data. */
async function readChannels() {
    try {
        const { slotValue } = await obs.call('GetPersistentData', { realm: REALM, slotName: acfg.dataSlot });
        saved = slotValue && typeof slotValue === 'object' ? slotValue : {};
    } catch (err) {
        note(`Couldn't read the audio channels: ${err.message}`);
    }
    channels = channelList(saved);
    await readCopyMul();
}

async function readCopyMul() {
    copyMul = {};
    for (const t of new Set(channels.map(c => c.copyFrom).filter(Boolean))) {
        try {
            copyMul[t] = (await obs.call('GetInputVolume', { inputName: t })).inputVolumeMul;
        } catch { /* source gone: its channels start at the fader max */ }
    }
}

async function saveChannels() {
    saved = {
        channels: channels.map(({ id, label, tracks, copyFrom }) => ({ id, label, tracks, copyFrom })),
        mix: Object.fromEntries(channels.filter(c => c.volumeMul !== null || c.muted)
            .map(c => [c.id, { volumeMul: c.volumeMul, muted: c.muted }]))
    };
    await obs.call('SetPersistentData', { realm: REALM, slotName: acfg.dataSlot, slotValue: saved });
}

/** A channel's fader: its own once moved, else its copy-from source's, under the fader max. */
function channelMul(c) {
    const max = faderMul(setup.faderMaxDb, cfg.meterFloorDb, setup.faderMaxDb);
    return Math.min(c.volumeMul ?? copyMul[c.copyFrom] ?? max, max);
}

const tracksText = t => (t ? `track${t.length > 1 ? 's' : ''} ${t.join(',')}` : 'all tracks');

const toDb = mul => (mul > 0 ? 20 * Math.log10(mul) : cfg.meterFloorDb);

function members(id) {
    return [...routes.values()].filter(r => r.target === id && r.live);
}

function renderChannels() {
    const box = $('channels');
    box.textContent = '';
    channelEls.clear();
    for (const c of channels) {
        const n = members(c.id).length;
        const row = chanRow(c.label, `${n ? `${n} app${n > 1 ? 's' : ''}` : 'empty'} · ${tracksText(c.tracks)}`);
        row.classList.toggle('muted', c.muted);
        row.style.setProperty('--chip', chipOf(c.id)?.[0] || 'var(--line)');
        row.title = `${c.label}: ${n ? members(c.id).map(r => r.exe).join(', ') : 'no apps yet'}. ` +
            `${c.copyFrom ? `Copies ${c.copyFrom}'s filters. ` : ''}Light: green while sound plays; red means too loud (turn it down, then click to clear)`;
        row.addEventListener('click', () => row.classList.remove('clipped'));
        const name = row.querySelector('.name');
        name.title = `Change ${c.label}'s tracks or what it copies`;
        name.style.cursor = 'pointer';
        name.addEventListener('click', () => showNewForm(true, c));
        const fader = document.createElement('input');
        fader.type = 'range';
        fader.className = 'fader';
        fader.min = String(cfg.meterFloorDb);
        fader.max = String(setup.faderMaxDb);
        fader.step = '0.5';
        fader.value = String(toDb(channelMul(c)));
        fader.setAttribute('aria-label', `${c.label} volume`);
        fader.title = `${c.label} volume, at most ${setup.faderMaxDb} dB (the setup's fader max). Several loud apps together add up`;
        row.querySelector('.track').append(fader);
        const db = row.querySelector('.db');
        const showDb = () => { db.textContent = Number(fader.value).toFixed(1); };
        showDb();
        fader.addEventListener('input', showDb);
        fader.addEventListener('change', () => setChannelMix(c.id, { volumeMul: faderMul(fader.value, cfg.meterFloorDb, setup.faderMaxDb) }));
        const btns = row.querySelector('.btns');
        const mute = document.createElement('button');
        mute.type = 'button';
        mute.className = 'mute';
        mute.textContent = 'Mute';
        mute.setAttribute('aria-pressed', String(c.muted));
        mute.title = c.muted ? `${c.label} is muted: click to unmute` : `Mute ${c.label}`;
        mute.addEventListener('click', (e) => { e.stopPropagation(); setChannelMix(c.id, { muted: !c.muted }); });
        btns.append(mute);
        {
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'del';
            del.textContent = '✕';
            del.title = `Remove the ${c.label} channel (its apps go off stream)`;
            del.setAttribute('aria-label', del.title);
            del.addEventListener('click', (e) => { e.stopPropagation(); removeChannel(c.id); });
            btns.append(del);
        }
        box.append(row);
        channelEls.set(c.id, { row });
    }
}

/** Move a channel's fader or mute: every app in it, then remember it. */
async function setChannelMix(id, change) {
    if (busy || !obs?.ready) {
        renderChannels();   // put the fader back where OBS has it
        return;
    }
    busy = true;
    document.body.classList.add('busy');
    try {
        const c = channels.find(x => x.id === id);
        Object.assign(c, change);
        for (const r of members(id)) await applyMix(r.inputName, c);
        await saveChannels();
        debug.mark('mix', { id, ...change });
    } catch (err) {
        note(`Couldn't change the channel: ${err.message}`);
    } finally {
        busy = false;
        document.body.classList.remove('busy');
        renderChannels();
    }
}

async function applyMix(inputName, c) {
    await obs.call('SetInputVolume', { inputName, inputVolumeMul: channelMul(c) });
    await obs.call('SetInputMute', { inputName, inputMuted: c.muted });
}

async function addChannel(name, opts) {
    if (busy || !obs?.ready) return;
    const made = newChannel(name, channels, opts);
    if (made.error) {
        note(made.error);
        return;
    }
    busy = true;
    document.body.classList.add('busy');
    try {
        channels = [...channels, { ...made.channel, volumeMul: null, muted: false }];
        await readCopyMul();
        await saveChannels();
        $('channelName').value = '';
        showNewForm(false);
        note(`Made the ${made.channel.label} channel. Pick it in an app's Sound menu.`);
    } catch (err) {
        note(`Couldn't make the channel: ${err.message}`);
        await readChannels();
    } finally {
        busy = false;
        document.body.classList.remove('busy');
        renderChannels();
        renderList();
    }
}

async function removeChannel(id) {
    if (busy || !obs?.ready) return;
    busy = true;
    document.body.classList.add('busy');
    const c = channels.find(x => x.id === id);
    try {
        for (const r of [...routes.values()].filter(x => x.target === id)) await removeRoute(r);
        channels = channels.filter(x => x.id !== id);
        await saveChannels();
        note(`Removed the ${c.label} channel.`);
    } catch (err) {
        note(`Couldn't remove ${c.label}: ${err.message}`);
    } finally {
        busy = false;
        document.body.classList.remove('busy');
        await readRoutes();
    }
}

let editing = null;   // id of the channel the form edits, or null to add one

/**
 * The channel form: open to add a channel, or with `channel` to change an
 * existing one's tracks and what it copies (its name ends its apps' input
 * names, so it stays). Changes reach apps that join from then on.
 */
async function showNewForm(open, channel = null) {
    editing = open && channel ? channel.id : null;
    $('newChannel').hidden = !open;
    $('newToggle').setAttribute('aria-expanded', String(open));
    $('newToggle').textContent = open ? 'Cancel' : '+ New';
    $('channelName').readOnly = !!editing;
    $('channelName').value = editing ? channel.label : '';
    $('newChannel').querySelector('button[type=submit]').textContent = editing ? 'Save' : 'Add';
    if (!open) return;
    await fillChannelForm();
    if (editing) {
        $('channelCopy').value = channel.copyFrom || '';
        for (const i of document.querySelectorAll('#channelTracks input')) i.checked = channel.tracks ? channel.tracks.includes(Number(i.value)) : false;
        // Nothing set yet: suggest the audio source named like the channel
        // ("Music" -> a source with "music" in its name), with its tracks,
        // for the streamer to check and save (QA, #120)
        if (!channel.copyFrom && !channel.tracks) {
            const word = channel.label.toLowerCase();
            const like = [...$('channelCopy').options].find(o => o.value && o.value.toLowerCase().includes(word));
            if (like) {
                $('channelCopy').value = like.value;
                await tickTracksOf(like.value);
            }
        }
    } else {
        $('channelName').focus();
    }
}

/** Change a channel's tracks and copied source, then remember it. */
async function updateChannel(id, { tracks, copyFrom }) {
    if (busy || !obs?.ready) return;
    const c = channels.find(x => x.id === id);
    const clean = cleanTracks(tracks);
    if (!c) return;
    if (!clean) {
        note('Tick at least one track.');
        return;
    }
    busy = true;
    document.body.classList.add('busy');
    try {
        Object.assign(c, { tracks: clean, copyFrom: copyFrom || null });
        await readCopyMul();
        await saveChannels();
        showNewForm(false);
        note(`${c.label} plays on ${tracksText(clean)} for apps added from now on.`);
    } catch (err) {
        note(`Couldn't change ${c.label}: ${err.message}`);
    } finally {
        busy = false;
        document.body.classList.remove('busy');
        renderChannels();
    }
}

/** The new-channel form: any audio source to start from, and tracks 1-6. */
async function fillChannelForm() {
    const box = $('channelTracks');
    if (!box.querySelector('input')) {
        for (let n = 1; n <= 6; n++) {
            box.insertAdjacentHTML('beforeend', `<label title="Track ${n}"><input type="checkbox" value="${n}"${n === 1 ? ' checked' : ''}>${n}</label>`);
        }
    }
    const sel = $('channelCopy');
    try {
        const { inputs } = await obs.call('GetInputList', {});
        const keep = sel.value;
        sel.length = 1;
        for (const i of inputs.filter(i => isAudioKind(i.inputKind) && !i.inputName.startsWith(acfg.prefix))) {
            sel.add(new Option(i.inputName, i.inputName));
        }
        sel.value = keep;
    } catch { /* Plain still works */ }
}

/** Tick the tracks a source plays on: a copied channel starts there. */
async function tickTracksOf(name) {
    try {
        const { inputAudioTracks } = await obs.call('GetInputAudioTracks', { inputName: name });
        for (const i of document.querySelectorAll('#channelTracks input')) i.checked = !!inputAudioTracks[i.value];
    } catch { /* keep what's ticked */ }
}
$('channelCopy').addEventListener('change', () => $('channelCopy').value && tickTracksOf($('channelCopy').value));

// Inputs that carry sound: audio devices, app and media sources
const isAudioKind = k => /wasapi|pulse|coreaudio|alsa|jack|ffmpeg|vlc|sck_audio|asio|process_output/.test(k || '');
$('newToggle').addEventListener('click', () => showNewForm($('newChannel').hidden));
$('newChannel').addEventListener('submit', (e) => {
    e.preventDefault();
    const tracks = [...document.querySelectorAll('#channelTracks input:checked')].map(i => Number(i.value));
    const copyFrom = $('channelCopy').value || null;
    if (editing) updateChannel(editing, { tracks, copyFrom });
    else addChannel($('channelName').value, { tracks, copyFrom });
});

/**
 * The dock's App Audio inputs, by app, from the Audio scene: an input there
 * is on stream whatever else OBS says about it.
 */
async function readRoutes() {
    try {
        if (!setup?.sound) return;
        const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: setup.audioScene });
        routes = new Map();
        for (const { sourceName, sceneItemId, sceneItemEnabled } of sceneItems) {
            const parsed = parseAppAudioName(sourceName, acfg.prefix);
            if (!parsed) continue;
            // An input whose channel isn't saved (an older dock made it)
            // still shows, as a plain channel of its own, so it can be moved
            // or taken off
            let ch = channels.find(c => c.label === parsed.label);
            if (!ch) {
                const made = newChannel(parsed.label, channels).channel;
                if (!made) continue;
                ch = { ...made, label: parsed.label, volumeMul: null, muted: false };
                channels.push(ch);
            }
            const r = { exe: parsed.exe, target: ch.id };
            const key = r.exe.toLowerCase();
            const route = routes.get(key) || { ...r, inputName: sourceName, items: [], live: false };
            route.items.push({ sceneItemId, inputName: sourceName });
            route.live ||= sceneItemEnabled;
            routes.set(key, route);
        }
        // A hidden input is half made (or hidden by hand): it plays nothing,
        // so the menu says off; choosing a channel replaces it
        memberOf.clear();
        for (const route of routes.values()) {
            if (route.live) memberOf.set(route.inputName, route.target);
            else route.target = 'off';
        }
        renderChannels();
        renderList();
    } catch (err) {
        note(`Couldn't read app audio: ${err.message}`);
    }
}

/**
 * Take an app's sound off stream. RemoveInput alone reports success but
 * leaves the input in the Audio scene, still capturing (Defiant, OBS 33,
 * 2026-10-30), so the scene item goes first; then it checks it's gone.
 */
async function removeRoute(route) {
    for (const { sceneItemId, inputName } of route.items) {
        await obs.call('RemoveSceneItem', { sceneName: setup.audioScene, sceneItemId });
        await obs.call('RemoveInput', { inputName }).catch(() => { /* already gone with its last item */ });
    }
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: setup.audioScene });
    const left = sceneItems.filter(i => route.items.some(r => r.inputName === i.sourceName));
    if (left.length) throw new Error(`${left[0].sourceName} is still in ${setup.audioScene}`);
}

/**
 * Give an app's input its channel's tracks and filters: the channel's own
 * tracks, else those of the source it copies, else those of an app already
 * in it, else OBS's defaults; filters from the copied source, else from an
 * app already in it. Copying a member keeps a channel whole when its
 * settings weren't saved (an older dock's Game and Music, or one adopted
 * from an input name): the next app matches the ones there instead of
 * landing on every track with no limiter (Code review, #120). Volume and
 * mute come from the channel (applyMix).
 */
async function setUpInput(inputName, c) {
    // The app still plays to its own device, so monitoring would double it
    await obs.call('SetInputAudioMonitorType', { inputName, monitorType: 'OBS_MONITORING_TYPE_NONE' });
    let inputAudioTracks = c.tracks ? tracksObject(c.tracks) : null;
    const like = c.copyFrom || members(c.id).find(r => r.inputName !== inputName)?.inputName;
    if (like) {
        const [{ inputAudioTracks: copied }, { filters }] = await Promise.all([
            obs.call('GetInputAudioTracks', { inputName: like }),
            obs.call('GetSourceFilterList', { sourceName: like })
        ]);
        inputAudioTracks ??= copied;
        for (const f of copyableFilters(filters, acfg.skipFilterKinds)) {
            await obs.call('CreateSourceFilter', {
                sourceName: inputName, filterName: f.filterName, filterKind: f.filterKind, filterSettings: f.filterSettings
            });
            if (f.filterEnabled === false) {
                await obs.call('SetSourceFilterEnabled', { sourceName: inputName, filterName: f.filterName, filterEnabled: false });
            }
        }
    }
    if (inputAudioTracks) await obs.call('SetInputAudioTracks', { inputName, inputAudioTracks });
}

/**
 * Send an app's sound to a channel (by id) or take it off stream ('off').
 * Replaces the app's App Audio input with one set up for the channel, at
 * the channel's fader and mute.
 */
async function setRoute(win, target) {
    if (busy || !obs?.ready) return;
    busy = true;
    document.body.classList.add('busy');
    const key = win.exe.toLowerCase();
    try {
        const old = routes.get(key);
        if (old) await removeRoute(old);
        const t = channels.find(c => c.id === target);
        // Nothing to say where it plays (no tracks, nothing copied, no app
        // already in it): OBS would put it on every track, the VOD too, with
        // no limiter, so ask first (Code review, #120)
        if (t && !t.tracks && !t.copyFrom && !members(t.id).some(r => r.exe.toLowerCase() !== key)) {
            note(`Pick ${t.label}'s tracks first (or a source to copy), then choose it again for ${win.exe}.`);
            showNewForm(true, t);
            return;
        }
        if (t) {
            const inputName = appAudioName(acfg.prefix, win.exe, t.label);
            // Hidden until it has the channel's tracks, volume and filters:
            // a new input plays on every track at 0 dB with no limiter
            // (Code review, #116)
            const { sceneItemId } = await obs.call('CreateInput', {
                sceneName: setup.audioScene,
                inputName,
                inputKind: 'wasapi_process_output_capture',
                inputSettings: { window: win.value, priority: cfg.windowPriority },
                sceneItemEnabled: false
            });
            try {
                await setUpInput(inputName, t);
                await applyMix(inputName, t);
            } catch (err) {
                await removeRoute({ items: [{ sceneItemId, inputName }] }).catch(() => {});
                throw err;
            }
            await obs.call('SetSceneItemEnabled', { sceneName: setup.audioScene, sceneItemId, sceneItemEnabled: true });
            note(`${win.exe} sound now goes to ${t.label} (${tracksText(t.tracks)}).`);
        } else {
            note(`${win.exe} sound is off stream (you still hear it).`);
        }
        debug.mark('route', { exe: win.exe, target });
    } catch (err) {
        note(`Couldn't route ${win.exe} audio: ${err.message}`);
    } finally {
        busy = false;
        document.body.classList.remove('busy');
        await readRoutes();
    }
}

async function screenshot(sourceName, width, format = 'jpg') {
    const { imageData } = await obs.call('GetSourceScreenshot', {
        sourceName, imageFormat: format, imageWidth: width, imageCompressionQuality: 70
    });
    return imageData;
}

/** Lit share of a small screenshot of one input, or null if it can't be read. */
async function litOf(sourceName) {
    try {
        const data = await screenshot(sourceName, 64, 'png');
        const img = new Image();
        img.src = data;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return litFraction(ctx.getImageData(0, 0, c.width, c.height).data, cfg.litLuma);
    } catch {
        return null;
    }
}

async function showPreview() {
    try {
        $('preview').src = await screenshot(setup.scene, cfg.previewWidth);
        $('preview').hidden = false;
    } catch (err) {
        note(`No preview: ${err.message}`);
    }
}

// ---- changing OBS ----

async function show(target) {
    const changes = visibilityChanges(await sceneItems(), target, {
        sources: [setup.window, setup.hook, ...setup.pinned].filter(Boolean), hideOthers: setup.hideOthers
    });
    for (const c of changes) {
        await obs.call('SetSceneItemEnabled', {
            sceneName: setup.scene, sceneItemId: c.sceneItemId, sceneItemEnabled: c.enabled
        });
    }
    debug.mark('show', { target, changes });
}

/** The captures' windows and which items show, to undo a pick. */
async function snapshot() {
    const settings = name => (name ? obs.call('GetInputSettings', { inputName: name }).then(r => r.inputSettings) : null);
    const [items, hook, win] = await Promise.all([sceneItems(), settings(setup.hook), settings(setup.window)]);
    return { items, hook, window: win };
}

async function restore(before) {
    if (!before) return;
    for (const method of ['hook', 'window']) {
        if (setup[method]) await obs.call('SetInputSettings', { inputName: setup[method], inputSettings: before[method], overlay: true });
    }
    const now = await sceneItems();
    for (const it of before.items) {
        const cur = now.find(i => i.sceneItemId === it.sceneItemId);
        if (cur && cur.sceneItemEnabled !== it.sceneItemEnabled) {
            await obs.call('SetSceneItemEnabled', { sceneName: setup.scene, sceneItemId: it.sceneItemId, sceneItemEnabled: it.sceneItemEnabled });
        }
    }
    debug.mark('restore', {});
}

async function capture(method, value) {
    await obs.call('SetInputSettings', {
        inputName: setup[method],
        inputSettings: captureSettings(method, value, cfg.windowPriority),
        overlay: true
    });
    await show(setup[method]);
    showing = { method, value };
}

/**
 * Point the capture at a window. With no `forced` method, a hook capture
 * that shows black is switched to window capture once, and remembered.
 */
async function pick(win, forced) {
    if (busy || !obs?.ready) return;
    busy = true;
    document.body.classList.add('busy');
    const exe = win.exe.toLowerCase();
    let before = null;
    try {
        // Fresh lists first: a window restored a moment ago is in the window
        // capture's list now (Defiant, 2026-10-30: it took a second click)
        await refreshWindows();
        const now = windowItems.find(i => i.itemValue === win.value) || windowItems.find(i => sameWindow(i.itemValue, win.value));
        if (!now) {
            note(`${win.exe} has closed.`);
            return;
        }
        win = { ...win, value: now.itemValue, inHook: now.inHook, inWindow: now.inWindow };
        const method = forced || chooseMethod(exe, { remembered: state.remembered, inHook: win.inHook, inWindow: win.inWindow });
        // What the scene shows now, to put back if nothing captures the window
        // (a minimised window used to leave the game feed black)
        before = await snapshot();
        note(`Capturing ${win.exe}…`);
        await capture(method, win.value);
        state.recents = pushRecent(state.recents, exe, cfg.recentMax);
        if (forced) state.remembered[exe] = forced;
        saveState();
        renderShowing();
        renderList();

        // Look twice before calling it failed, so a game on a loading screen
        // isn't switched and remembered for good (QA, #111). No picture at
        // all (null) counts: that's how a hook that never attached looks
        // (Defiant, 2026-10-30)
        const failed = l => captureFailed(l, cfg.minLit);
        await new Promise(r => setTimeout(r, cfg.blackCheckMs));
        let lit = await litOf(setup[method]);
        if (failed(lit)) {
            note(`No picture from ${win.exe} yet, checking again…`);
            await new Promise(r => setTimeout(r, cfg.blackCheckMs));
            lit = await litOf(setup[method]);
        }
        debug.mark('pick', { exe, method, forced: !!forced, lit });
        const other = method === 'hook' ? 'window' : 'hook';
        const otherSees = other === 'hook' ? win.inHook : win.inWindow;
        if (failed(lit) && !forced && otherSees) {
            await capture(other, win.value);
            await new Promise(r => setTimeout(r, cfg.blackCheckMs));
            const lit2 = await litOf(setup[other]);
            debug.mark('fallback', { exe, method: other, lit: lit2 });
            if (!failed(lit2)) {
                state.remembered[exe] = other;
                saveState();
                note(`The ${CAPTURE_NAME[method]} showed nothing for ${win.exe}, so it uses the ${CAPTURE_NAME[other]} now (remembered).`);
            } else {
                await restore(before);
                note(`Neither capture shows ${win.exe}, so the picture stays as it was. Is it minimised? Restore it and pick it again.`);
            }
        } else if (failed(lit) && !win.inWindow) {
            await restore(before);
            note(`${win.exe} looks minimised (only the game hook lists it), so the picture stays as it was. Restore the window and pick it again.`);
        } else if (failed(lit)) {
            note(`${win.exe} shows nothing. If it's minimised or loading, bring it up; otherwise try the other mode (⇄).`);
        } else {
            note('');
        }
        await readShowing();
        await showPreview();
    } catch (err) {
        note(`Couldn't capture ${win.exe}: ${err.message}`);
    } finally {
        busy = false;
        document.body.classList.remove('busy');
    }
}

/** Show one of the sources pinned in setup (a capture card, a camera). */
async function pickPinned(name) {
    if (busy || !obs?.ready) return;
    try {
        note('');
        await show(name);
        showing = { method: 'pinned', name };
        renderShowing();
        renderPinned();
        renderList();
        await new Promise(r => setTimeout(r, 300));
        await showPreview();
    } catch (err) {
        note(`Couldn't show ${name}: ${err.message}`);
    }
}

// ---- rendering ----

const METHOD_LABEL = { hook: 'game hook', window: 'window' };
const CAPTURE_NAME = { hook: 'game hook', window: 'window capture' };
const SWAP_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<path d="M2 4.5h9M8.5 2l2.5 2.5L8.5 7M12 9.5H3M5.5 7L3 9.5 5.5 12"/></svg>';

function renderShowing() {
    const el = $('showing');
    el.classList.remove('missing');
    if (!showing) {
        el.textContent = `Nothing is showing in ${setup.scene}`;
        return;
    }
    if (showing.method === 'pinned') {
        el.textContent = `Showing: ${showing.name}`;
        return;
    }
    const w = parseWindowValue(showing.value);
    const flag = showing.method === 'hook' ? 'inHook' : 'inWindow';
    const open = windowItems.some(i => i[flag] && sameWindow(i.itemValue, showing.value));
    el.textContent = `Showing: ${w.exe || '?'} (${METHOD_LABEL[showing.method]})${open || !windowItems.length ? '' : ' - window not found'}`;
    el.classList.toggle('missing', !open && windowItems.length > 0);
    el.title = w.title;
}

function renderList() {
    const list = buildWindowList(windowItems, {
        ignoreExes: cfg.ignoreExes,
        recents: state.recents,
        showAll: $('showAll').checked,
        query: $('search').value
    });
    const ul = $('windows');
    ul.textContent = '';
    const exact = showing && list.some(w => w.value === showing.value);
    for (const w of list) {
        const method = chooseMethod(w.exe, { remembered: state.remembered, inHook: w.inHook, inWindow: w.inWindow });
        const li = document.createElement('li');
        // Exact value first; exe + class only when the title has changed, so
        // two Firefox windows don't both light up (QA, #114)
        const current = showing && showing.method !== 'pinned' &&
            (exact ? w.value === showing.value : sameWindow(showing.value, w.value));
        li.className = `${current ? 'current' : ''}${w.inWindow ? '' : ' min'}`.trim();
        const main = document.createElement('button');
        main.className = 'pick';
        // Window title first, the app under it (AJ, 2026-10-30)
        main.innerHTML = '<span class="title"></span><span class="exe"></span>';
        main.querySelector('.title').textContent = `${w.recent ? '★ ' : ''}${w.title || w.exe}`;
        main.querySelector('.exe').textContent = w.inWindow ? w.exe : `${w.exe} · minimised? restore it`;
        const ico = document.createElement('span');
        ico.className = 'ico';
        ico.setAttribute('aria-hidden', 'true');
        ico.textContent = (w.exe.replace(/\.exe$/i, '').match(/[a-z0-9]/i)?.[0] || '?').toUpperCase();
        ico.style.setProperty('--hue', String(hueOf(w.exe)));
        main.title = `Capture with ${METHOD_LABEL[method]}`;
        main.addEventListener('click', () => pick(w));
        const other = method === 'hook' ? 'window' : 'hook';
        const canSwap = other === 'hook' ? w.inHook : w.inWindow;
        const swap = document.createElement('button');
        swap.disabled = !canSwap;
        swap.type = 'button';
        swap.className = 'swap';
        swap.hidden = !setup[other];   // only one capture set up: nothing to swap to
        swap.innerHTML = SWAP_ICON;
        swap.setAttribute('aria-label', `Use ${CAPTURE_NAME[other]}`);
        swap.title = canSwap
            ? `Capture with ${METHOD_LABEL[other]} instead, and remember it for ${w.exe}`
            : `The ${METHOD_LABEL[other]} can't see this window`;
        swap.addEventListener('click', () => pick(w, other));
        // Where this app's sound goes: one App Audio input per app
        const route = routes.get(w.exe.toLowerCase());
        const sel = document.createElement('select');
        sel.className = 'audio';
        sel.title = `Where ${w.exe}'s sound goes on stream. Channels marked "off VOD" in the mixer stay off the VOD track`;
        for (const [value, label] of [['off', 'Off'], ...channels.map(c => [c.id, c.label])]) {
            const o = document.createElement('option');
            o.value = value;
            o.textContent = label;
            sel.appendChild(o);
        }
        sel.value = route?.target || 'off';
        const chip = route && chipOf(route.target);
        if (chip) ['--chip', '--chip-bg', '--chip-text'].forEach((v, i) => sel.style.setProperty(v, chip[i]));
        sel.addEventListener('change', () => setRoute(w, sel.value));
        li.append(ico, main, sel, swap);
        ul.appendChild(li);
    }
    if (list.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = windowItems.length ? 'No match. Tick "show all"?' : 'No windows listed yet';
        ul.appendChild(li);
    }
}

/** A steady colour per app for its letter tile: OBS can't hand a dock app icons. */
function hueOf(exe) {
    let h = 0;
    for (const ch of exe.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
}

/** One button per source pinned in setup, lit when it's the one showing. */
function renderPinned() {
    const box = $('pinned');
    box.textContent = '';
    for (const name of setup?.pinned || []) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = name;
        b.title = `Show ${name} and hide the captures`;
        b.classList.toggle('on', showing?.method === 'pinned' && showing.name === name);
        b.addEventListener('click', () => pickPinned(name));
        box.append(b);
    }
}

// ---- setup ----

let setupScenes = [];   // [{sceneName, items}] read when setup opens

/**
 * Show the setup form, filled in from the saved setup or a guess from the
 * scenes in OBS. Changes nothing in OBS until Save.
 */
async function openSetup() {
    $('setupError').textContent = '';
    $('setupCancel').hidden = !setup;
    $('setupHint').textContent = setup ? 'Change what the dock drives, then save.' : 'Filled in from your OBS. Check it, then save.';
    try {
        const { scenes } = await obs.call('GetSceneList');
        // OBS lists scenes bottom first
        setupScenes = await Promise.all([...scenes].reverse().map(async ({ sceneName }) => ({
            sceneName,
            items: await Promise.all((await obs.call('GetSceneItemList', { sceneName })).sceneItems.map(async (i) => {
                // A capture pointed at a window beats an empty duplicate
                if (i.inputKind !== 'window_capture' && i.inputKind !== 'game_capture') return i;
                const { inputSettings } = await obs.call('GetInputSettings', { inputName: i.sourceName }).catch(() => ({ inputSettings: {} }));
                return { ...i, hasWindow: !!inputSettings.window };
            }))
        })));
    } catch (err) {
        $('setupError').textContent = `Couldn't read your scenes: ${err.message}`;
    }
    const s = setup || guessSetup(setupScenes, acfg.defaultFaderMaxDb);
    const names = setupScenes.map(sc => sc.sceneName);
    fill($('setScene'), names.map(n => [n, n]), s.scene);
    fill($('setAudioScene'), names.map(n => [n, n]), s.audioScene || s.scene);
    $('setHideOthers').checked = s.hideOthers;
    $('setSound').checked = s.sound;
    $('setMaxDb').value = String(s.faderMaxDb);
    fillSceneParts(s);
    $('setup').hidden = false;
}

function fill(sel, options, value) {
    sel.length = 0;
    for (const [v, label] of options) sel.add(new Option(label, v));
    sel.value = value ?? '';
}

/** The capture menus and pinned list for the scene picked in the form. */
function fillSceneParts(s) {
    const items = setupScenes.find(sc => sc.sceneName === $('setScene').value)?.items || [];
    const of = kind => items.filter(i => i.inputKind === kind).map(i => [i.sourceName, i.sourceName]);
    const wins = of('window_capture'), hooks = of('game_capture');
    fill($('setWindow'), [['', 'None'], ...wins], wins.some(([n]) => n === s.window) ? s.window : wins[0]?.[0] ?? '');
    fill($('setHook'), [['', 'None'], ...hooks], hooks.some(([n]) => n === s.hook) ? s.hook : hooks[0]?.[0] ?? '');
    const box = $('setPinned');
    box.textContent = '';
    for (const it of items) {
        if (it.inputKind === 'window_capture' || it.inputKind === 'game_capture' || isAudioKind(it.inputKind)) continue;
        const label = document.createElement('label');
        label.className = 'check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = it.sourceName;
        cb.checked = (s.pinned || []).includes(it.sourceName);
        label.append(cb, ` ${it.sourceName}`);
        box.append(label);
    }
}

$('setScene').addEventListener('change', () => {
    fillSceneParts({ pinned: [] });
    $('setAudioScene').value = $('setScene').value;
});
$('setupCancel').addEventListener('click', () => { $('setup').hidden = true; });
$('setup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const next = readSetup({
        scene: $('setScene').value,
        window: $('setWindow').value,
        hook: $('setHook').value,
        pinned: [...document.querySelectorAll('#setPinned input:checked')].map(i => i.value),
        hideOthers: $('setHideOthers').checked,
        sound: $('setSound').checked,
        audioScene: $('setAudioScene').value,
        faderMaxDb: Number($('setMaxDb').value)
    }, acfg.defaultFaderMaxDb);
    if (!next) {
        $('setupError').textContent = 'Pick a scene with a window capture or a game capture (add one in OBS first).';
        return;
    }
    try {
        await obs.call('SetPersistentData', { realm: REALM, slotName: cfg.setupSlot, slotValue: next });
        $('setup').hidden = true;
        debug.mark('setup', next);
        await start();
    } catch (err) {
        $('setupError').textContent = `Couldn't save: ${err.message}`;
    }
});

$('search').addEventListener('input', renderList);
$('showAll').addEventListener('change', renderList);
$('refresh').addEventListener('click', () => obs?.ready && refreshWindows());
$('setupBtn').addEventListener('click', () => obs?.ready && openSetup());
$('preview').addEventListener('click', () => obs?.ready && showPreview());
// Short docks show one half at a time
for (const [id, tab] of [['tabWindows', 'windows'], ['tabSound', 'sound']]) {
    $(id).addEventListener('click', () => {
        document.body.dataset.tab = tab;
        $('tabWindows').setAttribute('aria-selected', String(tab === 'windows'));
        $('tabSound').setAttribute('aria-selected', String(tab === 'sound'));
    });
}

connect();
