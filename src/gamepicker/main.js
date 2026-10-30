/**
 * Game picker dock: lists open windows and points the 16:9 Game capture at
 * one in a click. Runs as an OBS Custom Browser Dock and talks to OBS over
 * obs-websocket (docs/SCENES.md, "gamepicker"). Each window can also send
 * its app's sound to Game or Music (config.gamePicker.audio); the dock
 * never changes AJ's own audio sources, only its "App Audio:" inputs.
 */

import { config } from '../config/config.js';
import { ObsSocket, EVENTS } from '../shared/obs.js';
import { createDebug } from '../shared/debug.js';
import {
    buildWindowList, chooseMethod, captureSettings, visibilityChanges,
    meanLuma, peakDb, meterZone, pushRecent, parseWindowValue,
    mergeWindowLists, sameWindow, captureFailed, appAudioName, parseAppAudioName,
    copyableFilters
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
    await Promise.all([refreshWindows(), readShowing(), readRoutes()]);
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
        for (const input of eventData.inputs) {
            const m = meterEls.get(input.inputName);
            if (!m) continue;
            const db = peakDb(input.inputLevelsMul, cfg.meterFloorDb);
            const pct = 100 * (db - cfg.meterFloorDb) / -cfg.meterFloorDb;
            m.bar.style.width = `${pct.toFixed(1)}%`;
            m.bar.dataset.zone = meterZone(db);
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
                showing = { method, value: inputSettings.window };
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

async function setupMeters() {
    const box = $('meters');
    box.textContent = '';
    meterEls.clear();
    const names = [...cfg.meters, ...[...routes.values()].map(r => r.inputName)];
    for (const name of names) {
        const row = document.createElement('div');
        row.className = 'meter';
        row.innerHTML = '<span class="name"></span><span class="track"><span class="bar"></span></span><span class="mute">muted</span>';
        row.querySelector('.name').textContent = name.startsWith(acfg.prefix) ? name.slice(acfg.prefix.length) : name;
        row.title = name;
        box.appendChild(row);
        meterEls.set(name, { row, bar: row.querySelector('.bar') });
        obs.call('GetInputMute', { inputName: name })
            .then(({ inputMuted }) => row.classList.toggle('muted', inputMuted))
            .catch(() => row.classList.add('missing'));
    }
}

/** The dock's App Audio inputs, by app. */
async function readRoutes() {
    try {
        const { inputs } = await obs.call('GetInputList', { inputKind: 'wasapi_process_output_capture' });
        routes = new Map();
        for (const { inputName } of inputs) {
            const r = parseAppAudioName(inputName, acfg.prefix, acfg.targets);
            if (r) routes.set(r.exe.toLowerCase(), { ...r, inputName });
        }
        await setupMeters();
        renderList();
    } catch (err) {
        note(`Couldn't read app audio: ${err.message}`);
    }
}

/**
 * Send an app's sound to a destination ('game', 'music') or take it off
 * stream ('off'). Replaces the app's App Audio input with one that copies
 * the destination source's tracks, volume and filters.
 */
async function setRoute(win, target) {
    if (busy || !obs?.ready) return;
    busy = true;
    document.body.classList.add('busy');
    const key = win.exe.toLowerCase();
    try {
        const old = routes.get(key);
        if (old) await obs.call('RemoveInput', { inputName: old.inputName });
        if (target !== 'off') {
            const t = acfg.targets[target];
            const inputName = appAudioName(acfg.prefix, win.exe, t.label);
            await obs.call('CreateInput', {
                sceneName: acfg.scene,
                inputName,
                inputKind: 'wasapi_process_output_capture',
                inputSettings: { window: win.value, priority: cfg.windowPriority },
                sceneItemEnabled: true
            });
            const [{ inputAudioTracks }, { inputVolumeMul }, { filters }] = await Promise.all([
                obs.call('GetInputAudioTracks', { inputName: t.template }),
                obs.call('GetInputVolume', { inputName: t.template }),
                obs.call('GetSourceFilterList', { sourceName: t.template })
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
            note(`${win.exe} sound now goes to ${t.label}${target === 'music' ? ' (stream only, not the VOD)' : ''}.`);
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

/** Mean luma of a small screenshot of one input, or null if it can't be read. */
async function lumaOf(sourceName) {
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
        return meanLuma(ctx.getImageData(0, 0, c.width, c.height).data);
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
    const method = forced || chooseMethod(exe, { remembered: state.remembered, inHook: win.inHook, inWindow: win.inWindow });
    try {
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
        const failed = l => captureFailed(l, cfg.blackLuma);
        await new Promise(r => setTimeout(r, cfg.blackCheckMs));
        let luma = await lumaOf(cfg.sources[method]);
        if (failed(luma)) {
            note(`No picture from ${win.exe} yet, checking again…`);
            await new Promise(r => setTimeout(r, cfg.blackCheckMs));
            luma = await lumaOf(cfg.sources[method]);
        }
        debug.mark('pick', { exe, method, forced: !!forced, luma });
        const other = method === 'hook' ? 'window' : 'hook';
        const otherSees = other === 'hook' ? win.inHook : win.inWindow;
        if (failed(luma) && !forced && otherSees) {
            await capture(other, win.value);
            await new Promise(r => setTimeout(r, cfg.blackCheckMs));
            const luma2 = await lumaOf(cfg.sources[other]);
            debug.mark('fallback', { exe, method: other, luma: luma2 });
            if (!failed(luma2)) {
                state.remembered[exe] = other;
                saveState();
                note(`The ${CAPTURE_NAME[method]} showed nothing for ${win.exe}, so it uses the ${CAPTURE_NAME[other]} now (remembered).`);
            } else {
                note(`Neither capture shows ${win.exe}. Is it minimised? Restore it and pick it again.`);
            }
        } else if (failed(luma) && !win.inWindow) {
            note(`${win.exe} looks minimised (only the game hook lists it). Restore the window and pick it again.`);
        } else if (failed(luma)) {
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
        main.querySelector('.title').textContent = w.inWindow ? w.title : `${w.title} · minimised?`;
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
        for (const [value, label] of [['off', '🔇 Sound: off stream'], ...Object.entries(acfg.targets).map(([k, t]) => [k, `🔊 Sound: ${t.label}${k === 'music' ? ' (not on VOD)' : ''}`])]) {
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
