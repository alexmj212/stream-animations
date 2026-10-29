import { describe, it, expect } from 'vitest';
import { runChecks, tonalShape, tonalDeviation } from '../../tools/audio/lib/checks.js';
import { audioConfig } from '../../tools/audio/config.js';
import { THIRD_OCTAVES } from '../../tools/audio/lib/spectrum.js';

const flat = THIRD_OCTAVES.map(() => -30);
const metrics = (o = {}) => ({
    truePeakDbtp: -10, clippedSamples: 0, integratedLufs: -24.5, maxMomentaryLufs: -18,
    pauseRmsDbfs: -90, onsetLossDb: { median: -1, count: 20 }, spuriousOpensPerMin: 0,
    speechBands: flat, speechLoudnessSpreadLu: 6, ...o
});
const baseline = { integratedLufs: { median: -24.5 }, speechBands: flat };
const byId = (list) => Object.fromEntries(list.map((c) => [c.id, c.pass]));

describe('audio checks', () => {
    it('passes a proposal identical to today', () => {
        const r = runChecks(metrics(), metrics(), audioConfig.checks, baseline);
        expect(r.every((c) => c.pass)).toBe(true);
    });

    it('fails overs, a level change, noisy pauses, eaten onsets and loud shouts', () => {
        const r = byId(runChecks(metrics(), metrics({
            truePeakDbtp: -0.2, integratedLufs: -21, pauseRmsDbfs: -55,
            onsetLossDb: { median: -6, count: 20 }, maxMomentaryLufs: -10
        }), audioConfig.checks, baseline));
        expect(r).toMatchObject({ 'no-clipping': false, level: false, 'pause-noise': false, 'word-onsets': false, 'loud-moments': false });
    });

    it('accepts pause noise that stays inaudible even if it rises', () => {
        const r = byId(runChecks(metrics({ pauseRmsDbfs: -140 }), metrics({ pauseRmsDbfs: -80 }), audioConfig.checks, baseline));
        expect(r['pause-noise']).toBe(true);
    });

    it('compares tone by shape, not level', () => {
        const louder = flat.map((v) => v + 10);
        expect(tonalDeviation(louder, flat).maxDb).toBeCloseTo(0, 6);
        const boomy = flat.map((v, i) => (THIRD_OCTAVES[i] <= 250 ? v + 9 : v));
        expect(tonalDeviation(boomy, flat).maxDb).toBeGreaterThan(5);
        expect(Number.isNaN(tonalShape(flat)[0])).toBe(true); // 25 Hz is outside 100 Hz-8 kHz
    });

    it('flags a limiter that works harder than today', () => {
        const st = (pct) => [{ id: 'limiter_filter', stats: { pctOver1dB: pct } }];
        const r = byId(runChecks(metrics(), metrics(), audioConfig.checks, baseline, { current: st(0.1), proposed: st(3) }));
        expect(r['limiter-work']).toBe(false);
    });
});
