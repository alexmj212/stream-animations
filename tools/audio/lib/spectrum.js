/**
 * Averaged power spectrum (Welch, Hann window) and 1/3-octave band levels.
 */

/**
 * In-place radix-2 FFT.
 * @param {Float64Array} re
 * @param {Float64Array} im
 */
export function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        const wr = Math.cos(ang), wi = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let cr = 1, ci = 0;
            for (let k = 0; k < len / 2; k++) {
                const a = i + k, b = a + len / 2;
                const tr = re[b] * cr - im[b] * ci;
                const ti = re[b] * ci + im[b] * cr;
                re[b] = re[a] - tr; im[b] = im[a] - ti;
                re[a] += tr; im[a] += ti;
                const nr = cr * wr - ci * wi;
                ci = cr * wi + ci * wr;
                cr = nr;
            }
        }
    }
}

/** ISO 1/3-octave centre frequencies from 25 Hz to 16 kHz. */
export const THIRD_OCTAVES = [
    25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
    1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000
];

/**
 * Average power spectrum of the mono sum, over frames where `include(frameStart)`
 * is true (for example only while speaking).
 * @param {Float32Array[]} channels
 * @param {number} fs
 * @param {object} [opts]
 * @param {number} [opts.size] FFT size (power of 2)
 * @param {(start: number, size: number) => boolean} [opts.include]
 * @returns {{ power: Float64Array, binHz: number, frames: number }}
 */
export function welch(channels, fs, opts = {}) {
    const size = opts.size || 8192;
    const hop = size / 2;
    const win = new Float64Array(size);
    let wsum = 0;
    for (let i = 0; i < size; i++) {
        win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
        wsum += win[i] * win[i];
    }
    const power = new Float64Array(size / 2 + 1);
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    const n = channels[0].length;
    const nc = channels.length;
    let frames = 0;
    for (let s = 0; s + size <= n; s += hop) {
        if (opts.include && !opts.include(s, size)) continue;
        for (let i = 0; i < size; i++) {
            let v = 0;
            for (let c = 0; c < nc; c++) v += channels[c][s + i];
            re[i] = (v / nc) * win[i];
            im[i] = 0;
        }
        fft(re, im);
        for (let k = 0; k <= size / 2; k++) power[k] += (re[k] * re[k] + im[k] * im[k]) / wsum;
        frames++;
    }
    if (frames) for (let k = 0; k < power.length; k++) power[k] /= frames;
    return { power, binHz: fs / size, frames };
}

/**
 * Band levels in dB at the 1/3-octave centres.
 * @param {{ power: Float64Array, binHz: number }} spec
 * @returns {number[]} dB per THIRD_OCTAVES entry
 */
export function thirdOctaveBands(spec) {
    return THIRD_OCTAVES.map((fc) => {
        const lo = fc / Math.pow(2, 1 / 6);
        const hi = fc * Math.pow(2, 1 / 6);
        let sum = 0;
        for (let k = Math.ceil(lo / spec.binHz); k <= Math.floor(hi / spec.binHz) && k < spec.power.length; k++) {
            sum += spec.power[k];
        }
        return sum > 0 ? 10 * Math.log10(sum) : -150;
    });
}

/**
 * Summary numbers for a spectrum: centroid, and energy in bands that map to
 * how a voice sounds (rumble, boom, body, presence, sibilance) relative to
 * the total, in dB.
 * @param {{ power: Float64Array, binHz: number }} spec
 * @returns {object}
 */
export function spectralSummary(spec) {
    const band = (lo, hi) => {
        let s = 0;
        for (let k = Math.max(1, Math.ceil(lo / spec.binHz)); k <= Math.floor(hi / spec.binHz) && k < spec.power.length; k++) {
            s += spec.power[k];
        }
        return s;
    };
    const total = band(20, 20000);
    const rel = (s) => (s > 0 && total > 0 ? 10 * Math.log10(s / total) : -150);
    let num = 0;
    for (let k = 1; k < spec.power.length; k++) num += k * spec.binHz * spec.power[k];
    return {
        centroidHz: total > 0 ? num / total : 0,
        rumbleDb: rel(band(20, 80)),
        boomDb: rel(band(80, 250)),
        bodyDb: rel(band(250, 2000)),
        presenceDb: rel(band(2000, 5000)),
        sibilanceDb: rel(band(5000, 10000)),
        airDb: rel(band(10000, 20000))
    };
}
