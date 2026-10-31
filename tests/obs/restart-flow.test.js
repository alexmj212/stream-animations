import { describe, it, expect } from 'vitest';
import { restartObs, liveStatus, AITUM_VENDOR } from '../../tools/obs/restart-flow.js';

/** A fake OBS: records calls, answers from `state`. */
function fakeObs(state, calls) {
    return {
        async call(type, data = {}) {
            calls.push(data.requestType ? `${type}:${data.requestType}` : type);
            switch (type) {
                case 'GetStreamStatus': return { outputActive: state.stream };
                case 'GetRecordStatus': return { outputActive: state.record };
                case 'GetCurrentProgramScene': return { currentProgramSceneName: 'BRB' };
                case 'GetReplayBufferStatus': return { outputActive: state.rb };
                case 'StartReplayBuffer': state.rb = true; return {};
                case 'CallVendorRequest':
                    if (data.vendorName !== AITUM_VENDOR) throw new Error('no vendor');
                    if (data.requestType === 'start_backtrack') { state.bt = true; return {}; }
                    return { responseData: { streaming: state.vstream, recording: false, backtrack: state.bt } };
                case 'GetSourceFilter': return { filterEnabled: true };
                case 'GetSourceScreenshot': return { imageData: 'data:image/png;base64,AA==' };
                default: return {};
            }
        },
        async close() { calls.push('close'); }
    };
}

function harness(state) {
    const calls = [];
    let running = true;
    let clock = 0;
    let connects = 0;
    const io = {
        connect: async () => {
            connects++;
            if (!running && connects > 1 && !state.launched) throw new Error('down');
            return fakeObs(state, calls);
        },
        backup: async () => { calls.push('backup'); return 'Archive_1.json.bak-x'; },
        closeObs: async () => { calls.push('closeObs'); state.closing = 2; },
        isRunning: async () => { if (state.closing-- > 0) return true; running = false; return false; },
        launchObs: async () => { calls.push('launchObs'); state.launched = true; },
        logLines: async () => ['ok line', 'device_texture_create failed'],
        saveShot: async name => `${name}.png`,
        sleep: async ms => { clock += ms; },
        now: () => clock
    };
    return { io, calls };
}

describe('liveStatus', () => {
    it('counts the vertical canvas as live', async () => {
        const calls = [];
        const r = await liveStatus(fakeObs({ stream: false, record: false, vstream: true }, calls));
        expect(r.live).toBe(true);
    });
});

describe('restartObs', () => {
    it('refuses while streaming, without backing up or closing', async () => {
        const { io, calls } = harness({ stream: true, record: false });
        const s = await restartObs(io);
        expect(s.ok).toBe(false);
        expect(s.abort).toMatch(/live/);
        expect(calls).not.toContain('backup');
        expect(calls).not.toContain('closeObs');
    });

    it('dry run changes nothing', async () => {
        const { io, calls } = harness({ stream: false, record: false });
        const s = await restartObs(io, { dryRun: true });
        expect(s.ok).toBe(true);
        expect(calls).not.toContain('backup');
        expect(calls).not.toContain('closeObs');
    });

    it('backs up before closing, relaunches, restarts outputs and returns to the start scene', async () => {
        const state = { stream: false, record: false, rb: false, bt: false };
        const { io, calls } = harness(state);
        const s = await restartObs(io, { cameraCheck: true });
        expect(s.ok).toBe(true);
        expect(calls.indexOf('backup')).toBeLessThan(calls.indexOf('closeObs'));
        expect(calls.indexOf('closeObs')).toBeLessThan(calls.indexOf('launchObs'));
        expect(calls).toContain('StartReplayBuffer');
        expect(calls).toContain('CallVendorRequest:start_backtrack');
        expect(s.outputs).toEqual({ replayBuffer: true, backtrack: true });
        expect(s.camera).toEqual({ removalEnabled: true, screenshot: 'cam-base-full169.png' });
        expect(s.startScene).toBe('BRB');
        expect(s.logProblems).toEqual(['device_texture_create failed']);
    });

    it('gives up rather than killing OBS when it will not exit', async () => {
        const { io, calls } = harness({ stream: false, record: false });
        io.isRunning = async () => true;
        const s = await restartObs(io, { exitTimeoutMs: 5000 });
        expect(s.abort).toMatch(/never kill/);
        expect(calls).not.toContain('launchObs');
    });
});
