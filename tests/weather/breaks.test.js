import { describe, it, expect } from 'vitest';
import { ADS, pickAd } from '../../src/weather/ads.js';
import { JOKES, jokeAt } from '../../src/weather/jokes.js';
import { score, renderMusicSync, BPM } from '../../src/weather/music.js';

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

    it('gives every ad a name, a pitch, fine print and a picture', () => {
        for (const ad of ADS) {
            expect(ad.name.length).toBeGreaterThan(0);
            expect(ad.lines.length).toBeGreaterThan(0);
            expect(ad.fine.length).toBeGreaterThan(0);
            expect(['mattress', 'perfume', 'car', 'tape', 'pizza', 'tooth', 'form', 'tag', 'mug']).toContain(ad.art);
        }
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

describe('music', () => {
    it('is 32 bars, every note inside the loop', () => {
        const { events, seconds } = score();
        expect(seconds).toBeCloseTo((32 * 4 * 60) / BPM, 6);
        expect(events.every((e) => e.t >= 0 && e.t < seconds)).toBe(true);
        expect(events.some((e) => e.v === 'lead')).toBe(true);
    });

    it('renders the same loop every time, peaking at 0 dBFS', () => {
        const sr = 8000;
        const a = renderMusicSync(sr);
        const b = renderMusicSync(sr);
        expect(a.channels).toHaveLength(2);
        expect(a.channels[0].length).toBe(Math.round(a.seconds * sr));
        let peak = 0;
        for (const c of a.channels) for (const v of c) peak = Math.max(peak, Math.abs(v));
        expect(peak).toBeCloseTo(1, 6);
        expect(a.channels[1]).toEqual(b.channels[1]);
    });
});
