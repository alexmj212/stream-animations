/**
 * Design-system math from the stream bible (docs/DESIGN.md): contrast
 * ratios, safe-area rectangles and the named colours of `config.design`.
 * Pure functions, unit-tested in tests/shared/design.test.js.
 */

/**
 * WCAG relative luminance of a #rrggbb colour.
 *
 * @param {string} hex - '#rrggbb'
 * @returns {number} 0 (black) to 1 (white)
 */
export function relativeLuminance(hex) {
    const channel = (i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * WCAG contrast ratio between two #rrggbb colours.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} 1 to 21
 */
export function contrastRatio(a, b) {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Multiply each channel of a #rrggbb colour, the way the scenes apply their
 * brightness multiplier.
 *
 * @param {string} hex
 * @param {number} factor - 0.8 for the scenes' brightness
 * @returns {string} '#rrggbb'
 */
export function scaleHex(hex, factor) {
    const out = [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * factor));
    return '#' + out.map(v => Math.min(255, v).toString(16).padStart(2, '0')).join('');
}

/**
 * Resolve a colour name from `config.design.color.textPairs`: 'white',
 * 'ink', or 'stopN' (Illuminations stop N at the design brightness).
 *
 * @param {string} name
 * @param {Object} design - config.design
 * @param {string[]} stops - config.epcot.palettes.illuminations
 * @returns {string} '#rrggbb'
 */
export function designColor(name, design, stops) {
    if (name === 'white' || name === 'ink') return design.color[name];
    const match = /^stop(\d+)$/.exec(name);
    if (!match || !stops[Number(match[1])]) throw new Error(`Unknown design colour: ${name}`);
    return scaleHex(stops[Number(match[1])], design.color.brightness);
}

/**
 * The action-safe or title-safe rectangle of a frame.
 *
 * @param {'action'|'title'} kind
 * @param {Object} design - config.design
 * @param {number} [width] - Frame width, default the design canvas
 * @param {number} [height] - Frame height, default the design canvas
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function safeRect(kind, design, width = design.canvas.width, height = design.canvas.height) {
    const inset = design.safe[`${kind}Inset`];
    const x = Math.round(width * inset);
    const y = Math.round(height * inset);
    return { x, y, width: width - 2 * x, height: height - 2 * y };
}
