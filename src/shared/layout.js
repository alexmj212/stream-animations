/**
 * Screen-layout math: where other overlays draw over a scene, and how much
 * they cover. Pure functions, unit-tested in tests/shared/layout.test.js.
 */

/** Canvas size Mix It Up's overlay and the OBS browser sources are built for. */
export const MIU_CANVAS = { width: 1920, height: 1080 };

/**
 * Screen rectangle of one Mix It Up overlay item. MIU centres an item on its
 * percentage X/Y (`translate(-50%, -50%)`) and sizes it in overlay pixels.
 *
 * @param {{xPct: number, yPct: number, w: number, h: number}} item
 * @param {number} width - Scene width in px
 * @param {number} height - Scene height in px
 * @param {number} [pad=0] - Grow each side by this fraction of the item size
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function miuItemRect(item, width, height, pad = 0) {
    const scale = width / MIU_CANVAS.width;
    const w = item.w * scale * (1 + 2 * pad);
    const h = item.h * scale * (1 + 2 * pad);
    return {
        x: (item.xPct / 100) * width - w / 2,
        y: (item.yPct / 100) * height - h / 2,
        width: w,
        height: h
    };
}

/**
 * Area shared by two rectangles ({x, y, width, height}); 0 when apart.
 * @returns {number}
 */
export function overlapArea(a, b) {
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Largest fraction of `rect` that any one of `zones` covers (0 to 1).
 * @param {{x: number, y: number, width: number, height: number}} rect
 * @param {Array<{x: number, y: number, width: number, height: number}>} zones
 * @returns {number}
 */
export function coveredFraction(rect, zones) {
    const area = rect.width * rect.height;
    if (area <= 0) return 0;
    return zones.reduce((m, z) => Math.max(m, overlapArea(rect, z) / area), 0);
}
