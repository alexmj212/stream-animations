import { LRUCache } from './cache.js';
import { config } from '../config/config.js';
import { samplePalette, shadeStops, screenGradientLine, paletteGradient } from './palette.js';

/**
 * Base class for animated bars used across all animations
 */
export class AnimatedBar {
    // Static cache for offscreen canvases (shared across all instances)
    static offscreenCache = new LRUCache(config.shared.cache.maxSize);
    static cacheCleanupInterval = null;

    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {string} type - Bar type ('slanted' or 'horizontal')
     * @param {Object} options - Optional configuration
     * @param {Function} options.random - Random number generator (default: Math.random)
     */
    constructor(ctx, canvas, type, options = {}) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.type = type;
        this.active = true;
        this.random = options.random || Math.random.bind(Math);
        this.useOffscreenCache = false; // Will be set to true for white bars

        // Initialize cache cleanup on first instance
        AnimatedBar.initializeCache();
    }

    /**
     * Initialize cache cleanup interval (called once on first instance)
     */
    static initializeCache() {
        // Setup periodic cache cleanup if not already running
        if (!AnimatedBar.cacheCleanupInterval) {
            AnimatedBar.cacheCleanupInterval = setInterval(() => {
                AnimatedBar.offscreenCache.evictStale(config.shared.cache.maxAgeMs);

                // Log cache stats in dev mode only
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('perf') === 'true') {
                    console.log(`[Cache] Size: ${AnimatedBar.offscreenCache.size}/${config.shared.cache.maxSize}`);
                }
            }, config.shared.cache.evictionIntervalMs);
        }
    }

    /**
     * Cubic easing function
     * @param {number} t - Progress value 0-1
     * @returns {number} Eased value
     */
    easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * Create or retrieve offscreen canvas for a specific bar configuration
     * @param {number} width - Bar width
     * @param {number} height - Bar height
     * @param {number} hue - HSL hue
     * @param {number} saturation - HSL saturation
     * @param {number} lightness - HSL lightness
     * @param {number} angle - Rotation angle (slanted) or skew angle (horizontal)
     * @param {boolean} withShadow - Whether to include shadow
     * @returns {HTMLCanvasElement} Offscreen canvas with pre-rendered bar
     */
    getOrCreateOffscreenCanvas(width, height, hue, saturation, lightness, angle, withShadow) {
        // Create cache key based on visual properties
        const cacheKey = `${this.type}_${Math.round(width)}_${Math.round(height)}_${hue}_${saturation}_${lightness}_${angle}_${withShadow}`;

        if (AnimatedBar.offscreenCache.has(cacheKey)) {
            return AnimatedBar.offscreenCache.get(cacheKey);
        }

        // Create new offscreen canvas
        const offscreenCanvas = document.createElement('canvas');
        const padding = withShadow ? 10 : 0; // Extra space for shadow

        if (this.type === 'slanted') {
            // For slanted bars, we need enough space for rotation
            const diagonal = Math.sqrt(width * width + height * height);
            offscreenCanvas.width = Math.ceil(diagonal + padding * 2);
            offscreenCanvas.height = Math.ceil(diagonal + padding * 2);
        } else {
            // For horizontal bars with skew, calculate bounds including skew extension
            const skewExtension = Math.abs(Math.tan(angle * Math.PI / 180) * height);
            offscreenCanvas.width = Math.ceil(width + skewExtension + padding * 2);
            offscreenCanvas.height = Math.ceil(height + padding * 2);
        }

        const offCtx = offscreenCanvas.getContext('2d', { alpha: true });
        const centerX = offscreenCanvas.width / 2;
        const centerY = offscreenCanvas.height / 2;

        // Draw shadow if needed
        if (withShadow) {
            offCtx.save();
            offCtx.globalAlpha = 0.2;
            offCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';

            if (this.type === 'slanted') {
                offCtx.translate(centerX + 5, centerY + 5);
                offCtx.rotate((angle * Math.PI) / 180);
                offCtx.fillRect(-width / 2, -height / 2, width, height);
            } else {
                offCtx.translate(centerX + 5, centerY + 5);
                offCtx.transform(1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0);
                offCtx.fillRect(-width / 2, -height / 2, width, height);
            }
            offCtx.restore();
        }

        // Draw main bar
        offCtx.save();

        // Apply gradient for colored bars, solid for white bars
        if (saturation > 0) {
            // Create left-to-right gradient (darker to lighter)
            const gradient = offCtx.createLinearGradient(-width / 2, 0, width / 2, 0);
            const darkerLightness = Math.max(0, lightness - 15);
            const lighterLightness = Math.min(100, lightness + 15);
            gradient.addColorStop(0, `hsl(${hue}, ${saturation}%, ${darkerLightness}%)`);
            gradient.addColorStop(1, `hsl(${hue}, ${saturation}%, ${lighterLightness}%)`);
            offCtx.fillStyle = gradient;
        } else {
            offCtx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        }

        if (this.type === 'slanted') {
            offCtx.translate(centerX, centerY);
            offCtx.rotate((angle * Math.PI) / 180);
            offCtx.fillRect(-width / 2, -height / 2, width, height);
        } else {
            offCtx.translate(centerX, centerY);
            offCtx.transform(1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0);
            offCtx.fillRect(-width / 2, -height / 2, width, height);
        }
        offCtx.restore();

        // Cache it
        AnimatedBar.offscreenCache.set(cacheKey, offscreenCanvas);

        return offscreenCanvas;
    }

    /**
     * Draw bar with common properties
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Bar width
     * @param {number} height - Bar height
     * @param {number} hue - HSL hue
     * @param {number} saturation - HSL saturation
     * @param {number} lightness - HSL lightness
     * @param {number} opacity - Opacity 0-1
     * @param {number} angle - Rotation angle (slanted) or skew angle (horizontal)
     * @param {boolean} withShadow - Whether to draw drop shadow
     */
    drawBar(x, y, width, height, hue, saturation, lightness, opacity, angle, withShadow = true) {
        // Round coordinates to integers to avoid sub-pixel rendering
        x = Math.round(x);
        y = Math.round(y);

        const ctx = this.ctx;

        // Use offscreen canvas cache for better performance (typically for white bars)
        if (this.useOffscreenCache) {
            ctx.save();

            // Draw shadow separately (not cached) to support varying opacity.
            // Single save/restore around both passes; resetTransform between to
            // avoid the second translate/transform compounding on the first.
            if (withShadow) {
                ctx.globalAlpha = opacity * 0.2;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.translate(x + 5, y + 5);
                ctx.transform(1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0);
                ctx.fillRect(0, -height / 2, width, height);
                ctx.resetTransform();
            }

            // Get cached bar shape (without shadow)
            const offscreenCanvas = this.getOrCreateOffscreenCanvas(width, height, hue, saturation, lightness, angle, false);

            // The cached bar is centered in its offscreen canvas; shift it so
            // its left edge lands on x, exactly like the uncached path below
            // (which draws from x rightwards). Previously the image was
            // centered on x, so cached white bars sat width/2 left of where
            // their own shadow and every other bar's coordinates put them.
            ctx.globalAlpha = opacity;
            ctx.drawImage(
                offscreenCanvas,
                x + width / 2 - offscreenCanvas.width / 2,
                y - offscreenCanvas.height / 2
            );

            ctx.restore();
            return;
        }

        // Non-cached path: shadow + gradient bar in a single save/restore.
        ctx.save();

        if (withShadow) {
            ctx.globalAlpha = opacity * 0.2;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';

            if (this.type === 'slanted') {
                ctx.translate(x + 5, y + 5);
                ctx.rotate((angle * Math.PI) / 180);
                const minHeight = this.canvas.height * 1.5;
                ctx.fillRect(0, -minHeight * 0.3, width, minHeight);
            } else {
                ctx.translate(x + 5, y + 5);
                ctx.transform(1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0);
                ctx.fillRect(0, -height / 2, width, height);
            }

            // Drop the shadow's transform before drawing the main bar (cheaper
            // than save/restore pair).
            ctx.resetTransform();
        }

        // Draw main bar
        ctx.globalAlpha = opacity;

        if (saturation > 0) {
            ctx.fillStyle = this._getGradient(width, hue, saturation, lightness, y, angle);
        } else {
            ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        }

        if (this.type === 'slanted') {
            ctx.translate(x, y);
            ctx.rotate((angle * Math.PI) / 180);
            const minHeight = this.canvas.height * 1.5;
            ctx.fillRect(0, -minHeight * 0.3, width, minHeight);
            if (this.edgeLight) {
                // Thin lit edge along the bar's leading side: reads as a
                // specular rim and gives overlapping bars crisp separation.
                ctx.fillStyle = this._edgeStyle(hue, saturation, lightness, y, angle);
                const w = Math.min(this.edgeLightWidth ?? 4, width / 4);
                ctx.fillRect(this.edgeLight === 'right' ? width - w : 0, -minHeight * 0.3, w, minHeight);
            }
        } else {
            ctx.translate(x, y);
            ctx.transform(1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0);
            ctx.fillRect(0, -height / 2, width, height);
            if (this.edgeLight) {
                ctx.fillStyle = this._edgeStyle(hue, saturation, lightness);
                const h = Math.min(this.edgeLightWidth ?? 3, height / 4);
                ctx.fillRect(0, this.edgeLight === 'bottom' ? height / 2 - h : -height / 2, width, h);
            }
        }

        ctx.restore();
    }

    _edgeStyle(hue, saturation, lightness, y = 0, angle = 0) {
        if (!this._edgeFill) {
            if (this.paletteStops && this.type === 'slanted') {
                // Same screen-fixed palette as the bar, lit the same way
                const lit = this.paletteStops.map(c => ({
                    h: c.h, s: Math.min(100, c.s + 10), l: Math.min(92, c.l + 28)
                }));
                this._edgeFill = paletteGradient(this.ctx, lit, screenGradientLine('slanted', angle, y, this.canvas.height), 0.85);
            } else {
                this._edgeFill = `hsla(${hue}, ${Math.min(100, saturation + 10)}%, ${Math.min(92, lightness + 28)}%, 0.85)`;
            }
        }
        return this._edgeFill;
    }

    /**
     * Color this bar from a palette (src/shared/palette.js) instead of one
     * hue. Slanted bars span the screen height, so they carry the whole
     * screen-fixed gradient; horizontal bars take the palette color at
     * their own height and keep the usual sheen along their length.
     * Sets hue/saturation/lightness either way, so callers that read them
     * (probes, the white-bar check) keep working.
     * @param {Array<{h:number,s:number,l:number}>} stops - top to bottom
     * @param {Object} shade - shadeStops() options (dl, ds, brightness, floor)
     */
    applyPalette(stops, shade) {
        const shaded = shadeStops(stops, shade);
        const H = this.canvas.height;
        const c = samplePalette(shaded, this.type === 'slanted' ? 0.5 : (this.y ?? H / 2) / H);
        this.hue = c.h;
        this.saturation = c.s;
        this.lightness = c.l;
        this.paletteStops = this.type === 'slanted' ? shaded : null;
        this._gradient = null;
        this._edgeFill = null;
    }

    /**
     * Exact axis-aligned bounds of what drawBar() paints (bar + drop shadow),
     * from the same transform drawBar uses. x is the bar's anchor (left edge
     * at its rotation/skew origin), not its center.
     */
    computeBounds(x, y, width, height, angle) {
        const rad = angle * Math.PI / 180;
        let corners;
        if (this.type === 'slanted') {
            const minHeight = this.canvas.height * 1.5;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            corners = [[0, -minHeight * 0.3], [width, -minHeight * 0.3], [0, minHeight * 0.7], [width, minHeight * 0.7]]
                .map(([lx, ly]) => [x + lx * cos - ly * sin, y + lx * sin + ly * cos]);
        } else {
            const tan = Math.tan(rad);
            corners = [[0, -height / 2], [width, -height / 2], [0, height / 2], [width, height / 2]]
                .map(([lx, ly]) => [x + lx + tan * ly, y + ly]);
        }
        const shadow = config.shared.shadow.offset;
        const xs = corners.map(c => c[0]);
        const ys = corners.map(c => c[1]);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return {
            x: minX,
            y: minY,
            width: Math.max(...xs) - minX + shadow,
            height: Math.max(...ys) - minY + shadow
        };
    }

    /**
     * Cache the bar's linear gradient. Hue/saturation/lightness are constant
     * per bar; width may animate (BackgroundBar.animateSize), so we rebuild
     * when the rounded width changes. Other scenes hit this cache 100%.
     *
     * Gradient runs along the bar's long axis (slanted: vertical in local
     * space — becomes diagonal after rotation; horizontal-skewed: along the
     * canvas-width axis), so each bar reads as if directionally lit. Per-bar
     * `_gradientFlip` swaps the dark/light ends so overlapping bars don't
     * all share a lighting direction. Sheen narrowed to ±8 (biased up by 2)
     * so colored bars never dip into muddy lightness territory.
     */
    _getGradient(width, hue, saturation, lightness, y = 0, angle = 0) {
        const w = Math.round(width);
        if (this._gradient && this._gradientKey === w) {
            return this._gradient;
        }

        if (this.paletteStops && this.type === 'slanted') {
            // Palette bars: the screen-fixed top-to-bottom gradient replaces
            // the sheen (both run down the bar). Depends only on y and angle,
            // which are constant per slanted bar. Returning here skips the
            // lazy _gradientFlip RNG read below, so after the first draw the
            // shared RNG sequence differs from mono mode (layouts are planned
            // before that, so per-seed layouts match; Code review, PR #16).
            this._gradient = paletteGradient(this.ctx, this.paletteStops, screenGradientLine('slanted', angle, y, this.canvas.height));
            this._gradientKey = w;
            return this._gradient;
        }

        // Lazy-init the flip on first draw so the constructor doesn't consume
        // RNG (preserves deterministic test sequences that seed update-loop
        // values without expecting a gradient-flip read).
        if (this._gradientFlip === undefined) {
            this._gradientFlip = this.random() < 0.5;
        }

        let gradient;
        if (this.type === 'slanted') {
            // For slanted bars, width is the short axis and the long axis is
            // ~canvas.height * 1.5 (see drawBar fillRect call). Gradient runs
            // along the long axis so the sheen reads as directional light
            // travelling down the stripe.
            const minHeight = this.canvas.height * 1.5;
            const y0 = -minHeight * 0.3;
            const y1 = minHeight * 0.7;
            gradient = this.ctx.createLinearGradient(0, y0, 0, y1);
        } else {
            // Horizontal bars: long axis is the canvas-spanning width.
            gradient = this.ctx.createLinearGradient(0, 0, w, 0);
        }

        const darker = Math.max(0, lightness - 6);
        const lighter = Math.min(100, lightness + 10);
        const stop0 = this._gradientFlip ? lighter : darker;
        const stop1 = this._gradientFlip ? darker : lighter;
        gradient.addColorStop(0, `hsl(${hue}, ${saturation}%, ${stop0}%)`);
        gradient.addColorStop(1, `hsl(${hue}, ${saturation}%, ${stop1}%)`);
        this._gradient = gradient;
        this._gradientKey = w;
        return gradient;
    }

    /**
     * Update bar state (override in subclasses)
     * @param {number} deltaTime - Time elapsed since last frame in seconds
     *
     * Note: Existing subclasses may still use frame counting internally.
     * Those need to be migrated to time-based logic:
     *   OLD: if (frameCount >= 60) { ... } // 60 frames = 1 second at 60fps
     *   NEW: if (elapsedTime >= 1.0) { ... } // 1 second regardless of fps
     *
     * Speed values should be "per second" not "per frame":
     *   OLD: x += 5 // moves 5 pixels per frame (300px/sec at 60fps, 600px/sec at 120fps)
     *   NEW: x += 300 * deltaTime // moves 300 pixels per second (consistent across all fps)
     */
    update(deltaTime) {
        // Override in subclass
        // Subclasses should multiply movement/animation values by deltaTime
        // Example: x += speedPerSecond * deltaTime
    }

    /**
     * Convert frame-based duration to time-based duration
     * @param {number} frames - Number of frames at 60fps
     * @returns {number} Duration in seconds
     */
    static framesToSeconds(frames) {
        return frames / 60; // Assumes original timing was calibrated for 60fps
    }

    /**
     * Draw bar (override in subclasses)
     */
    draw() {
        // Override in subclass
    }
}
