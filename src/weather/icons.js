// Weather icons for the 90s weather page: chunky shapes with a dark outline,
// drawn once per kind and size into their own offscreen canvas. Each one
// keeps inside its 100x100 grid with a few px for the outline: a cloud of
// width w at (cx, cy) spans x cx-0.62w..cx+0.6w and y cy-0.5w..cy+0.42w.

const OUTLINE = '#0b1240';
const cache = new Map();

/**
 * An icon as an offscreen canvas, drawn on first use and kept.
 * @param {string} kind - sun, mostlysun, partly, mostlycloudy, cloudy, rain,
 *   showers, storm, snow, flurries, mix, fog, moon, partlymoon, or
 *   moon-new, moon-first, moon-full, moon-last
 * @param {number} size - Square side in px
 * @returns {HTMLCanvasElement}
 */
export function weatherIcon(kind, size) {
    const key = `${kind}@${size}`;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.scale(size / 100, size / 100);    // draw on a 100x100 grid
    DRAW[kind]?.(ctx);
    cache.set(key, c);
    return c;
}

function sun(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
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

const DRAW = {
    sun: (c) => sun(c, 50, 50, 26),
    mostlysun: (c) => { sun(c, 40, 40, 24); cloud(c, 62, 66, 42); },
    partly: (c) => { sun(c, 36, 36, 22); cloud(c, 58, 60, 62); },
    mostlycloudy: (c) => { sun(c, 30, 30, 18); cloud(c, 52, 58, 74); },
    cloudy: (c) => { cloud(c, 38, 40, 58, true); cloud(c, 54, 60, 70); },
    rain: (c) => { drops(c, [34, 52, 70], 66, 26); cloud(c, 50, 38, 72, true); },
    showers: (c) => { sun(c, 28, 26, 18); drops(c, [48, 70], 64, 24); cloud(c, 58, 42, 62); },
    storm: (c) => { drops(c, [30, 72], 66, 24); bolt(c, 46, 63, 1.0); cloud(c, 50, 38, 72, true); },
    snow: (c) => { flakes(c, [[30, 80], [52, 88], [74, 80]], 8); cloud(c, 50, 38, 72, true); },
    flurries: (c) => { sun(c, 28, 26, 18); flakes(c, [[48, 84], [72, 82]], 8); cloud(c, 58, 42, 62); },
    mix: (c) => { drops(c, [32, 70], 66, 24); flakes(c, [[51, 84]], 8); cloud(c, 50, 38, 72, true); },
    fog: (c) => {
        cloud(c, 50, 38, 70, true);
        for (const [y, x0, x1] of [[66, 12, 76], [78, 24, 88], [90, 14, 70]]) {
            for (const [w, col] of [[9, OUTLINE], [5, '#d5dbe8']]) {
                c.beginPath();
                c.moveTo(x0, y);
                c.lineTo(x1, y);
                c.strokeStyle = col;
                c.lineWidth = w;
                c.stroke();
            }
        }
    },
    moon: (c) => moon(c, 50, 50, 30),
    partlymoon: (c) => { moon(c, 38, 36, 24); cloud(c, 58, 62, 60); },
    'moon-new': (c) => phase(c, null),
    'moon-first': (c) => phase(c, 'right'),
    'moon-full': (c) => phase(c, 'full'),
    'moon-last': (c) => phase(c, 'left')
};
