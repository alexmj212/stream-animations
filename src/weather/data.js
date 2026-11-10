import { REGIONS, DEMO_REGIONS } from './regions.js';
import {
    localParts, regionForecast, currentConditions, localForecastText, windChill, heatIndex,
    relativeHumidity, DAY_NAMES, WIND_ABBR
} from './forecast.js';

// Where the weather page's numbers come from. Both sources hand the page the
// same shape per region:
//   { source, region, home: { name, now, periods, days }, towns: [{ name, now }], asOf }
// `now` is one observation (or null when a station sent nothing), `periods`
// the local forecast text, `days` the extended forecast, `asOf` the newest
// observation time (UTC ms).
//
// Live (default): the National Weather Service API, api.weather.gov (AJ,
// 2026-11-10: real weather for real cities). Free, no key, CORS open. One
// forecast and seven latest observations per region, cached so a region seen
// again within the TTL costs nothing (config.weather.data).
// Demo (?data=demo, the motion harness): generated forecasts for made-up
// towns, no network.

const API = 'https://api.weather.gov';

const c2f = (c) => (c === null || c === undefined ? null : Math.round(c * 9 / 5 + 32));
const val = (q) => (q && typeof q.value === 'number' ? q.value : null);

/**
 * Our icon kind for an NWS icon URL, e.g.
 * https://api.weather.gov/icons/land/night/rain_showers,40?size=medium.
 * The first condition in the path wins (a split icon shows the first half).
 * @param {string|null} url
 * @param {string} [text] - textDescription, used when there is no icon
 * @returns {string}
 */
export function iconFromNws(url, text = '') {
    const m = /\/icons\/land\/(day|night)\/([a-z_]+)/.exec(url || '');
    const night = m ? m[1] === 'night' : false;
    const code = m ? m[2] : '';
    const t = text.toLowerCase();
    const has = (...k) => k.some((x) => code.includes(x) || t.includes(x.replace('_', ' ')));
    if (has('tsra', 'thunder')) return 'storm';
    if (has('rain_snow', 'sleet', 'fzra', 'freezing', 'snow_fzra', 'rain_sleet')) return 'mix';
    if (has('blizzard')) return 'snow';
    if (has('snow')) return /showers|chance|light/.test(t) || code.includes('snow,') ? 'flurries' : 'snow';
    if (has('rain_showers', 'showers', 'drizzle')) return 'showers';
    if (has('rain')) return 'rain';
    if (has('fog', 'haze', 'smoke', 'dust', 'mist')) return 'fog';
    if (has('ovc', 'overcast') || t === 'cloudy') return 'cloudy';
    if (has('bkn', 'mostly cloudy')) return 'mostlycloudy';
    if (has('sct', 'partly')) return night ? 'partlymoon' : 'partly';
    if (has('few', 'mostly clear', 'mostly sunny')) return night ? 'moon' : 'mostlysun';
    return night ? 'moon' : 'sun';
}

/**
 * A station's sky words cut for a table cell or the crawl:
 * "THUNDERSTORM IN VICINITY" becomes "T-STORM NEARBY".
 * @param {string} label
 * @returns {string}
 */
export function skyShort(label) {
    return (label || '')
        .replace(/THUNDERSTORMS?/g, 'T-STORM')
        .replace(/ IN VICINITY/g, ' NEARBY')
        .replace(/FOG\/MIST/g, 'FOG')
        .replace(/ AND /g, ' & ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Sky words for an icon kind, when a station sends no text. */
const ICON_WORDS = {
    sun: 'SUNNY', moon: 'CLEAR', mostlysun: 'MOSTLY SUNNY', partly: 'PARTLY CLOUDY', partlymoon: 'PARTLY CLOUDY',
    mostlycloudy: 'MOSTLY CLOUDY', cloudy: 'CLOUDY', fog: 'FOG', showers: 'SHOWERS', rain: 'RAIN',
    storm: 'T-STORMS', snow: 'SNOW', flurries: 'FLURRIES', mix: 'WINTRY MIX'
};

/** A forecast's short words, cut for a table cell: the part before "then". */
export function shortLabel(text) {
    return (text || '')
        .split(/ then /i)[0]
        .replace(/Showers And Thunderstorms|Thunderstorms/gi, 'T-Storms')
        .replace(/Slight Chance/gi, 'Chance')
        .replace(/ Likely/gi, '')
        .toUpperCase()
        .trim();
}

/**
 * One latest observation (station properties) in the page's units.
 * @param {Object} p - observation `properties`
 * @param {boolean} [night=false] - For a station that sends no icon
 * @returns {Object|null}
 */
export function observationToNow(p, night = false) {
    if (!p) return null;
    const temp = c2f(val(p.temperature));
    const dew = c2f(val(p.dewpoint));
    const rh = val(p.relativeHumidity);
    const kmh = val(p.windSpeed);
    const gustKmh = val(p.windGust);
    const deg = val(p.windDirection);
    const wind = kmh === null ? null : Math.round(kmh / 1.609);
    const pa = val(p.barometricPressure) ?? val(p.seaLevelPressure);
    const vis = val(p.visibility);
    const ceilings = (p.cloudLayers || [])
        .filter((l) => (l.amount === 'BKN' || l.amount === 'OVC') && val(l.base) !== null)
        .map((l) => val(l.base));
    const humidity = rh === null ? (temp !== null && dew !== null ? relativeHumidity(temp, dew) : null) : Math.round(rh);
    // Some stations send neither words nor an icon: read the sky from the
    // cloud layers (the most cover reported), as the old channels did
    const cover = ['SKC', 'CLR', 'FEW', 'SCT', 'BKN', 'OVC'];
    const most = (p.cloudLayers || []).reduce((m, l) => Math.max(m, cover.indexOf(l.amount)), -1);
    const sky = p.icon || p.textDescription ? '' : ['CLEAR', 'CLEAR', night ? 'MOSTLY CLEAR' : 'MOSTLY SUNNY', 'PARTLY CLOUDY', 'MOSTLY CLOUDY', 'CLOUDY'][most] || '';
    const words = p.textDescription || sky;
    const label = words.toUpperCase().trim();
    const icon = iconFromNws(p.icon || (sky && `/icons/land/${night ? 'night' : 'day'}/sky`), words);
    let chill = c2f(val(p.windChill));
    let heat = c2f(val(p.heatIndex));
    if (chill === null && temp !== null && wind !== null) chill = windChill(temp, wind);
    if (heat === null && temp !== null && humidity !== null) heat = heatIndex(temp, humidity);
    return {
        temp,
        dew,
        humidity,
        // Some stations send an icon but no words: name the sky from the icon
        label: label || (p.icon && ICON_WORDS[icon]) || '--',
        icon,
        windDir: deg === null ? '' : WIND_ABBR[Math.round(deg / 45) % 8],
        wind,
        gust: gustKmh === null ? null : Math.round(gustKmh / 1.609),
        pressure: pa === null ? null : (pa / 3386.39).toFixed(2),
        visibility: vis === null ? null : Math.round((vis / 1609.34) * 4) / 4,
        ceiling: ceilings.length ? Math.round(Math.min(...ceilings) * 3.28084 / 100) * 100 : null,
        chill,
        heat,
        time: p.timestamp ? Date.parse(p.timestamp) : null
    };
}

/**
 * The local forecast text (first three periods) and the extended forecast
 * (the next four days after today, high from the day period, low from the
 * night after it) from an NWS gridpoint forecast.
 * @param {Object} p - forecast `properties` ({periods: [...]})
 * @returns {{periods: Array<{title: string, text: string}>, days: Array<Object>}}
 */
export function forecastToPages(p) {
    const list = (p && p.periods) || [];
    const periods = list.slice(0, 3).map((x) => ({
        title: x.name.toUpperCase(),
        text: (x.detailedForecast || x.shortForecast || '').toUpperCase()
    }));
    const days = [];
    // Skip today's day period (and tonight): the extended forecast starts tomorrow
    let i = list.findIndex((x, k) => k > 0 && x.isDaytime);
    for (; i >= 0 && i < list.length && days.length < 4; i++) {
        const d = list[i];
        if (!d.isDaytime) continue;
        const night = list[i + 1] && !list[i + 1].isDaytime ? list[i + 1] : null;
        days.push({
            // From the date, not the name: holidays rename periods ("Veterans Day")
            name: d.startTime ? DAY_NAMES[new Date(`${d.startTime.slice(0, 10)}T12:00:00Z`).getUTCDay()].slice(0, 3) : d.name.slice(0, 3).toUpperCase(),
            icon: iconFromNws(d.icon, d.shortForecast),
            label: shortLabel(d.shortForecast),
            hi: d.temperature,
            lo: night ? night.temperature : null
        });
    }
    return { periods, days };
}

/** fetch with a timeout, as JSON; throws on HTTP errors. */
async function getJson(fetchImpl, url, timeoutMs) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    try {
        const r = await fetchImpl(url, { headers: { Accept: 'application/geo+json' }, signal: ctl?.signal, cache: 'no-cache' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/** Live NWS data with a TTL cache per forecast grid and per station. */
export class NwsSource {
    /**
     * @param {Object} opts
     * @param {Object} opts.cfg - config.weather.data
     * @param {Function} [opts.fetch]
     * @param {() => number} [opts.now]
     * @param {Object} [opts.debug]
     */
    constructor({ cfg, fetch: fetchImpl = (...a) => fetch(...a), now = () => Date.now(), debug = null }) {
        this.regions = REGIONS;
        this.cfg = cfg;
        this.fetch = fetchImpl;
        this.now = now;
        this.debug = debug;
        this.cache = new Map();         // url -> { t, data }; bounded by the fixed city list
        this.inflight = new Map();      // regionIndex -> Promise
        this.source = 'nws';
    }

    fresh(url, ttl) {
        const hit = this.cache.get(url);
        return hit && this.now() - hit.t < ttl ? hit.data : null;
    }

    async load(url, ttl) {
        if (this.fresh(url, ttl)) return;
        try {
            const data = await getJson(this.fetch, url, this.cfg.timeoutMs);
            this.cache.set(url, { t: this.now(), data });
        } catch (e) {
            // Keep the last good copy; the page shows its age
            this.debug?.mark('fetchFail', { url, message: String(e) });
        }
    }

    /**
     * Fetch what's stale for a region. Never rejects; one run per region at a time.
     * @param {number} i
     * @returns {Promise<void>}
     */
    ensure(i) {
        if (this.inflight.has(i)) return this.inflight.get(i);
        const region = this.regions[i];
        const t0 = this.now();
        this.debug?.mark('fetchStart', { region: region.name });
        const [home] = region.towns;
        const jobs = [
            this.load(`${API}/gridpoints/${home.grid}/forecast`, this.cfg.forecastTtlMs),
            ...region.towns.map((t) => this.load(`${API}/stations/${t.station}/observations/latest`, this.cfg.observationTtlMs))
        ];
        const run = Promise.all(jobs).then(() => {
            this.debug?.mark('fetchEnd', { region: region.name, ms: this.now() - t0, ok: !!this.get(i) });
        }).finally(() => this.inflight.delete(i));
        this.inflight.set(i, run);
        return run;
    }

    /**
     * The region's data from cache (stale included), or null when there is
     * nothing to show yet.
     * @param {number} i
     * @returns {Object|null}
     */
    get(i) {
        const region = this.regions[i];
        const cached = (url) => this.cache.get(url)?.data ?? null;
        const towns = region.towns.map((t) => {
            const p = cached(`${API}/stations/${t.station}/observations/latest`)?.properties;
            const hour = p?.timestamp ? localParts(Date.parse(p.timestamp), region).hour : 12;
            return { name: t.name, now: observationToNow(p, hour < 6 || hour >= 18) };
        });
        const fc = cached(`${API}/gridpoints/${region.towns[0].grid}/forecast`);
        // Drop observations too old to call current
        const maxAge = this.cfg.staleAfterMs;
        for (const t of towns) {
            if (t.now?.time && this.now() - t.now.time > maxAge) t.now = null;
        }
        if (!fc && towns.every((t) => !t.now)) return null;
        const pages = fc ? forecastToPages(fc.properties) : { periods: [], days: [] };
        // A home station with no sky at all borrows the forecast's words for
        // the current period ("Mostly Sunny"), so the big page never shows --
        const first = fc?.properties?.periods?.[0];
        const home = towns[0].now;
        if (home && home.label === '--' && first) {
            // The icon from the words, not the period's icon code: NWS pairs
            // "Sunny" with its few-clouds icon (Rotom, #169)
            const sky = `/icons/land/${first.isDaytime === false ? 'night' : 'day'}/sky`;
            towns[0].now = { ...home, label: first.shortForecast.toUpperCase(), icon: iconFromNws(sky, first.shortForecast) };
        }
        const times = towns.map((t) => t.now?.time).filter(Boolean);
        return {
            source: 'nws',
            region,
            home: { name: towns[0].name, now: towns[0].now, ...pages },
            towns,
            asOf: times.length ? Math.max(...times) : null
        };
    }
}

/** Generated forecasts for made-up towns: no network, the same every run. */
export class DemoSource {
    constructor({ seed = 0, now = () => Date.now() } = {}) {
        this.regions = DEMO_REGIONS;
        this.seed = seed;
        this.now = now;
        this.source = 'demo';
    }

    ensure() {
        return Promise.resolve();
    }

    get(i) {
        const region = this.regions[i];
        const utc = this.now();
        const when = localParts(utc, region);
        const fc = regionForecast(region, i, when, this.seed);
        const hour = when.hour + when.minute / 60;
        const nowFor = (k) => ({
            ...currentConditions(fc[k], hour, this.seed ^ when.dayNumber ^ (k * 7919), region.wet),
            time: utc - (when.minute % 60) * 60000
        });
        const towns = region.towns.map((t, k) => ({ name: t.name, now: nowFor(k) }));
        const now0 = towns[0].now;
        return {
            source: 'demo',
            region,
            home: {
                name: towns[0].name,
                now: { ...now0, pressure: now0.pressure },
                periods: localForecastText(fc[0], when),
                days: fc[0].slice(1, 5).map((d, k) => ({
                    name: DAY_NAMES[(when.dow + k + 1) % 7].slice(0, 3),
                    icon: d.day.icon,
                    label: d.day.label,
                    hi: d.hi,
                    lo: d.lo
                }))
            },
            towns,
            asOf: now0.time
        };
    }
}
