import { describe, it, expect, vi } from 'vitest';
import { worldPx, viewFor, tilesFor, broadcastColors, placeLabels, RadarLoader } from '../../src/weather/radar.js';
import { REGIONS } from '../../src/weather/regions.js';
import { STATES, NEIGHBOURS } from '../../src/weather/basemap.js';

describe('worldPx', () => {
    it('puts 0,0 at the middle of the world', () => {
        expect(worldPx(0, 0, 0)).toEqual({ x: 128, y: 128 });
        expect(worldPx(0, -180, 1).x).toBe(0);
    });
});

describe('viewFor', () => {
    it('fits every town of every region inside the margin', () => {
        for (const region of REGIONS) {
            const v = viewFor(region.towns, 1284, 668);
            expect(v.zoom).toBeGreaterThanOrEqual(3);
            for (const t of region.towns) {
                const p = worldPx(t.lat, t.lon, v.zoom);
                expect(p.x - v.x0).toBeGreaterThan(1284 * 0.15);
                expect(p.x - v.x0).toBeLessThan(1284 * 0.85);
                expect(p.y - v.y0).toBeGreaterThan(668 * 0.15);
                expect(p.y - v.y0).toBeLessThan(668 * 0.85);
            }
        }
    });

    it('zooms in closer for a tight cluster', () => {
        const tight = viewFor([{ lat: 40.7, lon: -74 }, { lat: 40.8, lon: -73.9 }], 1284, 668);
        const wide = viewFor([{ lat: 47.6, lon: -122.3 }, { lat: 25.8, lon: -80.2 }], 1284, 668);
        expect(tight.zoom).toBe(7);
        expect(wide.zoom).toBeLessThan(tight.zoom);
    });
});

describe('tilesFor', () => {
    it('covers the whole view with 512px tiles at zoom - 1', () => {
        const view = { zoom: 6, x0: 4000, y0: 6000, w: 1284, h: 668 };
        const tiles = tilesFor(view);
        expect(tiles.every((t) => t.z === 5)).toBe(true);
        expect(Math.min(...tiles.map((t) => t.dx))).toBeLessThanOrEqual(0);
        expect(Math.max(...tiles.map((t) => t.dx + 512))).toBeGreaterThanOrEqual(view.w);
        expect(Math.min(...tiles.map((t) => t.dy))).toBeLessThanOrEqual(0);
        expect(Math.max(...tiles.map((t) => t.dy + 512))).toBeGreaterThanOrEqual(view.h);
    });
});

describe('broadcastColors', () => {
    it('turns blue returns green and leaves warm colours and clear pixels alone', () => {
        const px = new Uint8ClampedArray([
            40, 120, 220, 255,      // blue: light rain
            230, 40, 30, 255,       // red: heavy
            0, 0, 255, 0            // transparent
        ]);
        broadcastColors(px);
        expect(px[1]).toBeGreaterThan(px[0]);
        expect(px[1]).toBeGreaterThan(px[2]);
        expect([...px.slice(4, 8)]).toEqual([230, 40, 30, 255]);
        expect([...px.slice(8, 12)]).toEqual([0, 0, 255, 0]);
    });
});

describe('basemap', () => {
    it('holds the lower 48 and the neighbours as flat lon/lat rings', () => {
        expect(STATES.length).toBeGreaterThan(48);
        expect(NEIGHBOURS.length).toBeGreaterThan(0);
        const ring = STATES[0][0];
        expect(ring.length % 2).toBe(0);
        expect(ring[0]).toBeLessThan(-60);
        expect(ring[1]).toBeGreaterThan(20);
    });
});

describe('placeLabels', () => {
    const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const box = (s, width) => {
        const x = s.align === 'left' ? s.x : s.align === 'right' ? s.x - width : s.x - width / 2;
        return { x, y: s.y - 28, w: width, h: 34 };
    };

    it('keeps two close towns apart and off each other\'s dots', () => {
        const marks = [{ x: 400, y: 300 }, { x: 430, y: 312 }];
        const widths = [200, 200];
        const spots = placeLabels(marks, widths, 1284, 590);
        expect(spots.every(Boolean)).toBe(true);
        const [a, b] = spots.map((s, i) => box(s, widths[i]));
        expect(overlaps(a, b)).toBe(false);
        marks.forEach((m) => {
            const dot = { x: m.x - 9, y: m.y - 9, w: 18, h: 18 };
            expect(overlaps(a, dot)).toBe(false);
            expect(overlaps(b, dot)).toBe(false);
        });
    });

    it('flips a label left at the right edge and drops one with no room', () => {
        expect(placeLabels([{ x: 1240, y: 300 }], [200], 1284, 590)[0].align).toBe('right');
        const crowd = Array.from({ length: 9 }, () => ({ x: 600, y: 300 }));
        const spots = placeLabels(crowd, crowd.map(() => 300), 1284, 590);
        expect(spots.filter(Boolean).length).toBeLessThan(crowd.length);
    });
});

describe('RadarLoader', () => {
    const cfg = { frames: 2, indexUrl: 'https://radar.test/index.json', indexTtlMs: 300000, refreshMs: 600000, timeoutMs: 10000, colorScheme: 2, alpha: 0.85 };
    const towns = [{ name: 'A', lat: 40, lon: -100 }, { name: 'B', lat: 41, lon: -98 }];
    const noop = () => {};

    it('keeps one build per region running across cuts, even when the network is slow', async () => {
        let calls = 0;
        let release;
        const fetch = () => {
            calls++;
            return new Promise((resolve) => { release = () => resolve({ ok: false, status: 503 }); });
        };
        const radar = new RadarLoader({ w: 64, h: 32, cfg, fetch });
        const first = radar.prepare('MIDWEST', towns, noop, noop);
        await new Promise((r) => setTimeout(r, 30));
        // The next cuts ask again while the index fetch hangs
        const again = radar.prepare('MIDWEST', towns, noop, noop);
        expect(again).toBe(first);
        await new Promise((r) => setTimeout(r, 30));
        expect(calls).toBe(1);
        release();
        await first;
        expect(radar.ready).toBeNull();
        expect(radar.building).toBeNull();
    });

    it('drops a superseded build once its index arrives', async () => {
        const pending = [];
        const fetch = () => new Promise((resolve) => pending.push(resolve));
        const radar = new RadarLoader({ w: 64, h: 32, cfg, fetch });
        const old = radar.prepare('WEST', towns, noop, noop);
        await new Promise((r) => setTimeout(r, 30));
        radar.prepare('EAST', towns, noop, noop);
        const paint = vi.spyOn(radar, 'paintBase');
        pending[0]({ ok: true, json: async () => ({ host: 'https://radar.test', radar: { past: [{ time: 1, path: '/p' }] } }) });
        await old;
        expect(paint).not.toHaveBeenCalled();
        expect(radar.ready).toBeNull();
    });
});
