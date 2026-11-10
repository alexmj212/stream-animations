import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { iconFromNws, shortLabel, skyShort, observationToNow, forecastToPages, NwsSource, DemoSource } from '../../src/weather/data.js';
import { REGIONS, DEMO_REGIONS } from '../../src/weather/regions.js';

const fixture = (name) => JSON.parse(readFileSync(resolve('tests/fixtures/weather', name), 'utf8'));

describe('iconFromNws', () => {
    it('maps NWS icon codes to our icon kinds', () => {
        expect(iconFromNws('https://api.weather.gov/icons/land/day/skc?size=medium')).toBe('sun');
        expect(iconFromNws('https://api.weather.gov/icons/land/night/sct?size=medium')).toBe('partlymoon');
        expect(iconFromNws('https://api.weather.gov/icons/land/day/tsra,40?size=medium')).toBe('storm');
        expect(iconFromNws('https://api.weather.gov/icons/land/day/rain_showers,30?size=medium')).toBe('showers');
        expect(iconFromNws('https://api.weather.gov/icons/land/day/ovc?size=medium')).toBe('cloudy');
        expect(iconFromNws('https://api.weather.gov/icons/land/day/fzra?size=medium')).toBe('mix');
    });

    it('gives each sky word its matching art', () => {
        const day = '/icons/land/day/sky';
        const words = {
            Sunny: 'sun', 'Mostly Sunny': 'mostlysun', 'Partly Sunny': 'partly', 'Partly Cloudy': 'partly',
            'Mostly Cloudy': 'mostlycloudy', Cloudy: 'cloudy', Clear: 'sun'
        };
        for (const [w, icon] of Object.entries(words)) expect(iconFromNws(day, w), w).toBe(icon);
        expect(iconFromNws('/icons/land/night/sky', 'Clear')).toBe('moon');
        expect(iconFromNws('/icons/land/night/sky', 'Mostly Clear')).toBe('moon');
    });

    it('falls back to the text when there is no icon', () => {
        expect(iconFromNws(null, 'Thunderstorms')).toBe('storm');
        expect(iconFromNws(null, 'Fog')).toBe('fog');
    });
});

describe('shortLabel', () => {
    it('keeps the part before "then" and shortens storm words', () => {
        expect(shortLabel('Chance Showers And Thunderstorms then Sunny')).toBe('CHANCE T-STORMS');
        expect(shortLabel('Rain Likely')).toBe('RAIN');
        expect(shortLabel('Slight Chance Rain')).toBe('CHANCE RAIN');
    });
});

describe('skyShort', () => {
    it('cuts the longest NWS sky words for a table cell', () => {
        expect(skyShort('THUNDERSTORM IN VICINITY')).toBe('T-STORM NEARBY');
        expect(skyShort('LIGHT RAIN AND FOG/MIST')).toBe('LIGHT RAIN & FOG');
        expect(skyShort('CLEAR')).toBe('CLEAR');
    });
});

describe('observationToNow', () => {
    it('converts a station observation to the page units', () => {
        const now = observationToNow(fixture('obs-KSEA.json').properties);
        expect(now.temp).toBe(55);
        expect(now.dew).toBe(52);
        expect(now.humidity).toBe(88);
        expect(now.wind).toBe(8);
        expect(now.windDir).toBe('SE');
        expect(now.gust).toBeNull();
        expect(now.pressure).toBe('30.05');
        expect(now.visibility).toBe(10);
        expect(now.ceiling).toBe(3500);
        expect(now.label).toBe('LIGHT RAIN');
        expect(now.icon).toBe('rain');
        expect(now.time).toBe(Date.parse('2026-11-10T18:25:00Z'));
    });

    it('returns null for a missing observation and dashes for missing values', () => {
        expect(observationToNow(null)).toBeNull();
        const now = observationToNow({ temperature: { value: null }, textDescription: '' });
        expect(now.temp).toBeNull();
        expect(now.label).toBe('--');
    });

    it('reads the sky from the cloud layers when a station sends no words or icon', () => {
        const day = observationToNow({ textDescription: '', icon: null, cloudLayers: [{ amount: 'FEW' }, { amount: 'SCT' }] });
        expect(day.label).toBe('PARTLY CLOUDY');
        expect(day.icon).toBe('partly');
        const night = observationToNow({ textDescription: '', icon: null, cloudLayers: [{ amount: 'CLR' }] }, true);
        expect(night.label).toBe('CLEAR');
        expect(night.icon).toBe('moon');
    });

    it('names the sky from the icon when a station sends no words', () => {
        const now = observationToNow({ textDescription: '', icon: 'https://api.weather.gov/icons/land/day/skc?size=medium' });
        expect(now.label).toBe('SUNNY');
    });
});

describe('forecastToPages', () => {
    const pages = forecastToPages(fixture('forecast-LOT.json').properties);

    it('takes the first three periods as the local forecast', () => {
        expect(pages.periods.map((p) => p.title)).toEqual(['THIS AFTERNOON', 'TONIGHT', 'VETERANS DAY']);
        expect(pages.periods[0].text).toBe(pages.periods[0].text.toUpperCase());
    });

    it('starts the extended forecast tomorrow, named by date not by holiday', () => {
        expect(pages.days).toHaveLength(4);
        expect(pages.days[0]).toMatchObject({ name: 'WED', hi: 54, lo: 39, label: 'CHANCE RAIN', icon: 'rain' });
        expect(pages.days[1]).toMatchObject({ name: 'THU', hi: 46, lo: 34 });
    });
});

describe('NwsSource', () => {
    const cfg = { forecastTtlMs: 1800000, observationTtlMs: 600000, staleAfterMs: 3 * 3600000, timeoutMs: 1000, retryAfterMs: 60000 };
    const forecast = fixture('forecast-LOT.json');
    const obs = fixture('obs-KSEA.json');

    function source(nowMs) {
        const calls = [];
        const fetch = async (url) => {
            calls.push(url);
            return { ok: true, json: async () => (url.includes('/forecast') ? forecast : obs) };
        };
        return { calls, src: new NwsSource({ cfg, fetch, now: () => nowMs }) };
    }

    it('fetches one forecast and one observation per town, then serves the cache', async () => {
        const { calls, src } = source(Date.parse('2026-11-10T19:00:00Z'));
        expect(src.get(0)).toBeNull();
        await src.ensure(0);
        expect(calls).toHaveLength(1 + REGIONS[0].towns.length);
        const d = src.get(0);
        expect(d.source).toBe('nws');
        expect(d.home.name).toBe(REGIONS[0].towns[0].name);
        expect(d.home.days).toHaveLength(4);
        expect(d.towns.every((t) => t.now.temp === 55)).toBe(true);
        await src.ensure(0);
        expect(calls).toHaveLength(1 + REGIONS[0].towns.length);
    });

    it('gives a home station with no sky the forecast\'s words', async () => {
        const blank = { properties: { ...obs.properties, textDescription: '', icon: null, cloudLayers: [], timestamp: '2026-11-10T18:25:00+00:00' } };
        const fetch = async (url) => ({ ok: true, json: async () => (url.includes('/forecast') ? forecast : blank) });
        const src = new NwsSource({ cfg, fetch, now: () => Date.parse('2026-11-10T19:00:00Z') });
        await src.ensure(0);
        const d = src.get(0);
        expect(d.home.now.label).toBe('SUNNY');
        expect(d.home.now.icon).toBe('sun');
        expect(d.towns[1].now.label).toBe('--');
    });

    it('drops observations too old to call current', async () => {
        const { src } = source(Date.parse('2026-11-10T23:00:00Z'));
        await src.ensure(0);
        expect(src.get(0).towns.every((t) => t.now === null)).toBe(true);
        expect(src.get(0).home.periods).toHaveLength(3);
    });

    it('holds off a failed URL instead of asking every page', async () => {
        let calls = 0;
        let t = 0;
        const src = new NwsSource({ cfg, fetch: async () => { calls++; return { ok: false, status: 503 }; }, now: () => t });
        await src.ensure(0);
        const first = calls;
        t = 30000;
        await src.ensure(0);
        expect(calls).toBe(first);
        t = 61000;
        await src.ensure(0);
        expect(calls).toBe(2 * first);
    });

    it('keeps the page up when a fetch fails', async () => {
        const src = new NwsSource({ cfg, fetch: async () => ({ ok: false, status: 503 }), now: () => 0 });
        await expect(src.ensure(1)).resolves.toBeUndefined();
        expect(src.get(1)).toBeNull();
    });
});

describe('DemoSource', () => {
    it('gives the same shape as the live source, with no network', () => {
        const d = new DemoSource({ now: () => Date.parse('2026-11-10T19:00:00Z') }).get(0);
        expect(d.source).toBe('demo');
        expect(d.region).toBe(DEMO_REGIONS[0]);
        expect(d.home.periods.length).toBeGreaterThan(0);
        expect(d.home.days).toHaveLength(4);
        expect(d.towns).toHaveLength(DEMO_REGIONS[0].towns.length);
        expect(typeof d.asOf).toBe('number');
    });
});
