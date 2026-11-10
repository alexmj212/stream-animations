import { REGIONS } from './regions.js';
import {
    localParts, regionForecast, currentConditions, localForecastText, sunTimes, formatClock,
    nextMoonPhases, regionBulletin, seasonTip, DAY_NAMES, MONTHS
} from './forecast.js';
import { weatherIcon } from './icons.js';

// The 90s weather page (AJ, 2026-11-10): an earnest early-90s cable weather
// channel that cuts through forecast pages for one region after another,
// forever. AJ's own look, outside the bible's palette and type rules (like
// spheal); the viewer rules still hold: title-safe, nothing readable below
// y 994, no text under 32px, hard cuts with no flash (DESIGN.md).
//
// Cost (Performance expert, 2026-11-10): the background and frames are drawn
// once; each page is drawn into one of two preallocated offscreen canvases
// ahead of its cut, so a cut is one blit. Per frame only the crawl moves
// (whole pixels); the clock repaints once a second.

const W = 1920;
const H = 1080;
const FONT = 'Arial, "Liberation Sans", Helvetica, sans-serif';
const PAGE_Y = 80;                  // page canvases cover y 80-920
const PAGE_H = 840;
const PANEL = { x: 96, y: 228, w: 1728, h: 684 };
const CRAWL = { y: 932, h: 88, labelRight: 400, baseline: 986 };   // text clear of y 994 (SAFE-3)
const CLOCK = { x: 1240, y: 84, w: 600, h: 124 };
const INK = '#0b1240';
const GOLD = '#ffcc33';
const YELLOW = '#ffe14d';
const PALE = '#a9c6ff';

const PAGE_TITLES = {
    current: 'CURRENT CONDITIONS',
    local: 'LOCAL FORECAST',
    extended: 'EXTENDED FORECAST',
    regional: 'REGIONAL OBSERVATIONS',
    almanac: 'ALMANAC'
};

function font(px, italic = false) {
    return `${italic ? 'italic ' : ''}bold ${px}px ${FONT}`;
}

/** Text with the hard black drop shadow every 90s character generator had. */
function shadowText(ctx, text, x, y, px, color, { align = 'left', italic = false, shadow = 0, maxW = Infinity } = {}) {
    ctx.font = font(px, italic);
    let size = px;
    while (size > 32 && ctx.measureText(text).width > maxW) {
        size -= 2;
        ctx.font = font(size, italic);
    }
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    const s = shadow || Math.max(3, Math.round(size / 16));
    ctx.fillStyle = 'rgba(0, 0, 20, 0.85)';
    ctx.fillText(text, x + s, y + s);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

function wrap(ctx, text, maxW) {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(test).width > maxW) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

export class WeatherChannel {
    /**
     * @param {HTMLCanvasElement} canvas - 1920x1080, opaque
     * @param {Object} options
     * @param {Object} options.cfg - config.weather
     * @param {number} options.seed
     * @param {() => number} options.now - Wall clock, UTC ms
     * @param {number} [options.region=0] - Region to start with
     * @param {string|null} [options.page=null] - Hold one page (mocks)
     * @param {Object} [options.debug]
     */
    constructor(canvas, { cfg, seed, now, region = 0, page = null, debug = null }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.cfg = cfg;
        this.seed = seed;
        this.now = now;
        this.startRegion = region;
        this.pages = page ? [page] : cfg.pages;
        this.debug = debug;
        this.base = makeCanvas(W, H);
        this.pageCanvases = [makeCanvas(W, PAGE_H), makeCanvas(W, PAGE_H)];
        this.shown = null;          // {index, canvas}
        this.ahead = null;          // {index, canvas} built before its cut
        this.strip = makeCanvas(16, CRAWL.h);
        this.stripKey = null;
        this.lastClock = '';
        this.lastCrawlX = null;
        this.forecasts = new Map(); // `${region}:${day}` -> forecast
        this.drawBase();
    }

    /** Which region and page a page index is. */
    slot(index) {
        const n = this.pages.length;
        return {
            regionIndex: (this.startRegion + Math.floor(index / n)) % REGIONS.length,
            page: this.pages[index % n]
        };
    }

    forecastFor(regionIndex) {
        const region = REGIONS[regionIndex];
        const when = localParts(this.now(), region);
        const key = `${regionIndex}:${when.dayNumber}`;
        let fc = this.forecasts.get(key);
        if (!fc) {
            if (this.forecasts.size > 12) this.forecasts.clear();
            fc = regionForecast(region, regionIndex, when, this.seed);
            this.forecasts.set(key, fc);
        }
        return { region, when, fc };
    }

    // --- Drawing once ----------------------------------------------------

    drawBase() {
        const c = this.base.getContext('2d', { alpha: false });
        const bg = c.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#071450');
        bg.addColorStop(0.5, '#1b3596');
        bg.addColorStop(1, '#341872');
        c.fillStyle = bg;
        c.fillRect(0, 0, W, H);
        // Faint scanlines, for that cable-box glow
        c.fillStyle = 'rgba(255, 255, 255, 0.035)';
        for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1);

        // Header shade and the gold rule under it
        const hs = c.createLinearGradient(0, 80, 0, 214);
        hs.addColorStop(0, 'rgba(0, 0, 30, 0.45)');
        hs.addColorStop(1, 'rgba(0, 0, 30, 0)');
        c.fillStyle = hs;
        c.fillRect(0, 80, W, 134);
        const rule = c.createLinearGradient(96, 0, 1824, 0);
        rule.addColorStop(0, GOLD);
        rule.addColorStop(1, '#ff6a1a');
        c.fillStyle = INK;
        c.fillRect(96, 206, 1728, 10);
        c.fillStyle = rule;
        c.fillRect(96, 208, 1728, 6);

        this.drawLogo(c, 96, 88, 216, 112);

        // The panel: beveled, lit from the top left
        const p = PANEL;
        c.fillStyle = INK;
        c.fillRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
        const fill = c.createLinearGradient(0, p.y, 0, p.y + p.h);
        fill.addColorStop(0, '#3e68dc');
        fill.addColorStop(1, '#2541a6');
        c.fillStyle = fill;
        c.fillRect(p.x, p.y, p.w, p.h);
        const b = 6;
        c.fillStyle = '#9cc0ff';
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x + p.w, p.y);
        c.lineTo(p.x + p.w - b, p.y + b);
        c.lineTo(p.x + b, p.y + b);
        c.lineTo(p.x + b, p.y + p.h - b);
        c.lineTo(p.x, p.y + p.h);
        c.fill();
        c.fillStyle = '#101b5e';
        c.beginPath();
        c.moveTo(p.x + p.w, p.y);
        c.lineTo(p.x + p.w, p.y + p.h);
        c.lineTo(p.x, p.y + p.h);
        c.lineTo(p.x + b, p.y + p.h - b);
        c.lineTo(p.x + p.w - b, p.y + p.h - b);
        c.lineTo(p.x + p.w - b, p.y + b);
        c.fill();

        // Crawl bar, full width; its label box sits inside title-safe
        c.fillStyle = '#060b30';
        c.fillRect(0, CRAWL.y, W, CRAWL.h);
        c.fillStyle = GOLD;
        c.fillRect(0, CRAWL.y, W, 4);
        c.fillStyle = '#3e68dc';
        c.fillRect(0, CRAWL.y + CRAWL.h - 3, W, 3);
        const lb = c.createLinearGradient(0, CRAWL.y + 4, 0, CRAWL.y + CRAWL.h - 3);
        lb.addColorStop(0, '#ffb31f');
        lb.addColorStop(1, '#ff5a1f');
        c.fillStyle = lb;
        c.fillRect(96, CRAWL.y + 4, CRAWL.labelRight - 96, CRAWL.h - 7);
        c.fillStyle = INK;
        c.fillRect(CRAWL.labelRight, CRAWL.y + 4, 4, CRAWL.h - 7);
        shadowText(c, 'BULLETIN', (96 + CRAWL.labelRight) / 2, CRAWL.baseline - 4, 40, '#ffffff', { align: 'center', italic: true, shadow: 3 });
    }

    drawLogo(c, x, y, w, h) {
        const r = 12;
        const path = () => {
            c.beginPath();
            c.roundRect(x, y, w, h, r);
        };
        path();
        c.fillStyle = INK;
        c.lineWidth = 8;
        c.strokeStyle = INK;
        c.stroke();
        const g = c.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, '#ffd23f');
        g.addColorStop(0.5, '#ff8a1f');
        g.addColorStop(1, '#e8401a');
        c.fillStyle = g;
        path();
        c.fill();
        c.fillStyle = 'rgba(255, 255, 255, 0.35)';
        c.fillRect(x + 8, y + 6, w - 16, 4);
        shadowText(c, this.cfg.station, x + w / 2, y + 66, 64, '#ffffff', { align: 'center', italic: true, shadow: 4 });
        c.fillStyle = INK;
        c.fillRect(x + 14, y + 74, w - 28, 32);
        c.font = font(32);
        c.textAlign = 'center';
        c.fillStyle = YELLOW;
        c.fillText('WEATHER', x + w / 2, y + 102);
    }

    // --- Pages -----------------------------------------------------------

    /**
     * Draw a page into a page canvas (absolute frame coordinates).
     * @param {number} index
     * @param {HTMLCanvasElement} target
     */
    buildPage(index, target) {
        const { regionIndex, page } = this.slot(index);
        const c = target.getContext('2d', { alpha: false });
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(this.base, 0, PAGE_Y, W, PAGE_H, 0, 0, W, PAGE_H);
        c.translate(0, -PAGE_Y);
        const data = this.forecastFor(regionIndex);
        const home = data.region.towns[0].name;
        const subtitle = page === 'regional' ? data.region.name : home;
        shadowText(c, PAGE_TITLES[page], 344, 150, 64, YELLOW, { italic: true, maxW: 880 });
        shadowText(c, subtitle, 348, 198, 36, '#ffffff', { maxW: 860 });
        this[`page_${page}`](c, data);
        c.setTransform(1, 0, 0, 1, 0, 0);
        return { index, canvas: target, regionIndex, page };
    }

    hourOf(when) {
        return when.hour + when.minute / 60;
    }

    page_current(c, { fc, when, region }) {
        const now = currentConditions(fc[0], this.hourOf(when), this.seed ^ when.dayNumber, region.wet);
        c.drawImage(weatherIcon(now.icon, 320), 170, 270);
        shadowText(c, now.label, 330, 680, 48, YELLOW, { align: 'center', maxW: 420 });
        shadowText(c, `${now.temp}°`, 720, 540, 180, '#ffffff', { align: 'center', shadow: 8 });
        const feels = now.chill !== null && now.chill < now.temp ? `WIND CHILL ${now.chill}°`
            : now.heat !== null && now.heat > now.temp ? `HEAT INDEX ${now.heat}°` : null;
        if (feels) shadowText(c, feels, 720, 680, 40, PALE, { align: 'center' });
        // Divider
        c.fillStyle = 'rgba(11, 18, 64, 0.6)';
        c.fillRect(940, 270, 4, 590);
        c.fillStyle = 'rgba(156, 192, 255, 0.5)';
        c.fillRect(944, 270, 2, 590);
        const trend = { R: 'RISING', F: 'FALLING', S: 'STEADY' }[now.trend];
        const rows = [
            ['HUMIDITY', `${now.humidity}%`],
            ['DEWPOINT', `${now.dew}°`],
            ['WIND', now.wind < 3 ? 'CALM' : `${now.windDir} ${now.wind} MPH`],
            ['GUSTS', now.gust ? `${now.gust} MPH` : 'NONE'],
            ['PRESSURE', `${now.pressure} ${trend}`],
            ['VISIBILITY', `${now.visibility} MI.`],
            ['CEILING', now.ceiling === null ? 'UNLIMITED' : `${now.ceiling} FT.`]
        ];
        rows.forEach(([label, value], i) => {
            const y = 330 + i * 80;
            shadowText(c, label, 1000, y, 44, '#ffffff');
            shadowText(c, value, 1760, y, 44, YELLOW, { align: 'right' });
        });
    }

    page_local(c, { fc, when }) {
        const periods = localForecastText(fc[0], when);
        const maxW = 1620;
        for (let px = 48; px >= 36; px -= 4) {
            c.font = font(px);
            const blocks = periods.map((p) => wrap(c, `${p.title}...${p.text}`, maxW));
            const lh = Math.round(px * 1.22);
            const total = blocks.reduce((n, b) => n + b.length * lh, 0) + (blocks.length - 1) * lh * 0.6;
            if (total > 600 && px > 36) continue;
            let y = 268 + px;
            blocks.forEach((lines) => {
                lines.forEach((line, li) => {
                    if (li === 0) {
                        // The period name in yellow, the rest in white
                        const cut = line.indexOf('...') + 3;
                        const head = line.slice(0, cut);
                        c.font = font(px);
                        const hw = c.measureText(head).width;
                        shadowText(c, head, 140, y, px, YELLOW);
                        shadowText(c, line.slice(cut), 140 + hw, y, px, '#ffffff');
                    } else {
                        shadowText(c, line, 140, y, px, '#ffffff');
                    }
                    y += lh;
                });
                y += lh * 0.6;
            });
            break;
        }
    }

    page_extended(c, { fc, when }) {
        const days = fc[0].slice(1, 6);
        const colW = 1680 / days.length;
        days.forEach((d, i) => {
            const x0 = 120 + i * colW;
            const cx = Math.round(x0 + colW / 2);
            if (i > 0) {
                c.fillStyle = 'rgba(11, 18, 64, 0.5)';
                c.fillRect(Math.round(x0) - 2, 260, 3, 610);
            }
            shadowText(c, DAY_NAMES[(when.dow + i + 1) % 7].slice(0, 3), cx, 318, 56, YELLOW, { align: 'center', italic: true });
            c.drawImage(weatherIcon(d.day.icon, 200), cx - 100, 340);
            c.font = font(36);
            const lines = wrap(c, d.day.label.replace('/', '/ '), colW - 30).slice(0, 2);
            lines.forEach((l, li) => shadowText(c, l.replace('/ ', '/'), cx, 600 + li * 44, 36, '#ffffff', { align: 'center', maxW: colW - 20 }));
            shadowText(c, 'HI', cx - 20, 760, 40, PALE, { align: 'right' });
            shadowText(c, `${d.hi}`, cx, 760, 52, '#ffffff');
            shadowText(c, 'LO', cx - 20, 830, 40, PALE, { align: 'right' });
            shadowText(c, `${d.lo}`, cx, 830, 52, '#ffffff');
        });
    }

    page_regional(c, { fc, when, region }) {
        const hour = this.hourOf(when);
        const cols = { town: 140, icon: 760, wx: 850, temp: 1450, wind: 1520 };
        shadowText(c, 'CITY', cols.town, 300, 36, PALE);
        shadowText(c, 'WEATHER', cols.wx, 300, 36, PALE);
        shadowText(c, 'TEMP', cols.temp, 300, 36, PALE, { align: 'right' });
        shadowText(c, 'WIND', cols.wind, 300, 36, PALE);
        const rows = region.towns.slice(0, this.cfg.maxTableRows);
        rows.forEach((town, i) => {
            const y = 380 + i * 76;
            if (i % 2 === 0) {
                c.fillStyle = 'rgba(8, 16, 70, 0.28)';
                c.fillRect(116, y - 54, 1688, 76);
            }
            const now = currentConditions(fc[i], hour, this.seed ^ when.dayNumber ^ (i * 7919), region.wet);
            shadowText(c, town.name, cols.town, y, 44, '#ffffff', { maxW: 600 });
            c.drawImage(weatherIcon(now.icon, 68), cols.icon, y - 54);
            shadowText(c, now.label, cols.wx, y, 40, YELLOW, { maxW: 500 });
            shadowText(c, `${now.temp}°`, cols.temp, y, 44, '#ffffff', { align: 'right' });
            shadowText(c, now.wind < 3 ? 'CALM' : `${now.windDir} ${now.wind}`, cols.wind, y, 40, '#ffffff');
        });
    }

    page_almanac(c, { region, when }) {
        const days = [0, 1].map((k) => {
            const d = new Date(Date.UTC(when.year, when.month, when.date + k));
            const sun = sunTimes(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), region.lat, region.lon);
            return {
                name: DAY_NAMES[(when.dow + k) % 7],
                rise: sun ? formatClock(sun.rise + when.offsetH * 60) : '--',
                set: sun ? formatClock(sun.set + when.offsetH * 60) : '--'
            };
        });
        const colX = [1000, 1500];
        days.forEach((d, i) => shadowText(c, d.name, colX[i], 320, 44, YELLOW, { align: 'center', italic: true }));
        shadowText(c, 'SUNRISE', 160, 400, 44, '#ffffff');
        shadowText(c, 'SUNSET', 160, 470, 44, '#ffffff');
        days.forEach((d, i) => {
            shadowText(c, d.rise, colX[i], 400, 44, '#ffffff', { align: 'center' });
            shadowText(c, d.set, colX[i], 470, 44, '#ffffff', { align: 'center' });
        });
        c.fillStyle = 'rgba(11, 18, 64, 0.5)';
        c.fillRect(140, 510, 1640, 3);
        shadowText(c, 'MOON PHASES', 160, 580, 44, YELLOW, { italic: true });
        const phases = nextMoonPhases(this.now());
        phases.forEach((p, i) => {
            const cx = 330 + i * 420;
            c.drawImage(weatherIcon(`moon-${p.name.toLowerCase()}`, 140), cx - 70, 600);
            const local = new Date(p.utcMs + when.offsetH * 3600000);
            shadowText(c, p.name, cx, 790, 40, '#ffffff', { align: 'center' });
            shadowText(c, `${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}`, cx, 846, 40, PALE, { align: 'center' });
        });
    }

    // --- Crawl -----------------------------------------------------------

    crawlText() {
        const items = [`YOU ARE WATCHING ${this.cfg.station} WEATHER: YOUR LOCAL CONDITIONS, AROUND THE CLOCK.`];
        let month = 0;
        REGIONS.forEach((region, i) => {
            const { fc, when } = this.forecastFor(i);
            month = when.month;
            items.push(regionBulletin(region, fc, when.dow));
        });
        items.push(seasonTip(month));
        items.push('STAY TUNED: YOUR LOCAL FORECAST IS COMING UP NEXT.');
        return items;
    }

    buildStrip() {
        const items = this.crawlText();
        const key = items.join('|');
        if (key === this.stripKey) return;
        this.stripKey = key;
        const px = 40;
        const gap = 90;
        const m = this.strip.getContext('2d');
        m.font = font(px);
        const widths = items.map((t) => m.measureText(t).width);
        // Chrome's canvas limit is 32767 px; the crawl runs ~15000
        const width = Math.min(32000, Math.ceil(widths.reduce((a, b) => a + b + gap, 0)));
        this.strip.width = width;           // resizing reallocates: once a day at most
        this.strip.height = CRAWL.h;
        const s = this.strip.getContext('2d');
        // A diamond, then the bulletin, for each item; the strip repeats
        let x = 0;
        items.forEach((t, i) => {
            const dx = Math.round(x + gap / 2);
            const dy = CRAWL.baseline - CRAWL.y - 14;
            s.fillStyle = GOLD;
            s.beginPath();
            s.moveTo(dx, dy - 10);
            s.lineTo(dx + 10, dy);
            s.lineTo(dx, dy + 10);
            s.lineTo(dx - 10, dy);
            s.fill();
            x += gap;
            shadowText(s, t, Math.round(x), CRAWL.baseline - CRAWL.y, px, i === 0 ? YELLOW : '#ffffff', { shadow: 3 });
            x += widths[i];
        });
        this.stripWidth = width;
    }

    drawCrawl(tMs) {
        const left = CRAWL.labelRight + 4;
        const top = CRAWL.y + 4;
        const h = CRAWL.h - 7;
        const travel = Math.floor((tMs * this.cfg.crawl.pxPerS) / 1000);
        const offset = travel % this.stripWidth;
        if (offset === this.lastCrawlX) return false;
        if (this.lastCrawlX !== null && offset < this.lastCrawlX) this.buildStrip();   // wrapped: pick up a new day
        this.lastCrawlX = offset;
        const c = this.ctx;
        c.drawImage(this.base, left, top, W - left, h, left, top, W - left, h);
        c.save();
        c.beginPath();
        c.rect(left, top, W - left, h);
        c.clip();
        // The ident opens the crawl at the label, then the strip repeats
        for (let x = left - offset; x < W; x += this.stripWidth) {
            c.drawImage(this.strip, 0, 4, this.stripWidth, h, x, top, this.stripWidth, h);
        }
        c.restore();
        return true;
    }

    // --- Clock -----------------------------------------------------------

    drawClock(force = false) {
        const region = REGIONS[this.shown.regionIndex];
        const t = localParts(this.now(), region);
        const h12 = ((t.hour + 11) % 12) + 1;
        const time = `${h12}:${String(t.minute).padStart(2, '0')}:${String(t.second).padStart(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}`;
        const date = `${t.zone}   ${DAY_NAMES[t.dow].slice(0, 3)} ${MONTHS[t.month]} ${t.date}`;
        const key = `${time}|${date}`;
        if (!force && key === this.lastClock) return false;
        this.lastClock = key;
        const c = this.ctx;
        const r = CLOCK;
        c.drawImage(this.shown.canvas, r.x, r.y - PAGE_Y, r.w, r.h, r.x, r.y, r.w, r.h);
        shadowText(c, time, 1824, 146, 52, '#ffffff', { align: 'right' });
        shadowText(c, date, 1824, 196, 36, PALE, { align: 'right' });
        return true;
    }

    // --- Frame -----------------------------------------------------------

    /**
     * Draw what changed at elapsed time t (ms since start).
     * @param {number} tMs
     * @returns {{cut: boolean}}
     */
    update(tMs) {
        const index = Math.floor(tMs / this.cfg.pageMs);
        let cut = false;
        if (!this.shown || this.shown.index !== index) {
            const t0 = performance.now();
            const prebuilt = this.ahead?.index === index;
            const spare = this.pageCanvases.find((c) => c !== this.shown?.canvas);
            this.shown = this.ahead?.index === index ? this.ahead : this.buildPage(index, spare);
            this.ahead = null;
            if (!this.stripKey) this.buildStrip();
            this.ctx.drawImage(this.base, 0, 0);
            this.ctx.drawImage(this.shown.canvas, 0, PAGE_Y);
            this.lastCrawlX = null;
            this.drawClock(true);
            cut = true;
            // ?debug=events: each cut, and whether it was the one-blit kind
            this.debug?.mark('page', {
                index, region: REGIONS[this.shown.regionIndex].name, page: this.shown.page,
                prebuilt, ms: +(performance.now() - t0).toFixed(2)
            });
        }
        this.drawClock();
        this.drawCrawl(tMs);
        return { cut, index };
    }

    /** Build the next page into the spare canvas, away from any cut. */
    prepareNext() {
        if (!this.shown || this.ahead) return;
        const next = this.shown.index + 1;
        const spare = this.pageCanvases.find((c) => c !== this.shown.canvas);
        this.ahead = this.buildPage(next, spare);
    }
}
