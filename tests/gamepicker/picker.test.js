import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
    parseWindowValue, buildWindowList, chooseMethod, captureSettings,
    visibilityChanges, litFraction, windowValue, windowCaptureTarget, peakDb, meterZone, pushRecent,
    captureFailed, appAudioName, parseAppAudioName, copyableFilters,
    channelList, newChannel, faderMul, readSetup, guessSetup, tracksObject, cleanTracks, activity, DEFAULT_CHANNEL
} from '../../src/gamepicker/picker.js';
import { authString, ObsSocket } from '../../src/shared/obs.js';
import { config } from '../../src/config/config.js';

const item = (value, itemEnabled = true) => ({ itemName: value, itemValue: value, itemEnabled });

describe('parseWindowValue', () => {
    it('splits title:class:exe and decodes escaped colons and hashes', () => {
        expect(parseWindowValue('RACCOIN:UnityWndClass:RACCOIN.exe'))
            .toEqual({ title: 'RACCOIN', cls: 'UnityWndClass', exe: 'RACCOIN.exe' });
        expect(parseWindowValue('Game#3A Part 2 #222:Cls:game.exe').title).toBe('Game: Part 2 #2');
    });
});

describe('buildWindowList', () => {
    const items = [
        item('Untitled - Notepad:Notepad:notepad.exe'),
        item('OBS 31:Qt:obs64.exe'),
        item('RACCOIN:UnityWndClass:RACCOIN.exe'),
        item('RACCOIN:UnityWndClass:RACCOIN.exe'),
        item('mGBA - FireRed:Qt51516QWindowIcon:mGBA.exe'),
        item('Off:Cls:off.exe', false)
    ];
    const opts = { ignoreExes: config.gamePicker.ignoreExes };

    it('drops ignored, disabled and duplicate windows', () => {
        expect(buildWindowList(items, opts).map(w => w.exe)).toEqual(['mGBA.exe', 'notepad.exe', 'RACCOIN.exe']);
    });

    it('puts recents first, most recent on top', () => {
        const list = buildWindowList(items, { ...opts, recents: ['raccoin.exe', 'mgba.exe'] });
        expect(list.map(w => w.exe)).toEqual(['RACCOIN.exe', 'mGBA.exe', 'notepad.exe']);
        expect(list[0].recent).toBe(true);
        expect(list[2].recent).toBe(false);
    });

    it('shows ignored windows with showAll and filters by query', () => {
        expect(buildWindowList(items, { ...opts, showAll: true }).some(w => w.exe === 'obs64.exe')).toBe(true);
        expect(buildWindowList(items, { ...opts, query: 'fire' }).map(w => w.exe)).toEqual(['mGBA.exe']);
    });
});

describe('chooseMethod', () => {
    it('uses window capture by default: it shows any app (Defiant, 2026-10-30)', () => {
        expect(chooseMethod('firefox.exe')).toBe('window');
        expect(chooseMethod('Spotify.exe')).toBe('window');
        expect(chooseMethod('RACCOIN.exe')).toBe('window');
    });
    it('follows a remembered choice', () => {
        expect(chooseMethod('RACCOIN.exe', { remembered: { 'raccoin.exe': 'hook' } })).toBe('hook');
        expect(chooseMethod('Balatro.exe', { remembered: { 'balatro.exe': 'window' } })).toBe('window');
    });
});

describe('captureFailed', () => {
    it('counts no picture (null) and black as failed', () => {
        expect(captureFailed(null, 0.005)).toBe(true);
        expect(captureFailed(0, 0.005)).toBe(true);
        expect(captureFailed(0.3, 0.005)).toBe(false);
    });
    it('passes a dark picture with some lit detail (Realtek dark UI)', () => {
        // 64x36, black but for a 4x3 block of white text
        const px = new Array(64 * 36 * 4).fill(0);
        for (let i = 0; i < 12; i++) px.fill(255, i * 4, i * 4 + 3);
        const { litLuma, minLit } = config.gamePicker;
        expect(captureFailed(litFraction(px, litLuma), minLit)).toBe(false);
    });
});

describe('windowCaptureTarget', () => {
    it('captures a Store app through its frame, matched by title', () => {
        const value = 'Realtek Audio Console:Windows.UI.Core.CoreWindow:RtkUWP.exe';
        expect(windowCaptureTarget(value, 2)).toEqual({
            value: 'Realtek Audio Console:ApplicationFrameWindow:ApplicationFrameHost.exe', priority: 1
        });
        expect(captureSettings('window', value, 2).window).toBe('Realtek Audio Console:ApplicationFrameWindow:ApplicationFrameHost.exe');
        expect(captureSettings('hook', value, 2).window).toBe(value);
    });
    it('leaves other windows alone', () => {
        const value = 'Spotify Premium:Chrome_WidgetWin_1:Spotify.exe';
        expect(windowCaptureTarget(value, 2)).toEqual({ value, priority: 2 });
    });
    it('windowValue escapes like OBS', () => {
        const w = { title: 'OBS - Profile: #3', cls: 'Qt', exe: 'obs64.exe' };
        expect(windowValue(w)).toBe('OBS - Profile#3A #223:Qt:obs64.exe');
        expect(parseWindowValue(windowValue(w))).toEqual(w);
    });
});

describe('app audio names', () => {
    const { prefix } = config.gamePicker.audio;
    it('round-trips app and channel label through the input name', () => {
        const name = appAudioName(prefix, 'firefox.exe', 'Music');
        expect(name).toBe('App Audio: firefox.exe (Music)');
        expect(parseAppAudioName(name, prefix)).toEqual({ exe: 'firefox.exe', label: 'Music' });
        expect(parseAppAudioName('App Audio: Some Game (x86).exe (Game)', prefix))
            .toEqual({ exe: 'Some Game (x86).exe', label: 'Game' });
    });
    it('ignores every other input', () => {
        expect(parseAppAudioName('BG Music', prefix)).toBeNull();
        expect(parseAppAudioName('App Audio: firefox.exe', prefix)).toBeNull();
        expect(parseAppAudioName('App Audio: firefox.exe ()', prefix)).toBeNull();
    });
    it('copies filters but not Move filters', () => {
        const filters = [{ filterKind: 'move_audio_value_filter' }, { filterKind: 'audio_move_filter' }, { filterKind: 'limiter_filter' }];
        expect(copyableFilters(filters, config.gamePicker.audio.skipFilterKinds)).toEqual([{ filterKind: 'limiter_filter' }]);
    });
});

describe('nothing about one OBS is built in (AJ, 2026-10-30)', () => {
    it('names no scene, source or audio device in the config', () => {
        const text = JSON.stringify(config.gamePicker);
        expect(text).not.toMatch(/16:9 Game|Game Capture|Window Capture|Local Game|BG Music|Ext Capture|Action Cam|Audio'/);
    });
});

describe('setup', () => {
    const scenes = [
        { sceneName: 'Starting', items: [{ sourceName: 'Logo', inputKind: 'image_source' }] },
        { sceneName: 'Gameplay', items: [
            { sourceName: 'Cam', inputKind: 'dshow_input' },
            { sourceName: 'Game', inputKind: 'game_capture' },
            { sourceName: 'Browser', inputKind: 'window_capture' }
        ] }
    ];
    it('guesses the scene with captures and its first of each', () => {
        expect(guessSetup(scenes)).toMatchObject({ scene: 'Gameplay', window: 'Browser', hook: 'Game', audioScene: 'Gameplay', pinned: [], faderMaxDb: 0, sound: true });
        expect(guessSetup([scenes[0]])).toMatchObject({ scene: null, window: null, hook: null });
    });
    it('needs a scene and at least one capture', () => {
        expect(readSetup(null)).toBeNull();
        expect(readSetup({ scene: 'Gameplay' })).toBeNull();
        expect(readSetup({ scene: 'Gameplay', hook: 'Game' })).toMatchObject({ window: null, hook: 'Game', audioScene: 'Gameplay', faderMaxDb: 0, sound: true });
    });
    it('keeps pinned sources apart from the captures and the fader max at or under 0 dB', () => {
        const s = readSetup({ scene: 'G', window: 'W', pinned: ['Cam', 'W', '', 3], faderMaxDb: 6, sound: false, hideOthers: true });
        expect(s).toMatchObject({ pinned: ['Cam'], faderMaxDb: 0, sound: false, hideOthers: true });
        expect(readSetup({ scene: 'G', window: 'W', faderMaxDb: -12 }).faderMaxDb).toBe(-12);
    });
});

describe('captureSettings', () => {
    it('targets a specific window, matching by executable', () => {
        expect(captureSettings('hook', 'a:b:c.exe', 2)).toEqual({ capture_mode: 'window', window: 'a:b:c.exe', priority: 2 });
        expect(captureSettings('window', 'a:b:c.exe', 2)).toEqual({ window: 'a:b:c.exe', priority: 2, method: 2 });
    });
});

describe('visibilityChanges', () => {
    // 16:9 Game in Archive_1.json (2026-10-29)
    const items = [
        { sceneItemId: 1, sourceName: 'Window Capture 2', inputKind: 'window_capture', sceneItemEnabled: false },
        { sceneItemId: 2, sourceName: 'Action Cam', inputKind: null, sceneItemEnabled: true },
        { sceneItemId: 3, sourceName: 'Game Capture 2', inputKind: 'game_capture', sceneItemEnabled: true },
        { sceneItemId: 4, sourceName: 'Window Capture', inputKind: 'window_capture', sceneItemEnabled: false },
        { sceneItemId: 5, sourceName: 'mGBA', inputKind: 'window_capture', sceneItemEnabled: true },
        { sceneItemId: 6, sourceName: 'Game Capture', inputKind: null, sceneItemEnabled: false }
    ];
    const opts = { sources: ['Game Capture 2', 'Window Capture', 'Game Capture'], hideOthers: true };

    it('touches only the dock\'s own sources unless asked', () => {
        expect(visibilityChanges(items, 'Window Capture', { sources: opts.sources })).toEqual([
            { sceneItemId: 3, sourceName: 'Game Capture 2', enabled: false },
            { sceneItemId: 4, sourceName: 'Window Capture', enabled: true }
        ]);
    });

    it('shows the target and hides every other capture, leaving Action Cam alone', () => {
        expect(visibilityChanges(items, 'Window Capture', opts)).toEqual([
            { sceneItemId: 3, sourceName: 'Game Capture 2', enabled: false },
            { sceneItemId: 4, sourceName: 'Window Capture', enabled: true },
            { sceneItemId: 5, sourceName: 'mGBA', enabled: false }
        ]);
    });

    it('hides the PC captures for the capture card scene', () => {
        expect(visibilityChanges(items, 'Game Capture', opts).map(c => [c.sourceName, c.enabled])).toEqual([
            ['Game Capture 2', false], ['mGBA', false], ['Game Capture', true]
        ]);
    });

    it('changes nothing when already right', () => {
        const done = items.map(i => ({ ...i, sceneItemEnabled: i.sourceName === 'Game Capture 2' || i.sourceName === 'Action Cam' }));
        expect(visibilityChanges(done, 'Game Capture 2', opts)).toEqual([]);
    });
});

describe('levels', () => {
    it('litFraction counts the share of lit pixels', () => {
        expect(litFraction([0, 0, 0, 255, 0, 0, 0, 255], 24)).toBe(0);
        expect(litFraction([255, 255, 255, 255, 0, 0, 0, 255], 24)).toBe(0.5);
        expect(litFraction([], 24)).toBe(0);
    });
    it('peakDb takes the loudest channel peak, floored', () => {
        expect(peakDb([[0.1, 0.5, 0.5], [0.1, 0.25, 0.25]])).toBeCloseTo(-6.02, 1);
        expect(peakDb([[0, 0, 0]], -60)).toBe(-60);
        expect(peakDb([[0, 1e-9, 0]], -60)).toBe(-60);
    });
    it('meterZone matches OBS: yellow from -20, red above -9', () => {
        expect(meterZone(-30)).toBe('green');
        expect(meterZone(-20)).toBe('yellow');
        expect(meterZone(-9)).toBe('yellow');
        expect(meterZone(-8.9)).toBe('red');
    });
});

describe('pushRecent', () => {
    it('moves the exe to the front, lower-cased, capped', () => {
        expect(pushRecent(['a.exe', 'b.exe', 'c.exe'], 'C.exe', 3)).toEqual(['c.exe', 'a.exe', 'b.exe']);
        expect(pushRecent(['a.exe', 'b.exe'], 'd.exe', 2)).toEqual(['d.exe', 'a.exe']);
    });
});

describe('obs-websocket client', () => {
    const b64sha = s => createHash('sha256').update(s).digest('base64');

    it('builds the protocol auth string', async () => {
        const expected = b64sha(b64sha('supersecret' + 'salt123') + 'challenge456');
        expect(await authString('supersecret', 'salt123', 'challenge456')).toBe(expected);
    });

    it('identifies with auth, then resolves requests and reports failures', async () => {
        const sent = [];
        class FakeWs {
            constructor() {
                FakeWs.last = this;
                queueMicrotask(() => this.receive({ op: 0, d: { rpcVersion: 1, authentication: { salt: 's', challenge: 'c' } } }));
            }
            receive(msg) { this.onmessage({ data: JSON.stringify(msg) }); }
            send(text) {
                const msg = JSON.parse(text);
                sent.push(msg);
                if (msg.op === 1) this.receive({ op: 2, d: { negotiatedRpcVersion: 1 } });
                if (msg.op === 6) {
                    const ok = msg.d.requestType === 'GetVersion';
                    this.receive({ op: 7, d: {
                        requestType: msg.d.requestType, requestId: msg.d.requestId,
                        requestStatus: ok ? { result: true, code: 100 } : { result: false, code: 600, comment: 'No source' },
                        responseData: ok ? { obsVersion: '31.0.0' } : undefined
                    } });
                }
            }
            close() {}
        }
        const obs = new ObsSocket({ url: 'ws://x', password: 'pw', WebSocketImpl: FakeWs });
        await obs.connect();
        expect(sent[0].d.authentication).toBe(b64sha(b64sha('pws') + 'c'));
        expect(await obs.call('GetVersion')).toEqual({ obsVersion: '31.0.0' });
        await expect(obs.call('GetInputSettings', { inputName: 'nope' })).rejects.toThrow('No source');
    });
});

describe('both window lists (AJ, 2026-10-30)', () => {
    const hook = [item('RACCOIN:UnityWndClass:RACCOIN.exe'), item('General - (11976):Qt:Telegram.exe')];
    const win = [item('RACCOIN:UnityWndClass:RACCOIN.exe'), item('Twitch - Mozilla Firefox:MozillaWindowClass:firefox.exe')];

    it('merges them and marks which capture sees each window', async () => {
        const { mergeWindowLists } = await import('../../src/gamepicker/picker.js');
        const merged = mergeWindowLists(hook, win);
        const by = Object.fromEntries(merged.map(e => [parseWindowValue(e.itemValue).exe, [e.inHook, e.inWindow]]));
        expect(by).toEqual({ 'RACCOIN.exe': [true, true], 'Telegram.exe': [true, false], 'firefox.exe': [false, true] });
        const list = buildWindowList(merged, {});
        expect(list.find(w => w.exe === 'Telegram.exe')).toMatchObject({ inHook: true, inWindow: false });
    });

    it('never picks a capture that cannot see the window', () => {
        expect(chooseMethod('Telegram.exe', { inHook: true, inWindow: false, remembered: { 'telegram.exe': 'window' } })).toBe('hook');
        expect(chooseMethod('firefox.exe', { inHook: false, inWindow: true, remembered: { 'firefox.exe': 'hook' } })).toBe('window');
        expect(chooseMethod('RACCOIN.exe', { inHook: true, inWindow: true })).toBe('window');
    });

    it('treats a changed title of the same exe and class as the same window', async () => {
        const { sameWindow } = await import('../../src/gamepicker/picker.js');
        expect(sameWindow('General - (11976):Qt:Telegram.exe', 'General - (11980):Qt:Telegram.exe')).toBe(true);
        expect(sameWindow('A:Qt:Telegram.exe', 'A:Other:Telegram.exe')).toBe(false);
        expect(sameWindow('A:Qt:a.exe', '')).toBe(false);
    });
});

describe('channels', () => {
    it('starts with one plain channel, then only saved ones', () => {
        expect(channelList(null)).toEqual([{ ...DEFAULT_CHANNEL, volumeMul: null, muted: false }]);
        expect(channelList({}).map(c => c.id)).toEqual(['stream']);   // what OBS returns for an emptied slot
        expect(channelList({ channels: [] })).toEqual([]);
        const list = channelList({
            channels: [{ id: 'ch-browser', label: 'Browser', tracks: [2, 1, 9], copyFrom: 'Desktop Audio' }, { id: 'bad' }, { id: 'ch-b2', label: 'Browser' }],
            mix: { 'ch-browser': { volumeMul: 0.1, muted: true } }
        });
        expect(list).toEqual([{ id: 'ch-browser', label: 'Browser', tracks: [1, 2], copyFrom: 'Desktop Audio', volumeMul: 0.1, muted: true }]);
    });
    it('reads an older dock\'s channels as plain ones', () => {
        expect(channelList({ custom: [{ id: 'ch-x', label: 'X', like: 'game' }] })).toEqual([
            { id: 'ch-x', label: 'X', tracks: null, copyFrom: null, volumeMul: null, muted: false }
        ]);
    });
    it('makes a new channel with a safe label and a unique id', () => {
        const existing = channelList(null);
        expect(newChannel('  Chat (apps) ', existing, { tracks: [3, 1], copyFrom: 'Mic' }).channel)
            .toEqual({ id: 'ch-chat-apps', label: 'Chat apps', tracks: [1, 3], copyFrom: 'Mic' });
        expect(newChannel('stream', existing).error).toMatch(/already/);
        expect(newChannel('', existing).error).toMatch(/name/);
        expect(newChannel('X', existing, { tracks: [] }).error).toMatch(/track/);
        const made = newChannel('Browser', existing).channel;
        expect(made).toEqual({ id: 'ch-browser', label: 'Browser', tracks: null, copyFrom: null });
        expect(parseAppAudioName(appAudioName('App Audio: ', 'firefox.exe', made.label), 'App Audio: ').label).toBe('Browser');
    });
    it('turns tracks into OBS\'s track object', () => {
        expect(tracksObject([1, 4])).toEqual({ 1: true, 2: false, 3: false, 4: true, 5: false, 6: false });
        expect(cleanTracks('nope')).toBeNull();
    });
    it('caps the fader at the setup\'s max', () => {
        expect(20 * Math.log10(faderMul(0, -60, -12))).toBeCloseTo(-12);
        expect(faderMul(-60, -60, 0)).toBe(0);
        expect(20 * Math.log10(faderMul(-30, -60, 0))).toBeCloseTo(-30);
    });
    it('says whether a channel works: idle, live or red', () => {
        expect(activity(-60)).toBe('idle');
        expect(activity(-30)).toBe('live');
        expect(activity(-6)).toBe('red');
    });
});
