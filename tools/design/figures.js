#!/usr/bin/env node
/**
 * Renders the do/don't figures in docs/design/ for the stream bible
 * (docs/DESIGN.md). Made so every figure can be rebuilt after a token
 * changes instead of being redrawn by hand (design system role, 2026-10-28).
 *
 * Usage:
 *   npm run motion -- stinger sidebar epcot --seeds=1 --out=bible   # harness frames first
 *   npm run design:figures -- --bg=frame.png --live=starting.png
 *
 * Options:
 *   --bg=path     The backdrop: an epcot frame (default: the harness epcot render)
 *   --live=path   A live OBS program capture for the layout audit figure (skipped if absent)
 *   --run=bible   Harness run to take scene frames from (tools/motion-results-<run>/)
 *   --only=a,b    Only these figures
 *
 * Needs ffmpeg with libx264 on PATH (the compression figures encode like OBS
 * does) and network access for the Jost web font.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { launchBrowser, projectRoot } from '../lib/browser.js';
import { config } from '../../src/config/config.js';
import { safeRect, scaleHex } from '../../src/shared/design.js';
import { miuItemRect } from '../../src/shared/layout.js';

const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const i = a.indexOf('=');
    return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));
const run = flags.run || 'bible';
const runDir = resolve(projectRoot, 'tools', `motion-results-${run}`);
const outDir = resolve(projectRoot, 'docs', 'design');
const only = flags.only ? String(flags.only).split(',') : null;
const bgPath = flags.bg ? resolve(flags.bg) : join(runDir, 'epcot', 'seed-1', 't01500.png');
const tmp = mkdtempSync(join(tmpdir(), 'design-figures-'));
mkdirSync(outDir, { recursive: true });

const D = config.design;
const stops = config.epcot.palettes.illuminations;
const dataUrl = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const FONT = "@import url('https://fonts.googleapis.com/css2?family=Jost:wght@400;700&display=block');";
const T = D.type;

// The bible's text recipe as CSS: ink stroke (paint-order keeps the glyph
// whole) and a soft shadow falling down-right
const textCss = (px) => `font: ${T.weight} ${px}px ${T.family}, sans-serif; text-transform: uppercase;
    letter-spacing: ${T.trackingEm}em; color: ${D.color.white};
    -webkit-text-stroke: ${Math.max(T.strokeMinPx, px * T.strokeEm) * 2}px ${D.color.ink}; paint-order: stroke fill;
    text-shadow: ${px * T.shadowOffsetEm}px ${px * T.shadowOffsetEm}px ${px * T.shadowBlurEm}px rgba(0,0,0,${T.shadowAlpha});`;

let browser;
async function shoot(html, width, height, file, { jpeg = true } = {}) {
    const page = await browser.newPage();
    page.on('pageerror', err => console.error('figure page error:', err.message));
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><head><style>${FONT}
        * { margin: 0; box-sizing: border-box; }
        body { width: ${width}px; height: ${height}px; overflow: hidden; background: #0d0e11;
               font-family: Jost, sans-serif; color: #e8e8ee; }
        .cap { font: 700 22px Jost, sans-serif; letter-spacing: .04em; text-transform: uppercase; }
        .do { color: #45d483; } .dont { color: #ff5f5f; }
        </style></head><body>${html}</body></html>`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    if (await page.$('script[data-run]')) await page.waitForFunction('window.__done === true');
    const path = file.startsWith('/') ? file : join(outDir, file);
    await page.screenshot({ path, type: jpeg ? 'jpeg' : 'png', quality: jpeg ? 86 : undefined });
    await page.close();
    console.log('wrote', path);
    return path;
}

const want = (name) => !only || only.includes(name);

// Encode a PNG the way a 720p Twitch stream does (scale, 4:2:0, x264 at a
// stream-like quality), and return the decoded frame back at 1080p
function encode720(src, name, crf = 30) {
    const mp4 = join(tmp, `${name}.mp4`), out = join(tmp, `${name}-dec.png`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', src, '-t', '1', '-r', '30',
        '-vf', 'scale=1280:720:flags=bicubic,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast',
        '-tune', 'film', '-crf', String(crf), mp4]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.9', '-i', mp4, '-frames:v', '1',
        '-vf', 'scale=1920:1080:flags=neighbor', out]);
    return out;
}

function overlaySvg(width, height, { labels = true } = {}) {
    const s = width / D.canvas.width;
    const a = safeRect('action', D, width, height), t = safeRect('title', D, width, height);
    const g = D.grid, colW = (D.canvas.width - 2 * g.marginPx - (g.columns - 1) * g.gutterPx) / g.columns;
    const cols = Array.from({ length: g.columns }, (_, i) =>
        `<rect x="${(g.marginPx + i * (colW + g.gutterPx)) * s}" y="${t.y}" width="${colW * s}" height="${t.height}" fill="rgba(255,255,255,.05)"/>`).join('');
    // The union of every padded Mix It Up item: the right-side keep-out band
    const miu = config.sidebar.miuZones.items.map(it => miuItemRect(it, width, height, config.sidebar.miuZones.pad));
    const mx = Math.min(...miu.map(r => r.x)), my = Math.min(...miu.map(r => r.y));
    const mw = Math.max(...miu.map(r => r.x + r.width)) - mx, mh = Math.max(...miu.map(r => r.y + r.height)) - my;
    const py = D.playerChromeTop * height;
    const lab = (x, y, txt, fill) => labels ? `<text x="${x}" y="${y}" fill="${fill}" font-family="Jost" font-weight="700" font-size="${Math.round(22 * s * 1.4)}" letter-spacing="1">${txt}</text>` : '';
    return `<svg width="${width}" height="${height}" style="position:absolute;left:0;top:0">
      <defs><pattern id="h" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-15)">
        <rect width="14" height="14" fill="rgba(255,60,60,.12)"/><line x1="0" y1="0" x2="0" y2="14" stroke="rgba(255,90,90,.55)" stroke-width="3"/></pattern>
      <pattern id="p" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-15)">
        <rect width="14" height="14" fill="rgba(90,170,255,.12)"/><line x1="0" y1="0" x2="0" y2="14" stroke="rgba(120,190,255,.5)" stroke-width="3"/></pattern></defs>
      ${cols}
      <rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="url(#h)" stroke="#ff6b6b" stroke-width="2"/>
      ${lab(mx + 12, my + 34 * s * 1.4, 'MIX IT UP KEEP-OUT', '#ffb3b3')}
      <rect x="0" y="${py}" width="${width}" height="${height - py}" fill="url(#p)"/>
      ${lab(t.x + 8, py + 30 * s * 1.4, 'TWITCH PLAYER CONTROLS (HOVER / TAP)', '#b8dcff')}
      <rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="none" stroke="#ffd166" stroke-width="2" stroke-dasharray="10 8"/>
      ${lab(a.x + 8, a.y - 8, 'ACTION SAFE 3.5%', '#ffd166')}
      <rect x="${t.x}" y="${t.y}" width="${t.width}" height="${t.height}" fill="none" stroke="#45d483" stroke-width="3"/>
      ${lab(t.x + 8, t.y + 30 * s * 1.4, 'TITLE SAFE 5% · 12 COLUMNS', '#45d483')}
    </svg>`;
}

browser = (await launchBrowser({ width: 1920, height: 1080 })).browser;
try {
    const bg = existsSync(bgPath) ? dataUrl(bgPath) : null;
    if (!bg) console.warn(`No backdrop at ${bgPath}: run the harness or pass --bg=`);
    const backdrop = (w, h) => bg ? `<img src="${bg}" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px">` : '';

    // 1. Safe areas, grid and keep-out zones
    if (want('safe-areas')) {
        await shoot(`<div style="position:relative;width:1920px;height:1080px">${backdrop(1920, 1080)}
            <div style="position:absolute;inset:0;background:rgba(0,0,0,.35)"></div>${overlaySvg(1920, 1080)}</div>`,
            1920, 1080, 'safe-areas.jpg');
    }

    // 2. A live program capture with the same overlay
    if (want('live-safe') && flags.live && existsSync(flags.live)) {
        await shoot(`<div style="position:relative;width:1920px;height:1080px">
            <img src="${dataUrl(resolve(flags.live))}" style="position:absolute;width:1920px;height:1080px">
            ${overlaySvg(1920, 1080)}</div>`, 1920, 1080, 'live-safe-audit.jpg');
    }

    // 3. Type scale at 1080p, after a 720p stream and on a phone in portrait
    if (want('type-scale')) {
        const rows = [['hero', T.sizes.hero], ['display', T.sizes.display], ['headline', T.sizes.headline],
            ['label', T.sizes.label], ['today: sidebar 29px', 29]];
        const rowH = 140, colX = [230, 730, 1100], W = 1420;
        await shoot(`<canvas id="c" width="${W}" height="${rows.length * rowH + 70}"></canvas>
          <script data-run>
            (async () => {
              await document.fonts.load('${T.weight} 40px ${T.family}');
              const bg = new Image(); bg.src = ${JSON.stringify(bg || '')};
              await new Promise(r => { if (!bg.src) r(); bg.onload = r; bg.onerror = r; });
              const c = document.getElementById('c'), ctx = c.getContext('2d');
              ctx.fillStyle = '#0d0e11'; ctx.fillRect(0, 0, c.width, c.height);
              ctx.fillStyle = '#e8e8ee'; ctx.font = '700 22px ${T.family}';
              ['1080p CANVAS', '720p STREAM, ACTUAL SIZE', 'PHONE, ACTUAL SIZE x2'].forEach((t, i) => ctx.fillText(t, ${JSON.stringify(colX)}[i], 40));
              const rows = ${JSON.stringify(rows)}, colX = ${JSON.stringify(colX)};
              for (let i = 0; i < rows.length; i++) {
                const [name, px] = rows[i];
                // The scene's text recipe drawn at 1080p over the backdrop
                const tile = document.createElement('canvas'); tile.width = 480; tile.height = ${rowH};
                const tc = tile.getContext('2d');
                if (bg.src) tc.drawImage(bg, 600 + i * 40, 420 + i * 30, 320, 93, 0, 0, 480, ${rowH});
                tc.font = '${T.weight} ' + px + 'px ${T.family}';
                tc.textBaseline = 'middle'; tc.lineJoin = 'round';
                if ('letterSpacing' in tc) tc.letterSpacing = (px * ${T.trackingEm}) + 'px';
                tc.shadowColor = 'rgba(0,0,0,${T.shadowAlpha})'; tc.shadowBlur = px * ${T.shadowBlurEm};
                tc.shadowOffsetX = tc.shadowOffsetY = px * ${T.shadowOffsetEm};
                tc.lineWidth = Math.max(${T.strokeMinPx}, px * ${T.strokeEm}) * 2; tc.strokeStyle = '${D.color.ink}';
                tc.strokeText('NEW SUB', 16, ${rowH / 2});
                tc.shadowColor = 'transparent'; tc.fillStyle = '#fff'; tc.fillText('NEW SUB', 16, ${rowH / 2});
                const y = 60 + i * ${rowH};
                ctx.fillStyle = name.startsWith('today') ? '#ff5f5f' : '#e8e8ee';
                ctx.font = '700 20px ${T.family}'; ctx.fillText(name.toUpperCase(), 10, y + 56);
                ctx.font = '400 18px ${T.family}';
                ctx.fillText(px + 'px · ' + Math.round(px * 2 / 3) + ' · ' + (px * 390 / 1920).toFixed(1), 10, y + 82);
                ctx.drawImage(tile, colX[0], y);
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(tile, colX[1], y, 480 * 2 / 3, ${rowH} * 2 / 3);
                // Phone: scale to 390/1920 the way the player does, then show it 2x, pixel for pixel
                const ph = document.createElement('canvas'); const s = 390 / 1920;
                ph.width = Math.round(480 * s); ph.height = Math.round(${rowH} * s);
                const pc = ph.getContext('2d'); pc.imageSmoothingQuality = 'high'; pc.drawImage(tile, 0, 0, ph.width, ph.height);
                ctx.imageSmoothingEnabled = false; ctx.drawImage(ph, colX[2], y, ph.width * 2, ph.height * 2); ctx.imageSmoothingEnabled = true;
              }
              window.__done = true;
            })();
          </script>`, W, rows.length * rowH + 70, 'type-scale.jpg');
    }

    // 4. Text over video: contrast do and don't
    if (want('contrast')) {
        const amber = scaleHex(stops[6], D.color.brightness);
        const orange = scaleHex(stops[5], D.color.brightness);
        const tile = (label, cls, inner, bgCss) => `<div style="width:620px">
            <div class="cap ${cls}" style="margin:0 0 10px 4px">${label}</div>
            <div style="position:relative;width:620px;height:200px;overflow:hidden;${bgCss}">${inner}</div></div>`;
        const epcotBg = bg ? `background:url(${bg}) -1100px -560px / 1920px 1080px` : 'background:#5a2a10';
        const word = (css) => `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="${css}">Raid incoming</span></div>`;
        const plain = `font:700 56px Jost;text-transform:uppercase;color:#fff`;
        await shoot(`<div style="display:grid;grid-template-columns:repeat(3,620px);gap:28px 30px;padding:30px">
            ${tile('Don\'t: bare white over bright video', 'dont', word(plain), epcotBg)}
            ${tile('Don\'t: white on amber (2.7:1)', 'dont', word(plain), `background:${amber}`)}
            ${tile('Don\'t: thin stroke, dark shadow only', 'dont', word(plain + ';text-shadow:2px 2px 4px rgba(0,0,0,.6)'), epcotBg)}
            ${tile('Do: ink stroke + down-right shadow', 'do', word(textCss(56)), epcotBg)}
            ${tile('Do: ink text on amber (7.3:1)', 'do', word(`font:700 56px Jost;text-transform:uppercase;color:${D.color.ink}`), `background:${amber}`)}
            ${tile('Do: white on a darkened plate', 'do', word(plain), `${epcotBg};box-shadow:inset 0 0 0 1000px rgba(20,6,31,.72)`)}
          </div>`, 1950, 580, 'contrast.jpg');
        void orange;
    }

    // 5. Chroma subsampling: hue-only contrast dies in a 4:2:0 encode
    if (want('chroma')) {
        const violet = scaleHex(stops[0], D.color.brightness), magenta = scaleHex(stops[2], D.color.brightness);
        const red = scaleHex(stops[3], D.color.brightness);
        const src = await shoot(`<div style="width:1920px;height:1080px;background:${violet};position:relative">
            <div style="position:absolute;left:80px;top:140px;font:700 72px Jost;color:${magenta}">MAGENTA ON VIOLET</div>
            <div style="position:absolute;left:80px;top:300px;font:700 72px Jost;color:${red}">RED ON VIOLET</div>
            <div style="position:absolute;left:80px;top:470px;${textCss(72)}">WHITE + INK STROKE</div>
            <div style="position:absolute;left:80px;top:650px;width:1500px;height:3px;background:${red}"></div>
            <div style="position:absolute;left:80px;top:720px;width:1500px;height:2px;background:#fff"></div>
            <div style="position:absolute;left:80px;top:790px;width:1500px;height:4px;background:#fff"></div>
          </div>`, 1920, 1080, join(tmp, 'chroma-src.png'), { jpeg: false });
        const dec = encode720(src, 'chroma', 30);
        await shoot(`<div style="display:grid;grid-template-columns:900px 900px;gap:16px;padding:20px">
            <div class="cap">Source, 1080p</div><div class="cap">After a 720p 4:2:0 x264 encode</div>
            <div style="width:900px;height:507px;background:url(${dataUrl(src)}) 0 -60px / 1600px 900px"></div>
            <div style="width:900px;height:507px;background:url(${dataUrl(dec)}) 0 -60px / 1600px 900px"></div>
            <div class="cap dont">Don't: hue-only contrast, thin coloured lines</div>
            <div class="cap do">Do: luminance contrast (white over ink), strokes 3px and up</div>
          </div>`, 1856, 620, 'chroma.jpg');
    }

    // 6. Banding: big slow dark gradients band once encoded
    if (want('banding')) {
        const ink = D.color.ink, violet = scaleHex(stops[0], 0.45);
        const src = await shoot(`<div style="width:1920px;height:1080px;display:grid;grid-template-columns:1fr 1fr 1fr">
            <div style="background:linear-gradient(90deg, ${ink}, ${violet})"></div>
            <div style="background:linear-gradient(90deg, ${ink}, ${violet})"><canvas id="n" width="640" height="1080"></canvas></div>
            <div style="background:linear-gradient(90deg, ${ink}, ${scaleHex(stops[0], 0.8)})"></div>
          </div>
          <script data-run>
            const c = document.getElementById('n'), x = c.getContext('2d'), im = x.createImageData(640, 1080);
            for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() < .5 ? 255 : 0; im.data[i] = im.data[i+1] = im.data[i+2] = v; im.data[i+3] = 7; }
            x.putImageData(im, 0, 0); window.__done = true;
          </script>`, 1920, 1080, join(tmp, 'banding-src.png'), { jpeg: false });
        const dec = encode720(src, 'banding', 30);
        // The dark ramp (left third) before and after, levels stretched x4 so
        // the steps are visible on any monitor
        const crop = (img) => `<div style="width:900px;height:380px;background:url(${dataUrl(img)}) 0 -300px / 2700px 1519px;filter:brightness(4) contrast(1.3)"></div>`;
        await shoot(`<div style="display:grid;grid-template-columns:900px 900px;gap:12px 20px;padding:20px">
            <div class="cap">Source: 640px dark ramp, ink to dim violet</div><div class="cap dont">After a 720p x264 encode: steps and blocks</div>
            ${crop(src)}${crop(dec)}
            <div class="cap" style="grid-column:1/3">Levels stretched 4x so the steps show on any monitor. A long, slow ramp in the darkest tones bands first</div>
          </div>`, 1840, 500, 'banding.jpg');
    }

    // 7. Easing tokens as curves (SVG, rendered by GitHub directly)
    if (want('easing')) {
        const curve = ([x1, y1, x2, y2], ox) => `<path d="M${ox} 300 C ${ox + x1 * 240} ${300 - y1 * 240} ${ox + x2 * 240} ${300 - y2 * 240} ${ox + 240} 60" fill="none" stroke="#ff8c1e" stroke-width="5"/>`;
        const e = D.motion.ease, ms = D.motion.durationMs;
        const box = (name, pts, ox, note) => `<rect x="${ox}" y="60" width="240" height="240" fill="none" stroke="#3a3d48" stroke-width="2"/>
            ${curve(pts, ox)}<text x="${ox}" y="40" fill="#e8e8ee" font-family="Jost, sans-serif" font-weight="700" font-size="22">${name.toUpperCase()}</text>
            <text x="${ox}" y="335" fill="#a8a8b8" font-family="Jost, sans-serif" font-size="18">${note}</text>
            <text x="${ox}" y="360" fill="#a8a8b8" font-family="monospace" font-size="15">cubic-bezier(${pts.join(', ')})</text>`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="980" height="390" viewBox="0 0 980 390">
            <rect width="980" height="390" fill="#0d0e11"/>
            ${box('enter', e.enter, 40, `arrivals · ${ms.enter} ms`)}
            ${box('exit', e.exit, 370, `departures · ${ms.exit} ms`)}
            ${box('move', e.move, 700, `crossing the screen · ${ms.move} ms`)}
          </svg>`;
        writeFileSync(join(outDir, 'easing.svg'), svg);
        console.log('wrote', join(outDir, 'easing.svg'));
    }

    // 8. The stinger's grammar from harness frames: in, cut, out
    if (want('stinger-cut')) {
        const dir = join(runDir, 'stinger', 'seed-1');
        if (existsSync(dir)) {
            const frames = [['t00150', 'In · 150 ms'], ['t00750', 'Cut · 50% (covered)'], ['t01350', 'Out · 1350 ms']];
            await shoot(`<div style="display:grid;grid-template-columns:repeat(3,620px);gap:16px;padding:20px">
                ${frames.map(([f, l]) => `<div><div class="cap" style="margin-bottom:8px">${l}</div>
                  <div style="position:relative;width:620px;height:349px">${bg ? `<img src="${bg}" style="position:absolute;width:620px;height:349px">` : ''}
                  <img src="${dataUrl(join(dir, f + '.png'))}" style="position:absolute;width:620px;height:349px"></div></div>`).join('')}
              </div>`, 1920, 430, 'stinger-grammar.jpg');
        }
    }
} finally {
    await browser.close();
}
