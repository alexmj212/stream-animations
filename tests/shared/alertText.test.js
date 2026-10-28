import { describe, it, expect } from 'vitest';
import {
    cubicBezier, wordCount, readingHoldMs, planAlertText, textOffsetAt,
    splitNameAction, balancedLines, overflowLines, ellipsize, fitShadeText, fitSidebarText, strokeWidthPx
} from '../../src/shared/animations/alertText.js';
import { config } from '../../src/config/config.js';

// Every glyph 0.6em wide
const measure = (s, px) => s.length * px * 0.6;

describe('cubicBezier', () => {
    it('matches CSS ease-out and ease-in cubic at known points', () => {
        const enter = cubicBezier(config.design.motion.ease.enter);
        const exit = cubicBezier(config.design.motion.ease.exit);
        expect(enter(0)).toBe(0);
        expect(enter(1)).toBe(1);
        // [0.33, 1, 0.68, 1] is easeOutCubic to within a percent
        for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
            expect(enter(p)).toBeCloseTo(1 - (1 - p) ** 3, 1);
            expect(exit(p)).toBeCloseTo(p ** 3, 1);
        }
    });

    it('is monotonic and clamps outside 0-1', () => {
        const ease = cubicBezier([0.65, 0, 0.35, 1]);
        let last = -1;
        for (let p = 0; p <= 1; p += 0.01) {
            expect(ease(p)).toBeGreaterThanOrEqual(last - 1e-9);
            last = ease(p);
        }
        expect(ease(-1)).toBe(0);
        expect(ease(2)).toBe(1);
    });
});

describe('reading time', () => {
    it('counts words and floors the hold at the minimum', () => {
        expect(wordCount('  Check out  @someone ')).toBe(3);
        expect(readingHoldMs('Check out @someone', 200, 3000)).toBe(3000);
        expect(readingHoldMs('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen', 200, 3000)).toBe(3200);
    });
});

describe('planAlertText', () => {
    const base = { holdMs: 3000, enterMs: 500, settleMs: 150, exitMs: 350 };

    it('adds enter, settle, hold and exit', () => {
        const p = planAlertText(base);
        expect(p.enterEnd).toBeCloseTo(0.5);
        expect(p.exitStart).toBeCloseTo(3.65);
        expect(p.exitEnd).toBeCloseTo(4.0);
        expect(p.total).toBeCloseTo(4.0);
    });

    it('treats a URL duration as a minimum: longer lengthens the hold, shorter cannot cut it', () => {
        expect(planAlertText({ ...base, minTotalMs: 6000 }).exitStart).toBeCloseTo(5.65);
        const short = planAlertText({ ...base, minTotalMs: 3000 });
        expect(short.total).toBeCloseTo(4.0);
        expect(short.exitStart - short.enterEnd).toBeCloseTo(3.15);
    });

    it('never runs past maxTotalMs, shortening the hold', () => {
        const p = planAlertText({ ...base, holdMs: 9000, minTotalMs: 3000, maxTotalMs: 6800 });
        expect(p.total).toBeCloseTo(6.8);
        expect(p.exitEnd).toBeCloseTo(6.8);
        expect(p.exitStart).toBeCloseTo(6.45);
    });

    it('leaves a tail after the text has gone', () => {
        const p = planAlertText({ ...base, tailMs: 500 });
        expect(p.exitEnd).toBeCloseTo(4.0);
        expect(p.total).toBeCloseTo(4.5);
    });
});

describe('textOffsetAt', () => {
    const plan = planAlertText({ holdMs: 3000, enterMs: 500, settleMs: 150, exitMs: 350 });
    const lin = (p) => Math.min(1, Math.max(0, p));

    it('arrives from inPx, holds at 0, leaves to outPx', () => {
        expect(textOffsetAt(plan, 1000, -2000, lin, lin, 0)).toBe(1000);
        expect(textOffsetAt(plan, 1000, -2000, lin, lin, 0.25)).toBeCloseTo(500);
        expect(textOffsetAt(plan, 1000, -2000, lin, lin, 0.5)).toBeCloseTo(0);
        expect(textOffsetAt(plan, 1000, -2000, lin, lin, 3.65)).toBeCloseTo(0);
        expect(textOffsetAt(plan, 1000, -2000, lin, lin, 4.0)).toBe(-2000);
    });
});

describe('splitNameAction', () => {
    it('finds the first @name and keeps the action in order', () => {
        expect(splitNameAction('Check out @thegigglepussgang')).toEqual({ name: '@thegigglepussgang', action: 'Check out', nameFirst: false });
        expect(splitNameAction('@aspiritualbumpit RAID!!')).toEqual({ name: '@aspiritualbumpit', action: 'RAID!!', nameFirst: true });
        expect(splitNameAction('@a gifted a sub to @b!')).toEqual({ name: '@a', action: 'gifted a sub to @b!', nameFirst: true });
    });

    it('returns null without a name, or with nothing else', () => {
        expect(splitNameAction('HYPE TRAIN LEVEL 3')).toBeNull();
        expect(splitNameAction('@solo')).toBeNull();
        expect(splitNameAction('email @ me')).toBeNull();
    });
});

describe('balancedLines and ellipsize', () => {
    it('breaks where the wider line is narrowest', () => {
        expect(balancedLines('aaaa bb cc dddd', s => s.length)).toEqual(['aaaa bb', 'cc dddd']);
        expect(balancedLines('single', s => s.length)).toEqual(['single']);
    });

    it('cuts with an ellipsis only when the line overflows', () => {
        expect(ellipsize('short', s => s.length, 10)).toBe('short');
        expect(ellipsize('much too long', s => s.length, 8)).toBe('much to…');
    });
});

describe('overflowLines', () => {
    it('fills the first line and ellipsizes only the last, so no words drop from the middle', () => {
        const text = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ');
        const lines = overflowLines(text, s => s.length, 40);
        expect(lines).toHaveLength(2);
        expect(lines[0].endsWith('…')).toBe(false);
        expect(lines[1].endsWith('…')).toBe(true);
        const shown = `${lines[0]} ${lines[1].slice(0, -1)}`.trim();
        expect(text.startsWith(shown.replace(/\s*\S*$/, ''))).toBe(true);
        for (const l of lines) expect(l.length).toBeLessThanOrEqual(40);
    });
});

describe('fitShadeText', () => {
    const sizes = { hero: 96, display: 72, minPx: 40 };

    it('keeps hero size when the line fits title-safe', () => {
        expect(fitShadeText('@aspiritualbumpit RAID!!', measure, 1728, sizes)).toEqual({ lines: ['@aspiritualbumpit RAID!!'], px: 96 });
    });

    it('shrinks one line down to display before wrapping', () => {
        const fit = fitShadeText('x'.repeat(35), measure, 1728, sizes);
        expect(fit.lines).toHaveLength(1);
        expect(fit.px).toBeLessThan(96);
        expect(fit.px).toBeGreaterThanOrEqual(72);
        expect(measure(fit.lines[0], fit.px)).toBeCloseTo(1728);
    });

    it('wraps name / action at display size, every line inside the width', () => {
        const fit = fitShadeText('@aspiritualbumpit gifted 50 tier 1 subs!! welcome in', measure, 1728, sizes);
        expect(fit.lines).toEqual(['@aspiritualbumpit', 'gifted 50 tier 1 subs!! welcome in']);
        expect(fit.px).toBe(72);
    });

    it('never goes under minPx and never overflows', () => {
        const fit = fitShadeText('word '.repeat(80).trim(), measure, 1728, sizes);
        expect(fit.px).toBeGreaterThanOrEqual(40);
        for (const line of fit.lines) expect(measure(line, fit.px)).toBeLessThanOrEqual(1728);
        // Words read on without a gap: only the last line is cut
        expect(fit.lines[0].endsWith('…')).toBe(false);
    });
});

describe('fitSidebarText', () => {
    const sizes = { headline: 56, label: 40, minPx: 40, minScale: 0.75 };

    it('sets the name at headline and the action at label, in reading order', () => {
        expect(fitSidebarText('CHECK OUT @THEGIGGLEPUSSGANG', measure, 864, sizes)).toEqual([
            { text: 'CHECK OUT', px: 40, role: 'action' },
            { text: '@THEGIGGLEPUSSGANG', px: 56, role: 'name' }
        ]);
        expect(fitSidebarText('@NAME RESUBBED! (14 MONTHS)', measure, 864, sizes).map(l => l.role)).toEqual(['name', 'action']);
    });

    it('shrinks a long name, never under 75% or the floor', () => {
        const [, name] = fitSidebarText('CHECK OUT @' + 'X'.repeat(25), measure, 864, sizes);
        expect(name.px).toBeLessThan(56);
        expect(name.px).toBeGreaterThanOrEqual(42);
        expect(measure(name.text, name.px)).toBeLessThanOrEqual(864);
    });

    it('sets text without a name on one headline line, then two', () => {
        expect(fitSidebarText('NOW PLAYING', measure, 864, sizes)).toEqual([{ text: 'NOW PLAYING', px: 56, role: 'line' }]);
        const lines = fitSidebarText('THANK YOU SO MUCH FOR THE HUGE RAID EVERYBODY WELCOME IN', measure, 864, sizes);
        expect(lines).toHaveLength(2);
        for (const l of lines) {
            expect(l.px).toBe(42);
            expect(measure(l.text, l.px)).toBeLessThanOrEqual(864);
        }
    });
});

describe('strokeWidthPx', () => {
    it('is 0.08em, never under 3px', () => {
        expect(strokeWidthPx(96, config.design.type)).toBeCloseTo(7.68);
        expect(strokeWidthPx(20, config.design.type)).toBe(3);
    });
});
