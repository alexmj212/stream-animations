/**
 * Dirty rectangle tracking for optimized canvas clearing
 *
 * Reduces GPU clearRect operations by tracking changed regions and merging overlaps.
 * Uses simple union merge strategy for fast performance (accepts redrawing some clean pixels).
 */

/**
 * DirtyRectTracker tracks dirty regions per frame and provides selective clearing
 */
export class DirtyRectTracker {
    /**
     * Create a dirty rectangle tracker
     * @param {number} safetyMargin - Pixels to expand regions (catches anti-aliasing/shadows)
     * @param {boolean} visualize - Whether to draw debug outlines around dirty regions
     */
    constructor(safetyMargin = 5, visualize = false) {
        this.safetyMargin = safetyMargin;
        this.visualize = visualize;
        this.regions = [];
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * Set canvas and context for visualization
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    setCanvas(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    /**
     * Add a dirty region (will be expanded by safety margin)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} width - Width
     * @param {number} height - Height
     */
    addRegion(x, y, width, height) {
        // Expand by safety margin to catch anti-aliasing and shadows
        this.regions.push({
            x: x - this.safetyMargin,
            y: y - this.safetyMargin,
            width: width + this.safetyMargin * 2,
            height: height + this.safetyMargin * 2
        });
    }

    /**
     * Get merged dirty regions (simple union merge for performance)
     * Overlapping rectangles are merged into bounding boxes.
     * Tradeoff: May redraw some clean pixels, but avoids expensive polygon math.
     * @returns {Array<{x: number, y: number, width: number, height: number}>}
     */
    getMergedRegions() {
        if (this.regions.length === 0) return [];
        if (this.regions.length === 1) return this.regions;

        const merged = [];
        const sorted = [...this.regions].sort((a, b) => a.x - b.x);

        let current = { ...sorted[0] };

        for (let i = 1; i < sorted.length; i++) {
            const rect = sorted[i];

            // Check overlap using geometric test
            // Rectangles overlap if they DON'T meet any of these conditions:
            // - current is entirely to the left of rect
            // - rect is entirely to the left of current
            // - current is entirely above rect
            // - rect is entirely above current
            const overlaps = !(
                current.x + current.width < rect.x ||
                rect.x + rect.width < current.x ||
                current.y + current.height < rect.y ||
                rect.y + rect.height < current.y
            );

            if (overlaps) {
                // Merge: take bounding box of both rectangles
                const x1 = Math.min(current.x, rect.x);
                const y1 = Math.min(current.y, rect.y);
                const x2 = Math.max(current.x + current.width, rect.x + rect.width);
                const y2 = Math.max(current.y + current.height, rect.y + rect.height);

                current = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
            } else {
                merged.push(current);
                current = { ...rect };
            }
        }

        merged.push(current);
        return merged;
    }

    /**
     * Clear dirty regions and reset for next frame
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    clearAndReset(ctx) {
        const merged = this.getMergedRegions();

        // Clear each merged region
        merged.forEach(rect => {
            ctx.clearRect(rect.x, rect.y, rect.width, rect.height);

            // Draw debug visualization if enabled
            if (this.visualize && this.canvas) {
                ctx.save();
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 2;
                ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
                ctx.restore();
            }
        });

        // Reset regions array for next frame
        this.regions = [];
    }

    /**
     * Reset regions without clearing (for testing)
     */
    reset() {
        this.regions = [];
    }

    /**
     * Get statistics about current dirty regions
     * @returns {{regionCount: number, mergedCount: number}}
     */
    getStats() {
        return {
            regionCount: this.regions.length,
            mergedCount: this.getMergedRegions().length
        };
    }
}

// Export as both default and named export
export default DirtyRectTracker;
