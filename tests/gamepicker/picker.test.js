import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
    parseWindowValue, buildWindowList, chooseMethod, captureSettings,
    visibilityChanges, meanLuma, peakDb, meterZone, pushRecent
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
    const windowExes = config.gamePicker.windowExes;
    it('uses window capture for browsers and the hook for the rest', () => {
        expect(chooseMethod('firefox.exe', { windowExes })).toBe('window');
        expect(chooseMethod('RACCOIN.exe', { windowExes })).toBe('hook');
    });
    it('follows a remembered choice', () => {
        expect(chooseMethod('RACCOIN.exe', { windowExes, remembered: { 'raccoin.exe': 'window' } })).toBe('window');
        expect(chooseMethod('Firefox.exe', { windowExes, remembered: { 'firefox.exe': 'hook' } })).toBe('hook');
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
    const { sources, keep } = config.gamePicker;
    const opts = { sources: Object.values(sources), keep };

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
    it('meanLuma reads black and white', () => {
        expect(meanLuma([0, 0, 0, 255, 0, 0, 0, 255])).toBe(0);
        expect(meanLuma([255, 255, 255, 255])).toBeCloseTo(255);
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
        expect(chooseMethod('RACCOIN.exe', { inHook: true, inWindow: true })).toBe('hook');
    });

    it('treats a changed title of the same exe and class as the same window', async () => {
        const { sameWindow } = await import('../../src/gamepicker/picker.js');
        expect(sameWindow('General - (11976):Qt:Telegram.exe', 'General - (11980):Qt:Telegram.exe')).toBe(true);
        expect(sameWindow('A:Qt:Telegram.exe', 'A:Other:Telegram.exe')).toBe(false);
        expect(sameWindow('A:Qt:a.exe', '')).toBe(false);
    });
});
