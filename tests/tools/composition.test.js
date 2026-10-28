import { describe, it, expect } from 'vitest';
import {
    ELEMENTS, PAIRS, KNOWN_OVERLAPS, elementsFor, intersect, overlaps, placementBreaks, pairFindings
} from '../../tools/motion/composition.js';
import { config } from '../../src/config/config.js';

const el = (id, box, extra = {}) => ({ id, label: id, box, kind: 'G', ...extra });

describe('composition checks', () => {
    it('intersects boxes and ignores edges that only touch', () => {
        expect(intersect([0, 0, 10, 10], [5, 5, 20, 20])).toEqual([5, 5, 10, 10]);
        expect(intersect([0, 0, 10, 10], [10, 0, 20, 10])).toBeNull();
    });

    it('counts an overlap only when something readable or a camera is involved', () => {
        expect(overlaps([el('a', [0, 0, 10, 10]), el('b', [5, 5, 20, 20])])).toEqual([]);
        expect(overlaps([el('a', [0, 0, 10, 10], { read: true }), el('b', [5, 5, 20, 20])])).toHaveLength(1);
    });

    it('skips two elements of one exclusive group', () => {
        const els = [el('a', [0, 0, 10, 10], { read: true }), el('b', [5, 5, 20, 20], { read: true })];
        expect(overlaps(els, [['a', 'b']])).toEqual([]);
    });

    it('flags readable boxes under the player controls or off the frame', () => {
        const breaks = placementBreaks([el('ad', [0, 1057, 1920, 1094], { read: true })], config.design);
        expect(breaks.map(b => b.rule)).toEqual(['off frame', 'SAFE-3']);
        expect(placementBreaks([el('ok', [0, 900, 100, 994], { read: true })], config.design)).toEqual([]);
    });

    it('builds the old layout with today', () => {
        expect(elementsFor(['hype'], { today: true })[0].box).toEqual([0, 28, 1920, 97]);
        expect(() => elementsFor(['nope'])).toThrow(/Unknown/);
    });

    it('has a unique id per element and only known ids in pairs', () => {
        expect(new Set(ELEMENTS.map(e => e.id)).size).toBe(ELEMENTS.length);
        for (const p of PAIRS) expect(() => elementsFor(p.ids)).not.toThrow();
    });
});

// Design review gated pairs 1, 2, 5 and 6 as rule fixes; Defiant moves the
// sources (composition/defiant-steps-collisions.md). A new overlap fails,
// and so does a known one that stops happening, so the list stays true
describe('the fixed layout (Rotom, 2026-10-28)', () => {
    const found = PAIRS.filter(p => p.enforce).flatMap(pairFindings);

    it('adds no overlap or placement break beyond the known ones', () => {
        expect(found.filter(f => !KNOWN_OVERLAPS.includes(f))).toEqual([]);
    });

    it('keeps no stale entry in the known list', () => {
        expect(KNOWN_OVERLAPS.filter(k => !found.includes(k))).toEqual([]);
    });

    it('fails the old layout, so the check can catch a regression', () => {
        const today = PAIRS.filter(p => p.enforce).flatMap(p => {
            const els = elementsFor(p.ids, { today: true });
            return overlaps(els, p.exclusive).map(h => `${p.name}: ${h.a} x ${h.b}`);
        });
        expect(today).toContain('hype-train: hype x toast');
        expect(today).toContain('toast-lane: toast x remote');
    });
});
