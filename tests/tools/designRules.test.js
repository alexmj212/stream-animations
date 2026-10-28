import { describe, it, expect } from 'vitest';
import {
    textSamples, checkTitleSafe, checkPlayerChrome, checkTypeFloor, checkReadingTime,
    checkStaticCover, luminanceTransitions, maxFlashesPerSecond, evaluateDesignRules
} from '../../tools/motion/designRules.js';
import { config } from '../../src/config/config.js';

const design = config.design;
const FRAME = 1000 / 60;

/** Frames of one text sample, box from a function of t (ms). */
const textFrames = (ms, boxAt, extra = {}) => {
    const out = [];
    for (let t = 0; t <= ms; t += FRAME) out.push({ t, samples: [{ id: 'text', onscreen: true, box: boxAt(t), fontPx: 56, words: 3, ...extra }] });
    return out;
};
const still = (x, y, w = 400, h = 60) => () => ({ x, y, width: w, height: h });

/** Frames whose 16x9 luminance grid comes from a function of t (ms). */
const gridFrames = (ms, lumAt, opaque = 0) => {
    const out = [];
    for (let t = 0; t <= ms; t += FRAME) {
        const l = lumAt(t);
        out.push({ t, pixels: { opaque: typeof opaque === 'function' ? opaque(t) : opaque, grid: Array.from({ length: 144 }, (_, i) => (Array.isArray(l) ? l[i] : l)) } });
    }
    return out;
};

describe('placement rules', () => {
    it('passes text inside title-safe and above the player controls', () => {
        const texts = textSamples(textFrames(500, still(200, 400)));
        expect(checkTitleSafe(texts, design, 1920, 1080).pass).toBe(true);
        expect(checkPlayerChrome(texts, design, 1080).pass).toBe(true);
    });

    it('fails SAFE-1 for text in the top margin (the top-left widgets today)', () => {
        const r = checkTitleSafe(textSamples(textFrames(500, still(76, 32, 336, 37))), design, 1920, 1080);
        expect(r.pass).toBe(false);
        expect(r.detail).toMatch(/outside title-safe/);
    });

    it('fails SAFE-3 for text under the player controls', () => {
        expect(checkPlayerChrome(textSamples(textFrames(500, still(200, 1000))), design, 1080).pass).toBe(false);
    });

    it('fails with no text reported, so a scene that stops reporting is noticed', () => {
        expect(checkTitleSafe([], design, 1920, 1080).pass).toBe(false);
    });

    it('ignores samples flagged off screen', () => {
        expect(textSamples([{ t: 0, samples: [{ id: 'text', onscreen: false, box: { x: 2000, y: 0, width: 10, height: 10 } }] }])).toEqual([]);
    });
});

describe('TYPE-1', () => {
    it('holds the smallest drawn size to the floor', () => {
        expect(checkTypeFloor(textSamples(textFrames(100, still(200, 400))), 40).pass).toBe(true);
        expect(checkTypeFloor(textSamples(textFrames(100, still(200, 400), { fontPx: 32 })), 40).pass).toBe(false);
    });
});

describe('TIME-1', () => {
    it('passes text that holds still for its reading time', () => {
        expect(checkReadingTime(textSamples(textFrames(3500, still(200, 400))), FRAME).pass).toBe(true);
    });

    it('fails text that never stops moving (the shade scroll)', () => {
        const r = checkReadingTime(textSamples(textFrames(5000, t => ({ x: 1500 - t * 0.2, y: 400, width: 400, height: 60 }))), FRAME);
        expect(r.pass).toBe(false);
        expect(r.detail).toMatch(/still for 0ms/);
    });

    it('reads movement from the line, not a clipped box that stays put', () => {
        const frames = [];
        for (let t = 0; t <= 5000; t += FRAME) frames.push({ t, samples: [{ id: 'text', x: 500 - t * 0.1, y: 40, box: { x: 475, y: 33, width: 1350, height: 34 }, words: 3 }] });
        expect(checkReadingTime(textSamples(frames), FRAME).pass).toBe(false);
    });

    it('asks 200ms a word past 15 words', () => {
        const r = checkReadingTime(textSamples(textFrames(3500, still(200, 400), { words: 20 })), FRAME);
        expect(r.pass).toBe(false);
        expect(r.detail).toMatch(/need 4000ms/);
    });
});

describe('CUT-2', () => {
    it('fails a cover that sits still too long', () => {
        expect(checkStaticCover(gridFrames(1000, () => 0.3, 1), 300).pass).toBe(false);
    });

    it('passes a cover that keeps moving', () => {
        expect(checkStaticCover(gridFrames(1000, t => 0.1 + t / 2000, 1), 300).pass).toBe(true);
    });

    it('ignores still frames that are not fully covered', () => {
        expect(checkStaticCover(gridFrames(1000, () => 0.3, 0.5), 300).pass).toBe(true);
    });
});

describe('FLASH-1/2', () => {
    it('counts a 5Hz full-frame square wave as 5 flashes a second', () => {
        const frames = gridFrames(2000, t => (Math.floor(t / 100) % 2 ? 0.6 : 0.1));
        expect(maxFlashesPerSecond(luminanceTransitions(frames))).toBeGreaterThanOrEqual(4);
    });

    it('counts one cover-and-reveal as one flash', () => {
        // A stinger: dark, bright for 600ms, dark again
        const frames = gridFrames(1500, t => (t > 400 && t < 1000 ? 0.5 : 0));
        expect(maxFlashesPerSecond(luminanceTransitions(frames))).toBe(1);
    });

    it('ignores a slow fade', () => {
        expect(luminanceTransitions(gridFrames(3000, t => t / 3000 * 0.5))).toEqual([]);
    });

    it('ignores a flash over less than a quarter of the frame', () => {
        const small = (t) => Array.from({ length: 144 }, (_, i) => (i < 20 && Math.floor(t / 100) % 2 ? 0.8 : 0));
        expect(luminanceTransitions(gridFrames(2000, small))).toEqual([]);
    });
});

describe('evaluateDesignRules', () => {
    const frames = textFrames(500, still(76, 32, 336, 37));

    it('reports a failing rule as a warning unless it is enforced', () => {
        const [r] = evaluateDesignRules({ rules: ['SAFE-1'] }, frames, design, 1920, 1080);
        expect(r).toMatchObject({ pass: true, warn: true });
    });

    it('fails a rule listed in fail', () => {
        const [r] = evaluateDesignRules({ rules: ['SAFE-1'], fail: ['SAFE-1'] }, frames, design, 1920, 1080);
        expect(r.pass).toBe(false);
        expect(r.warn).toBeUndefined();
    });

    it('takes the flash limits from config.design.flash', () => {
        const once = gridFrames(1500, t => (t > 400 && t < 1000 ? 0.5 : 0));
        const strict = { ...design, flash: { maxPerSecond: 0, fullFieldMaxPerSecond: 0 } };
        const results = evaluateDesignRules({ rules: ['FLASH-1', 'FLASH-2'], fail: ['FLASH-1', 'FLASH-2'] }, once, strict, 1920, 1080);
        expect(results.map(r => r.pass)).toEqual([false, false]);
        expect(results[0].name).toMatch(/At most 0 flashes/);
    });

    it('checks placement only inside holdMs', () => {
        const flyIn = textFrames(1000, t => ({ x: t < 500 ? 1900 : 200, y: 400, width: 400, height: 60 }));
        const [r] = evaluateDesignRules({ rules: ['SAFE-1'], fail: ['SAFE-1'], holdMs: [600, 1000] }, flyIn, design, 1920, 1080);
        expect(r.pass).toBe(true);
    });
});
