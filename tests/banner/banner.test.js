import { describe, it, expect } from 'vitest';
import { bannerLayout, bannerGeometry, fontPxForCap, revealAt, marqueeOffsetAt, marqueeCopies, resolveBannerKind, hueAt, yieldAlphaStep } from '../../src/shared/animations/banner.js';
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
    it('is the toast lane, from the follower bar to the frame edge, y 26-74 (AJ, #86)', () => {
        const g = bannerGeometry(1920, b.lane);
        expect(g.x).toBe(560);
        expect(g.x + g.width).toBe(1920);
        expect(g.y).toBe(26);
        expect(g.y + g.height).toBe(74);
        expect(g.mid).toBe(50);
    });

    it('touches the follower bar and runs all the way across (AJ, #86)', () => {
        expect(b.lane.x).toBe(config.followers.geometry.rightX);
        expect(b.lane.x + b.lane.width).toBe(1920);
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
        expect(b.lane.skewAngle).toBe(n.skewAngle);
        // The top edge sits right of mid-height, like the toast's (about 6.4px)
        expect(bannerGeometry(1920, b.lane).lean).toBeCloseTo(Math.tan(15 * Math.PI / 180) * 24);
    });

    it('has no lean without a skewAngle', () => {
        expect(bannerGeometry(1920, { x: 0, y: 0, width: 10, height: 48 }).lean).toBeCloseTo(0);
    });
});

describe('vertical layout (AJ, #86)', () => {
    it('picks portrait for a page taller than wide, or ?layout=', () => {
        expect(bannerLayout(1080, 1920, null, b).name).toBe('vertical');
        expect(bannerLayout(1920, 1080, null, b).name).toBe('wide');
        expect(bannerLayout(1920, 1080, 'vertical', b).name).toBe('vertical');
        expect(bannerLayout(1080, 1920, 'wide', b).name).toBe('wide');
    });

    it('runs full width on the seam, in the portrait toast\'s band (AJ: "full width")', () => {
        const l = bannerLayout(1080, 1920, null, b);
        const g = bannerGeometry(1080, l.lane, l.refWidth);
        const n = config.notifications.vertical.geometry;
        expect(g.k).toBe(1);
        expect(g.x).toBe(0);
        expect(g.x + g.width).toBe(1080);
        expect(l.textClip.x).toBe(n.startX);
        expect(l.textClip.x + l.textClip.width).toBe(n.endX);
        expect(g.y).toBe(n.top);
        expect(g.height).toBe(n.height);
        expect(g.mid).toBe(config.design.vertical.seamY);
    });

    it('keeps every word inside the phone-safe box (V-SAFE-1)', () => {
        const { textClip } = bannerLayout(1080, 1920, null, b);
        const safe = config.design.vertical.safe;
        expect(textClip.x).toBeGreaterThanOrEqual(safe.leftPx);
        expect(textClip.x + textClip.width).toBeLessThanOrEqual(1080 - safe.rightPx);
        expect(bannerLayout(1920, 1080, null, b).textClip).toBeNull();
    });

    it('fades out for a seam alert and back after, over fadeMs at any frame rate', () => {
        const fade = b.vertical.yield.fadeMs;
        let a = 1;
        for (let t = 0; t < fade; t += 1000 / 30) a = yieldAlphaStep(a, true, 1000 / 30, fade);
        expect(a).toBeCloseTo(0, 5);
        expect(yieldAlphaStep(0, true, 16, fade)).toBe(0);
        let c = 0;
        for (let t = 0; t < fade; t += 1000 / 120) c = yieldAlphaStep(c, false, 1000 / 120, fade);
        expect(c).toBeCloseTo(1, 5);
        expect(yieldAlphaStep(1, false, 16, fade)).toBe(1);
    });

    it('sizes the caps over the phone floor (V-TYPE-1)', () => {
        const { capPx } = bannerLayout(1080, 1920, null, b);
        expect(fontPxForCap(capPx, 70, 100)).toBeGreaterThanOrEqual(config.design.vertical.type.minPx);
    });
});

describe('banner looks', () => {
    it('puts the ad along the bottom edge at half opacity (AJ, #86)', () => {
        const l = bannerLayout(1920, 1080, null, b, 'ad');
        const g = bannerGeometry(1920, l.lane);
        expect(g.x).toBe(0);
        expect(g.width).toBe(1920);
        expect(g.y + g.height).toBe(1080);
        expect(g.lean).toBeCloseTo(0);
        expect(b.kinds.ad.opacity).toBe(0.5);
        // The hype train keeps the toast lane; on vertical both share the seam
        expect(bannerLayout(1920, 1080, null, b, 'hype').lane).toBe(b.lane);
        expect(bannerLayout(1080, 1920, null, b, 'ad').lane).toBe(b.vertical.lane);
    });

    it('keeps the ad plate solid under its opacity, so the text keeps its contrast', () => {
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
