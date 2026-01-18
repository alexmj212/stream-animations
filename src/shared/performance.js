/**
 * Performance monitoring utilities
 */

export class PerformanceMonitor {
    constructor(sampleSize = 60, targetFPS = 60) {
        this.sampleSize = sampleSize;
        this.targetFPS = targetFPS;
        this.targetFrameTime = 1000 / targetFPS; // Frame budget in ms
        this.frameTimes = [];
        this.lastFrameTime = performance.now();
        this.droppedFrames = 0;
        this.enabled = false;
    }

    /**
     * Enable performance monitoring
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable performance monitoring
     */
    disable() {
        this.enabled = false;
    }

    /**
     * Record a frame
     */
    recordFrame() {
        if (!this.enabled) return;

        const now = performance.now();
        const frameTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Detect dropped frames (exceeded budget + 1ms headroom)
        if (frameTime > this.targetFrameTime + 1) {
            this.droppedFrames++;
        }

        this.frameTimes.push(frameTime);
        if (this.frameTimes.length > this.sampleSize) {
            this.frameTimes.shift();
        }
    }

    /**
     * Get current FPS
     * @returns {number} Current FPS
     */
    getFPS() {
        if (this.frameTimes.length === 0) return 0;

        const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        return Math.round(1000 / avgFrameTime);
    }

    /**
     * Get average frame time in milliseconds
     * @returns {number} Average frame time
     */
    getAvgFrameTime() {
        if (this.frameTimes.length === 0) return 0;
        return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    }

    /**
     * Get minimum frame time (best performance)
     * @returns {number} Minimum frame time
     */
    getMinFrameTime() {
        if (this.frameTimes.length === 0) return 0;
        return Math.min(...this.frameTimes);
    }

    /**
     * Get maximum frame time (worst performance)
     * @returns {number} Maximum frame time
     */
    getMaxFrameTime() {
        if (this.frameTimes.length === 0) return 0;
        return Math.max(...this.frameTimes);
    }

    /**
     * Get P99 frame time (99th percentile)
     * @returns {number} P99 frame time in milliseconds
     */
    getP99FrameTime() {
        if (this.frameTimes.length === 0) return 0;

        const sorted = [...this.frameTimes].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * 0.99);
        return sorted[index];
    }

    /**
     * Get dropped frames count
     * @returns {number} Number of dropped frames
     */
    getDroppedFrames() {
        return this.droppedFrames;
    }

    /**
     * Reset performance metrics
     */
    reset() {
        this.frameTimes = [];
        this.droppedFrames = 0;
        this.lastFrameTime = performance.now();
    }

    /**
     * Get performance stats
     * @returns {Object} Performance statistics
     */
    getStats() {
        return {
            fps: this.getFPS(),
            avgFrameTime: this.getAvgFrameTime().toFixed(2),
            minFrameTime: this.getMinFrameTime().toFixed(2),
            maxFrameTime: this.getMaxFrameTime().toFixed(2),
            p99FrameTime: this.getP99FrameTime().toFixed(2),
            droppedFrames: this.droppedFrames,
            sampleSize: this.frameTimes.length
        };
    }

    /**
     * Log stats to console
     */
    logStats() {
        const stats = this.getStats();
        console.log(`FPS: ${stats.fps} | Avg: ${stats.avgFrameTime}ms | Min: ${stats.minFrameTime}ms | Max: ${stats.maxFrameTime}ms`);
    }
}
