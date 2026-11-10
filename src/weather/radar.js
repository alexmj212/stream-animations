import { createRandom } from '../shared/motion.js';
import { STATES, NEIGHBOURS } from './basemap.js';

// The radar page (AJ, 2026-11-10: "also a radar map screen"). Live: the last
// few radar frames from RainViewer (tiles CORS open, so the canvas stays
// readable) over a flat map with state lines that the page draws itself
// (basemap.js: no map service, and the broadcast look). Each region's view is
// built once per visit into preallocated canvases, a tile at a time off the
// frame (Performance expert, 2026-11-10), and the page then flips through
// them: a 90s radar loop for the price of one blit per frame.

const TILE = 512;                       // 512px tiles at zoom z-1 = 256px tiles at z

/**
 * Web Mercator world pixel at a zoom (256px tiles).
 * @param {number} lat
 * @param {number} lon
 * @param {number} zoom
 * @returns {{x: number, y: number}}
 */
export function worldPx(lat, lon, zoom) {
    const size = 256 * 2 ** zoom;
    const s = Math.sin((lat * Math.PI) / 180);
    return {
        x: ((lon + 180) / 360) * size,
        y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size
    };
}

/**
 * The closest view (zoom 3-7) that shows every town with a margin, centred
 * on them.
 * @param {Array<{lat: number, lon: number}>} towns
 * @param {number} w - View width, px
 * @param {number} h - View height, px
 * @param {number} [margin=0.2] - Share of the view kept clear round the towns
 * @returns {{zoom: number, x0: number, y0: number, w: number, h: number}}
 */
export function viewFor(towns, w, h, margin = 0.2) {
    let zoom = 3;
    for (let z = 7; z >= 3; z--) {
        const pts = towns.map((t) => worldPx(t.lat, t.lon, z));
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        if (Math.max(...xs) - Math.min(...xs) <= w * (1 - 2 * margin) &&
            Math.max(...ys) - Math.min(...ys) <= h * (1 - 2 * margin)) {
            zoom = z;
            break;
        }
    }
    const pts = towns.map((t) => worldPx(t.lat, t.lon, zoom));
    const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
    const cy = (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2;
    return { zoom, x0: Math.round(cx - w / 2), y0: Math.round(cy - h / 2), w, h };
}

/**
 * The 512px tiles (at zoom-1) that cover a view, with where each lands.
 * @param {{zoom: number, x0: number, y0: number, w: number, h: number}} view
 * @returns {Array<{z: number, x: number, y: number, dx: number, dy: number}>}
 */
export function tilesFor(view) {
    const z = view.zoom - 1;
    const n = 2 ** z;
    const out = [];
    for (let ty = Math.floor(view.y0 / TILE); ty <= Math.floor((view.y0 + view.h - 1) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        for (let tx = Math.floor(view.x0 / TILE); tx <= Math.floor((view.x0 + view.w - 1) / TILE); tx++) {
            out.push({ z, x: ((tx % n) + n) % n, y: ty, dx: tx * TILE - view.x0, dy: ty * TILE - view.y0 });
        }
    }
    return out;
}

/**
 * Recolour RainViewer's blue scheme towards the classic broadcast ramp:
 * light returns green, then yellow, orange, red. Works in place on RGBA.
 * @param {Uint8ClampedArray} px
 */
export function broadcastColors(px) {
    for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] === 0) continue;
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        if (b > r && b >= g * 0.8) {
            // Blues and cyans (light to moderate): greens, darker for heavier
            const k = Math.max(0, Math.min(1, (255 - (r + g) / 2) / 255));
            px[i] = 30 + 40 * (1 - k);
            px[i + 1] = 230 - 90 * k;
            px[i + 2] = 60 * (1 - k);
        }
    }
}

/**
 * Where each town's label goes on a radar frame: right of its dot, else
 * left, above or below, never over another label or any dot, and inside the
 * frame. A label with no room is dropped (its dot still shows).
 * @param {Array<{x: number, y: number}>} marks - Dots, frame px
 * @param {number[]} widths - Each label's text width, px
 * @param {number} w - Frame width
 * @param {number} h - Usable frame height (above the legend strip)
 * @param {number} [px=32] - Text size
 * @returns {Array<{x: number, y: number, align: string}|null>} Text anchor (baseline) per mark
 */
export function placeLabels(marks, widths, w, h, px = 32) {
    const pad = 4;
    const boxes = marks.map((m) => ({ x: m.x - 10, y: m.y - 10, w: 20, h: 20 }));
    const hits = (r) => boxes.some((b) => r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h);
    return marks.map((m, i) => {
        const tw = widths[i] + 2 * pad;
        const th = px + 8;
        const tries = [
            { box: { x: m.x + 12, y: m.y - th / 2, w: tw, h: th }, x: m.x + 16, y: m.y + px * 0.38, align: 'left' },
            { box: { x: m.x - 12 - tw, y: m.y - th / 2, w: tw, h: th }, x: m.x - 16, y: m.y + px * 0.38, align: 'right' },
            { box: { x: m.x - tw / 2, y: m.y - 14 - th, w: tw, h: th }, x: m.x, y: m.y - 22, align: 'center' },
            { box: { x: m.x - tw / 2, y: m.y + 14, w: tw, h: th }, x: m.x, y: m.y + 14 + px, align: 'center' }
        ];
        const fit = tries.find((t) => t.box.x >= 0 && t.box.x + t.box.w <= w && t.box.y >= 0 && t.box.y + t.box.h <= h && !hits(t.box));
        if (!fit) return null;
        boxes.push(fit.box);
        return { x: fit.x, y: fit.y, align: fit.align };
    });
}

const nextIdle = () => new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 100 });
    else setTimeout(resolve, 0);
});

function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

/** Builds and holds one region's radar loop. */
export class RadarLoader {
    /**
     * @param {Object} opts
     * @param {number} opts.w
     * @param {number} opts.h
     * @param {Object} opts.cfg - config.weather.radar
     * @param {boolean} [opts.demo] - Draw a made-up radar, no network
     * @param {Function} [opts.fetch]
     * @param {() => number} [opts.now]
     * @param {Object} [opts.debug]
     */
    constructor({ w, h, cfg, demo = false, fetch: fetchImpl = (...a) => fetch(...a), now = () => Date.now(), debug = null }) {
        this.w = w;
        this.h = h;
        this.cfg = cfg;
        this.demo = demo;
        this.fetch = fetchImpl;
        this.now = now;
        this.debug = debug;
        // Allocated once, reused for every region (Performance expert)
        this.frames = Array.from({ length: cfg.frames }, () => makeCanvas(w, h));
        this.base = makeCanvas(w, h);
        this.scratch = makeCanvas(TILE, TILE);
        this.ready = null;              // { key, times: number[], t }
        this.building = null;           // { key, promise } while a build runs
        this.indexFailedAt = -Infinity;
        this.token = 0;
        this.index = null;              // { t, data } RainViewer frame list
    }

    /** fetch that gives up after cfg.timeoutMs, so a hung tile can't stall a build. */
    async timed(url, opts, read) {
        const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctl ? setTimeout(() => ctl.abort(), this.cfg.timeoutMs) : null;
        try {
            const r = await this.fetch(url, { ...opts, signal: ctl?.signal });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await read(r);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    async bitmap(url) {
        try {
            return await this.timed(url, { mode: 'cors' }, async (r) => createImageBitmap(await r.blob()));
        } catch {
            return null;
        }
    }

    async radarIndex() {
        if (this.index && this.now() - this.index.t < this.cfg.indexTtlMs) return this.index.data;
        // While RainViewer is down, don't ask again every visit (QA, #169)
        if (this.now() - this.indexFailedAt < this.cfg.retryAfterMs) throw new Error('radar index holding off after a failure');
        let data;
        try {
            data = await this.timed(this.cfg.indexUrl, { cache: 'no-cache' }, (r) => r.json());
        } catch (e) {
            this.indexFailedAt = this.now();
            throw e;
        }
        this.index = { t: this.now(), data };
        return data;
    }

    /**
     * Build a region's loop. Resolves when done (or superseded); never rejects.
     * @param {string} key - Region name; a ready loop with this key is reused
     * @param {Array<{name: string, lat: number, lon: number}>} towns
     * @param {(ctx: CanvasRenderingContext2D, label: Object) => void} drawLabels - Town markers, drawn on each frame
     * @param {(ctx: CanvasRenderingContext2D, utcMs: number) => void} drawStamp - Frame time and legend
     */
    prepare(key, towns, drawLabels, drawStamp) {
        if (this.ready?.key === key && this.now() - this.ready.t < this.cfg.refreshMs) return Promise.resolve();
        // Every cut asks again: a build still running for this key carries
        // on, or a slow live build would restart forever (code review, #169)
        if (this.building?.key === key) return this.building.promise;
        const promise = this.build(key, towns, drawLabels, drawStamp).finally(() => {
            if (this.building?.promise === promise) this.building = null;
        });
        this.building = { key, promise };
        return promise;
    }

    async build(key, towns, drawLabels, drawStamp) {
        const token = ++this.token;
        this.ready = null;
        const t0 = performance.now();
        this.debug?.mark('radarStart', { key });
        const view = viewFor(towns, this.w, this.h);
        // Off the caller's frame: prepare is called from a page cut
        await nextIdle();
        if (token !== this.token) return;
        const marks = towns.map((t) => {
            const p = worldPx(t.lat, t.lon, view.zoom);
            return { name: t.name, x: p.x - view.x0, y: p.y - view.y0 };
        });
        try {
            const times = this.demo
                ? await this.buildDemo(view, marks, drawLabels, drawStamp, token)
                : await this.buildLive(view, marks, drawLabels, drawStamp, token);
            if (token !== this.token) return;
            this.ready = { key, times, t: this.now() };
            this.debug?.mark('radarReady', { key, frames: times.length, ms: Math.round(performance.now() - t0) });
        } catch (e) {
            if (token === this.token) this.debug?.mark('radarFail', { key, message: String(e) });
        }
    }

    /**
     * The map under the radar: water, land, then state and border lines,
     * drawn once per region into the base canvas.
     * @param {{zoom: number, x0: number, y0: number}} view
     */
    paintBase(view) {
        const b = this.base.getContext('2d');
        b.globalCompositeOperation = 'source-over';
        b.fillStyle = '#071040';
        b.fillRect(0, 0, this.w, this.h);
        const trace = (polys) => {
            b.beginPath();
            for (const rings of polys) {
                for (const r of rings) {
                    for (let i = 0; i < r.length; i += 2) {
                        const p = worldPx(r[i + 1], r[i], view.zoom);
                        if (i === 0) b.moveTo(p.x - view.x0, p.y - view.y0);
                        else b.lineTo(p.x - view.x0, p.y - view.y0);
                    }
                    b.closePath();
                }
            }
        };
        b.lineJoin = 'round';
        trace(NEIGHBOURS);
        b.fillStyle = '#16297a';
        b.fill('evenodd');
        b.strokeStyle = '#3a56b8';
        b.lineWidth = 2;
        b.stroke();
        trace(STATES);
        b.fillStyle = '#1f3aa0';
        b.fill('evenodd');
        b.strokeStyle = '#7f9cf0';
        b.lineWidth = 2;
        b.stroke();
        return b;
    }

    async buildLive(view, marks, drawLabels, drawStamp, token) {
        const index = await this.radarIndex();
        if (token !== this.token) return [];
        const past = (index.radar?.past || []).slice(-this.cfg.frames);
        if (!past.length) throw new Error('no radar frames');
        const tiles = tilesFor(view);
        this.paintBase(view);
        await nextIdle();
        if (token !== this.token) return [];

        const sc = this.scratch.getContext('2d', { willReadFrequently: true });
        const frames = this.frames.slice(0, past.length);
        for (let f = 0; f < past.length; f++) {
            const c = frames[f].getContext('2d');
            c.globalCompositeOperation = 'source-over';
            c.drawImage(this.base, 0, 0);
            for (const t of tiles) {
                const url = `${index.host}${past[f].path}/${TILE}/${t.z}/${t.x}/${t.y}/${this.cfg.colorScheme}/1_1.png`;
                const bmp = await this.bitmap(url);
                if (token !== this.token) return [];
                if (bmp) {
                    sc.clearRect(0, 0, TILE, TILE);
                    sc.drawImage(bmp, 0, 0);
                    bmp.close();
                    const img = sc.getImageData(0, 0, TILE, TILE);
                    broadcastColors(img.data);
                    sc.putImageData(img, 0, 0);
                    c.globalAlpha = this.cfg.alpha;
                    c.drawImage(this.scratch, t.dx, t.dy);
                    c.globalAlpha = 1;
                }
                await nextIdle();
            }
            drawLabels(c, marks);
            drawStamp(c, past[f].time * 1000);
        }
        return past.map((p) => p.time * 1000);
    }

    async buildDemo(view, marks, drawLabels, drawStamp, token) {
        this.paintBase(view);
        const random = createRandom(view.x0 ^ view.y0);
        const cells = Array.from({ length: 5 }, () => ({
            x: random() * this.w, y: random() * this.h, r: 60 + random() * 110, core: random()
        }));
        const step = 10 * 60000;
        const end = Math.floor(this.now() / step) * step;
        const n = this.frames.length;
        const times = [];
        for (let f = 0; f < n; f++) {
            const c = this.frames[f].getContext('2d');
            c.drawImage(this.base, 0, 0);
            for (const cell of cells) {
                const x = cell.x + f * 14;
                const y = cell.y - f * 4;
                const g = c.createRadialGradient(x, y, 0, x, y, cell.r);
                g.addColorStop(0, cell.core > 0.6 ? 'rgba(230, 40, 30, 0.9)' : 'rgba(250, 220, 40, 0.85)');
                g.addColorStop(0.35, 'rgba(240, 220, 40, 0.8)');
                g.addColorStop(0.6, 'rgba(40, 200, 60, 0.75)');
                g.addColorStop(1, 'rgba(40, 200, 60, 0)');
                c.fillStyle = g;
                c.beginPath();
                c.arc(x, y, cell.r, 0, Math.PI * 2);
                c.fill();
            }
            drawLabels(c, marks);
            const t = end - (n - 1 - f) * step;
            drawStamp(c, t);
            times.push(t);
            await nextIdle();
            if (token !== this.token) return [];
        }
        return times;
    }
}
