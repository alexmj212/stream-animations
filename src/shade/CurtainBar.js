import { AnimatedBar } from '../shared/AnimatedBar.js';
import { config } from '../config/config.js';
import { hermite } from '../shared/motion.js';
import { samplePalette, shadeStops, paletteGradient } from '../shared/palette.js';

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
   * @param {Array|null} [options.palette] - palette stops (src/shared/palette.js);
   *   null keeps the single-hue look around baseHSL
   */
  constructor(ctx, canvas, position, baseHSL, totalDurationMs, options = {}) {
    super(ctx, canvas, 'curtain', options);

    this.position = position;
    this.baseHSL = baseHSL;
    this.totalDurationMs = totalDurationMs;
    this.palette = options.palette ?? null;

    // Curtain visual properties (CONTEXT: 0.4-0.6 range, choose middle)
    this.opacity = 0.5;

    if (this.palette) {
      // Screen-fixed palette, like the ball: the curtain body shows the
      // part of the gradient it covers, and the text band behind the text
      // takes the color at the centerline, where both tips meet.
      const b = config.shade.brightness;
      this._bodyFill = paletteGradient(ctx, shadeStops(this.palette, { dl: config.palette.bodyLightness, brightness: b, floor: 10 }),
        [0, 0, 0, canvas.height], this.opacity);
      const tip = samplePalette(shadeStops(this.palette, { dl: config.palette.tipLightness, brightness: b, floor: 12 }), 0.5);
      this._tipFill = `hsl(${tip.h}, ${tip.s}%, ${tip.l}%)`;
    }

    // Overshoot: curtains extend slightly past center to guarantee no gap between tips
    this.overshoot = 4; // 4 pixels past center (8px total overlap between curtains)
    this.targetHeight = canvas.height / 2 + this.overshoot; // Covers 50% + overshoot

    // Tip properties: dedicated solid-color band behind the text. Sized so the
    // combined band (top tip + bottom tip) gives the 96px text ~80px of vertical
    // breathing room, room for the 8px shadow blur, and clear separation from
    // the animated bars in the curtain body above/below.
    this.textHeight = options.textHeight || 96;
    this.tipHeight = this.textHeight * 0.95;

    // Animation state (three phases like stinger pattern)
    this.phase = 'enter'; // 'enter' | 'hold' | 'exit'
    this.elapsedTime = 0;
    this.phaseStartTime = 0;

    // Phase durations (milliseconds to seconds for update() calculations)
    const share = config.shade.curtainMoveShare;
    this.enterDuration = config.shade.durations.entryMs * share / 1000;
    this.exitDuration = config.shade.durations.exitMs * share / 1000;

    // Hold fills the rest, so the curtains still end at totalDurationMs
    this.holdDuration = totalDurationMs / 1000 - this.enterDuration - this.exitDuration;

    // Initial position (offscreen)
    if (position === 'top') {
      this.startY = -this.targetHeight; // Start above viewport
      this.targetY = 0; // End at top edge (curtain extends down past center)
    } else {
      this.startY = canvas.height; // Start below viewport
      this.targetY = canvas.height / 2 - this.overshoot; // End before centerline (overlap with top)
    }

    this.y = this.startY; // Current Y position

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
      const type = this.random() > 0.6 ? 'slanted' : 'horizontal';

      const bar = {
        type: type,
        direction: this.random() > 0.5 ? 1 : -1, // Both L-R and R-L (or up-down for slanted)
      };

      // Visual properties (match stinger/sidebar randomization pattern)
      bar.isWhite = this.random() > 0.7; // 30% white bars

      if (type === 'slanted') {
        // Slanted bars (vertical bars with rotation)

        // Position within curtain area (X position random across curtain width)
        bar.x = this.random() * this.canvas.width;

        // Angle matches stinger pattern
        bar.angle = config.stinger.slanted.angle; // 15 degrees clockwise

        // Width varies by color (white bars smaller, colored bars larger)
        if (bar.isWhite) {
          bar.hue = 0;
          bar.saturation = 0;
          bar.lightness = 100 * config.shade.brightness;
          bar.width = this.random() * (config.stinger.slanted.whiteBarWidthMax - config.stinger.slanted.whiteBarWidthMin)
                    + config.stinger.slanted.whiteBarWidthMin; // 40-120px
        } else {
          // Colored bar with randomized hue variation
          const hueVariation = (this.random() - 0.5) * config.stinger.color.hueVariation; // ±20 from base
          const lightnessVariation = (this.random() - 0.5) * config.stinger.color.lightnessVariation; // ±15 from base
          bar.dl = lightnessVariation;

          bar.hue = (this.baseHSL.h + hueVariation + 360) % 360;
          bar.saturation = this.baseHSL.s;
          const baseLightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
          bar.lightness = Math.max(10, baseLightness * config.shade.brightness);
          bar.width = this.random() * (config.stinger.slanted.coloredBarWidthMax - config.stinger.slanted.coloredBarWidthMin)
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
        bar.speed = totalTraversalDistance / (2 + this.random() * 2);

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
          bar.height = this.random() * (config.stinger.horizontal.whiteBarHeightMax - config.stinger.horizontal.whiteBarHeightMin)
                     + config.stinger.horizontal.whiteBarHeightMin; // 20-50px
        } else {
          // Colored bar with randomized hue variation
          const hueVariation = (this.random() - 0.5) * config.stinger.color.hueVariation; // ±20 from base
          const lightnessVariation = (this.random() - 0.5) * config.stinger.color.lightnessVariation; // ±15 from base
          bar.dl = lightnessVariation;

          bar.hue = (this.baseHSL.h + hueVariation + 360) % 360;
          bar.saturation = this.baseHSL.s;
          const baseLightness = Math.max(20, Math.min(80, this.baseHSL.l + lightnessVariation));
          bar.lightness = Math.max(10, baseLightness * config.shade.brightness);
          bar.height = this.random() * (config.stinger.horizontal.coloredBarHeightMax - config.stinger.horizontal.coloredBarHeightMin)
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
        bar.speed = (this.canvas.width + 400) / (2 + this.random());
      }

      // Opacity variation (match stinger/sidebar pattern)
      bar.opacity = this.random() * (config.stinger.opacity.max - config.stinger.opacity.min)
                  + config.stinger.opacity.min; // 0.6-1.0

      bar.x0 = bar.x;
      if (this.palette && !bar.isWhite) this.applyBarPalette(bar, bar.dl);
      this.bars.push(bar);
    }
  }

  /**
   * Palette colors for an inner bar (same spread as the single-hue look):
   * slanted bars carry the screen-fixed gradient, horizontal bars take the
   * palette color at their height.
   * @param {Object} bar
   * @param {number} dl - the bar's lightness offset
   */
  applyBarPalette(bar, dl) {
    const shaded = shadeStops(this.palette, { dl, brightness: config.shade.brightness, floor: 10 });
    const c = samplePalette(shaded, bar.type === 'slanted' ? 0.5 : bar.y / this.canvas.height);
    bar.hue = c.h;
    bar.saturation = c.s;
    bar.lightness = c.l;
    bar.paletteStops = bar.type === 'slanted' ? shaded : null;
  }

  /**
   * Curtain position at time t (seconds since start). The curtain arrives
   * fast and settles (leaves at 2x average speed, lands at rest), holds still,
   * then accelerates away - velocity is zero at both hold boundaries, so the
   * hand-offs are seamless.
   */
  curtainYAt(t) {
    if (t < this.enterDuration) {
      const d = this.enterDuration;
      return hermite(this.startY, this.targetY, 2 * (this.targetY - this.startY) / d, 0, d, t);
    }
    const exitStart = this.enterDuration + this.holdDuration;
    if (t < exitStart) return this.targetY;
    const d = this.exitDuration;
    return hermite(this.targetY, this.startY, 0, 2 * (this.startY - this.targetY) / d, d, t - exitStart);
  }

  /**
   * Inner bar x at time t: constant speed with wrap-around, computed in
   * closed form from the bar's spawn position so it never drifts.
   */
  barXAt(bar, t) {
    const W = this.canvas.width;
    if (bar.type === 'slanted') {
      // Wrap range: center from -width/2-200 to W+width/2+200
      const lo = -bar.width / 2 - 200;
      const span = W + bar.width + 400;
      const raw = bar.x0 + bar.speed * bar.direction * t - lo;
      return lo + ((raw % span) + span) % span;
    }
    // Horizontal: left edge from -width-200 to W+200
    const lo = -bar.width - 200;
    const span = W + bar.width + 400;
    const raw = bar.x0 + bar.speed * bar.direction * t - lo;
    return lo + ((raw % span) + span) % span;
  }

  /** Set absolute time (seconds) - preferred over update() */
  setTime(t) {
    this.elapsedTime = t;
    const exitStart = this.enterDuration + this.holdDuration;
    if (t >= exitStart + this.exitDuration) {
      this.active = false;
      this.y = this.startY;
      return;
    }
    this.phase = t < this.enterDuration ? 'enter' : t < exitStart ? 'hold' : 'exit';
    this.y = this.curtainYAt(t);
    for (const bar of this.bars) bar.x = this.barXAt(bar, t);
  }

  /**
   * Advance by deltaTime seconds (kept for callers/tests; setTime is exact)
   * @param {number} deltaTime - Time elapsed since last frame in seconds
   */
  update(deltaTime) {
    if (!this.active) return;
    this.setTime(this.elapsedTime + deltaTime);
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

    // Tip is darkened relative to the curtain body so it reads as a dedicated
    // text band rather than a continuation of the curtain. Floor at 12 so it
    // doesn't go fully black on already-dark base colors.
    if (this._tipFill) {
      this.ctx.fillStyle = this._tipFill;
    } else {
      const tipLightness = Math.max(12, (this.baseHSL.l - 18) * config.shade.brightness);
      this.ctx.fillStyle = `hsl(${this.baseHSL.h}, ${this.baseHSL.s}%, ${tipLightness}%)`;
    }

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
   * Uses hsla() colors with opacity baked in for GPU efficiency (PERF-03).
   * Uses ctx.save/restore for clipping region isolation.
   */
  draw() {
    if (!this.active) return;

    // Draw curtain fill (semi-transparent gradient)
    this.ctx.save();

    if (this._bodyFill) {
      this.ctx.fillStyle = this._bodyFill;
    } else {
      // Gradient fill using baseHSL (matches stinger/sidebar pattern)
      const gradient = this.ctx.createLinearGradient(0, this.y, 0, this.y + this.targetHeight);

      // Apply brightness multiplier to lightness
      const baseLightness = this.baseHSL.l * config.shade.brightness;
      const endLightness = Math.max(10, (this.baseHSL.l - 20) * config.shade.brightness);

      // PERF-03: Use hsla() colors with opacity baked in for GPU efficiency
      // This allows GPU to optimize premultiplied alpha compositing
      gradient.addColorStop(0, `hsla(${this.baseHSL.h}, ${this.baseHSL.s}%, ${baseLightness}%, ${this.opacity})`);
      gradient.addColorStop(1, `hsla(${this.baseHSL.h}, ${this.baseHSL.s}%, ${endLightness}%, ${this.opacity})`);
      this.ctx.fillStyle = gradient;
    }
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
      // Each inner bar keeps its own gradient cache. They used to share the
      // curtain's single cache (keyed only by width), so bars of different
      // colors/types reused each other's gradient or rebuilt it every frame.
      const savedType = this.type;
      this.type = bar.type;
      this._gradient = bar._gradient;
      this._gradientKey = bar._gradientKey;
      this._gradientFlip = bar._gradientFlip;
      this.paletteStops = bar.paletteStops;

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

      bar._gradient = this._gradient;
      bar._gradientKey = this._gradientKey;
      bar._gradientFlip = this._gradientFlip;

      // Restore original type
      this.type = savedType;
    });

    this.ctx.restore();

    // Draw solid color tip (on top of everything - for text readability)
    this.drawTip();
  }
}
