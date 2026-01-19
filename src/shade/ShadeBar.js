import { AnimatedBar } from '../shared/AnimatedBar.js';
import { config } from '../config/config.js';

/**
 * ShadeBar - Canvas-based text rendering component for OBS overlays
 *
 * Displays large scrolling text with dynamic hold duration based on text length.
 * Text appears as a celebratory shade element for raids, gift subs, and major stream events.
 *
 * Features:
 * - Canvas-based rendering with explicit fillStyle (OBS compatible)
 * - Font Loading API integration prevents measurement race conditions
 * - Right-to-left marquee scrolling with dynamic speed calculation
 * - Text shadow/glow for depth and separation from background
 * - URL parameter configuration for text, color, and duration
 *
 * @extends AnimatedBar
 */
export class ShadeBar extends AnimatedBar {
  /**
   * Calculate hold duration from text length using reading speed baseline
   * @param {string} text - Text to display
   * @param {number} msPerWord - Reading speed in ms per word (default from config)
   * @param {number} minDurationMs - Minimum duration regardless of length (default from config)
   * @returns {number} Hold duration in milliseconds
   */
  static calculateHoldDuration(text, msPerWord = config.shade.timing.readingSpeedMsPerWord, minDurationMs = config.shade.timing.minHoldMs) {
    // Count words by splitting on whitespace (RESEARCH.md Word Count pattern)
    // Filter empty strings to handle edge case of empty/whitespace-only text (RESEARCH.md Pitfall 4)
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Calculate duration based on reading speed (TEXT-02 requirement)
    const calculatedDuration = wordCount * msPerWord;

    // Enforce minimum duration (TEXT-05 requirement - minimum readability guarantee)
    return Math.max(calculatedDuration, minDurationMs);
  }

  /**
   * Calculate scroll speed to ensure full text visibility within hold duration
   * @param {number} textWidth - Width of text in pixels
   * @param {number} canvasWidth - Canvas width in pixels
   * @param {number} holdDurationMs - Hold phase duration in milliseconds
   * @returns {number} Scroll speed in pixels per second
   */
  static calculateScrollSpeed(textWidth, canvasWidth, holdDurationMs) {
    // Text must travel its full width plus canvas width to scroll completely across screen
    // (starts fully on right, ends fully off left)
    const totalDistance = textWidth + canvasWidth;

    // Speed = distance / time (convert ms to seconds)
    const speedPxPerSecond = (totalDistance / holdDurationMs) * 1000;

    return speedPxPerSecond;
  }

  /**
   * Create a ShadeBar instance
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {string} text - Text to display
   * @param {number} holdDurationMs - Hold phase duration in milliseconds (null to auto-calculate)
   */
  constructor(ctx, canvas, text, holdDurationMs = null) {
    super(ctx, canvas, 'text', {});

    this.text = text;

    // Calculate hold duration if not provided via URL parameter
    this.holdDurationMs = holdDurationMs !== null
      ? holdDurationMs
      : ShadeBar.calculateHoldDuration(text);

    // Text positioning
    this.x = canvas.width; // Start offscreen right (will rush in from right edge)
    this.y = canvas.height / 2; // Vertical center

    // Text metrics (will be measured after font loads in init())
    this.textWidth = 0;

    // Continuous animation tracking (not discrete phases)
    this.totalAnimationTime = 0; // Total time elapsed across entire animation (seconds)
  }

  /**
   * Initialize ShadeBar after font loading
   *
   * IMPORTANT: Must be called AFTER document.fonts.ready resolves to ensure
   * accurate text measurement. Calling before font loads results in incorrect
   * textWidth (race condition).
   */
  init() {
    // Measure text width (requires font to be loaded)
    this.ctx.font = config.shade.text.font;
    const metrics = this.ctx.measureText(this.text);
    this.textWidth = metrics.width;

    // Calculate total animation duration (enter + hold + exit)
    this.enterDurationMs = config.shared.durations.entryMs;
    this.exitDurationMs = config.shared.durations.exitMs;
    this.totalDurationMs = this.enterDurationMs + this.holdDurationMs + this.exitDurationMs;

    // Calculate keyframe positions (percentage of viewport width)
    // Enter: 0-25% (rush in from offscreen right, decelerate)
    // Hold: 25-75% (slow marquee for readability)
    // Exit: 75-100% (accelerate, rush out to offscreen left)
    this.enterEndX = this.canvas.width * 0.25;    // Enter ends at 25% mark
    this.holdEndX = -this.textWidth * 0.25;       // Hold ends at 75% mark (text 25% offscreen left)
    this.exitEndX = -this.textWidth;              // Exit ends fully offscreen left

    // Calculate velocities for each phase to match timing
    // These are target velocities - actual velocity will smoothly transition between them
    this.enterVelocity = (this.canvas.width - this.enterEndX) / (this.enterDurationMs / 1000); // px/s
    this.holdVelocity = (this.enterEndX - this.holdEndX) / (this.holdDurationMs / 1000);       // px/s
    this.exitVelocity = (this.holdEndX - this.exitEndX) / (this.exitDurationMs / 1000);       // px/s
  }

  /**
   * Update text position with continuous motion and smooth velocity transitions
   *
   * Animation is ONE continuous motion with velocity changes (not three separate animations):
   * - Enter phase (0-25%): Rush in from offscreen, decelerate smoothly into hold
   * - Hold phase (25-75%): Slow marquee for readability
   * - Exit phase (75-100%): Accelerate smoothly from hold, rush out offscreen
   *
   * Momentum preservation ensures smooth transitions between phases.
   *
   * @param {number} deltaTime - Time elapsed since last frame in seconds
   */
  update(deltaTime) {
    this.totalAnimationTime += deltaTime;

    // Check if animation complete
    const totalDurationSec = this.totalDurationMs / 1000;
    if (this.totalAnimationTime >= totalDurationSec) {
      this.active = false;
      this.x = this.exitEndX; // Snap to final position
      return;
    }

    // Calculate current phase and progress within that phase
    const enterDurationSec = this.enterDurationMs / 1000;
    const holdDurationSec = this.holdDurationMs / 1000;
    const exitDurationSec = this.exitDurationMs / 1000;

    let currentVelocity;
    let targetX;

    if (this.totalAnimationTime < enterDurationSec) {
      // ENTER PHASE (0-25%): Rush in from right, decelerate into hold
      const progress = this.totalAnimationTime / enterDurationSec;
      const eased = this.easeInOutCubic(progress);

      // Position transitions from canvas.width (offscreen right) to enterEndX (25% mark)
      const startX = this.canvas.width;
      targetX = startX + (this.enterEndX - startX) * eased;

      // Velocity starts fast, smoothly decelerates into hold velocity
      // Use derivative of easing function for smooth velocity transition
      currentVelocity = -this.enterVelocity * this.easeInOutCubicDerivative(progress);

      this.x = targetX;
    } else if (this.totalAnimationTime < enterDurationSec + holdDurationSec) {
      // HOLD PHASE (25-75%): Slow constant marquee for readability
      const progress = (this.totalAnimationTime - enterDurationSec) / holdDurationSec;

      // Position transitions from enterEndX (25%) to holdEndX (75%)
      const startX = this.enterEndX;
      targetX = startX + (this.holdEndX - startX) * progress;

      // Constant velocity (linear motion)
      currentVelocity = -this.holdVelocity;

      this.x = targetX;
    } else {
      // EXIT PHASE (75-100%): Accelerate into fast rush out
      const progress = (this.totalAnimationTime - enterDurationSec - holdDurationSec) / exitDurationSec;
      const eased = this.easeInOutCubic(progress);

      // Position transitions from holdEndX (75%) to exitEndX (offscreen left)
      const startX = this.holdEndX;
      targetX = startX + (this.exitEndX - startX) * eased;

      // Velocity smoothly accelerates from hold velocity to fast exit
      currentVelocity = -this.exitVelocity * this.easeInOutCubicDerivative(progress);

      this.x = targetX;
    }
  }

  /**
   * Calculate derivative of easeInOutCubic for smooth velocity transitions
   *
   * Used to derive instantaneous velocity from position easing function.
   * Ensures smooth acceleration/deceleration between phases.
   *
   * @param {number} t - Progress value (0-1)
   * @returns {number} Derivative value (rate of change)
   */
  easeInOutCubicDerivative(t) {
    if (t < 0.5) {
      // Derivative of 4*t^3 is 12*t^2
      return 12 * t * t;
    } else {
      // Derivative of 1 - (-2*t + 2)^3 / 2
      const u = -2 * t + 2;
      return 6 * u * u; // Simplified derivative
    }
  }

  /**
   * Draw text with shadow/glow effect
   *
   * Uses explicit fillStyle and shadow properties for OBS browser source compatibility.
   * Text is rendered at current (x, y) position with configured font and shadow.
   * Text is always white for consistent branding.
   */
  draw() {
    this.ctx.save();

    // Set text properties
    this.ctx.font = config.shade.text.font;
    this.ctx.fillStyle = config.shade.text.color; // Always white (from config)
    this.ctx.textBaseline = 'middle'; // Vertical alignment at y position

    // Draw shadow/glow (adds depth and separation from background)
    this.ctx.shadowColor = config.shade.text.shadow.color;
    this.ctx.shadowBlur = config.shade.text.shadow.blur;
    this.ctx.shadowOffsetX = config.shade.text.shadow.offsetX;
    this.ctx.shadowOffsetY = config.shade.text.shadow.offsetY;

    // Draw text at current position
    this.ctx.fillText(this.text, this.x, this.y);

    this.ctx.restore();
  }
}
