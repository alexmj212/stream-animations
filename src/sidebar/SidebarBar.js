/**
 * Sidebar bars: slide in from the right, hold over the right 20% of the
 * screen, slide back out.
 *
 * Timeline (D = duration): in 25% → hold 50% → out 25%, ending at exactly D
 * so the bars finish with the CSS text animation. Stagger happens inside the
 * in/out phases. Positions are a pure function of time (setTime) and the
 * phase hand-offs are velocity-matched, so bars glide into a slow leftward
 * drift and curve back out instead of stopping and lurching.
 */
import { AnimatedBar } from '../shared/AnimatedBar.js';
import { isBarInViewport } from '../shared/animations/calculations.js';
import { hermite, stratified } from '../shared/motion.js';
import { config } from '../config/config.js';

export class SidebarBar extends AnimatedBar {
    /**
     * @param {Object} options
     * @param {Function} [options.random] - RNG (seeded by the planner)
     * @param {Object} [options.layout] - Overrides from planSidebar():
     *   holdX, y, isWhite, inDelay (s), exitDelay (s)
     */
    constructor(ctx, canvas, type, index, total, baseHSL, duration, options = {}) {
        super(ctx, canvas, type, options);
        this.index = index;
        this.total = total;
        this.baseHSL = baseHSL;
        this.duration = duration;
        this.layout = options.layout || {};
        this.init();
    }

    init() {
        const L = this.layout;
        const timing = config.sidebar.timing;
        const W = this.canvas.width;
        const H = this.canvas.height;

        this.isWhite = L.isWhite ?? this.random() > 0.7;
        this.applyColor();
        this.opacity = this.random() * 0.4 + 0.6;
        this.zIndex = this.random();

        // Shared timeline (seconds); stagger stays inside the in/out phases
        const T = this.duration / 1000;
        const inEnd = T * timing.slideInProportion;
        const outStart = T * (1 - timing.slideOutProportion);
        this.delayTime = Math.min(L.inDelay ?? 0, inEnd * 0.5);
        this.inEnd = inEnd;
        this.outStart = outStart + Math.min(L.exitDelay ?? 0, (T - outStart) * 0.5);
        this.outEnd = T;
        this.slideInDuration = this.inEnd - this.delayTime;
        this.holdDuration = this.outStart - this.inEnd;
        this.slideOutDuration = this.outEnd - this.outStart;

        // Positions from config
        this.startX = W + config.sidebar.offscreen.startMargin;
        this.endX = this.startX;
        const sidebarStart = W * config.sidebar.position.sidebarStart;
        const sidebarWidth = W * config.sidebar.position.sidebarWidth;

        if (this.type === 'slanted') {
            this.width = this.isWhite ? this.random() * 80 + 40 : this.random() * 300 + 150;
            this.angle = config.sidebar.slanted.angle;
            this.y = 0;
            this.holdX = L.holdX ?? sidebarStart + this.random() * sidebarWidth;
            // A slanted bar's bottom edge reaches ~0.29H left of its anchor,
            // so park it far enough right that no sliver shows while it waits
            this.startX = W + H * 1.05 * Math.sin(this.angle * Math.PI / 180) + 40;
            this.endX = this.startX;
        } else {
            this.width = sidebarWidth + config.sidebar.horizontal.widthExtension;
            this.height = this.isWhite ? this.random() * 30 + 20 : this.random() * 60 + 40;
            this.skew = config.sidebar.horizontal.skewAngle;
            this.y = L.y ?? (this.index / this.total) * H;
            this.holdX = sidebarStart + config.sidebar.position.horizontalTargetOffset;
            // Horizontal bars are drawn from x rightwards; start fully offscreen
            this.startX = W + Math.abs(Math.tan(this.skew * Math.PI / 180)) * this.height + 20;
            this.endX = this.startX;
        }

        // Leftward drift during hold, px/s (config is px per 60fps frame)
        const hold = config.sidebar.hold;
        this.holdVelocity = (hold.velocityMin + this.random() * (hold.velocityMax - hold.velocityMin)) * 60;

        if (!this.isWhite && config.sidebar.style?.edgeLight) {
            this.edgeLight = this.type === 'slanted' ? 'left' : 'top';
        }

        this.x = this.startX;
        this.phase = 'in'; // 'in', 'hold', 'out'
        this.elapsedTime = 0;

        // Offscreen cache only for white horizontal bars (slanted bars extend beyond viewport)
        if (this.isWhite && this.type === 'horizontal') {
            this.useOffscreenCache = true;
        }
    }

    applyColor() {
        const brightness = config.sidebar.brightness;
        if (this.isWhite) {
            this.hue = 0;
            this.saturation = 0;
            this.lightness = 100 * brightness;
        } else {
            const hueVariation = (this.random() - 0.5) * 40;
            const lightnessVariation = (this.random() - 0.5) * 30;
            this.hue = (this.baseHSL.h + hueVariation + 360) % 360;
            this.saturation = this.baseHSL.s;
            const baseLightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
            this.lightness = Math.max(10, baseLightness * brightness);
        }
        this._gradient = null;
        this._edgeFill = null;
    }

    /**
     * The large panel behind the accents. Its left edge sits exactly on the
     * sidebar start (80% of the width) at the top of the screen and slants
     * further left going down, so the whole right 20% stays covered.
     */
    makeBackground() {
        this.isBackground = true;
        this.isWhite = false;
        this.width = this.canvas.width * 0.75;
        this.opacity = 1.0;
        this.startX = this.canvas.width + 300;
        this.endX = this.startX;
        this.holdX = this.canvas.width * config.sidebar.position.sidebarStart;
        this.x = this.startX;
        this.delayTime = 0;
        this.outStart = this.outEnd - this.duration / 1000 * config.sidebar.timing.slideOutProportion;
        this.slideInDuration = this.inEnd;
        this.holdDuration = this.outStart - this.inEnd;
        this.slideOutDuration = this.outEnd - this.outStart;
        this.hue = this.baseHSL.h;
        this.saturation = this.baseHSL.s;
        this.lightness = Math.max(15, this.baseHSL.l - 25);
        this.zIndex = -1;
        this.useOffscreenCache = false;
        this.edgeLight = config.sidebar.style?.edgeLight ? 'left' : null;
        this.edgeLightWidth = 6;
        this._gradient = null;
        this._edgeFill = null;
        return this;
    }

    /** Position at time t (seconds since the sidebar started). */
    positionAt(t) {
        if (t < this.delayTime) return this.startX;
        const v = this.isBackground ? 0 : -this.holdVelocity;
        if (t < this.inEnd) {
            const d = this.inEnd - this.delayTime;
            // Arrive fast and settle into the drift
            return hermite(this.startX, this.holdX, 2 * (this.holdX - this.startX) / d, v, d, t - this.delayTime);
        }
        const holdEndX = this.holdX + v * (Math.min(t, this.outStart) - this.inEnd);
        if (t < this.outStart) return holdEndX;
        const d = this.outEnd - this.outStart;
        // Curve out of the drift and accelerate away to the right
        return hermite(holdEndX, this.endX, v, 2 * (this.endX - holdEndX) / d, d, t - this.outStart);
    }

    /** Set absolute time (seconds) - preferred over update() */
    setTime(t) {
        this.elapsedTime = t;
        if (t >= this.outEnd) {
            this.active = false;
            this.x = this.endX;
            return;
        }
        this.active = true;
        this.phase = t < this.inEnd ? 'in' : t < this.outStart ? 'hold' : 'out';
        this.x = this.positionAt(t);
    }

    update(deltaTime) {
        if (!this.active) return;
        this.setTime(this.elapsedTime + deltaTime);
    }

    getBoundingBox() {
        const angle = this.type === 'slanted' ? this.angle : this.skew;
        return this.computeBounds(this.x, this.y, this.width, this.height ?? 0, angle);
    }

    draw() {
        if (!this.active) return;

        const angle = this.type === 'slanted' ? this.angle : this.skew;
        const height = this.type === 'horizontal' ? this.height : this.canvas.height * 1.5;
        const withShadow = !this.isBackground; // No shadow on background bar

        const bb = this.getBoundingBox();
        if (!isBarInViewport(bb.x, bb.y, bb.width, bb.height, this.canvas.width, this.canvas.height, 0)) {
            return;
        }

        this.drawBar(
            this.x,
            this.y,
            this.width,
            height,
            this.hue,
            this.saturation,
            this.lightness,
            this.opacity,
            angle,
            withShadow
        );
    }
}

/**
 * Compose the sidebar: background panel plus accents spread evenly over the
 * sidebar's width (slanted) and height (horizontal).
 * @returns {SidebarBar[]} bars in draw order
 */
export function planSidebar(ctx, canvas, baseHSL, durationMs, random) {
    const T = durationMs / 1000;
    const timing = config.sidebar.timing;
    const count = config.sidebar.bars.accent;
    const opts = (layout) => ({ random, layout });

    const background = new SidebarBar(ctx, canvas, 'slanted', 0, 1, baseHSL, durationMs, opts({})).makeBackground();

    const slantedCount = Math.round(count * (0.3 + random() * 0.2));
    const horizontalCount = count - slantedCount;
    const W = canvas.width;
    const start = W * config.sidebar.position.sidebarStart;
    const width = W * config.sidebar.position.sidebarWidth;
    const xs = stratified(slantedCount, start, start + width, random);
    const ys = stratified(horizontalCount, canvas.height * 0.05, canvas.height * 0.95, random);
    const inStagger = T * timing.slideInProportion * timing.inStaggerProportion;
    const exitStagger = T * timing.slideOutProportion * timing.outStaggerProportion;

    const accents = [];
    for (let i = 0; i < slantedCount; i++) {
        accents.push(new SidebarBar(ctx, canvas, 'slanted', i + 2, count + 2, baseHSL, durationMs, opts({
            holdX: xs[i], isWhite: i === 0, inDelay: random() * inStagger, exitDelay: random() * exitStagger
        })));
    }
    for (let i = 0; i < horizontalCount; i++) {
        accents.push(new SidebarBar(ctx, canvas, 'horizontal', slantedCount + i + 2, count + 2, baseHSL, durationMs, opts({
            y: ys[i], isWhite: i === 0, inDelay: random() * inStagger, exitDelay: random() * exitStagger
        })));
    }
    accents.sort((a, b) => a.zIndex - b.zIndex);
    return [background, ...accents];
}
