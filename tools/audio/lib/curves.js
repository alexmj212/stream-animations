/**
 * Steady-state behaviour of a chain, measured by running test signals
 * through the emulated filters: input level → output level (the transfer
 * curve, which shows gating, compression and limiting at a glance) and
 * frequency response at a speech level.
 */
import { runChain } from './chain.js';
import { dbToMul, mulToDb } from './obsFilters.js';

const tone = (freq, rmsDb, seconds, fs) => {
    const amp = dbToMul(rmsDb) * Math.SQRT2;
    const x = new Float32Array(Math.round(seconds * fs));
    for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / fs);
    return [x, Float32Array.from(x)];
};

const tailRmsDb = (c, fs, seconds = 0.25) => {
    const n = Math.round(seconds * fs);
    let s = 0;
    for (let i = c.length - n; i < c.length; i++) s += c[i] * c[i];
    return s > 0 ? 10 * Math.log10(s / n) : -150;
};

/**
 * Output RMS for a steady 1 kHz tone at each input RMS level (post-fader).
 * @param {object} chain
 * @param {number} fs
 * @param {object} [opts] runChain options (startAfter)
 * @returns {Array<{ inDb: number, outDb: number }>}
 */
export function transferCurve(chain, fs, opts = {}) {
    const pts = [];
    for (let inDb = -80; inDb <= 0; inDb += 2) {
        const r = runChain(chain, tone(1000, inDb, 1.5, fs), fs, opts);
        pts.push({ inDb, outDb: tailRmsDb(r.output[0], fs) });
    }
    return pts;
}

/**
 * Gain at each frequency for a tone at `levelDb` RMS, relative to the gain
 * at 1 kHz. Dynamics act the same on every tone at one level, so this
 * isolates the EQ (including the 3-band EQ's crossover dips).
 * @param {object} chain
 * @param {number} fs
 * @param {number} [levelDb] input RMS (speech is around -30 dBFS on AJ's raw mic)
 * @param {object} [opts]
 * @returns {Array<{ hz: number, db: number }>}
 */
export function frequencyResponse(chain, fs, levelDb = -30, opts = {}) {
    const freqs = [];
    for (let f = 40; f <= 16000; f *= Math.pow(2, 1 / 6)) freqs.push(Math.round(f));
    const gainAt = (hz) => {
        const r = runChain(chain, tone(hz, levelDb, 1.5, fs), fs, opts);
        return tailRmsDb(r.output[0], fs) - levelDb;
    };
    const ref = gainAt(1000);
    return freqs.map((hz) => ({ hz, db: gainAt(hz) - ref }));
}

/**
 * Peak output of a chain when AJ goes from quiet talk (-30 dBFS peaks) to a
 * sudden shout peaking at `shoutDb` on the raw mic, with a voice-like
 * 150 Hz + 450 Hz tone. Shows how much louder a shout lands than talking.
 * @param {object} chain
 * @param {number} fs
 * @param {number} [shoutDb] raw shout peak in dBFS
 * @returns {number} output peak in dBFS
 */
export function burstPeak(chain, fs, shoutDb = -6) {
    const n = Math.round(1.5 * fs);
    const x = new Float32Array(n);
    const norm = 1 / 1.3; // peak of the two-tone sum
    for (let i = 0; i < n; i++) {
        const t = i / fs;
        const peak = t >= 0.5 && t < 0.9 ? shoutDb : -30;
        x[i] = dbToMul(peak) * norm * (Math.sin(2 * Math.PI * 150 * t) + 0.3 * Math.sin(2 * Math.PI * 450 * t));
    }
    const r = runChain(chain, [x, Float32Array.from(x)], fs);
    let p = 0;
    for (const v of r.output[0]) p = Math.max(p, Math.abs(v));
    return mulToDb(p);
}
