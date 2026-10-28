/**
 * Banner lane (issue #85): the hype train banner or the ad warning, a line
 * of 32px caps on a slanted ink plate under the notifications toast, with
 * an Illuminations stripe along its bottom edge and a white tip at the
 * front, as the toast has.
 *
 * Shown for as long as OBS shows the source, so after the entrance the page
 * only draws for an occasional glint or a line that has to scroll. Motion is
 * pure functions of time (src/shared/animations/banner.js).
 */
import { config } from '../config/config.js';
import { cubicBezier } from '../shared/animations/alertText.js';
import { bannerGeometry, bannerEnterAt, bannerScrollAt, fontPxForCap, glintAt } from '../shared/animations/banner.js';
import { shadeStops, paletteGradient } from '../shared/palette.js';

const easeEnter = cubicBezier(config.design.motion.ease.enter);

export class BannerLane {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {HTMLCanvasElement} canvas
     * @param {Object} options
     * @param {string} options.kind - 'hype' | 'ad' (resolveBannerKind)
     * @param {string} [options.text] - ?text=; the kind's line by default
     * @param {Array|null} [options.palette] - palette stops; null = the OBS colours
     */
    constructor(ctx, canvas, options) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.kind = options.kind;
        this.kindConfig = config.banner.kinds[this.kind];
        this.text = (options.text || this.kindConfig.text).trim().toUpperCase();
        this.palette = options.palette ?? null;
        this.state = bannerEnterAt(0, config.banner.timing, easeEnter);
        this.tMs = 0;
        this.scrollDx = 0;
        this.glintStart = null;
        this.glint = null;
        this.build();
    }

    /** Geometry, fills and the line, rendered once. Call again on resize or once the font loads. */
    build() {
        const b = config.banner;
        this.geo = bannerGeometry(this.canvas.width, b.lane, b.skewAngle);
        this.buildFills();
        this.buildText();
    }

    buildFills() {
        const ctx = this.ctx;
        const b = config.banner;
        const { x0, x1 } = this.geo;
        this.plateFill = hexToRgba(config.design.color.ink, b.plate.alpha);
        if (this.palette) {
            const [from, to] = this.kindConfig.stops;
            const stops = shadeStops(this.palette.slice(from, to + 1), { brightness: b.brightness, floor: 10 });
            this.stripeFill = paletteGradient(ctx, stops, [x0, 0, x1, 0]);
            const white = Math.round(100 * b.brightness);
            this.tipFill = `hsl(0, 0%, ${white}%)`;
            this.bandWhite = (a) => `hsla(0, 0%, ${white}%, ${a})`;
        } else {
            this.stripeFill = b.classic[this.kind];
            this.tipFill = '#ffffff';
            this.bandWhite = (a) => `rgba(255, 255, 255, ${a})`;
        }
        this.bandFill = null;
    }

    /** Fit the font to the cap height and render the line offscreen. */
    buildText() {
        const t = config.banner.text;
        const { k, x0, x1, top, height } = this.geo;
        const tracking = config.design.type.trackingEm;
        const fontAt = (px) => `${t.weight} ${px}px ${t.font}`;
        const m = document.createElement('canvas').getContext('2d');
        const measure = (s, px) => {
            m.font = fontAt(px);
            m.letterSpacing = `${px * tracking}px`;
            return m.measureText(s);
        };
        const probePx = 100;
        const px = fontPxForCap(t.capPx * k, measure('H', probePx).actualBoundingBoxAscent, probePx);
        this.fontPx = px;
        this.capPx = measure('H', px).actualBoundingBoxAscent;
        const metrics = measure(this.text, px);
        const ascent = metrics.actualBoundingBoxAscent;
        const descent = metrics.actualBoundingBoxDescent;
        const pad = Math.ceil(px * 0.1);
        const line = document.createElement('canvas');
        line.width = Math.ceil(metrics.width + 2 * pad);
        line.height = Math.ceil(ascent + descent + 2 * pad);
        const lc = line.getContext('2d');
        lc.font = fontAt(px);
        lc.letterSpacing = `${px * tracking}px`;
        lc.textBaseline = 'alphabetic';
        lc.fillStyle = config.design.color.white;
        lc.fillText(this.text, pad, pad + ascent);
        this.lineCache = line;
        this.linePad = pad;
        this.textWidth = metrics.width;

        // The room: inside the plate's padding, clear of the white tip
        const p = config.banner.plate;
        this.roomLeft = x0 + t.padding * k;
        this.roomRight = x1 - (p.tipWidth + t.padding) * k;
        const room = this.roomRight - this.roomLeft;
        this.scrollPx = Math.max(0, Math.ceil(this.textWidth - room));
        this.textX = this.scrollPx > 0 ? this.roomLeft : this.roomLeft + (room - this.textWidth) / 2;
        // Caps centred on the ink above the stripe
        const inkMid = top + (height - p.stripePx * k) / 2;
        this.textY = inkMid - (ascent + descent) / 2;
    }

    /** @param {number} tMs - Since the banner started */
    setTime(tMs) {
        this.tMs = tMs;
        this.state = bannerEnterAt(tMs, config.banner.timing, easeEnter);
        this.scrollDx = this.state.done ? bannerScrollAt(tMs - this.state.textInMs, this.scrollPx, config.banner.text) : 0;
        this.glint = null;
        if (this.glintStart !== null) {
            this.glint = glintAt(tMs - this.glintStart, config.banner.plate.glint.ms);
            if (this.glint === null) this.glintStart = null;
        }
        this.phase = this.state.done ? 'hold' : 'in';
    }

    /**
     * Start a light band along the plate (only once the banner is in).
     * @param {number} tMs - Now, on setTime's clock: the page may have been idle since the last frame
     */
    startGlint(tMs) {
        if (this.state.done && this.glintStart === null) this.glintStart = tMs;
    }

    /** Whether the next frame differs from this one. */
    get animating() {
        return !this.state.done || this.glintStart !== null || this.scrollPx > 0;
    }

    /**
     * Path of a slab from x0 to x1 (screen x at the plate's mid-height),
     * rows top to top + h, leaning like the plate.
     */
    slab(x0, x1, top, h) {
        const { mid, lean, height } = this.geo;
        const slope = 2 * lean / height;
        const at = (x, y) => x + slope * (mid - y);
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(at(x0, top), top);
        ctx.lineTo(at(x1, top), top);
        ctx.lineTo(at(x1, top + h), top + h);
        ctx.lineTo(at(x0, top + h), top + h);
        ctx.closePath();
    }

    draw() {
        const { ctx, geo, state } = this;
        const { x0, length, top, height, k } = geo;
        const p = config.banner.plate;
        if (state.stripe <= 0) return;
        ctx.save();
        // Nothing paints outside the plate's full shape, so nothing leaves the lane
        this.slab(x0, x0 + length, top, height);
        ctx.clip();
        const plateFront = x0 + state.plate * length;
        if (state.plate > 0) {
            ctx.fillStyle = this.plateFill;
            this.slab(x0, plateFront, top, height);
            ctx.fill();
        }
        const stripe = p.stripePx * k;
        ctx.fillStyle = this.stripeFill;
        this.slab(x0, x0 + state.stripe * length, top + height - stripe, stripe);
        ctx.fill();
        if (this.glint !== null) this.drawGlint(this.glint);
        if (state.plate > 0) {
            ctx.fillStyle = this.tipFill;
            this.slab(Math.max(x0, plateFront - p.tipWidth * k), plateFront, top, height);
            ctx.fill();
        }
        if (state.textAlpha > 0) {
            ctx.beginPath();
            ctx.rect(this.roomLeft, top, this.roomRight - this.roomLeft, height);
            ctx.clip();
            ctx.globalAlpha = state.textAlpha; // drawImage has no hsla equivalent
            ctx.drawImage(this.lineCache, Math.round(this.textX - this.scrollDx + state.textDx - this.linePad), Math.round(this.textY - this.linePad));
        }
        ctx.restore();
    }

    /** A light band along the plate, bright at its leading edge. */
    drawGlint(share) {
        const ctx = this.ctx;
        const { x0, length, lean, top, height, k } = this.geo;
        const w = config.banner.plate.glint.bandPx * k;
        const x = x0 - lean + share * (length + 2 * lean + w);
        // One gradient, built from 0 to its leading edge and moved with
        // translate, instead of a new gradient every frame (Code review, #48)
        if (!this.bandFill) {
            const a = config.banner.plate.glint.alpha;
            const g = ctx.createLinearGradient(-w, 0, 0, 0);
            g.addColorStop(0, this.bandWhite(0));
            g.addColorStop(0.8, this.bandWhite(a * 0.5));
            g.addColorStop(1, this.bandWhite(a));
            this.bandFill = g;
        }
        ctx.save();
        ctx.translate(x, 0);
        ctx.fillStyle = this.bandFill;
        this.slab(-w, 0, top, height);
        ctx.fill();
        ctx.restore();
    }

    /** Drawn text box: the line clipped to its room. */
    textBox() {
        const x = this.textX - this.scrollDx + this.state.textDx;
        const x0 = Math.max(x, this.roomLeft);
        const x1 = Math.min(x + this.textWidth, this.roomRight);
        const h = this.lineCache.height - 2 * this.linePad;
        return { x: x0, y: this.textY, width: Math.max(0, x1 - x0), height: h };
    }

    /** Probe samples for the motion harness (tools/motion/scenes.js, banner-*). */
    probeSamples() {
        const { geo, state } = this;
        const lane = geo.box;
        const plateFront = geo.x0 + state.plate * geo.length;
        const stripeFront = geo.x0 + state.stripe * geo.length;
        // Everything drawn is clipped to the plate's shape; report the drawn
        // extents anyway so a change to the clip can't hide an overhang
        const drawn = { x: geo.x0 - geo.lean, y: geo.top, right: Math.max(plateFront, stripeFront) + geo.lean, bottom: geo.top + geo.height };
        const box = this.textBox();
        const outside = (b) => Math.max(0, lane.x - b.x, lane.y - b.y,
            b.right - (lane.x + lane.width), b.bottom - (lane.y + lane.height));
        const textOn = state.textAlpha > 0;
        return [
            { id: 'stripe', x: stripeFront, y: geo.mid, phase: this.phase, onscreen: state.stripe > 0 },
            {
                id: 'plate', x: plateFront, y: geo.mid, phase: this.phase, onscreen: state.plate > 0,
                // px the drawn plate reaches outside the lane (must stay 0)
                outsideLane: state.stripe > 0 ? outside(drawn) : 0
            },
            {
                id: 'text', x: this.textX - this.scrollDx + state.textDx, y: geo.mid, phase: this.phase, onscreen: textOn,
                box,
                fontPx: this.fontPx,
                // Rotom's target (#85): capitals at least capPx tall (must stay 0)
                capShort: Math.max(0, config.banner.text.capPx * geo.k - this.capPx),
                outsideLane: textOn ? outside({ x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height }) : 0,
                // px of the line never shown once fully scrolled (must stay 0)
                overflow: Math.max(0, this.textWidth - (this.roomRight - this.roomLeft) - this.scrollPx),
                words: this.text.split(/\s+/).filter(Boolean).length
            }
        ];
    }
}

function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
