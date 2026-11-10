import { localParts, sunTimes, formatClock, nextMoonPhases, seasonTip, DAY_NAMES, MONTHS } from './forecast.js';
import { weatherIcon } from './icons.js';
import { buildCrtOverlay } from './crt.js';
import { RadarLoader, placeLabels } from './radar.js';
import { skyShort } from './data.js';

// The 90s weather page (AJ, 2026-11-10): an earnest early-90s cable weather
// channel on a 4:3 tube, cutting through forecast pages for one region after
// another, forever. AJ's own look, outside the bible's palette and type rules
// (like spheal); the viewer rules still hold: title-safe (here the inner 90%
// of the picture, Rotom), nothing readable below y 994, no text under 32px,
// hard cuts with no flash (DESIGN.md).
//
// Cost (Performance expert, 2026-11-10): the background, frames and CRT
// overlay are drawn once; each page is drawn into one of two preallocated
// offscreen canvases ahead of its cut, so a cut is a few blits. Per frame only
// the crawl moves (whole pixels); the clock repaints once a second, the radar
// a few times a second, each with the overlay re-blitted over just that box.

const W = 1920;
const H = 1080;
const FONT = 'Arial, "Liberation Sans", Helvetica, sans-serif';
const PIC = { x: 240, y: 0, w: 1440, h: 1080 };     // the 4:3 picture
const SAFE = { left: 312, right: 1608 };             // inner 90% of the picture (Rotom)
const PAGE_Y = 80;                                    // page canvases cover y 80-912
const PAGE_H = 832;
const PANEL = { x: 312, y: 224, w: 1296, h: 680 };
const RADAR = { x: PANEL.x + 6, y: PANEL.y + 6, w: PANEL.w - 12, h: PANEL.h - 12 };
// The band spans the picture; its text stops at title-safe's right edge,
// x 1608 (Rotom, #169)
const CRAWL = { y: 920, h: 88, left: PIC.x, right: PIC.x + PIC.w, textRight: 1608, labelRight: 548, baseline: 976 };   // ink ends by ~990, above 994
const CLOCK = { x: 1290, y: 84, w: 330, h: 122 };
const INK = '#0b1240';
const GOLD = '#ffcc33';
const YELLOW = '#ffe14d';
const PALE = '#c4d6ff';             // secondary text: over 3:1 on the panel (design review, #169)

const PAGE_TITLES = {
    current: 'CURRENT CONDITIONS',
    local: 'LOCAL FORECAST',
    extended: 'EXTENDED FORECAST',
    radar: 'REGIONAL RADAR',
    regional: 'REGIONAL OBSERVATIONS',
    almanac: 'ALMANAC'
};
const NEEDS_DATA = new Set(['current', 'local', 'extended', 'regional']);

function font(px, italic = false) {
    return `${italic ? 'italic ' : ''}bold ${px}px ${FONT}`;
}

// While set, shadowText notes each line's ink box here, for the motion
// harness's SAFE and TYPE checks (registerProbe; nothing reads it on stream)
let textLog = null;

/**
 * Text the way a 90s character generator drew it: a hard black drop shadow,
 * then the face with a little phosphor glow, and on big type a faint red and
 * blue fringe (never on small numbers, Rotom). Only ever called while
 * building a cached canvas, or for the clock once a second.
 */
function shadowText(ctx, text, x, y, px, color, { align = 'left', italic = false, shadow = 0, maxW = Infinity, glow = true } = {}) {
    ctx.font = font(px, italic);
    let size = px;
    while (size > 32 && ctx.measureText(text).width > maxW) {
        size -= 2;
        ctx.font = font(size, italic);
    }
    // Live text can run long: past the 32px floor, drop words from the end
    while (text.includes(' ') && ctx.measureText(text).width > maxW) {
        text = text.slice(0, text.lastIndexOf(' '));
    }
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    const s = shadow || Math.max(3, Math.round(size / 16));
    ctx.fillStyle = 'rgba(0, 0, 20, 0.85)';
    ctx.fillText(text, x + s, y + s);
    if (size >= 48) {
        ctx.fillStyle = 'rgba(255, 40, 80, 0.28)';
        ctx.fillText(text, x - 2, y);
        ctx.fillStyle = 'rgba(40, 160, 255, 0.28)';
        ctx.fillText(text, x + 2, y);
    }
    if (glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = Math.min(10, size / 6);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    if (textLog) {
        const m = ctx.measureText(text);
        const left = x - (align === 'center' ? m.width / 2 : align === 'right' ? m.width : 0);
        // The ink box, shadow included
        textLog.push({
            box: { x: left, y: y - m.actualBoundingBoxAscent, width: m.width + s, height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + s },
            fontPx: size,
            words: text.split(/\s+/).filter(Boolean).length
        });
    }
    return size;
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

const dash = (v, unit = '') => (v === null || v === undefined || Number.isNaN(v) ? '--' : `${v}${unit}`);

export class WeatherChannel {
    /**
     * @param {HTMLCanvasElement} canvas - 1920x1080, opaque
     * @param {Object} options
     * @param {Object} options.cfg - config.weather
     * @param {Object} options.data - NwsSource or DemoSource (data.js)
     * @param {() => number} options.now - Wall clock, UTC ms
     * @param {number} [options.region=0] - Region to start with
     * @param {string|null} [options.page=null] - Hold one page (mocks)
     * @param {Object} [options.debug]
     * @param {Function} [options.fetch] - For the radar tiles
     */
    constructor(canvas, { cfg, data, now, region = 0, page = null, debug = null, fetch: fetchImpl }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.cfg = cfg;
        this.data = data;
        this.regions = data.regions;
        this.now = now;
        this.startRegion = region;
        this.pages = page ? [page] : cfg.pages;
        this.debug = debug;
        this.base = makeCanvas(W, H);
        this.overlay = buildCrtOverlay(W, H, PIC, cfg.crt);
        this.pageCanvases = [makeCanvas(W, PAGE_H), makeCanvas(W, PAGE_H)];
        this.radar = new RadarLoader({
            w: RADAR.w, h: RADAR.h, cfg: cfg.radar, demo: data.source === 'demo', now, debug,
            ...(fetchImpl ? { fetch: fetchImpl } : {})
        });
        this.shown = null;          // {index, canvas, regionIndex, page, texts, at}
        this.ahead = null;
        this.strip = makeCanvas(16, CRAWL.h);
        this.stripKey = null;
        this.crawlOrigin = 0;       // travel (px) at which the current strip started
        this.lastClock = '';
        this.lastCrawlX = null;
        this.lastRadarFrame = -1;
        this.drawBase();
    }

    /** Which region and page a page index is. */
    slot(index) {
        const n = this.pages.length;
        return {
            regionIndex: (this.startRegion + Math.floor(index / n)) % this.regions.length,
            page: this.pages[index % n]
        };
    }

    /** Blit the CRT overlay over one box of the frame. */
    glass(x, y, w, h) {
        this.ctx.drawImage(this.overlay, x, y, w, h, x, y, w, h);
    }

    // --- Drawing once ----------------------------------------------------

    drawBase() {
        const c = this.base.getContext('2d', { alpha: false });
        c.fillStyle = '#000';
        c.fillRect(0, 0, W, H);
        const bg = c.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#071450');
        bg.addColorStop(0.5, '#1b3596');
        bg.addColorStop(1, '#341872');
        c.fillStyle = bg;
        c.fillRect(PIC.x, PIC.y, PIC.w, PIC.h);

        // Header shade and the gold rule under it
        const hs = c.createLinearGradient(0, 80, 0, 214);
        hs.addColorStop(0, 'rgba(0, 0, 30, 0.45)');
        hs.addColorStop(1, 'rgba(0, 0, 30, 0)');
        c.fillStyle = hs;
        c.fillRect(PIC.x, 80, PIC.w, 134);
        const rule = c.createLinearGradient(SAFE.left, 0, SAFE.right, 0);
        rule.addColorStop(0, GOLD);
        rule.addColorStop(1, '#ff6a1a');
        c.fillStyle = INK;
        c.fillRect(SAFE.left, 206, SAFE.right - SAFE.left, 10);
        c.fillStyle = rule;
        c.fillRect(SAFE.left, 208, SAFE.right - SAFE.left, 6);

        this.drawLogo(c, SAFE.left, 92, 168, 104);

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

        // Crawl bar across the picture; its label sits inside the safe area
        c.fillStyle = '#060b30';
        c.fillRect(CRAWL.left, CRAWL.y, CRAWL.right - CRAWL.left, CRAWL.h);
        c.fillStyle = GOLD;
        c.fillRect(CRAWL.left, CRAWL.y, CRAWL.right - CRAWL.left, 4);
        c.fillStyle = '#3e68dc';
        c.fillRect(CRAWL.left, CRAWL.y + CRAWL.h - 3, CRAWL.right - CRAWL.left, 3);
        const lb = c.createLinearGradient(0, CRAWL.y + 4, 0, CRAWL.y + CRAWL.h - 3);
        lb.addColorStop(0, '#ffb31f');
        lb.addColorStop(1, '#ff5a1f');
        c.fillStyle = lb;
        c.fillRect(SAFE.left, CRAWL.y + 4, CRAWL.labelRight - SAFE.left, CRAWL.h - 7);
        c.fillStyle = INK;
        c.fillRect(CRAWL.labelRight, CRAWL.y + 4, 4, CRAWL.h - 7);
        textLog = this.baseTexts = [];
        shadowText(c, 'BULLETIN', (SAFE.left + CRAWL.labelRight) / 2, CRAWL.baseline - 2, 36, '#ffffff', { align: 'center', italic: true, shadow: 3 });
        textLog = null;
    }

    drawLogo(c, x, y, w, h) {
        const path = () => {
            c.beginPath();
            c.roundRect(x, y, w, h, 12);
        };
        path();
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
        shadowText(c, this.cfg.station, x + w / 2, y + 60, 56, '#ffffff', { align: 'center', italic: true, shadow: 4, maxW: w - 16 });
        c.fillStyle = INK;
        c.fillRect(x + 10, y + 68, w - 20, 30);
        c.font = font(30);
        c.textAlign = 'center';
        c.fillStyle = YELLOW;
        c.fillText('WEATHER', x + w / 2, y + 94);
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
        const region = this.regions[regionIndex];
        const when = localParts(this.now(), region);
        const data = this.data.get(regionIndex);
        const texts = [];
        textLog = texts;
        const subtitle = page === 'regional' || page === 'radar' ? region.name : region.towns[0].name;
        shadowText(c, PAGE_TITLES[page], 504, 148, 56, YELLOW, { italic: true, maxW: 770 });
        shadowText(c, subtitle, 506, 194, 36, '#ffffff', { maxW: 770 });
        if (NEEDS_DATA.has(page) && !data) this.page_unavailable(c);
        else this[`page_${page}`](c, { data, when, region });
        textLog = null;
        c.setTransform(1, 0, 0, 1, 0, 0);
        return { index, canvas: target, regionIndex, page, texts };
    }

    /** "As of 4:51 PM" from an observation time, in the region's zone. */
    asOf(c, utcMs, region, y = 878) {
        if (!utcMs) return;
        const t = localParts(utcMs, region);
        const label = `${this.data.source === 'demo' ? 'DEMO DATA: ' : ''}OBSERVED ${formatClock(t.hour * 60 + t.minute)} ${t.zone}`;
        shadowText(c, label, 960, y, 32, PALE, { align: 'center', glow: false });
    }

    page_unavailable(c) {
        shadowText(c, 'DATA TEMPORARILY UNAVAILABLE', 960, 540, 48, YELLOW, { align: 'center', maxW: 1200 });
        shadowText(c, 'PLEASE STAND BY', 960, 610, 40, '#ffffff', { align: 'center' });
    }

    page_current(c, { data, region }) {
        const now = data.home.now;
        if (!now) {
            this.page_unavailable(c);
            return;
        }
        c.drawImage(weatherIcon(now.icon, 260), 340, 256);
        shadowText(c, now.temp === null ? '--' : `${now.temp}°`, 760, 470, 150, '#ffffff', { align: 'center', shadow: 7, maxW: 300 });
        // Live sky text runs long ("THUNDERSTORM IN VICINITY"): up to two
        // lines across the left column, then the feels-like line under it
        const colX = 625;
        const colW = 560;
        c.font = font(40);
        let px = 40;
        let lines = wrap(c, now.label, colW);
        if (lines.length > 2) {
            px = 36;
            c.font = font(px);
            lines = wrap(c, now.label, colW).slice(0, 2);
        }
        lines.forEach((line, i) => shadowText(c, line, colX, 590 + i * 50, px, YELLOW, { align: 'center', maxW: colW }));
        const feels = now.chill !== null && now.temp !== null && now.chill < now.temp ? `WIND CHILL ${now.chill}°`
            : now.heat !== null && now.temp !== null && now.heat > now.temp ? `HEAT INDEX ${now.heat}°` : null;
        if (feels) shadowText(c, feels, colX, 590 + lines.length * 50 + 24, 36, PALE, { align: 'center', maxW: colW, glow: false });
        c.fillStyle = 'rgba(11, 18, 64, 0.6)';
        c.fillRect(930, 262, 4, 560);
        c.fillStyle = 'rgba(156, 192, 255, 0.5)';
        c.fillRect(934, 262, 2, 560);
        const trend = now.trend ? { R: ' RISING', F: ' FALLING', S: ' STEADY' }[now.trend] : '';
        const rows = [
            ['HUMIDITY', dash(now.humidity, '%')],
            ['DEWPOINT', dash(now.dew, '°')],
            ['WIND', now.wind === null ? '--' : now.wind < 3 ? 'CALM' : `${now.windDir} ${now.wind} MPH`],
            ['GUSTS', now.gust ? `${now.gust} MPH` : 'NONE'],
            ['PRESSURE', now.pressure === null ? '--' : `${now.pressure}${trend}`],
            ['VISIBILITY', dash(now.visibility, ' MI.')],
            ['CEILING', now.ceiling === null ? 'UNLIMITED' : `${now.ceiling} FT.`]
        ];
        rows.forEach(([label, value], i) => {
            const y = 302 + i * 76;
            shadowText(c, label, 966, y, 40, '#ffffff');
            shadowText(c, value, 1578, y, 40, YELLOW, { align: 'right', maxW: 330 });
        });
        this.asOf(c, now.time, region);
    }

    page_local(c, { data }) {
        const periods = data.home.periods;
        if (!periods.length) {
            this.page_unavailable(c);
            return;
        }
        const maxW = 1220;
        const room = 880 - 256;
        let px = 44;
        let blocks = [];
        // Shrink to fit, then drop the last period if it still won't
        for (let keep = periods.length; keep > 0; keep--) {
            for (px = 44; px >= 36; px -= 4) {
                c.font = font(px);
                blocks = periods.slice(0, keep).map((p) => wrap(c, `${p.title}...${p.text}`, maxW));
                const lh = Math.round(px * 1.22);
                const total = blocks.reduce((n, b) => n + b.length * lh, 0) + (blocks.length - 1) * lh * 0.5;
                if (total <= room) break;
            }
            const lh = Math.round(px * 1.22);
            if (blocks.reduce((n, b) => n + b.length * lh, 0) + (blocks.length - 1) * lh * 0.5 <= room) break;
        }
        const lh = Math.round(px * 1.22);
        let y = 256 + px;
        blocks.forEach((lines) => {
            lines.forEach((line, li) => {
                if (y > 880) return;
                if (li === 0 && line.includes('...')) {
                    const cut = line.indexOf('...') + 3;
                    const head = line.slice(0, cut);
                    c.font = font(px);
                    const hw = c.measureText(head).width;
                    shadowText(c, head, 346, y, px, YELLOW, { glow: false });
                    shadowText(c, line.slice(cut), 346 + hw, y, px, '#ffffff', { glow: false });
                } else {
                    shadowText(c, line, 346, y, px, '#ffffff', { glow: false });
                }
                y += lh;
            });
            y += lh * 0.5;
        });
    }

    page_extended(c, { data }) {
        const days = data.home.days.slice(0, 4);
        if (!days.length) {
            this.page_unavailable(c);
            return;
        }
        const colW = 1248 / 4;
        days.forEach((d, i) => {
            const x0 = 336 + i * colW;
            const cx = Math.round(x0 + colW / 2);
            if (i > 0) {
                c.fillStyle = 'rgba(11, 18, 64, 0.5)';
                c.fillRect(Math.round(x0) - 2, 256, 3, 620);
            }
            shadowText(c, d.name, cx, 304, 52, YELLOW, { align: 'center', italic: true });
            c.drawImage(weatherIcon(d.icon, 180), cx - 90, 326);
            c.font = font(36);
            const lines = wrap(c, d.label.replace(/\//g, '/ '), colW - 24).slice(0, 2);
            lines.forEach((l, li) => shadowText(c, l.replace(/\/ /g, '/'), cx, 558 + li * 44, 36, '#ffffff', { align: 'center', maxW: colW - 16, glow: false }));
            shadowText(c, 'HI', cx - 20, 730, 36, PALE, { align: 'right', glow: false });
            shadowText(c, dash(d.hi), cx, 730, 52, '#ffffff');
            shadowText(c, 'LO', cx - 20, 806, 36, PALE, { align: 'right', glow: false });
            shadowText(c, dash(d.lo), cx, 806, 52, '#ffffff');
        });
    }

    page_regional(c, { data, region }) {
        const cols = { town: 340, icon: 738, wx: 812, temp: 1400, wind: 1428 };
        shadowText(c, 'CITY', cols.town, 290, 32, PALE, { glow: false });
        shadowText(c, 'WEATHER', cols.wx, 290, 32, PALE, { glow: false });
        shadowText(c, 'TEMP', cols.temp, 290, 32, PALE, { align: 'right', glow: false });
        shadowText(c, 'WIND', cols.wind, 290, 32, PALE, { glow: false });
        data.towns.slice(0, this.cfg.maxTableRows).forEach((town, i) => {
            const y = 358 + i * 72;
            if (i % 2 === 0) {
                c.fillStyle = 'rgba(8, 16, 70, 0.28)';
                c.fillRect(318, y - 50, 1284, 72);
            }
            const now = town.now;
            shadowText(c, town.name, cols.town, y, 40, '#ffffff', { maxW: 390, glow: false });
            if (!now) {
                shadowText(c, 'NOT AVAILABLE', cols.wx, y, 36, PALE, { glow: false });
                return;
            }
            c.drawImage(weatherIcon(now.icon, 64), cols.icon, y - 50);
            shadowText(c, skyShort(now.label), cols.wx, y, 36, YELLOW, { maxW: 480, glow: false });
            shadowText(c, now.temp === null ? '--' : `${now.temp}°`, cols.temp, y, 40, '#ffffff', { align: 'right', glow: false });
            shadowText(c, now.wind === null ? '--' : now.wind < 3 ? 'CALM' : `${now.windDir} ${now.wind}`, cols.wind, y, 36, '#ffffff', { maxW: 176, glow: false });
        });
        this.asOf(c, data.asOf, region);
    }

    page_almanac(c, { region, when }) {
        const home = region.towns[0];
        const lat = home.lat ?? region.lat;
        const lon = home.lon ?? region.lon;
        const days = [0, 1].map((k) => {
            const d = new Date(Date.UTC(when.year, when.month, when.date + k));
            const sun = sunTimes(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), lat, lon);
            return {
                name: DAY_NAMES[(when.dow + k) % 7],
                rise: sun ? formatClock(sun.rise + when.offsetH * 60) : '--',
                set: sun ? formatClock(sun.set + when.offsetH * 60) : '--'
            };
        });
        const colX = [1080, 1420];
        days.forEach((d, i) => shadowText(c, d.name, colX[i], 300, 40, YELLOW, { align: 'center', italic: true, maxW: 320 }));
        shadowText(c, 'SUNRISE', 350, 380, 40, '#ffffff');
        shadowText(c, 'SUNSET', 350, 450, 40, '#ffffff');
        days.forEach((d, i) => {
            shadowText(c, d.rise, colX[i], 380, 40, '#ffffff', { align: 'center' });
            shadowText(c, d.set, colX[i], 450, 40, '#ffffff', { align: 'center' });
        });
        c.fillStyle = 'rgba(11, 18, 64, 0.5)';
        c.fillRect(340, 488, 1240, 3);
        shadowText(c, 'MOON PHASES', 350, 556, 40, YELLOW, { italic: true });
        nextMoonPhases(this.now()).forEach((p, i) => {
            const cx = 336 + 156 + i * 312;
            c.drawImage(weatherIcon(`moon-${p.name.toLowerCase()}`, 130), cx - 65, 580);
            const local = new Date(p.utcMs + when.offsetH * 3600000);
            shadowText(c, p.name, cx, 768, 36, '#ffffff', { align: 'center' });
            shadowText(c, `${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}`, cx, 826, 36, PALE, { align: 'center' });
        });
    }

    page_radar(c, { region }) {
        // The loop's frames are drawn over this box while the page is up; this
        // is what shows if the radar isn't ready
        c.fillStyle = '#071040';
        c.fillRect(RADAR.x, RADAR.y, RADAR.w, RADAR.h);
        if (!this.radarReadyFor(region)) {
            shadowText(c, 'RADAR TEMPORARILY UNAVAILABLE', 960, 540, 44, YELLOW, { align: 'center', maxW: 1200 });
            shadowText(c, 'PLEASE STAND BY', 960, 606, 36, '#ffffff', { align: 'center' });
        } else {
            // Record the loop's text for the harness: labels and the stamp
            this.radarTexts.forEach((t) => textLog?.push(t));
        }
    }

    radarReadyFor(region) {
        return this.radar.ready?.key === region.name;
    }

    /** Town markers on a radar frame (radar-canvas coordinates). */
    drawRadarLabels(ctx, marks) {
        // Every dot first, so no label lands under a later town's dot
        // (Rotom, #169); labels then go where placeLabels finds room
        const inside = marks.filter((m) => m.x >= 30 && m.x <= RADAR.w - 30 && m.y >= 30 && m.y <= RADAR.h - 30);
        inside.forEach((m) => {
            ctx.fillStyle = INK;
            ctx.beginPath();
            ctx.arc(m.x, m.y, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.font = font(32);
        const spots = placeLabels(inside, inside.map((m) => ctx.measureText(m.name).width), RADAR.w, RADAR.h - 76);
        spots.forEach((spot, i) => {
            if (spot) shadowText(ctx, inside[i].name, spot.x, spot.y, 32, '#ffffff', { align: spot.align, glow: false, shadow: 3 });
        });
    }

    /** Time and legend on a radar frame. */
    drawRadarStamp(ctx, utcMs, region) {
        const t = localParts(utcMs, region);
        ctx.fillStyle = 'rgba(6, 11, 48, 0.8)';
        ctx.fillRect(RADAR.w - 300, RADAR.h - 70, 300, 70);
        ctx.fillRect(0, RADAR.h - 70, 470, 70);
        shadowText(ctx, `${formatClock(t.hour * 60 + t.minute)} ${t.zone}`, RADAR.w - 20, RADAR.h - 22, 36, YELLOW, { align: 'right', glow: false });
        shadowText(ctx, 'LIGHT', 18, RADAR.h - 22, 32, '#ffffff', { glow: false });
        ['#1ee63c', '#28b43c', '#f0dc28', '#f08c1e', '#e6281e'].forEach((col, i) => {
            ctx.fillStyle = col;
            ctx.fillRect(130 + i * 40, RADAR.h - 50, 36, 26);
        });
        shadowText(ctx, 'HEAVY', 340, RADAR.h - 22, 32, '#ffffff', { glow: false });
    }

    /** Start building a region's radar loop, unless it's already up to date. */
    prepareRadar(regionIndex) {
        const region = this.regions[regionIndex];
        // Never rebuild the frames a radar page is showing
        if (this.shown?.page === 'radar' && this.radarReadyFor(this.regions[this.shown.regionIndex])) return;
        // Text the loop draws, in frame px, for the harness probe
        const log = [];
        const drawLabels = (ctx, marks) => {
            textLog = ctx === this.radar.frames[0].getContext('2d') ? log : null;
            this.drawRadarLabels(ctx, marks);
            textLog = null;
        };
        const drawStamp = (ctx, utc) => {
            textLog = ctx === this.radar.frames[0].getContext('2d') ? log : null;
            this.drawRadarStamp(ctx, utc, region);
            textLog = null;
        };
        // Demo towns have no coordinates: scatter them round the region's
        // centre so the harness still sees markers and labels
        const towns = region.towns.map((t, k) => (t.lat !== undefined ? t : {
            ...t, lat: region.lat + (0.6 + 0.5 * k) * Math.sin(k * 2.4), lon: region.lon + (0.9 + 0.75 * k) * Math.cos(k * 2.4)
        }));
        this.radar.prepare(region.name, towns, drawLabels, drawStamp).then(() => {
            // A repeat ask shares the running build and logs nothing: keep
            // the texts the first one logged
            if (this.radar.ready?.key === region.name && log.length) {
                this.radarTexts = log.map((t) => ({ ...t, box: { ...t.box, x: t.box.x + RADAR.x, y: t.box.y + RADAR.y } }));
            }
        });
    }

    // --- Crawl -----------------------------------------------------------

    crawlText() {
        const items = [`YOU ARE WATCHING ${this.cfg.station} WEATHER: YOUR LOCAL CONDITIONS, AROUND THE CLOCK.`];
        let month = new Date(this.now()).getUTCMonth();
        this.regions.forEach((region, i) => {
            const d = this.data.get(i);
            if (!d) return;
            month = localParts(this.now(), region).month;
            const obs = d.towns.filter((t) => t.now && t.now.temp !== null);
            if (!obs.length) return;
            const parts = obs.slice(0, 4).map((t) => `${t.name} ${t.now.temp}° ${t.now.label === '--' ? '' : skyShort(t.now.label)}`.trim());
            items.push(`${region.name}: ${parts.join('. ')}.`);
        });
        items.push(seasonTip(month));
        items.push('STAY TUNED: YOUR LOCAL FORECAST IS COMING UP NEXT.');
        return items;
    }

    buildStrip() {
        const items = this.crawlText();
        const key = items.join('|');
        if (key === this.stripKey) return false;
        this.stripKey = key;
        const px = 36;
        const gap = 90;
        const m = this.strip.getContext('2d');
        m.font = font(px);
        const widths = items.map((t) => m.measureText(t).width);
        // Chrome's canvas limit is 32767 px: past 32000, drop whole
        // bulletins from the end rather than cut one off
        while (items.length > 1 && widths.reduce((a, b) => a + b + gap, 0) > 32000) {
            items.pop();
            widths.pop();
        }
        const width = Math.ceil(widths.reduce((a, b) => a + b + gap, 0));
        this.strip.width = width;           // resizing reallocates: only when the text changes
        this.strip.height = CRAWL.h;
        const s = this.strip.getContext('2d');
        s.font = font(px);
        const ink = s.measureText(items[0]);
        // The line's ink rows in frame px, for the harness's SAFE-3 check
        this.crawlInk = { top: CRAWL.baseline - ink.actualBoundingBoxAscent, bottom: CRAWL.baseline + ink.actualBoundingBoxDescent + 3, px };
        let x = 0;
        items.forEach((t, i) => {
            const dx = Math.round(x + gap / 2);
            const dy = CRAWL.baseline - CRAWL.y - 13;
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
        return true;
    }

    drawCrawl(tMs) {
        const left = CRAWL.labelRight + 4;
        const top = CRAWL.y + 4;
        const h = CRAWL.h - 7;
        const w = CRAWL.textRight - left;
        const travel = Math.floor((tMs * this.cfg.crawl.pxPerS) / 1000);
        const offset = (travel - this.crawlOrigin) % this.stripWidth;
        if (offset === this.lastCrawlX) return false;
        // Wrapped: pick up new bulletins. A new strip has a new width, so
        // restart its count here to keep the line moving smoothly
        if (this.lastCrawlX !== null && offset < this.lastCrawlX && this.buildStrip()) {
            this.crawlOrigin = travel - offset;
        }
        this.lastCrawlX = offset;
        const c = this.ctx;
        c.drawImage(this.base, left, top, w, h, left, top, w, h);
        c.save();
        c.beginPath();
        c.rect(left, top, w, h);
        c.clip();
        for (let x = left - offset; x < CRAWL.textRight; x += this.stripWidth) {
            c.drawImage(this.strip, 0, 4, this.stripWidth, h, x, top, this.stripWidth, h);
        }
        c.restore();
        this.glass(left, top, w, h);
        return true;
    }

    // --- Clock -----------------------------------------------------------

    drawClock(force = false) {
        const region = this.regions[this.shown.regionIndex];
        const t = localParts(this.now(), region);
        const h12 = ((t.hour + 11) % 12) + 1;
        const time = `${h12}:${String(t.minute).padStart(2, '0')}:${String(t.second).padStart(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}`;
        const date = `${t.zone}  ${DAY_NAMES[t.dow].slice(0, 3)} ${MONTHS[t.month]} ${t.date}`;
        const key = `${time}|${date}`;
        if (!force && key === this.lastClock) return false;
        this.lastClock = key;
        const c = this.ctx;
        const r = CLOCK;
        c.drawImage(this.shown.canvas, r.x, r.y - PAGE_Y, r.w, r.h, r.x, r.y, r.w, r.h);
        textLog = this.clockTexts = [];
        shadowText(c, time, 1602, 142, 44, '#ffffff', { align: 'right' });
        shadowText(c, date, 1602, 192, 36, PALE, { align: 'right', glow: false });
        textLog = null;
        this.glass(r.x, r.y, r.w, r.h);
        return true;
    }

    // --- Radar loop ------------------------------------------------------

    drawRadarFrame(tMs, force = false) {
        const ready = this.radar.ready;
        if (!ready || !this.radarReadyFor(this.regions[this.shown.regionIndex])) return false;
        const n = ready.times.length;
        const r = this.cfg.radar;
        const loopMs = (n - 1) * r.frameMs + r.holdMs;
        const into = (tMs - this.shown.at) % loopMs;
        const f = Math.min(n - 1, Math.floor(into / r.frameMs));
        if (!force && f === this.lastRadarFrame) return false;
        this.lastRadarFrame = f;
        this.ctx.drawImage(this.radar.frames[f], RADAR.x, RADAR.y);
        this.glass(RADAR.x, RADAR.y, RADAR.w, RADAR.h);
        return true;
    }

    // --- Frame -----------------------------------------------------------

    /**
     * Draw what changed at elapsed time t (ms since start).
     * @param {number} tMs
     * @returns {{cut: boolean, index: number}}
     */
    update(tMs) {
        const index = Math.floor(tMs / this.cfg.pageMs);
        let cut = false;
        if (!this.shown || this.shown.index !== index) {
            const t0 = performance.now();
            const prebuilt = this.ahead?.index === index;
            const spare = this.pageCanvases.find((c) => c !== this.shown?.canvas);
            this.shown = prebuilt ? this.ahead : this.buildPage(index, spare);
            this.shown.at = tMs;
            this.ahead = null;
            if (!this.stripKey) this.buildStrip();
            const c = this.ctx;
            c.drawImage(this.base, 0, 0);
            c.drawImage(this.shown.canvas, 0, PAGE_Y);
            c.drawImage(this.overlay, 0, 0);
            this.lastCrawlX = null;
            this.lastRadarFrame = -1;
            this.drawClock(true);
            if (this.shown.page === 'radar') this.drawRadarFrame(tMs, true);
            cut = true;
            this.lookAhead(index);
            // ?debug=events: each cut, and whether it was the one-blit kind
            this.debug?.mark('page', {
                index, region: this.regions[this.shown.regionIndex].name, page: this.shown.page,
                prebuilt, ms: +(performance.now() - t0).toFixed(2)
            });
        }
        this.drawClock();
        if (this.shown.page === 'radar') this.drawRadarFrame(tMs);
        this.drawCrawl(tMs);
        return { cut, index };
    }

    /** Fetch the data and radar the next pages need, well before their cuts. */
    lookAhead(index) {
        if (typeof document !== 'undefined' && document.hidden) return;
        // A radar page on air without its loop (the first page, or a slow
        // build): build this one now; its frames cover the stand-by card
        if (this.shown.page === 'radar' && !this.radarReadyFor(this.regions[this.shown.regionIndex])) {
            this.prepareRadar(this.shown.regionIndex);
            for (let k = 1; k <= this.cfg.data.lookAheadPages; k++) this.data.ensure(this.slot(index + k).regionIndex);
            return;
        }
        const n = this.pages.length;
        for (let k = 1; k <= n; k++) {
            const s = this.slot(index + k);
            if (k <= this.cfg.data.lookAheadPages) this.data.ensure(s.regionIndex);
            if (s.page === 'radar') {
                if (s.regionIndex !== this.shown.regionIndex || this.shown.page !== 'radar') this.prepareRadar(s.regionIndex);
                break;
            }
        }
    }

    /** Build the next page into the spare canvas, away from any cut. */
    prepareNext() {
        if (!this.shown || this.ahead) return;
        const next = this.shown.index + 1;
        const spare = this.pageCanvases.find((c) => c !== this.shown.canvas);
        this.ahead = this.buildPage(next, spare);
    }

    /**
     * Text on screen now, for the motion harness (registerProbe): every line
     * of the page, the clock and the crawl label, plus the crawl's lane. The
     * crawl runs to the picture's edge past title-safe by design (DESIGN.md);
     * its id is `crawl` so a scenario can leave it out of SAFE-1.
     * @returns {Array<Object>}
     */
    probeSamples() {
        if (!this.shown) return [];
        const out = [...this.baseTexts, ...this.shown.texts, ...(this.clockTexts ?? [])]
            .map((t, i) => ({ id: `text${i}`, x: t.box.x, y: t.box.y, onscreen: true, ...t }));
        if (this.crawlInk) {
            const left = CRAWL.labelRight + 4;
            out.push({
                id: 'crawl', x: left, y: this.crawlInk.top, onscreen: true, fontPx: this.crawlInk.px, words: 0,
                box: { x: left, y: this.crawlInk.top, width: CRAWL.textRight - left, height: this.crawlInk.bottom - this.crawlInk.top }
            });
        }
        return out;
    }
}
