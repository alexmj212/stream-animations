/**
 * Stinger transition bars and the layout planner that composes them.
 *
 * Timeline (D = duration, all bars share it so the whole stinger lands on
 * exactly D milliseconds):
 *
 *   0 ──── in ──── 0.35D ──── hold ──── 0.65D ──── out ──── D
 *                    └── screen fully covered ──┘
 *                              cut point = 0.5D
 *
 * Each bar's position is a pure function of time since the transition
 * started (setTime). Segment hand-offs are velocity-matched Hermite curves,
 * so bars enter fast and settle, drift through the hold at the speed they
 * arrived with, and accelerate away - no stop-then-lurch at phase changes.
 */
import { AnimatedBar } from '../shared/AnimatedBar.js';
import { isBarInViewport } from '../shared/animations/calculations.js';
import { hermite, stratified } from '../shared/motion.js';
import { config } from '../config/config.js';

const OFFSCREEN = 300;

export class StingerBar extends AnimatedBar {
    /**
     * @param {Object} options
     * @param {Function} [options.random] - RNG (seeded by the planner)
     * @param {Object} [options.layout] - Overrides from planStinger():
     *   targetX, y, direction, isWhite, width, height, zIndex,
     *   inDelay (s), inEndScale (0-1), exitDelay (s), drift (px/s), reverseOnExit
     */
    constructor(ctx, canvas, type, index, total, baseHSL, duration, options = {}) {
        super(ctx, canvas, type, options);
        this.index = index;
        this.total = total;
        this.baseHSL = baseHSL;
        this.duration = duration;
        this.layout = options.layout || {};

        if (this.layout.direction !== undefined) {
            this.direction = this.layout.direction;
        } else if (this.type === 'slanted') {
            // For slanted: alternate left/right. For horizontal: random side
            this.direction = index % 2 === 0 ? 1 : -1;
        } else {
            this.direction = this.random() > 0.5 ? 1 : -1;
        }

        this.init();
    }

    init() {
        const L = this.layout;
        const timing = config.stinger.timing;
        this.isWhite = L.isWhite ?? this.random() > 0.7;
        this.applyColor();

        this.opacity = L.opacity ?? this.random() * 0.4 + 0.6;
        this.zIndex = L.zIndex ?? this.random();

        // Shared timeline (seconds)
        const T = this.duration / 1000;
        this.totalDuration = T;
        this.inEnd = T * timing.easeInProportion * (L.inEndScale ?? 1);
        this.inStart = Math.min(L.inDelay ?? 0, this.inEnd * 0.6);
        this.outEnd = T;
        this.outStart = T * (timing.easeInProportion + timing.pauseProportion) + (L.exitDelay ?? 0);
        // Kept for callers/tests that read phase lengths
        this.inDuration = this.inEnd - this.inStart;
        this.pauseDuration = this.outStart - this.inEnd;
        this.outDuration = this.outEnd - this.outStart;

        this.reverseOnExit = L.reverseOnExit ?? (this.type === 'slanted' && this.random() > 0.5);

        const W = this.canvas.width;
        if (this.type === 'slanted') {
            this.width = L.width ?? (this.isWhite ? this.random() * 80 + 40 : this.random() * 300 + 150);
            this.angle = config.stinger.slanted.angle;
            this.y = 0;
            const center = L.targetX ?? W * (0.2 + this.random() * 0.6);
            this.targetX = center - this.width / 2;
            this.startX = this.direction === 1 ? -this.width - OFFSCREEN : W + OFFSCREEN;
            this.farX = this.direction === 1 ? W + OFFSCREEN : -this.width - OFFSCREEN;
        } else {
            this.width = W + 400;
            this.height = L.height ?? (this.isWhite ? this.random() * 30 + 20 : this.random() * 60 + 40);
            this.skew = config.stinger.horizontal.skewAngle;
            this.y = L.y ?? (this.index / this.total) * this.canvas.height;
            // Hold with the bar spanning the screen (it is W+400 wide), then
            // carry on out the far side
            this.targetX = -200 + (L.targetJitter ?? 0);
            this.startX = this.direction === 1 ? -this.width - OFFSCREEN : W + OFFSCREEN;
            this.farX = this.direction === 1 ? W + OFFSCREEN : -this.width - OFFSCREEN;
            this.reverseOnExit = false;
        }

        // Hold drift (px/s) in the direction of travel; front bars drift
        // faster for a little parallax depth
        this.drift = L.drift ?? config.stinger.slanted.driftPxPerSec * (0.6 + 0.8 * this.zIndex);
        this.exitX = this.reverseOnExit ? this.startX : this.farX;

        this.x = this.startX;
        this.phase = 'in'; // 'in', 'pause', 'out'
        this.elapsedTime = 0;

        if (!this.isWhite && !this.isBackground && config.stinger.style.edgeLight) {
            this.edgeLight = this.type === 'slanted' ? (this.direction === 1 ? 'right' : 'left') : 'top';
        }

        // Offscreen cache only for white horizontal bars (slanted bars extend beyond viewport)
        if (this.isWhite && this.type === 'horizontal') {
            this.useOffscreenCache = true;
        }
    }

    applyColor() {
        const brightness = config.stinger.brightness;
        if (this.isWhite) {
            this.hue = 0;
            this.saturation = 0;
            this.lightness = 100 * brightness;
        } else {
            // Tighter hue range (±12) and lightness range (±10, biased −5 toward
            // the curtain lightness) so no accent bar punches brighter than the
            // two background curtains. Saturation is also damped on accents so
            // a single bar can't read as the "hero stripe."
            const hueVariation = (this.random() - 0.5) * 24;
            const lightnessVariation = (this.random() - 0.5) * 20 - 5;
            this.hue = (this.baseHSL.h + hueVariation + 360) % 360;
            this.saturation = Math.max(0, this.baseHSL.s - 15);
            const baseLightness = Math.max(25, Math.min(65, this.baseHSL.l + lightnessVariation));
            this.lightness = Math.max(15, baseLightness * brightness);
        }
        this._gradient = null;
        this._edgeFill = null;
    }

    /**
     * Turn this bar into one of the two background curtains that close over
     * the screen. They ease in, hold perfectly still while the scene cuts,
     * and ease back out the way they came.
     */
    makeCurtain(side) {
        const W = this.canvas.width;
        const timing = config.stinger.timing;
        const T = this.totalDuration;
        this.isBackground = true;
        this.isWhite = false;
        this.width = W * 0.75;
        this.opacity = 1.0;
        this.direction = side === 'left' ? 1 : -1;
        this.startX = side === 'left' ? -this.width - OFFSCREEN : W + OFFSCREEN;
        // Curtains overlap by ~50px at the seam (see geometry in README)
        this.targetX = side === 'left' ? W / 2 - this.width : W / 2;
        this.exitX = this.startX;
        this.x = this.startX;
        this.drift = 0;
        this.inStart = 0;
        this.inEnd = T * timing.easeInProportion;
        this.outStart = T * (timing.easeInProportion + timing.pauseProportion);
        this.outEnd = T;
        this.inDuration = this.inEnd - this.inStart;
        this.pauseDuration = this.outStart - this.inEnd;
        this.outDuration = this.outEnd - this.outStart;
        this.hue = this.baseHSL.h;
        this.saturation = this.baseHSL.s;
        this.lightness = Math.max(15, this.baseHSL.l - 25);
        this.zIndex = -1;
        this.useOffscreenCache = false;
        // Lit inner edge where the curtains meet
        this.edgeLight = config.stinger.style.edgeLight ? (side === 'left' ? 'right' : 'left') : null;
        this.edgeLightWidth = 6;
        this._gradient = null;
        this._edgeFill = null;
        return this;
    }

    /** Position at time t (seconds since the transition started). */
    positionAt(t) {
        if (t < this.inStart) return this.startX;
        const v = this.direction * this.drift;
        if (t < this.inEnd) {
            const d = this.inEnd - this.inStart;
            // Arrive fast and settle into the drift: leave at 2x average speed
            const entry = 2 * (this.targetX - this.startX) / d;
            return hermite(this.startX, this.targetX, entry, v, d, t - this.inStart);
        }
        const holdX = this.targetX + v * (Math.min(t, this.outStart) - this.inEnd);
        if (t < this.outStart) return holdX;
        const d = this.outEnd - this.outStart;
        // Accelerate away: reach 2x average speed as it leaves the screen
        const exit = 2 * (this.exitX - holdX) / d;
        return hermite(holdX, this.exitX, v, exit, d, t - this.outStart);
    }

    /** Set absolute time (seconds) - preferred over update() */
    setTime(t) {
        this.elapsedTime = t;
        if (t >= this.outEnd) {
            this.active = false;
            this.x = this.exitX;
            this.phase = 'out';
            return;
        }
        this.active = true;
        this.phase = t < this.inEnd ? 'in' : t < this.outStart ? 'pause' : 'out';
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
        const withShadow = !this.isBackground;

        // Viewport culling - skip drawing if bar is completely off-screen
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
 * Compose one stinger: two curtains plus a balanced set of accent bars.
 * Positions come from stratified slots, so every run is different but no
 * run clumps all its bars on one side.
 *
 * @returns {StingerBar[]} bars in draw order (curtains first, then by zIndex)
 */
export function planStinger(ctx, canvas, baseHSL, durationMs, random) {
    const T = durationMs / 1000;
    const timing = config.stinger.timing;
    const bars = [];
    const opts = (layout) => ({ random, layout });

    bars.push(new StingerBar(ctx, canvas, 'slanted', 0, 2, baseHSL, durationMs, opts({ direction: 1 })).makeCurtain('left'));
    bars.push(new StingerBar(ctx, canvas, 'slanted', 1, 2, baseHSL, durationMs, opts({ direction: -1 })).makeCurtain('right'));

    const accentCount = config.stinger.accents.count;
    const slantedCount = config.stinger.accents.slantedMin + (random() < 0.5 ? 1 : 0);
    const horizontalCount = accentCount - slantedCount;
    const xs = stratified(slantedCount, canvas.width * 0.15, canvas.width * 0.85, random);
    const ys = stratified(horizontalCount, canvas.height * 0.1, canvas.height * 0.9, random);

    // At least two white bars: one slanted, the rest horizontal
    const whiteHorizontal = Math.max(1, config.stinger.accents.whiteMin - 1);
    const firstDir = random() < 0.5 ? 1 : -1;
    const inStagger = T * timing.easeInProportion * timing.inStaggerProportion;
    const exitStagger = T * timing.easeOutProportion * timing.outStaggerProportion;

    const accents = [];
    for (let i = 0; i < slantedCount; i++) {
        accents.push(new StingerBar(ctx, canvas, 'slanted', i + 2, accentCount + 2, baseHSL, durationMs, opts({
            targetX: xs[i],
            direction: i % 2 === 0 ? firstDir : -firstDir,
            isWhite: i === 0,
            inDelay: random() * inStagger,
            inEndScale: 0.85 + random() * 0.15,
            exitDelay: random() * exitStagger
        })));
    }
    for (let i = 0; i < horizontalCount; i++) {
        accents.push(new StingerBar(ctx, canvas, 'horizontal', slantedCount + i + 2, accentCount + 2, baseHSL, durationMs, opts({
            y: ys[i],
            direction: random() < 0.5 ? 1 : -1,
            isWhite: i < whiteHorizontal,
            targetJitter: (random() - 0.5) * 120,
            inDelay: random() * inStagger,
            inEndScale: 0.85 + random() * 0.15,
            exitDelay: random() * exitStagger
        })));
    }

    accents.sort((a, b) => a.zIndex - b.zIndex);
    bars.push(...accents);
    return bars;
}
