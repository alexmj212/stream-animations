/**
 * Motion primitives shared by every scene: easing curves, velocity-matched
 * Hermite segments, a seedable RNG and the optional motion-harness probe.
 *
 * All functions are pure (except registerProbe, which only touches `window`
 * when the motion harness is present), so they are cheap to call per frame
 * and trivial to unit test.
 */

const clamp01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t);

export const easings = {
    linear: (t) => clamp01(t),
    easeInCubic: (t) => {
        t = clamp01(t);
        return t * t * t;
    },
    easeOutCubic: (t) => {
        t = clamp01(t);
        return 1 - Math.pow(1 - t, 3);
    },
    easeInOutCubic: (t) => {
        t = clamp01(t);
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    easeOutQuart: (t) => {
        t = clamp01(t);
        return 1 - Math.pow(1 - t, 4);
    },
    easeInQuart: (t) => {
        t = clamp01(t);
        return t * t * t * t;
    },
    easeOutExpo: (t) => {
        t = clamp01(t);
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }
};

/**
 * Cubic Hermite segment: moves from p0 to p1 over `duration` seconds,
 * leaving with velocity v0 and arriving with velocity v1 (both px/s).
 *
 * Chaining segments whose boundary velocities match gives C1-continuous
 * motion - no visible "stop then lurch" where one phase hands over to the
 * next. With v0 = v1 = 0 this is the classic smoothstep.
 *
 * @param {number} p0 - Start position
 * @param {number} p1 - End position
 * @param {number} v0 - Start velocity (units per second)
 * @param {number} v1 - End velocity (units per second)
 * @param {number} duration - Segment duration in seconds
 * @param {number} t - Time into the segment in seconds (clamped)
 * @returns {number} Position at time t
 */
export function hermite(p0, p1, v0, v1, duration, t) {
    if (duration <= 0) return p1;
    const s = clamp01(t / duration);
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    return h00 * p0 + h10 * duration * v0 + h01 * p1 + h11 * duration * v1;
}

/**
 * Peak |velocity| a Hermite segment reaches (sampled; segments are cubic so
 * 64 samples is well beyond what is needed). Used to keep overshoot in check.
 */
export function hermitePeakSpeed(p0, p1, v0, v1, duration) {
    let peak = 0;
    const steps = 64;
    const dt = duration / steps;
    let prev = hermite(p0, p1, v0, v1, duration, 0);
    for (let i = 1; i <= steps; i++) {
        const cur = hermite(p0, p1, v0, v1, duration, i * dt);
        peak = Math.max(peak, Math.abs(cur - prev) / dt);
        prev = cur;
    }
    return peak;
}

/**
 * Mulberry32 - tiny, fast, good-enough seeded PRNG.
 * @param {number} seed - 32-bit integer seed
 * @returns {() => number} Function returning floats in [0, 1)
 */
export function createRandom(seed) {
    let a = seed >>> 0;
    return function random() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Read an integer `?seed=` from the URL. Returns null when absent so callers
 * can fall back to a fresh random layout per run.
 */
export function seedFromURL(search = typeof window !== 'undefined' ? window.location.search : '') {
    const raw = new URLSearchParams(search).get('seed');
    if (raw === null || raw === '') return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
}

/**
 * Stratified slot positions: splits [min, max] into `count` equal slots and
 * picks one point inside each (jittered by `jitter` of the slot width), then
 * shuffles the order. Gives "random but always balanced" layouts - no runs
 * where every accent bar clumps on one side.
 */
export function stratified(count, min, max, random, jitter = 0.7) {
    const slot = (max - min) / count;
    const points = [];
    for (let i = 0; i < count; i++) {
        const center = min + slot * (i + 0.5);
        points.push(center + (random() - 0.5) * slot * jitter);
    }
    for (let i = points.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [points[i], points[j]] = [points[j], points[i]];
    }
    return points;
}

/**
 * Expose per-frame motion telemetry to the motion harness
 * (tools/motion). No-op unless the harness injected `window.__motion`, so
 * production pages pay nothing for it.
 *
 * @param {string} scene - Scene name
 * @param {() => Array<{id: string, x: number, y?: number, phase?: string}>} sample
 */
export function registerProbe(scene, sample) {
    if (typeof window === 'undefined' || !window.__motion) return;
    window.__motion.registerProbe(scene, sample);
}

/**
 * Probe sample for an AnimatedBar-like object. `onscreen` comes from the
 * bar's bounding box so the harness can ignore off-screen motion.
 */
export function sampleBar(bar, id) {
    let onscreen = true;
    if (typeof bar.getBoundingBox === 'function' && bar.canvas) {
        const bb = bar.getBoundingBox();
        onscreen = bb.x < bar.canvas.width && bb.x + bb.width > 0 &&
            bb.y < bar.canvas.height && bb.y + bb.height > 0;
    }
    return { id, x: bar.x, y: bar.y, phase: bar.phase, onscreen };
}
