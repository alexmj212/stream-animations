/**
 * Virtual clock injected into the page before any scene script runs
 * (page.evaluateOnNewDocument). It replaces wall-clock time with a time the
 * harness advances explicitly, so every frame of a scene can be rendered,
 * sampled and screenshotted at an exact timestamp regardless of how slow the
 * machine (or the screenshotting) is.
 *
 * - requestAnimationFrame callbacks queue up and only run on __motion.step()
 * - performance.now() / Date.now() return virtual time
 * - Math.random is replaced by a seeded PRNG (?seed=, default 1) so runs are
 *   reproducible
 * - CSS animations are paused and advanced in lock-step with the clock
 *
 * This file is stringified and injected; it must stay self-contained.
 */
export function installVirtualClock(seed) {
  const realNow = performance.now.bind(performance);
  const dateBase = Date.now();
  let now = 0;
  let nextId = 0;
  let queue = new Map();
  const probes = [];

  performance.now = () => now;
  Date.now = () => dateBase + Math.round(now);

  window.requestAnimationFrame = (cb) => {
    const id = ++nextId;
    queue.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => { queue.delete(id); };

  let a = (seed >>> 0) || 1;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  window.__motion = {
    now: () => now,
    pending: () => queue.size,
    registerProbe(scene, sample) { probes.push({ scene, sample }); },
    hasProbe: () => probes.length > 0,

    /**
     * Advance virtual time by dtMs and run one frame's worth of rAF callbacks.
     * Returns how long the callbacks took in real milliseconds (CPU cost of
     * update + draw for that frame) and the probe samples.
     */
    step(dtMs) {
      now += dtMs;
      for (const anim of document.getAnimations()) {
        anim.pause();
        anim.currentTime = (anim.currentTime ?? 0) + dtMs;
      }
      const callbacks = queue;
      queue = new Map();
      const start = realNow();
      for (const cb of callbacks.values()) cb(now);
      const workMs = realNow() - start;
      const samples = [];
      for (const p of probes) {
        for (const s of p.sample() || []) samples.push(s);
      }
      return { t: now, workMs, ran: callbacks.size, samples };
    },

    /**
     * Pixel statistics for the scene canvas (largest <canvas> on the page,
     * combined with any other layer canvases of the same size).
     * Samples every `stride`-th pixel on both axes.
     *  - opaque: fraction of pixels with alpha >= 250 (fully covered)
     *  - visible: fraction with alpha > 8 (anything drawn)
     *  - minAlphaInRegion: smallest alpha inside an optional region
     */
    pixelStats(stride = 2, region = null) {
      // Scenes can stack full-size layer canvases (background has two), so
      // read every canvas the size of the largest and composite their alpha
      // per pixel (source-over: 1 - prod(1 - a_i)). Measuring one layer
      // missed most of the background's bars (QA, 2026-10-28).
      const canvases = [...document.querySelectorAll('canvas')]
        .sort((x, y) => y.width * y.height - x.width * x.height);
      const canvas = canvases[0];
      if (!canvas) return null;
      const { width, height } = canvas;
      const layers = canvases
        .filter(c => c.width === width && c.height === height)
        .map(c => c.getContext('2d').getImageData(0, 0, width, height).data);
      const alphaAt = i => 255 - layers.reduce((t, d) => t * (255 - d[i]) / 255, 255);
      let opaque = 0;
      let visible = 0;
      let total = 0;
      let regionMin = 255;
      let regionGaps = 0;
      const rx0 = region ? Math.floor(region.x0 * width) : 0;
      const rx1 = region ? Math.ceil(region.x1 * width) : 0;
      const ry0 = region ? Math.floor(region.y0 * height) : 0;
      const ry1 = region ? Math.ceil(region.y1 * height) : 0;
      for (let y = 0; y < height; y += stride) {
        for (let x = 0; x < width; x += stride) {
          const alpha = alphaAt((y * width + x) * 4 + 3);
          total++;
          if (alpha >= 250) opaque++;
          if (alpha > 8) visible++;
          if (region && x >= rx0 && x < rx1 && y >= ry0 && y < ry1) {
            if (alpha < regionMin) regionMin = alpha;
            if (alpha < 250) regionGaps++;
          }
        }
      }
      return {
        opaque: opaque / total,
        visible: visible / total,
        regionMinAlpha: region ? regionMin : null,
        regionGaps: region ? regionGaps : null
      };
    }
  };
}
