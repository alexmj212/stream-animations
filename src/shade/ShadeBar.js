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

    // Calculate keyframe positions (viewport-based)
    // Enter phase: text LEFT EDGE goes from offscreen right to 25% viewport
    this.enterEndX = this.canvas.width * 0.25;

    // Hold phase: text scrolls slowly, LEFT EDGE reaches left edge of viewport (0)
    // This creates a slow marquee across 25% of the screen width
    this.holdEndX = 0;

    // Exit phase: text accelerates offscreen, LEFT EDGE ends at -textWidth
    this.exitEndX = -this.textWidth;
  }

  /**
   * Update text position with continuous motion and smooth velocity transitions
   *
   * Animation is ONE continuous motion with keyframe-based positions:
   * - Enter phase (canvas.width → 25% viewport): Fast → slow (decelerate)
   * - Hold phase (25% → 75% viewport): Slow constant speed (readability)
   * - Exit phase (75% viewport → -textWidth): Slow → fast (accelerate)
   *
   * Uses easeOut for enter (smooth deceleration) and easeIn for exit (smooth acceleration).
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

    if (this.totalAnimationTime < enterDurationSec) {
      // ENTER PHASE: Rush in from offscreen right → 25% viewport
      const progress = this.totalAnimationTime / enterDurationSec;
      const eased = this.easeOut(progress); // Smooth deceleration

      // Interpolate position from canvas.width to enterEndX (25% viewport)
      const startX = this.canvas.width;
      this.x = startX + (this.enterEndX - startX) * eased;

    } else if (this.totalAnimationTime < enterDurationSec + holdDurationSec) {
      // HOLD PHASE: Slow marquee from 25% → 75% viewport
      const progress = (this.totalAnimationTime - enterDurationSec) / holdDurationSec;

      // Linear interpolation for constant velocity
      const startX = this.enterEndX;
      this.x = startX + (this.holdEndX - startX) * progress;

    } else {
      // EXIT PHASE: Accelerate from 75% viewport → fully offscreen left
      const progress = (this.totalAnimationTime - enterDurationSec - holdDurationSec) / exitDurationSec;
      const eased = this.easeIn(progress); // Smooth acceleration

      // Interpolate position from holdEndX (75%) to exitEndX (-textWidth)
      const startX = this.holdEndX;
      this.x = startX + (this.exitEndX - startX) * eased;
    }
  }

  /**
   * Ease out cubic - decelerating motion
   * Used for enter phase to smoothly decelerate into hold
   * @param {number} t - Progress value (0-1)
   * @returns {number} Eased value (0-1)
   */
  easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Ease in cubic - accelerating motion
   * Used for exit phase to smoothly accelerate from hold
   * @param {number} t - Progress value (0-1)
   * @returns {number} Eased value (0-1)
   */
  easeIn(t) {
    return t * t * t;
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
