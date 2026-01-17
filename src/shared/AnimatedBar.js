/**
 * Base class for animated bars used across all animations
 */
export class AnimatedBar {
    // Static cache for offscreen canvases (shared across all instances)
    static offscreenCache = new Map();

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
        offCtx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

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

        // Use offscreen canvas cache for better performance (typically for white bars)
        if (this.useOffscreenCache) {
            this.ctx.save();

            // Draw shadow separately (not cached) to support varying opacity
            if (withShadow) {
                this.ctx.globalAlpha = opacity * 0.2;
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                this.ctx.translate(x + 5, y + 5);
                this.ctx.transform(1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0);
                this.ctx.fillRect(0, -height / 2, width, height);
                this.ctx.restore();
                this.ctx.save();
            }

            // Get cached bar shape (without shadow)
            const offscreenCanvas = this.getOrCreateOffscreenCanvas(width, height, hue, saturation, lightness, angle, false);

            this.ctx.globalAlpha = opacity;

            // Draw the pre-rendered canvas at the target position
            // Center the offscreen canvas at x, y
            this.ctx.drawImage(
                offscreenCanvas,
                x - offscreenCanvas.width / 2,
                y - offscreenCanvas.height / 2
            );

            this.ctx.restore();
            return;
        }

        // Original drawing code for non-cached bars
        this.ctx.save();

        // Draw shadow first (if enabled) using simple offset technique instead of shadowBlur
        if (withShadow) {
            this.ctx.globalAlpha = opacity * 0.2; // Shadow opacity
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';

            if (this.type === 'slanted') {
                this.ctx.translate(x + 5, y + 5); // Shadow offset
                this.ctx.rotate((angle * Math.PI) / 180);
                const minHeight = this.canvas.height * 1.5;
                this.ctx.fillRect(0, -minHeight * 0.3, width, minHeight);
            } else {
                this.ctx.translate(x + 5, y + 5); // Shadow offset
                this.ctx.transform(1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0);
                this.ctx.fillRect(0, -height / 2, width, height);
            }

            this.ctx.restore();
            this.ctx.save();
        }

        // Draw main bar
        this.ctx.globalAlpha = opacity;
        this.ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

        if (this.type === 'slanted') {
            this.ctx.translate(x, y);
            this.ctx.rotate((angle * Math.PI) / 180);
            // Always extend well beyond screen height
            const minHeight = this.canvas.height * 1.5;
            this.ctx.fillRect(0, -minHeight * 0.3, width, minHeight);
        } else {
            // Horizontal bar with skew
            this.ctx.translate(x, y);
            this.ctx.transform(1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0);
            this.ctx.fillRect(0, -height / 2, width, height);
        }

        this.ctx.restore();
    }

    /**
     * Update bar state (override in subclasses)
     */
    update() {
        // Override in subclass
    }

    /**
     * Draw bar (override in subclasses)
     */
    draw() {
        // Override in subclass
    }
}
