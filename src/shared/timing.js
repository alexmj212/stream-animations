/**
 * Delta-time timing utilities for frame-rate independent animations
 *
 * Usage:
 *   const timer = new DeltaTimer();
 *
 *   function animate(timestamp) {
 *     const deltaTime = timer.update(timestamp);
 *
 *     // deltaTime is in seconds, multiply all movements by it
 *     const speedPerSecond = 100; // pixels per second
 *     x += speedPerSecond * deltaTime;
 *
 *     requestAnimationFrame(animate);
 *   }
 */

export class DeltaTimer {
  constructor() {
    this.lastTimestamp = null;
    this.maxDeltaTime = 0.1; // 100ms cap prevents tab-switch spikes
  }

  /**
   * Update timer with new timestamp from requestAnimationFrame
   * @param {DOMHighResTimeStamp} timestamp - Timestamp from rAF in milliseconds
   * @returns {number} Delta time in seconds (capped to maxDeltaTime)
   */
  update(timestamp) {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      return 0; // First frame has no delta
    }

    const rawDelta = (timestamp - this.lastTimestamp) / 1000;
    // Clamp delta to [0, maxDeltaTime] to handle backwards time and tab-switch spikes
    const deltaTime = Math.max(0, Math.min(rawDelta, this.maxDeltaTime));
    this.lastTimestamp = timestamp;

    return deltaTime;
  }

  /**
   * Reset timer to initial state (useful for pause/resume)
   */
  reset() {
    this.lastTimestamp = null;
  }
}
