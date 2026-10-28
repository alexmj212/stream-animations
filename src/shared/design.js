/**
 * Design-system math from the stream bible (docs/DESIGN.md): contrast
 * ratios, safe-area rectangles and the named colours of `config.design`.
 * Pure functions, unit-tested in tests/shared/design.test.js.
 */

import { hexToHSL, hslToRgb } from './colors.js';
import { shadeStops } from './palette.js';

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
 * Apply a scene brightness multiplier to a #rrggbb colour the way the scenes
 * do: on HSL lightness, through `shadeStops()` (not on the RGB channels,
 * which comes out lighter for saturated colours).
 *
 * @param {string} hex
 * @param {number} brightness - 0.8 for the scenes' palette
 * @returns {string} '#rrggbb'
 */
export function shadeHex(hex, brightness) {
    const [{ h, s, l }] = shadeStops([hexToHSL(hex)], { brightness });
    const { r, g, b } = hslToRgb(h, s, l);
    return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
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
    return shadeHex(stops[Number(match[1])], design.color.brightness);
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

/**
 * The guides `?debug=safe` draws (src/shared/debug.js), as fractions of the
 * frame: action-safe, title-safe and the player-controls strip.
 *
 * @param {Object} design - config.design
 * @returns {Array<{label: string, left: number, top: number, width: number, height: number, color: string, fill?: string}>}
 */
export function safeAreaGuides(design) {
    const box = (inset) => ({ left: inset, top: inset, width: 1 - 2 * inset, height: 1 - 2 * inset });
    const top = design.playerChromeTop;
    return [
        { label: 'action-safe', ...box(design.safe.actionInset), color: '#ff3b30' },
        { label: 'title-safe', ...box(design.safe.titleInset), color: '#ffcc00' },
        { label: 'player controls', left: 0, top, width: 1, height: 1 - top, color: '#00c8ff', fill: 'rgba(0, 200, 255, 0.15)' }
    ];
}
