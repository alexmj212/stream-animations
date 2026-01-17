/**
 * Shared color utilities for stream animations
 */

/**
 * Convert CSS color to hex format
 * @param {string} color - CSS color (named, 3-digit hex, 6-digit hex)
 * @returns {string} Hex color string
 */
export function cssColorToHex(color) {
    // Already 6-digit hex
    if (/^#?[a-f\d]{6}$/i.test(color)) {
        return color.startsWith('#') ? color : `#${color}`;
    }

    // 3-digit hex - expand to 6-digit
    const shortHex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(color);
    if (shortHex) {
        return `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`;
    }

    // Named color or other CSS color - use canvas to convert
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = color;
    return ctx.fillStyle; // Returns hex format
}

/**
 * Convert hex color to HSL
 * @param {string} hex - Hex color string (e.g., "#ff6600")
 * @returns {{h: number, s: number, l: number}} HSL values
 */
export function hexToHSL(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 200, s: 100, l: 50 };

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

/**
 * Generate random hex color
 * @returns {string} Random hex color
 */
export function generateRandomColor() {
    const randomHue = Math.floor(Math.random() * 360);
    const randomSat = Math.floor(Math.random() * 40 + 60); // 60-100%
    const randomLight = Math.floor(Math.random() * 30 + 40); // 40-70%

    const h = randomHue;
    const s = randomSat / 100;
    const l = randomLight / 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Get color from URL parameter or generate random
 * @returns {string} Hex color string
 */
export function getColorFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const colorParam = urlParams.get('color');
    if (colorParam) {
        return cssColorToHex(colorParam);
    }
    return generateRandomColor();
}
