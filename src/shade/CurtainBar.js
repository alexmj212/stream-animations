import { AnimatedBar } from '../shared/AnimatedBar.js';
import { config } from '../config/config.js';

/**
 * CurtainBar - Semi-transparent curtain overlay
 *
 * Creates top or bottom curtain overlays that enter/hold/exit in sync with text animation.
 * Curtains provide dramatic "shade" framing effect for major stream events.
 *
 * Features:
 * - Three-phase animation (enter/hold/exit) with easeInOutCubic transitions
 * - Semi-transparent gradient fill (0.4-0.6 opacity range)
 * - Synchronized with ShadeBar via shared total duration
 *
 * @extends AnimatedBar
 */
export class CurtainBar extends AnimatedBar {
  /**
   * Create a CurtainBar instance
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {string} position - 'top' or 'bottom'
   * @param {Object} baseHSL - Base HSL color {h, s, l}
   * @param {number} totalDurationMs - Total animation duration (enter + hold + exit)
   * @param {Object} options - Optional configuration
   */
  constructor(ctx, canvas, position, baseHSL, totalDurationMs, options = {}) {
    super(ctx, canvas, 'curtain', options);

    this.position = position;
    this.baseHSL = baseHSL;
    this.totalDurationMs = totalDurationMs;

    // Curtain visual properties (CONTEXT: 0.4-0.6 range, choose middle)
    this.opacity = 0.5;
    this.targetHeight = canvas.height / 2; // Covers 50% of viewport

    // Animation state (three phases like stinger pattern)
    this.phase = 'enter'; // 'enter' | 'hold' | 'exit'
    this.elapsedTime = 0;
    this.phaseStartTime = 0;

    // Phase durations (milliseconds to seconds for update() calculations)
    this.enterDuration = config.shade.durations.entryMs / 1000;
    this.exitDuration = config.shade.durations.exitMs / 1000;

    // Hold duration fills remaining time (totalDuration - enter - exit)
    const enterExitMs = config.shade.durations.entryMs + config.shade.durations.exitMs;
    this.holdDuration = (totalDurationMs - enterExitMs) / 1000;

    // Initial position (offscreen)
    if (position === 'top') {
      this.startY = -this.targetHeight; // Start above viewport
      this.targetY = 0; // End at top edge
    } else {
      this.startY = canvas.height; // Start below viewport
      this.targetY = canvas.height / 2; // End at centerline
    }

    this.y = this.startY; // Current Y position
    this.exitStartY = 0; // Will be set when entering exit phase
  }

  /**
   * Update curtain position
   *
   * Three-phase animation:
   * - Enter: Curtain moves from offscreen to target position using easeInOutCubic
   * - Hold: Static position at targetY (no movement)
   * - Exit: Curtain returns to offscreen using easeInOutCubic
   *
   * @param {number} deltaTime - Time elapsed since last frame in seconds
   */
  update(deltaTime) {
    if (!this.active) return;

    this.elapsedTime += deltaTime;
    const phaseTime = this.elapsedTime - this.phaseStartTime;

    // Update curtain position based on current phase
    if (this.phase === 'enter') {
      const progress = Math.min(phaseTime / this.enterDuration, 1);
      const easedProgress = this.easeInOutCubic(progress);
      this.y = this.startY + (this.targetY - this.startY) * easedProgress;

      if (progress >= 1) {
        this.phase = 'hold';
        this.phaseStartTime = this.elapsedTime;
      }
    } else if (this.phase === 'hold') {
      // Static position during hold phase (CONTEXT: no breathing or motion)
      this.y = this.targetY;

      if (phaseTime >= this.holdDuration) {
        this.phase = 'exit';
        this.phaseStartTime = this.elapsedTime;
        this.exitStartY = this.y;
      }
    } else if (this.phase === 'exit') {
      const progress = Math.min(phaseTime / this.exitDuration, 1);
      const easedProgress = this.easeInOutCubic(progress);

      // Return to offscreen position
      this.y = this.exitStartY + (this.startY - this.exitStartY) * easedProgress;

      if (progress >= 1) {
        this.active = false;
      }
    }
  }

  /**
   * Draw curtain with semi-transparent gradient fill
   *
   * Uses ctx.save/restore to prevent globalAlpha persistence (RESEARCH Pitfall 5).
   */
  draw() {
    if (!this.active) return;

    // Draw curtain fill (semi-transparent gradient)
    this.ctx.save();

    // Semi-transparent fill (CONTEXT: medium opacity 0.4-0.6 range)
    this.ctx.globalAlpha = this.opacity;

    // Gradient fill using baseHSL (matches stinger/sidebar pattern)
    const gradient = this.ctx.createLinearGradient(0, this.y, 0, this.y + this.targetHeight);

    // Apply brightness multiplier to lightness
    const baseLightness = this.baseHSL.l * config.shade.brightness;
    const endLightness = Math.max(10, (this.baseHSL.l - 20) * config.shade.brightness);

    gradient.addColorStop(0, `hsl(${this.baseHSL.h}, ${this.baseHSL.s}%, ${baseLightness}%)`);
    gradient.addColorStop(1, `hsl(${this.baseHSL.h}, ${this.baseHSL.s}%, ${endLightness}%)`);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, this.y, this.canvas.width, this.targetHeight);

    this.ctx.restore();
  }
}
