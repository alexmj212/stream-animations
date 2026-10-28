import { describe, it, expect } from 'vitest';
import { bannerGeometry, bannerEnterAt, bannerScrollAt, fontPxForCap, glintAt, resolveBannerKind } from '../../src/shared/animations/banner.js';
import { cubicBezier } from '../../src/shared/animations/alertText.js';
import { config } from '../../src/config/config.js';

const b = config.banner;
const ease = cubicBezier(config.design.motion.ease.enter);

describe('banner kind', () => {
    it('reads ?kind= and falls back to hype', () => {
        expect(resolveBannerKind('ad', b.kinds)).toBe('ad');
        expect(resolveBannerKind(' AD ', b.kinds)).toBe('ad');
        expect(resolveBannerKind('hype', b.kinds)).toBe('hype');
        expect(resolveBannerKind(null, b.kinds)).toBe('hype');
        expect(resolveBannerKind('toString', b.kinds)).toBe('hype');
    });
});

describe('banner geometry', () => {
    it('fills the lane exactly, slanted ends included (DESIGN.md zone plan)', () => {
        const g = bannerGeometry(1920, b.lane, b.skewAngle);
        expect(g.x0 - g.lean).toBeCloseTo(560);
        expect(g.x1 + g.lean).toBeCloseTo(1824);
        expect(g.top).toBe(84);
        expect(g.top + g.height).toBe(132);
        expect(g.lean).toBeCloseTo(Math.tan(15 * Math.PI / 180) * 24);
    });

    it('ends at title-safe, never at the frame edge (the old ad banner ran to x 1920)', () => {
        const g = bannerGeometry(1920, b.lane, b.skewAngle);
        const titleSafeRight = 1920 * (1 - config.design.safe.titleInset);
        expect(g.box.x + g.box.width).toBeLessThanOrEqual(titleSafeRight);
    });

    it('scales with the canvas', () => {
        const g = bannerGeometry(1280, b.lane, b.skewAngle);
        expect(g.box.x).toBeCloseTo(560 * 2 / 3);
        expect(g.height).toBeCloseTo(32);
    });

    it('sits under the toast lane and the goal bar', () => {
        const n = config.notifications.geometry;
        expect(b.lane.y).toBeGreaterThanOrEqual(n.top + n.height);
        expect(b.lane.x).toBe(n.startX);
    });
});

describe('cap height', () => {
    it('sizes the font so the capitals measure capPx', () => {
        // Jost 700's cap height is about 0.7em
        expect(fontPxForCap(32, 70, 100)).toBeCloseTo(45.71, 1);
        expect(fontPxForCap(32, 70, 100) * 0.7).toBeCloseTo(32);
    });

    it('stays over TYPE-1 floor', () => {
        expect(fontPxForCap(b.text.capPx, 70, 100)).toBeGreaterThanOrEqual(config.design.type.minPx);
    });

    it('falls back to 0.7em when the font gives no metrics', () => {
        expect(fontPxForCap(32, 0, 100)).toBeCloseTo(32 / 0.7);
    });
});

describe('banner entrance', () => {
    const timing = b.timing;

    it('starts empty and lands with the words in, then stays', () => {
        const s0 = bannerEnterAt(0, timing, ease);
        expect(s0.stripe).toBe(0);
        expect(s0.plate).toBe(0);
        expect(s0.textAlpha).toBe(0);
        const done = bannerEnterAt(s0.textInMs, timing, ease);
        expect(done).toMatchObject({ stripe: 1, plate: 1, textAlpha: 1, textDx: 0, done: true });
        expect(bannerEnterAt(60000, timing, ease)).toMatchObject({ stripe: 1, plate: 1, textAlpha: 1, done: true });
    });

    it('leads with the stripe, a stagger ahead of the plate (MOTION-4)', () => {
        const s = bannerEnterAt(timing.plateDelayMs, timing, ease);
        expect(s.stripe).toBeGreaterThan(0);
        expect(s.plate).toBe(0);
    });

    it('brings the words in only once the plate has settled', () => {
        const settled = timing.plateDelayMs + timing.plateMs + timing.textDelayMs;
        expect(bannerEnterAt(settled, timing, ease).textAlpha).toBe(0);
        expect(bannerEnterAt(settled + 50, timing, ease).textAlpha).toBeGreaterThan(0);
        expect(bannerEnterAt(settled, timing, ease).textInMs).toBe(settled + timing.textMs);
    });

    it('never moves backwards', () => {
        let prev = bannerEnterAt(0, timing, ease);
        for (let t = 10; t <= 1200; t += 10) {
            const s = bannerEnterAt(t, timing, ease);
            expect(s.stripe).toBeGreaterThanOrEqual(prev.stripe);
            expect(s.plate).toBeGreaterThanOrEqual(prev.plate);
            expect(s.textAlpha).toBeGreaterThanOrEqual(prev.textAlpha);
            prev = s;
        }
    });
});

describe('banner scroll', () => {
    const text = { scrollPauseMs: 1000, scrollPxPerSec: 100 };

    it('holds still when the line fits', () => {
        expect(bannerScrollAt(5000, 0, text)).toBe(0);
    });

    it('pauses, glides to the end, pauses, glides back, and repeats', () => {
        // 200px at 100px/s: 2 s glides, 6 s cycle
        expect(bannerScrollAt(500, 200, text)).toBe(0);
        expect(bannerScrollAt(2000, 200, text)).toBeCloseTo(100);
        expect(bannerScrollAt(3500, 200, text)).toBe(200);
        expect(bannerScrollAt(5000, 200, text)).toBeCloseTo(100);
        expect(bannerScrollAt(6500, 200, text)).toBe(0);
    });

    it('never jumps: each step is small at 60 fps', () => {
        let prev = 0;
        for (let t = 0; t < 12000; t += 1000 / 60) {
            const x = bannerScrollAt(t, 300, text);
            expect(Math.abs(x - prev)).toBeLessThan(5);
            prev = x;
        }
    });
});

describe('glint', () => {
    it('sweeps 0 to 1 over its length, then ends', () => {
        expect(glintAt(0, 900)).toBe(0);
        expect(glintAt(450, 900)).toBeCloseTo(0.5);
        expect(glintAt(899, 900)).toBeGreaterThan(0.99);
        expect(glintAt(900, 900)).toBeNull();
        expect(glintAt(-1, 900)).toBeNull();
    });
});
