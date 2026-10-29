/**
 * Loudness per ITU-R BS.1770-4 / EBU R128 (integrated, momentary,
 * short-term, loudness range) and true peak (4x oversampling), on planar
 * Float32 audio. Tested against the standard's reference values in
 * tests/audio/loudness.test.js.
 */

function biquad(x, b0, b1, b2, a1, a2) {
    const y = new Float64Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
        const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
        y[i] = v;
    }
    return y;
}

/**
 * K-weighting filter (shelf + high-pass) for any sample rate, using the
 * analogue prototype values from libebur128.
 * @param {Float32Array|Float64Array} x
 * @param {number} fs
 * @returns {Float64Array}
 */
export function kWeight(x, fs) {
    let f0 = 1681.974450955533;
    const G = 3.999843853973347;
    let Q = 0.7071752369554196;
    let K = Math.tan(Math.PI * f0 / fs);
    const Vh = Math.pow(10, G / 20);
    const Vb = Math.pow(Vh, 0.4996667741545416);
    let a0 = 1 + K / Q + K * K;
    const s1 = biquad(x,
        (Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0,
        2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0);
    f0 = 38.13547087602444;
    Q = 0.5003270373238773;
    K = Math.tan(Math.PI * f0 / fs);
    a0 = 1 + K / Q + K * K;
    return biquad(s1, 1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0);
}

/** Mean-square energy of K-weighted audio in sliding blocks, summed over channels. */
function blockPowers(weighted, fs, blockSec, stepSec) {
    const len = Math.round(blockSec * fs);
    const step = Math.round(stepSec * fs);
    const n = weighted[0].length;
    const out = [];
    if (n < len) return out;
    // Prefix sums of squares per channel for O(1) windows.
    const prefix = weighted.map((w) => {
        const p = new Float64Array(n + 1);
        for (let i = 0; i < n; i++) p[i + 1] = p[i] + w[i] * w[i];
        return p;
    });
    for (let s = 0; s + len <= n; s += step) {
        let z = 0;
        for (const p of prefix) z += (p[s + len] - p[s]) / len;
        out.push(z);
    }
    return out;
}

const toLufs = (z) => (z > 0 ? -0.691 + 10 * Math.log10(z) : -Infinity);

/**
 * @param {Float32Array[]} channels planar audio
 * @param {number} fs sample rate
 * @returns {{ integrated: number, momentary: number[], shortTerm: number[],
 *   lra: number, maxMomentary: number, maxShortTerm: number }}
 *   momentary is 400 ms blocks every 100 ms; shortTerm is 3 s blocks every 100 ms
 */
export function loudness(channels, fs) {
    const weighted = channels.map((c) => kWeight(c, fs));
    const mz = blockPowers(weighted, fs, 0.4, 0.1);
    const momentary = mz.map(toLufs);
    // Integrated: absolute gate -70 LUFS, then relative gate -10 LU.
    const abs = mz.filter((z) => toLufs(z) > -70);
    let integrated = -Infinity;
    if (abs.length) {
        const rel = toLufs(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
        const gated = abs.filter((z) => toLufs(z) > rel);
        if (gated.length) integrated = toLufs(gated.reduce((a, b) => a + b, 0) / gated.length);
    }
    const sz = blockPowers(weighted, fs, 3, 0.1);
    const shortTerm = sz.map(toLufs);
    // Loudness range (EBU Tech 3342): short-term, abs -70, rel -20, P95 - P10.
    let lra = 0;
    const sAbs = sz.filter((z) => toLufs(z) > -70);
    if (sAbs.length) {
        const rel = toLufs(sAbs.reduce((a, b) => a + b, 0) / sAbs.length) - 20;
        const vals = sAbs.map(toLufs).filter((l) => l > rel).sort((a, b) => a - b);
        if (vals.length) lra = percentileSorted(vals, 95) - percentileSorted(vals, 10);
    }
    const max = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity);
    return { integrated, momentary, shortTerm, lra, maxMomentary: max(momentary), maxShortTerm: max(shortTerm) };
}

/**
 * @param {number[]} sorted ascending
 * @param {number} p 0-100
 * @returns {number}
 */
export function percentileSorted(sorted, p) {
    if (!sorted.length) return NaN;
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// 4x oversampling FIR: 48-tap-per-phase Kaiser-windowed sinc, built once.
const OS = 4;
const TAPS = 48;
const PHASES = (() => {
    const N = OS * TAPS;
    const beta = 8;
    const i0 = (x) => {
        let s = 1, t = 1;
        for (let k = 1; k < 30; k++) { t *= (x / (2 * k)) ** 2; s += t; }
        return s;
    };
    const h = new Float64Array(N);
    const mid = (N - 1) / 2;
    for (let n = 0; n < N; n++) {
        const t = (n - mid) / OS;
        const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
        const w = i0(beta * Math.sqrt(1 - ((2 * n) / (N - 1) - 1) ** 2)) / i0(beta);
        h[n] = sinc * w;
    }
    return Array.from({ length: OS }, (_, p) => {
        const ph = new Float64Array(TAPS);
        for (let k = 0; k < TAPS; k++) ph[k] = h[k * OS + p];
        return ph;
    });
})();

/**
 * True peak in dBTP (4x oversampled, max over channels), plus sample peak.
 * @param {Float32Array[]} channels
 * @returns {{ truePeak: number, samplePeak: number, clipped: number }}
 *   clipped counts samples at or above -0.1 dBFS
 */
export function peaks(channels) {
    let tp = 0, sp = 0, clipped = 0;
    const clipT = Math.pow(10, -0.1 / 20);
    for (const x of channels) {
        const n = x.length;
        for (let i = 0; i < n; i++) {
            const a = Math.abs(x[i]);
            if (a > sp) sp = a;
            if (a >= clipT) clipped++;
        }
    }
    // Inter-sample peaks only exceed nearby sample peaks by a few dB, so only
    // oversample around samples within 6 dB of the sample peak (fast on hours of audio).
    const near = sp * 0.5;
    for (const x of channels) {
        const n = x.length;
        for (let i = TAPS; i < n; i++) {
            if (Math.abs(x[i - TAPS / 2]) < near) continue;
            for (let p = 0; p < OS; p++) {
                const ph = PHASES[p];
                let acc = 0;
                for (let k = 0; k < TAPS; k++) acc += ph[k] * x[i - k];
                const a = Math.abs(acc);
                if (a > tp) tp = a;
            }
        }
    }
    tp = Math.max(tp, sp);
    const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
    return { truePeak: db(tp), samplePeak: db(sp), clipped };
}
