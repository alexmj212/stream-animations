import { describe, it, expect } from 'vitest';
import { spawnedBy, spawnTime, buildWave, marcherAt, waveEndS, unitFor, spriteUrlFrom } from '../../src/shared/animations/spheal.js';
import { createRandom } from '../../src/shared/motion.js';
import { config } from '../../src/config/config.js';

const cfg = config.spheal;
const view = { width: 1920, height: 1080, unit: 1, bottomPad: cfg.marcher.bottomPad, beatS: cfg.song.beatS };

describe('spheal spawn schedule', () => {
    it('spawnTime inverts spawnedBy', () => {
        for (const n of [0, 1, 5, 50, 400]) {
            expect(spawnedBy(spawnTime(n, cfg.spawn), cfg.spawn)).toBeCloseTo(n, 6);
        }
    });

    it('starts with a few and ends absurd (AJ, 2026-10-29)', () => {
        expect(spawnedBy(4, cfg.spawn)).toBeLessThan(3);
        const total = buildWave(cfg, createRandom(1)).length;
        expect(total).toBeGreaterThan(400);
        // The last second of spawning sends dozens at once
        expect(spawnedBy(cfg.spawn.endS, cfg.spawn) - spawnedBy(cfg.spawn.endS - 1, cfg.spawn)).toBeGreaterThan(50);
    });
});

describe('spheal wave', () => {
    const wave = buildWave(cfg, createRandom(7));

    it('is the same for a seed', () => {
        expect(buildWave(cfg, createRandom(7))).toEqual(wave);
    });

    it('ends with the giant, last to set off and last to leave', () => {
        const king = wave[wave.length - 1];
        expect(king.king).toBe(true);
        expect(Math.max(...wave.map(m => m.t0))).toBe(king.t0);
        const end = waveEndS(wave, 1920, 1);
        expect(marcherAt(king, end + 0.01, view).done).toBe(true);
        expect(wave.every(m => marcherAt(m, end + 0.01, view).done)).toBe(true);
        expect(end).toBeCloseTo(king.t0 + (1920 + 2 * king.r) / king.speed, 6);
    });

    it('the giant leaves last on the vertical canvas too', () => {
        const king = wave[wave.length - 1];
        expect(waveEndS(wave, 1080, 1)).toBeCloseTo(king.t0 + (1080 + 2 * king.r) / king.speed, 6);
    });

    it('draws the back of the pile first', () => {
        const depths = wave.slice(0, -1).map(m => m.depth);
        for (let i = 1; i < depths.length; i++) expect(depths[i]).toBeLessThanOrEqual(depths[i - 1]);
    });
});

describe('spheal marcher', () => {
    const base = { t0: 0, r: 36, lift: 0, speed: 150, hopHeight: 24, hopBeats: 1, hopOffset: 0, spin: 1 };

    it('enters from off the left edge at a steady speed', () => {
        const a = marcherAt({ ...base, gait: 'roll' }, 0, view);
        const b = marcherAt({ ...base, gait: 'roll' }, 2, view);
        expect(a.x + a.r).toBeCloseTo(0, 6);
        expect(b.x - a.x).toBeCloseTo(300, 6);
    });

    it('hoppers touch the ground on every beat and leave it between', () => {
        const m = { ...base, gait: 'hop' };
        const beat = cfg.song.beatS;
        for (const k of [1, 2, 3]) {
            const s = marcherAt(m, k * beat, view);
            expect(s.y + s.r * s.sy).toBeCloseTo(s.ground, 4);
            const mid = marcherAt(m, (k + 0.5) * beat, view);
            expect(s.ground - (mid.y + mid.r * mid.sy)).toBeCloseTo(24, 4);
        }
    });

    it('rollers turn one radian per radius travelled', () => {
        const s = marcherAt({ ...base, gait: 'roll' }, 1, view);
        expect(s.rot).toBeCloseTo(150 / 36, 6);
    });

    it('sizes by the shorter side, so vertical matches', () => {
        expect(unitFor(1920, 1080)).toBe(1);
        expect(unitFor(1080, 1920)).toBe(1);
        expect(unitFor(1280, 720)).toBeCloseTo(2 / 3, 6);
    });
});

describe('spheal song loop', () => {
    it('loops one whole phrase starting on a beat', () => {
        const { beatS, loopStartS, loopEndS } = cfg.song;
        expect((loopEndS - loopStartS) / beatS).toBeCloseTo(16, 2);
        expect(loopStartS / beatS).toBeCloseTo(2, 2);
    });
});

describe('spheal PokeAPI sprite', () => {
    // Trimmed from GET https://pokeapi.co/api/v2/pokemon/spheal (2026-10-29)
    const sprites = {
        front_default: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/363.png',
        other: {
            'official-artwork': { front_default: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/363.png' },
            home: { front_default: null }
        }
    };

    it('finds each kind by its config path', () => {
        const kinds = cfg.sprite.kinds;
        expect(spriteUrlFrom(sprites, kinds.art.path)).toMatch(/official-artwork\/363\.png$/);
        expect(spriteUrlFrom(sprites, kinds.pixel.path)).toMatch(/pokemon\/363\.png$/);
    });

    it('returns null for a missing or non-https entry, so the page falls back', () => {
        expect(spriteUrlFrom(sprites, cfg.sprite.kinds.home.path)).toBeNull();
        expect(spriteUrlFrom(sprites, ['nope', 'front_default'])).toBeNull();
        expect(spriteUrlFrom({ front_default: 'javascript:alert(1)' }, ['front_default'])).toBeNull();
        expect(spriteUrlFrom(undefined, ['front_default'])).toBeNull();
    });

    it('has a sprite-host fallback for every kind', () => {
        for (const kind of Object.keys(cfg.sprite.kinds)) expect(cfg.sprite.fallbackFiles[kind]).toBeTruthy();
    });
});
