/**
 * Sidebar-specific animated bar that slides in from right side
 * Covers approximately 30% of viewport, stays briefly, then slides out
 */
import { AnimatedBar } from '../shared/AnimatedBar.js';
import { isBarInViewport } from '../shared/animations/calculations.js';

export class SidebarBar extends AnimatedBar {
    constructor(ctx, canvas, type, index, total, baseHSL, duration, options = {}) {
        super(ctx, canvas, type, options);
        this.index = index;
        this.total = total;
        this.baseHSL = baseHSL;
        this.duration = duration;
        this.init();
    }

    init() {
        // Some bars are white, others use hue variations
        this.isWhite = this.random() > 0.7;

        if (this.isWhite) {
            this.hue = 0;
            this.saturation = 0;
            this.lightness = 100;
        } else {
            // Vary the hue slightly from base color
            const hueVariation = (this.random() - 0.5) * 40;
            const lightnessVariation = (this.random() - 0.5) * 30;

            this.hue = (this.baseHSL.h + hueVariation + 360) % 360;
            this.saturation = this.baseHSL.s;
            this.lightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
        }

        this.opacity = this.random() * 0.4 + 0.6;

        if (this.type === 'slanted') {
            // White bars are smaller, colored bars have more variation
            if (this.isWhite) {
                this.width = this.random() * 80 + 40;
            } else {
                this.width = this.random() * 300 + 150;
            }
            this.angle = 15; // Slight clockwise angle
            this.y = 0; // Start at top, extend full height

            // Position bars in the right 20% of screen
            const sidebarStart = this.canvas.width * 0.8;
            const sidebarWidth = this.canvas.width * 0.2;
            this.targetX = sidebarStart + (this.random() * sidebarWidth);

            // All bars start from the right, off-screen
            this.startX = this.canvas.width + 300;
            this.x = this.startX;

            // Stagger bars slightly
            this.startDelay = (this.index / this.total) * 15;
        } else {
            // Horizontal bars - constrained to right 20% of viewport
            this.width = this.canvas.width * 0.2 + 200; // 20% of viewport + margin

            // White bars are smaller
            if (this.isWhite) {
                this.height = this.random() * 30 + 20;
            } else {
                this.height = this.random() * 60 + 40;
            }
            this.skew = -15; // Negative skew angle for opposite direction
            this.y = (this.index / this.total) * this.canvas.height;

            // Horizontal bars positioned on right side
            this.startX = this.canvas.width + 200;
            this.targetX = this.canvas.width * 0.8 - 100; // Stop at 80% mark (left edge of 20% area)
            this.x = this.startX;

            // Stagger horizontal bars
            const fps = 60;
            const totalFrames = (this.duration / 1000) * fps;
            this.startDelay = (this.index / this.total) * (totalFrames * 0.15);
        }

        this.frame = 0;
        this.phase = 'in'; // 'in', 'hold', 'out'

        // Random velocity for hold phase (0.3-0.8 pixels per frame)
        this.holdVelocity = this.random() * 0.5 + 0.3;

        // Enable offscreen cache only for white horizontal bars (slanted bars extend beyond viewport)
        if (this.isWhite && this.type === 'horizontal') {
            this.useOffscreenCache = true;
        }
    }

    update() {
        if (!this.active) return;

        this.frame++;

        // Only start moving after delay
        if (this.frame <= this.startDelay) return;

        const fps = 60;
        const totalFrames = (this.duration / 1000) * fps;

        // Animation timing: 25% slide in, 50% hold, 25% slide out
        const slideInFrames = totalFrames * 0.25;
        const holdFrames = totalFrames * 0.50;
        const slideOutFrames = totalFrames * 0.25;

        const adjustedFrame = this.frame - this.startDelay;

        if (this.phase === 'in') {
            // Slide in from right with easeInOutCubic
            const progress = adjustedFrame / slideInFrames;
            const t = Math.min(progress, 1);
            const eased = this.easeInOutCubic(t);
            this.x = this.startX + (this.targetX - this.startX) * eased;

            if (t >= 1) {
                this.phase = 'hold';
                this.holdStartFrame = this.frame;
            }
        } else if (this.phase === 'hold') {
            // Continue moving at constant velocity during hold
            const holdElapsed = this.frame - this.holdStartFrame;

            // Move at constant velocity to the left (randomized per bar)
            if (!this.isBackground) {
                this.x -= this.holdVelocity;
            }

            if (holdElapsed >= holdFrames) {
                this.phase = 'out';
                this.outStartFrame = this.frame;
                this.holdX = this.x; // Use current position for smooth transition
            }
        } else if (this.phase === 'out') {
            // Slide out to the right
            const outElapsed = this.frame - this.outStartFrame;
            const progress = outElapsed / slideOutFrames;
            const t = Math.min(progress, 1);
            const eased = this.easeInOutCubic(t);
            this.x = this.holdX + (this.startX - this.holdX) * eased;

            if (t >= 1) {
                this.active = false;
            }
        }
    }

    draw() {
        if (!this.active) return;

        const angle = this.type === 'slanted' ? this.angle : this.skew;
        const height = this.type === 'horizontal' ? this.height : this.canvas.height * 1.5;
        const withShadow = !this.isBackground; // No shadow on background bar

        // Viewport culling - skip drawing if bar is completely off-screen
        // For cached bars (centered at x,y), adjust culling bounds
        const cullX = this.useOffscreenCache ? this.x - this.width / 2 : this.x;
        const cullWidth = this.width;
        if (!isBarInViewport(cullX, this.y, cullWidth, height, this.canvas.width, this.canvas.height, 300)) {
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
