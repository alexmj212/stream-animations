/**
 * Shared canvas utilities
 */

/**
 * Setup canvas with proper sizing
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {CanvasRenderingContext2D} Canvas 2D context
 */
export function setupCanvas(canvas) {
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return ctx;
}

/**
 * Clear canvas with transparent background
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {HTMLCanvasElement} canvas - Canvas element
 */
export function clearCanvas(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
