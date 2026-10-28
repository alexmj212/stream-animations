import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio, shadeHex, designColor, safeRect } from '../../src/shared/design.js';
import { config } from '../../src/config/config.js';

const design = config.design;
const stops = config.epcot.palettes.illuminations;

describe('contrast math', () => {
    it('matches the WCAG reference values', () => {
        expect(relativeLuminance('#ffffff')).toBeCloseTo(1);
        expect(relativeLuminance('#000000')).toBe(0);
        expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
        expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    });

    it('shades colours like the scenes (HSL lightness, shadeStops)', () => {
        expect(shadeHex('#ff8c1e', 0.8)).toBe('#e66f00');
        expect(shadeHex('#ffffff', 1)).toBe('#ffffff');
    });
});

// The bible's text-on-colour table (docs/DESIGN.md, Colour). A pair that
// fails here fails on stream too
describe('design text pairs', () => {
    for (const pair of design.color.textPairs) {
        it(`${pair.text} on ${pair.bg} reaches ${pair.min}:1`, () => {
            const ratio = contrastRatio(designColor(pair.text, design, stops), designColor(pair.bg, design, stops));
            expect(ratio).toBeGreaterThanOrEqual(pair.min);
        });
    }

    it('lists every Illuminations stop, so no palette colour carries untested text', () => {
        const covered = new Set(design.color.textPairs.map(p => p.bg));
        stops.forEach((_, i) => expect(covered.has(`stop${i}`)).toBe(true));
    });

    it('rejects an unknown colour name', () => {
        expect(() => designColor('stop99', design, stops)).toThrow();
    });
});

describe('type scale', () => {
    it('keeps every size at or above the legibility floor', () => {
        for (const size of Object.values(design.type.sizes)) {
            expect(size).toBeGreaterThanOrEqual(design.type.minPx);
        }
    });

    it('keeps the stroke visible after a 720p encode', () => {
        expect(design.type.strokeMinPx * 720 / 1080).toBeGreaterThanOrEqual(2);
    });
});

describe('safe areas', () => {
    it('gives the SMPTE ST 2046-1 rectangles on the 1080p canvas', () => {
        expect(safeRect('title', design)).toEqual({ x: 96, y: 54, width: 1728, height: 972 });
        expect(safeRect('action', design)).toEqual({ x: 67, y: 38, width: 1786, height: 1004 });
    });

    it('puts the grid margin on the title-safe edge', () => {
        expect(design.grid.marginPx).toBe(safeRect('title', design).x);
    });

    it('scales to a 720p frame', () => {
        expect(safeRect('title', design, 1280, 720)).toEqual({ x: 64, y: 36, width: 1152, height: 648 });
    });
});
