/**
 * Follower-goal bar: a slanted bar, top left, filled toward the goal with
 * the Illuminations ramp (violet at zero, amber at the goal), with the count
 * over it. The notifications toast grows out of its right end.
 *
 * Always on, so it only draws when something changes: a new count (a light
 * band sweeps along and the number ticks up behind it), an idle glint, or a
 * resize. Between those the page runs no frames at all. Motion is pure
 * functions of time (src/shared/animations/followers.js).
 */
import { planChange, countAt, fillAt, sweepAt, progressFraction, goalText } from '../shared/animations/followers.js';
import { shadeStops, paletteGradient } from '../shared/palette.js';
import { config } from '../config/config.js';

/** Reference canvas the geometry in config.followers is measured on. */
const REF_WIDTH = 1920;

/**
 * Screen geometry of the bar for a canvas width (px).
 * @param {number} width - Canvas width
 * @returns {{top: number, height: number, mid: number, leftX: number, rightX: number,
 *   length: number, lean: number, k: number}} lean: how far the top edge sits right of
 *   the mid-height line, each way (px)
 */
export function followerGeometry(width) {
    const g = config.followers.geometry;
    const k = width / REF_WIDTH;
    const height = g.height * k;
    const top = g.top * k;
    return {
        top,
        height,
        mid: top + height / 2,
        leftX: g.leftX * k,
        rightX: g.rightX * k,
        length: (g.rightX - g.leftX) * k,
        lean: -Math.tan(g.skewAngle * Math.PI / 180) * height / 2,
        k
    };
}

export class FollowerBar {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {HTMLCanvasElement} canvas
     * @param {Object} options
     * @param {Array|null} [options.palette] - palette stops; null = the MIU colors
     * @param {string} [options.style] - 'creative' | 'clean'
     * @param {string} [options.fillLayout] - 'ramp' | 'screen'
     * @param {string} [options.label] - Word after the numbers
     * @param {number} options.count - Count to show at once
     * @param {number} options.goal
     */
    constructor(ctx, canvas, options) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.palette = options.palette ?? null;
        this.creative = (options.style ?? config.followers.style) === 'creative';
        this.fillLayout = ['ramp', 'screen'].includes(options.fillLayout) ? options.fillLayout : config.followers.fillLayout;
        this.label = options.label ?? config.followers.label;
        this.plan = planChange(config.followers.timing);
        this.glintPlan = { sweepEnd: config.followers.timing.glintMs / 1000 };
        this.count = options.count;
        this.goal = options.goal;
        this.from = { count: this.count, fill: progressFraction(this.count, this.goal) };
        this.shown = { ...this.from };
        this.changeStart = null;
        this.glintStart = null;
        this.sweep = null;
        this.glint = null;
        this.resize();
    }

    /** Rebuild everything that depends on the canvas size. */
    resize() {
        this.geo = followerGeometry(this.canvas.width);
        this.buildFills();
        this.textKey = null;
    }

    /** Fill styles, built once per size: gradients run along the bar. */
    buildFills() {
        this.bandFills = null;
        const ctx = this.ctx;
        const f = config.followers;
        const { leftX, rightX } = this.geo;
        const line = [leftX, 0, rightX, 0];
        if (!this.palette) {
            const g = ctx.createLinearGradient(...line);
            f.classic.fill.forEach((c, i, all) => g.addColorStop(i / (all.length - 1), c));
            this.fill = g;
            this.bodyFill = f.classic.body;
            this.rimStyle = f.classic.rim;
            this.tipFill = null;
            this.bandWhite = (a) => `rgba(255, 255, 255, ${a})`;
            return;
        }
        const b = f.brightness;
        const fillLine = this.fillLayout === 'screen' ? [0, 0, 0, this.canvas.height] : line;
        this.fill = paletteGradient(ctx, shadeStops(this.palette, { brightness: b, floor: 10 }), fillLine);
        this.bodyFill = paletteGradient(ctx, shadeStops(this.palette, { dl: f.bodyLightness, brightness: b, floor: 4 }),
            line, f.bodyAlpha);
        const white = Math.round(100 * b);
        this.rimStyle = `hsla(0, 0%, ${white}%, ${f.rim.alpha})`;
        this.tipFill = `hsl(0, 0%, ${white}%)`;
        this.bandWhite = (a) => `hsla(0, 0%, ${white}%, ${a})`;
    }

    /**
     * Show a new count. Animates from whatever is on screen now.
     * @param {number} count
     * @param {number} goal
     * @param {number} now - Seconds (page clock)
     * @param {boolean} [animate=true]
     */
    setCount(count, goal, now, animate = true) {
        this.from = { ...this.shown };
        this.count = count;
        this.goal = goal;
        this.changeStart = animate ? now : null;
        if (!animate) this.shown = { count, fill: progressFraction(count, goal) };
    }

    /** Start an idle glint (creative only). */
    startGlint(now) {
        if (this.creative && this.changeStart === null) this.glintStart = now;
    }

    /** @returns {boolean} true while something is moving */
    get animating() {
        return this.changeStart !== null || this.glintStart !== null;
    }

    /** @param {number} now - Seconds (page clock) */
    setTime(now) {
        const to = { count: this.count, fill: progressFraction(this.count, this.goal) };
        this.sweep = null;
        if (this.changeStart !== null) {
            const t = now - this.changeStart;
            this.shown = { count: countAt(this.from.count, to.count, this.plan, t), fill: fillAt(this.from.fill, to.fill, this.plan, t) };
            if (this.creative) this.sweep = sweepAt(this.plan, t);
            if (t >= this.plan.T) this.changeStart = null;
        } else {
            this.shown = to;
        }
        this.glint = null;
        if (this.glintStart !== null) {
            this.glint = sweepAt(this.glintPlan, now - this.glintStart);
            if (this.glint === null) this.glintStart = null;
        }
    }

    /**
     * Render the count text into an offscreen canvas, once per string.
     * Digits sit in equal cells (tabular figures, which canvas text can't
     * ask the font for), so a new count never changes the line's width or
     * height: the text holds still while the number ticks (QA's text probe
     * caught 946 -> 947 shifting it ~1.5 px, PR #51). The canvas and the
     * measuring context are reused, so a rebuild allocates nothing.
     */
    buildText(force = false) {
        const text = goalText(this.shown.count, this.goal, this.label);
        if (!force && text === this.textKey) return;
        const t = config.followers.text;
        const { k, length, lean, leftX, mid } = this.geo;
        const room = length - 2 * (t.padding * k + lean);
        const fontAt = (px) => `${t.style} ${t.weight} ${px}px ${t.font}`;
        this.measure ??= document.createElement('canvas').getContext('2d');
        const measure = this.measure;
        let px = t.sizePx * k;
        measure.font = fontAt(px);
        let layout = tabularLayout(measure, text);
        // A long label shrinks to fit rather than spill past the ends
        if (layout.width > room) {
            px *= room / layout.width;
            measure.font = fontAt(px);
            layout = tabularLayout(measure, text);
        }
        const stroke = t.strokePx * k;
        // Vertical metrics from every digit and the label, not this string,
        // so the line never moves up or down either
        const ref = measure.measureText(`0123456789/${this.label}`);
        const ascent = ref.actualBoundingBoxAscent;
        const descent = ref.actualBoundingBoxDescent;
        const pad = Math.ceil(stroke + 2);
        const cache = this.textCache ?? document.createElement('canvas');
        const w = Math.ceil(layout.width + 2 * pad);
        const h = Math.ceil(ascent + descent + 2 * pad);
        const cc = cache.getContext('2d');
        if (cache.width !== w || cache.height !== h) {
            cache.width = w;
            cache.height = h;
        } else {
            cc.clearRect(0, 0, w, h);
        }
        cc.font = fontAt(px);
        cc.textBaseline = 'alphabetic';
        cc.textAlign = 'left';
        cc.lineJoin = 'round';
        cc.lineWidth = stroke * 2;
        cc.strokeStyle = '#000';
        cc.fillStyle = '#fff';
        // All strokes first, then all fills, so no outline cuts into a neighbour
        for (const pass of ['strokeText', 'fillText']) {
            for (const r of layout.runs) cc[pass](r.text, pad + r.x, pad + ascent);
        }
        this.textCache = cache;
        this.textKey = text;
        this.fontPx = px;
        this.textWidth = layout.width;
        this.textRoom = room;
        // Optically centred on the bar (ink box, not the em box)
        this.textX = Math.round(leftX + length / 2 - cache.width / 2);
        this.textY = Math.round(mid - (ascent + descent) / 2 - pad);
    }

    /**
     * Path of a slanted slab between screen x0 and x1 (at mid-height).
     */
    slab(x0, x1) {
        const { top, height, lean } = this.geo;
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x0 + lean, top);
        ctx.lineTo(x1 + lean, top);
        ctx.lineTo(x1 - lean, top + height);
        ctx.lineTo(x0 - lean, top + height);
        ctx.closePath();
    }

    /** Fill's front edge at mid-height. */
    get fillX() {
        return this.geo.leftX + this.shown.fill * this.geo.length;
    }

    draw() {
        const ctx = this.ctx;
        const f = config.followers;
        const { leftX, rightX, k } = this.geo;
        ctx.fillStyle = this.bodyFill;
        this.slab(leftX, rightX);
        ctx.fill();
        const front = this.fillX;
        if (front - leftX > 0.5) {
            ctx.fillStyle = this.fill;
            this.slab(leftX, front);
            ctx.fill();
            if (this.tipFill) {
                ctx.fillStyle = this.tipFill;
                this.slab(Math.max(leftX, front - f.tipWidth * k), front);
                ctx.fill();
            }
        }
        if (this.sweep !== null) this.drawBand(this.sweep, f.sweep);
        if (this.glint !== null) this.drawBand(this.glint, f.glint);
        ctx.strokeStyle = this.rimStyle;
        ctx.lineWidth = (this.palette ? f.rim.width : 1) * k;
        ctx.lineJoin = 'miter';
        this.slab(leftX, rightX);
        ctx.stroke();
        this.buildText();
        ctx.drawImage(this.textCache, this.textX, this.textY);
    }

    /** A light band along the bar, clipped to it, bright at its leading edge. */
    drawBand(p, band) {
        const ctx = this.ctx;
        const { leftX, rightX, lean, k } = this.geo;
        const w = band.bandPx * k;
        const x = leftX - lean + p * (rightX - leftX + 2 * lean + w);
        ctx.save();
        this.slab(leftX, rightX);
        ctx.clip();
        // One gradient per band and size, built from 0 to its leading edge
        // and moved with translate, instead of a new gradient every frame
        this.bandFills ??= new Map();
        let g = this.bandFills.get(band);
        if (!g) {
            g = ctx.createLinearGradient(-w, 0, 0, 0);
            g.addColorStop(0, this.bandWhite(0));
            g.addColorStop(0.8, this.bandWhite(band.alpha * 0.5));
            g.addColorStop(1, this.bandWhite(band.alpha));
            this.bandFills.set(band, g);
        }
        ctx.translate(x, 0);
        ctx.fillStyle = g;
        this.slab(-w, 0);
        ctx.fill();
        ctx.restore();
    }

    /** Probe samples for the motion harness. */
    probeSamples() {
        const { mid } = this.geo;
        const phase = this.changeStart !== null ? 'change' : this.glintStart !== null ? 'glint' : 'idle';
        return [
            { id: 'fill', x: this.fillX, y: mid, phase, onscreen: true, count: this.shown.count,
                // px of text that wouldn't fit the bar (must stay 0)
                overflow: this.textWidth ? Math.max(0, this.textWidth - this.textRoom) : 0 },
            // Drawn text for the design rules (tools/motion/designRules.js)
            ...(this.textCache ? [{
                id: 'text', x: this.textX, y: this.textY, phase, onscreen: true,
                box: { x: this.textX, y: this.textY, width: this.textCache.width, height: this.textCache.height },
                fontPx: this.fontPx,
                words: this.textKey.split(/\s+/).filter(Boolean).length
            }] : [])
        ];
    }
}

/**
 * Lay a line out with tabular figures: each digit centred in a cell as wide
 * as the widest digit, other text in runs measured whole (keeps kerning).
 * @param {{measureText: Function}} measure - 2D context with the font set
 * @param {string} text
 * @returns {{width: number, runs: Array<{text: string, x: number}>}}
 */
export function tabularLayout(measure, text) {
    let cell = 0;
    for (let d = 0; d <= 9; d++) cell = Math.max(cell, measure.measureText(String(d)).width);
    const runs = [];
    let x = 0;
    for (const part of text.match(/\d|\D+/g) ?? []) {
        const w = measure.measureText(part).width;
        if (/\d/.test(part)) {
            runs.push({ text: part, x: x + (cell - w) / 2 });
            x += cell;
        } else {
            runs.push({ text: part, x });
            x += w;
        }
    }
    return { width: x, runs };
}
