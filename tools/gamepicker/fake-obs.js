/**
 * A stand-in for obs-websocket v5 with AJ's real 16:9 Game scene
 * (Archive_1.json, 2026-10-29), so the game picker dock can be driven
 * end to end without OBS. Used by tools/gamepicker/check.js.
 *
 * Windows whose exe is in `blackExes` give a black picture through the game
 * hook (as some windowed games do); everything else gives a lit picture.
 */
import { WebSocketServer } from 'ws';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

const b64sha = s => createHash('sha256').update(s).digest('base64');

/** A solid-colour PNG as a data URL (no image library needed). */
export function solidPng(w, h, rgb) {
    return pixelPng(w, h, () => rgb);
}

/** A PNG as a data URL, each pixel's [r, g, b] from `at(x, y)`. */
export function pixelPng(w, h, at) {
    const crcTable = Array.from({ length: 256 }, (_, n) => {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        return c >>> 0;
    });
    const crc = buf => {
        let c = 0xffffffff;
        for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    };
    const chunk = (type, data) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type), data]);
        const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
        return Buffer.concat([len, td, c]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
    const rows = Array.from({ length: h }, (_, y) =>
        Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, (_, x) => at(x, y)).flat())]));
    const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(Buffer.concat(rows))),
        chunk('IEND', Buffer.alloc(0))
    ]);
    return `data:image/png;base64,${png.toString('base64')}`;
}

// Both lists differ, like OBS's: the game capture leaves out browsers,
// Explorer and Discord (win-capture's blacklist), and Telegram minimised to
// the tray shows only in the hook's list (Defiant, 2026-10-30)
export const WINDOWS = [
    'RACCOIN:UnityWndClass:RACCOIN.exe',
    'mGBA - Pokemon - FireRed Version (USA, Europe) (Rev 1) (60 fps) - 0.10.5:Qt51516QWindowIcon:mGBA.exe',
    'Sumoomoo - Twitch — Mozilla Firefox:MozillaWindowClass:firefox.exe',
    'Account API tokens — Mozilla Firefox:MozillaWindowClass:firefox.exe',
    'Balatro:SDL_app:Balatro.exe',
    'Spotify Premium:Chrome_WidgetWin_1:Spotify.exe',
    'OBS 31.1.2 - Profile#3A Stream:Qt663QWindowIcon:obs64.exe',
    'Mix It Up:HwndWrapper[MixItUp.exe]:MixItUp.exe',
    'Program Manager:Progman:explorer.exe',
    'General \u2013 (11976):Qt51517QWindowIcon:Telegram.exe',
    '#fat-content | G-word Girlies - Discord:Chrome_WidgetWin_1:Discord.exe',
    // A Store app: both lists name its inner CoreWindow, which gives no
    // picture; its ApplicationFrameHost frame does (Defiant, 2026-10-30)
    'Realtek Audio Console:Windows.UI.Core.CoreWindow:RtkUWP.exe'
];
const STORE_FRAME = 'Realtek Audio Console:ApplicationFrameWindow:ApplicationFrameHost.exe';
const HOOK_SKIPS = /firefox|explorer|discord/i;
// Minimised windows (Telegram here) list only in the hook; restore() moves
// one into the window capture's list too
const minimised = new Set(['Telegram.exe']);

/**
 * @param {Object} opts
 * @param {string} [opts.password]
 * @param {string[]} [opts.gameExes] - the hook renders only these; for any
 *   other app it gives no picture (OBS: "Failed to render screenshot"), as
 *   on Defiant (2026-10-30)
 * @param {string[]} [opts.windowBlackExes] - window capture shows these
 *   black (exclusive fullscreen)
 * @returns {Promise<{url: string, state: Object, close: Function}>}
 */
export async function startFakeObs({
    password = 'pw',
    gameExes = ['RACCOIN.exe', 'Balatro.exe', 'mGBA.exe'],
    windowBlackExes = ['Balatro.exe']
} = {}) {
    const tracks = list => Object.fromEntries([1, 2, 3, 4, 5, 6].map(n => [String(n), list.includes(n)]));
    const audio = (volume, trackList, filters, monitor = 'OBS_MONITORING_TYPE_NONE') => ({
        kind: 'wasapi_output_capture', settings: {}, volume, tracks: tracks(trackList), filters, monitor, muted: false
    });
    const filter = (filterName, filterKind, filterSettings = {}) => ({ filterName, filterKind, filterSettings, filterEnabled: true, filterIndex: 0 });
    // Audio sources as in Archive_1.json (2026-10-29)
    const state = {
        inputs: {
            'Game Capture 2': { kind: 'game_capture', settings: { window: 'RACCOIN:UnityWndClass:RACCOIN.exe', capture_mode: 'window' } },
            'Window Capture': { kind: 'window_capture', settings: { window: WINDOWS[2], method: 2 } },
            'mGBA': { kind: 'window_capture', settings: { window: WINDOWS[1] } },
            'Window Capture 2': { kind: 'window_capture', settings: {} },
            'Local Game (A)': audio(0.1076, [1, 2, 4, 5, 6], [filter('Gain', 'gain_filter', { db: 6 }), filter('Limiter', 'limiter_filter', { threshold: -7 })]),
            'Ext Capture (B)': audio(0.2473, [1, 2, 4, 5, 6], [filter('Gain', 'gain_filter', { db: 6 }), filter('Limiter', 'limiter_filter', { threshold: -7 })]),
            'BG Music': audio(0.03, [1, 4, 5, 6], [
                filter('Fade Down', 'move_audio_value_filter'), filter('Fade Up', 'move_audio_value_filter'),
                filter('Move', 'audio_move_filter'), filter('Limiter', 'limiter_filter', { threshold: -7 })
            ], 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'),
            'Mic': audio(0.5, [1, 2, 3, 4, 5, 6], [filter('Limiter', 'limiter_filter', { threshold: -7 })])
        },
        items: [
            { sceneItemId: 52, sourceName: 'Window Capture 2', inputKind: 'window_capture', sceneItemEnabled: false },
            { sceneItemId: 40, sourceName: 'Action Cam', inputKind: null, sceneItemEnabled: false },
            { sceneItemId: 30, sourceName: 'Game Capture 2', inputKind: 'game_capture', sceneItemEnabled: true },
            { sceneItemId: 20, sourceName: 'Window Capture', inputKind: 'window_capture', sceneItemEnabled: false },
            { sceneItemId: 10, sourceName: 'mGBA', inputKind: 'window_capture', sceneItemEnabled: false },
            { sceneItemId: 1, sourceName: 'Game Capture', inputKind: null, sceneItemEnabled: false }
        ],
        audioScene: ['Mic', 'BG Music', 'Ext Capture (B)', 'Local Game (A)'].map((name, i) => ({ id: i + 1, name })),
        nextItemId: 10,
        persistent: {},
        failOn: null,               // a request type that fails once, to test a half-done change
        appPeak: 0.05,              // App Audio peak (multiplier) the meters report
        log: []
    };
    const lit = solidPng(16, 9, [70, 140, 220]);
    const black = solidPng(16, 9, [0, 0, 0]);
    // Realtek's dark UI: near-black with one line of light text, so a mean
    // luma check calls it black and a lit-pixel check doesn't
    const darkUi = pixelPng(64, 36, (x, y) => (y === 10 && x > 4 && x < 30 ? [220, 220, 220] : [3, 3, 4]));
    const exeOf = v => (v || '').split(':')[2] || '';
    const input = name => {
        if (!state.inputs[name]) throw new Error(`No source was found by the name of \`${name}\`.`);
        return state.inputs[name];
    };

    const handlers = {
        GetInputPropertiesListPropertyItems: ({ inputName }) => ({
            propertyItems: WINDOWS
                .filter(v => input(inputName).kind === 'game_capture' ? !HOOK_SKIPS.test(exeOf(v)) : !minimised.has(exeOf(v)))
                .map(v => ({ itemName: `[${exeOf(v)}]: ${v.split(':')[0]}`, itemValue: v, itemEnabled: true }))
        }),
        // OBS lists scenes bottom first
        GetSceneList: () => ({ scenes: [{ sceneName: 'Audio', sceneIndex: 0 }, { sceneName: '16:9 Game', sceneIndex: 1 }] }),
        GetSceneItemList: ({ sceneName }) => {
            if (sceneName === 'Audio') {
                return { sceneItems: state.audioScene.map(({ id, name, enabled = true }) => ({ sceneItemId: id, sourceName: name, inputKind: state.inputs[name]?.kind, sceneItemEnabled: enabled })) };
            }
            if (sceneName !== '16:9 Game') throw new Error('No source was found');
            return { sceneItems: state.items.map(i => ({ ...i })) };
        },
        SetSceneItemEnabled: ({ sceneName, sceneItemId, sceneItemEnabled }) => {
            if (sceneName === 'Audio') {
                state.audioScene.find(i => i.id === sceneItemId).enabled = sceneItemEnabled;
                return {};
            }
            state.items.find(i => i.sceneItemId === sceneItemId).sceneItemEnabled = sceneItemEnabled;
            return {};
        },
        GetInputSettings: ({ inputName }) => ({ inputSettings: { ...input(inputName).settings } }),
        SetInputSettings: ({ inputName, inputSettings }) => {
            Object.assign(input(inputName).settings, inputSettings);
            broadcast('InputSettingsChanged', { inputName, inputSettings: input(inputName).settings });
            return {};
        },
        GetInputMute: ({ inputName }) => {
            const i = input(inputName);
            if (!('muted' in i)) throw new Error('The specified input does not support audio.');
            return { inputMuted: i.muted };
        },
        GetInputList: ({ inputKind }) => ({
            inputs: Object.entries(state.inputs).filter(([, i]) => !inputKind || i.kind === inputKind)
                .map(([inputName, i]) => ({ inputName, inputKind: i.kind }))
        }),
        CreateInput: ({ sceneName, inputName, inputKind, inputSettings, sceneItemEnabled = true }) => {
            if (sceneName !== 'Audio') throw new Error(`fake: unexpected scene ${sceneName}`);
            if (state.inputs[inputName]) throw new Error('A source already exists by that input name.');
            state.inputs[inputName] = {
                kind: inputKind, settings: { ...inputSettings }, volume: 1, tracks: tracks([1, 2, 3, 4, 5, 6]),
                filters: [], monitor: 'OBS_MONITORING_TYPE_NONE', muted: false
            };
            const id = state.nextItemId++;
            state.audioScene.push({ id, name: inputName, enabled: sceneItemEnabled });
            broadcast('InputCreated', { inputName, inputKind });
            return { sceneItemId: id };
        },
        // As on Defiant (OBS 33, 2026-10-30): RemoveInput reports success but
        // an input still in a scene stays there, capturing
        RemoveInput: ({ inputName }) => {
            input(inputName);
            if (state.audioScene.some(i => i.name === inputName)) return {};
            delete state.inputs[inputName];
            broadcast('InputRemoved', { inputName });
            return {};
        },
        RemoveSceneItem: ({ sceneName, sceneItemId }) => {
            if (sceneName !== 'Audio') throw new Error(`fake: unexpected scene ${sceneName}`);
            if (!state.audioScene.some(i => i.id === sceneItemId)) throw new Error('No scene items were found');
            state.audioScene = state.audioScene.filter(i => i.id !== sceneItemId);
            return {};
        },
        GetInputAudioTracks: ({ inputName }) => ({ inputAudioTracks: { ...input(inputName).tracks } }),
        SetInputAudioTracks: ({ inputName, inputAudioTracks }) => { Object.assign(input(inputName).tracks, inputAudioTracks); return {}; },
        GetInputVolume: ({ inputName }) => {
            const v = input(inputName).volume;
            return { inputVolumeMul: v, inputVolumeDb: 20 * Math.log10(v) };
        },
        SetInputVolume: ({ inputName, inputVolumeMul }) => { input(inputName).volume = inputVolumeMul; return {}; },
        SetInputMute: ({ inputName, inputMuted }) => { input(inputName).muted = inputMuted; return {}; },
        // As on Defiant: an unknown slot reads null, and null can't be written
        GetPersistentData: ({ realm, slotName }) => {
            if (realm !== 'OBS_WEBSOCKET_DATA_REALM_PROFILE') throw new Error('fake: unexpected realm');
            return { slotValue: state.persistent[slotName] ?? null };
        },
        SetPersistentData: ({ slotName, slotValue }) => {
            if (slotValue === undefined || slotValue === null) throw new Error('Your request is missing the `slotValue` field.');
            state.persistent[slotName] = JSON.parse(JSON.stringify(slotValue));
            return {};
        },
        SetInputAudioMonitorType: ({ inputName, monitorType }) => { input(inputName).monitor = monitorType; return {}; },
        GetSourceFilterList: ({ sourceName }) => ({ filters: input(sourceName).filters.map(f => ({ ...f })) }),
        CreateSourceFilter: ({ sourceName, filterName, filterKind, filterSettings }) => {
            input(sourceName).filters.push({ filterName, filterKind, filterSettings: { ...filterSettings }, filterEnabled: true });
            return {};
        },
        SetSourceFilterEnabled: ({ sourceName, filterName, filterEnabled }) => {
            input(sourceName).filters.find(f => f.filterName === filterName).filterEnabled = filterEnabled;
            return {};
        },
        GetSourceScreenshot: ({ sourceName }) => {
            if (sourceName === 'Game Capture 2') {
                const exe = exeOf(input(sourceName).settings.window);
                if (!gameExes.includes(exe)) throw new Error('Failed to render screenshot.');
                return { imageData: lit };
            }
            if (sourceName === 'Window Capture') {
                const { window, priority } = input(sourceName).settings;
                const exe = exeOf(window);
                if (exe === 'RtkUWP.exe') throw new Error('Failed to render screenshot.');
                // the frame is found by title only: every Store app shares its class and exe
                if (window === STORE_FRAME) {
                    if (priority !== 1) throw new Error('Failed to render screenshot.');
                    return { imageData: darkUi };
                }
                return { imageData: windowBlackExes.includes(exe) ? black : lit };
            }
            return { imageData: lit };
        }
    };

    const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    function broadcast(eventType, eventData) {
        for (const c of wss.clients) c.send(JSON.stringify({ op: 5, d: { eventType, eventIntent: 8, eventData } }));
    }
    await new Promise(r => wss.on('listening', r));
    const salt = 'fakesalt', challenge = 'fakechallenge';
    wss.on('connection', (ws) => {
        let meters = null;
        ws.send(JSON.stringify({ op: 0, d: { rpcVersion: 1, authentication: { salt, challenge } } }));
        ws.on('message', (raw) => {
            const { op, d } = JSON.parse(raw);
            if (op === 1) {
                if (d.authentication !== b64sha(b64sha(password + salt) + challenge)) return ws.close(4009, 'Authentication failed.');
                ws.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
            }
            if (op === 1 || op === 3) {
                clearInterval(meters);
                if (d.eventSubscriptions & (1 << 16)) {
                    meters = setInterval(() => ws.send(JSON.stringify({ op: 5, d: { eventType: 'InputVolumeMeters', eventIntent: 1 << 16, eventData: { inputs: [
                        { inputName: 'Local Game (A)', inputLevelsMul: [[0.05, 0.18, 0.2], [0.05, 0.16, 0.2]] },
                        { inputName: 'Ext Capture (B)', inputLevelsMul: [[0, 0, 0], [0, 0, 0]] },
                        { inputName: 'BG Music', inputLevelsMul: [[0.01, 0.04, 0.5], [0.01, 0.04, 0.5]] },
                        ...Object.keys(state.inputs).filter(n => n.startsWith('App Audio: ')).map(inputName =>
                            ({ inputName, inputLevelsMul: [[0, state.appPeak, 0], [0, state.appPeak, 0]] }))
                    ] } } })), 50);
                }
            }
            if (op === 6) {
                state.log.push({ requestType: d.requestType, requestData: d.requestData });
                let status = { result: true, code: 100 }, data;
                try {
                    if (state.failOn === d.requestType) { state.failOn = null; throw new Error('fake: failed on purpose'); }
                    data = handlers[d.requestType](d.requestData || {});
                } catch (e) { status = { result: false, code: 600, comment: e.message }; }
                ws.send(JSON.stringify({ op: 7, d: { requestType: d.requestType, requestId: d.requestId, requestStatus: status, responseData: data } }));
            }
        });
        ws.on('close', () => clearInterval(meters));
    });
    return {
        url: `ws://127.0.0.1:${wss.address().port}`,
        state,
        gameExes,
        windowBlackExes,
        /** Un-minimise a window: the window capture lists it again. */
        restore: exe => minimised.delete(exe),
        /** Change an input the way the source properties do, with OBS's event. */
        setFromProperties: (inputName, settings) => handlers.SetInputSettings({ inputName, inputSettings: settings }),
        close: () => new Promise(r => { for (const c of wss.clients) c.terminate(); wss.close(r); })
    };
}
