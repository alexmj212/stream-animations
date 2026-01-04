/**
 * Background-specific animated bar with continuous drift and fade lifecycle
 */
import { AnimatedBar } from '../shared/AnimatedBar.js';

export class BackgroundBar extends AnimatedBar {
    constructor(ctx, canvas, type, baseHSL, speed = 1.0) {
        super(ctx, canvas, type);
        this.baseHSL = baseHSL;
        this.speedMultiplier = speed;
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

        // Lower opacity for subtle background effect (0.15-0.45)
        this.maxOpacity = Math.random() * 0.3 + 0.15;
        this.currentOpacity = 0; // Start invisible

        // Random direction
        this.direction = Math.random() > 0.5 ? 1 : -1;

        if (this.type === 'slanted') {
            // White bars are smaller, colored bars have more variation
            if (this.isWhite) {
                this.width = Math.random() * 80 + 40;
            } else {
                this.width = Math.random() * 300 + 150;
            }
            this.angle = 15; // Slight clockwise angle
            this.y = 0; // Start at top, extend full height
        } else {
            this.width = this.canvas.width + 400;
            // White bars are smaller
            if (this.isWhite) {
                this.height = Math.random() * 30 + 20;
            } else {
                this.height = Math.random() * 60 + 40;
            }
            this.skew = -15; // Negative skew angle
            this.y = Math.random() * this.canvas.height; // Random vertical position
        }

        // Lifecycle timing (in frames at 60fps)
        this.fadeInDuration = 120; // 2 seconds
        this.visibleDuration = 600 + Math.random() * 600; // 10-20 seconds
        this.fadeOutDuration = 120; // 2 seconds

        // Drift speed (pixels per frame)
        this.baseSpeed = (0.3 + Math.random() * 0.7) * this.speedMultiplier;

        // Initialize position based on random lifecycle phase
        this.initializePosition();

        this.frame = 0;
        this.phase = 'fadeIn'; // 'fadeIn', 'visible', 'fadeOut'
    }

    initializePosition() {
        // Start at random position in lifecycle for natural staggering
        const randomPhase = Math.random();

        if (randomPhase < 0.33) {
            // Start in fade-in phase
            this.phase = 'fadeIn';
            this.frame = Math.floor(Math.random() * this.fadeInDuration);
            if (this.direction === 1) {
                this.x = -this.width - 300 + (this.frame * this.baseSpeed);
            } else {
                this.x = this.canvas.width + 300 - (this.frame * this.baseSpeed);
            }
        } else if (randomPhase < 0.66) {
            // Start in visible phase
            this.phase = 'visible';
            this.frame = Math.floor(Math.random() * this.visibleDuration);
            this.currentOpacity = this.maxOpacity;
            const totalDrift = this.fadeInDuration + this.frame;
            if (this.direction === 1) {
                this.x = -this.width - 300 + (totalDrift * this.baseSpeed);
            } else {
                this.x = this.canvas.width + 300 - (totalDrift * this.baseSpeed);
            }
        } else {
            // Start in fade-out phase
            this.phase = 'fadeOut';
            this.frame = Math.floor(Math.random() * this.fadeOutDuration);
            const totalDrift = this.fadeInDuration + this.visibleDuration + this.frame;
            if (this.direction === 1) {
                this.x = -this.width - 300 + (totalDrift * this.baseSpeed);
            } else {
                this.x = this.canvas.width + 300 - (totalDrift * this.baseSpeed);
            }
        }
    }

    respawn() {
        // Randomize properties for next cycle
        this.isWhite = Math.random() > 0.7;

        if (this.isWhite) {
            this.hue = 0;
            this.saturation = 0;
            this.lightness = 100;
            if (this.type === 'slanted') {
                this.width = Math.random() * 80 + 40;
            } else {
                this.height = Math.random() * 30 + 20;
            }
        } else {
            const hueVariation = (Math.random() - 0.5) * 40;
            const lightnessVariation = (Math.random() - 0.5) * 30;
            this.hue = (this.baseHSL.h + hueVariation + 360) % 360;
            this.saturation = this.baseHSL.s;
            this.lightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
            if (this.type === 'slanted') {
                this.width = Math.random() * 300 + 150;
            } else {
                this.height = Math.random() * 60 + 40;
            }
        }

        this.maxOpacity = Math.random() * 0.3 + 0.15;
        this.currentOpacity = 0;
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.baseSpeed = (0.3 + Math.random() * 0.7) * this.speedMultiplier;
        this.visibleDuration = 600 + Math.random() * 600;

        if (this.type === 'horizontal') {
            this.y = Math.random() * this.canvas.height;
        }

        // Reset to start position
        if (this.direction === 1) {
            this.x = -this.width - 300;
        } else {
            this.x = this.canvas.width + 300;
        }

        this.frame = 0;
        this.phase = 'fadeIn';
    }

    update() {
        if (!this.active) return;

        this.frame++;

        // Continuous drift
        this.x += this.baseSpeed * this.direction;

        // Update opacity based on phase
        if (this.phase === 'fadeIn') {
            const progress = this.frame / this.fadeInDuration;
            this.currentOpacity = this.maxOpacity * this.easeInOutCubic(Math.min(progress, 1));

            if (this.frame >= this.fadeInDuration) {
                this.phase = 'visible';
                this.frame = 0;
            }
        } else if (this.phase === 'visible') {
            this.currentOpacity = this.maxOpacity;

            if (this.frame >= this.visibleDuration) {
                this.phase = 'fadeOut';
                this.frame = 0;
            }
        } else if (this.phase === 'fadeOut') {
            const progress = this.frame / this.fadeOutDuration;
            this.currentOpacity = this.maxOpacity * (1 - this.easeInOutCubic(Math.min(progress, 1)));

            if (this.frame >= this.fadeOutDuration) {
                // Check if off screen, then respawn
                const offScreen = (this.direction === 1 && this.x > this.canvas.width + 400) ||
                                  (this.direction === -1 && this.x < -this.width - 400);
                if (offScreen) {
                    this.respawn();
                }
            }
        }

        // Also respawn if drifted too far off screen (safety check)
        if (this.x > this.canvas.width + 600 || this.x < -this.width - 600) {
            this.respawn();
        }
    }

    draw() {
        if (!this.active || this.currentOpacity <= 0) return;

        const angle = this.type === 'slanted' ? this.angle : this.skew;
        const height = this.type === 'horizontal' ? this.height : this.canvas.height * 1.5;

        this.drawBar(
            this.x,
            this.y,
            this.width,
            height,
            this.hue,
            this.saturation,
            this.lightness,
            this.currentOpacity,
            angle,
            true // Always draw shadows for background bars
        );
    }
}
