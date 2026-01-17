/**
 * Background-specific animated bar with continuous drift and fade lifecycle
 */
import { AnimatedBar } from '../shared/AnimatedBar.js';
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

        // Lifecycle timing (in frames at 60fps)
        this.fadeInDuration = 120; // 2 seconds
        this.visibleDuration = 1800 + this.random() * 5400; // 30-120 seconds (2 minutes max)
        this.fadeOutDuration = 120; // 2 seconds

        // Drift speed (pixels per frame) - more variable, from very slow to same max
        this.baseSpeed = (0.1 + this.random() * 0.9) * this.speedMultiplier;

        // Random direction changes (0-2 times during lifetime)
        this.directionChanges = Math.floor(this.random() * 3); // 0, 1, or 2 changes
        this.directionChangeTimings = [];
        for (let i = 0; i < this.directionChanges; i++) {
            // Schedule direction changes at random points during visible phase
            this.directionChangeTimings.push(this.random() * this.visibleDuration);
        }
        this.directionChangeTimings.sort((a, b) => a - b); // Sort for easier checking
        this.nextDirectionChangeIndex = 0;

        // Direction transition state
        this.isTransitioningDirection = false;
        this.transitionStartFrame = 0;
        this.transitionDuration = 180; // 3 seconds for smooth transition
        this.oldDirection = this.direction;
        this.newDirection = this.direction;

        // Size animation (50% of bars will grow/shrink over their lifetime)
        this.animateSize = this.random() > 0.5;
        if (this.animateSize) {
            // Store original size
            this.originalWidth = this.width;
            this.originalHeight = this.height;

            // Random starting and ending sizes (50%-150% of original)
            this.startSizeMultiplier = 0.5 + this.random() * 1.0; // 50%-150%
            this.endSizeMultiplier = 0.5 + this.random() * 1.0;   // 50%-150%

            // Ensure they're different enough to be noticeable
            while (Math.abs(this.startSizeMultiplier - this.endSizeMultiplier) < 0.3) {
                this.endSizeMultiplier = 0.5 + this.random() * 1.0;
            }
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

    initializeFreshStart() {
        // Always start fresh from off-screen, fading in
        this.frame = 0;
        this.phase = 'fadeIn';
        this.currentOpacity = 0;

        // Position off-screen based on direction
        if (this.direction === 1) {
            this.x = -this.width - 300;
        } else {
            this.x = this.canvas.width + 300;
        }
    }

    update() {
        if (!this.active) return;

        this.frame++;

        // Continuous drift using pure calculation function
        this.x = calculatePosition(this.x, this.baseSpeed, this.direction);

        // Update opacity based on phase using pure calculation function
        this.currentOpacity = calculateOpacity(
            this.phase,
            this.frame,
            this.fadeInDuration,
            this.fadeOutDuration,
            this.maxOpacity,
            this.easeInOutCubic.bind(this)
        );

        // Handle phase-specific logic
        if (this.phase === 'visible') {
            // Check for direction changes using pure function
            if (!this.isTransitioningDirection &&
                shouldChangeDirection(this.frame, this.directionChangeTimings, this.nextDirectionChangeIndex)) {
                // Start direction transition
                this.isTransitioningDirection = true;
                this.transitionStartFrame = this.frame;
                this.oldDirection = this.direction;
                this.newDirection = -this.direction;
                this.nextDirectionChangeIndex++;
            }

            // Handle direction transition with easing
            if (this.isTransitioningDirection) {
                const transitionProgress = calculateTransitionProgress(
                    this.frame,
                    this.transitionStartFrame,
                    this.transitionDuration
                );

                if (transitionProgress >= 1) {
                    // Transition complete
                    this.direction = this.newDirection;
                    this.isTransitioningDirection = false;
                } else {
                    // Ease in-out cubic interpolation between old and new direction
                    this.direction = calculateDirectionTransition(
                        transitionProgress,
                        this.oldDirection,
                        this.newDirection,
                        this.easeInOutCubic.bind(this)
                    );
                }
            }
        }

        // Determine next phase using pure function
        const nextPhaseResult = determineNextPhase(
            this.phase,
            this.frame,
            this.fadeInDuration,
            this.visibleDuration,
            this.fadeOutDuration
        );

        if (nextPhaseResult.phase !== this.phase) {
            this.phase = nextPhaseResult.phase;
            this.frame = nextPhaseResult.frame;
        }

        // Deactivate when animation is complete
        if (this.phase === 'complete') {
            this.active = false;
        }
    }

    draw() {
        if (!this.active || this.currentOpacity <= 0) return;

        const angle = this.type === 'slanted' ? this.angle : this.skew;

        // Calculate current size (with animation if enabled) using pure function
        let currentWidth = this.width;
        let currentHeight = this.type === 'horizontal' ? this.height : this.canvas.height * 1.5;

        if (this.animateSize) {
            const sizeMultiplier = calculateSizeMultiplier(
                this.phase,
                this.frame,
                this.visibleDuration,
                this.startSizeMultiplier,
                this.endSizeMultiplier,
                this.easeInOutCubic.bind(this)
            );

            currentWidth = this.originalWidth * sizeMultiplier;
            if (this.type === 'horizontal') {
                currentHeight = this.originalHeight * sizeMultiplier;
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
