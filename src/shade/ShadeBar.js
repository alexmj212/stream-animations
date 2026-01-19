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
   * @param {string} color - Hex color (e.g., '#ff6600')
   * @param {number} holdDurationMs - Hold phase duration in milliseconds (null to auto-calculate)
   */
  constructor(ctx, canvas, text, color, holdDurationMs = null) {
    super(ctx, canvas, 'text', {});

    this.text = text;
    this.color = color; // Explicit color for OBS compatibility (avoids default fillStyle issues)

    // Calculate hold duration if not provided via URL parameter
    this.holdDurationMs = holdDurationMs !== null
      ? holdDurationMs
      : ShadeBar.calculateHoldDuration(text);

    // Text positioning
    this.x = canvas.width; // Start offscreen right (will fly in from right edge)
    this.y = canvas.height / 2; // Vertical center

    // Text metrics (will be measured after font loads in init())
    this.textWidth = 0;

    // Phase tracking (for future Phase 06 curtain integration)
    this.phase = 'enter'; // 'enter' | 'hold' | 'exit'
    this.elapsedTime = 0; // Accumulated time in current phase (seconds)
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

    // Calculate scroll speed based on text width and hold duration (TEXT-03 requirement)
    this.scrollSpeed = ShadeBar.calculateScrollSpeed(
      this.textWidth,
      this.canvas.width,
      this.holdDurationMs
    );

    // Store phase durations (use shared.durations from config - established in Phase 04)
    this.enterDurationMs = config.shared.durations.entryMs;
    this.exitDurationMs = config.shared.durations.exitMs;
  }

  /**
   * Update text position and phase tracking
   *
   * @param {number} deltaTime - Time elapsed since last frame in seconds
   */
  update(deltaTime) {
    this.elapsedTime += deltaTime;

    // Phase transitions based on time
    if (this.phase === 'enter' && this.elapsedTime >= this.enterDurationMs / 1000) {
      this.phase = 'hold';
      this.elapsedTime = 0; // Reset for hold phase timing
    } else if (this.phase === 'hold' && this.elapsedTime >= this.holdDurationMs / 1000) {
      this.phase = 'exit';
      this.elapsedTime = 0; // Reset for exit phase timing
    } else if (this.phase === 'exit' && this.elapsedTime >= this.exitDurationMs / 1000) {
      this.active = false; // Animation complete
      return;
    }

    // Calculate velocity based on phase
    let velocity = 0; // pixels per second

    if (this.phase === 'enter') {
      // Fly in from right edge (offscreen → onscreen)
      // Use easing for smooth entrance
      const progress = this.elapsedTime / (this.enterDurationMs / 1000);
      const eased = this.easeInOutCubic(Math.min(progress, 1));
      // Start position: canvas.width (offscreen right)
      // Target position: 0 (left edge of text at screen origin)
      const startX = this.canvas.width;
      const targetX = 0;
      this.x = startX + (targetX - startX) * eased;
    } else if (this.phase === 'hold') {
      // Scroll right-to-left at constant speed (TEXT-03 requirement)
      velocity = -this.scrollSpeed; // Negative for left movement
    } else if (this.phase === 'exit') {
      // Fly out to left edge (onscreen → offscreen)
      const progress = this.elapsedTime / (this.exitDurationMs / 1000);
      const eased = this.easeInOutCubic(Math.min(progress, 1));
      // Current position at end of hold → offscreen left
      const startX = this.x; // Where hold phase ended
      const targetX = -this.textWidth; // Fully offscreen left
      this.x = startX + (targetX - startX) * eased;
    }

    // Apply velocity (hold phase scrolling)
    if (velocity !== 0) {
      this.x += velocity * deltaTime; // Delta-time normalized movement (CONFIG-05)
    }
  }

  /**
   * Draw text with shadow/glow effect
   *
   * Uses explicit fillStyle and shadow properties for OBS browser source compatibility.
   * Text is rendered at current (x, y) position with configured font and shadow.
   */
  draw() {
    this.ctx.save();

    // Set text properties
    this.ctx.font = config.shade.text.font;
    this.ctx.fillStyle = this.color; // Explicit fillStyle for OBS (prevents browser source issues)
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
