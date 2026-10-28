import { describe, it, expect } from 'vitest';
import { bannerGeometry, fontPxForCap, revealAt, marqueeOffsetAt, marqueeCopies, resolveBannerKind, hueAt } from '../../src/shared/animations/banner.js';
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
    it('is the toast lane, x 560-1824, y 26-74 (AJ, #86)', () => {
        const g = bannerGeometry(1920, b.lane);
        expect(g.x).toBe(560);
        expect(g.x + g.width).toBe(1824);
        expect(g.y).toBe(26);
        expect(g.y + g.height).toBe(74);
        expect(g.mid).toBe(50);
    });

    it('ends at title-safe, never at the frame edge (the old ad banner ran to x 1920)', () => {
        const g = bannerGeometry(1920, b.lane);
        expect(g.x + g.width).toBeLessThanOrEqual(1920 * (1 - config.design.safe.titleInset));
    });

    it('scales with the canvas', () => {
        const g = bannerGeometry(1280, b.lane);
        expect(g.x).toBeCloseTo(560 * 2 / 3);
        expect(g.height).toBeCloseTo(32);
        expect(g.lean).toBeCloseTo(bannerGeometry(1920, b.lane).lean * 2 / 3);
    });

    it('fills the toast\'s own place, with its leaning ends', () => {
        const n = config.notifications.geometry;
        expect(b.lane.y).toBe(n.top);
        expect(b.lane.height).toBe(n.height);
        expect(b.lane.x).toBe(n.startX);
        expect(b.lane.x + b.lane.width).toBe(n.maxEndX);
        expect(b.lane.skewAngle).toBe(n.skewAngle);
        // The top edge sits right of mid-height, like the toast's (about 6.4px)
        expect(bannerGeometry(1920, b.lane).lean).toBeCloseTo(Math.tan(15 * Math.PI / 180) * 24);
    });

    it('has no lean without a skewAngle', () => {
        expect(bannerGeometry(1920, { x: 0, y: 0, width: 10, height: 48 }).lean).toBeCloseTo(0);
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

describe('hue cycle', () => {
    const cycle = { baseHue: 40, swingDeg: 180, sweepMs: 10000 };

    it('sweeps the whole wheel over 10 s and back, like the OBS Move Value pair', () => {
        expect(hueAt(0, cycle)).toBeCloseTo(220);       // 40 - 180
        expect(hueAt(5000, cycle)).toBeCloseTo(40);     // the base, halfway
        expect(hueAt(10000, cycle)).toBeCloseTo(220);   // 40 + 180, the same colour
        expect(hueAt(15000, cycle)).toBeCloseTo(40);
    });

    it('never jumps between frames', () => {
        let prev = hueAt(0, cycle);
        for (let t = 0; t < 40000; t += 1000 / 60) {
            const h = hueAt(t, cycle);
            const d = Math.abs(h - prev);
            expect(Math.min(d, 360 - d)).toBeLessThan(1.5);
            prev = h;
        }
    });

    it('is configured on hype only', () => {
        expect(b.kinds.hype.hueCycle).toBeTruthy();
        expect(b.kinds.hype.border.px).toBe(4);
        expect(b.kinds.ad.hueCycle).toBeNull();
        expect(b.kinds.ad.border).toBeNull();
    });
});
