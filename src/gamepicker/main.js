/**
 * Game picker dock: lists open windows and points the 16:9 Game capture at
 * one in a click. Runs as an OBS Custom Browser Dock and talks to OBS over
 * obs-websocket (docs/SCENES.md, "gamepicker"). Each window can also send
 * its app's sound to an audio channel: Game, Music or one AJ made in the
 * dock (config.gamePicker.audio); the dock never changes AJ's own audio
 * sources, only its "App Audio:" inputs.
 */

import { config } from '../config/config.js';
import { ObsSocket, EVENTS } from '../shared/obs.js';
import { createDebug } from '../shared/debug.js';
import {
    buildWindowList, chooseMethod, captureSettings, visibilityChanges,
    litFraction, peakDb, meterZone, pushRecent, parseWindowValue,
    mergeWindowLists, sameWindow, windowCaptureTarget, captureFailed, appAudioName, parseAppAudioName,
    copyableFilters, channelList, newChannel, faderMul
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
let showing = null;          // { method, value } or { method: 'console' }
let busy = false;
const meterEls = new Map();  // inputName -> { bar, label, row }
const acfg = cfg.audio;
let routes = new Map();      // lower-case exe -> { exe, target, inputName }
let saved = {};              // persistent data: { custom, mix } (channelList)
let channels = channelList(acfg.targets, saved);
let templateMul = {};        // template source -> its fader, the default for its channels
const channelEls = new Map(); // channel id -> { row, bar }
const memberOf = new Map();  // App Audio input name -> channel id
const REALM = 'OBS_WEBSOCKET_DATA_REALM_PROFILE';
const byId = () => Object.fromEntries(channels.map(c => [c.id, c]));

function setStatus(text, kind = '') {
    const el = $('status');
    el.textContent = text;
    el.className = `status ${kind}`;
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

function onEvent({ eventType, eventData }) {
    if (eventType === 'InputVolumeMeters') {
        const loudest = new Map();   // channel id -> loudest member, dB
        for (const input of eventData.inputs) {
            const db = peakDb(input.inputLevelsMul, cfg.meterFloorDb);
            const ch = memberOf.get(input.inputName);
            if (ch) loudest.set(ch, Math.max(loudest.get(ch) ?? cfg.meterFloorDb, db));
            const m = meterEls.get(input.inputName);
            if (m) showLevel(m, db);
        }
        for (const [id, m] of channelEls) {
            showLevel(m, loudest.get(id) ?? cfg.meterFloorDb);
            // AJ won't be watching the dock live: a channel peak in the red
            // stays flagged until clicked (no clipping ever, docs/AUDIO.md;
            // QA, #116)
            if (m.bar.dataset.zone === 'red') m.row.classList.add('clipped');
        }
    } else if (eventType === 'InputMuteStateChanged') {
        const m = meterEls.get(eventData.inputName);
        if (m) m.row.classList.toggle('muted', eventData.inputMuted);
    } else if (eventType === 'SceneItemEnableStateChanged' && eventData.sceneName === cfg.scene) {
        readShowing();
    } else if (eventType === 'InputSettingsChanged' && Object.values(cfg.sources).includes(eventData.inputName)) {
        // Changed in the source properties: show what OBS has, not what the
        // dock last set (AJ, 2026-10-30: they disagreed). The lists too, so
        // a window opened since is found (Code review, #114)
        refreshWindows().then(readShowing);
    } else if ((eventType === 'InputCreated' || eventType === 'InputRemoved' || eventType === 'InputNameChanged') && !busy) {
        // An App Audio input added or removed in OBS itself
        readRoutes();
    }
}

function showLevel(m, db) {
    const pct = 100 * (db - cfg.meterFloorDb) / -cfg.meterFloorDb;
    m.bar.style.width = `${pct.toFixed(1)}%`;
    m.bar.dataset.zone = meterZone(db);
}

// ---- reading OBS ----

async function refreshWindows() {
    try {
        const list = name => obs.call('GetInputPropertiesListPropertyItems', { inputName: name, propertyName: 'window' })
            .then(r => r.propertyItems);
        const [hookItems, winItems] = await Promise.all([list(cfg.sources.hook), list(cfg.sources.window)]);
        windowItems = mergeWindowLists(hookItems, winItems);
        renderShowing();
        renderList();
    } catch (err) {
        note(`Couldn't list windows: ${err.message}`);
    }
}

async function sceneItems() {
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: cfg.scene });
    return sceneItems;
}

async function readShowing() {
    try {
        const items = await sceneItems();
        const on = name => items.some(i => i.sourceName === name && i.sceneItemEnabled);
        if (on(cfg.sources.console)) {
            showing = { method: 'console' };
        } else {
            const method = on(cfg.sources.hook) ? 'hook' : on(cfg.sources.window) ? 'window' : null;
            if (method) {
                const { inputSettings } = await obs.call('GetInputSettings', { inputName: cfg.sources[method] });
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
        renderList();
    } catch (err) {
        note(`Couldn't read ${cfg.scene}: ${err.message}`);
    }
}

/** Meters for AJ's own sources, which the dock only reads. */
async function setupMeters() {
    const box = $('meters');
    box.textContent = '';
    meterEls.clear();
    for (const name of cfg.meters) {
        const row = meterRow(name);
        box.appendChild(row);
        meterEls.set(name, { row, bar: row.querySelector('.bar') });
        obs.call('GetInputMute', { inputName: name })
            .then(({ inputMuted }) => row.classList.toggle('muted', inputMuted))
            .catch(() => row.classList.add('missing'));
    }
}

function meterRow(name) {
    const row = document.createElement('div');
    row.className = 'meter';
    row.innerHTML = '<span class="name"></span><span class="track"><span class="bar"></span></span><span class="mute">muted</span>';
    row.querySelector('.name').textContent = name;
    row.title = name;
    return row;
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
    channels = channelList(acfg.targets, saved);
    templateMul = {};
    for (const t of new Set(channels.map(c => c.template))) {
        try {
            templateMul[t] = (await obs.call('GetInputVolume', { inputName: t })).inputVolumeMul;
        } catch { /* source missing: its channels start at the floor */ }
    }
}

async function saveChannels() {
    saved = {
        custom: channels.filter(c => !c.builtin).map(({ id, label, like }) => ({ id, label, like })),
        mix: Object.fromEntries(channels.filter(c => c.volumeMul !== null || c.muted)
            .map(c => [c.id, { volumeMul: c.volumeMul, muted: c.muted }]))
    };
    await obs.call('SetPersistentData', { realm: REALM, slotName: acfg.dataSlot, slotValue: saved });
}

/** A channel's fader: its own once moved, else its template source's. */
function channelMul(c) {
    return c.volumeMul ?? Math.min(templateMul[c.template] ?? 0, faderMul(acfg.channelMaxDb, cfg.meterFloorDb, acfg.channelMaxDb));
}

const toDb = mul => (mul > 0 ? 20 * Math.log10(mul) : cfg.meterFloorDb);

function members(id) {
    return [...routes.values()].filter(r => r.target === id && r.live);
}

function renderChannels() {
    const box = $('channels');
    box.textContent = '';
    channelEls.clear();
    for (const c of channels) {
        const row = meterRow(`${c.label}${c.like === 'music' ? ' (not on VOD)' : ''}`);
        row.classList.add('channel');
        row.classList.toggle('muted', c.muted);
        const n = members(c.id).length;
        row.title = `${c.label}: ${n ? members(c.id).map(r => r.exe).join(', ') : 'no apps yet'}. ` +
            `Copies ${c.template}'s tracks and filters. Flagged "went red": turn it down, then click to clear`;
        row.addEventListener('click', () => row.classList.remove('clipped'));
        const ctl = document.createElement('div');
        ctl.className = 'controls';
        const fader = document.createElement('input');
        fader.type = 'range';
        fader.min = String(cfg.meterFloorDb);
        fader.max = String(acfg.channelMaxDb);
        fader.step = '0.5';
        fader.value = String(toDb(channelMul(c)));
        fader.title = `${c.label} volume (at most ${acfg.channelMaxDb} dB, so it can't go red)`;
        const db = document.createElement('span');
        db.className = 'db';
        const showDb = () => { db.textContent = `${Number(fader.value).toFixed(1)} dB`; };
        showDb();
        fader.addEventListener('input', showDb);
        fader.addEventListener('change', () => setChannelMix(c.id, { volumeMul: faderMul(fader.value, cfg.meterFloorDb, acfg.channelMaxDb) }));
        const mute = document.createElement('button');
        mute.type = 'button';
        mute.className = 'small';
        mute.textContent = c.muted ? 'Unmute' : 'Mute';
        mute.addEventListener('click', (e) => { e.stopPropagation(); setChannelMix(c.id, { muted: !c.muted }); });
        ctl.append(fader, db, mute);
        if (!c.builtin) {
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'small';
            del.textContent = '✕';
            del.title = `Remove the ${c.label} channel (its apps go off stream)`;
            del.addEventListener('click', (e) => { e.stopPropagation(); removeChannel(c.id); });
            ctl.append(del);
        }
        const count = document.createElement('span');
        count.className = 'apps';
        count.textContent = n ? `${n} app${n > 1 ? 's' : ''}` : 'empty';
        ctl.append(count);
        box.append(row, ctl);
        channelEls.set(c.id, { row, bar: row.querySelector('.bar') });
    }
}

/** Move a channel's fader or mute: every app in it, then remember it. */
async function setChannelMix(id, change) {
    if (busy || !obs?.ready) return;
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

async function addChannel(name, like) {
    if (busy || !obs?.ready) return;
    const made = newChannel(name, like, channels, acfg.targets);
    if (made.error) {
        note(made.error);
        return;
    }
    busy = true;
    document.body.classList.add('busy');
    try {
        channels = channelList(acfg.targets, {
            ...saved, custom: [...(saved.custom || []), made.channel]
        });
        await saveChannels();
        $('channelName').value = '';
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

$('newChannel').addEventListener('submit', (e) => {
    e.preventDefault();
    addChannel($('channelName').value, $('channelLike').value);
});

/**
 * The dock's App Audio inputs, by app, from the Audio scene: an input there
 * is on stream whatever else OBS says about it.
 */
async function readRoutes() {
    try {
        const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: acfg.scene });
        routes = new Map();
        for (const { sourceName, sceneItemId, sceneItemEnabled } of sceneItems) {
            const r = parseAppAudioName(sourceName, acfg.prefix, byId());
            if (!r) continue;
            const key = r.exe.toLowerCase();
            const route = routes.get(key) || { ...r, inputName: sourceName, items: [], live: false };
            route.items.push({ sceneItemId, inputName: sourceName });
            route.live ||= sceneItemEnabled;
            routes.set(key, route);
        }
        // A hidden input is half made (or hidden by hand): it plays nothing,
        // so the menu says off; choosing Game or Music replaces it
        memberOf.clear();
        for (const route of routes.values()) {
            if (route.live) memberOf.set(route.inputName, route.target);
            else route.target = 'off';
        }
        await setupMeters();
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
        await obs.call('RemoveSceneItem', { sceneName: acfg.scene, sceneItemId });
        await obs.call('RemoveInput', { inputName }).catch(() => { /* already gone with its last item */ });
    }
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: acfg.scene });
    const left = sceneItems.filter(i => route.items.some(r => r.inputName === i.sourceName));
    if (left.length) throw new Error(`${left[0].sourceName} is still in ${acfg.scene}`);
}

/** Give an app's input the tracks, volume and filters of `template`. */
async function copyFromTemplate(inputName, template) {
    const [{ inputAudioTracks }, { inputVolumeMul }, { filters }] = await Promise.all([
        obs.call('GetInputAudioTracks', { inputName: template }),
        obs.call('GetInputVolume', { inputName: template }),
        obs.call('GetSourceFilterList', { sourceName: template })
    ]);
    await obs.call('SetInputAudioTracks', { inputName, inputAudioTracks });
    await obs.call('SetInputVolume', { inputName, inputVolumeMul });
    // The app still plays to the speakers, so monitoring would double it
    await obs.call('SetInputAudioMonitorType', { inputName, monitorType: 'OBS_MONITORING_TYPE_NONE' });
    for (const f of copyableFilters(filters, acfg.skipFilterKinds)) {
        await obs.call('CreateSourceFilter', {
            sourceName: inputName, filterName: f.filterName, filterKind: f.filterKind, filterSettings: f.filterSettings
        });
        if (f.filterEnabled === false) {
            await obs.call('SetSourceFilterEnabled', { sourceName: inputName, filterName: f.filterName, filterEnabled: false });
        }
    }
}

/**
 * Send an app's sound to a channel (by id) or take it off stream ('off').
 * Replaces the app's App Audio input with one that copies the channel's
 * template source's tracks and filters, at the channel's fader and mute.
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
        if (t) {
            const inputName = appAudioName(acfg.prefix, win.exe, t.label);
            // Hidden until it has the destination's tracks, volume and
            // filters: a new input plays on every track (VOD too) at 0 dB
            // with no limiter (Code review, #116)
            const { sceneItemId } = await obs.call('CreateInput', {
                sceneName: acfg.scene,
                inputName,
                inputKind: 'wasapi_process_output_capture',
                inputSettings: { window: win.value, priority: cfg.windowPriority },
                sceneItemEnabled: false
            });
            try {
                await copyFromTemplate(inputName, t.template);
                await applyMix(inputName, t);
            } catch (err) {
                await removeRoute({ items: [{ sceneItemId, inputName }] }).catch(() => {});
                throw err;
            }
            await obs.call('SetSceneItemEnabled', { sceneName: acfg.scene, sceneItemId, sceneItemEnabled: true });
            note(`${win.exe} sound now goes to ${t.label}${t.like === 'music' ? ' (stream only, not the VOD; it doesn\'t follow the music fades)' : ' (if it already plays to CABLE-A, it\'s on twice now)'}.`);
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
        $('preview').src = await screenshot(cfg.scene, cfg.previewWidth);
        $('preview').hidden = false;
    } catch (err) {
        note(`No preview: ${err.message}`);
    }
}

// ---- changing OBS ----

async function show(target) {
    const changes = visibilityChanges(await sceneItems(), target, {
        sources: Object.values(cfg.sources), keep: cfg.keep
    });
    for (const c of changes) {
        await obs.call('SetSceneItemEnabled', {
            sceneName: cfg.scene, sceneItemId: c.sceneItemId, sceneItemEnabled: c.enabled
        });
    }
    debug.mark('show', { target, changes });
}

/** The 16:9 Game captures' windows and which items show, to undo a pick. */
async function snapshot() {
    const [items, hook, win] = await Promise.all([
        sceneItems(),
        obs.call('GetInputSettings', { inputName: cfg.sources.hook }),
        obs.call('GetInputSettings', { inputName: cfg.sources.window })
    ]);
    return { items, hook: hook.inputSettings, window: win.inputSettings };
}

async function restore(before) {
    if (!before) return;
    await obs.call('SetInputSettings', { inputName: cfg.sources.hook, inputSettings: before.hook, overlay: true });
    await obs.call('SetInputSettings', { inputName: cfg.sources.window, inputSettings: before.window, overlay: true });
    const now = await sceneItems();
    for (const it of before.items) {
        const cur = now.find(i => i.sceneItemId === it.sceneItemId);
        if (cur && cur.sceneItemEnabled !== it.sceneItemEnabled) {
            await obs.call('SetSceneItemEnabled', { sceneName: cfg.scene, sceneItemId: it.sceneItemId, sceneItemEnabled: it.sceneItemEnabled });
        }
    }
    debug.mark('restore', {});
}

async function capture(method, value) {
    await obs.call('SetInputSettings', {
        inputName: cfg.sources[method],
        inputSettings: captureSettings(method, value, cfg.windowPriority),
        overlay: true
    });
    await show(cfg.sources[method]);
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
        let lit = await litOf(cfg.sources[method]);
        if (failed(lit)) {
            note(`No picture from ${win.exe} yet, checking again…`);
            await new Promise(r => setTimeout(r, cfg.blackCheckMs));
            lit = await litOf(cfg.sources[method]);
        }
        debug.mark('pick', { exe, method, forced: !!forced, lit });
        const other = method === 'hook' ? 'window' : 'hook';
        const otherSees = other === 'hook' ? win.inHook : win.inWindow;
        if (failed(lit) && !forced && otherSees) {
            await capture(other, win.value);
            await new Promise(r => setTimeout(r, cfg.blackCheckMs));
            const lit2 = await litOf(cfg.sources[other]);
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

async function pickConsole() {
    if (busy || !obs?.ready) return;
    try {
        note('');
        await show(cfg.sources.console);
        showing = { method: 'console' };
        renderShowing();
        renderList();
        await new Promise(r => setTimeout(r, 300));
        await showPreview();
    } catch (err) {
        note(`Couldn't show the capture card: ${err.message}`);
    }
}

// ---- rendering ----

const METHOD_LABEL = { hook: 'game hook', window: 'window', console: 'capture card' };
const CAPTURE_NAME = { hook: 'game hook', window: 'window capture' };

function renderShowing() {
    const el = $('showing');
    el.classList.remove('missing');
    if (!showing) {
        el.textContent = 'Nothing is showing in 16:9 Game';
        return;
    }
    if (showing.method === 'console') {
        el.textContent = 'Showing: console (capture card)';
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
        const current = showing && showing.method !== 'console' &&
            (exact ? w.value === showing.value : sameWindow(showing.value, w.value));
        li.className = current ? 'current' : '';
        const main = document.createElement('button');
        main.className = 'pick';
        main.innerHTML = '<span class="exe"></span><span class="title"></span>';
        main.querySelector('.exe').textContent = `${w.recent ? '★ ' : ''}${w.exe}`;
        main.querySelector('.title').textContent = w.inWindow ? w.title : `${w.title} · minimised? restore it first`;
        main.title = `Capture with ${METHOD_LABEL[method]}`;
        main.addEventListener('click', () => pick(w));
        const other = method === 'hook' ? 'window' : 'hook';
        const canSwap = other === 'hook' ? w.inHook : w.inWindow;
        const swap = document.createElement('button');
        swap.disabled = !canSwap;
        swap.className = 'swap';
        swap.textContent = `⇄ use ${CAPTURE_NAME[other]}`;
        swap.title = canSwap
            ? `Capture with ${METHOD_LABEL[other]} instead, and remember it for ${w.exe}`
            : `The ${METHOD_LABEL[other]} can't see this window`;
        swap.addEventListener('click', () => pick(w, other));
        // Where this app's sound goes: one App Audio input per app
        const route = routes.get(w.exe.toLowerCase());
        const sel = document.createElement('select');
        sel.className = 'audio';
        sel.title = `Where ${w.exe}'s sound goes on stream`;
        for (const [value, label] of [['off', '🔇 Sound: off stream'], ...channels.map(c => [c.id, `🔊 Sound: ${c.label}${c.like === 'music' ? ' (not on VOD)' : ''}`])]) {
            const o = document.createElement('option');
            o.value = value;
            o.textContent = label;
            sel.appendChild(o);
        }
        sel.value = route?.target || 'off';
        sel.classList.toggle('on', !!route);
        sel.addEventListener('change', () => setRoute(w, sel.value));
        li.append(main, swap, sel);
        ul.appendChild(li);
    }
    if (list.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = windowItems.length ? 'No match. Tick "show all"?' : 'No windows listed yet';
        ul.appendChild(li);
    }
}

$('search').addEventListener('input', renderList);
$('showAll').addEventListener('change', renderList);
$('refresh').addEventListener('click', () => obs?.ready && refreshWindows());
$('console').addEventListener('click', pickConsole);
$('previewBtn').addEventListener('click', () => obs?.ready && showPreview());

connect();
