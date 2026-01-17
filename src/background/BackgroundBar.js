/**
 * Background-specific animated bar with continuous drift and fade lifecycle
 */
import { AnimatedBar } from '../shared/AnimatedBar.js';
import { config } from '../config/config.js';
import {
    calculateOpacity,
    calculateSizeMultiplier,
    calculateDirectionTransition,
    calculatePosition,
    shouldChangeDirection,
    calculateTransitionProgress,
    determineNextPhase,
    isBarInViewport
} from '../shared/animations/calculations.js';

export class BackgroundBar extends AnimatedBar {
    constructor(ctx, canvas, type, baseHSL, speed = 1.0, randomStart = true, options = {}) {
        super(ctx, canvas, type, options);
        this.baseHSL = baseHSL;
        this.speedMultiplier = speed;
        this.randomStart = randomStart;
        this.init();
    }

    init() {
        // Some bars are white, others use hue variations
        this.isWhite = this.random() > 0.7;

        if (this.isWhite) {
            this.hue = 0;
            this.saturation = 0;
            this.lightness = 80; // Reduced from 100 to 80 (20% darker)
        } else {
            // Vary the hue slightly from base color
            const hueVariation = (this.random() - 0.5) * 40;
            const lightnessVariation = (this.random() - 0.5) * 30;

            this.hue = (this.baseHSL.h + hueVariation + 360) % 360;
            this.saturation = this.baseHSL.s;
            // Reduce lightness by 20% from the base calculation
            const baseLightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
            this.lightness = Math.max(10, baseLightness * 0.8);
        }

        // Opacity range (0.4-0.7 = 40%-70%)
        this.maxOpacity = this.random() * 0.3 + 0.4;
        this.currentOpacity = 0; // Start invisible

        // Random direction
        this.direction = this.random() > 0.5 ? 1 : -1;

        if (this.type === 'slanted') {
            // White bars are smaller, colored bars have more variation
            if (this.isWhite) {
                this.width = this.random() * 100 + 50;
            } else {
                this.width = this.random() * 400 + 200;
            }
            this.angle = 15; // Slight clockwise angle
            this.y = 0; // Start at top, extend full height
        } else {
            this.width = this.canvas.width + 400;
            // White bars are smaller
            if (this.isWhite) {
                this.height = this.random() * 30 + 20;
            } else {
                this.height = this.random() * 60 + 40;
            }
            this.skew = -15; // Negative skew angle
            this.y = this.random() * this.canvas.height; // Random vertical position
        }

        // Time-based animation tracking (replaces frame counting)
        this.elapsedTime = 0;        // Total elapsed time in seconds
        this.phaseStartTime = 0;     // Time when current phase started
        this.sizeTransitionTime = 0; // Time since size transition started

        // Convert frame-based durations to time-based (frames / 60fps)
        this.fadeInDuration = AnimatedBar.framesToSeconds(config.background.timing.fadeInFrames);
        this.fadeOutDuration = AnimatedBar.framesToSeconds(config.background.timing.fadeOutFrames);
        this.visibleDuration = AnimatedBar.framesToSeconds(
            config.background.timing.visibleFramesMin +
            this.random() * (config.background.timing.visibleFramesMax - config.background.timing.visibleFramesMin)
        );
        this.directionTransitionDuration = AnimatedBar.framesToSeconds(config.background.timing.directionTransitionFrames);

        // Drift speed (pixels per second, NOT per frame) - more variable, from very slow to same max
        this.baseSpeed = ((0.1 + this.random() * 0.9) * this.speedMultiplier) * 60; // Convert from per-frame to per-second

        // Random direction changes (0-2 times during lifetime) - time-based
        this.directionChanges = Math.floor(this.random() * (config.background.direction.maxChanges + 1)); // 0, 1, or 2 changes
        this.directionChangeTimings = [];
        for (let i = 0; i < this.directionChanges; i++) {
            // Schedule direction changes at random points during visible phase (in seconds)
            this.directionChangeTimings.push(this.random() * this.visibleDuration);
        }
        this.directionChangeTimings.sort((a, b) => a - b); // Sort for easier checking
        this.nextDirectionChangeIndex = 0;

        // Direction transition state (time-based)
        this.isTransitioningDirection = false;
        this.transitionStartTime = 0;
        this.oldDirection = this.direction;
        this.newDirection = this.direction;

        // Size animation (50% of bars will grow/shrink over their lifetime)
        this.animateSize = this.random() > 0.5;
        if (this.animateSize) {
            // Store original size
            this.originalWidth = this.width;
            this.originalHeight = this.height;

            // Random starting and ending sizes using config values
            this.startSizeMultiplier = config.background.size.multiplierMin +
                this.random() * (config.background.size.multiplierMax - config.background.size.multiplierMin);
            this.endSizeMultiplier = config.background.size.multiplierMin +
                this.random() * (config.background.size.multiplierMax - config.background.size.multiplierMin);

            // Ensure they're different enough to be noticeable
            while (Math.abs(this.startSizeMultiplier - this.endSizeMultiplier) < config.background.size.minVariation) {
                this.endSizeMultiplier = config.background.size.multiplierMin +
                    this.random() * (config.background.size.multiplierMax - config.background.size.multiplierMin);
            }

            // Size transitions happen periodically (every 5 seconds)
            this.sizeTransitionDuration = 5.0; // 5 seconds per size transition
            this.currentSizeMultiplier = this.startSizeMultiplier;
            this.targetSizeMultiplier = this.endSizeMultiplier;
        }

        // Initialize position
        if (this.randomStart) {
            // For initial setup: start at random position in lifecycle for natural staggering
            this.initializeRandomPosition();
        } else {
            // For new bars: always start fresh from off-screen
            this.initializeFreshStart();
        }

        // Enable offscreen cache only for white horizontal bars (slanted bars extend beyond viewport)
        if (this.isWhite && this.type === 'horizontal') {
            this.useOffscreenCache = true;
        }
    }

    initializeRandomPosition() {
        // Start at random position in lifecycle for natural staggering
        const randomPhase = Math.random();

        if (randomPhase < 0.33) {
            // Start in fade-in phase
            this.phase = 'fadeIn';
            this.elapsedTime = Math.random() * this.fadeInDuration;
            this.phaseStartTime = 0;
            if (this.direction === 1) {
                this.x = -this.width - 300 + (this.elapsedTime * this.baseSpeed);
            } else {
                this.x = this.canvas.width + 300 - (this.elapsedTime * this.baseSpeed);
            }
        } else if (randomPhase < 0.66) {
            // Start in visible phase
            this.phase = 'visible';
            const phaseTime = Math.random() * this.visibleDuration;
            this.elapsedTime = this.fadeInDuration + phaseTime;
            this.phaseStartTime = this.fadeInDuration;
            this.currentOpacity = this.maxOpacity;
            if (this.direction === 1) {
                this.x = -this.width - 300 + (this.elapsedTime * this.baseSpeed);
            } else {
                this.x = this.canvas.width + 300 - (this.elapsedTime * this.baseSpeed);
            }
        } else {
            // Start in fade-out phase
            this.phase = 'fadeOut';
            const phaseTime = Math.random() * this.fadeOutDuration;
            this.elapsedTime = this.fadeInDuration + this.visibleDuration + phaseTime;
            this.phaseStartTime = this.fadeInDuration + this.visibleDuration;
            if (this.direction === 1) {
                this.x = -this.width - 300 + (this.elapsedTime * this.baseSpeed);
            } else {
                this.x = this.canvas.width + 300 - (this.elapsedTime * this.baseSpeed);
            }
        }
    }

    initializeFreshStart() {
        // Always start fresh from off-screen, fading in
        this.elapsedTime = 0;
        this.phaseStartTime = 0;
        this.phase = 'fadeIn';
        this.currentOpacity = 0;

        // Position off-screen based on direction
        if (this.direction === 1) {
            this.x = -this.width - 300;
        } else {
            this.x = this.canvas.width + 300;
        }
    }

    update(deltaTime) {
        if (!this.active) return;

        // Accumulate elapsed time
        this.elapsedTime += deltaTime;
        const phaseTime = this.elapsedTime - this.phaseStartTime;
        this.sizeTransitionTime += deltaTime;

        // Update position based on direction and speed (per second, not per frame)
        const movement = this.baseSpeed * deltaTime;
        if (this.direction === 1) {
            this.x += movement;
        } else {
            this.x -= movement;
        }

        // Phase transitions (time-based, not frame-based)
        if (this.phase === 'fadeIn') {
            // Calculate opacity during fade in
            const progress = Math.min(phaseTime / this.fadeInDuration, 1);
            this.currentOpacity = this.maxOpacity * this.easeInOutCubic(progress);

            if (phaseTime >= this.fadeInDuration) {
                this.phase = 'visible';
                this.phaseStartTime = this.elapsedTime;
            }
        } else if (this.phase === 'visible') {
            this.currentOpacity = this.maxOpacity;

            // Check for direction changes (time-based)
            if (!this.isTransitioningDirection &&
                this.nextDirectionChangeIndex < this.directionChangeTimings.length &&
                phaseTime >= this.directionChangeTimings[this.nextDirectionChangeIndex]) {
                // Start direction transition
                this.isTransitioningDirection = true;
                this.transitionStartTime = this.elapsedTime;
                this.oldDirection = this.direction;
                this.newDirection = -this.oldDirection;
                this.nextDirectionChangeIndex++;
            }

            // Handle direction transition with easing
            if (this.isTransitioningDirection) {
                const transitionTime = this.elapsedTime - this.transitionStartTime;
                const transitionProgress = Math.min(transitionTime / this.directionTransitionDuration, 1);

                if (transitionProgress >= 1) {
                    // Transition complete
                    this.direction = this.newDirection;
                    this.isTransitioningDirection = false;
                } else {
                    // Ease in-out cubic interpolation between old and new direction
                    const easedProgress = this.easeInOutCubic(transitionProgress);
                    this.direction = this.oldDirection + (this.newDirection - this.oldDirection) * easedProgress;
                }
            }

            // Check if should start fade out
            if (phaseTime >= this.visibleDuration) {
                this.phase = 'fadeOut';
                this.phaseStartTime = this.elapsedTime;
            }
        } else if (this.phase === 'fadeOut') {
            // Calculate opacity during fade out
            const progress = Math.min(phaseTime / this.fadeOutDuration, 1);
            this.currentOpacity = this.maxOpacity * (1 - this.easeInOutCubic(progress));

            if (phaseTime >= this.fadeOutDuration) {
                this.phase = 'complete';
                this.active = false;
            }
        }

        // Size transitions (if using size multiplier animation)
        if (this.animateSize && this.sizeTransitionTime >= this.sizeTransitionDuration) {
            // Start new size transition
            this.targetSizeMultiplier = config.background.size.multiplierMin +
                this.random() * (config.background.size.multiplierMax - config.background.size.multiplierMin);
            this.sizeTransitionTime = 0;
        }

        // Smooth size interpolation
        if (this.animateSize) {
            const sizeProgress = Math.min(this.sizeTransitionTime / this.sizeTransitionDuration, 1);
            this.currentSizeMultiplier = this.currentSizeMultiplier +
                (this.targetSizeMultiplier - this.currentSizeMultiplier) * this.easeInOutCubic(sizeProgress);
        }
    }

    draw() {
        if (!this.active || this.currentOpacity <= 0) return;

        const angle = this.type === 'slanted' ? this.angle : this.skew;

        // Calculate current size (with animation if enabled)
        let currentWidth = this.width;
        let currentHeight = this.type === 'horizontal' ? this.height : this.canvas.height * 1.5;

        if (this.animateSize) {
            currentWidth = this.originalWidth * this.currentSizeMultiplier;
            if (this.type === 'horizontal') {
                currentHeight = this.originalHeight * this.currentSizeMultiplier;
            }
        }

        // Viewport culling - skip drawing if bar is completely off-screen
        // For cached bars (centered at x,y), adjust culling bounds
        const cullX = this.useOffscreenCache ? this.x - currentWidth / 2 : this.x;
        const cullWidth = currentWidth;
        if (!isBarInViewport(cullX, this.y, cullWidth, currentHeight, this.canvas.width, this.canvas.height, 200)) {
            return;
        }

        this.drawBar(
            this.x,
            this.y,
            currentWidth,
            currentHeight,
            this.hue,
            this.saturation,
            this.lightness,
            this.currentOpacity,
            angle,
            true // Always draw shadows for background bars
        );
    }
}
