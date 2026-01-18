/**
 * Shared test fixtures for canvas-based tests
 */

/**
 * Create mock canvas with specified dimensions
 * @param {number} width - Canvas width (default: 1920)
 * @param {number} height - Canvas height (default: 1080)
 * @returns {HTMLCanvasElement} Canvas element
 */
export function createMockCanvas(width = 1920, height = 1080) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Create mock 2D rendering context
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {CanvasRenderingContext2D} 2D context
 */
export function createMockContext(canvas) {
  return canvas.getContext('2d');
}

/**
 * Create canvas, context, and bar for testing
 * @param {Function} BarClass - Bar class constructor
 * @param {string} type - Bar type ('slanted' or 'horizontal')
 * @param {Object} options - Optional configuration
 * @returns {Object} { canvas, ctx, bar }
 */
export function createMockBar(BarClass, type = 'slanted', options = {}) {
  const canvas = createMockCanvas(options.width, options.height);
  const ctx = createMockContext(canvas);
  const bar = new BarClass(ctx, canvas, type, options);
  return { canvas, ctx, bar };
}
