/**
 * Banner lane (issue #85): the hype train banner or the ad warning, in AJ's
 * original OBS look (#86): a strip across the lane under the notifications
 * toast with the line scrolling across it as a marquee. Hype is a
 * translucent teal strip with white text and sparkles; the ad is black
 * text on a solid orange plate. The rule fixes over the OBS groups: 32px
 * caps, and nothing past the lane (x 560-1824, y 84-132).
 *
 * One repeat of the line (text, gap, sparkles or separator, gap) is drawn
 * once offscreen; each frame tiles it across the lane at the scroll offset.
 * Motion is pure functions of time (src/shared/animations/banner.js).
 */
import { config } from '../config/config.js';
import { cubicBezier } from '../shared/animations/alertText.js';
import { bannerGeometry, fontPxForCap, revealAt, marqueeOffsetAt, marqueeCopies } from '../shared/animations/banner.js';

const easeEnter = cubicBezier(config.design.motion.ease.enter);

export class BannerLane {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {HTMLCanvasElement} canvas
     * @param {Object} options
     * @param {string} options.kind - 'hype' | 'ad' (resolveBannerKind)
     * @param {string} [options.text] - ?text=; the kind's line by default
     */
    constructor(ctx, canvas, options) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.kind = options.kind;
        this.look = config.banner.kinds[this.kind];
        this.text = (options.text || this.look.text).trim().toUpperCase();
        this.tMs = 0;
        this.reveal = 0;
        this.offset = 0;
        this.build();
    }

    /** Geometry and the repeat, rendered once. Call again on resize or once the font loads. */
    build() {
        this.geo = bannerGeometry(this.canvas.width, config.banner.lane);
        this.stripFill = hexToRgba(this.look.fill, this.look.fillAlpha);
        this.buildUnit();
    }

    /** Fit the font to the cap height and render one repeat of the line offscreen. */
    buildUnit() {
        const t = config.banner.text;
        const { k, height } = this.geo;
        const fontAt = (px) => `${t.weight} ${px}px ${t.font}`;
        const m = document.createElement('canvas').getContext('2d');
        const measure = (s, px) => {
            m.font = fontAt(px);
            m.letterSpacing = `${px * t.trackingEm}px`;
            return m.measureText(s);
        };
        const probePx = 100;
        const px = fontPxForCap(t.capPx * k, measure('H', probePx).actualBoundingBoxAscent, probePx);
        this.fontPx = px;
        this.capPx = measure('H', px).actualBoundingBoxAscent;
        const textW = measure(this.text, px).width;
        const sepW = this.look.separator ? measure(this.look.separator, px).width : 0;
        const cap = this.capPx;
        const sparkW = this.look.sparkles ? sparkleClusterWidth(cap) : 0;
        const gap = this.look.gapEm * px;
        // A repeat: TEXT, gap, separator or sparkles, gap
        this.unitWidth = Math.ceil(textW + gap + sepW + sparkW + gap);
        const unit = document.createElement('canvas');
        unit.width = this.unitWidth;
        unit.height = Math.ceil(height);
        const uc = unit.getContext('2d');
        uc.font = fontAt(px);
        uc.letterSpacing = `${px * t.trackingEm}px`;
        uc.textBaseline = 'alphabetic';
        // Caps centred on the lane
        const baseline = height / 2 + cap / 2;
        if (this.look.glow) {
            uc.shadowColor = this.look.glow.color;
            uc.shadowBlur = this.look.glow.blurEm * px;
        }
        const ty = config.design.type;
        const stroke = this.look.stroke ? Math.max(ty.strokeMinPx * k, ty.strokeEm * px) : 0;
        // The line starts `stroke` in, so its stroke isn't cut at the repeat's left edge
        const x0 = stroke;
        const paint = (fill) => {
            if (fill) uc.fillText(this.text, x0, baseline);
            else uc.strokeText(this.text, x0, baseline);
            if (this.look.separator) {
                if (fill) uc.fillText(this.look.separator, x0 + textW + gap, baseline);
                else uc.strokeText(this.look.separator, x0 + textW + gap, baseline);
            }
            if (this.look.sparkles) drawSparkles(uc, x0 + textW + gap, height / 2, cap, fill);
        };
        if (stroke > 0) {
            // TYPE-3: the ink stroke under the fill (twice the width: the fill covers the inner half)
            uc.strokeStyle = config.design.color.ink;
            uc.lineWidth = stroke * 2;
            uc.lineJoin = 'round';
            paint(false);
            uc.shadowColor = 'transparent';
        }
        uc.fillStyle = this.look.textColor;
        paint(true);
        this.unitCache = unit;
        this.textInk = { top: baseline - cap, height: cap };
    }

    /** @param {number} tMs - Since the banner started */
    setTime(tMs) {
        this.tMs = tMs;
        this.reveal = revealAt(tMs, config.banner.timing.revealMs, easeEnter);
        this.offset = marqueeOffsetAt(tMs, this.unitWidth, config.banner.scrollPxPerSec * this.geo.k);
        this.phase = this.reveal < 1 ? 'in' : 'hold';
    }

    /** Only the lane is ever painted, so only the lane is cleared. */
    clear() {
        const { x, y, width, height } = this.geo;
        this.ctx.clearRect(Math.floor(x), Math.floor(y), Math.ceil(width) + 1, Math.ceil(height) + 1);
    }

    draw() {
        const { ctx, geo } = this;
        if (this.reveal <= 0) return;
        const w = geo.width * this.reveal;
        ctx.save();
        ctx.beginPath();
        ctx.rect(geo.x, geo.y, w, geo.height);
        ctx.clip();
        ctx.fillStyle = this.stripFill;
        ctx.fillRect(geo.x, geo.y, w, geo.height);
        const start = Math.round(geo.x - this.offset);
        const n = marqueeCopies(geo.width, this.unitWidth);
        for (let i = 0; i < n; i++) ctx.drawImage(this.unitCache, start + i * this.unitWidth, Math.round(geo.y));
        ctx.restore();
    }

    /** Probe samples for the motion harness (tools/motion/scenes.js, banner-*). */
    probeSamples() {
        const { geo } = this;
        const w = geo.width * this.reveal;
        const on = this.reveal > 0;
        // Everything is clipped to the revealed strip; report the extents
        // anyway so a change to the clip can't hide an overhang
        const lane = { x: geo.x, y: geo.y, right: geo.x + geo.width, bottom: geo.y + geo.height };
        const outside = (b) => Math.max(0, lane.x - b.x, lane.y - b.y, b.right - lane.right, b.bottom - lane.bottom);
        const box = { x: geo.x, y: geo.y + this.textInk.top, width: w, height: this.textInk.height };
        return [
            {
                id: 'strip', x: geo.x + w, y: geo.mid, phase: this.phase, onscreen: on,
                // px the strip reaches outside the lane (must stay 0)
                outsideLane: on ? outside({ x: geo.x, y: geo.y, right: geo.x + w, bottom: geo.y + geo.height }) : 0
            },
            {
                // The marquee as one line: x runs on continuously (no wrap), so
                // the velocity check sees the scroll's steady speed
                id: 'text', x: geo.x - this.tMs * config.banner.scrollPxPerSec * geo.k / 1000, y: geo.mid,
                phase: this.phase, onscreen: on,
                box,
                fontPx: this.fontPx,
                // Rotom's target (#85): capitals at least capPx tall (must stay 0)
                capShort: Math.max(0, config.banner.text.capPx * geo.k - this.capPx),
                outsideLane: on ? outside({ x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height }) : 0,
                words: this.text.split(/\s+/).filter(Boolean).length
            }
        ];
    }
}

/** Width of the sparkle cluster for this cap height. */
function sparkleClusterWidth(cap) {
    return 3.5 * cap;
}

/**
 * The OBS banner's "✦✧" cluster as shapes (an emoji font isn't bundled,
 * TYPE-7): three four-point stars, each with two small ones beside it.
 */
function drawSparkles(ctx, x, mid, cap, fill = true) {
    for (let i = 0; i < 3; i++) {
        const cx = x + 0.55 * cap + i * 1.1 * cap;
        star(ctx, cx, mid, 0.55 * cap, fill);
        star(ctx, cx + 0.5 * cap, mid - 0.45 * cap, 0.2 * cap, fill);
        star(ctx, cx + 0.42 * cap, mid + 0.5 * cap, 0.16 * cap, fill);
    }
}

/** A four-point star with concave sides, radius r: filled, or stroked for the ink edge. */
function star(ctx, cx, cy, r, fill = true) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.quadraticCurveTo(cx, cy, cx + r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + r);
    ctx.quadraticCurveTo(cx, cy, cx - r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - r);
    if (fill) ctx.fill();
    else ctx.stroke();
}

function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
