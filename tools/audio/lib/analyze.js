/**
 * Every measurement the audio harness reports for one signal: loudness,
 * peaks, noise floor in pauses, speech level, how the starts of words
 * survive, gate chatter, dynamics and spectrum.
 *
 * To compare two renders fairly, pass the same `activity` mask (worked out
 * once from the raw input) to both, so both are measured over exactly the
 * same speech and pause regions.
 */
import { loudness, peaks, percentileSorted } from './loudness.js';
import { welch, thirdOctaveBands, spectralSummary } from './spectrum.js';

/**
 * OBS's mixer meter thresholds (VolumeMeter defaults: green below -20 dBFS,
 * yellow -20 to -9, red above -9), and how often the meter's peak updates.
 * AJ (2026-10-29): "audio should never peak above yellow in most cases".
 */
export const OBS_METER = { yellowDbfs: -20, redDbfs: -9, frameSec: 0.05 };

/**
 * How a signal reads on OBS's mixer meter: the sample peak in each 50 ms
 * meter frame, and how many frames go into the red.
 * @param {Float32Array[]} channels post-fader audio, as the meter sees it
 * @param {number} fs
 * @returns {{ frames: number, redFrames: number, redPct: number, yellowPct: number, p999Dbfs: number }}
 */
export function meterPeaks(channels, fs) {
    const len = Math.round(OBS_METER.frameSec * fs);
    const frames = Math.floor(channels[0].length / len);
    const red = dbToMulPeak(OBS_METER.redDbfs);
    const yellow = dbToMulPeak(OBS_METER.yellowDbfs);
    const peaks = new Float64Array(frames);
    let redFrames = 0, yellowFrames = 0;
    for (let f = 0; f < frames; f++) {
        let p = 0;
        for (const c of channels) for (let i = f * len; i < (f + 1) * len; i++) { const a = Math.abs(c[i]); if (a > p) p = a; }
        peaks[f] = p;
        if (p > red) redFrames++;
        else if (p > yellow) yellowFrames++;
    }
    const sorted = Array.from(peaks).sort((a, b) => a - b);
    const p999 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(0.999 * sorted.length))] : 0;
    return {
        frames,
        redFrames,
        redPct: (100 * redFrames) / Math.max(1, frames),
        yellowPct: (100 * yellowFrames) / Math.max(1, frames),
        p999Dbfs: p999 > 0 ? 20 * Math.log10(p999) : -150
    };
}

const dbToMulPeak = (db) => Math.pow(10, db / 20);

/** Frame length for level and activity analysis. */
export const FRAME_SEC = 0.02;

const dbPow = (p) => (p > 0 ? 10 * Math.log10(p) : -150);

/**
 * Mean-square level per frame (mono sum).
 * @param {Float32Array[]} channels
 * @param {number} fs
 * @returns {Float64Array} power per frame
 */
export function framePowers(channels, fs) {
    const len = Math.round(FRAME_SEC * fs);
    const frames = Math.floor(channels[0].length / len);
    const out = new Float64Array(frames);
    const nc = channels.length;
    for (let f = 0; f < frames; f++) {
        let s = 0;
        for (let i = f * len; i < (f + 1) * len; i++) {
            let v = 0;
            for (let c = 0; c < nc; c++) v += channels[c][i];
            v /= nc;
            s += v * v;
        }
        out[f] = s / len;
    }
    return out;
}

/**
 * Speech activity per frame, with hysteresis and a hangover so word tails
 * and short gaps between words count as speech. Thresholds sit relative to
 * the noise floor (10th percentile) and the speech level (95th percentile).
 * @param {Float64Array} powers from framePowers
 * @returns {{ active: Uint8Array, floorDb: number, openDb: number }}
 */
export function speechActivity(powers) {
    const db = Array.from(powers, dbPow);
    const sorted = [...db].sort((a, b) => a - b);
    const floor = percentileSorted(sorted, 10);
    const top = percentileSorted(sorted, 95);
    // Open a third of the way from floor to speech peak, close 6 dB lower.
    const openDb = floor + Math.max(10, (top - floor) / 3);
    const closeDb = openDb - 6;
    const hang = Math.round(0.2 / FRAME_SEC);
    const active = new Uint8Array(db.length);
    let on = false, held = 0;
    for (let i = 0; i < db.length; i++) {
        if (!on && db[i] > openDb) on = true;
        if (on && db[i] < closeDb) {
            if (++held > hang) { on = false; held = 0; }
        } else {
            held = 0;
        }
        active[i] = on ? 1 : 0;
    }
    return { active, floorDb: floor, openDb };
}

/**
 * Onsets: inactive → active after at least `minGapSec` of pause.
 * @param {Uint8Array} active
 * @param {number} [minGapSec]
 * @returns {number[]} frame indices
 */
export function onsets(active, minGapSec = 0.25) {
    const gap = Math.round(minGapSec / FRAME_SEC);
    const out = [];
    let quiet = gap;
    for (let i = 0; i < active.length; i++) {
        if (active[i]) {
            if (quiet >= gap) out.push(i);
            quiet = 0;
        } else {
            quiet++;
        }
    }
    return out;
}

/**
 * Measure one signal.
 * @param {Float32Array[]} channels
 * @param {number} fs
 * @param {object} [opts]
 * @param {Uint8Array} [opts.activity] speech mask per frame (from the raw input)
 * @param {Float64Array} [opts.refPowers] frame powers of the raw input, to
 *   measure how much of each word onset survives relative to the input
 * @param {boolean} [opts.spectrum] include spectra (default true)
 * @returns {object}
 */
export function analyze(channels, fs, opts = {}) {
    const powers = framePowers(channels, fs);
    const own = speechActivity(powers);
    const active = opts.activity || own.active;
    const n = Math.min(active.length, powers.length);
    let sp = 0, spN = 0, np = 0, nN = 0, silent = 0;
    const pauseDb = [];
    for (let i = 0; i < n; i++) {
        if (active[i]) { sp += powers[i]; spN++; } else {
            np += powers[i]; nN++;
            pauseDb.push(dbPow(powers[i]));
        }
        if (dbPow(powers[i]) < -100) silent++;
    }
    pauseDb.sort((a, b) => a - b);
    const speechDb = spN ? dbPow(sp / spN) : -150;
    const noiseDb = nN ? dbPow(np / nN) : -150;
    const durationSec = channels[0].length / fs;

    // Gate chatter: how often the output itself flips on in pauses. Each
    // rise in the output's own activity that isn't a word onset in the
    // reference mask counts as a spurious open.
    const outOn = onsets(own.active, 0.1);
    const refOn = new Set(onsets(active, 0.1));
    let spurious = 0;
    for (const o of outOn) {
        let near = false;
        for (let d = -5; d <= 5 && !near; d++) if (refOn.has(o + d) || active[o + d]) near = true;
        if (!near) spurious++;
    }

    // Onset survival: energy in the first 40 ms of each word relative to the
    // next 200 ms, output minus input. 0 dB = untouched, negative = the start
    // of words is cut (a slow gate attack eats consonants).
    let onsetLossDb = null;
    if (opts.refPowers) {
        const ons = onsets(active);
        const diffs = [];
        const head = 2, body = 10;
        for (const o of ons) {
            if (o + head + body >= n) continue;
            const sum = (p, a, b) => { let s = 0; for (let i = a; i < b; i++) s += p[i]; return s / (b - a); };
            const outR = dbPow(sum(powers, o, o + head)) - dbPow(sum(powers, o + head, o + head + body));
            const inR = dbPow(sum(opts.refPowers, o, o + head)) - dbPow(sum(opts.refPowers, o + head, o + head + body));
            if (Number.isFinite(outR) && Number.isFinite(inR)) diffs.push(outR - inR);
        }
        if (diffs.length) {
            diffs.sort((a, b) => a - b);
            onsetLossDb = { median: percentileSorted(diffs, 50), p10: percentileSorted(diffs, 10), count: diffs.length };
        }
    }

    const loud = loudness(channels, fs);
    // Speech loudness consistency: spread of momentary loudness while talking.
    const momSpeech = [];
    loud.momentary.forEach((l, b) => {
        const f = Math.round((b * 0.1 + 0.2) / FRAME_SEC);
        if (active[f] && l > loud.integrated - 20) momSpeech.push(l);
    });
    momSpeech.sort((a, b) => a - b);
    const pk = peaks(channels);

    const result = {
        durationSec,
        integratedLufs: loud.integrated,
        lra: loud.lra,
        maxMomentaryLufs: loud.maxMomentary,
        maxShortTermLufs: loud.maxShortTerm,
        truePeakDbtp: pk.truePeak,
        samplePeakDbfs: pk.samplePeak,
        clippedSamples: pk.clipped,
        speechRmsDbfs: speechDb,
        pauseRmsDbfs: noiseDb,
        pauseP90Dbfs: pauseDb.length ? percentileSorted(pauseDb, 90) : -150,
        snrDb: speechDb - noiseDb,
        crestDb: pk.samplePeak - speechDb,
        speechLoudnessSpreadLu: momSpeech.length
            ? percentileSorted(momSpeech, 90) - percentileSorted(momSpeech, 10) : 0,
        speechPct: (100 * spN) / Math.max(1, n),
        digitalSilencePct: (100 * silent) / Math.max(1, n),
        meter: meterPeaks(channels, fs),
        spuriousOpensPerMin: spurious / (durationSec / 60),
        onsetLossDb,
        series: {
            momentary: loud.momentary,
            frameDb: Array.from(powers, dbPow)
        }
    };
    if (opts.spectrum !== false) {
        const len = Math.round(FRAME_SEC * fs);
        const frac = (want) => (s, size) => {
            const a = Math.floor(s / len), b = Math.floor((s + size) / len);
            let k = 0;
            for (let i = a; i < b && i < n; i++) k += active[i];
            return want ? k / (b - a) > 0.8 : k === 0;
        };
        const speechSpec = welch(channels, fs, { include: frac(true) });
        const pauseSpec = welch(channels, fs, { include: frac(false) });
        result.speechBands = thirdOctaveBands(speechSpec);
        result.pauseBands = thirdOctaveBands(pauseSpec);
        result.speechSpectrum = spectralSummary(speechSpec);
        result.spectrumFrames = { speech: speechSpec.frames, pause: pauseSpec.frames };
    }
    return result;
}
