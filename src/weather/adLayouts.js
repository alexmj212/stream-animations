// The eight ad formats for Exo-Cast's breaks (AJ, 2026-11-11, after a
// head-writer review: "consideration of variety, variation in all aspects").
// Each one copies a real early-90s local spot, so no two breaks in a row
// look alike: a shouting car lot, a clip-out coupon, a menu board, a
// perfume spot, a spokesperson, a community bulletin board, a newspaper
// classified and an infomercial. All coordinates are frame px; the picture
// is x 240-1680, y 80-912, title-safe x 312-1608. Every text call passes a
// maxW so it shrinks rather than leaves title-safe, nothing is under 32px,
// and the lowest baseline is 884 (above the crawl).

import { drawAdArt, drawStarburst } from './ads.js';

// Anton and Archivo Black stand in for Impact and Arial Black where those
// aren't installed (the mock container); OBS on Windows has both.
const IMPACT = 'Impact, Anton, "Arial Black", "Liberation Sans", sans-serif';
const BLACK = '"Arial Black", "Archivo Black", Arial, "Liberation Sans", sans-serif';
const ARIAL = 'Arial, "Liberation Sans", Helvetica, sans-serif';
const COURIER = '"Courier New", Courier, "Liberation Mono", monospace';
const SERIF = '"Times New Roman", Times, "Liberation Serif", serif';
const PIC = { x: 240, y: 80, w: 1440, h: 832 };
const SAFE = { left: 312, right: 1608 };
const DEG = Math.PI / 180;

/**
 * @typedef {Object} AdTools
 * @property {Function} T - plainText(text, x, y, px, opts) on the ad's canvas
 * @property {(text: string, maxW: number) => string[]} wrap - Wrap in the canvas's current font
 * @property {(ad: Object) => (CanvasImageSource|null)} [photo] - The ad's photo, once loaded
 */

/**
 * Draw a text ad over the whole picture.
 * @param {CanvasRenderingContext2D} c
 * @param {Object} ad - One of ADS
 * @param {AdTools} tools
 */
export function drawAd(c, ad, tools) {
    const draw = LAYOUTS[ad.layout] ?? LAYOUTS.menu;
    c.save();
    c.beginPath();
    c.rect(PIC.x, PIC.y, PIC.w, PIC.h);
    c.clip();
    draw(c, ad, tools);
    paidPill(c, tools.T);
    c.restore();
}

/** The layouts an ad can name. */
export const AD_LAYOUTS = ['shout', 'coupon', 'menu', 'luxe', 'spokes', 'bulletin', 'classified', 'infomercial'];

// --- Shared pieces -------------------------------------------------------

function paidPill(c, T) {
    c.beginPath();
    c.roundRect(760, 94, 400, 42, 21);
    c.fillStyle = '#f2f2f2';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = '#111111';
    c.stroke();
    T('PAID ADVERTISEMENT', 960, 124, 32, { align: 'center', bold: true, family: ARIAL, maxW: 380, color: '#111111' });
}

/**
 * The ad's picture, whole and as big as fits the box (AJ, 2026-11-11: "The
 * pictures on the ads need to larger and not cropped in weird way"): a
 * cut-out (transparent PNG) stands on the ad with a hard 90s drop shadow; a
 * photo is a print with a white border. No photo yet: the drawn clip art.
 * @param {{x: number, y: number, w: number, h: number}} box
 */
function picture(c, ad, box, tools) {
    const img = tools.photo?.(ad);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    if (!img) {
        drawAdArt(c, ad.art, cx, cy, Math.min(box.w, box.h));
        return;
    }
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const pad = ad.photoCutout ? 0 : 14;
    const k = Math.min((box.w - 2 * pad) / iw, (box.h - 2 * pad) / ih);
    const w = Math.round(iw * k);
    const h = Math.round(ih * k);
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy - h / 2);
    if (ad.photoCutout) {
        c.save();
        c.shadowColor = 'hsla(0, 0%, 0%, 0.55)';
        c.shadowOffsetX = 10;
        c.shadowOffsetY = 10;
        c.drawImage(img, x, y, w, h);
        c.restore();
        return;
    }
    c.fillStyle = 'hsla(0, 0%, 0%, 0.45)';
    c.fillRect(x - pad + 10, y - pad + 10, w + 2 * pad, h + 2 * pad);
    c.fillStyle = '#fbfaf5';
    c.fillRect(x - pad, y - pad, w + 2 * pad, h + 2 * pad);
    c.drawImage(img, x, y, w, h);
    c.lineWidth = 3;
    c.strokeStyle = '#111111';
    c.strokeRect(x - pad, y - pad, w + 2 * pad, h + 2 * pad);
}

function starburstDeal(c, T, cx, cy, r, lines, fill, ink, family = IMPACT) {
    drawStarburst(c, cx, cy, r, fill);
    const px = lines.length > 1 ? Math.round(r * 0.32) : Math.round(r * 0.36);
    lines.forEach((line, i) => {
        const ly = cy + (i - (lines.length - 1) / 2) * (px + 4) + px * 0.36;
        T(line, cx, ly, px, { align: 'center', family, maxW: r * 1.5, color: ink });
    });
}

function vGradient(c, top, bottom, a, b) {
    const g = c.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
}

// --- Layouts -------------------------------------------------------------

const LAYOUTS = {
    /** A car-lot shouter: sunburst, outlined headline, slanted banner, starburst. */
    shout(c, ad, tools) {
        const { T } = tools;
        const k = ad.colors;
        c.fillStyle = k.a;
        c.fillRect(PIC.x, PIC.y, PIC.w, PIC.h);
        c.fillStyle = k.b;
        for (let i = 0; i < 16; i += 2) {
            const a0 = (i / 16) * Math.PI * 2;
            const a1 = ((i + 1) / 16) * Math.PI * 2;
            c.beginPath();
            c.moveTo(960, 480);
            c.lineTo(960 + Math.cos(a0) * 1400, 480 + Math.sin(a0) * 1400);
            c.lineTo(960 + Math.cos(a1) * 1400, 480 + Math.sin(a1) * 1400);
            c.closePath();
            c.fill();
        }
        T(ad.name, 960, 222, 96, { align: 'center', family: IMPACT, color: k.head, stroke: { color: k.outline ?? '#000000', width: 6 }, maxW: 1240 });
        c.save();
        c.translate(960, 322);
        c.rotate(-4 * DEG);
        c.fillStyle = '#000000';
        c.fillRect(-648, -42, 1296, 84);
        c.restore();
        T(ad.banner, 960, 340, 52, { align: 'center', family: IMPACT, color: k.banner ?? '#ffe14d', rotate: -4 * DEG, maxW: 1200 });
        // Simpler since AJ's note (2026-11-11: "some of the ads are still
        // pretty busy"): no starburst or fine print, a big picture
        ad.rows.forEach(([item, price], i) => {
            const y = 466 + i * 112;
            const opts = { family: IMPACT, color: '#ffffff', stroke: { color: '#000000', width: 4 } };
            T(item, 340, y, 52, { ...opts, maxW: 560 });
            T(price, 340, y + 50, 44, { ...opts, color: k.banner ?? '#ffe14d', maxW: 560 });
        });
        picture(c, ad, { x: 940, y: 380, w: 660, h: 360 }, tools);
        c.fillStyle = '#000000';
        c.fillRect(PIC.x, 768, PIC.w, PIC.h + PIC.y - 768);
        T(ad.call, 960, 856, 72, { align: 'center', family: IMPACT, color: '#ffe14d', maxW: 1240 });
    },

    /** A clip-out newspaper coupon on a tablecloth. */
    coupon(c, ad, tools) {
        const { T } = tools;
        const k = ad.colors;
        c.fillStyle = k.p2;
        c.fillRect(PIC.x, PIC.y, PIC.w, PIC.h);
        if (ad.pattern === 'plaid') {
            c.fillStyle = k.p1;
            c.fillRect(PIC.x, PIC.y, PIC.w, PIC.h);
            c.fillStyle = 'hsla(0, 0%, 0%, 0.45)';
            for (let x = PIC.x; x < PIC.x + PIC.w; x += 120) c.fillRect(x, PIC.y, 48, PIC.h);
            for (let y = PIC.y; y < PIC.y + PIC.h; y += 120) c.fillRect(PIC.x, y, PIC.w, 48);
            c.fillStyle = 'hsla(50, 80%, 70%, 0.35)';
            for (let x = PIC.x + 84; x < PIC.x + PIC.w; x += 120) c.fillRect(x, PIC.y, 6, PIC.h);
            for (let y = PIC.y + 84; y < PIC.y + PIC.h; y += 120) c.fillRect(PIC.x, y, PIC.w, 6);
        } else {
            c.fillStyle = k.p1;
            for (let y = PIC.y; y < PIC.y + PIC.h; y += 80) {
                for (let x = PIC.x + (((y - PIC.y) / 80) % 2) * 80; x < PIC.x + PIC.w; x += 160) c.fillRect(x, y, 80, 80);
            }
        }
        c.fillStyle = 'hsla(0, 0%, 0%, 0.35)';
        c.fillRect(384, 172, 1176, 720);
        c.fillStyle = k.coupon;
        c.fillRect(372, 160, 1176, 720);
        c.save();
        c.setLineDash([26, 14]);
        c.lineWidth = 6;
        c.strokeStyle = '#222222';
        c.strokeRect(372, 160, 1176, 720);
        c.restore();
        scissors(c, 372, 300);
        T(ad.name, 900, 250, 64, { align: 'center', bold: true, family: ARIAL, color: k.name, maxW: 820 });
        T(ad.sub, 900, 302, 36, { align: 'center', italic: true, family: SERIF, maxW: 860 });
        c.fillStyle = '#222222';
        c.fillRect(440, 326, 880, 3);
        picture(c, ad, { x: 400, y: 340, w: 420, h: 330 }, tools);
        T(ad.deal, 1060, 500, 130, { align: 'center', family: IMPACT, color: k.name, maxW: 600 });
        const two = ad.detail.length > 1;
        ad.detail.forEach((line, i) => T(line, 1060, 566 + i * 42, two ? 36 : 40, { align: 'center', bold: true, family: ARIAL, maxW: 640 }));
        if (ad.conditions) T(ad.conditions, 960, 676, 36, { align: 'center', italic: true, family: SERIF, maxW: 1100 });
        stamp(c, T, 1430, 250, ad.stamp, k.stamp ?? '#c62828');
        T(ad.call, 960, 772, 44, { align: 'center', bold: true, family: ARIAL, maxW: 1100 });
        T(ad.fine, 960, 830, 32, { align: 'center', italic: true, family: SERIF, maxW: 1100 });
    },

    /** A menu board, wood or chalk, with dot leaders and a starburst deal. */
    menu(c, ad, tools) {
        const { T } = tools;
        const k = ad.colors;
        if (ad.board === 'chalk') {
            c.fillStyle = '#6b4325';
            c.fillRect(PIC.x, PIC.y, PIC.w, PIC.h);
            c.fillStyle = '#1f3b2c';
            c.fillRect(PIC.x + 24, PIC.y + 70, PIC.w - 48, PIC.h - 94);
            c.fillStyle = 'hsla(0, 0%, 100%, 0.05)';
            for (let i = 0; i < 9; i++) c.fillRect(PIC.x + 60 + i * 150, PIC.y + 120 + (i % 3) * 200, 120, 40);
        } else {
            for (let y = PIC.y, i = 0; y < PIC.y + PIC.h; y += 52, i++) {
                c.fillStyle = i % 2 ? '#5a371d' : '#6b4325';
                c.fillRect(PIC.x, y, PIC.w, 52);
            }
            c.fillStyle = 'hsla(0, 0%, 0%, 0.25)';
            for (let y = PIC.y + 51; y < PIC.y + PIC.h; y += 52) c.fillRect(PIC.x, y, PIC.w, 2);
        }
        T(ad.name, 960, 232, 76, { align: 'center', bold: true, family: ARIAL, color: k.head, maxW: 1240 });
        c.fillStyle = k.ink;
        c.fillRect(SAFE.left + 40, 258, SAFE.right - SAFE.left - 80, 3);
        c.font = `italic 40px ${SERIF}`;
        T(ad.tagline, 960, 314, 40, { align: 'center', italic: true, family: SERIF, color: k.ink, maxW: 1200 });
        // Simpler since AJ's note (2026-11-11): no starburst, a big picture
        picture(c, ad, { x: 330, y: 350, w: 400, h: 420 }, tools);
        const lx = 780;
        const rx = SAFE.right - 28;
        let ry = 560 - ((ad.items.length - 1) * 70) / 2;
        for (const [item, price] of ad.items) {
            c.font = `bold 44px ${ARIAL}`;
            const pw = c.measureText(price).width;
            T(price, rx, ry, 44, { align: 'right', bold: true, family: ARIAL, color: k.ink });
            const room = rx - pw - 24 - lx;
            T(item, lx, ry, 44, { family: ARIAL, color: k.ink, maxW: room });
            c.font = `44px ${ARIAL}`;
            const iw = Math.min(room, c.measureText(item).width);
            c.fillStyle = k.ink;
            for (let dx = lx + iw + 14; dx < rx - pw - 12; dx += 14) c.fillRect(dx, ry - 6, 4, 4);
            ry += 70;
        }
        T(ad.call, 960, 850, 48, { align: 'center', bold: true, family: ARIAL, color: k.head, maxW: 1240 });
    },

    /** A perfume spot: black and plum, gold frames, spotlight, whispered type. */
    luxe(c, ad, tools) {
        const { T } = tools;
        c.fillStyle = vGradient(c, PIC.y, PIC.y + PIC.h, '#000000', '#2a0f3a');
        c.fillRect(PIC.x, PIC.y, PIC.w, PIC.h);
        const spot = c.createRadialGradient(960, 370, 20, 960, 370, 420);
        spot.addColorStop(0, 'hsla(280, 60%, 80%, 0.35)');
        spot.addColorStop(1, 'hsla(280, 60%, 80%, 0)');
        c.fillStyle = spot;
        c.fillRect(PIC.x, PIC.y, PIC.w, PIC.h);
        c.strokeStyle = '#c9a24a';
        c.lineWidth = 3;
        c.strokeRect(300, 150, 1320, 740);
        c.lineWidth = 1.5;
        c.strokeRect(312, 162, 1296, 716);
        picture(c, ad, { x: 660, y: 176, w: 600, h: 380 }, tools);
        T(ad.name, 960, 620, 104, { align: 'center', italic: true, family: SERIF, color: '#c9a24a', spacing: 8, maxW: 1100 });
        T(ad.line, 960, 690, 40, { align: 'center', italic: true, family: SERIF, color: '#f3e9d2', maxW: 1160 });
        T(ad.price, 960, 760, 48, { align: 'center', family: SERIF, color: '#f3e9d2', maxW: 1000 });
        T(ad.call, 960, 820, 36, { align: 'center', bold: true, family: SERIF, color: '#c9a24a', spacing: 4, maxW: 1160 });
        T(ad.fine, 960, 870, 32, { align: 'center', italic: true, family: SERIF, color: '#a89bb0', maxW: 1160 });
    },

    /** A spokesperson in an oval portrait, with a checklist and a hard sell. */
    spokes(c, ad, tools) {
        const { T } = tools;
        const k = ad.colors;
        c.fillStyle = vGradient(c, PIC.y, PIC.y + PIC.h, k.a, k.b);
        c.fillRect(PIC.x, PIC.y, PIC.w, PIC.h);
        picture(c, ad, { x: 320, y: 170, w: 420, h: 420 }, tools);
        T(ad.plate, 530, 640, 44, { align: 'center', bold: true, family: ARIAL, color: '#ffffff', maxW: 420 });
        T(ad.question, 780, 220, 48, { family: BLACK, color: '#ffffff', maxW: 800 });
        ad.checklist.forEach(([text, ticked], i) => {
            const y = 300 + i * 70;
            c.fillStyle = '#ffffff';
            c.fillRect(780, y - 32, 36, 36);
            c.lineWidth = 3;
            c.strokeStyle = '#111111';
            c.strokeRect(780, y - 32, 36, 36);
            if (ticked) {
                c.beginPath();
                c.moveTo(786, y - 14);
                c.lineTo(796, y - 2);
                c.lineTo(818, y - 36);
                c.lineWidth = 7;
                c.strokeStyle = '#d32020';
                c.stroke();
            }
            T(text, 836, y, 44, { family: ARIAL, color: '#ffffff', maxW: 760 });
        });
        ad.fee.forEach((line, i) => T(line, 780, 590 + i * 48, 40, { bold: true, family: ARIAL, color: '#ffd23f', maxW: 820 }));
        c.fillStyle = '#ffd23f';
        c.fillRect(PIC.x, 700, PIC.w, 90);
        T(ad.call, 960, 768, 60, { align: 'center', family: BLACK, color: '#111111', maxW: 1240 });
        T(ad.fine, 960, 860, 32, { align: 'center', italic: true, family: SERIF, color: '#ffffff', maxW: 1240 });
    },

    /** A community-access bulletin board slide: blue field, white frame, plain type. */
    bulletin(c, ad, tools) {
        const { T } = tools;
        c.fillStyle = ad.colors?.a ?? '#1a3fb0';
        c.fillRect(PIC.x, PIC.y, PIC.w, PIC.h);
        c.strokeStyle = '#ffffff';
        c.lineWidth = 4;
        c.strokeRect(270, 150, 1380, 750);
        c.fillStyle = '#ffffff';
        c.fillRect(280, 160, 1360, 80);
        T(ad.title, 960, 220, 52, { align: 'center', family: BLACK, color: ad.colors?.a ?? '#1a3fb0', maxW: 1240 });
        T(ad.tag, 1600, 290, 32, { align: 'right', family: ARIAL, color: '#ffffff', maxW: 400 });
        T(ad.heading, 340, 346, 56, { bold: true, family: ARIAL, color: '#ffe14d', maxW: 1000 });
        ad.rows.forEach(([item, price], i) => {
            const y = 430 + i * 70;
            c.fillStyle = '#ffffff';
            c.fillRect(342, y - 22, 12, 12);
            c.font = `44px ${ARIAL}`;
            T(price, 1180, y, 44, { align: 'right', family: ARIAL, color: '#ffffff', maxW: 200 });
            T(item, 372, y, 44, { family: ARIAL, color: '#ffffff', maxW: 640 });
        });
        T(ad.call, 340, 680, 44, { bold: true, family: ARIAL, color: '#ffffff', maxW: 860 });
        T(ad.fine, 340, 740, 36, { family: ARIAL, color: '#ffe14d', maxW: 860 });
        picture(c, ad, { x: 1230, y: 380, w: 380, h: 480 }, tools);
    },

    /** A help-wanted classified boxed on a newspaper page. */
    classified(c, ad, tools) {
        const { T, wrap } = tools;
        c.fillStyle = '#e9e4d6';
        c.fillRect(PIC.x, PIC.y, PIC.w, PIC.h);
        // Fake columns of other ads either side (deterministic)
        c.fillStyle = 'hsla(0, 0%, 0%, 0.18)';
        for (const x0 of [260, 1520]) {
            for (let y = 170, i = 0; y < 880; y += 22, i++) {
                const w = 140 - ((i * 37) % 60);
                if (i % 7 !== 6) c.fillRect(x0, y, w, 8);
            }
        }
        c.fillStyle = 'hsla(0, 0%, 0%, 0.25)';
        c.fillRect(PIC.x, PIC.y, PIC.w, 4);
        c.fillStyle = '#f7f4ea';
        c.fillRect(440, 160, 1040, 730);
        c.lineWidth = 3;
        c.strokeStyle = '#111111';
        c.strokeRect(440, 160, 1040, 730);
        c.fillStyle = '#111111';
        c.fillRect(440, 160, 1040, 80);
        T(ad.bar, 960, 222, 56, { align: 'center', family: BLACK, color: '#f7f4ea', maxW: 960 });
        T(ad.name, 960, 310, 52, { align: 'center', bold: true, family: SERIF, maxW: 960 });
        c.fillRect(480, 330, 960, 2);
        c.font = `bold 38px ${COURIER}`;
        wrap(ad.body, 960).slice(0, 4).forEach((line, i) => T(line, 480, 390 + i * 48, 38, { bold: true, family: COURIER, maxW: 960 }));
        T(ad.wage, 960, 620, 48, { align: 'center', bold: true, family: SERIF, maxW: 960 });
        ad.contact.forEach((line, i) => T(line, 480, 694 + i * 46, 36, { bold: true, family: COURIER, maxW: 700 }));
        T(ad.fine, 480, 830, 32, { italic: true, family: SERIF, maxW: 700 });
        picture(c, ad, { x: 1210, y: 640, w: 250, h: 236 }, tools);
    },

    /** A late-night infomercial: chrome type, red swoosh, BUT WAIT box, hazard band. */
    infomercial(c, ad, tools) {
        const { T } = tools;
        c.fillStyle = vGradient(c, PIC.y, PIC.y + PIC.h, '#000000', '#0a1a5c');
        c.fillRect(PIC.x, PIC.y, PIC.w, PIC.h);
        const chrome = c.createLinearGradient(0, -70, 0, 10);
        chrome.addColorStop(0, '#ffffff');
        chrome.addColorStop(0.5, '#9aa3ad');
        chrome.addColorStop(0.55, '#5b636c');
        chrome.addColorStop(1, '#e8edf2');
        T(ad.name, 340, 230, 88, { italic: true, family: BLACK, color: chrome, stroke: { color: '#000000', width: 4 }, maxW: 1240 });
        c.beginPath();
        c.moveTo(340, 256);
        c.quadraticCurveTo(720, 290, 1100, 250);
        c.lineWidth = 10;
        c.strokeStyle = '#e8201a';
        c.stroke();
        T(ad.sub, 340, 320, 40, { family: ARIAL, color: '#ffffff', maxW: 1240 });
        picture(c, ad, { x: 320, y: 360, w: 520, h: 360 }, tools);
        T(ad.lead, 880, 420, 40, { family: ARIAL, color: '#ffffff', maxW: 700 });
        T(ad.price, 880, 545, 140, { family: IMPACT, color: '#ffe14d', maxW: 700 });
        c.save();
        c.translate(1235, 640);
        c.rotate(-4 * DEG);
        c.fillStyle = '#e8201a';
        c.fillRect(-355, -65, 710, 130);
        c.restore();
        T(ad.wait[0], 1235, 632, 52, { align: 'center', family: IMPACT, color: '#ffffff', rotate: -4 * DEG, maxW: 660 });
        T(ad.wait[1], 1235, 680, 34, { align: 'center', bold: true, family: ARIAL, color: '#ffffff', rotate: -4 * DEG, maxW: 680 });
        c.fillStyle = '#ffd23f';
        c.fillRect(PIC.x, 730, PIC.w, 90);
        c.fillStyle = '#111111';
        for (let x = PIC.x - 40; x < PIC.x + PIC.w; x += 60) {
            c.beginPath();
            c.moveTo(x, 730);
            c.lineTo(x + 24, 730);
            c.lineTo(x + 4, 744);
            c.lineTo(x - 20, 744);
            c.closePath();
            c.fill();
        }
        T(ad.call, 960, 806, 60, { align: 'center', family: BLACK, color: '#111111', maxW: 1240 });
    }
};

function scissors(c, x, y) {
    c.save();
    c.translate(x, y);
    c.lineWidth = 4;
    c.strokeStyle = '#222222';
    c.fillStyle = '#f2f2f2';
    for (const s of [-1, 1]) {
        c.beginPath();
        c.arc(-26, s * 14, 11, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.beginPath();
        c.moveTo(-16, s * 10);
        c.lineTo(30, -s * 10);
        c.stroke();
    }
    c.restore();
}

function stamp(c, T, x, y, text, color) {
    c.save();
    c.translate(x, y);
    c.rotate(-12 * DEG);
    c.beginPath();
    c.arc(0, 0, 80, 0, Math.PI * 2);
    c.lineWidth = 6;
    c.strokeStyle = color;
    c.stroke();
    c.beginPath();
    c.arc(0, 0, 68, 0, Math.PI * 2);
    c.lineWidth = 2;
    c.stroke();
    c.restore();
    T(text, x, y + 13, 36, { align: 'center', family: IMPACT, color, rotate: -12 * DEG, maxW: 124 });
}
