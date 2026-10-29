import { spriteUrlFrom } from '../shared/animations/spheal.js';

/**
 * Spheal sprites, baked into offscreen canvases facing right that the page
 * stamps per marcher: the real one from PokeAPI (loadPokeSprite,
 * spriteFromImage; AJ, 2026-10-29), or our own drawing from shapes
 * (drawSpheal) when PokeAPI can't be reached or with ?sprite=drawn.
 */

const INK = '#1d2f52';

/**
 * Render a Spheal sprite.
 * @param {Object} palette - {body, dark, spot, belly} from config.spheal.palettes
 * @param {number} R - Body radius in px
 * @param {{crown?: boolean}} [opts] - crown: the giant at the end of the wave
 * @returns {HTMLCanvasElement} Square canvas; the body centre is its centre
 */
export function drawSpheal(palette, R, opts = {}) {
    const pad = Math.ceil(R * 0.55);
    const size = Math.ceil(2 * (R + pad));
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const line = Math.max(2, R * 0.055);

    const blob = (x, y, rx, ry, rot, fill) => {
        g.beginPath();
        g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        g.fillStyle = fill;
        g.fill();
        g.lineWidth = line;
        g.strokeStyle = INK;
        g.stroke();
    };

    // Tail fin behind, then the back flipper
    blob(-R * 0.92, R * 0.62, R * 0.28, R * 0.14, -0.5, palette.dark);
    blob(-R * 0.3, R * 0.9, R * 0.26, R * 0.13, 0.25, palette.dark);

    // Ear nubs
    blob(-R * 0.38, -R * 0.86, R * 0.17, R * 0.13, -0.4, palette.dark);
    blob(R * 0.28, -R * 0.92, R * 0.17, R * 0.13, 0.35, palette.dark);

    // Body
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    const shade = g.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
    shade.addColorStop(0, palette.spot);
    shade.addColorStop(0.45, palette.body);
    shade.addColorStop(1, palette.dark);
    g.fillStyle = shade;
    g.fill();

    // Inside the body: belly and spots, clipped to the circle
    g.save();
    g.clip();
    g.beginPath();
    g.ellipse(R * 0.22, R * 0.5, R * 0.78, R * 0.62, -0.15, 0, Math.PI * 2);
    g.fillStyle = palette.belly;
    g.fill();
    g.fillStyle = palette.spot;
    for (const [x, y, s] of [[-0.55, -0.35, 0.11], [-0.3, -0.62, 0.08], [-0.7, 0.05, 0.08], [-0.05, -0.72, 0.06], [-0.45, -0.05, 0.06]]) {
        g.beginPath();
        g.arc(x * R, y * R, s * R, 0, Math.PI * 2);
        g.fill();
    }
    g.restore();

    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.lineWidth = line;
    g.strokeStyle = INK;
    g.stroke();

    // Front flipper over the belly
    blob(R * 0.62, R * 0.62, R * 0.27, R * 0.13, -0.6, palette.dark);

    // Blush
    g.fillStyle = 'hsla(350, 90%, 75%, 0.55)';
    for (const x of [-0.05, 0.82]) {
        g.beginPath();
        g.ellipse(x * R, R * 0.08, R * 0.11, R * 0.07, 0, 0, Math.PI * 2);
        g.fill();
    }

    // Eyes: big, black, shiny
    for (const x of [0.12, 0.6]) {
        g.beginPath();
        g.ellipse(x * R, -R * 0.14, R * 0.12, R * 0.16, 0, 0, Math.PI * 2);
        g.fillStyle = '#10131c';
        g.fill();
        g.beginPath();
        g.arc(x * R + R * 0.04, -R * 0.2, R * 0.045, 0, Math.PI * 2);
        g.fillStyle = '#ffffff';
        g.fill();
    }

    // Nose and a little smile
    g.beginPath();
    g.ellipse(R * 0.4, R * 0.08, R * 0.07, R * 0.05, 0, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();
    g.beginPath();
    g.moveTo(R * 0.3, R * 0.2);
    g.quadraticCurveTo(R * 0.36, R * 0.28, R * 0.4, R * 0.2);
    g.quadraticCurveTo(R * 0.44, R * 0.28, R * 0.5, R * 0.2);
    g.lineWidth = line * 0.8;
    g.stroke();

    if (opts.crown) drawCrown(g, R, line);
    return c;
}

/** A gold crown, tilted, on top of the head (at x, y, in units of R). */
function drawCrown(g, R, line, x = 0.05, y = -0.98) {
    g.save();
    g.translate(R * x, R * y);
    g.rotate(0.18);
    const w = R * 0.62;
    const h = R * 0.42;
    g.beginPath();
    g.moveTo(-w / 2, 0);
    g.lineTo(-w / 2, -h);
    g.lineTo(-w / 4, -h * 0.45);
    g.lineTo(0, -h * 1.1);
    g.lineTo(w / 4, -h * 0.45);
    g.lineTo(w / 2, -h);
    g.lineTo(w / 2, 0);
    g.closePath();
    g.fillStyle = '#ffcf33';
    g.fill();
    g.lineWidth = line;
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = '#e8364f';
    for (const x of [-w / 4, w / 4]) {
        g.beginPath();
        g.arc(x, -h * 0.22, R * 0.05, 0, Math.PI * 2);
        g.fill();
    }
    g.restore();
}

/**
 * A soft ground shadow, stretched under each marcher.
 * @param {number} R - Radius in px
 * @returns {HTMLCanvasElement}
 */
export function drawShadow(R) {
    const c = document.createElement('canvas');
    c.width = 2 * R;
    c.height = 2 * R;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(R, R, 0, R, R, R);
    grad.addColorStop(0, 'hsla(220, 40%, 8%, 0.45)');
    grad.addColorStop(1, 'hsla(220, 40%, 8%, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2 * R, 2 * R);
    return c;
}

/**
 * Load the real Spheal from PokeAPI (AJ, 2026-10-29): the API names the
 * sprite's URL; if the API doesn't answer, its sprite host is tried
 * directly. Resolves null when neither loads in time, and the page draws
 * its own Spheal instead.
 * @param {string} kind - A key of config.spheal.sprite.kinds
 * @param {Object} cfg - config.spheal.sprite
 * @returns {Promise<HTMLImageElement|null>}
 */
export async function loadPokeSprite(kind, cfg) {
    const spec = cfg.kinds[kind];
    if (!spec) return null;
    const deadline = new Promise(resolve => setTimeout(() => resolve(null), cfg.timeoutMs));
    const attempt = (async () => {
        let url = null;
        try {
            // Its own short deadline, so a hanging API still leaves time
            // for the sprite host (QA, #97)
            const res = await fetch(cfg.api, { signal: AbortSignal.timeout(cfg.apiTimeoutMs) });
            if (res.ok) url = spriteUrlFrom((await res.json()).sprites, spec.path);
        } catch { /* fall through to the sprite host */ }
        return (url && await loadImage(url)) || loadImage(cfg.fallbackBase + cfg.fallbackFiles[kind]);
    })();
    return Promise.race([attempt, deadline]);
}

function loadImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        // CORS (the host sends *) keeps the canvas readable for alphaBounds
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

/**
 * The box around an image's visible pixels, so the Spheal, not its
 * transparent margin, is fitted to the marcher.
 * @param {HTMLImageElement} img
 * @returns {{x: number, y: number, w: number, h: number}}
 */
export function alphaBounds(img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    try {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, w, h).data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (d[(y * w + x) * 4 + 3] > 8) {
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                    if (y < y0) y0 = y;
                    if (y > y1) y1 = y;
                }
            }
        }
        if (x1 >= x0) return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    } catch { /* a tainted canvas: use the whole image */ }
    return { x: 0, y: 0, w, h };
}

/**
 * Bake a loaded sprite at body radius R: its visible box 2R tall, centred
 * on the canvas (where the page puts the body centre), mirrored to face
 * right. Same contract as drawSpheal.
 * @param {HTMLImageElement} img
 * @param {{x: number, y: number, w: number, h: number}} box - alphaBounds(img)
 * @param {number} R
 * @param {{pixel?: boolean, flip?: boolean, crown?: boolean}} [opts]
 * @returns {HTMLCanvasElement}
 */
export function spriteFromImage(img, box, R, opts = {}) {
    const k = (2 * R) / box.h;
    const bw = box.w * k;
    const pad = Math.ceil(opts.crown ? R * 0.9 : 2);
    const c = document.createElement('canvas');
    c.width = Math.ceil(bw + 2 * pad);
    c.height = Math.ceil(2 * R + 2 * pad);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = !opts.pixel;
    g.imageSmoothingQuality = 'high';
    g.save();
    g.translate(c.width / 2, c.height / 2);
    if (opts.flip) g.scale(-1, 1);
    g.drawImage(img, box.x, box.y, box.w, box.h, -bw / 2, -R, bw, 2 * R);
    g.restore();
    if (opts.crown) {
        g.save();
        g.translate(c.width / 2, c.height / 2);
        g.lineJoin = 'round';
        // The head is the front (right) top of the body once flipped
        drawCrown(g, R, Math.max(2, R * 0.055), opts.flip ? 0.3 : -0.3, -0.86);
        g.restore();
    }
    return c;
}

/**
 * A sprite turned by angle, on a square canvas just big enough for its
 * visible pixels at any angle; the body centre stays the canvas centre.
 * @param {HTMLCanvasElement} sprite - From drawSpheal or spriteFromImage
 * @param {number} angle - Radians
 * @param {number} side - Square size, from turnSide(sprite)
 * @returns {HTMLCanvasElement}
 */
export function turnSprite(sprite, angle, side) {
    const c = document.createElement('canvas');
    c.width = side;
    c.height = side;
    const g = c.getContext('2d');
    g.translate(side / 2, side / 2);
    g.rotate(angle);
    g.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    return c;
}

/**
 * The square that holds a sprite's visible pixels at any angle: twice the
 * furthest visible pixel from the centre (the full diagonal would double
 * the pixels drawn per Spheal).
 * @param {HTMLCanvasElement} sprite
 * @returns {number}
 */
export function turnSide(sprite) {
    const { width: w, height: h } = sprite;
    try {
        const d = sprite.getContext('2d').getImageData(0, 0, w, h).data;
        let max2 = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (d[(y * w + x) * 4 + 3] > 8) {
                    const dx = x + 0.5 - w / 2;
                    const dy = y + 0.5 - h / 2;
                    if (dx * dx + dy * dy > max2) max2 = dx * dx + dy * dy;
                }
            }
        }
        return 2 * Math.ceil(Math.sqrt(max2) + 1);
    } catch { /* a tainted canvas: fit the whole sprite */ }
    return Math.ceil(Math.hypot(w, h));
}
