import { createRandom } from '../shared/motion.js';

// Generated forecasts for the 90s weather page (AJ, 2026-11-10). Pure
// functions only: the page draws whatever these return, and the tests pin
// the numbers. Temperatures are °F, wind is mph, like the channels it honours.

const DAY_MS = 86400000;
export const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const WIND_ABBR = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const WIND_WORD = ['NORTH', 'NORTHEAST', 'EAST', 'SOUTHEAST', 'SOUTH', 'SOUTHWEST', 'WEST', 'NORTHWEST'];

/**
 * Mix integers into one 32-bit seed.
 * @param {...number} parts
 * @returns {number}
 */
export function hashSeed(...parts) {
    let h = 0x9e3779b9;
    for (const p of parts) {
        h = Math.imul(h ^ (p | 0), 0x85ebca6b);
        h ^= h >>> 13;
        h = Math.imul(h, 0xc2b2ae35);
        h ^= h >>> 16;
    }
    return h >>> 0;
}

/** Standard normal draw from a [0,1) generator (Box-Muller). */
function gauss(random) {
    const u = Math.max(random(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const formatters = new Map();

/**
 * Wall-clock parts in a region's own time zone (IANA name, via Intl), with
 * its short zone name (CST, EDT, MST).
 * @param {number} utcMs
 * @param {{timeZone: string}} region
 * @returns {{offsetH: number, zone: string, year: number, month: number, date: number, dow: number, hour: number, minute: number, second: number, doy: number, dayNumber: number}}
 */
export function localParts(utcMs, region) {
    let f = formatters.get(region.timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat('en-US', {
            timeZone: region.timeZone, hourCycle: 'h23', timeZoneName: 'short',
            year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
        });
        formatters.set(region.timeZone, f);
    }
    const p = {};
    for (const { type, value } of f.formatToParts(utcMs)) p[type] = value;
    const year = +p.year;
    const month = +p.month - 1;
    const date = +p.day;
    const hour = +p.hour;
    const minute = +p.minute;
    const second = +p.second;
    const localMs = Date.UTC(year, month, date, hour, minute, second);
    const dayNumber = Math.floor(localMs / DAY_MS);
    return {
        offsetH: Math.round((localMs - Math.floor(utcMs / 1000) * 1000) / 60000) / 60,
        zone: p.timeZoneName,
        year,
        month,
        date,
        dow: new Date(Date.UTC(year, month, date)).getUTCDay(),
        hour,
        minute,
        second,
        doy: dayNumber - Math.floor(Date.UTC(year, 0, 1) / DAY_MS) + 1,
        dayNumber
    };
}

/**
 * Normal high and low for a day of the year, eased between the January and
 * July normals (coldest about Jan 17, warmest about Jul 18).
 * @param {number[]} norm - [janHi, janLo, julHi, julLo]
 * @param {number} doy - Day of year, 1-366
 * @returns {{hi: number, lo: number}}
 */
export function normalsFor(norm, doy) {
    const w = (1 - Math.cos((2 * Math.PI * (doy - 17)) / 365)) / 2;
    return { hi: norm[0] + (norm[2] - norm[0]) * w, lo: norm[1] + (norm[3] - norm[1]) * w };
}

/** Sky words by cloud cover 0-1, for day and night. */
export function skyWord(cloud, night = false) {
    const i = cloud < 0.2 ? 0 : cloud < 0.4 ? 1 : cloud < 0.6 ? 2 : cloud < 0.8 ? 3 : 4;
    return (night
        ? ['CLEAR', 'MOSTLY CLEAR', 'PARTLY CLOUDY', 'MOSTLY CLOUDY', 'CLOUDY']
        : ['SUNNY', 'MOSTLY SUNNY', 'PARTLY CLOUDY', 'MOSTLY CLOUDY', 'CLOUDY'])[i];
}

/**
 * What falls, from the temperatures that bracket it.
 * @returns {'snow'|'mix'|'storm'|'rain'}
 */
export function precipType(warm, cold) {
    if (warm <= 34) return 'snow';
    if (cold <= 31 && warm <= 40) return 'mix';
    if (warm >= 78) return 'storm';
    return 'rain';
}

/**
 * A period's condition: label (short, for tables), icon kind and the
 * precipitation type when there is any.
 * @param {{cloud: number, pop: number, warm: number, cold: number}} p
 * @param {boolean} night
 * @returns {{label: string, icon: string, type: string|null}}
 */
export function condition({ cloud, pop, warm, cold }, night = false) {
    if (pop >= 40) {
        const type = precipType(warm, cold);
        const steady = pop >= 70;
        const label = {
            snow: steady ? 'SNOW' : 'SNOW SHOWERS',
            mix: 'RAIN/SNOW',
            storm: steady ? 'T-STORMS' : 'SCATTERED T-STORMS',
            rain: steady ? 'RAIN' : 'SHOWERS'
        }[type];
        const icon = { snow: steady ? 'snow' : 'flurries', mix: 'mix', storm: 'storm', rain: steady ? 'rain' : 'showers' }[type];
        return { label, icon, type };
    }
    const sky = skyWord(cloud, night);
    const icons = night
        ? ['moon', 'moon', 'partlymoon', 'mostlycloudy', 'cloudy']
        : ['sun', 'mostlysun', 'partly', 'mostlycloudy', 'cloudy'];
    const i = ['SUNNY', 'CLEAR', 'MOSTLY SUNNY', 'MOSTLY CLEAR', 'PARTLY CLOUDY', 'MOSTLY CLOUDY', 'CLOUDY']
        .indexOf(sky);
    return { label: sky, icon: icons[[0, 0, 1, 1, 2, 3, 4][i]], type: null };
}

/** Chance of precipitation from cloud cover and how wet the region is, in tens. */
function popFrom(cloud, wet) {
    const raw = ((cloud - 0.5) / 0.5) * 100 * (0.55 + wet);
    const pop = clamp(Math.round(raw / 10) * 10, 0, 90);
    return pop < 20 ? 0 : pop;
}

/**
 * Seven days of weather for every town in a region: shared fronts (anomaly,
 * cloud, wind) with a little local scatter. The same region, day and seed
 * always give the same forecast, so it holds steady through the day.
 * @param {Object} region - From regions.js
 * @param {number} regionIndex
 * @param {{dayNumber: number, doy: number}} when - From localParts
 * @param {number} seed
 * @param {number} [days=7]
 * @returns {Array<Array<Object>>} [town][day] = {hi, lo, day: {...}, night: {...}, windDir, windMph}
 */
export function regionForecast(region, regionIndex, when, seed, days = 7) {
    const random = createRandom(hashSeed(seed, regionIndex, when.dayNumber));
    const fronts = [];
    let anomaly = gauss(random) * 5;
    let cloud = random();
    let dir = Math.floor(random() * 8);
    for (let d = 0; d <= days; d++) {
        anomaly = anomaly * 0.55 + gauss(random) * 6;
        cloud = clamp(cloud * 0.45 + random() * 0.75 - 0.15 + region.wet * 0.2, 0, 1);
        dir = (dir + Math.round(gauss(random) * 1.2) + 8) % 8;
        fronts.push({ anomaly, cloud, dir, gust: random() });
    }
    return region.towns.map((town, ti) => {
        const r = createRandom(hashSeed(seed, regionIndex, when.dayNumber, ti + 1));
        const temps = fronts.map((f, d) => {
            const n = normalsFor(town.norm, ((when.doy - 1 + d) % 365) + 1);
            const a = f.anomaly + gauss(r) * 2.5;
            const hi = Math.round(n.hi + a);
            const lo = Math.min(Math.round(n.lo + a * 0.8 + gauss(r) * 1.5), hi - 6);
            return { hi, lo, cloud: clamp(f.cloud + gauss(r) * 0.12, 0, 1) };
        });
        const out = [];
        for (let d = 0; d < days; d++) {
            const t = temps[d];
            const next = temps[d + 1];
            const f = fronts[d];
            const nightCloud = clamp((t.cloud + next.cloud) / 2 + gauss(r) * 0.08, 0, 1);
            const dayP = { cloud: t.cloud, pop: popFrom(t.cloud, region.wet), warm: t.hi, cold: t.lo };
            const nightP = { cloud: nightCloud, pop: popFrom(nightCloud, region.wet), warm: t.lo + 4, cold: next.lo };
            out.push({
                hi: t.hi,
                lo: t.lo,
                nextLo: next.lo,
                day: { ...dayP, ...condition(dayP, false) },
                night: { ...nightP, ...condition(nightP, true) },
                windDir: f.dir,
                windMph: Math.round(4 + f.gust * 9 + t.cloud * 5 + (dayP.pop >= 50 ? 4 : 0) + r() * 3)
            });
        }
        return out;
    });
}

/** Relative humidity (%) from temperature and dewpoint in °F (Magnus). */
export function relativeHumidity(tempF, dewF) {
    const c = ((tempF - 32) * 5) / 9;
    const dc = ((dewF - 32) * 5) / 9;
    const e = (x) => Math.exp((17.625 * x) / (243.04 + x));
    return clamp(Math.round((100 * e(dc)) / e(c)), 1, 100);
}

/** NWS wind chill (°F), or null outside its range (T ≤ 50, wind > 3). */
export function windChill(tempF, mph) {
    if (tempF > 50 || mph <= 3) return null;
    const v = mph ** 0.16;
    return Math.round(35.74 + 0.6215 * tempF - 35.75 * v + 0.4275 * tempF * v);
}

/** NWS heat index (°F, Rothfusz), or null below 80 °F. */
export function heatIndex(t, rh) {
    if (t < 80) return null;
    return Math.round(-42.379 + 2.04901523 * t + 10.14333127 * rh - 0.22475541 * t * rh
        - 0.00683783 * t * t - 0.05481717 * rh * rh + 0.00122874 * t * t * rh
        + 0.00085282 * t * rh * rh - 0.00000199 * t * t * rh * rh);
}

/**
 * The temperature curve through a day: the low near 6 AM, the high near
 * 3 PM, cooling towards tomorrow's low overnight.
 * @param {number} hour - Local hour, fractional
 * @param {{hi: number, lo: number, nextLo: number}} day
 * @returns {number}
 */
export function temperatureAt(hour, day) {
    if (hour < 6) return day.lo + (6 - hour) * 0.5;      // still easing down to the low
    if (hour <= 15) return day.lo + (day.hi - day.lo) * (1 - Math.cos((Math.PI * (hour - 6)) / 9)) / 2;
    return day.nextLo + (day.hi - day.nextLo) * (1 + Math.cos((Math.PI * (hour - 15)) / 15)) / 2;
}

/**
 * Current conditions for one town at a local hour.
 * @param {Object[]} days - One town's days from regionForecast
 * @param {number} hour - Local hour, fractional
 * @param {number} seed
 * @returns {Object}
 */
export function currentConditions(days, hour, seed, wet = 0.4) {
    const r = createRandom(hashSeed(seed, Math.floor(hour)));
    const d = days[0];
    const night = hour < 6 || hour >= 18;
    const p = night ? d.night : d.day;
    const temp = Math.round(temperatureAt(hour, d));
    const spread = Math.max(0, (1 - p.cloud) * 14 + 2 + (1 - wet) * 22 - p.pop / 8 + gauss(r) * 2);
    const dew = Math.min(temp, Math.round(temp - spread));
    let humidity = relativeHumidity(temp, dew);
    const wind = Math.max(0, Math.round(d.windMph + gauss(r) * 2 - (night ? 3 : 0)));
    let icon = p.icon;
    let label = p.label;
    let visibility = p.type === 'snow' ? 1 + Math.round(r() * 2) : p.type === 'mix' ? 3 : p.type ? 5 : 10;
    if (!p.type && humidity >= 93 && wind < 6 && (night || hour < 10)) {
        icon = 'fog';
        label = 'FOG';
        visibility = 0.5;
        humidity = Math.max(humidity, 97);
    }
    const tomorrow = days[1] ?? d;
    const trend = tomorrow.day.cloud < d.day.cloud - 0.1 ? 'R' : tomorrow.day.cloud > d.day.cloud + 0.1 ? 'F' : 'S';
    const ceiling = p.cloud < 0.2 && !p.type ? null
        : Math.round(((1 - p.cloud) * 11000 + (p.type ? 600 : 1500)) / 100) * 100;
    return {
        temp,
        label,
        icon,
        dew,
        humidity,
        windDir: WIND_ABBR[d.windDir],
        wind,
        gust: wind >= 14 ? wind + 6 + Math.round(r() * 8) : null,
        pressure: (30.12 - p.cloud * 0.42 + gauss(r) * 0.04).toFixed(2),
        trend,
        visibility,
        ceiling,
        chill: windChill(temp, wind),
        heat: heatIndex(temp, humidity)
    };
}

function windPhrase(dir, mph) {
    if (mph < 6) return 'LIGHT WINDS.';
    const lo = Math.max(5, Math.floor(mph / 5) * 5);
    return `${WIND_WORD[dir]} WINDS ${lo} TO ${lo + (mph >= 15 ? 10 : 5)} MPH.`;
}

function precipPhrase(p) {
    const noun = { rain: 'RAIN', snow: 'SNOW', mix: 'RAIN AND SNOW', storm: 'THUNDERSTORMS' }[p.type];
    const sky = p.cloud >= 0.8 ? 'CLOUDY' : 'MOSTLY CLOUDY';
    if (p.pop >= 80) {
        const extra = p.type === 'snow' ? ' NEW SNOW ACCUMULATION OF 1 TO 3 INCHES.'
            : p.type === 'storm' ? ' SOME STORMS MAY PRODUCE HEAVY RAIN.' : '';
        return `${noun}.${extra} CHANCE OF PRECIPITATION ${p.pop} PERCENT.`;
    }
    if (p.pop >= 70) return `${sky}. ${noun} LIKELY. CHANCE OF PRECIPITATION ${p.pop} PERCENT.`;
    if (p.pop >= 20) {
        const showers = { rain: 'SHOWERS', snow: 'SNOW SHOWERS', mix: 'RAIN AND SNOW', storm: 'THUNDERSTORMS' }[p.type ?? 'rain'];
        return `${skyWord(p.cloud)} WITH A ${p.pop} PERCENT CHANCE OF ${showers}.`;
    }
    return null;
}

/**
 * The local forecast as three NWS-style periods, starting with TODAY (or
 * TONIGHT after 3 PM).
 * @param {Object[]} days - One town's days from regionForecast
 * @param {{hour: number, dow: number}} when
 * @returns {Array<{title: string, text: string}>}
 */
export function localForecastText(days, when) {
    const periods = [];
    const evening = when.hour >= 15;
    for (let k = 0; periods.length < 3; k++) {
        const di = Math.floor((k + (evening ? 1 : 0)) / 2);
        const isNight = (k + (evening ? 1 : 0)) % 2 === 1;
        const d = days[di];
        const p = isNight ? d.night : d.day;
        const name = DAY_NAMES[(when.dow + di) % 7];
        const title = di === 0 ? (isNight ? 'TONIGHT' : 'TODAY') : isNight ? `${name} NIGHT` : name;
        let pop = p.pop >= 20 ? precipPhrase({ ...p, type: p.type ?? precipType(p.warm, p.cold) }) : null;
        if (pop && isNight) pop = pop.replace('MOSTLY SUNNY', 'MOSTLY CLEAR').replace('SUNNY', 'CLEAR');
        const sky = pop ?? `${skyWord(p.cloud, isNight)}.`;
        const temp = isNight ? `LOW AROUND ${d.nextLo}.` : `HIGH NEAR ${d.hi}.`;
        const wind = windPhrase(d.windDir, isNight ? Math.max(0, d.windMph - 4) : d.windMph);
        periods.push({ title, text: `${sky} ${temp} ${wind}` });
    }
    return periods;
}

/**
 * Sunrise and sunset in UTC minutes after the date's UTC midnight (NOAA's
 * general solar position, refraction 0.833°). Null when the sun doesn't
 * rise or set.
 * @param {number} year
 * @param {number} month - 0-11
 * @param {number} date
 * @param {number} lat
 * @param {number} lon - Negative west
 * @returns {{rise: number, set: number}|null}
 */
export function sunTimes(year, month, date, lat, lon) {
    const doy = Math.round((Date.UTC(year, month, date) - Date.UTC(year, 0, 1)) / DAY_MS) + 1;
    const g = ((2 * Math.PI) / 365) * (doy - 1);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
        - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
        + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const rad = (x) => (x * Math.PI) / 180;
    const cosH = Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl);
    if (cosH < -1 || cosH > 1) return null;
    const ha = (Math.acos(cosH) * 180) / Math.PI;
    return { rise: 720 - 4 * (lon + ha) - eq, set: 720 - 4 * (lon - ha) - eq };
}

/** "6:58 AM" from minutes after local midnight. */
export function formatClock(minutes) {
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const SYNODIC = 29.530588853;
const NEW_MOON_JD = 2451550.1;     // 2000-01-06 18:14 UTC

/**
 * The next new, first quarter, full and last quarter moons after a time,
 * soonest first (mean phases, good to about a day).
 * @param {number} utcMs
 * @returns {Array<{name: string, phase: number, utcMs: number}>}
 */
export function nextMoonPhases(utcMs) {
    const jd = utcMs / DAY_MS + 2440587.5;
    const age = (((jd - NEW_MOON_JD) % SYNODIC) + SYNODIC) % SYNODIC;
    return [['NEW', 0], ['FIRST', 0.25], ['FULL', 0.5], ['LAST', 0.75]]
        .map(([name, phase]) => {
            const wait = (((phase * SYNODIC - age) % SYNODIC) + SYNODIC) % SYNODIC;
            return { name, phase, utcMs: utcMs + wait * DAY_MS };
        })
        .sort((a, b) => a.utcMs - b.utcMs);
}

/**
 * Bulletins for the crawl: one line per region from its forecast, so the
 * ticker talks about the same weather the pages show.
 * @param {Object} region
 * @param {Array<Array<Object>>} fc - From regionForecast
 * @param {number} dow - Today's day of week, 0 = Sunday
 * @returns {string}
 */
export function regionBulletin(region, fc, dow) {
    const today = fc.map((days, i) => ({ name: region.towns[i].name, hi: days[0].hi }));
    const warm = today.reduce((a, b) => (b.hi > a.hi ? b : a));
    const cool = today.reduce((a, b) => (b.hi < a.hi ? b : a));
    let line = `${region.name}: HIGHS TODAY FROM ${cool.hi} AT ${cool.name} TO ${warm.hi} AT ${warm.name}.`;
    const home = fc[0];
    for (let d = 1; d < Math.min(home.length, 5); d++) {
        const t = home[d].day.type;
        if (t) {
            const what = { snow: 'SNOW', mix: 'A WINTRY MIX', storm: 'THUNDERSTORMS', rain: 'RAIN' }[t];
            line += ` ${what} RETURNS ${DAY_NAMES[(dow + d) % 7]}.`;
            break;
        }
    }
    const coldest = Math.min(...fc.map((days) => days[0].lo));
    if (coldest <= 32) line += ' FROST AND FREEZE POSSIBLE OVERNIGHT: BRING IN YOUR PLANTS AND PETS.';
    return line;
}

/** A neighbourly tip for the time of year (month 0-11). */
export function seasonTip(month) {
    if (month === 11 || month <= 1) return 'WINTER DRIVING: KEEP A BLANKET, A FLASHLIGHT AND AN ICE SCRAPER IN YOUR CAR.';
    if (month <= 4) return 'SPRING IS STORM SEASON: KNOW WHERE YOU WOULD SHELTER BEFORE THE SIRENS SOUND.';
    if (month <= 7) return 'BEAT THE HEAT: DRINK PLENTY OF WATER AND CHECK ON YOUR NEIGHBORS.';
    return 'AUTUMN IS HERE: NOW IS A GOOD TIME TO HAVE YOUR FURNACE CHECKED.';
}
