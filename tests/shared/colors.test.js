import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hexToHSL, generateRandomColor, getColorFromURL } from '../../src/shared/colors.js';

describe('hexToHSL', () => {
    it('should convert pure red to HSL', () => {
        const result = hexToHSL('#FF0000');
        expect(result).toEqual({ h: 0, s: 100, l: 50 });
    });

    it('should convert pure green to HSL', () => {
        const result = hexToHSL('#00FF00');
        expect(result).toEqual({ h: 120, s: 100, l: 50 });
    });

    it('should convert pure blue to HSL', () => {
        const result = hexToHSL('#0000FF');
        expect(result).toEqual({ h: 240, s: 100, l: 50 });
    });

    it('should convert white to HSL', () => {
        const result = hexToHSL('#FFFFFF');
        expect(result).toEqual({ h: 0, s: 0, l: 100 });
    });

    it('should convert black to HSL', () => {
        const result = hexToHSL('#000000');
        expect(result).toEqual({ h: 0, s: 0, l: 0 });
    });

    it('should convert gray to HSL', () => {
        const result = hexToHSL('#808080');
        expect(result).toEqual({ h: 0, s: 0, l: 50 });
    });

    it('should handle lowercase hex codes', () => {
        const result = hexToHSL('#ff0000');
        expect(result).toEqual({ h: 0, s: 100, l: 50 });
    });

    it('should handle hex codes without # prefix', () => {
        const result = hexToHSL('FF0000');
        expect(result).toEqual({ h: 0, s: 100, l: 50 });
    });

    it('should convert cyan to HSL', () => {
        const result = hexToHSL('#00FFFF');
        expect(result).toEqual({ h: 180, s: 100, l: 50 });
    });

    it('should convert magenta to HSL', () => {
        const result = hexToHSL('#FF00FF');
        expect(result).toEqual({ h: 300, s: 100, l: 50 });
    });

    it('should convert yellow to HSL', () => {
        const result = hexToHSL('#FFFF00');
        expect(result).toEqual({ h: 60, s: 100, l: 50 });
    });

    it('should handle partial saturation colors', () => {
        const result = hexToHSL('#FF8080');
        expect(result.h).toBe(0);
        expect(result.s).toBeGreaterThan(0);
        expect(result.l).toBeGreaterThan(50);
    });
});

describe('generateRandomColor', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should generate a valid hex color', () => {
        Math.random.mockReturnValue(0.5);
        const color = generateRandomColor();
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should generate different colors with different random values', () => {
        Math.random.mockReturnValueOnce(0.1).mockReturnValueOnce(0.2).mockReturnValueOnce(0.3);
        const color1 = generateRandomColor();

        Math.random.mockReturnValueOnce(0.9).mockReturnValueOnce(0.8).mockReturnValueOnce(0.7);
        const color2 = generateRandomColor();

        expect(color1).not.toBe(color2);
    });

    it('should generate color with minimum random values', () => {
        Math.random.mockReturnValue(0);
        const color = generateRandomColor();
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should generate color with maximum random values', () => {
        Math.random.mockReturnValue(0.999);
        const color = generateRandomColor();
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });
});

describe('getColorFromURL', () => {
    const originalLocation = window.location;

    beforeEach(() => {
        delete window.location;
    });

    afterEach(() => {
        window.location = originalLocation;
        vi.restoreAllMocks();
    });

    it('should return color from URL parameter', () => {
        window.location = { search: '?color=FF5733' };
        const color = getColorFromURL();
        expect(color).toBe('FF5733');
    });

    it('should return color from URL parameter with hash', () => {
        window.location = { search: '?color=%23FF5733' };
        const color = getColorFromURL();
        expect(color).toBe('#FF5733');
    });

    it('should generate random color if no URL parameter', () => {
        window.location = { search: '' };
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const color = getColorFromURL();
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should handle URL with multiple parameters', () => {
        window.location = { search: '?speed=2&color=00FF00&density=20' };
        const color = getColorFromURL();
        expect(color).toBe('00FF00');
    });
});
