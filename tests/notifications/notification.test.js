import { describe, it, expect } from 'vitest';
import {
    notificationDurationMs, planNotificationTimeline, extentAt, textStateAt, streakFrontAt, wipeAt, scrollOffsetAt, extraLengthFor
} from '../../src/shared/animations/notification.js';
import { planStreaks, fitStreaksToText, notificationGeometry, resolveColorLayout, NotificationBar } from '../../src/notifications/NotificationBar.js';
import { createRandom } from '../../src/shared/motion.js';
import { config } from '../../src/config/config.js';
import { createMockCanvas, createMockContext } from '../fixtures/canvas-contexts.js';

const timing = config.notifications.timing;
const wipeMs = config.notifications.flair.wipe.ms;

/** Finite-difference velocity just before and just after time t. */
function velocities(f, t, h = 1e-4) {
    return [(f(t) - f(t - h)) / h, (f(t + h) - f(t)) / h];
}

describe('notificationDurationMs', () => {
    it('uses the default for short text', () => {
        expect(notificationDurationMs('Thanks for the follow', timing)).toBe(timing.defaultDurationMs);
    });

    it('stretches long text to hold at 200 ms a word', () => {
        const words = Array(25).fill('word').join(' ');
        const ms = notificationDurationMs(words, timing);
        const hold = ms * (1 - timing.inProportion - timing.outProportion);
        expect(hold).toBeGreaterThanOrEqual(25 * timing.msPerWord);
    });
});

describe('planNotificationTimeline', () => {
    for (const w of [0, wipeMs]) {
        it(`keeps every phase inside the duration (wipe ${w})`, () => {
            const { T, lead, body, text } = planNotificationTimeline(5000, timing, w);
            expect(T).toBe(5);
            expect(lead.outEnd).toBe(T);
            expect(body.outEnd).toBeLessThanOrEqual(T);
            // The body trails the lead out and beats it home
            expect(body.inStart).toBeGreaterThan(lead.inStart);
            expect(body.outStart).toBeLessThan(lead.outStart);
            // Text only shows while the body is fully out
            expect(text.inStart).toBeGreaterThanOrEqual(body.inEnd);
            expect(text.outEnd).toBeLessThanOrEqual(body.outStart);
            expect(text.inEnd).toBeLessThan(text.outStart);
        });
    }
});

describe('extentAt', () => {
    const { lead } = planNotificationTimeline(5000, timing);
    const L = 1100;
    const f = (t) => extentAt(lead, L, t);

    it('is 0 before and after, full while holding', () => {
        expect(f(0)).toBe(0);
        expect(f(5)).toBe(0);
        expect(f((lead.inEnd + lead.outStart) / 2)).toBe(L);
    });

    it('settles into the hold and leaves it at rest (no velocity jump)', () => {
        for (const t of [lead.inEnd, lead.outStart]) {
            const [before, after] = velocities(f, t);
            expect(Math.abs(before)).toBeLessThan(1);
            expect(Math.abs(after)).toBeLessThan(1);
        }
    });

    it('never overshoots its length', () => {
        for (let t = 0; t <= 5; t += 0.01) {
            expect(f(t)).toBeGreaterThanOrEqual(-1e-9);
            expect(f(t)).toBeLessThanOrEqual(L + 1e-9);
        }
    });
});

describe('textStateAt', () => {
    const { text } = planNotificationTimeline(5000, timing);
    it('fades in sliding, holds, fades out in place', () => {
        expect(textStateAt(text, 24, text.inStart).alpha).toBe(0);
        expect(textStateAt(text, 24, (text.inEnd + text.outStart) / 2)).toEqual({ alpha: 1, dx: 0 });
        expect(textStateAt(text, 24, text.outEnd).alpha).toBe(0);
        const mid = textStateAt(text, 24, (text.inStart + text.inEnd) / 2);
        expect(mid.dx).toBeLessThan(0);
        expect(mid.alpha).toBeGreaterThan(0);
    });
});

describe('streaks', () => {
    const tl = planNotificationTimeline(5000, timing, wipeMs);
    const geo = notificationGeometry(1920);

    it('are deterministic per seed and differ between seeds', () => {
        const a = planStreaks(tl, geo, 1, createRandom(7));
        const b = planStreaks(tl, geo, 1, createRandom(7));
        const c = planStreaks(tl, geo, 1, createRandom(8));
        expect(a).toEqual(b);
        expect(a).not.toEqual(c);
    });

    it('lead the gradient out, drift smoothly and are home by the end', () => {
        for (let seed = 1; seed <= 6; seed++) {
            for (const s of planStreaks(tl, geo, 1, createRandom(seed))) {
                expect(s.inEnd).toBeLessThan(tl.lead.inEnd);
                expect(s.outStart).toBeGreaterThanOrEqual(tl.body.outStart);
                expect(s.outEnd).toBeLessThanOrEqual(tl.T);
                const f = (t) => streakFrontAt(s, t);
                expect(f(0)).toBe(s.home);
                expect(f(tl.T)).toBe(s.home);
                for (const t of [s.inEnd, s.outStart]) {
                    const [before, after] = velocities(f, t);
                    expect(Math.abs(before - s.drift)).toBeLessThan(0.5);
                    expect(Math.abs(after - s.drift)).toBeLessThan(0.5);
                }
            }
        }
    });

    it('spread over the bar height: one per slot', () => {
        const streaks = planStreaks(tl, geo, 1, createRandom(3));
        const ys = streaks.map(s => s.y + s.height / 2).sort((p, q) => p - q);
        const span = geo.height + 2 * config.notifications.flair.streaks.spread;
        const slot = span / ys.length;
        ys.forEach((y, i) => {
            const slotTop = geo.top - config.notifications.flair.streaks.spread + i * slot;
            expect(y).toBeGreaterThanOrEqual(slotTop);
            expect(y).toBeLessThanOrEqual(slotTop + slot);
        });
    });
});

describe('fitStreaksToText', () => {
    const tl = planNotificationTimeline(5000, timing, wipeMs);
    const geo = notificationGeometry(1920);
    const c = config.notifications.flair.streaks;

    for (const textRight of [900, 1200, 1500]) {
        it(`keeps every streak tail clear of text ending at ${textRight}px, through the hold`, () => {
            for (let seed = 1; seed <= 6; seed++) {
                const streaks = planStreaks(tl, geo, 1, createRandom(seed));
                fitStreaksToText(streaks, textRight, 1);
                for (const s of streaks) {
                    // Leftmost painted px at rest; drift only moves it right
                    expect(s.rest - s.length - s.lean).toBeGreaterThanOrEqual(textRight + c.textGap - 1e-9);
                    expect(s.length).toBeGreaterThanOrEqual(c.minVisible - 1e-9);
                }
            }
        });
    }

    it('is idempotent and re-fits from the planned values', () => {
        const a = planStreaks(tl, geo, 1, createRandom(2));
        fitStreaksToText(a, 1500, 1);
        fitStreaksToText(a, 900, 1);
        const b = planStreaks(tl, geo, 1, createRandom(2));
        fitStreaksToText(b, 900, 1);
        expect(a.map(s => [s.rest, s.length])).toEqual(b.map(s => [s.rest, s.length]));
    });
});

describe('wipeAt', () => {
    it('sweeps from start to end at rest at both ends, null outside', () => {
        const seg = { inStart: 1, inEnd: 1.5 };
        expect(wipeAt(seg, 0, 100, 0.9)).toBeNull();
        expect(wipeAt(seg, 0, 100, 1.6)).toBeNull();
        expect(wipeAt(seg, 0, 100, 1.25)).toBeCloseTo(50, 5);
    });
});

describe('notificationGeometry', () => {
    it('starts at the follower bar and scales with the width', () => {
        const g = notificationGeometry(1920);
        expect(g.startX).toBe(config.notifications.geometry.startX);
        expect(g.startX + g.leadLength).toBe(config.notifications.geometry.endX);
        const half = notificationGeometry(960);
        expect(half.leadLength).toBeCloseTo(g.leadLength / 2, 6);
        expect(half.top).toBeCloseTo(g.top / 2, 6);
    });
});

describe('resolveColorLayout', () => {
    const stops = [{ h: 0, s: 0, l: 0 }];
    it('falls back to the OBS colors without a palette (?scheme=mono)', () => {
        expect(resolveColorLayout('along', null)).toBe('classic');
    });
    it('takes a valid ?colorlayout= and ignores junk', () => {
        expect(resolveColorLayout('screen', stops)).toBe('screen');
        expect(resolveColorLayout('nonsense', stops)).toBe(config.notifications.colorLayout);
    });
});

describe('NotificationBar', () => {
    function make(options = {}) {
        const canvas = createMockCanvas(1920, 1080);
        const ctx = createMockContext(canvas);
        return new NotificationBar(ctx, canvas, { text: 'Thanks for the follow', durationMs: 5000, random: createRandom(1), ...options });
    }

    it('is inactive at the end and draws without throwing through the whole play', () => {
        for (const style of ['creative', 'clean']) {
            const bar = make({ style });
            for (let t = 0; t < 5; t += 1 / 30) {
                bar.setTime(t);
                expect(() => bar.draw()).not.toThrow();
            }
            bar.setTime(5);
            expect(bar.active).toBe(false);
        }
    });

    it('fits the streaks to the text on the first build (no NaN)', () => {
        const bar = make({ style: 'creative' });
        expect(Number.isFinite(bar.textInk.right)).toBe(true);
        for (const st of bar.streaks) {
            expect(Number.isFinite(st.rest)).toBe(true);
            expect(Number.isFinite(st.length)).toBe(true);
        }
    });

    it('only the creative style has streaks', () => {
        expect(make({ style: 'creative' }).streaks.length).toBe(config.notifications.flair.streaks.count);
        expect(make({ style: 'clean' }).streaks.length).toBe(0);
    });
});

describe('long text', () => {
    it('extraLengthFor grows the bar only as much as needed, up to the cap', () => {
        expect(extraLengthFor(800, 1000, 300)).toBe(0);
        expect(extraLengthFor(1100.2, 1000, 300)).toBe(101);
        expect(extraLengthFor(2000, 1000, 300)).toBe(300);
    });

    it('scrollOffsetAt holds, glides smoothly, then holds at the end', () => {
        const seg = { inEnd: 1, outStart: 6 };
        expect(scrollOffsetAt(seg, 0, 0.8, 3)).toBe(0);
        expect(scrollOffsetAt(seg, 200, 0.8, 1.5)).toBe(0);
        expect(scrollOffsetAt(seg, 200, 0.8, 3.5)).toBeCloseTo(100, 6);
        expect(scrollOffsetAt(seg, 200, 0.8, 5.5)).toBe(200);
        const f = (t) => scrollOffsetAt(seg, 200, 0.8, t);
        for (const t of [1.8, 5.2]) {
            const [before, after] = velocities(f, t);
            expect(Math.abs(before)).toBeLessThan(0.5);
            expect(Math.abs(after)).toBeLessThan(0.5);
        }
    });

    it('the grown bar ends at maxEndX (measuring needs a real browser: notifications-long in the harness)', () => {
        const g = config.notifications.geometry;
        const geo = notificationGeometry(1920, g.maxEndX - g.endX);
        expect(geo.startX + geo.leadLength).toBeCloseTo(g.maxEndX, 6);
    });
});
