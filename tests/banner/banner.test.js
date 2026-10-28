import { describe, it, expect } from 'vitest';
import { bannerGeometry, fontPxForCap, revealAt, marqueeOffsetAt, marqueeCopies, resolveBannerKind } from '../../src/shared/animations/banner.js';
import { cubicBezier } from '../../src/shared/animations/alertText.js';
import { contrastRatio } from '../../src/shared/design.js';
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
    it('is the lane of the zone plan, x 560-1824, y 84-132', () => {
        const g = bannerGeometry(1920, b.lane);
        expect(g.x).toBe(560);
        expect(g.x + g.width).toBe(1824);
        expect(g.y).toBe(84);
        expect(g.y + g.height).toBe(132);
        expect(g.mid).toBe(108);
    });

    it('ends at title-safe, never at the frame edge (the old ad banner ran to x 1920)', () => {
        const g = bannerGeometry(1920, b.lane);
        expect(g.x + g.width).toBeLessThanOrEqual(1920 * (1 - config.design.safe.titleInset));
    });

    it('scales with the canvas', () => {
        const g = bannerGeometry(1280, b.lane);
        expect(g.x).toBeCloseTo(560 * 2 / 3);
        expect(g.height).toBeCloseTo(32);
    });

    it('sits under the toast lane and the goal bar', () => {
        const n = config.notifications.geometry;
        expect(b.lane.y).toBeGreaterThanOrEqual(n.top + n.height);
        expect(b.lane.x).toBe(n.startX);
    });
});

describe('banner looks', () => {
    it('keeps the ad plate opaque, so it covers the hype strip when both are up', () => {
        expect(b.kinds.ad.fillAlpha).toBe(1);
    });

    it('keeps the ad text readable on its plate (COLOR-2)', () => {
        expect(contrastRatio(b.kinds.ad.textColor, b.kinds.ad.fill)).toBeGreaterThanOrEqual(4.5);
    });
});

describe('cap height', () => {
    it('sizes the font so the capitals measure capPx', () => {
        expect(fontPxForCap(32, 70, 100)).toBeCloseTo(45.71, 1);
        expect(fontPxForCap(32, 70, 100) * 0.7).toBeCloseTo(32);
    });

    it('stays over the TYPE-1 floor', () => {
        expect(fontPxForCap(b.text.capPx, 70, 100)).toBeGreaterThanOrEqual(config.design.type.minPx);
    });

    it('falls back to 0.7em when the font gives no metrics', () => {
        expect(fontPxForCap(32, 0, 100)).toBeCloseTo(32 / 0.7);
    });
});

describe('strip reveal', () => {
    it('wipes in over revealMs and stays', () => {
        expect(revealAt(0, 500, ease)).toBe(0);
        expect(revealAt(250, 500, ease)).toBeGreaterThan(0.5);
        expect(revealAt(500, 500, ease)).toBe(1);
        expect(revealAt(60000, 500, ease)).toBe(1);
    });
});

describe('marquee', () => {
    it('scrolls at a constant speed and wraps every repeat', () => {
        expect(marqueeOffsetAt(0, 400, 120)).toBe(0);
        expect(marqueeOffsetAt(1000, 400, 120)).toBeCloseTo(120);
        expect(marqueeOffsetAt(4000, 400, 120)).toBeCloseTo(80);
    });

    it('never jumps: the wrap lands on the next copy, a whole repeat along', () => {
        const unit = 400;
        let prev = 0;
        for (let t = 0; t < 10000; t += 1000 / 60) {
            const x = marqueeOffsetAt(t, unit, 120);
            const step = (x - prev + unit) % unit;
            expect(step).toBeLessThan(3);
            prev = x;
        }
    });

    it('tiles enough copies to fill the lane at any offset', () => {
        expect(marqueeCopies(1264, 400)).toBe(5);
        expect(marqueeCopies(1264, 400) * 400 - 400).toBeGreaterThanOrEqual(1264);
    });

    it('is safe with no width yet', () => {
        expect(marqueeOffsetAt(1000, 0, 120)).toBe(0);
    });
});
