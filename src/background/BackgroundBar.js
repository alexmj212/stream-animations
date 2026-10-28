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

        const brightness = config.background.brightness; // 0.8 from config

        if (this.isWhite) {
            this.hue = 0;
            this.saturation = 0;
            this.lightness = 100 * brightness; // 100 * 0.8 = 80 (preserves current value)
        } else {
            // Narrow upward-biased variation: lightness range is ±10 with a +5
            // bias, keeping bars in the lively zone instead of letting them dip
            // into muddy/shadow territory against typical dark stream backdrops.
            const hueVariation = (this.random() - 0.5) * 30;
            const lightnessVariation = (this.random() - 0.5) * 20 + 5;

            this.hue = (this.baseHSL.h + hueVariation + 360) % 360;
            this.saturation = this.baseHSL.s;
            // Hard floor at 35 (post-brightness) so colored bars stay above
            // typical backdrop values and don't read as shadow patches.
            const baseLightness = Math.max(35, Math.min(80, this.baseHSL.l + lightnessVariation));
            this.lightness = Math.max(35, baseLightness * brightness);
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

        // Millisecond-based durations with per-scene overrides and shared fallback
        const entryMs = config.background.durations?.entryMs ?? config.shared.durations.entryMs;
        const exitMs = config.background.durations?.exitMs ?? config.shared.durations.exitMs;
        const holdMinMs = config.background.durations?.holdMinMs ?? 30000; // 30 seconds min
        const holdMaxMs = config.background.durations?.holdMaxMs ?? 120000; // 120 seconds max
        const transitionMs = config.background.durations?.transitionMs ?? 3000;

        this.fadeInDuration = entryMs / 1000;  // Convert to seconds for deltaTime
        this.fadeOutDuration = exitMs / 1000;
        this.visibleDuration = (holdMinMs + this.random() * (holdMaxMs - holdMinMs)) / 1000;
        this.directionTransitionDuration = transitionMs / 1000;

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
        // Not for size-animated bars: their width changes every frame, which
        // missed the cache (keyed by width) and built a new ~2300px offscreen
        // canvas per frame.
        if (this.isWhite && this.type === 'horizontal' && !this.animateSize) {
            this.useOffscreenCache = true;
        }
    }

    /**
     * Random on-screen x for a bar that fades in where it spawns. Bars used
     * to start 300px past the edge and creep in at 6-60px/s, so most of a
     * bar's 30-120s life was spent off-screen and the background often
     * showed only one or two bars.
     */
    spawnX() {
        const W = this.canvas.width;
        if (this.type === 'slanted') {
            return W * (0.02 + this.random() * 0.9) - this.width / 2;
        }
        // Horizontal bars are W+400 wide: keep at least ~40% of the screen covered
        return -this.width * 0.8 + this.random() * (this.width * 0.8 + W * 0.6);
    }

    initializeRandomPosition() {
        // Start at random point in the lifecycle for natural staggering
        const randomPhase = this.random();
        this.x = this.spawnX();

        if (randomPhase < 0.33) {
            this.phase = 'fadeIn';
            this.elapsedTime = this.random() * this.fadeInDuration;
            this.phaseStartTime = 0;
        } else if (randomPhase < 0.66) {
            this.phase = 'visible';
            const phaseTime = this.random() * this.visibleDuration;
            this.elapsedTime = this.fadeInDuration + phaseTime;
            this.phaseStartTime = this.fadeInDuration;
            this.currentOpacity = this.maxOpacity;
        } else {
            this.phase = 'fadeOut';
            const phaseTime = this.random() * this.fadeOutDuration;
            this.elapsedTime = this.fadeInDuration + this.visibleDuration + phaseTime;
            this.phaseStartTime = this.fadeInDuration + this.visibleDuration;
        }
    }

    initializeFreshStart() {
        // Fade in on screen (opacity ramps from 0, so no pop-in)
        this.elapsedTime = 0;
        this.phaseStartTime = 0;
        this.phase = 'fadeIn';
        this.currentOpacity = 0;
        this.x = this.spawnX();
    }

    /** Fully off-screen and still heading away: nothing left to show. */
    isGoneForGood() {
        const W = this.canvas.width;
        const width = this.animateSize ? this.originalWidth * this.currentSizeMultiplier : this.width;
        const sweep = this.type === 'slanted' ? this.canvas.height * 0.45 : 0;
        if (this.direction > 0) return this.x - sweep > W + 50;
        if (this.direction < 0) return this.x + width + sweep < -50;
        return false;
    }

    update(deltaTime) {
        if (!this.active) return;

        // Accumulate elapsed time
        this.elapsedTime += deltaTime;
        const phaseTime = this.elapsedTime - this.phaseStartTime;
        this.sizeTransitionTime += deltaTime;

        // Update position based on direction and speed (per second, not per
        // frame). direction is fractional while a reversal eases between -1
        // and 1; it used to be compared with === 1, so bars kept full speed
        // the old way for the whole 3s transition and then flipped instantly.
        this.x += this.baseSpeed * deltaTime * this.direction;

        // Recycle bars that drifted off-screen for good, so their slot
        // respawns as a visible bar instead of idling invisibly for minutes
        if (!this.isTransitioningDirection && this.isGoneForGood()) {
            this.phase = 'complete';
            this.active = false;
            return;
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
            // Transition complete - set new target and reset
            this.startSizeMultiplier = this.currentSizeMultiplier;
            this.targetSizeMultiplier = config.background.size.multiplierMin +
                this.random() * (config.background.size.multiplierMax - config.background.size.multiplierMin);
            this.sizeTransitionTime = 0;
        }

        // Smooth size interpolation (from start to target)
        if (this.animateSize) {
            const sizeProgress = Math.min(this.sizeTransitionTime / this.sizeTransitionDuration, 1);
            const easedProgress = this.easeInOutCubic(sizeProgress);
            this.currentSizeMultiplier = this.startSizeMultiplier +
                (this.targetSizeMultiplier - this.startSizeMultiplier) * easedProgress;
        }
    }

    /**
     * Calculate bounding box accounting for rotation/skew and shadow offset
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getBoundingBox() {
        const shadowOffset = config.shared.shadow.offset;

        // Calculate current size (with animation if enabled)
        let currentWidth = this.width;
        let currentHeight = this.type === 'horizontal' ? this.height : this.canvas.height * 1.5;

        if (this.animateSize) {
            // Only animate width (depth illusion) - never change height/tips
            currentWidth = this.originalWidth * this.currentSizeMultiplier;
            // Height remains constant - tips should never change size
        }

        if (this.type === 'slanted') {
            // Rotated rectangle bounding box calculation
            const angle = this.angle * Math.PI / 180;
            const cos = Math.abs(Math.cos(angle));
            const sin = Math.abs(Math.sin(angle));

            // Calculate rotated bounding box
            const bboxWidth = currentWidth * cos + currentHeight * sin;
            const bboxHeight = currentWidth * sin + currentHeight * cos;

            return {
                x: this.x - bboxWidth / 2 - shadowOffset,
                y: this.y - shadowOffset,
                width: bboxWidth + shadowOffset * 2,
                height: bboxHeight + shadowOffset * 2
            };
        } else {
            // Skewed rectangle bounding box calculation
            const skewAngle = this.skew * Math.PI / 180;
            const skewOffset = Math.abs(currentHeight * Math.tan(skewAngle));

            // Calculate skewed bounding box
            return {
                x: this.x - skewOffset - shadowOffset,
                y: this.y - currentHeight / 2 - shadowOffset,
                width: currentWidth + skewOffset + shadowOffset * 2,
                height: currentHeight + shadowOffset * 2
            };
        }
    }

    draw() {
        if (!this.active || this.currentOpacity <= 0) return;

        const angle = this.type === 'slanted' ? this.angle : this.skew;

        // Calculate current size (with animation if enabled)
        let currentWidth = this.width;
        let currentHeight = this.type === 'horizontal' ? this.height : this.canvas.height * 1.5;

        if (this.animateSize) {
            // Only animate width (depth illusion) - never change height/tips
            currentWidth = this.originalWidth * this.currentSizeMultiplier;
            // Height remains constant - tips should never change size
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
