/**
 * Pass/fail checks that decide whether a proposed audio chain is proven
 * better than (or as good as) what's on stream today. Each check compares
 * the proposal's render with the current chain's render of the same input,
 * and where it makes sense with the baseline measured from past streams.
 * The limits are in tools/audio/config.js with the reason for each.
 */
import { THIRD_OCTAVES } from './spectrum.js';

/**
 * Tonal balance as a curve relative to its own mean over 100 Hz-8 kHz, so
 * two signals at different levels can be compared by shape alone.
 * @param {number[]} bands dB per THIRD_OCTAVES
 * @returns {number[]} dB relative, NaN outside the range
 */
export function tonalShape(bands) {
    const idx = THIRD_OCTAVES.map((f, i) => (f >= 100 && f <= 8000 ? i : -1)).filter((i) => i >= 0);
    const mean = idx.reduce((s, i) => s + bands[i], 0) / idx.length;
    return THIRD_OCTAVES.map((f, i) => (f >= 100 && f <= 8000 ? bands[i] - mean : NaN));
}

/**
 * Largest band deviation between two tonal shapes over 100 Hz-8 kHz.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {{ maxDb: number, atHz: number }}
 */
export function tonalDeviation(a, b) {
    const sa = tonalShape(a), sb = tonalShape(b);
    let maxDb = 0, atHz = 0;
    THIRD_OCTAVES.forEach((f, i) => {
        if (Number.isNaN(sa[i])) return;
        const d = Math.abs(sa[i] - sb[i]);
        if (d > maxDb) { maxDb = d; atHz = f; }
    });
    return { maxDb, atHz };
}

const fmt = (v, unit = 'dB') => (Number.isFinite(v) ? `${v.toFixed(1)} ${unit}` : String(v));

/**
 * Run every check on one source.
 * @param {object} current analyze() of the current chain's render
 * @param {object} proposed analyze() of the proposal's render
 * @param {object} limits audioConfig.checks
 * @param {object} [baseline] aggregate from `audio baseline` ({ speechBands, integratedLufs: { min, max, median } })
 * @param {object} [stages] { current, proposed } stage stats, to count limiter work
 * @returns {Array<{ id: string, title: string, pass: boolean, detail: string, why: string }>}
 */
export function runChecks(current, proposed, limits, baseline, stages) {
    const out = [];
    const add = (id, title, pass, detail, why) => out.push({ id, title, pass, detail, why });

    add('no-clipping', 'No clipping or overs',
        proposed.truePeakDbtp <= limits.maxTruePeakDbtp && proposed.clippedSamples === 0,
        `true peak ${fmt(proposed.truePeakDbtp, 'dBTP')} (limit ${limits.maxTruePeakDbtp}), ${proposed.clippedSamples} clipped samples`,
        'Overs distort on Twitch\'s encoder and in VODs.');

    add('meter-yellow', 'Stays out of the red on OBS\'s meter',
        proposed.meter.redPct <= limits.meterRedMaxPct,
        `${proposed.meter.redFrames} of ${proposed.meter.frames} meter updates above ${limits.meterRedDbfs} dBFS (${proposed.meter.redPct.toFixed(2)}%, limit ${limits.meterRedMaxPct}%); current ${current.meter.redPct.toFixed(2)}%`,
        'AJ (2026-10-29): audio should never peak above yellow in most cases.');

    const target = baseline?.integratedLufs?.median;
    const dl = proposed.integratedLufs - (target ?? current.integratedLufs);
    add('level', 'Voice level matches past streams',
        Math.abs(dl) <= limits.levelToleranceLu,
        `${fmt(proposed.integratedLufs, 'LUFS')} vs ${target !== undefined ? 'past streams' : 'current'} ${fmt(target ?? current.integratedLufs, 'LUFS')} (${dl >= 0 ? '+' : ''}${dl.toFixed(1)} LU, limit ±${limits.levelToleranceLu})`,
        'A level change shifts the whole mix balance against game, music and alerts; that is a separate, deliberate change.');

    add('pause-noise', 'No more noise in pauses',
        proposed.pauseRmsDbfs <= Math.max(current.pauseRmsDbfs + limits.pauseNoiseMarginDb, limits.inaudibleDbfs),
        `pauses at ${fmt(proposed.pauseRmsDbfs, 'dBFS')} vs current ${fmt(current.pauseRmsDbfs, 'dBFS')}`,
        'Room noise, fans and hum between sentences are the first thing viewers notice.');

    if (proposed.onsetLossDb && current.onsetLossDb) {
        add('word-onsets', 'Starts of words are kept',
            proposed.onsetLossDb.median >= current.onsetLossDb.median - limits.onsetMarginDb,
            `first 40 ms of each word: ${fmt(proposed.onsetLossDb.median)} vs current ${fmt(current.onsetLossDb.median)} relative to the raw mic (${proposed.onsetLossDb.count} words)`,
            'A slow gate or expander eats the first consonant of each word.');
    }

    add('gate-chatter', 'No gate chatter',
        proposed.spuriousOpensPerMin <= current.spuriousOpensPerMin + limits.chatterMarginPerMin,
        `${proposed.spuriousOpensPerMin.toFixed(1)}/min spurious opens vs current ${current.spuriousOpensPerMin.toFixed(1)}/min`,
        'A gate that flutters open on breaths or keyboard sounds like a broken mic.');

    if (baseline?.speechBands) {
        const dp = tonalDeviation(proposed.speechBands, baseline.speechBands);
        const dc = tonalDeviation(current.speechBands, baseline.speechBands);
        add('tone', 'Voice tone stays like past streams',
            dp.maxDb <= Math.max(limits.toneToleranceDb, dc.maxDb),
            `largest band difference from past streams ${fmt(dp.maxDb)} at ${dp.atHz} Hz (current ${fmt(dc.maxDb)} at ${dc.atHz} Hz, limit ${limits.toneToleranceDb})`,
            'A different tone is a taste change for AJ to hear, not something to ship silently.');
    }

    add('consistency', 'Voice level is as even as today',
        proposed.speechLoudnessSpreadLu <= current.speechLoudnessSpreadLu + limits.spreadMarginLu,
        `speech loudness spread (P90-P10) ${fmt(proposed.speechLoudnessSpreadLu, 'LU')} vs current ${fmt(current.speechLoudnessSpreadLu, 'LU')}`,
        'Viewers shouldn\'t have to ride the volume between quiet and loud moments.');

    const loudC = current.maxMomentaryLufs - current.integratedLufs;
    const loudP = proposed.maxMomentaryLufs - proposed.integratedLufs;
    add('loud-moments', 'Shouts and laughs sit like today',
        Math.abs(loudP - loudC) <= limits.loudMomentsToleranceLu,
        `loudest 400 ms is ${fmt(loudP, 'LU')} over the average vs current ${fmt(loudC, 'LU')} (limit ±${limits.loudMomentsToleranceLu})`,
        'A chain that compresses less makes shouts jump out of the stream; one that compresses more flattens them.');

    if (stages) {
        const limWork = (st) => st.filter((s) => s.id === 'limiter_filter' && s.stats)
            .reduce((m, s) => Math.max(m, s.stats.pctOver1dB), 0);
        const pw = limWork(stages.proposed), cw = limWork(stages.current);
        add('limiter-work', 'Limiter works no harder than today',
            pw <= cw + limits.limiterMarginPct,
            `limiter over 1 dB of reduction ${pw.toFixed(2)}% of the time vs current ${cw.toFixed(2)}%`,
            'AJ prefers lowering a fader to leaning on a limiter, which pumps and flattens.');
    }
    return out;
}
