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
   * Create a ShadeBar instance
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {string} text - Text to display
   * @param {string} color - Hex color (e.g., '#ff6600')
   * @param {number} holdDurationMs - Hold phase duration in milliseconds
   */
  constructor(ctx, canvas, text, color, holdDurationMs) {
    super(ctx, canvas, 'text', {});

    this.text = text;
    this.color = color; // Explicit color for OBS compatibility (avoids default fillStyle issues)
    this.holdDurationMs = holdDurationMs;

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
  }

  /**
   * Update text position and phase tracking
   *
   * @param {number} deltaTime - Time elapsed since last frame in seconds
   *
   * Note: Scrolling animation logic will be added in Phase 05 Plan 02.
   * Currently this is a stub that tracks elapsed time.
   */
  update(deltaTime) {
    // Stub for Phase 06 - will implement enter/hold/exit animations in Plan 02
    this.elapsedTime += deltaTime;

    // Text remains stationary at initial position (x = canvas.width)
    // Plan 02 will add:
    // - Enter animation: fly in from right edge
    // - Hold animation: continuous right-to-left scrolling
    // - Exit animation: fly out left edge
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
