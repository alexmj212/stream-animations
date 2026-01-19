import { AnimatedBar } from '../shared/AnimatedBar.js';
import { config } from '../config/config.js';

/**
 * CurtainBar - Semi-transparent curtain overlay with animated horizontal bars
 *
 * Creates top or bottom curtain overlays that enter/hold/exit in sync with text animation.
 * Each curtain contains continuously animating horizontal bars for visual interest.
 *
 * Features:
 * - Three-phase animation (enter/hold/exit) with easeInOutCubic transitions
 * - Semi-transparent gradient fill (0.4-0.6 opacity range)
 * - Horizontal bars embedded and clipped to curtain boundaries
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

    // Initialize horizontal bars inside curtain
    this.bars = [];
    this.initBars();
  }

  /**
   * Initialize horizontal bars inside curtain boundaries
   *
   * Creates 6 horizontal bars with randomized properties (direction, speed, color).
   * Bars are positioned within curtain area and animate continuously throughout
   * enter/hold/exit phases.
   */
  initBars() {
    const barCount = 6; // Balance between visual density and performance

    for (let i = 0; i < barCount; i++) {
      // Create horizontal bar (using AnimatedBar type='horizontal' pattern)
      const bar = {
        type: 'horizontal',
        direction: Math.random() > 0.5 ? 1 : -1, // Both L-R and R-L
      };

      // Position within curtain area
      if (this.position === 'top') {
        // Top curtain: y from 0 to canvas.height/2
        bar.y = (i / barCount) * (this.canvas.height / 2);
      } else {
        // Bottom curtain: y from canvas.height/2 to canvas.height
        bar.y = this.canvas.height / 2 + (i / barCount) * (this.canvas.height / 2);
      }

      // Visual properties (match stinger pattern from RESEARCH.md)
      bar.isWhite = Math.random() > 0.7; // 70% white bars

      if (bar.isWhite) {
        bar.hue = 0;
        bar.saturation = 0;
        bar.lightness = 100 * config.shade.brightness;
        bar.width = Math.random() * 30 + 20; // 20-50px
      } else {
        // Colored bar with hue variation
        const hueVariation = (Math.random() - 0.5) * 40; // ±20 from base
        bar.hue = (this.baseHSL.h + hueVariation + 360) % 360;
        bar.saturation = this.baseHSL.s;
        bar.lightness = Math.max(10, (this.baseHSL.l + (Math.random() - 0.5) * 30) * config.shade.brightness);
        bar.width = Math.random() * 60 + 40; // 40-100px
      }

      // Height is full canvas width (horizontal bar extends across screen)
      bar.height = this.canvas.width + 400;

      // Skew angle (matches stinger pattern)
      bar.skew = config.stinger.horizontal.skewAngle; // -15 degrees

      // Opacity variation
      bar.opacity = Math.random() * 0.4 + 0.6; // 0.6-1.0 (from config.stinger.opacity)

      // Start offscreen (direction determines which side)
      bar.x = bar.direction === 1 ? -200 : this.canvas.width + 200;

      // Speed to traverse canvas in 2-3 seconds
      bar.speed = (this.canvas.width + 400) / (2 + Math.random());

      this.bars.push(bar);
    }
  }

  /**
   * Update curtain position and bar positions
   *
   * Three-phase animation:
   * - Enter: Curtain moves from offscreen to target position using easeInOutCubic
   * - Hold: Static position at targetY (no movement)
   * - Exit: Curtain returns to offscreen using easeInOutCubic
   *
   * Bars animate continuously throughout all phases with wrapping.
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

    // Update bars continuously (animate throughout enter/hold/exit)
    this.bars.forEach(bar => {
      bar.x += bar.speed * bar.direction * deltaTime;

      // Wrap around when offscreen
      if (bar.direction === 1 && bar.x > this.canvas.width + 200) {
        bar.x = -200;
      } else if (bar.direction === -1 && bar.x < -200) {
        bar.x = this.canvas.width + 200;
      }
    });
  }

  /**
   * Draw curtain with semi-transparent gradient fill and clipped bars
   *
   * Drawing order:
   * 1. Semi-transparent gradient rectangle (curtain background)
   * 2. Horizontal bars clipped to curtain's current visible area
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

    // Draw bars on top of curtain, clipped to curtain boundaries
    // (RESEARCH Pitfall 4: bars must not render outside curtain area)
    this.ctx.save();
    this.ctx.beginPath();

    // Create clipping region matching curtain's current visible area
    if (this.position === 'top') {
      // Top curtain: clip from top of viewport to current bottom edge of curtain
      const visibleHeight = Math.max(0, this.y + this.targetHeight);
      this.ctx.rect(0, 0, this.canvas.width, visibleHeight);
    } else {
      // Bottom curtain: clip from current top edge to bottom of viewport
      const clipY = Math.max(this.y, this.canvas.height / 2);
      const clipHeight = this.canvas.height - clipY;
      this.ctx.rect(0, clipY, this.canvas.width, clipHeight);
    }

    this.ctx.clip();

    // Draw bars using AnimatedBar's drawBar method
    this.bars.forEach(bar => {
      this.drawBar(
        bar.x,
        bar.y,
        bar.width,
        bar.height,
        bar.hue,
        bar.saturation,
        bar.lightness,
        bar.opacity,
        bar.skew,
        true // withShadow
      );
    });

    this.ctx.restore();
  }
}
