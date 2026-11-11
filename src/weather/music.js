// Background music for Exo-Cast (AJ, 2026-11-11: "I want background music,
// it should be j fusion jazz"). An original loop in the style of 80s Japanese
// fusion: an FM electric piano comping maj9 chords, a busy sixteenth-note
// bass, a drum machine with a ride-like hat, and a lead line over the middle.
// Nothing is sampled: every note is synthesised here in plain JS, so the
// same code renders in the page (into an AudioBuffer, once, at load) and in
// Node for the audio CI gate (`npm run audio -- assets`, Audio expert,
// 2026-11-11). No limiter or compressor: the loop is normalised to a 0 dBFS
// peak here and the page sets its level with config.weather.music.gainDb.

export const BPM = 108;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;
const ROLL = 0.014;         // s between a chord's notes: rolled, not struck as one, so their attacks don't stack

// 16 bars of changes, two chords a bar where marked: [root midi, chord tones above the root]
const MAJ9 = [4, 7, 11, 14];
const MIN9 = [3, 7, 10, 14];
const DOM13 = [4, 10, 14, 21];
const SUS = [5, 10, 14, 19];
const CHANGES = [
    [[55, MAJ9]], [[54, MIN9]], [[52, MIN9]], [[57, DOM13]],
    [[50, MAJ9]], [[59, MIN9]], [[52, MIN9], [57, SUS]], [[50, MAJ9]],
    [[55, MAJ9]], [[57, DOM13]], [[54, MIN9]], [[59, MIN9]],
    [[52, MIN9]], [[57, SUS]], [[50, MAJ9]], [[57, DOM13]]
];

// The lead's melody over the second time through: [beat in the 16-bar
// form, length in beats, midi]. Pentatonic, with pushes ahead of the beat.
const MELODY = [
    [0, 1.5, 74], [1.5, 0.5, 76], [2, 1, 78], [3.5, 2.5, 81],
    [8, 0.5, 79], [8.5, 0.5, 78], [9, 1, 76], [10.5, 1.5, 74], [12, 3, 76],
    [16, 1.5, 78], [17.5, 0.5, 81], [18, 1, 83], [19.5, 2.5, 81], [23, 1, 78],
    [24, 1, 76], [25, 1, 74], [26, 1, 73], [27.5, 4.5, 74],
    [32, 1.5, 79], [33.5, 0.5, 81], [34, 1, 83], [35.5, 2.5, 86],
    [40, 0.5, 84], [40.5, 0.5, 83], [41, 1, 81], [42.5, 1.5, 78], [44, 3, 79],
    [48, 1, 76], [49, 1, 78], [50, 1, 81], [51.5, 2, 79], [54, 1, 78],
    [56, 1.5, 76], [57.5, 0.5, 74], [58, 6, 74]
];

// Comping rhythm per bar: beat offsets and lengths (pushes on the "and")
const COMP = [[0, 1.2], [1.5, 0.4], [2.5, 1.4], [3.75, 0.25]];
// Bass rhythm per bar: [beat, length, interval above the root]
const BASSLINE = [
    [0, 0.45, 0], [0.75, 0.2, 12], [1, 0.45, 7], [1.75, 0.2, 0],
    [2, 0.45, 10], [2.5, 0.2, 12], [3, 0.45, 7], [3.5, 0.45, 5]
];

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** Seeded PRNG (mulberry32), so every render is identical. */
function prng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Every note of the loop: 32 bars (the 16-bar form twice, the lead on the
 * second pass), about 71 s at 108 BPM.
 * @returns {{events: Array<Object>, seconds: number}}
 */
export function score() {
    const events = [];
    const bars = CHANGES.length;
    for (let pass = 0; pass < 2; pass++) {
        for (let b = 0; b < bars; b++) {
            const t0 = (pass * bars + b) * BAR;
            const chords = CHANGES[b];
            // Electric piano: voiced an octave up, two chords split the bar
            COMP.forEach(([beat, len], k) => {
                const [root, tones] = chords[chords.length > 1 && beat >= 2 ? 1 : 0];
                // Rolled a little, low to high, the way a player's hand lands
                tones.forEach((iv, n) => {
                    events.push({ v: 'ep', t: t0 + beat * BEAT + n * ROLL, d: len * BEAT, m: root + iv, a: k === 0 ? 0.8 : 0.6 });
                });
            });
            // Bass, two octaves down
            for (const [beat, len, iv] of BASSLINE) {
                const [root] = chords[chords.length > 1 && beat >= 2 ? 1 : 0];
                events.push({ v: 'bass', t: t0 + beat * BEAT, d: len * BEAT, m: root - 24 + iv, a: beat % 1 ? 0.7 : 1 });
            }
            // Drums: kick on 1 and the "and" of 2, snare on 2 and 4, sixteenth hats
            for (const beat of [0, 1.5, 2.75]) events.push({ v: 'kick', t: t0 + beat * BEAT, a: beat ? 0.8 : 1 });
            for (const beat of [1, 3]) events.push({ v: 'snare', t: t0 + beat * BEAT, a: 1 });
            for (let s = 0; s < 16; s++) events.push({ v: 'hat', t: t0 + (s / 4) * BEAT, a: s % 4 === 0 ? 1 : s % 2 ? 0.45 : 0.7 });
            if (b === bars - 1) {
                // A tom fill into the top of the form
                [3, 3.25, 3.5, 3.75].forEach((beat, k) => events.push({ v: 'tom', t: t0 + beat * BEAT, m: 50 - k * 3, a: 0.9 }));
            }
        }
    }
    for (const [beat, len, m] of MELODY) {
        events.push({ v: 'lead', t: bars * BAR + beat * BEAT, d: len * BEAT, m, a: 1 });
    }
    return { events, seconds: 2 * bars * BAR };
}

// Mix: gain and stereo position per voice (pan -1 left .. 1 right)
const MIX = {
    ep: { g: 0.09, pan: -0.25 },
    bass: { g: 0.32, pan: 0 },
    kick: { g: 0.45, pan: 0 },
    snare: { g: 0.22, pan: 0.05 },
    hat: { g: 0.05, pan: 0.35 },
    tom: { g: 0.3, pan: -0.15 },
    lead: { g: 0.13, pan: 0.15 }
};

/**
 * One voice's samples for a note, written into the mix (looping round the
 * end so the loop's seam is seamless).
 */
function voice(e, sr, out, random) {
    const n = out[0].length;
    const mix = MIX[e.v];
    const gl = mix.g * e.a * Math.cos(((mix.pan + 1) * Math.PI) / 4) * Math.SQRT2;
    const gr = mix.g * e.a * Math.sin(((mix.pan + 1) * Math.PI) / 4) * Math.SQRT2;
    const start = Math.round(e.t * sr);
    let len;
    let sample;
    const f = e.m ? hz(e.m) : 0;
    const w = (2 * Math.PI) / sr;
    if (e.v === 'ep') {
        // FM tine: a sine modulated at 1x, the brightness dying faster than the note
        len = Math.round((e.d + 0.35) * sr);
        sample = (i) => {
            const s = i / sr;
            const env = Math.exp(-s * 2.2) * (s < e.d ? 1 : Math.exp(-(s - e.d) * 14));
            const idx = 1.6 * Math.exp(-s * 7);
            const tine = 0.18 * Math.sin(w * f * 14 * i) * Math.exp(-s * 30);
            return env * (Math.sin(w * f * i + idx * Math.sin(w * f * i)) + tine);
        };
    } else if (e.v === 'bass') {
        // A plucked, slightly square bass: odd harmonics that fall away
        len = Math.round((e.d + 0.06) * sr);
        sample = (i) => {
            const s = i / sr;
            const env = Math.min(1, s * 400) * Math.exp(-s * 5) * (s < e.d ? 1 : Math.exp(-(s - e.d) * 60));
            const bright = Math.exp(-s * 12);
            const p = w * f * i;
            return env * (Math.sin(p) + bright * (0.35 * Math.sin(3 * p) + 0.15 * Math.sin(5 * p)) + 0.2 * Math.sin(2 * p));
        };
    } else if (e.v === 'kick') {
        len = Math.round(0.35 * sr);
        let ph = 0;
        sample = (i) => {
            const s = i / sr;
            ph += w * (48 + 110 * Math.exp(-s * 28));
            return Math.sin(ph) * Math.exp(-s * 9) * Math.min(1, s * 2000);
        };
    } else if (e.v === 'tom') {
        len = Math.round(0.3 * sr);
        let ph = 0;
        sample = (i) => {
            const s = i / sr;
            ph += w * f * (1 + 0.5 * Math.exp(-s * 20));
            return Math.sin(ph) * Math.exp(-s * 10);
        };
    } else if (e.v === 'snare') {
        len = Math.round(0.25 * sr);
        let lp = 0;
        sample = (i) => {
            const s = i / sr;
            const noise = random() * 2 - 1;
            lp += 0.45 * (noise - lp);
            return (0.8 * (noise - lp) + 0.6 * lp) * Math.exp(-s * 18) + 0.5 * Math.sin(w * 190 * i) * Math.exp(-s * 30);
        };
    } else if (e.v === 'hat') {
        len = Math.round(0.07 * sr);
        let prev = 0;
        sample = (i) => {
            const s = i / sr;
            const noise = random() * 2 - 1;
            const hp = noise - prev;            // first difference: a crude high-pass
            prev = noise;
            return hp * Math.exp(-s * 55);
        };
    } else {
        // Lead: a soft square-ish lyricon with delayed vibrato
        len = Math.round((e.d + 0.15) * sr);
        sample = (i) => {
            const s = i / sr;
            const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * s) * Math.min(1, Math.max(0, s - 0.25) * 3);
            const p = w * f * vib * i;
            const env = Math.min(1, s * 30) * (s < e.d ? 1 - 0.15 * Math.min(1, s) : Math.exp(-(s - e.d) * 25) * 0.85);
            return env * (Math.sin(p) + 0.3 * Math.sin(3 * p) + 0.12 * Math.sin(5 * p));
        };
    }
    for (let i = 0; i < len; i++) {
        const v = sample(i);
        const j = (start + i) % n;
        out[0][j] += v * gl;
        out[1][j] += v * gr;
    }
}

/**
 * Render the loop. A generator, so the page can spread the work over idle
 * time (it yields about every `chunk` events); its return value is the
 * finished loop, normalised to a 0 dBFS sample peak.
 * @param {number} sr - Sample rate
 * @param {number} [chunk=40]
 * @returns {Generator<number, {channels: Float32Array[], sampleRate: number, seconds: number}>}
 */
export function* renderMusic(sr, chunk = 40) {
    const { events, seconds } = score();
    const n = Math.round(seconds * sr);
    const out = [new Float32Array(n), new Float32Array(n)];
    const random = prng(1979);
    for (let k = 0; k < events.length; k++) {
        voice(events[k], sr, out, random);
        if (k % chunk === chunk - 1) yield (k + 1) / events.length;
    }
    let peak = 0;
    for (const c of out) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(c[i]));
    for (const c of out) for (let i = 0; i < n; i++) c[i] /= peak;
    return { channels: out, sampleRate: sr, seconds };
}

/**
 * The whole loop at once (Node and tests).
 * @param {number} sr
 */
export function renderMusicSync(sr) {
    const it = renderMusic(sr);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
}
