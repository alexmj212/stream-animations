import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    goalFor, progressFraction, planChange, countAt, fillAt, sweepAt, parseCount, pollDelay, goalText
} from '../../src/shared/animations/followers.js';
import { followerGeometry, tabularLayout } from '../../src/followers/FollowerBar.js';
import { FollowerSource } from '../../src/followers/source.js';
import { notificationGeometry } from '../../src/notifications/NotificationBar.js';
import { config } from '../../src/config/config.js';

const plan = planChange(config.followers.timing);

describe('goal math', () => {
    it('keeps the goal until it is reached', () => {
        expect(goalFor(946, 1000)).toBe(1000);
        expect(goalFor(946, 1000, 100)).toBe(1000);
    });

    it('without a step, stays on a reached goal', () => {
        expect(goalFor(1003, 1000)).toBe(1000);
        expect(progressFraction(1003, 1000)).toBe(1);
    });

    it('with a step, rolls on past the count', () => {
        expect(goalFor(1000, 1000, 250)).toBe(1250);
        expect(goalFor(1260, 1000, 250)).toBe(1500);
    });

    it('clamps progress and survives a zero goal', () => {
        expect(progressFraction(473, 1000)).toBeCloseTo(0.473);
        expect(progressFraction(-5, 1000)).toBe(0);
        expect(progressFraction(5, 0)).toBe(0);
    });

    it('formats the line like the MIU widget', () => {
        expect(goalText(946, 1000, 'GOOBERS')).toBe('946 / 1000 GOOBERS');
        expect(goalText(946, 1000, '')).toBe('946 / 1000');
    });
});

describe('count change timeline', () => {
    it('holds, ticks in whole numbers, and lands exactly', () => {
        expect(countAt(946, 950, plan, 0)).toBe(946);
        const mid = countAt(946, 950, plan, (plan.fillStart + plan.fillEnd) / 2);
        expect(Number.isInteger(mid)).toBe(true);
        expect(mid).toBeGreaterThan(946);
        expect(mid).toBeLessThanOrEqual(950);
        expect(countAt(946, 950, plan, plan.fillEnd)).toBe(950);
    });

    it('never steps backwards on the way up', () => {
        let prev = 946;
        for (let t = 0; t <= plan.T; t += 1 / 60) {
            const c = countAt(946, 1000, plan, t);
            expect(c).toBeGreaterThanOrEqual(prev);
            prev = c;
        }
    });

    it('fill eases with no jump at either end', () => {
        expect(fillAt(0.4, 0.5, plan, plan.fillStart + 1e-6)).toBeCloseTo(0.4, 5);
        expect(fillAt(0.4, 0.5, plan, plan.fillEnd - 1e-6)).toBeCloseTo(0.5, 5);
        expect(fillAt(0.5, 0.4, plan, plan.T)).toBe(0.4);
    });

    it('the sweep runs once and then reports done', () => {
        expect(sweepAt(plan, -0.1)).toBeNull();
        expect(sweepAt(plan, 0)).toBe(0);
        expect(sweepAt(plan, plan.sweepEnd / 2)).toBeCloseTo(0.5);
        expect(sweepAt(plan, plan.sweepEnd)).toBeNull();
    });
});

describe('parseCount', () => {
    it('reads a MIU counter response', () => {
        // As MIU 1.8.203 answered on Defiant, 2026-10-28
        expect(parseCount({ Counter: { Name: 'followercount', Amount: 946 } })).toBe(946);
        expect(parseCount({ Name: 'followercount', Amount: 946.0 })).toBe(946);
        expect(parseCount({ amount: '947' })).toBe(947);
    });

    it('reads bare numbers and strings', () => {
        expect(parseCount(948)).toBe(948);
        expect(parseCount(' 949 ')).toBe(949);
    });

    it('rejects anything unusable', () => {
        for (const bad of [null, undefined, '', 'abc', -1, NaN, Infinity, {}, { Amount: null }]) {
            expect(parseCount(bad)).toBeNull();
        }
    });
});

describe('pollDelay', () => {
    it('polls at the interval while working, backs off to the cap', () => {
        expect(pollDelay(0, 5000, 60000)).toBe(5000);
        expect(pollDelay(1, 5000, 60000)).toBe(10000);
        expect(pollDelay(3, 5000, 60000)).toBe(40000);
        expect(pollDelay(10, 5000, 60000)).toBe(60000);
    });
});

describe('geometry', () => {
    // The toast grows out of the bar's right end (PR #27): the two scenes
    // must agree on where that is and how it leans
    it('matches the notifications toast', () => {
        const f = followerGeometry(1920);
        const n = notificationGeometry(1920);
        expect(f.top).toBe(n.top);
        expect(f.height).toBe(n.height);
        expect(f.rightX).toBe(n.startX);
        expect(f.lean).toBeCloseTo(n.lean, 9);
    });

    it('scales with the canvas width', () => {
        const big = followerGeometry(1920);
        const small = followerGeometry(1280);
        expect(small.rightX).toBeCloseTo(big.rightX * 2 / 3);
        expect(small.height).toBeCloseTo(big.height * 2 / 3);
    });
});

describe('FollowerSource', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    const debug = { mark: vi.fn() };
    const source = (overrides = {}) => {
        const controller = new AbortController();
        const counts = [];
        const s = new FollowerSource({
            config: config.followers.source,
            mode: 'miu',
            signal: controller.signal,
            debug,
            onCount: (c, info) => counts.push([c, info.via]),
            ...overrides
        });
        return { s, counts, controller };
    };

    it('polls the MIU counter and reports changes only', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ Amount: 946 }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ Amount: 946 }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ Counter: { Name: 'followercount', Amount: 947 } }) });
        vi.stubGlobal('fetch', fetchMock);
        const { s, counts, controller } = source();
        await s.poll();
        await vi.advanceTimersByTimeAsync(config.followers.source.pollMs);
        await vi.advanceTimersByTimeAsync(config.followers.source.pollMs);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8911/api/v2/counters/followercount');
        expect(counts).toEqual([[946, 'miu'], [947, 'miu']]);
        controller.abort();
    });

    it('backs off while MIU is closed and stops on abort', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
        vi.stubGlobal('fetch', fetchMock);
        const { s, controller } = source();
        await s.poll();
        expect(s.failures).toBe(1);
        await vi.advanceTimersByTimeAsync(config.followers.source.pollMs);
        expect(fetchMock).toHaveBeenCalledTimes(1); // waiting 2x the interval now
        await vi.advanceTimersByTimeAsync(config.followers.source.pollMs);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        controller.abort();
        await vi.advanceTimersByTimeAsync(config.followers.source.maxBackoffMs * 2);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('takes counts from a followers window event', () => {
        const { s, counts, controller } = source({ mode: 'url' });
        s.start();
        window.dispatchEvent(new CustomEvent('followers', { detail: { count: 950 } }));
        window.dispatchEvent(new CustomEvent('followers', { detail: { count: 950 } }));
        expect(counts).toEqual([[950, 'event']]);
        controller.abort();
        window.dispatchEvent(new CustomEvent('followers', { detail: { count: 951 } }));
        expect(counts).toEqual([[950, 'event']]);
    });

    it('remembers the last count for the next load', () => {
        const { s, controller } = source({ mode: 'url' });
        s.emit(960, { via: 'test' });
        expect(source().s.stored()).toBe(960);
        controller.abort();
    });
});

describe('tabularLayout', () => {
    // A fake font: digit widths differ, as in Jost ('1' narrow, '4' wide)
    const widths = { 1: 8, 4: 14 };
    const measure = { measureText: (str) => ({ width: [...str].reduce((w, c) => w + (widths[c] ?? 10), 0) }) };

    it('gives every count with as many digits the same width', () => {
        const a = tabularLayout(measure, '946 / 1000 GOOBERS');
        const b = tabularLayout(measure, '111 / 1000 GOOBERS');
        expect(a.width).toBe(b.width);
    });

    it('centres each digit in its cell', () => {
        const { runs } = tabularLayout(measure, '1');
        expect(runs).toEqual([{ text: '1', x: 3 }]); // cell 14, glyph 8
    });

    it('keeps other text as whole runs', () => {
        const { runs } = tabularLayout(measure, '9 GOOBERS');
        expect(runs.map(r => r.text)).toEqual(['9', ' GOOBERS']);
        expect(runs[1].x).toBe(14);
    });
});
