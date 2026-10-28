import { describe, it, expect } from 'vitest';
import { titlePlate, titleStateAt } from '../../src/shared/animations/titleCard.js';
import { cubicBezier } from '../../src/shared/animations/alertText.js';
import { config } from '../../src/config/config.js';

const plate = config.title.plate;
const timing = config.title.timing;
const ease = cubicBezier(config.design.motion.ease.enter);

describe('title plate', () => {
    it('leans by the house slant and starts the text inside title-safe', () => {
        const g = titlePlate(500, plate);
        expect(g.lean).toBeCloseTo(Math.tan(15 * Math.PI / 180) * 124);
        expect(g.width).toBeCloseTo(500 + 2 * plate.padX + g.lean);
        expect(g.textX).toBeGreaterThanOrEqual(config.design.grid.marginPx);
    });

    it('keeps its bottom edge above the player controls', () => {
        const g = titlePlate(500, plate);
        expect(g.top + g.height).toBeLessThanOrEqual(config.design.playerChromeTop * 1080);
    });

    it('grows upward for a second line, keeping the bottom edge', () => {
        const one = titlePlate(500, plate);
        const two = titlePlate(500, plate, 100);
        expect(two.top + two.height).toBeCloseTo(one.top + one.height);
        expect(two.height).toBeCloseTo(one.height + 100);
        expect(two.mid).toBeCloseTo(one.mid - 50);
    });
});

describe('title entrance', () => {
    it('starts with the plate off the left edge and no text', () => {
        const s = titleStateAt(0, timing, 800, ease);
        expect(s.plateDx).toBeCloseTo(-800);
        expect(s.textAlpha).toBe(0);
        expect(s.done).toBe(false);
    });

    it('lands the plate before the text starts', () => {
        const s = titleStateAt(timing.enterMs, timing, 800, ease);
        expect(Math.abs(s.plateDx)).toBeLessThan(1e-9);
        expect(s.textAlpha).toBe(0);
    });

    it('holds still once done, so the scene can stop drawing', () => {
        const end = timing.enterMs + timing.textDelayMs + timing.textMs;
        const a = titleStateAt(end, timing, 800, ease);
        const b = titleStateAt(end + 60000, timing, 800, ease);
        expect(a.done).toBe(true);
        expect(a).toEqual(b);
        expect(a.textAlpha).toBe(1);
        expect(a.textDx).toBeCloseTo(0);
    });
});
