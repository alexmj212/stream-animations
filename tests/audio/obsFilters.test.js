import { describe, it, expect } from 'vitest';
import {
    createFilter, withDefaults, dbToMul, mulToDb, OBS_BLOCK
} from '../../tools/audio/lib/obsFilters.js';
import { runChain, applyChange, sourceChain, unemulated } from '../../tools/audio/lib/chain.js';

const FS = 48000;

function sine(freq, amp, seconds, phase = 0) {
    const n = Math.round(seconds * FS);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / FS + phase);
    return [x, Float32Array.from(x)];
}

/** Square wave: a constant |x|, so a peak envelope sits exactly at the amplitude. */
function square(freq, amp, seconds) {
    const n = Math.round(seconds * FS);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = Math.floor((2 * freq * i) / FS) % 2 ? -amp : amp;
    return [x, Float32Array.from(x)];
}

function run(id, settings, input) {
    const chain = { name: 't', filters: [{ name: id, id, enabled: true, settings }], volume: 1, muted: false };
    return runChain(chain, input, FS).output;
}

/** Peak level in dB over the last `seconds` of a channel. */
function tailPeakDb(ch, seconds = 0.5) {
    let p = 0;
    for (let i = ch.length - Math.round(seconds * FS); i < ch.length; i++) p = Math.max(p, Math.abs(ch[i]));
    return mulToDb(p);
}

function tailRmsDb(ch, seconds = 0.5) {
    let s = 0;
    const n = Math.round(seconds * FS);
    for (let i = ch.length - n; i < ch.length; i++) s += ch[i] * ch[i];
    return 10 * Math.log10(s / n);
}

describe('OBS filter ports', () => {
    it('merges OBS defaults under saved settings', () => {
        expect(withDefaults('noise_gate_filter', { open_threshold: -32 })).toMatchObject({
            open_threshold: -32, close_threshold: -32, attack_time: 25, hold_time: 200, release_time: 150
        });
        expect(withDefaults('expander_filter', { presets: 'gate' })).toMatchObject({ ratio: 10, release_time: 125 });
    });

    it('compressor settles on its static curve', () => {
        // -6 dBFS peak, threshold -18, 4:1: gain = 0.75 * (-18 - -6) = -9 dB
        const out = run('compressor_filter', { ratio: 4, threshold: -18, attack_time: 5, release_time: 50 }, square(100, 0.5, 2));
        expect(tailPeakDb(out[0])).toBeCloseTo(-15, 0);
    });

    it('compressor output gain is applied after compression', () => {
        const out = run('compressor_filter', { ratio: 4, threshold: -18, output_gain: 6 }, square(100, 0.5, 2));
        expect(tailPeakDb(out[0])).toBeCloseTo(-9, 0);
    });

    it('limiter holds peaks at its threshold', () => {
        const out = run('limiter_filter', { threshold: -6 }, square(100, 1, 2));
        expect(tailPeakDb(out[0])).toBeCloseTo(-6, 1);
    });

    it('limiter leaves audio under the threshold alone', () => {
        const input = sine(1000, 0.25, 1);
        const out = run('limiter_filter', { threshold: -6 }, input);
        expect(Math.max(...out[0].map((v, i) => Math.abs(v - input[0][i])))).toBeLessThan(1e-6);
    });

    it('noise gate closes under the close threshold and passes speech-level audio', () => {
        const quiet = run('noise_gate_filter', { open_threshold: -32, close_threshold: -40 }, sine(1000, dbToMul(-45), 1));
        expect(tailPeakDb(quiet[0])).toBe(-Infinity);
        const loud = run('noise_gate_filter', { open_threshold: -32, close_threshold: -40 }, sine(1000, dbToMul(-20), 1));
        expect(tailPeakDb(loud[0])).toBeCloseTo(-20, 1);
    });

    it('noise gate attack ramps linearly over attack_time', () => {
        const out = run('noise_gate_filter', { open_threshold: -32, close_threshold: -40, attack_time: 25 }, [new Float32Array(FS).fill(0.5), new Float32Array(FS).fill(0.5)]);
        // 12.5 ms in: half open
        expect(out[0][Math.round(0.0125 * FS)]).toBeCloseTo(0.25, 2);
    });

    it('expander pushes quiet audio down by (ratio - 1) x the distance under threshold', () => {
        // RMS -50 dBFS, threshold -40, 2:1 → -10 dB more
        const amp = dbToMul(-50) * Math.SQRT2;
        const out = run('expander_filter', { ratio: 2, threshold: -40 }, sine(1000, amp, 2));
        expect(tailRmsDb(out[0])).toBeCloseTo(-60, 0);
    });

    it('upward compressor lifts audio under its knee', () => {
        // RMS -30 dBFS, threshold -20, ratio 0.5, knee 10: +0.5 * 10 = +5 dB
        const amp = dbToMul(-30) * Math.SQRT2;
        const out = run('upward_compressor_filter', {}, sine(1000, amp, 2));
        expect(tailRmsDb(out[0])).toBeCloseTo(-25, 0);
    });

    it('3-band EQ at 0 dB is a 3-sample delay', () => {
        const input = sine(440, 0.5, 0.2);
        const out = run('basic_eq_filter', {}, input);
        for (let i = 100; i < 9000; i += 97) expect(out[0][i]).toBeCloseTo(input[0][i - 3], 5);
    });

    it('3-band EQ boost near the 800 Hz split partly cancels (OBS behaviour)', () => {
        // The bands are 4-pole splits summed without phase alignment, so a
        // big low boost dips the mids around 1 kHz instead of lifting them.
        const out = run('basic_eq_filter', { low: 10 }, sine(1000, 0.5, 1));
        expect(tailPeakDb(out[0]) - mulToDb(0.5)).toBeLessThan(-2);
    });

    it('3-band EQ low band boosts low frequencies by its gain', () => {
        const out = run('basic_eq_filter', { low: 6 }, sine(60, 0.1, 2));
        expect(tailPeakDb(out[0]) - mulToDb(0.1)).toBeCloseTo(6, 0);
    });

    it('gain filter multiplies', () => {
        const out = run('gain_filter', { db: 6 }, sine(1000, 0.1, 0.1));
        expect(tailPeakDb(out[0], 0.05)).toBeCloseTo(mulToDb(0.1) + 6, 1);
    });

    it('returns null for filters that only run inside OBS', () => {
        expect(createFilter({ id: 'nvidia_audiofx_filter' }, FS)).toBeNull();
        expect(createFilter({ id: 'vst_filter' }, FS)).toBeNull();
    });

    it('processes in OBS-sized blocks with state carried across them', () => {
        const input = sine(1000, 0.5, 0.5);
        const whole = run('compressor_filter', { ratio: 4, threshold: -18 }, input);
        expect(input[0].length).toBeGreaterThan(OBS_BLOCK * 10);
        // continuity: no jump at a block boundary beyond the signal's own slope
        const i = OBS_BLOCK * 5;
        expect(Math.abs(whole[0][i] - whole[0][i - 1])).toBeLessThan(0.1);
    });
});

describe('chains', () => {
    const collection = {
        sources: [{
            name: 'Mic', id: 'wasapi_input_capture', volume: 0.5, mixers: 63,
            filters: [
                { name: 'NS', id: 'nvidia_audiofx_filter', enabled: true, settings: {} },
                { name: 'Gate', id: 'noise_gate_filter', enabled: true, settings: { open_threshold: -32 } },
                { name: 'EQ', id: 'basic_eq_filter', enabled: true, settings: { low: 10 } },
                { name: 'Lim', id: 'limiter_filter', enabled: true, settings: { threshold: -7 } }
            ]
        }]
    };

    it('reads a source chain from a scene collection', () => {
        const c = sourceChain(collection, 'Mic');
        expect(c.filters.map((f) => f.name)).toEqual(['NS', 'Gate', 'EQ', 'Lim']);
        expect(c.volume).toBe(0.5);
        expect(unemulated(c)).toEqual(['NS']);
    });

    it('applies set, remove, insert, order and fader changes', () => {
        const c = applyChange(sourceChain(collection, 'Mic'), {
            set: { EQ: { settings: { low: 3 } } },
            remove: ['Lim'],
            insert: [{ after: 'EQ', filter: { name: 'Comp', id: 'compressor_filter', settings: { ratio: 3 } } }],
            order: ['NS', 'EQ', 'Gate', 'Comp'],
            volumeDb: 0
        });
        expect(c.filters.map((f) => f.name)).toEqual(['NS', 'EQ', 'Gate', 'Comp']);
        expect(c.filters[1].settings.low).toBe(3);
        expect(c.volume).toBe(1);
        // the original is untouched
        expect(sourceChain(collection, 'Mic').filters[2].settings.low).toBe(10);
    });

    it('starts after a filter OBS already applied, and reports stage taps', () => {
        const c = sourceChain(collection, 'Mic');
        const r = runChain(c, sine(100, 0.9, 0.5), FS, { startAfter: 'NS', taps: true });
        expect(r.stages.map((s) => s.name)).toEqual(['Gate', 'EQ', 'Lim']);
        expect(r.skipped).toEqual([]);
        expect(r.stages[0].tap[0].length).toBe(r.output[0].length);
        expect(r.stages[2].stats.maxGrDb).toBeGreaterThan(0);
    });

    it('feeds a sidechain key to a compressor', () => {
        const music = { name: 'Music', filters: [{ name: 'Duck', id: 'compressor_filter', enabled: true, settings: { ratio: 4, threshold: -30, sidechain_source: 'Mic' } }], volume: 1 };
        const bed = sine(200, 0.1, 1);
        const keyOn = sine(1000, 0.5, 1);
        const ducked = runChain(music, bed, FS, { keys: { Mic: keyOn } }).output;
        const free = runChain(music, bed, FS, { keys: { Mic: sine(1000, 0, 1) } }).output;
        expect(tailPeakDb(free[0])).toBeCloseTo(-20, 1);
        expect(tailPeakDb(ducked[0])).toBeLessThan(-35);
    });
});
