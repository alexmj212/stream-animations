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

  /** Linear-light value of an 8-bit sRGB channel. */
  const LINEAR = Array.from({ length: 256 }, (_, i) => {
    const c = i / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  /**
   * Mean relative luminance per cell of a 16x9 grid, the layers composited
   * source-over onto black in DOM order. Drawn down to 160x90 first, which
   * is all the grid needs. run.js reads it in its own untimed pass.
   */
  let gridCanvas = null;
  function luminanceGrid(canvases) {
    const cols = 16;
    const rows = 9;
    const w = 160;
    const h = 90;
    if (!gridCanvas) {
      gridCanvas = document.createElement('canvas');
      gridCanvas.width = w;
      gridCanvas.height = h;
    }
    const g = gridCanvas.getContext('2d', { willReadFrequently: true });
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    for (const c of canvases) g.drawImage(c, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const sum = new Float64Array(cols * rows);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const cell = Math.floor(y * rows / h) * cols + Math.floor(x * cols / w);
        sum[cell] += 0.2126 * LINEAR[d[i]] + 0.7152 * LINEAR[d[i + 1]] + 0.0722 * LINEAR[d[i + 2]];
      }
    }
    const per = (w / cols) * (h / rows);
    const out = new Array(cols * rows);
    for (let c = 0; c < out.length; c++) out[c] = sum[c] / per;
    return out;
  }

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
     *  - grid (with `grid`): mean linear luminance of each cell of a 16x9
     *    grid, the layers composited over black, for the flash and still-cover
     *    rules (tools/motion/designRules.js)
     */
    pixelStats(stride = 2, region = null, grid = false) {
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
        regionGaps: region ? regionGaps : null,
        grid: grid ? luminanceGrid([...document.querySelectorAll('canvas')].filter(c => c.width === width && c.height === height)) : null
      };
    }
  };
}
