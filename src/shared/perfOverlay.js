/**
 * Visual performance overlay component
 */

export class PerformanceOverlay {
    /**
     * Create a new PerformanceOverlay instance
     * @param {Object} perfMonitor - PerformanceMonitor instance
     * @param {Object} perfStorage - PerformanceStorage instance
     * @param {Object} options - Configuration options
     * @param {string} options.position - Position of overlay (default: 'top-right')
     * @param {number} options.opacity - Overlay opacity (default: 0.9)
     * @param {string} options.scene - Scene name (default: 'unknown')
     */
    constructor(perfMonitor, perfStorage, options = {}) {
        this.perfMonitor = perfMonitor;
        this.perfStorage = perfStorage;
        this.options = {
            position: options.position || 'top-right',
            opacity: options.opacity || 0.9,
            scene: options.scene || 'unknown'
        };

        this.visible = false;
        this.animationFrameId = null;
        this.sessionStartTime = null;
        this.peakMemoryMB = 0;

        this.createOverlayElement();
    }

    /**
     * Create the overlay DOM element
     */
    createOverlayElement() {
        this.element = document.createElement('div');
        this.element.id = 'perf-overlay';

        // Apply styles based on position
        const baseStyles = {
            position: 'fixed',
            background: `rgba(0, 0, 0, ${this.options.opacity})`,
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '10px',
            zIndex: '9999',
            pointerEvents: 'none',
            display: 'none',
            minWidth: '300px',
            lineHeight: '1.4'
        };

        // Position-specific styles
        const positions = {
            'top-right': { top: '10px', right: '10px' },
            'top-left': { top: '10px', left: '10px' },
            'bottom-right': { bottom: '10px', right: '10px' },
            'bottom-left': { bottom: '10px', left: '10px' }
        };

        const positionStyles = positions[this.options.position] || positions['top-right'];

        Object.assign(this.element.style, baseStyles, positionStyles);

        document.body.appendChild(this.element);
    }

    /**
     * Show the overlay and start update loop
     */
    show() {
        this.visible = true;
        this.element.style.display = 'block';
        this.update();
    }

    /**
     * Hide the overlay and stop update loop
     */
    hide() {
        this.visible = false;
        this.element.style.display = 'none';

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Toggle overlay visibility
     */
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Update overlay content with current metrics
     */
    update() {
        if (!this.visible) return;

        const stats = this.perfMonitor.getStats();
        const memoryMB = window.performance.memory
            ? (window.performance.memory.usedJSHeapSize / 1048576).toFixed(1)
            : 'N/A';

        // Track peak memory
        if (memoryMB !== 'N/A') {
            this.peakMemoryMB = Math.max(this.peakMemoryMB, parseFloat(memoryMB));
        }

        // Color-coded thresholds
        const fpsColor = this.getFPSColor(stats.fps);
        const memoryColor = this.getMemoryColor(memoryMB);

        // Build HTML content
        this.element.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">Performance Monitor [${this.options.scene}]</div>
            <div>FPS: <span style="color: ${fpsColor}; font-weight: bold;">${stats.fps}</span></div>
            <div>Avg: ${stats.avgFrameTime}ms | P99: ${stats.p99FrameTime}ms</div>
            <div>Min: ${stats.minFrameTime}ms | Max: ${stats.maxFrameTime}ms</div>
            <div>Dropped: ${stats.droppedFrames} frames</div>
            <div>Memory: <span style="color: ${memoryColor}; font-weight: bold;">${memoryMB} MB</span></div>
            <div style="margin-top: 5px; font-size: 10px; opacity: 0.7;">Press 'P' to toggle</div>
        `;

        this.animationFrameId = requestAnimationFrame(() => this.update());
    }

    /**
     * Get color for FPS based on thresholds
     * @param {number} fps - Current FPS
     * @returns {string} CSS color
     */
    getFPSColor(fps) {
        if (fps >= 58) return '#0f0'; // Green
        if (fps >= 55) return '#ff0'; // Yellow
        return '#f00'; // Red
    }

    /**
     * Get color for memory based on thresholds
     * @param {string|number} memoryMB - Memory usage in MB
     * @returns {string} CSS color
     */
    getMemoryColor(memoryMB) {
        if (memoryMB === 'N/A') return '#fff';

        const memory = parseFloat(memoryMB);
        if (memory < 250) return '#0f0'; // Green
        if (memory < 300) return '#ff0'; // Yellow
        return '#f00'; // Red
    }

    /**
     * Setup hotkey listener (P key to toggle)
     */
    setupHotkey() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P') {
                this.toggle();
            }
        });
    }

    /**
     * Start a performance monitoring session
     */
    startSession() {
        this.sessionStartTime = Date.now();
        this.peakMemoryMB = 0;
        this.perfMonitor.reset();
    }

    /**
     * End the session and save metrics to storage
     */
    endSession() {
        if (this.sessionStartTime === null) return;

        const duration = Date.now() - this.sessionStartTime;
        const stats = this.perfMonitor.getStats();

        this.perfStorage.saveSession({
            scene: this.options.scene,
            duration: duration,
            avgFPS: stats.fps,
            peakMemoryMB: this.peakMemoryMB,
            droppedFrames: stats.droppedFrames
        });
    }

    /**
     * Expose window.perfMonitor API
     */
    exposeAPI() {
        window.perfMonitor = {
            // Query methods
            getCurrentMetrics: () => {
                const stats = this.perfMonitor.getStats();
                const memoryMB = window.performance.memory
                    ? (window.performance.memory.usedJSHeapSize / 1048576).toFixed(2)
                    : 'N/A';

                return {
                    fps: stats.fps,
                    avgFrameTime: parseFloat(stats.avgFrameTime),
                    minFrameTime: parseFloat(stats.minFrameTime),
                    maxFrameTime: parseFloat(stats.maxFrameTime),
                    p99FrameTime: parseFloat(stats.p99FrameTime),
                    droppedFrames: stats.droppedFrames,
                    memoryMB: memoryMB
                };
            },

            getSessions: () => {
                return this.perfStorage.getSessions();
            },

            getAverages: () => {
                const sessions = this.perfStorage.getSessions();
                if (sessions.length === 0) return null;

                const avgFPS = sessions.reduce((sum, s) => sum + s.avgFPS, 0) / sessions.length;
                const avgMemoryMB = sessions.reduce((sum, s) => sum + s.peakMemoryMB, 0) / sessions.length;

                return {
                    avgFPS: avgFPS.toFixed(1),
                    avgMemoryMB: avgMemoryMB.toFixed(1),
                    totalSessions: sessions.length
                };
            },

            // Control methods
            start: () => {
                this.perfMonitor.enable();
            },

            stop: () => {
                this.perfMonitor.disable();
            },

            reset: () => {
                this.perfMonitor.reset();
            },

            clearHistory: () => {
                if (confirm('Clear all performance session history?')) {
                    this.perfStorage.clearAll();
                    console.log('[perfMonitor] Session history cleared');
                }
            }
        };
    }
}
