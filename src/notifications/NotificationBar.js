/**
 * Notifications toast: a slanted bar that grows out of the right end of the
 * follower-goal bar, shows a line of text, and shrinks back into it.
 *
 * Three layers, back to front, as AJ's OBS scene stacked its color sources:
 * the gradient ("lead"), the darker body over it at 72%, and a white tip
 * riding the front. The lead goes out first and comes home last; the body
 * trails it. The 'creative' style adds lit rims, seeded streaks that race
 * out ahead of the bar, and a light band that writes the text in. Motion
 * is pure functions of time (src/shared/animations/notification.js); this
 * file holds the geometry, fills, seeded plan and drawing.
 */
import { AnimatedBar } from '../shared/AnimatedBar.js';
import { planNotificationTimeline, extentAt, textStateAt, streakFrontAt, wipeAt } from '../shared/animations/notification.js';
import { shadeStops, paletteGradient } from '../shared/palette.js';
import { stratified } from '../shared/motion.js';
import { fitText } from '../shared/layout.js';
import { config } from '../config/config.js';

/** Reference canvas the geometry in config.notifications is measured on. */
const REF_WIDTH = 1920;

/**
 * Pick the color layout from the URL: ?colorlayout= wins, ?scheme=mono (or
 * no palette) means the OBS colors, else the configured default.
 * @param {string|null} requested - ?colorlayout= value
 * @param {Array|null} stops - palette stops from paletteFromURL()
 * @returns {'along'|'screen'|'classic'}
 */
export function resolveColorLayout(requested, stops) {
    if (!stops) return 'classic';
    if (['along', 'screen', 'classic'].includes(requested)) return requested;
    return config.notifications.colorLayout;
}

/**
 * Screen geometry of the toast for a canvas width (px).
 * @param {number} width - Canvas width
 * @returns {{top: number, height: number, mid: number, startX: number, leadLength: number,
 *   bodyLength: number, tipWidth: number, lean: number}} lean: how far the top edge sits right
 *   of the bottom edge's midpoint, each way (px)
 */
export function notificationGeometry(width) {
    const g = config.notifications.geometry;
    const k = width / REF_WIDTH;
    const height = g.height * k;
    const top = g.top * k;
    const leadLength = (g.endX - g.startX) * k;
    return {
        top,
        height,
        mid: top + height / 2,
        startX: g.startX * k,
        leadLength,
        bodyLength: leadLength - g.bodyShort * k,
        tipWidth: g.tipWidth * k,
        lean: -Math.tan(g.skewAngle * Math.PI / 180) * height / 2
    };
}

export class NotificationBar extends AnimatedBar {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {HTMLCanvasElement} canvas
     * @param {Object} options
     * @param {string} options.text - The line to show
     * @param {number} options.durationMs - Whole toast, out and back
     * @param {Array|null} [options.palette] - palette stops; null = OBS colors
     * @param {string} [options.colorLayout] - 'along' | 'screen' | 'classic'
     * @param {string} [options.style] - 'creative' | 'clean'
     * @param {Function} [options.random] - seeded RNG for the streaks
     */
    constructor(ctx, canvas, options) {
        super(ctx, canvas, 'horizontal', options);
        this.text = options.text;
        this.durationMs = options.durationMs;
        this.palette = options.palette ?? null;
        this.colorLayout = options.colorLayout ?? (this.palette ? config.notifications.colorLayout : 'classic');
        this.creative = (options.style ?? config.notifications.style) === 'creative';
        const flair = config.notifications.flair;
        this.timeline = planNotificationTimeline(this.durationMs, config.notifications.timing, this.creative ? flair.wipe.ms : 0);
        this.geo = notificationGeometry(canvas.width);
        this.streaks = this.creative ? planStreaks(this.timeline, this.geo, canvas.width / REF_WIDTH, this.random) : [];
        this.wipeX = null;
        this.leadExtent = 0;
        this.bodyExtent = 0;
        this.textAlpha = 0;
        this.textDx = 0;
        this.phase = 'in';
        this.buildFills();
        this.buildText();
    }

    /** Fill styles, built once: gradients are fixed to the screen, not the bar. */
    buildFills() {
        const ctx = this.ctx;
        const c = config.notifications.colors;
        const b = config.notifications.brightness;
        const { startX, leadLength } = this.geo;
        const along = [startX, 0, startX + leadLength, 0];
        const screen = [0, 0, 0, this.canvas.height];

        if (this.colorLayout === 'classic' || !this.palette) {
            const g = ctx.createLinearGradient(...along);
            g.addColorStop(0, c.gradientFrom);
            g.addColorStop(1, c.gradientTo);
            this.leadFill = g;
            this.bodyFill = hexToRgba(c.body, c.bodyOpacity);
            this.tipFill = c.tip;
            this.streakFill = hexToRgba(c.gradientTo, config.notifications.flair.streaks.alpha);
            this.buildFlairFills('#ffffff');
            return;
        }
        const line = this.colorLayout === 'screen' ? screen : along;
        this.leadFill = paletteGradient(ctx, shadeStops(this.palette, { brightness: b, floor: 10 }), line);
        this.bodyFill = paletteGradient(ctx, shadeStops(this.palette, { dl: config.palette.curtainLightness, brightness: b, floor: 10 }),
            line, c.bodyOpacity);
        this.tipFill = `hsl(0, 0%, ${Math.round(100 * b)}%)`;
        this.streakFill = paletteGradient(ctx, shadeStops(this.palette, { dl: 18, ds: 10, brightness: b, floor: 10 }),
            line, config.notifications.flair.streaks.alpha);
        this.buildFlairFills(this.tipFill);
    }

    /** Rims, white streaks and the wipe band share the tip's white. */
    buildFlairFills(white) {
        const f = config.notifications.flair;
        const rgb = white.startsWith('#') ? '255, 255, 255' : null;
        const withAlpha = (a) => rgb ? `rgba(${rgb}, ${a})` : white.replace('hsl(', 'hsla(').replace(')', `, ${a})`);
        this.rimFill = withAlpha(f.rim.alpha);
        this.whiteStreakFill = withAlpha(f.streaks.alpha);
        this.bandColors = [withAlpha(0), withAlpha(f.wipe.alpha * 0.5), withAlpha(f.wipe.alpha)];
    }

    /**
     * Render the text once into an offscreen canvas, shrunk to fit the body
     * (down to minScale) and then cut with an ellipsis. Call again once the
     * web font has loaded.
     */
    buildText() {
        const t = config.notifications.text;
        const k = this.canvas.width / REF_WIDTH;
        const room = this.geo.bodyLength - 2 * (t.padding * k + this.geo.lean);
        const measure = document.createElement('canvas').getContext('2d');
        const fontAt = (px) => `${t.style} ${t.weight} ${px}px ${t.font}`;
        const basePx = t.sizePx * k;
        measure.font = fontAt(basePx);
        const natural = measure.measureText(this.text).width;
        const fit = fitText(natural, room, t.minScale);
        const px = basePx * (fit.lines === 1 ? fit.scale : t.minScale);
        measure.font = fontAt(px);
        let shown = this.text;
        if (measure.measureText(shown).width > room) {
            // Too long even at minScale: drop words, then letters, add an ellipsis
            const words = shown.split(' ');
            while (words.length > 1 && measure.measureText(`${words.join(' ')}…`).width > room) words.pop();
            shown = words.join(' ');
            while (shown.length > 1 && measure.measureText(`${shown}…`).width > room) shown = shown.slice(0, -1);
            shown = `${shown.trimEnd()}…`;
        }
        const m = measure.measureText(shown);
        const stroke = t.strokePx * k;
        const ascent = m.actualBoundingBoxAscent;
        const descent = m.actualBoundingBoxDescent;
        const pad = Math.ceil(stroke + 2);
        const cache = document.createElement('canvas');
        cache.width = Math.ceil(m.width + 2 * pad);
        cache.height = Math.ceil(ascent + descent + 2 * pad);
        const cc = cache.getContext('2d');
        cc.font = fontAt(px);
        cc.textBaseline = 'alphabetic';
        cc.lineJoin = 'round';
        cc.lineWidth = stroke * 2;
        cc.strokeStyle = '#000';
        cc.strokeText(shown, pad, pad + ascent);
        cc.fillStyle = '#fff';
        cc.fillText(shown, pad, pad + ascent);
        this.textCache = cache;
        this.textShown = shown;
        this.textWidth = m.width;
        this.textRoom = room;
        this.textScale = px / basePx;
        // Optically centred on the body (ink box, not the em box)
        this.textX = this.geo.startX + this.geo.bodyLength / 2 - cache.width / 2;
        this.textY = this.geo.mid - (ascent + descent) / 2 - pad;
    }

    /** @param {number} t - Seconds since the toast started */
    setTime(t) {
        const { lead, body, text } = this.timeline;
        this.elapsedTime = t;
        this.leadExtent = extentAt(lead, this.geo.leadLength, t);
        this.bodyExtent = extentAt(body, this.geo.bodyLength, t);
        const s = textStateAt(text, config.notifications.timing.textSlidePx * this.canvas.width / REF_WIDTH, t);
        this.textAlpha = s.alpha;
        this.textDx = s.dx;
        this.wipeX = null;
        if (this.creative) {
            // Written in by the band instead of sliding and fading in
            const g = this.geo;
            this.wipeX = wipeAt(text, g.startX - g.lean, g.startX + g.bodyLength + g.lean + config.notifications.flair.wipe.bandPx, t);
            if (this.wipeX !== null) {
                this.textAlpha = 1;
                this.textDx = 0;
            }
            for (const st of this.streaks) st.front = streakFrontAt(st, t);
        }
        this.active = t < this.timeline.T;
        this.phase = t < body.inEnd ? 'in' : t < body.outStart ? 'hold' : 'out';
        // AnimatedBar-style anchor for probes: the front of the toast
        this.x = this.geo.startX + this.leadExtent;
        this.y = this.geo.mid;
    }

    /** Front of each layer, for the motion harness. */
    probeSamples() {
        const { startX, mid } = this.geo;
        const textOn = this.textAlpha > 0;
        return [
            { id: 'lead', x: startX + this.leadExtent, y: mid, phase: this.phase, onscreen: this.leadExtent > 0.5 },
            { id: 'body', x: startX + this.bodyExtent, y: mid, phase: this.phase, onscreen: this.bodyExtent > 0.5 },
            {
                id: 'text', x: this.textX + this.textDx, y: mid, phase: this.phase, onscreen: textOn,
                // px of text that wouldn't fit the body (must stay 0)
                overflow: textOn ? Math.max(0, this.textWidth - this.textRoom) : 0,
                // px of text showing where the body isn't fully out yet (must stay 0)
                bare: textOn ? Math.max(0, this.textX + this.textDx + this.textCache.width - (startX + this.bodyExtent)) : 0
            },
            ...(this.wipeX !== null ? [{ id: 'wipe', x: this.wipeX, y: mid, phase: this.phase, onscreen: true }] : []),
            ...this.streaks.map((st, i) => ({ id: `streak-${i}`, x: st.front, y: st.y, phase: this.phase, onscreen: st.front - st.home > 1 }))
        ];
    }

    getBoundingBox() {
        const { startX, top, height, lean } = this.geo;
        return { x: startX - lean, y: top, width: this.leadExtent + 2 * lean, height };
    }

    /** Parallelogram from the follower bar's edge to `extent` px out. */
    quad(from, extent) {
        const { startX, top, height } = this.geo;
        this.slab(startX + from, startX + extent, top, height);
    }

    /**
     * Path of a slanted slab between screen x0 and x1 (measured at its
     * mid-height), with the bar's lean.
     */
    slab(x0, x1, top, height) {
        const lean = -Math.tan(config.notifications.geometry.skewAngle * Math.PI / 180) * height / 2;
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x0 + lean, top);
        ctx.lineTo(x1 + lean, top);
        ctx.lineTo(x1 - lean, top + height);
        ctx.lineTo(x0 - lean, top + height);
        ctx.closePath();
    }

    draw() {
        if (!this.active || this.leadExtent <= 0) return;
        const ctx = this.ctx;
        ctx.fillStyle = this.leadFill;
        this.quad(0, this.leadExtent);
        ctx.fill();
        if (this.bodyExtent > 0) {
            ctx.fillStyle = this.bodyFill;
            this.quad(0, this.bodyExtent);
            ctx.fill();
        }
        if (this.creative) this.drawFlair();
        ctx.fillStyle = this.tipFill;
        this.quad(Math.max(0, this.leadExtent - this.geo.tipWidth), this.leadExtent);
        ctx.fill();
        if (this.textAlpha > 0) {
            ctx.save();
            // Never outside the body, even mid-fade; mid-wipe, only behind the band
            this.quad(0, this.bodyExtent);
            ctx.clip();
            if (this.wipeX !== null) {
                const band = config.notifications.flair.wipe.bandPx * this.canvas.width / REF_WIDTH;
                this.slab(-1e4, this.wipeX - band / 2, this.geo.top, this.geo.height);
                ctx.clip();
            }
            ctx.globalAlpha = this.textAlpha; // drawImage has no hsla equivalent
            ctx.drawImage(this.textCache, Math.round(this.textX + this.textDx), Math.round(this.textY));
            ctx.restore();
        }
        if (this.wipeX !== null) this.drawBand();
    }

    /** Rims along the gradient's top and bottom edges, then the streaks. */
    drawFlair() {
        const ctx = this.ctx;
        const { startX, top, height } = this.geo;
        const k = this.canvas.width / REF_WIDTH;
        const rim = config.notifications.flair.rim.width * k;
        const front = startX + this.leadExtent;
        const lean = this.geo.lean;
        ctx.fillStyle = this.rimFill;
        // Rims follow the bar's slanted ends: shift each by the lean at its height
        const shift = lean * (1 - rim / height);
        this.slab(startX + shift, front + shift, top, rim);
        ctx.fill();
        this.slab(startX - shift, front - shift, top + height - rim, rim);
        ctx.fill();
        for (const st of this.streaks) {
            const x1 = st.front;
            const x0 = Math.max(startX, x1 - st.length);
            if (x1 - x0 < 1) continue;
            ctx.fillStyle = st.white ? this.whiteStreakFill : this.streakFill;
            this.slab(x0, x1, st.y, st.height);
            ctx.fill();
        }
    }

    /** The light band writing the text in: fades up to a bright leading edge. */
    drawBand() {
        const ctx = this.ctx;
        const band = config.notifications.flair.wipe.bandPx * this.canvas.width / REF_WIDTH;
        const x = this.wipeX;
        ctx.save();
        this.quad(0, this.leadExtent);
        ctx.clip();
        const g = ctx.createLinearGradient(x - band, 0, x, 0);
        g.addColorStop(0, this.bandColors[0]);
        g.addColorStop(0.8, this.bandColors[1]);
        g.addColorStop(1, this.bandColors[2]);
        ctx.fillStyle = g;
        this.slab(x - band, x, this.geo.top, this.geo.height);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * Seeded streaks: stratified over the bar's height (plus a little above and
 * below), each arriving before the gradient does and leaving during the
 * retract, all home by the end.
 * @param {Object} timeline - planNotificationTimeline()
 * @param {Object} geo - notificationGeometry()
 * @param {number} k - canvas width / 1920
 * @param {Function} random - seeded RNG
 * @returns {Array<{home: number, rest: number, drift: number, inStart: number, inEnd: number,
 *   outStart: number, outEnd: number, y: number, height: number, length: number, white: boolean, front: number}>}
 */
export function planStreaks(timeline, geo, k, random) {
    const c = config.notifications.flair.streaks;
    const { lead, body, T } = timeline;
    const leadIn = lead.inEnd - lead.inStart;
    const outT = T - body.outStart;
    const ys = stratified(c.count, geo.top - c.spread * k, geo.top + geo.height + c.spread * k, random);
    const front = geo.startX + geo.leadLength;
    return ys.map((yMid, i) => {
        const height = (c.heightMin + random() * (c.heightMax - c.heightMin)) * k;
        const outStart = body.outStart + random() * c.exitStagger * outT;
        return {
            home: geo.startX,
            rest: front + (c.restMin + random() * (c.restMax - c.restMin)) * k,
            drift: (c.driftMin + random() * (c.driftMax - c.driftMin)) * k,
            inStart: 0,
            inEnd: leadIn * (c.arriveMin + random() * (c.arriveMax - c.arriveMin)),
            outStart,
            outEnd: T - random() * (T - outStart) * 0.25,
            y: yMid - height / 2,
            height,
            length: (c.lengthMin + random() * (c.lengthMax - c.lengthMin)) * k,
            white: i === 0,
            front: geo.startX
        };
    });
}

function hexToRgba(hex, alpha) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
