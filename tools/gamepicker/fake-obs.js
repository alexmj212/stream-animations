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
export function solidPng(w, h, [r, g, b]) {
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
    const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())]);
    const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(Buffer.concat(Array(h).fill(row)))),
        chunk('IEND', Buffer.alloc(0))
    ]);
    return `data:image/png;base64,${png.toString('base64')}`;
}

export const WINDOWS = [
    'RACCOIN:UnityWndClass:RACCOIN.exe',
    'mGBA - Pokemon - FireRed Version (USA, Europe) (Rev 1) (60 fps) - 0.10.5:Qt51516QWindowIcon:mGBA.exe',
    'Sumoomoo - Twitch — Mozilla Firefox:MozillaWindowClass:firefox.exe',
    'Balatro:SDL_app:Balatro.exe',
    'OBS 31.1.2 - Profile#3A Stream:Qt663QWindowIcon:obs64.exe',
    'Mix It Up:HwndWrapper[MixItUp.exe]:MixItUp.exe',
    'Program Manager:Progman:explorer.exe'
];

/**
 * @param {Object} opts
 * @param {string} [opts.password]
 * @param {string[]} [opts.blackExes]
 * @returns {Promise<{url: string, state: Object, close: Function}>}
 */
export async function startFakeObs({ password = 'pw', blackExes = ['Balatro.exe'] } = {}) {
    const state = {
        inputs: {
            'Game Capture 2': { kind: 'game_capture', settings: { window: 'RACCOIN:UnityWndClass:RACCOIN.exe', capture_mode: 'window' } },
            'Window Capture': { kind: 'window_capture', settings: { window: WINDOWS[2], method: 2 } },
            'mGBA': { kind: 'window_capture', settings: { window: WINDOWS[1] } },
            'Window Capture 2': { kind: 'window_capture', settings: {} }
        },
        items: [
            { sceneItemId: 52, sourceName: 'Window Capture 2', inputKind: 'window_capture', sceneItemEnabled: false },
            { sceneItemId: 40, sourceName: 'Action Cam', inputKind: null, sceneItemEnabled: false },
            { sceneItemId: 30, sourceName: 'Game Capture 2', inputKind: 'game_capture', sceneItemEnabled: true },
            { sceneItemId: 20, sourceName: 'Window Capture', inputKind: 'window_capture', sceneItemEnabled: false },
            { sceneItemId: 10, sourceName: 'mGBA', inputKind: 'window_capture', sceneItemEnabled: false },
            { sceneItemId: 1, sourceName: 'Game Capture', inputKind: null, sceneItemEnabled: false }
        ],
        mutes: { 'Local Game (A)': false, 'Ext Capture (B)': false, 'BG Music': false },
        log: []
    };
    const lit = solidPng(16, 9, [70, 140, 220]);
    const black = solidPng(16, 9, [0, 0, 0]);
    const exeOf = v => (v || '').split(':')[2] || '';

    const handlers = {
        GetInputPropertiesListPropertyItems: () => ({
            propertyItems: WINDOWS.map(v => ({ itemName: `[${exeOf(v)}]: ${v.split(':')[0]}`, itemValue: v, itemEnabled: true }))
        }),
        GetSceneItemList: ({ sceneName }) => {
            if (sceneName !== '16:9 Game') throw new Error('No source was found');
            return { sceneItems: state.items.map(i => ({ ...i })) };
        },
        SetSceneItemEnabled: ({ sceneItemId, sceneItemEnabled }) => {
            state.items.find(i => i.sceneItemId === sceneItemId).sceneItemEnabled = sceneItemEnabled;
            return {};
        },
        GetInputSettings: ({ inputName }) => ({ inputSettings: { ...state.inputs[inputName].settings } }),
        SetInputSettings: ({ inputName, inputSettings }) => {
            Object.assign(state.inputs[inputName].settings, inputSettings);
            return {};
        },
        GetInputMute: ({ inputName }) => {
            if (!(inputName in state.mutes)) throw new Error('No source was found');
            return { inputMuted: state.mutes[inputName] };
        },
        GetSourceScreenshot: ({ sourceName }) => {
            const hook = state.inputs['Game Capture 2'].settings;
            const isBlack = sourceName === 'Game Capture 2' && blackExes.includes(exeOf(hook.window));
            return { imageData: isBlack ? black : lit };
        }
    };

    const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
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
                        { inputName: 'BG Music', inputLevelsMul: [[0.01, 0.04, 0.5], [0.01, 0.04, 0.5]] }
                    ] } } })), 50);
                }
            }
            if (op === 6) {
                state.log.push({ requestType: d.requestType, requestData: d.requestData });
                let status = { result: true, code: 100 }, data;
                try { data = handlers[d.requestType](d.requestData || {}); } catch (e) { status = { result: false, code: 600, comment: e.message }; }
                ws.send(JSON.stringify({ op: 7, d: { requestType: d.requestType, requestId: d.requestId, requestStatus: status, responseData: data } }));
            }
        });
        ws.on('close', () => clearInterval(meters));
    });
    return {
        url: `ws://127.0.0.1:${wss.address().port}`,
        state,
        close: () => new Promise(r => { for (const c of wss.clients) c.terminate(); wss.close(r); })
    };
}
