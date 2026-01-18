/**
 * Performance session storage with localStorage persistence
 */

export class PerformanceStorage {
    /**
     * Create a new PerformanceStorage instance
     * @param {number} maxSessions - Maximum number of sessions to keep (default: 50)
     */
    constructor(maxSessions = 50) {
        this.maxSessions = maxSessions;
        this.prefix = 'perf_session_';
    }

    /**
     * Save a performance session to localStorage
     * @param {Object} metrics - Session metrics
     * @param {string} metrics.scene - Scene name (background, stinger, sidebar)
     * @param {number} metrics.duration - Duration in milliseconds
     * @param {number} metrics.avgFPS - Average FPS
     * @param {number} metrics.peakMemoryMB - Peak memory usage in MB
     * @param {number} metrics.droppedFrames - Number of dropped frames
     */
    saveSession(metrics) {
        const session = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(), // ISO 8601 format with Z suffix
            scene: metrics.scene,
            duration: metrics.duration,
            avgFPS: metrics.avgFPS,
            peakMemoryMB: metrics.peakMemoryMB,
            droppedFrames: metrics.droppedFrames
        };

        try {
            localStorage.setItem(
                `${this.prefix}${session.id}`,
                JSON.stringify(session)
            );
            this.evictOldSessions();
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('[PerformanceStorage] localStorage quota exceeded, forcing cleanup');
                this.evictOldSessions(true); // Aggressive cleanup
            } else {
                console.error('[PerformanceStorage] Failed to save session:', e);
            }
        }
    }

    /**
     * Evict old sessions to maintain maxSessions limit
     * @param {boolean} aggressive - If true, remove 50% of sessions (default: false)
     */
    evictOldSessions(aggressive = false) {
        const keys = Object.keys(localStorage)
            .filter(k => k.startsWith(this.prefix))
            .sort(); // ISO 8601 timestamps sort chronologically

        const limit = aggressive ? Math.floor(this.maxSessions * 0.5) : this.maxSessions;
        const toRemove = keys.length - limit;

        if (toRemove > 0) {
            // Remove oldest sessions (FIFO)
            keys.slice(0, toRemove).forEach(k => localStorage.removeItem(k));
        }
    }

    /**
     * Get all stored sessions, sorted newest first
     * @returns {Array} Array of session objects
     */
    getSessions() {
        const sessions = [];

        Object.keys(localStorage)
            .filter(k => k.startsWith(this.prefix))
            .forEach(k => {
                try {
                    const session = JSON.parse(localStorage.getItem(k));
                    sessions.push(session);
                } catch (e) {
                    console.error('[PerformanceStorage] Failed to parse session:', k, e);
                }
            });

        // Sort by timestamp, newest first
        return sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Clear all stored sessions
     */
    clearAll() {
        const keys = Object.keys(localStorage)
            .filter(k => k.startsWith(this.prefix));

        keys.forEach(k => localStorage.removeItem(k));
    }
}
