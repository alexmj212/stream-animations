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
   * @param {number} options.textHeight - Height of text (for tip sizing)
   */
  constructor(ctx, canvas, position, baseHSL, totalDurationMs, options = {}) {
    super(ctx, canvas, 'curtain', options);

    this.position = position;
    this.baseHSL = baseHSL;
    this.totalDurationMs = totalDurationMs;

    // Curtain visual properties (CONTEXT: 0.4-0.6 range, choose middle)
    this.opacity = 0.5;

    // Overshoot: curtains extend slightly past center to guarantee no gap between tips
    this.overshoot = 4; // 4 pixels past center (8px total overlap between curtains)
    this.targetHeight = canvas.height / 2 + this.overshoot; // Covers 50% + overshoot

    // Tip properties (solid color background for text readability)
    // Tips are slightly more than 50% of text height so they overlap when curtains meet
    this.textHeight = options.textHeight || 96; // Default to font size if not provided
    this.tipHeight = this.textHeight * 0.60; // 60% of text height (creates ~10px overlap at center)

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
      this.targetY = 0; // End at top edge (curtain extends down past center)
    } else {
      this.startY = canvas.height; // Start below viewport
      this.targetY = canvas.height / 2 - this.overshoot; // End before centerline (overlap with top)
    }

    this.y = this.startY; // Current Y position
    this.exitStartY = 0; // Will be set when entering exit phase

    // Initialize horizontal bars inside curtain
    this.bars = [];
    this.initBars();
  }

  /**
   * Initialize mixed slanted and horizontal bars inside curtain boundaries
   *
   * Creates 8 bars (mix of slanted and horizontal) with randomized properties.
   * Matches stinger/sidebar visual pattern: varying widths, both directions,
   * shadow rectangles, and mix of vertical (slanted) and horizontal bars.
   *
   * Bars animate continuously throughout enter/hold/exit phases.
   */
  initBars() {
    const barCount = 8; // Increased from 6 to match stinger density (8 accent bars + 2 background)

    for (let i = 0; i < barCount; i++) {
      // Mix of slanted (vertical) and horizontal bars (60% slanted, 40% horizontal like stinger)
      const type = Math.random() > 0.6 ? 'slanted' : 'horizontal';

      const bar = {
        type: type,
        direction: Math.random() > 0.5 ? 1 : -1, // Both L-R and R-L (or up-down for slanted)
      };

      // Visual properties (match stinger/sidebar randomization pattern)
      bar.isWhite = Math.random() > 0.7; // 30% white bars

      if (type === 'slanted') {
        // Slanted bars (vertical bars with rotation)

        // Position within curtain area (X position random across curtain width)
        bar.x = Math.random() * this.canvas.width;

        // Angle matches stinger pattern
        bar.angle = config.stinger.slanted.angle; // 15 degrees clockwise

        // Width varies by color (white bars smaller, colored bars larger)
        if (bar.isWhite) {
          bar.hue = 0;
          bar.saturation = 0;
          bar.lightness = 100 * config.shade.brightness;
          bar.width = Math.random() * (config.stinger.slanted.whiteBarWidthMax - config.stinger.slanted.whiteBarWidthMin)
                    + config.stinger.slanted.whiteBarWidthMin; // 40-120px
        } else {
          // Colored bar with randomized hue variation
          const hueVariation = (Math.random() - 0.5) * config.stinger.color.hueVariation; // ±20 from base
          const lightnessVariation = (Math.random() - 0.5) * config.stinger.color.lightnessVariation; // ±15 from base

          bar.hue = (this.baseHSL.h + hueVariation + 360) % 360;
          bar.saturation = this.baseHSL.s;
          const baseLightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
          bar.lightness = Math.max(10, baseLightness * config.shade.brightness);
          bar.width = Math.random() * (config.stinger.slanted.coloredBarWidthMax - config.stinger.slanted.coloredBarWidthMin)
                    + config.stinger.slanted.coloredBarWidthMin; // 150-450px
        }

        // Make bars much taller than curtain area to prevent ends from showing
        // Use 2x full canvas height to ensure ends are never visible
        bar.height = this.canvas.height * 2.0; // Double canvas height for maximum safety

        // Y position: Position bars so their ends are NEVER visible on screen
        // DrawBar renders with 30% above y and 70% below y (see AnimatedBar.js line 220)
        // Top curtain: position y so that the top 30% extends well above screen
        // Bottom curtain: position y so that the bottom 70% extends well below screen
        if (this.position === 'top') {
          // Position at canvas top (y=0) so 30% of bar extends above screen (offscreen)
          // and 70% covers the entire canvas height (2.0 * height * 0.7 = 1.4 * canvas.height)
          bar.y = 0;
        } else {
          // Apply negative margin to shift bars upward in bottom curtain
          // This positions the visible 30% portion better within the bottom curtain area
          // Shift up by 20% of bar height (0.2 * 2.0 * canvas.height = 0.4 * canvas.height)
          const upwardShift = bar.height * 0.2;
          bar.y = this.canvas.height - upwardShift;
        }

        // Speed for horizontal movement (traverse canvas width in 2-4 seconds like StingerBar)
        const totalTraversalDistance = this.canvas.width + bar.width + 400; // Full screen + bar width + buffers
        bar.speed = totalTraversalDistance / (2 + Math.random() * 2);

      } else {
        // Horizontal bars (original pattern)

        // Position within curtain area
        if (this.position === 'top') {
          // Top curtain: y from 0 to canvas.height/2 + overshoot
          bar.y = (i / barCount) * this.targetHeight;
        } else {
          // Bottom curtain: y from canvas.height/2 - overshoot to canvas.height
          bar.y = (this.canvas.height / 2 - this.overshoot) + (i / barCount) * this.targetHeight;
        }

        // Skew angle (matches stinger pattern)
        bar.skew = config.stinger.horizontal.skewAngle; // -15 degrees

        // Height varies by color (white bars smaller, colored bars larger)
        if (bar.isWhite) {
          bar.hue = 0;
          bar.saturation = 0;
          bar.lightness = 100 * config.shade.brightness;
          bar.height = Math.random() * (config.stinger.horizontal.whiteBarHeightMax - config.stinger.horizontal.whiteBarHeightMin)
                     + config.stinger.horizontal.whiteBarHeightMin; // 20-50px
        } else {
          // Colored bar with randomized hue variation
          const hueVariation = (Math.random() - 0.5) * config.stinger.color.hueVariation; // ±20 from base
          const lightnessVariation = (Math.random() - 0.5) * config.stinger.color.lightnessVariation; // ±15 from base

          bar.hue = (this.baseHSL.h + hueVariation + 360) % 360;
          bar.saturation = this.baseHSL.s;
          const baseLightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
          bar.lightness = Math.max(10, baseLightness * config.shade.brightness);
          bar.height = Math.random() * (config.stinger.horizontal.coloredBarHeightMax - config.stinger.horizontal.coloredBarHeightMin)
                     + config.stinger.horizontal.coloredBarHeightMin; // 40-100px
        }

        // Width is full canvas width (horizontal bar extends across screen)
        // Add 400px buffer (200px on each side) to prevent visible edges
        bar.width = this.canvas.width + 400;

        // Start offscreen (direction determines which side)
        // Horizontal bars are drawn with fillRect(0, ..., width, ...) meaning bar extends from x to x+width
        // Moving right (dir=1): start with right edge at x=0 (fully offscreen left)
        // Moving left (dir=-1): start with left edge at x=canvas.width (fully offscreen right)
        bar.x = bar.direction === 1 ? -bar.width : this.canvas.width;

        // Speed to traverse canvas in 2-3 seconds
        bar.speed = (this.canvas.width + 400) / (2 + Math.random());
      }

      // Opacity variation (match stinger/sidebar pattern)
      bar.opacity = Math.random() * (config.stinger.opacity.max - config.stinger.opacity.min)
                  + config.stinger.opacity.min; // 0.6-1.0

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
      if (bar.type === 'slanted') {
        // Slanted bars move horizontally (left or right depending on direction)
        // Like StingerBar slanted bars, they traverse the canvas width
        bar.x += bar.speed * bar.direction * deltaTime;

        // Wrap around when bar completely exits screen horizontally
        // Slanted bars are drawn with rotation, need to account for bar width
        // Moving right (direction 1): wrap when bar center exceeds right edge + buffer
        if (bar.direction === 1 && bar.x - bar.width/2 > this.canvas.width + 200) {
          bar.x = -bar.width/2 - 200; // Reset to fully offscreen left
        }
        // Moving left (direction -1): wrap when bar center goes past left edge - buffer
        else if (bar.direction === -1 && bar.x + bar.width/2 < -200) {
          bar.x = this.canvas.width + bar.width/2 + 200; // Reset to fully offscreen right
        }
      } else {
        // Horizontal bars move left or right
        bar.x += bar.speed * bar.direction * deltaTime;

        // Wrap around when bar fully exits screen
        // Bar is drawn from x to x+width (fillRect at translate x)
        // Moving right (direction 1): wrap when LEFT edge (x) exceeds right screen edge
        // Add buffer (+200px) to ensure bar is completely offscreen before wrapping
        if (bar.direction === 1 && bar.x > this.canvas.width + 200) {
          bar.x = -bar.width - 200; // Reset to fully offscreen left (right edge at x=-200)
        }
        // Moving left (direction -1): wrap when RIGHT edge (x+width) goes past left screen edge
        // Subtract buffer (-200px) to ensure bar is completely offscreen before wrapping
        else if (bar.direction === -1 && bar.x + bar.width < -200) {
          bar.x = this.canvas.width + 200; // Reset to fully offscreen right (left edge at canvas.width+200)
        }
      }
    });
  }

  /**
   * Draw solid color tip for text readability
   *
   * Tips are solid color rectangles at the edge of each curtain that create
   * a solid background for the text when curtains meet at center.
   *
   * Top curtain: tip at bottom edge
   * Bottom curtain: tip at top edge
   */
  drawTip() {
    this.ctx.save();

    // Solid color (no transparency - opacity 1.0)
    this.ctx.globalAlpha = 1.0;

    // Use base color with brightness adjustment (same as curtain gradient start)
    const tipLightness = this.baseHSL.l * config.shade.brightness;
    this.ctx.fillStyle = `hsl(${this.baseHSL.h}, ${this.baseHSL.s}%, ${tipLightness}%)`;

    // Calculate tip position based on curtain position
    if (this.position === 'top') {
      // Top curtain: tip at bottom edge of curtain
      const tipY = this.y + this.targetHeight - this.tipHeight;
      this.ctx.fillRect(0, tipY, this.canvas.width, this.tipHeight);
    } else {
      // Bottom curtain: tip at top edge of curtain
      const tipY = this.y;
      this.ctx.fillRect(0, tipY, this.canvas.width, this.tipHeight);
    }

    this.ctx.restore();
  }

  /**
   * Draw curtain with semi-transparent gradient fill and clipped bars
   *
   * Drawing order:
   * 1. Semi-transparent gradient rectangle (curtain background)
   * 2. Horizontal bars clipped to curtain's current visible area
   * 3. Solid color tip for text readability (drawn last, on top)
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
      // Note: this.y already accounts for overshoot (canvas.height/2 - overshoot)
      const clipY = Math.max(this.y, this.canvas.height / 2 - this.overshoot);
      const clipHeight = this.canvas.height - clipY;
      this.ctx.rect(0, clipY, this.canvas.width, clipHeight);
    }

    this.ctx.clip();

    // Draw bars using AnimatedBar's drawBar method
    this.bars.forEach(bar => {
      // Use angle for slanted bars, skew for horizontal bars
      const angleOrSkew = bar.type === 'slanted' ? bar.angle : bar.skew;

      // AnimatedBar.drawBar checks this.type to determine rotation vs skew
      // Temporarily set type to match the bar being drawn
      const savedType = this.type;
      this.type = bar.type;

      this.drawBar(
        bar.x,
        bar.y,
        bar.width,
        bar.height,
        bar.hue,
        bar.saturation,
        bar.lightness,
        bar.opacity,
        angleOrSkew,
        true // withShadow
      );

      // Restore original type
      this.type = savedType;
    });

    this.ctx.restore();

    // Draw solid color tip (on top of everything - for text readability)
    this.drawTip();
  }
}
