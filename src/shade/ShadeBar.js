import { AnimatedBar } from '../shared/AnimatedBar.js';
import { config } from '../config/config.js';
import {
  cubicBezier, readingHoldMs, planAlertText, textOffsetAt, fitShadeText, strokeWidthPx, wordCount
} from '../shared/animations/alertText.js';

const easeEnter = cubicBezier(config.design.motion.ease.enter);
const easeExit = cubicBezier(config.design.motion.ease.exit);

/**
 * '#rrggbb' at an alpha, as rgba()
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * ShadeBar - the shade's line of text (raids, hype train, mass gifts)
 *
 * The text arrives on `ease.enter` while the curtains close, settles, holds
 * still and whole inside title-safe for its reading time, then leaves on
 * `ease.exit` before the curtains open (docs/DESIGN.md MOTION-1, TIME-1,
 * SAFE-1; AJ's pick on design audit #33). It never scrolls: a long line
 * shrinks from `hero` to `display`, then wraps to two lines.
 *
 * Drawn once into an offscreen canvas with the TYPE-3 ink stroke and shadow,
 * then copied each frame.
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
    return readingHoldMs(text, msPerWord, minDurationMs);
  }

  /**
   * The shade's timeline for a hold: text enter, settle, hold, text exit,
   * then the curtains opening (seconds).
   * @param {number} holdDurationMs
   * @returns {ReturnType<typeof planAlertText>}
   */
  static plan(holdDurationMs) {
    const { durationMs, settleMs } = config.design.motion;
    return planAlertText({
      holdMs: holdDurationMs,
      enterMs: durationMs.enter,
      settleMs,
      exitMs: durationMs.exit,
      tailMs: config.shade.curtainMoveMs
    });
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
    this.words = wordCount(text);

    // Calculate hold duration if not provided via URL parameter
    this.holdDurationMs = holdDurationMs !== null
      ? holdDurationMs
      : ShadeBar.calculateHoldDuration(text);
    this.timeline = ShadeBar.plan(this.holdDurationMs);
    this.totalDurationMs = this.timeline.total * 1000;

    // Block position: x is the left edge of the widest line, y the top of
    // the ink (both set in init() once the text is measured)
    this.x = canvas.width;
    this.y = canvas.height / 2;

    // Curtains behind the text; when clipping, text is only drawn over them
    this.curtains = [];
    this.clipToCurtains = config.shade.clipTextToCurtains;

    // Layout (measured after the font loads, in init())
    this.lines = [text];
    this.fontPx = config.design.type.sizes.hero;
    this.textWidth = 0;
    this.blockHeight = 0;
    this.holdX = 0;

    this.textCanvas = null;
    this.pad = 0;
    this.totalAnimationTime = 0;
  }

  /** Canvas font for a size. */
  static font(px) {
    return `${config.design.type.weight} ${px}px ${config.design.type.family}`;
  }

  /**
   * Initialize ShadeBar after font loading
   *
   * IMPORTANT: Must be called AFTER document.fonts.ready resolves to ensure
   * accurate text measurement.
   */
  async init() {
    const type = config.design.type;
    try {
      await document.fonts.load(ShadeBar.font(type.sizes.hero));
    } catch (e) {
      console.warn('[ShadeBar] Font load warning:', e);
    }

    const W = this.canvas.width;
    const H = this.canvas.height;
    const ctx = this.ctx;
    const setFont = (c, px) => {
      c.font = ShadeBar.font(px);
      c.letterSpacing = `${type.trackingEm * px}px`;
    };
    const measure = (s, px) => {
      setFont(ctx, px);
      return ctx.measureText(s).width;
    };

    // Fit inside title-safe, leaving room for the stroke on both sides
    const safeX = Math.round(W * config.design.safe.titleInset);
    const room = (px) => W - 2 * safeX - 2 * strokeWidthPx(px, type);
    const fit = fitShadeText(this.text, measure, room(type.sizes.display), {
      hero: type.sizes.hero, display: type.sizes.display, minPx: type.minPx
    });
    this.lines = fit.lines;
    this.fontPx = fit.px;
    const px = fit.px;

    // Line metrics: the block is the ink from the first line's ascent to
    // the last line's descent, centred on the band
    setFont(ctx, px);
    const metrics = this.lines.map(s => ctx.measureText(s));
    this.textWidth = Math.max(...metrics.map(m => m.width));
    const lineGap = px * config.shade.text.lineHeight;
    const ascent = metrics[0].actualBoundingBoxAscent || px * 0.7;
    const descent = metrics[metrics.length - 1].actualBoundingBoxDescent || px * 0.05;
    this.actualAscent = ascent;
    this.blockHeight = ascent + lineGap * (this.lines.length - 1) + descent;
    this.y = H / 2 - this.blockHeight / 2;
    this.holdX = (W - this.textWidth) / 2;

    // Offscreen copy: stroke (with the soft shadow) under the fill
    const stroke = strokeWidthPx(px, type);
    const shadowOffset = px * type.shadowOffsetEm;
    const shadowBlur = px * type.shadowBlurEm;
    this.pad = Math.ceil(stroke + shadowOffset + shadowBlur * 2 + 4);
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = Math.ceil(this.textWidth + 2 * this.pad);
    this.textCanvas.height = Math.ceil(this.blockHeight + 2 * this.pad);
    const off = this.textCanvas.getContext('2d', { alpha: true });
    setFont(off, px);
    off.textAlign = 'center';
    off.textBaseline = 'alphabetic';
    off.lineJoin = 'round';
    const ink = config.design.color.ink;
    const cx = this.pad + this.textWidth / 2;
    const baseline = (i) => this.pad + ascent + i * lineGap;
    off.strokeStyle = ink;
    off.lineWidth = stroke * 2; // Half of it sits under the fill
    off.shadowColor = rgba(ink, type.shadowAlpha);
    off.shadowBlur = shadowBlur;
    off.shadowOffsetX = shadowOffset;
    off.shadowOffsetY = shadowOffset;
    this.lines.forEach((s, i) => off.strokeText(s, cx, baseline(i)));
    off.shadowColor = 'transparent';
    off.fillStyle = config.shade.text.color;
    this.lines.forEach((s, i) => off.fillText(s, cx, baseline(i)));

    // Arrive from the right edge, leave past the left edge
    this.inPx = W - this.holdX + this.pad;
    this.outPx = -(this.holdX + this.textWidth + this.pad);
    this.x = this.holdX + this.inPx;
  }

  /**
   * Advance by deltaTime seconds (kept for callers/tests; setTime is exact)
   * @param {number} deltaTime - Time elapsed since last frame in seconds
   */
  update(deltaTime) {
    this.setTime(this.totalAnimationTime + deltaTime);
  }

  /**
   * Set absolute time (seconds). Position is a pure function of time, so
   * the text lands on its marks regardless of frame timing.
   */
  setTime(t) {
    this.totalAnimationTime = t;
    if (t >= this.timeline.exitEnd) {
      this.active = false;
      this.x = this.holdX + this.outPx;
      return;
    }
    this.x = this.positionAt(t);
  }

  /** Left edge of the block at time t (seconds). */
  positionAt(t) {
    return this.holdX + textOffsetAt(this.timeline, this.inPx, this.outPx, easeEnter, easeExit, t);
  }

  /** The drawn ink box (screen px), for the probe and the harness. */
  box() {
    return { x: this.x, y: this.y, width: this.textWidth, height: this.blockHeight };
  }

  /**
   * Fraction of the text's height drawn with no curtain behind it (0 while
   * the text is off screen). Used by the motion harness to check that the
   * text never sits bare over the game.
   */
  bareFraction() {
    if (!this.active || this.x >= this.canvas.width || this.x + this.textWidth <= 0) return 0;
    const top = Math.floor(this.y);
    const bottom = Math.ceil(this.y + this.blockHeight);
    const curtains = this.curtains.filter(c => c.active);
    let bare = 0;
    for (let row = top; row < bottom; row++) {
      const covered = curtains.some(c => row >= c.y && row < c.y + c.targetHeight);
      // With clipping on, uncovered rows aren't drawn at all
      if (!covered && !this.clipToCurtains) bare++;
    }
    return bottom > top ? bare / (bottom - top) : 0;
  }

  draw() {
    if (!this.active || !this.textCanvas) return;
    this.ctx.save();

    // Only show text where a curtain is behind it, so it never sits bare
    // over the game while the band opens or closes
    if (this.clipToCurtains) {
      this.ctx.beginPath();
      for (const c of this.curtains) {
        if (c.active) this.ctx.rect(0, c.y, this.canvas.width, c.targetHeight);
      }
      this.ctx.clip();
    }

    // Whole pixels: the cached text stays crisp while it holds
    this.ctx.drawImage(this.textCanvas, Math.round(this.x - this.pad), Math.round(this.y - this.pad));

    this.ctx.restore();
  }
}
