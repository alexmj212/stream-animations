/**
 * Lifecycle management utilities using AbortController
 *
 * Provides automatic cleanup for event listeners and custom cleanup callbacks.
 * Uses single AbortController to manage all event listeners, ensuring they're
 * properly removed on cleanup without requiring function references.
 *
 * Usage:
 *   const lifecycle = new AnimationLifecycle();
 *
 *   lifecycle.addEventListener(window, 'resize', handleResize);
 *   lifecycle.addEventListener(document, 'visibilitychange', handleVisibility);
 *   lifecycle.onCleanup(() => console.log('Cleaning up'));
 *
 *   // Automatically cleans up on beforeunload
 *   // Or manually: lifecycle.cleanup();
 */

export class AnimationLifecycle {
  constructor() {
    this.controller = new AbortController();
    this.signal = this.controller.signal;
    this.cleanupCallbacks = [];
    this.setupBeforeUnload();
  }

  /**
   * Add event listener that will be auto-cleaned on abort
   * @param {EventTarget} target - Element to attach listener to
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} options - Additional options (merged with signal)
   */
  addEventListener(target, event, handler, options = {}) {
    target.addEventListener(event, handler, {
      ...options,
      signal: this.signal
    });
  }

  /**
   * Register callback to run on cleanup
   * @param {Function} callback - Cleanup function
   */
  onCleanup(callback) {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Clean up all listeners and run cleanup callbacks
   */
  cleanup() {
    // Run custom cleanup callbacks first
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('[Lifecycle] Cleanup callback error:', error);
      }
    }

    // Abort all event listeners
    this.controller.abort();
    console.log('[Lifecycle] All event listeners cleaned up');
  }

  /**
   * Setup beforeunload listener to trigger cleanup
   * @private
   */
  setupBeforeUnload() {
    // Use once:true so this listener removes itself
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    }, { once: true });
  }
}
