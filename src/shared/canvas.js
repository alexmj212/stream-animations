/**
 * Shared canvas utilities
 */

/**
 * Setup canvas with proper sizing
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} options - Canvas context options
 * @param {boolean} options.alpha - Enable transparency (default: false for better performance)
 * @returns {CanvasRenderingContext2D} Canvas 2D context
 */
export function setupCanvas(canvas, options = {}) {
  const { alpha = true } = options;
  const ctx = canvas.getContext("2d", { alpha });

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  return ctx;
}

/**
 * Clear canvas with transparent background
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {DirtyRectTracker} [dirtyTracker] - Optional dirty rectangle tracker for selective clearing
 *
 * When tracker provided, only clears regions reported via addRegion(), reducing GPU operations.
 * Falls back to full canvas clear if tracker not provided (backward compatibility).
 */
export function clearCanvas(ctx, canvas, dirtyTracker = null) {
  if (dirtyTracker) {
    // Use dirty rectangle optimization
    dirtyTracker.clearAndReset(ctx);
  } else {
    // Full canvas clear (original behavior)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
