/**
 * Stinger-specific animated bar with phase-based transitions
 */
import { AnimatedBar } from '../shared/AnimatedBar.js';

export class StingerBar extends AnimatedBar {
    constructor(ctx, canvas, type, index, total, baseHSL, duration) {
        super(ctx, canvas, type);
        this.index = index;
        this.total = total;
        this.baseHSL = baseHSL;
        this.duration = duration;

        // For slanted: alternate left/right. For horizontal: random side
        if (this.type === 'slanted') {
            this.direction = index % 2 === 0 ? 1 : -1;
        } else {
            this.direction = Math.random() > 0.5 ? 1 : -1;
        }

        this.init();
    }

    init() {
        // Some bars are white, others use hue variations
        this.isWhite = Math.random() > 0.7;

        if (this.isWhite) {
            this.hue = 0;
            this.saturation = 0;
            this.lightness = 100;
        } else {
            // Vary the hue slightly from base color
            const hueVariation = (Math.random() - 0.5) * 40;
            const lightnessVariation = (Math.random() - 0.5) * 30;

            this.hue = (this.baseHSL.h + hueVariation + 360) % 360;
            this.saturation = this.baseHSL.s;
            this.lightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
        }

        this.opacity = Math.random() * 0.4 + 0.6;

        // Some slanted bars reverse direction during exit (not background bars)
        this.reverseOnExit = this.type === 'slanted' && Math.random() > 0.5;

        if (this.type === 'slanted') {
            // White bars are smaller, colored bars have more variation
            if (this.isWhite) {
                this.width = Math.random() * 80 + 40;
            } else {
                this.width = Math.random() * 300 + 150;
            }
            this.angle = 15; // Slight clockwise angle
            this.y = 0; // Start at top, extend full height

            // Random target position across the width (20% to 80% of screen width)
            const randomTarget = this.canvas.width * (0.2 + Math.random() * 0.6);

            // Start from left or right based on direction
            if (this.direction === 1) {
                this.startX = -this.width - 300;
                this.targetX = randomTarget - this.width / 2;
            } else {
                this.startX = this.canvas.width + 300;
                this.targetX = randomTarget - this.width / 2;
            }
            this.x = this.startX;
            this.startDelay = (this.index / this.total) * 20;
        } else {
            this.width = this.canvas.width + 400;
            // White bars are smaller
            if (this.isWhite) {
                this.height = Math.random() * 30 + 20;
            } else {
                this.height = Math.random() * 60 + 40;
            }
            this.skew = -15; // Negative skew angle for opposite direction
            this.y = (this.index / this.total) * this.canvas.height;

            // Start from left or right
            if (this.direction === 1) {
                this.startX = -this.width - 200;
            } else {
                this.startX = this.canvas.width + 200;
            }
            this.x = this.startX;

            // Stagger horizontal bars based on animation duration
            const fps = 60;
            const totalFrames = (this.duration / 1000) * fps;
            this.startDelay = (this.index / this.total) * (totalFrames * 0.2);
        }

        this.frame = 0;
        this.phase = 'in'; // 'in', 'pause', 'out'
        this.pauseFrames = 0;
    }

    update() {
        if (!this.active) return;

        this.frame++;

        // Only start moving after delay
        if (this.frame <= this.startDelay) return;

        if (this.type === 'horizontal') {
            // Horizontal bars: continuous movement in one direction
            const fps = 60;
            const totalFrames = (this.duration / 1000) * fps;
            const totalDistance = this.canvas.width + this.width + 400;
            const speedPerFrame = totalDistance / totalFrames;

            this.x += speedPerFrame * this.direction;

            // Deactivate when completely off screen or duration exceeded
            const elapsed = this.frame - this.startDelay;
            if (elapsed >= totalFrames ||
                (this.direction === 1 && this.x > this.canvas.width + 400) ||
                (this.direction === -1 && this.x < -this.width - 400)) {
                this.active = false;
            }
        } else {
            // Slanted bars: curtain effect with ease in/out
            const fps = 60;
            const totalFrames = (this.duration / 1000) * fps;
            const easeInFrames = totalFrames * 0.35;
            const pauseFrames = totalFrames * 0.30;
            const easeOutFrames = totalFrames * 0.35;

            const progress = (this.frame - this.startDelay) / easeInFrames;

            if (this.phase === 'in') {
                const t = Math.min(progress, 1);
                const eased = this.easeInOutCubic(t);
                this.x = this.startX + (this.targetX - this.startX) * eased;

                if (t >= 1) {
                    this.phase = 'pause';
                    this.pauseFrames = 0;
                }
            } else if (this.phase === 'pause') {
                if (!this.isBackground) {
                    this.x += this.direction * 2;
                }
                this.pauseFrames++;
                if (this.pauseFrames > pauseFrames) {
                    this.phase = 'out';
                    this.pauseStartX = this.x;
                    this.frame = this.startDelay;
                }
            } else if (this.phase === 'out') {
                const outProgress = (this.frame - this.startDelay) / easeOutFrames;
                const t = Math.min(outProgress, 1);
                const eased = this.easeInOutCubic(t);

                if (this.isBackground || this.reverseOnExit) {
                    this.x = this.pauseStartX + (this.startX - this.pauseStartX) * eased;
                } else {
                    if (this.direction === 1) {
                        this.x = this.pauseStartX + (this.canvas.width + 300 - this.pauseStartX) * eased;
                    } else {
                        this.x = this.pauseStartX - (this.pauseStartX - (-this.width - 300)) * eased;
                    }
                }

                if (t >= 1) {
                    this.active = false;
                }
            }
        }
    }

    draw() {
        if (!this.active) return;

        const angle = this.type === 'slanted' ? this.angle : this.skew;
        const height = this.type === 'horizontal' ? this.height : this.canvas.height * 1.5;
        const withShadow = !this.isBackground;

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
