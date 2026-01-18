/**
 * Sidebar-specific animated bar that slides in from right side
 * Covers approximately 30% of viewport, stays briefly, then slides out
 */
import { AnimatedBar } from '../shared/AnimatedBar.js';
import { isBarInViewport } from '../shared/animations/calculations.js';
import { config } from '../config/config.js';

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

        const brightness = config.sidebar.brightness; // 0.8 from config

        if (this.isWhite) {
            this.hue = 0;
            this.saturation = 0;
            this.lightness = 100 * brightness; // 100 * 0.8 = 80 (matches background/stinger)
        } else {
            // Vary the hue slightly from base color
            const hueVariation = (this.random() - 0.5) * 40;
            const lightnessVariation = (this.random() - 0.5) * 30;

            this.hue = (this.baseHSL.h + hueVariation + 360) % 360;
            this.saturation = this.baseHSL.s;
            const baseLightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
            this.lightness = Math.max(10, baseLightness * brightness); // Apply brightness multiplier
        }

        this.opacity = this.random() * 0.4 + 0.6;

        // Time-based tracking
        this.elapsedTime = 0;
        this.phaseStartTime = 0;
        this.delayTime = 0; // Will be set for staggering

        // Phase durations from config (convert to seconds)
        const slideInMs = this.duration * config.sidebar.timing.slideInProportion;
        const slideOutMs = this.duration * config.sidebar.timing.slideOutProportion;
        const holdMs = this.duration - slideInMs - slideOutMs;

        this.slideInDuration = slideInMs / 1000;
        this.holdDuration = holdMs / 1000;
        this.slideOutDuration = slideOutMs / 1000;

        // Positions from config
        this.startX = this.canvas.width + config.sidebar.offscreen.startMargin;
        this.holdX = this.canvas.width * config.sidebar.position.sidebarStart;
        this.endX = this.canvas.width + config.sidebar.offscreen.startMargin;

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
            const sidebarStart = this.canvas.width * config.sidebar.position.sidebarStart;
            const sidebarWidth = this.canvas.width * config.sidebar.position.sidebarWidth;
            this.holdX = sidebarStart + (this.random() * sidebarWidth);

            this.x = this.startX;

            // Stagger bars slightly
            this.delayTime = (this.index / this.total) * (config.sidebar.timing.slantedStaggerFrames / 60);
        } else {
            // Horizontal bars - constrained to right 20% of viewport
            this.width = this.canvas.width * config.sidebar.position.sidebarWidth + config.sidebar.horizontal.widthExtension;

            // White bars are smaller
            if (this.isWhite) {
                this.height = this.random() * 30 + 20;
            } else {
                this.height = this.random() * 60 + 40;
            }
            this.skew = -15; // Negative skew angle for opposite direction
            this.y = (this.index / this.total) * this.canvas.height;

            // Horizontal bars positioned on right side
            this.holdX = this.canvas.width * config.sidebar.position.sidebarStart + config.sidebar.position.horizontalTargetOffset;
            this.x = this.startX;

            // Stagger horizontal bars
            const totalDuration = this.duration / 1000;
            this.delayTime = (this.index / this.total) * (totalDuration * config.sidebar.timing.horizontalStaggerProportion);
        }

        this.phase = 'in'; // 'in', 'hold', 'out'

        // Random velocity for hold phase (from config)
        this.holdVelocity = config.sidebar.hold.velocityMin + this.random() * (config.sidebar.hold.velocityMax - config.sidebar.hold.velocityMin);

        // Enable offscreen cache only for white horizontal bars (slanted bars extend beyond viewport)
        if (this.isWhite && this.type === 'horizontal') {
            this.useOffscreenCache = true;
        }
    }

    update(deltaTime) {
        if (!this.active) return;

        this.elapsedTime += deltaTime;

        // Handle delay before animation starts
        if (this.elapsedTime < this.delayTime) {
            this.x = this.startX; // Stay offscreen
            return;
        }

        const animTime = this.elapsedTime - this.delayTime;
        const phaseTime = animTime - this.phaseStartTime;

        if (this.phase === 'in') {
            const progress = Math.min(phaseTime / this.slideInDuration, 1);
            const easedProgress = this.easeInOutCubic(progress);
            this.x = this.startX + (this.holdX - this.startX) * easedProgress;

            if (progress >= 1) {
                this.phase = 'hold';
                this.phaseStartTime = animTime;
            }
        } else if (this.phase === 'hold') {
            // Move at constant velocity to the left (randomized per bar)
            if (!this.isBackground) {
                this.x -= this.holdVelocity * (deltaTime / (1/60)); // Scale velocity by deltaTime
            } else {
                this.x = this.holdX; // Background bar stays in place
            }

            if (phaseTime >= this.holdDuration) {
                this.phase = 'out';
                this.phaseStartTime = animTime;
                this.outStartX = this.x; // Save current position for smooth transition
            }
        } else if (this.phase === 'out') {
            const progress = Math.min(phaseTime / this.slideOutDuration, 1);
            const easedProgress = this.easeInOutCubic(progress);
            this.x = this.outStartX + (this.endX - this.outStartX) * easedProgress;

            if (progress >= 1) {
                this.active = false;
            }
        }
    }

    /**
     * Calculate bounding box accounting for rotation/skew and shadow offset
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getBoundingBox() {
        const shadowOffset = config.shared.shadow.offset;
        const height = this.type === 'horizontal' ? this.height : this.canvas.height * 1.5;

        if (this.type === 'slanted') {
            // Rotated rectangle bounding box calculation
            const angle = this.angle * Math.PI / 180;
            const cos = Math.abs(Math.cos(angle));
            const sin = Math.abs(Math.sin(angle));

            // Calculate rotated bounding box
            const bboxWidth = this.width * cos + height * sin;
            const bboxHeight = this.width * sin + height * cos;

            return {
                x: this.x - bboxWidth / 2 - shadowOffset,
                y: this.y - shadowOffset,
                width: bboxWidth + shadowOffset * 2,
                height: bboxHeight + shadowOffset * 2
            };
        } else {
            // Skewed rectangle bounding box calculation
            const skewAngle = this.skew * Math.PI / 180;
            const skewOffset = Math.abs(height * Math.tan(skewAngle));

            // Calculate skewed bounding box
            return {
                x: this.x - skewOffset - shadowOffset,
                y: this.y - height / 2 - shadowOffset,
                width: this.width + skewOffset + shadowOffset * 2,
                height: height + shadowOffset * 2
            };
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
