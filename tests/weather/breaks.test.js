import { describe, it, expect } from 'vitest';
import { ADS, pickAd } from '../../src/weather/ads.js';
import { AD_LAYOUTS } from '../../src/weather/adLayouts.js';
import { JOKES, jokeAt } from '../../src/weather/jokes.js';

describe('pickAd', () => {
    it('takes turns through the text ads when there are no videos', () => {
        const picks = Array.from({ length: ADS.length + 2 }, (_, k) => pickAd(k, ADS.length, 0));
        expect(picks.every((p) => p.kind === 'text')).toBe(true);
        expect(new Set(picks.map((p) => p.index)).size).toBe(ADS.length);
        expect(picks[ADS.length]).toEqual(picks[0]);
    });

    it('brings every text and video ad round once a cycle, videos between text ads', () => {
        const total = ADS.length + 2;
        const picks = Array.from({ length: total }, (_, k) => pickAd(k, ADS.length, 2));
        expect(picks.slice(0, 4).map((p) => p.kind)).toEqual(['text', 'video', 'text', 'video']);
        expect(new Set(picks.filter((p) => p.kind === 'text').map((p) => p.index)).size).toBe(ADS.length);
        expect(new Set(picks.filter((p) => p.kind === 'video').map((p) => p.index)).size).toBe(2);
    });

    it('copes with more videos than text ads and with negative counts', () => {
        const picks = Array.from({ length: 5 }, (_, k) => pickAd(k, 1, 4));
        expect(picks.filter((p) => p.kind === 'video').map((p) => p.index).sort()).toEqual([0, 1, 2, 3]);
        expect(pickAd(-1, ADS.length, 0)).toEqual({ kind: 'text', index: ADS.length - 1 });
    });

    it('gives every ad a name, a known layout, fine print and a picture, at a readable length', () => {
        for (const ad of ADS) {
            expect(ad.name.length).toBeGreaterThan(0);
            expect(AD_LAYOUTS).toContain(ad.layout);
            expect(ad.fine.length).toBeGreaterThan(0);
            expect(['car', 'perfume', 'pup', 'pizza', 'bear', 'banana', 'paw', 'roller', 'tape', 'flannel', 'crystal', 'form']).toContain(ad.art);
            // Fictional numbers only: 555-0100 to 555-0199
            for (const n of JSON.stringify(ad).match(/\d{3}-\d{4}/g) ?? []) expect(n).toMatch(/^555-01\d\d$/);
            // A 10 s hold: about 50 words at most (head-writer review, 2026-11-11)
            const words = JSON.stringify(Object.entries(ad).filter(([k]) => !['layout', 'art', 'colors', 'pattern', 'board', 'photo', 'photoFocus', 'credit'].includes(k)))
                .replace(/["[\],:]/g, ' ').split(/\s+/).filter((w) => /[A-Za-z0-9$]/.test(w));
            expect(words.length, ad.name).toBeLessThanOrEqual(62);
        }
    });

    it('never runs the same format twice in a row, wrap included', () => {
        ADS.forEach((ad, i) => expect(ad.layout, ad.name).not.toBe(ADS[(i + 1) % ADS.length].layout));
    });

    it('still sells something: every ad names a price or a deal', () => {
        // AJ (2026-11-11): "The ads need like prices or services advertised"
        for (const ad of ADS) expect(JSON.stringify(ad), ad.name).toMatch(/\$\d|BOGO|FREE|SAME DAY/);
    });
});

describe('jokes', () => {
    it('runs through every joke in turn, upper case and short enough for the strip', () => {
        expect(new Set(JOKES.map((_, k) => jokeAt(k))).size).toBe(JOKES.length);
        expect(jokeAt(JOKES.length)).toBe(jokeAt(0));
        expect(jokeAt(-1)).toBe(JOKES[JOKES.length - 1]);
        for (const j of JOKES) {
            expect(j).toBe(j.toUpperCase());
            expect(j.length).toBeLessThanOrEqual(110);
        }
    });
});
