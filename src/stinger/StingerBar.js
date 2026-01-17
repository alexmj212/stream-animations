/**
 * Stinger-specific animated bar with phase-based transitions
 */
import { AnimatedBar } from '../shared/AnimatedBar.js';
import { isBarInViewport } from '../shared/animations/calculations.js';
import { config } from '../config/config.js';

export class StingerBar extends AnimatedBar {
    constructor(ctx, canvas, type, index, total, baseHSL, duration, options = {}) {
        super(ctx, canvas, type, options);
        this.index = index;
        this.total = total;
        this.baseHSL = baseHSL;
        this.duration = duration;

        // For slanted: alternate left/right. For horizontal: random side
        if (this.type === 'slanted') {
            this.direction = index % 2 === 0 ? 1 : -1;
        } else {
            this.direction = this.random() > 0.5 ? 1 : -1;
        }

        this.init();
    }

    init() {
        // Some bars are white, others use hue variations
        this.isWhite = this.random() > 0.7;

        if (this.isWhite) {
            this.hue = 0;
            this.saturation = 0;
            // For white bars (lightness 100), reduce by config amount
            const lightnessReduction = config.stinger.curtain.lightnessReductionMin +
                this.random() * (config.stinger.curtain.lightnessReductionMax - config.stinger.curtain.lightnessReductionMin);
            this.lightness = 100 - lightnessReduction;
        } else {
            // Vary the hue slightly from base color
            const hueVariation = (this.random() - 0.5) * 40;
            const lightnessVariation = (this.random() - 0.5) * 30;

            this.hue = (this.baseHSL.h + hueVariation + 360) % 360;
            this.saturation = this.baseHSL.s;
            this.lightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
        }

        this.opacity = this.random() * 0.4 + 0.6;

        // Time tracking
        this.elapsedTime = 0;
        this.phaseStartTime = 0;

        // Convert duration from milliseconds to seconds
        this.inDuration = (this.duration * 0.4) / 1000;  // 40% for 'in' phase
        this.pauseDuration = config.stinger.timing.pauseDurationMs / 1000;
        this.outDuration = (this.duration * 0.4) / 1000; // 40% for 'out' phase

        // Some slanted bars reverse direction during exit (not background bars)
        this.reverseOnExit = this.type === 'slanted' && this.random() > 0.5;

        if (this.type === 'slanted') {
            // White bars are smaller, colored bars have more variation
            if (this.isWhite) {
                this.width = this.random() * 80 + 40;
            } else {
                this.width = this.random() * 300 + 150;
            }
            this.angle = 15; // Slight clockwise angle
            this.y = 0; // Start at top, extend full height

            // Random target position across the width (20% to 80% of screen width)
            const randomTarget = this.canvas.width * (0.2 + this.random() * 0.6);

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
                this.height = this.random() * 30 + 20;
            } else {
                this.height = this.random() * 60 + 40;
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

        this.phase = 'in'; // 'in', 'pause', 'out'

        // Enable offscreen cache only for white horizontal bars (slanted bars extend beyond viewport)
        if (this.isWhite && this.type === 'horizontal') {
            this.useOffscreenCache = true;
        }
    }

    update(deltaTime) {
        if (!this.active) return;

        this.elapsedTime += deltaTime;

        // Handle delay before animation starts (convert frame delay to time)
        const delayTime = (this.startDelay / 60); // Convert frames to seconds at 60fps
        if (this.elapsedTime < delayTime) {
            return;
        }

        const animTime = this.elapsedTime - delayTime;
        const phaseTime = animTime - this.phaseStartTime;

        if (this.type === 'horizontal') {
            // Horizontal bars: continuous movement in one direction
            const totalDuration = this.duration / 1000; // Convert ms to seconds
            const totalDistance = this.canvas.width + this.width + 400;
            const speed = totalDistance / totalDuration;

            this.x += speed * deltaTime * this.direction;

            // Deactivate when completely off screen or duration exceeded
            if (animTime >= totalDuration ||
                (this.direction === 1 && this.x > this.canvas.width + 400) ||
                (this.direction === -1 && this.x < -this.width - 400)) {
                this.active = false;
            }
        } else {
            // Slanted bars: curtain effect with ease in/out
            if (this.phase === 'in') {
                const progress = Math.min(phaseTime / this.inDuration, 1);
                const easedProgress = this.easeInOutCubic(progress);
                this.x = this.startX + (this.targetX - this.startX) * easedProgress;

                if (progress >= 1) {
                    this.phase = 'pause';
                    this.phaseStartTime = animTime;
                }
            } else if (this.phase === 'pause') {
                if (!this.isBackground) {
                    this.x += this.direction * 2 * (deltaTime / (1/60)); // Scale pause drift by deltaTime
                }

                if (phaseTime >= this.pauseDuration) {
                    this.phase = 'out';
                    this.pauseStartX = this.x;
                    this.phaseStartTime = animTime;
                }
            } else if (this.phase === 'out') {
                const progress = Math.min(phaseTime / this.outDuration, 1);
                const easedProgress = this.easeInOutCubic(progress);

                if (this.isBackground || this.reverseOnExit) {
                    this.x = this.pauseStartX + (this.startX - this.pauseStartX) * easedProgress;
                } else {
                    if (this.direction === 1) {
                        this.x = this.pauseStartX + (this.canvas.width + 300 - this.pauseStartX) * easedProgress;
                    } else {
                        this.x = this.pauseStartX - (this.pauseStartX - (-this.width - 300)) * easedProgress;
                    }
                }

                if (progress >= 1) {
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
