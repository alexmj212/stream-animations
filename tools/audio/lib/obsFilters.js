/**
 * Sample-exact JavaScript ports of OBS Studio's built-in audio filters
 * (plugins/obs-filters in obsproject/obs-studio, master as of 2026-10-29):
 * gain, noise gate, compressor (with sidechain), expander, upward
 * compressor, 3-band EQ and limiter. Each port keeps OBS's state handling
 * and per-block structure, so a raw mic recording run through a chain here
 * should null against the same chain recorded inside OBS. The harness
 * checks that claim with `npm run audio -- verify` (docs/AUDIO.md).
 *
 * Filters process planar audio in place: `process(channels, frames)` where
 * `channels` is an array of Float32Array, one per channel. Each filter keeps
 * a `stats` object (gain reduction or gate state per sample block) so every
 * stage of a chain can be measured, not just the end result.
 */

/** OBS processes audio in blocks of this many frames (AUDIO_OUTPUT_FRAMES). */
export const OBS_BLOCK = 1024;

/**
 * @param {number} db
 * @returns {number} linear multiplier, 0 for -Infinity
 */
export function dbToMul(db) {
    return Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
}

/**
 * @param {number} mul
 * @returns {number} dB, -Infinity for 0
 */
export function mulToDb(mul) {
    return mul === 0 ? -Infinity : 20 * Math.log10(mul);
}

function gainCoefficient(sampleRate, seconds) {
    return Math.exp(-1 / (sampleRate * seconds));
}

function newStats() {
    // Gain reduction in dB, summed per sample, for mean/max reporting.
    return { samples: 0, grSum: 0, grMax: 0, grOver1dB: 0 };
}

function recordGain(stats, gainMul) {
    const gr = gainMul > 0 ? -20 * Math.log10(gainMul) : 120;
    stats.samples++;
    stats.grSum += gr;
    if (gr > stats.grMax) stats.grMax = gr;
    if (gr > 1) stats.grOver1dB++;
}

/** Default settings per filter id, from each filter's *_defaults(). */
export const FILTER_DEFAULTS = {
    gain_filter: { db: 0 },
    noise_gate_filter: {
        open_threshold: -26, close_threshold: -32,
        attack_time: 25, hold_time: 200, release_time: 150
    },
    compressor_filter: {
        ratio: 10, threshold: -18, attack_time: 6, release_time: 60,
        output_gain: 0, sidechain_source: 'none'
    },
    expander_filter: {
        presets: 'expander', ratio: 2, threshold: -40, attack_time: 10,
        release_time: 50, output_gain: 0, detector: 'RMS'
    },
    upward_compressor_filter: {
        ratio: 0.5, threshold: -20, attack_time: 10, release_time: 50,
        output_gain: 0, detector: 'RMS', knee_width: 10
    },
    basic_eq_filter: { low: 0, mid: 0, high: 0 },
    limiter_filter: { threshold: -6, release_time: 60 }
};

/**
 * Merge OBS defaults under a filter's saved settings, the way obs_data does.
 * The expander's "gate" preset changes its ratio and release defaults.
 * @param {string} id OBS filter id
 * @param {object} settings saved settings (may omit defaults)
 * @returns {object}
 */
export function withDefaults(id, settings = {}) {
    const base = { ...(FILTER_DEFAULTS[id] || {}) };
    if (id === 'expander_filter' && settings.presets === 'gate') {
        base.ratio = 10;
        base.release_time = 125;
    }
    return { ...base, ...settings };
}

/**
 * Gain filter: a fixed multiplier.
 * @param {object} s settings ({ db })
 */
export function createGain(s) {
    const mul = dbToMul(s.db);
    return {
        stats: newStats(),
        process(ch, n) {
            for (const c of ch) for (let i = 0; i < n; i++) c[i] *= mul;
        }
    };
}

/**
 * Noise gate (noise-gate-filter.c): opens above the open threshold, closes
 * when a decaying peak level falls under the close threshold, with linear
 * attack/release ramps and a hold time.
 * @param {object} s settings
 * @param {number} sampleRate
 */
export function createNoiseGate(s, sampleRate) {
    const openT = dbToMul(s.open_threshold);
    const closeT = dbToMul(s.close_threshold);
    const attackRate = 1 / ((s.attack_time / 1000) * sampleRate);
    const releaseRate = 1 / ((s.release_time / 1000) * sampleRate);
    const decayRate = (openT - closeT) / ((1 / 75) * sampleRate);
    const holdTime = s.hold_time / 1000;
    const srInv = 1 / sampleRate;
    const st = { isOpen: false, attenuation: 0, level: 0, heldTime: 0 };
    const stats = { ...newStats(), opens: 0 };
    return {
        stats,
        process(ch, n) {
            for (let i = 0; i < n; i++) {
                let cur = Math.abs(ch[0][i]);
                for (const c of ch) cur = Math.max(cur, Math.abs(c[i]));
                if (cur > openT && !st.isOpen) {
                    st.isOpen = true;
                    stats.opens++;
                }
                if (st.level < closeT && st.isOpen) {
                    st.heldTime = 0;
                    st.isOpen = false;
                }
                st.level = Math.max(st.level, cur) - decayRate;
                if (st.isOpen) {
                    st.attenuation = Math.min(1, st.attenuation + attackRate);
                } else {
                    st.heldTime += srInv;
                    if (st.heldTime > holdTime) {
                        st.attenuation = Math.max(0, st.attenuation - releaseRate);
                    }
                }
                for (const c of ch) c[i] *= st.attenuation;
                recordGain(stats, st.attenuation);
            }
        }
    };
}

/**
 * Peak-envelope downward compressor shared by the compressor and limiter
 * (compressor-filter.c, limiter-filter.c). The envelope is the max over
 * channels, carried between blocks from the last sample, exactly as OBS.
 */
function createEnvelopeCompressor({ threshold, slope, attack, release, outputGain }, sampleRate) {
    const atk = gainCoefficient(sampleRate, attack);
    const rel = gainCoefficient(sampleRate, release);
    let envelope = 0;
    let envBuf = new Float32Array(OBS_BLOCK);
    const stats = newStats();
    return {
        stats,
        /**
         * @param {Float32Array[]} ch audio to change
         * @param {number} n frames
         * @param {Float32Array[]} [key] sidechain audio (same length) or undefined
         */
        process(ch, n, key) {
            if (envBuf.length < n) envBuf = new Float32Array(n);
            envBuf.fill(0, 0, n);
            const det = key || ch;
            for (const c of det) {
                let env = envelope;
                for (let i = 0; i < n; i++) {
                    const x = Math.abs(c[i]);
                    env = env < x ? x + atk * (env - x) : x + rel * (env - x);
                    if (env > envBuf[i]) envBuf[i] = env;
                }
            }
            envelope = envBuf[n - 1];
            for (let i = 0; i < n; i++) {
                const envDb = mulToDb(envBuf[i]);
                const g = dbToMul(Math.min(0, slope * (threshold - envDb)));
                for (const c of ch) c[i] *= g * outputGain;
                recordGain(stats, g);
            }
        }
    };
}

/**
 * Compressor (compressor-filter.c). With a sidechain, the runner passes the
 * key source's audio as the third argument of process().
 * @param {object} s settings
 * @param {number} sampleRate
 */
export function createCompressor(s, sampleRate) {
    const f = createEnvelopeCompressor({
        threshold: s.threshold,
        slope: 1 - 1 / s.ratio,
        attack: s.attack_time / 1000,
        release: s.release_time / 1000,
        outputGain: dbToMul(s.output_gain)
    }, sampleRate);
    const sidechain = s.sidechain_source && s.sidechain_source !== 'none' ? s.sidechain_source : null;
    return { ...f, sidechain };
}

/**
 * Limiter (limiter-filter.c): the compressor with slope 1 and a fixed 1 ms
 * attack. It has no output gain.
 * @param {object} s settings
 * @param {number} sampleRate
 */
export function createLimiter(s, sampleRate) {
    return createEnvelopeCompressor({
        threshold: s.threshold,
        slope: 1,
        attack: 0.001,
        release: s.release_time / 1000,
        outputGain: 1
    }, sampleRate);
}

/**
 * Expander and upward compressor (expander-filter.c). Gain is computed per
 * channel in dB with attack/release ballistics on the gain itself.
 * @param {object} s settings
 * @param {number} sampleRate
 * @param {boolean} isUpward true for upward_compressor_filter
 */
export function createExpander(s, sampleRate, isUpward) {
    const atk = gainCoefficient(sampleRate, s.attack_time / 1000);
    const rel = gainCoefficient(sampleRate, s.release_time / 1000);
    const outputGain = dbToMul(s.output_gain);
    const slope = 1 - s.ratio;
    const threshold = s.threshold;
    const knee = isUpward ? s.knee_width : 0;
    const peak = s.detector === 'peak';
    const rmsCoef = Math.pow(2, -100 / sampleRate); // 10 ms RMS window
    const runave = [];
    const gainState = [];
    const stats = newStats();
    return {
        stats,
        process(ch, n) {
            ch.forEach((c, chan) => {
                let ra = runave[chan] || 0;
                let prev = gainState[chan] || 0;
                for (let i = 0; i < n; i++) {
                    const x = c[i];
                    let envIn;
                    if (peak) {
                        envIn = Math.abs(x);
                    } else {
                        ra = rmsCoef * ra + (1 - rmsCoef) * x * x;
                        envIn = Math.sqrt(Math.max(ra, 0));
                    }
                    const envDb = mulToDb(envIn);
                    let diff = threshold - envDb;
                    if (isUpward && envDb <= (threshold - 60) / 2) {
                        diff = envDb + 60 > 0 ? envDb + 60 : 0;
                    }
                    let gain = 0;
                    let prevGain;
                    if (isUpward) {
                        prevGain = Math.max(prev, 0);
                        if (envDb >= threshold + knee / 2) gain = 0;
                        if (threshold - knee / 2 >= envDb) gain = slope * diff;
                        if (envDb > threshold - knee / 2 && threshold + knee / 2 > envDb) {
                            gain = slope * Math.pow(diff + knee / 2, 2) / (2 * knee);
                        }
                    } else {
                        prevGain = prev;
                        gain = diff > 0 ? Math.max(slope * diff, -60) : 0;
                    }
                    const g = gain > prevGain
                        ? atk * prevGain + (1 - atk) * gain
                        : rel * prevGain + (1 - rel) * gain;
                    prev = g;
                    const mul = isUpward ? dbToMul(g) : dbToMul(Math.min(0, g));
                    c[i] = x * mul * outputGain;
                    if (chan === 0) recordGain(stats, mul);
                }
                runave[chan] = ra;
                gainState[chan] = prev;
            });
        }
    };
}

/**
 * 3-band EQ (eq-filter.c): 4-pole low and high splits at 800 Hz and 5 kHz,
 * mid is what's left, with a 3-sample delay on the dry path.
 * @param {object} s settings ({ low, mid, high } in dB)
 * @param {number} sampleRate
 */
export function createEq(s, sampleRate) {
    const lf = 2 * Math.sin(Math.PI * 800 / sampleRate);
    const hf = 2 * Math.sin(Math.PI * 5000 / sampleRate);
    const lg = dbToMul(s.low);
    const mg = dbToMul(s.mid);
    const hg = dbToMul(s.high);
    const EPS = 1 / 4294967295;
    const states = [];
    return {
        stats: newStats(),
        process(ch, n) {
            ch.forEach((c, chan) => {
                const st = states[chan] || (states[chan] = new Float64Array(11));
                // l0..l3, h0..h3, d1..d3
                for (let i = 0; i < n; i++) {
                    const x = c[i];
                    st[0] += lf * (x - st[0]) + EPS;
                    st[1] += lf * (st[0] - st[1]);
                    st[2] += lf * (st[1] - st[2]);
                    st[3] += lf * (st[2] - st[3]);
                    const l = st[3];
                    st[4] += hf * (x - st[4]) + EPS;
                    st[5] += hf * (st[4] - st[5]);
                    st[6] += hf * (st[5] - st[6]);
                    st[7] += hf * (st[6] - st[7]);
                    const h = st[10] - st[7];
                    const m = st[10] - (h + l);
                    st[10] = st[9];
                    st[9] = st[8];
                    st[8] = x;
                    c[i] = l * lg + m * mg + h * hg;
                }
            });
        }
    };
}

/** Filter ids this module can run offline. */
export const EMULATED = new Set([
    'gain_filter', 'noise_gate_filter', 'compressor_filter', 'expander_filter',
    'upward_compressor_filter', 'basic_eq_filter', 'limiter_filter'
]);

/**
 * Build a filter from an OBS filter entry ({ id, settings }).
 * @param {{ id: string, settings?: object }} filter
 * @param {number} sampleRate
 * @returns {object|null} null when the filter can't be emulated offline
 */
export function createFilter(filter, sampleRate) {
    const s = withDefaults(filter.id, filter.settings);
    switch (filter.id) {
    case 'gain_filter': return createGain(s);
    case 'noise_gate_filter': return createNoiseGate(s, sampleRate);
    case 'compressor_filter': return createCompressor(s, sampleRate);
    case 'limiter_filter': return createLimiter(s, sampleRate);
    case 'expander_filter': return createExpander(s, sampleRate, false);
    case 'upward_compressor_filter': return createExpander(s, sampleRate, true);
    case 'basic_eq_filter': return createEq(s, sampleRate);
    default: return null;
    }
}
