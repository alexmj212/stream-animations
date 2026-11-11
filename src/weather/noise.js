// Compression noise and interlace lines over Exo-Cast (AJ, 2026-11-11: "We
// also need some interlacing and compression noise on the screens"): a tile
// of 8 px macroblocks, each a little lighter or darker, a few with the
// ringing a cheap encoder leaves round edges, over faint alternate lines.
// It lives in a CSS layer above the canvas and jumps to a new offset every
// stepMs by a transform, which the compositor does alone: the canvas never
// redraws for it.

import { createRandom } from '../shared/motion.js';

/**
 * Paint the noise tile.
 * @param {{alpha: number, blockPx: number, seed: number}} cfg
 * @param {number} size - Tile side, frame px (a multiple of blockPx)
 * @returns {HTMLCanvasElement}
 */
export function noiseTile(cfg, size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const rnd = createRandom(cfg.seed);
    const b = cfg.blockPx;
    for (let y = 0; y < size; y += b) {
        for (let x = 0; x < size; x += b) {
            const v = rnd();
            // Most blocks barely differ; one in six is visibly off
            const a = cfg.alpha * (v < 0.17 ? 1 : v * 0.5);
            g.fillStyle = rnd() < 0.5 ? `hsla(220, 30%, 92%, ${a})` : `hsla(240, 40%, 6%, ${a})`;
            g.fillRect(x, y, b, b);
            if (rnd() < 0.06) {
                // Ringing: a block of fine stripes
                g.fillStyle = `hsla(0, 0%, 100%, ${cfg.alpha * 0.8})`;
                for (let k = 1; k < b; k += 2) g.fillRect(x + k, y, 1, b);
            }
        }
    }
    // Interlace: every other line a touch darker
    g.fillStyle = `hsla(240, 50%, 4%, ${cfg.alpha * 0.6})`;
    for (let y = 1; y < size; y += 2) g.fillRect(0, y, size, 1);
    return c;
}

/**
 * Lay the noise over the page and keep it moving.
 * @param {HTMLElement} host - Positioned element the layer goes in
 * @param {{alpha: number, blockPx: number, stepMs: number, seed: number}} cfg
 * @param {number} frameW - The canvas's width in frame px (1920)
 * @returns {() => void} Stops it
 */
export function startNoise(host, cfg, frameW = 1920) {
    const tile = 256;
    const url = noiseTile(cfg, tile).toDataURL();
    const unit = `calc(100vw * ${tile / frameW})`;
    const wrap = document.createElement('div');
    // Over the 4:3 picture only (x 240-1680 of 1920), not the pillarbox bars
    wrap.style.cssText = 'position:fixed;top:0;bottom:0;left:12.5vw;width:75vw;overflow:hidden;pointer-events:none';
    const layer = document.createElement('div');
    layer.style.cssText = `position:absolute;left:calc(-1 * ${unit});top:calc(-1 * ${unit});right:0;bottom:0;`
        + `background:url(${url});background-size:${unit} ${unit};image-rendering:pixelated;will-change:transform`;
    wrap.appendChild(layer);
    host.appendChild(wrap);
    const rnd = createRandom(cfg.seed + 1);
    const blocks = tile / cfg.blockPx;
    const id = setInterval(() => {
        // Whole blocks, and an odd or even line, so the interlace phase flips too
        const bx = Math.floor(rnd() * blocks) * cfg.blockPx;
        const by = Math.floor(rnd() * blocks) * cfg.blockPx + (rnd() < 0.5 ? 1 : 0);
        layer.style.transform = `translate(calc(100vw * ${bx / frameW}), calc(100vw * ${by / frameW}))`;
    }, cfg.stepMs);
    return () => {
        clearInterval(id);
        wrap.remove();
    };
}
