import { describe, it, expect } from 'vitest';
import { REGIONS } from '../../src/weather/regions.js';
import {
    isUSDaylightTime, localParts, normalsFor, condition, precipType, regionForecast,
    currentConditions, localForecastText, sunTimes, formatClock, nextMoonPhases,
    relativeHumidity, windChill, heatIndex, temperatureAt, regionBulletin, hashSeed
} from '../../src/weather/forecast.js';

const CENTRAL = REGIONS[0];

describe('time zones', () => {
    it('follows US daylight saving time (second Sunday of March to first Sunday of November)', () => {
        // 2026: 8 March and 1 November, at 2:00 local
        expect(isUSDaylightTime(Date.UTC(2026, 2, 8, 7, 59), -6)).toBe(false);
        expect(isUSDaylightTime(Date.UTC(2026, 2, 8, 8, 1), -6)).toBe(true);
        expect(isUSDaylightTime(Date.UTC(2026, 10, 1, 6, 59), -6)).toBe(true);
        expect(isUSDaylightTime(Date.UTC(2026, 10, 1, 7, 1), -6)).toBe(false);
    });

    it('gives local wall-clock parts and the zone name', () => {
        const t = localParts(Date.UTC(2026, 10, 10, 18, 51, 58), CENTRAL);
        expect(t).toMatchObject({ hour: 12, minute: 51, second: 58, zone: 'CST', dow: 2, month: 10, date: 10, doy: 314 });
        const summer = localParts(Date.UTC(2026, 6, 4, 18), CENTRAL);
        expect(summer.zone).toBe('CDT');
        expect(summer.hour).toBe(13);
        // The desert keeps standard time all year
        expect(localParts(Date.UTC(2026, 6, 4, 18), REGIONS[4]).zone).toBe('MST');
    });
});

describe('climate', () => {
    it('eases between the January and July normals', () => {
        const norm = [20, 0, 80, 60];
        expect(normalsFor(norm, 17).hi).toBeCloseTo(20, 5);
        expect(normalsFor(norm, 17 + 182.5).hi).toBeCloseTo(80, 5);
        const nov = normalsFor(norm, 314);
        expect(nov.hi).toBeGreaterThan(20);
        expect(nov.hi).toBeLessThan(80);
    });

    it('picks snow, a mix, storms or rain from the temperatures', () => {
        expect(precipType(30, 20)).toBe('snow');
        expect(precipType(38, 30)).toBe('mix');
        expect(precipType(85, 68)).toBe('storm');
        expect(precipType(55, 44)).toBe('rain');
    });

    it('names skies by cloud cover and precipitation by chance', () => {
        expect(condition({ cloud: 0.1, pop: 0, warm: 60, cold: 40 })).toMatchObject({ label: 'SUNNY', icon: 'sun' });
        expect(condition({ cloud: 0.1, pop: 0, warm: 60, cold: 40 }, true)).toMatchObject({ label: 'CLEAR', icon: 'moon' });
        expect(condition({ cloud: 0.9, pop: 0, warm: 60, cold: 40 })).toMatchObject({ label: 'CLOUDY', icon: 'cloudy' });
        expect(condition({ cloud: 0.9, pop: 50, warm: 60, cold: 40 })).toMatchObject({ label: 'SHOWERS', icon: 'showers' });
        expect(condition({ cloud: 0.9, pop: 80, warm: 30, cold: 20 })).toMatchObject({ label: 'SNOW', icon: 'snow' });
    });
});

describe('regionForecast', () => {
    const when = localParts(Date.UTC(2026, 10, 10, 18), CENTRAL);

    it('is the same for the same region, day and seed, and differs by seed', () => {
        const a = regionForecast(CENTRAL, 0, when, 0);
        expect(regionForecast(CENTRAL, 0, when, 0)).toEqual(a);
        expect(regionForecast(CENTRAL, 0, when, 1)).not.toEqual(a);
    });

    it('gives every town seven sane days in every region and season', () => {
        for (const month of [0, 3, 6, 9]) {
            REGIONS.forEach((region, ri) => {
                const w = localParts(Date.UTC(2026, month, 15, 18), region);
                for (const seed of [0, 1, 2, 3]) {
                    const fc = regionForecast(region, ri, w, seed);
                    expect(fc).toHaveLength(region.towns.length);
                    for (const days of fc) {
                        expect(days).toHaveLength(7);
                        for (const d of days) {
                            expect(d.lo).toBeLessThanOrEqual(d.hi - 6);
                            expect(d.hi).toBeGreaterThan(-30);
                            expect(d.hi).toBeLessThan(125);
                            expect(d.day.pop % 10).toBe(0);
                            expect(d.day.pop).toBeLessThanOrEqual(90);
                            expect(d.windDir).toBeGreaterThanOrEqual(0);
                            expect(d.windDir).toBeLessThan(8);
                        }
                    }
                }
            });
        }
    });

    it('runs warmer in July than January', () => {
        const mean = (month) => {
            const w = localParts(Date.UTC(2026, month, 17, 18), CENTRAL);
            let sum = 0;
            let n = 0;
            for (let seed = 0; seed < 20; seed++) {
                for (const days of regionForecast(CENTRAL, 0, w, seed)) { sum += days[0].hi; n++; }
            }
            return sum / n;
        };
        expect(mean(6) - mean(0)).toBeGreaterThan(40);
    });
});

describe('current conditions', () => {
    const when = localParts(Date.UTC(2026, 10, 10, 18), CENTRAL);
    const fc = regionForecast(CENTRAL, 0, when, 0);

    it('peaks near 3 PM and bottoms out near dawn', () => {
        const d = { hi: 60, lo: 40, nextLo: 42 };
        expect(temperatureAt(15, d)).toBeCloseTo(60, 5);
        expect(temperatureAt(6, d)).toBeCloseTo(40, 5);
        expect(temperatureAt(23, d)).toBeGreaterThan(42);
        expect(temperatureAt(23, d)).toBeLessThan(60);
    });

    it('fills every row with something sensible', () => {
        for (let h = 0; h < 24; h++) {
            const now = currentConditions(fc[0], h + 0.5, 7, CENTRAL.wet);
            expect(now.humidity).toBeGreaterThanOrEqual(1);
            expect(now.humidity).toBeLessThanOrEqual(100);
            expect(now.dew).toBeLessThanOrEqual(now.temp);
            expect(['R', 'F', 'S']).toContain(now.trend);
            expect(Number(now.pressure)).toBeGreaterThan(29);
            expect(Number(now.pressure)).toBeLessThan(31);
            expect(now.label.length).toBeGreaterThan(0);
        }
    });

    it('uses the NWS formulas for humidity, wind chill and heat index', () => {
        expect(relativeHumidity(70, 70)).toBe(100);
        expect(relativeHumidity(80, 60)).toBeCloseTo(51, -1);
        expect(windChill(30, 15)).toBe(19);          // NWS chart
        expect(windChill(60, 15)).toBeNull();
        expect(heatIndex(90, 50)).toBeCloseTo(95, -1); // NWS chart: 95
        expect(heatIndex(70, 50)).toBeNull();
    });
});

describe('local forecast text', () => {
    const when = localParts(Date.UTC(2026, 10, 10, 18), CENTRAL);
    const fc = regionForecast(CENTRAL, 0, when, 0);

    it('starts with TODAY before 3 PM and TONIGHT after', () => {
        const morning = localForecastText(fc[0], { hour: 9, dow: 2 });
        expect(morning.map((p) => p.title)).toEqual(['TODAY', 'TONIGHT', 'WEDNESDAY']);
        const evening = localForecastText(fc[0], { hour: 17, dow: 2 });
        expect(evening.map((p) => p.title)).toEqual(['TONIGHT', 'WEDNESDAY', 'WEDNESDAY NIGHT']);
    });

    it('says the high by day and the low by night', () => {
        const [today, tonight] = localForecastText(fc[0], { hour: 9, dow: 2 });
        expect(today.text).toContain(`HIGH NEAR ${fc[0][0].hi}.`);
        expect(tonight.text).toContain(`LOW AROUND ${fc[0][0].nextLo}.`);
        expect(tonight.text).not.toMatch(/SUNNY/);
    });
});

describe('almanac', () => {
    it('matches published sunrise and sunset within a few minutes', () => {
        // Minneapolis, 10 Nov 2026: about 7:03 AM and 4:47 PM CST (UTC-6)
        const s = sunTimes(2026, 10, 10, 44.98, -93.27);
        expect(Math.abs(s.rise - 6 * 60 - (7 * 60 + 3))).toBeLessThan(6);
        expect(Math.abs(s.set - 6 * 60 - (16 * 60 + 47))).toBeLessThan(6);
    });

    it('formats clock times', () => {
        expect(formatClock(0)).toBe('12:00 AM');
        expect(formatClock(7 * 60 + 3)).toBe('7:03 AM');
        expect(formatClock(16 * 60 + 51)).toBe('4:51 PM');
        expect(formatClock(-60)).toBe('11:00 PM');
    });

    it('lists the next four moon phases, soonest first, about a week apart', () => {
        const now = Date.UTC(2026, 10, 10);
        const phases = nextMoonPhases(now);
        expect(phases.map((p) => p.name).sort()).toEqual(['FIRST', 'FULL', 'LAST', 'NEW']);
        for (let i = 1; i < 4; i++) {
            const gap = (phases[i].utcMs - phases[i - 1].utcMs) / 86400000;
            expect(gap).toBeGreaterThan(7);
            expect(gap).toBeLessThan(7.8);
        }
        expect(phases[0].utcMs).toBeGreaterThanOrEqual(now);
        // A known full moon: 24 Nov 2026 (mean phase, within a day)
        const full = phases.find((p) => p.name === 'FULL');
        expect(Math.abs(full.utcMs - Date.UTC(2026, 10, 24, 15))).toBeLessThan(1.5 * 86400000);
    });
});

describe('crawl', () => {
    it('reports the warmest and coolest towns of the region', () => {
        const when = localParts(Date.UTC(2026, 10, 10, 18), CENTRAL);
        const fc = regionForecast(CENTRAL, 0, when, 0);
        const line = regionBulletin(CENTRAL, fc, when.dow);
        const his = fc.map((d) => d[0].hi);
        expect(line).toContain(`FROM ${Math.min(...his)} AT`);
        expect(line).toContain(`TO ${Math.max(...his)} AT`);
        expect(line.startsWith('NORTHERN LAKES:')).toBe(true);
    });

    it('mixes seeds into distinct values', () => {
        expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(1, 2, 4));
        expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3));
    });
});
