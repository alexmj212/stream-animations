/**
 * Base class for animated bars used across all animations
 */
export class AnimatedBar {
    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {string} type - Bar type ('slanted' or 'horizontal')
     */
    constructor(ctx, canvas, type) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.type = type;
        this.active = true;
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
        this.ctx.save();
        this.ctx.globalAlpha = opacity;

        // Add drop shadow if requested
        if (withShadow) {
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            this.ctx.shadowBlur = 20;
            this.ctx.shadowOffsetX = 10;
            this.ctx.shadowOffsetY = 10;
        }

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
