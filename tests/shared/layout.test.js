import { describe, it, expect } from 'vitest';
import { miuItemRect, overlapArea, coveredFraction, fitText } from '../../src/shared/layout.js';
import { config } from '../../src/config/config.js';

describe('miuItemRect', () => {
    it('centres the item on its percentage position', () => {
        expect(miuItemRect({ xPct: 85, yPct: 50, w: 400, h: 400 }, 1920, 1080))
            .toEqual({ x: 1432, y: 340, width: 400, height: 400 });
    });

    it('scales pixel sizes with the scene width and pads each side', () => {
        const r = miuItemRect({ xPct: 50, yPct: 50, w: 400, h: 200 }, 960, 540, 0.05);
        expect(r.width).toBeCloseTo(220);
        expect(r.height).toBeCloseTo(110);
        expect(r.x).toBeCloseTo(480 - 110);
    });
});

describe('overlapArea / coveredFraction', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };

    it('is zero for rectangles that only touch', () => {
        expect(overlapArea(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(0);
    });

    it('measures the shared area', () => {
        expect(overlapArea(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(25);
    });

    it('reports the worst single zone', () => {
        expect(coveredFraction(a, [
            { x: 5, y: 5, width: 10, height: 10 },
            { x: 0, y: 0, width: 10, height: 5 }
        ])).toBe(0.5);
        expect(coveredFraction(a, [])).toBe(0);
    });
});

describe('sidebar text vs the Mix It Up images', () => {
    // The text line is about 1.5vw tall plus its outline; check a generous
    // 60px band at 1920x1080 so a font change can't sneak it under an image
    it('keeps the text band clear of every MIU zone', () => {
        const { text, miuZones } = config.sidebar;
        const zones = miuZones.items.map(i => miuItemRect(i, 1920, 1080, miuZones.pad));
        const band = { x: 0, y: text.centerY * 1080 - 30, width: 1920, height: 60 };
        expect(coveredFraction(band, zones)).toBe(0);
    });
});

describe('fitText', () => {
    it('leaves text that fits alone', () => {
        expect(fitText(400, 500, 0.75)).toEqual({ scale: 1, lines: 1 });
    });

    it('shrinks down to minScale to stay on one line', () => {
        expect(fitText(600, 500, 0.75)).toEqual({ scale: 500 / 600, lines: 1 });
    });

    it('wraps to two lines at minScale once shrinking is not enough', () => {
        expect(fitText(1000, 500, 0.75)).toEqual({ scale: 0.75, lines: 2 });
    });
});
