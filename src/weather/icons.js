// Weather icons for the 90s weather page: chunky shapes with a dark outline,
// drawn once per kind and size into their own offscreen canvas. Each one
// keeps inside its 100x100 grid with a few px for the outline: a cloud of
// width w at (cx, cy) spans x cx-0.62w..cx+0.6w and y cy-0.5w..cy+0.42w.
//
// Two frames per icon (AJ, 2026-11-11: "the icons need two frames of
// animation"), flipped by the page like the old character generators: rays
// turn half a step, clouds drift, rain and snow fall, the bolt strikes on one
// frame only, fog slides, stars twinkle. Frame 1 moves at most 8 grid units,
// so an icon never leaves its 100x100 box.

const OUTLINE = '#0b1240';
const cache = new Map();

/**
 * An icon frame as an offscreen canvas, drawn on first use and kept.
 * @param {string} kind - sun, mostlysun, partly, mostlycloudy, cloudy, rain,
 *   showers, storm, snow, flurries, mix, fog, moon, partlymoon, or
 *   moon-new, moon-first, moon-full, moon-last, sunrise, sunset
 * @param {number} size - Square side in px
 * @param {number} [frame=0] - 0 or 1
 * @returns {HTMLCanvasElement}
 */
export function weatherIcon(kind, size, frame = 0) {
    const key = `${kind}@${size}#${frame}`;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.scale(size / 100, size / 100);    // draw on a 100x100 grid
    DRAW[kind]?.(ctx, frame ? 1 : 0);
    cache.set(key, c);
    return c;
}

function sun(ctx, cx, cy, r, f = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
        const a = ((i + f / 2) / 12) * Math.PI * 2;      // frame 1: rays half a step on
        ctx.moveTo(Math.cos(a - 0.17) * r * 1.05, Math.sin(a - 0.17) * r * 1.05);
        ctx.lineTo(Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.55);
        ctx.lineTo(Math.cos(a + 0.17) * r * 1.05, Math.sin(a + 0.17) * r * 1.05);
    }
    ctx.fillStyle = '#ff9a1f';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fill();
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fffbc2');
    g.addColorStop(0.55, '#ffd51f');
    g.addColorStop(1, '#ff9a1f');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function moon(ctx, cx, cy, r) {
    // A crescent: the disc less an offset disc, on a scratch canvas so the
    // cut doesn't eat what's already drawn
    const k = ctx.getTransform().a;
    const s = document.createElement('canvas');
    s.width = s.height = Math.ceil(100 * k);
    const m = s.getContext('2d');
    m.scale(k, k);
    m.beginPath();
    m.arc(cx, cy, r + 3, 0, Math.PI * 2);
    m.fillStyle = OUTLINE;
    m.fill();
    m.beginPath();
    m.arc(cx, cy, r, 0, Math.PI * 2);
    const g = m.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, '#fffbd6');
    g.addColorStop(1, '#f2d66b');
    m.fillStyle = g;
    m.fill();
    m.globalCompositeOperation = 'destination-out';
    m.beginPath();
    m.arc(cx + r * 0.55, cy - r * 0.3, r * 0.85, 0, Math.PI * 2);
    m.fill();
    m.globalCompositeOperation = 'source-over';
    // Outline the inner edge of the bite
    m.save();
    m.beginPath();
    m.arc(cx, cy, r, 0, Math.PI * 2);
    m.clip();
    m.beginPath();
    m.arc(cx + r * 0.55, cy - r * 0.3, r * 0.85 + 1.5, 0, Math.PI * 2);
    m.strokeStyle = OUTLINE;
    m.lineWidth = 3;
    m.stroke();
    m.restore();
    ctx.drawImage(s, 0, 0, 100, 100);
}

const PUFFS = [[-0.32, 0.12, 0.3], [-0.05, -0.12, 0.38], [0.3, 0.05, 0.3], [0.05, 0.18, 0.3]];

function cloud(ctx, cx, cy, w, dark = false) {
    const path = () => {
        ctx.beginPath();
        for (const [x, y, r] of PUFFS) {
            ctx.moveTo(cx + x * w + r * w, cy + y * w);
            ctx.arc(cx + x * w, cy + y * w, r * w, 0, Math.PI * 2);
        }
        ctx.rect(cx - 0.32 * w, cy + 0.1 * w, 0.62 * w, 0.32 * w);
    };
    path();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 6;
    ctx.stroke();
    const g = ctx.createLinearGradient(0, cy - 0.5 * w, 0, cy + 0.45 * w);
    g.addColorStop(0, dark ? '#c3c9d6' : '#ffffff');
    g.addColorStop(1, dark ? '#69728a' : '#b5c1d8');
    path();
    ctx.fillStyle = g;
    ctx.fill();
}

function drops(ctx, xs, y0, len) {
    for (const x of xs) {
        for (const [w, col] of [[8, OUTLINE], [4, '#5cc2ff']]) {
            ctx.beginPath();
            ctx.moveTo(x, y0);
            ctx.lineTo(x - len * 0.35, y0 + len);
            ctx.strokeStyle = col;
            ctx.lineWidth = w;
            ctx.stroke();
        }
    }
}

function flakes(ctx, pts, r) {
    for (const [x, y] of pts) {
        for (const [w, col] of [[7, OUTLINE], [3, '#ffffff']]) {
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI;
                ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
                ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
            }
            ctx.strokeStyle = col;
            ctx.lineWidth = w;
            ctx.stroke();
        }
    }
}

function bolt(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x + 4 * s, y);
    ctx.lineTo(x - 6 * s, y + 18 * s);
    ctx.lineTo(x + 1 * s, y + 18 * s);
    ctx.lineTo(x - 5 * s, y + 34 * s);
    ctx.lineTo(x + 11 * s, y + 12 * s);
    ctx.lineTo(x + 3 * s, y + 12 * s);
    ctx.lineTo(x + 10 * s, y);
    ctx.closePath();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.fillStyle = '#ffe23a';
    ctx.stroke();
    ctx.fill();
}

/** Two tiny stars that swap places between frames. */
function stars(ctx, pts, f) {
    const [x, y] = pts[f];
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
        ctx.lineTo(x + Math.cos(a + Math.PI / 4) * 2.5, y + Math.sin(a + Math.PI / 4) * 2.5);
    }
    ctx.closePath();
    ctx.fillStyle = '#fffbd6';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fill();
}

function phase(ctx, lit) {
    // Almanac moons: dark disc, lit half or whole
    const cx = 50, cy = 50, r = 38;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#26305e';
    ctx.fill();
    if (lit) {
        ctx.beginPath();
        if (lit === 'full') ctx.arc(cx, cy, r, 0, Math.PI * 2);
        else ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, lit === 'left');
        ctx.closePath();
        const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        g.addColorStop(0, '#fffbd6');
        g.addColorStop(1, '#e8cf6a');
        ctx.fillStyle = g;
        ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ctx.stroke();
}

// f is the frame, 0 or 1. Moving parts shift by d = f * a few grid units
const DRAW = {
    sun: (c, f) => sun(c, 50, 50, 26, f),
    mostlysun: (c, f) => { sun(c, 40, 40, 24, f); cloud(c, 62 + 3 * f, 66, 42); },
    partly: (c, f) => { sun(c, 36, 36, 22, f); cloud(c, 58 - 2 * f, 60, 62); },
    mostlycloudy: (c, f) => { sun(c, 30, 30, 18, f); cloud(c, 52 - 2 * f, 58, 74); },
    cloudy: (c, f) => { cloud(c, 38 + 2 * f, 40, 58, true); cloud(c, 54 - 2 * f, 60, 70); },
    rain: (c, f) => { drops(c, [34, 52, 70].map((x) => x - 2 * f), 66 + 4 * f, 26); cloud(c, 50, 38, 72, true); },
    showers: (c, f) => { sun(c, 28, 26, 18, f); drops(c, [48, 70].map((x) => x - 2 * f), 64 + 4 * f, 24); cloud(c, 58, 42, 62); },
    storm: (c, f) => {
        drops(c, [30, 72].map((x) => x - 2 * f), 66 + 4 * f, 24);
        if (!f) bolt(c, 46, 63, 1.0);           // the strike shows on frame 0 only
        cloud(c, 50, 38, 72, true);
    },
    snow: (c, f) => { flakes(c, [[30, 80], [52, 88], [74, 80]].map(([x, y]) => [x + 3 * f, y - 6 + 6 * f]), 8); cloud(c, 50, 38, 72, true); },
    flurries: (c, f) => { sun(c, 28, 26, 18, f); flakes(c, [[48, 84], [72, 82]].map(([x, y]) => [x - 3 * f, y - 6 + 6 * f]), 8); cloud(c, 58, 42, 62); },
    mix: (c, f) => { drops(c, [32, 70].map((x) => x - 2 * f), 66 + 4 * f, 24); flakes(c, [[51, 78 + 6 * f]], 8); cloud(c, 50, 38, 72, true); },
    fog: (c, f) => {
        cloud(c, 50, 38, 70, true);
        for (const [y, x0, x1, dir] of [[66, 12, 76, 1], [78, 24, 88, -1], [90, 14, 70, 1]]) {
            for (const [w, col] of [[9, OUTLINE], [5, '#d5dbe8']]) {
                c.beginPath();
                c.moveTo(x0 + 6 * f * dir, y);
                c.lineTo(x1 + 6 * f * dir, y);
                c.strokeStyle = col;
                c.lineWidth = w;
                c.stroke();
            }
        }
    },
    moon: (c, f) => { moon(c, 50, 50, 30); stars(c, [[84, 22], [20, 80]], f); },
    partlymoon: (c, f) => { moon(c, 38, 36, 24); stars(c, [[82, 18], [14, 70]], f); cloud(c, 58 - 2 * f, 62, 60); },
    'moon-new': (c) => phase(c, null),
    'moon-first': (c) => phase(c, 'right'),
    'moon-full': (c) => phase(c, 'full'),
    'moon-last': (c) => phase(c, 'left'),
    // Sunrise and sunset (AJ, 2026-11-11: "The sunrise and sunset need icons
    // as well"): half a sun on the horizon with an arrow; frame 1 turns the
    // rays and nudges the arrow the way the sun is going
    sunrise: (c, f) => horizonSun(c, f, -1),
    sunset: (c, f) => horizonSun(c, f, 1)
};

/** Half a sun on the horizon, an arrow under it: dir -1 up, 1 down. */
function horizonSun(ctx, f, dir) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 100, 60);
    ctx.clip();
    sun(ctx, 50, 60, 24, f);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(6, 60);
    ctx.lineTo(94, 60);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = '#ff9a1f';
    ctx.lineWidth = 3;
    ctx.stroke();
    // The arrow, outline first
    const y = 80 + dir * 2 * f;
    const tip = y + dir * 12;
    for (const [w, col] of [[9, OUTLINE], [4, '#ffffff']]) {
        ctx.beginPath();
        ctx.moveTo(50, y - dir * 10);
        ctx.lineTo(50, tip);
        ctx.moveTo(40, tip - dir * 9);
        ctx.lineTo(50, tip);
        ctx.lineTo(60, tip - dir * 9);
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.stroke();
    }
}
