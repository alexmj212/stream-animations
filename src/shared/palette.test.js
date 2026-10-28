import { describe, it, expect } from 'vitest';
import { resolvePalette, samplePalette, shadeStops, screenGradientLine } from './palette.js';
import { config } from '../config/config.js';

const palettes = config.epcot.palettes;
const defaults = config.palette;
const resolve = (opts) => resolvePalette({ palettes, defaults, scheme: null, colorHex: null, ...opts });

describe('resolvePalette', () => {
    it('defaults to the illuminations palette, unshifted, with no color', () => {
        const r = resolve({});
        expect(r.scheme).toBe('illuminations');
        expect(r.stops).toHaveLength(palettes.illuminations.length);
        expect(r.hueShift).toBe(0);
    });

    it("barely moves for AJ's theme color #b00bee", () => {
        expect(Math.abs(resolve({ colorHex: '#b00bee', colorMode: 'shift' }).hueShift)).toBeLessThanOrEqual(6);
    });

    it('rotates every stop so the anchor lands on the passed hue', () => {
        const r = resolve({ colorHex: '#00b3ff', colorMode: 'shift' });
        expect(r.stops[defaults.anchorIndex].h).toBeCloseTo(198, -1);
    });

    it('leaves the palette alone for grays and in ignore mode', () => {
        expect(resolve({ colorHex: '#c0c0c0', colorMode: 'shift' }).hueShift).toBe(0);
        expect(resolve({ colorHex: '#ff6600' }).hueShift).toBe(0);
        expect(resolve({ colorHex: '#00b3ff', colorMode: 'ignore' }).hueShift).toBe(0);
    });

    it('falls back to the single-hue look for mono, unknown schemes and colormode=mono', () => {
        expect(resolve({ scheme: 'mono' }).stops).toBeNull();
        expect(resolve({ scheme: 'nope' }).stops).toBeNull();
        expect(resolve({ colorHex: '#ff6600', colorMode: 'mono' }).stops).toBeNull();
        expect(resolve({ colorMode: 'mono' }).stops).not.toBeNull();
    });
});

describe('samplePalette', () => {
    const stops = [{ h: 350, s: 100, l: 40 }, { h: 10, s: 80, l: 60 }];
    it('hits the ends and interpolates hue the short way round', () => {
        expect(samplePalette(stops, 0)).toEqual(stops[0]);
        expect(samplePalette(stops, 1)).toEqual(stops[1]);
        expect(samplePalette(stops, 0.5)).toEqual({ h: 0, s: 90, l: 50 });
        expect(samplePalette(stops, 2)).toEqual(stops[1]);
    });
});

describe('shadeStops', () => {
    it('offsets, scales and floors lightness', () => {
        expect(shadeStops([{ h: 1, s: 95, l: 50 }], { dl: -10, ds: 10, brightness: 0.8, floor: 35 }))
            .toEqual([{ h: 1, s: 100, l: 35 }]);
    });
});

describe('screenGradientLine', () => {
    it('maps a rotated bar\'s gradient onto screen top..bottom', () => {
        const a = 15, y = 120, H = 1080;
        const [x0, y0, x1, y1] = screenGradientLine('slanted', a, y, H);
        const rad = a * Math.PI / 180;
        const screenY = (lx, ly) => y + lx * Math.sin(rad) + ly * Math.cos(rad);
        expect(screenY(x0, y0)).toBeCloseTo(0);
        expect(screenY(x1, y1)).toBeCloseTo(H);
    });

    it('uses local y for skewed horizontal bars', () => {
        expect(screenGradientLine('horizontal', -15, 300, 1080)).toEqual([0, -300, 0, 780]);
    });
});
