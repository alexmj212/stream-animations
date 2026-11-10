import { describe, it, expect } from 'vitest';
import { worldPx, viewFor, tilesFor, broadcastColors } from '../../src/weather/radar.js';
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
