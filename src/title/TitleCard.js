import { config } from '../config/config.js';
import { cubicBezier, fitShadeText } from '../shared/animations/alertText.js';
import { titlePlate, titleStateAt } from '../shared/animations/titleCard.js';

const REF_WIDTH = 1920;
const easeEnter = cubicBezier(config.design.motion.ease.enter);

/**
 * The scene title card: a line of hero Jost on a slanted ink plate,
 * bottom-left (DESIGN.md, design audit #39). Plate and line are drawn once
 * into an offscreen canvas; each frame only places it.
 */
export class TitleCard {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {HTMLCanvasElement} canvas
     * @param {string} text
     */
    constructor(ctx, canvas, text) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.text = text.trim().toUpperCase();
        this.state = { plateDx: 0, textAlpha: 0, textDx: 0, done: false };
        this.build();
    }

    /** Fit the line, size the plate and render both offscreen. Call again on resize. */
    build() {
        const k = this.canvas.width / REF_WIDTH;
        const t = config.title.text;
        const p = config.title.plate;
        const tracking = config.design.type.trackingEm;
        const fontAt = (px) => `${t.weight} ${px}px ${t.font}`;
        const m = document.createElement('canvas').getContext('2d');
        const metricsAt = (s, px) => {
            m.font = fontAt(px);
            m.letterSpacing = `${px * tracking}px`;
            return m.measureText(s);
        };
        const room = (t.maxRight - p.x - p.padX - leanOf(p.height * 2, p.slantDeg) / 2) * k;
        const fit = fitShadeText(this.text, (s, px) => metricsAt(s, px).width, room, {
            hero: t.sizePx * k, display: t.minPx * k, minPx: t.floorPx * k
        });
        const px = fit.px;
        const ms = fit.lines.map((s) => metricsAt(s, px));
        const widest = Math.max(...ms.map((x) => x.width));
        const lineGap = px * t.lineHeight;
        const extra = lineGap * (fit.lines.length - 1);
        this.geo = titlePlate(widest, {
            x: p.x * k, top: p.top * k, height: p.height * k, padX: p.padX * k, slantDeg: p.slantDeg
        }, extra);
        this.lines = fit.lines;
        this.fontPx = px;

        // Plate
        const g = this.geo;
        const plate = document.createElement('canvas');
        plate.width = Math.ceil(g.width);
        plate.height = Math.ceil(g.height);
        const pc = plate.getContext('2d');
        pc.fillStyle = hexToRgba(config.design.color.ink, p.alpha);
        pc.beginPath();
        pc.moveTo(g.lean, 0);
        pc.lineTo(g.width, 0);
        pc.lineTo(g.width - g.lean, g.height);
        pc.lineTo(0, g.height);
        pc.closePath();
        pc.fill();
        this.plateCache = plate;

        // Lines, left-aligned and optically centred on the plate (ink box,
        // not the em box)
        const ascent = ms[0].actualBoundingBoxAscent;
        const descent = ms[ms.length - 1].actualBoundingBoxDescent;
        const pad = Math.ceil(px * 0.1);
        const line = document.createElement('canvas');
        line.width = Math.ceil(widest + 2 * pad);
        line.height = Math.ceil(ascent + descent + extra + 2 * pad);
        const lc = line.getContext('2d');
        lc.font = fontAt(px);
        lc.letterSpacing = `${px * tracking}px`;
        lc.textBaseline = 'alphabetic';
        lc.fillStyle = config.design.color.white;
        fit.lines.forEach((s, i) => lc.fillText(s, pad, pad + ascent + i * lineGap));
        this.lineCache = line;
        this.linePad = pad;
        this.lineY = g.mid - (ascent + descent + extra) / 2 - pad;
    }

    /** @param {number} tMs - Since the card started */
    setTime(tMs) {
        const travel = this.geo.x + this.geo.width;
        this.state = titleStateAt(tMs, config.title.timing, travel, easeEnter);
        this.phase = this.state.done ? 'hold' : 'in';
    }

    get done() {
        return this.state.done;
    }

    draw() {
        const { ctx, geo, state } = this;
        ctx.drawImage(this.plateCache, geo.x + state.plateDx, geo.top);
        if (state.textAlpha > 0) {
            ctx.globalAlpha = state.textAlpha; // drawImage has no hsla equivalent
            ctx.drawImage(this.lineCache, geo.textX - this.linePad + state.textDx, this.lineY);
            ctx.globalAlpha = 1;
        }
    }

    /** Text box for the harness design rules (tools/motion/designRules.js). */
    probeSamples() {
        const { geo, state } = this;
        const x = geo.textX + state.textDx;
        return [
            { id: 'plate', x: geo.x + state.plateDx, y: geo.mid, phase: this.phase, onscreen: true },
            {
                id: 'text', x, y: geo.mid, phase: this.phase, onscreen: state.textAlpha > 0,
                box: {
                    x, y: this.lineY + this.linePad,
                    width: this.lineCache.width - 2 * this.linePad,
                    height: this.lineCache.height - 2 * this.linePad
                },
                fontPx: this.fontPx,
                words: this.text.split(/\s+/).filter(Boolean).length
            }
        ];
    }
}

function leanOf(height, slantDeg) {
    return Math.tan(slantDeg * Math.PI / 180) * height;
}

function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
