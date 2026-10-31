import { describe, it, expect } from 'vitest';
import { loudness, peaks } from '../../tools/audio/lib/loudness.js';
import { analyze, meterPeaks, OBS_METER } from '../../tools/audio/lib/analyze.js';

const FS = 48000;
const sine = (f, amp, sec, phase = 0) => {
    const x = new Float32Array(Math.round(sec * FS));
    for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * f * i) / FS + phase);
    return x;
};

describe('loudness (BS.1770 / EBU Tech 3341)', () => {
    it('reads a stereo 997 Hz sine at -23 dBFS as -23 LUFS', () => {
        const x = sine(997, Math.pow(10, -23 / 20), 20);
        const l = loudness([x, x], FS);
        expect(l.integrated).toBeCloseTo(-23, 1);
    });

    it('gates out silence: tone + silence reads the tone level', () => {
        const x = new Float32Array(20 * FS);
        x.set(sine(997, Math.pow(10, -23 / 20), 10));
        expect(Math.abs(loudness([x, x], FS).integrated + 23)).toBeLessThan(0.1);
    });

    it('measures loudness range between two levels (Tech 3342 case 1: -20 and -30 → 10 LU)', () => {
        const a = sine(1000, Math.pow(10, -20 / 20), 20);
        const b = sine(1000, Math.pow(10, -30 / 20), 20);
        const x = new Float32Array(40 * FS);
        x.set(a); x.set(b, a.length);
        expect(loudness([x, x], FS).lra).toBeCloseTo(10, 0);
    });

    it('finds the inter-sample true peak', () => {
        // fs/4 at 45° phase: samples land at ±0.707 but the wave peaks at 1
        const x = sine(FS / 4, 1, 1, Math.PI / 4);
        const p = peaks([x]);
        expect(p.samplePeak).toBeCloseTo(-3.01, 1);
        expect(p.truePeak).toBeGreaterThan(-0.3);
    });
});

describe('analyze', () => {
    it('separates speech-level bursts from the noise floor in pauses', () => {
        const x = new Float32Array(10 * FS);
        for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * 0.001; // ~-65 dBFS noise
        for (let s = 0; s < 10; s += 2) {
            const burst = sine(300, 0.3, 1);
            for (let i = 0; i < burst.length; i++) x[s * FS + i] += burst[i];
        }
        const r = analyze([x, x], FS);
        expect(r.speechPct).toBeGreaterThan(45);
        expect(r.speechPct).toBeLessThan(65);
        expect(r.pauseRmsDbfs).toBeLessThan(-60);
        expect(r.snrDb).toBeGreaterThan(40);
    });
});

describe('OBS meter', () => {
    it('uses OBS\'s zones: yellow from -20 dBFS, red above -9 dBFS', () => {
        expect(OBS_METER).toMatchObject({ yellowDbfs: -20, redDbfs: -9 });
    });

    it('counts 50 ms meter updates whose sample peak is in the red', () => {
        const x = sine(440, Math.pow(10, -12 / 20), 10); // peaks at -12: yellow
        x.set(sine(440, Math.pow(10, -6 / 20), 0.5), 5 * FS); // half a second at -6: red
        const m = meterPeaks([x, x], FS);
        expect(m.frames).toBe(200);
        expect(m.redFrames).toBeGreaterThanOrEqual(10);
        expect(m.redFrames).toBeLessThanOrEqual(11);
        expect(m.yellowPct).toBeGreaterThan(90);
    });
});
