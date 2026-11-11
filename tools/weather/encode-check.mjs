#!/usr/bin/env node
/**
 * What a Twitch-style encode does to Exo-Cast's text, with the compression
 * noise layer on and off (design review on #181, ENC-3: noise that changes
 * the whole picture eats the bitrate and can smear the real text). Captures
 * the page with a CDP screencast, encodes it the way OBS streams it (x264
 * veryfast, CBR, 720p60) and reports PSNR of the encode against the capture,
 * whole frame and on the text panel, plus a still from each encode.
 *
 *   npm run weather:encode -- [--seconds=20] [--kbps=6000] [--out=dir] [--page=local]
 *
 * Needs ffmpeg on PATH. Starts its own Vite server.
 */
import { startServer, launchBrowser } from '../lib/browser.js';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
}));
const seconds = Number(args.seconds ?? 20);
const kbps = Number(args.kbps ?? 6000);
const out = args.out || 'tools/motion-results/weather-encode';
const pageName = args.page || 'local';
fs.mkdirSync(out, { recursive: true });

const { server, baseUrl } = await startServer();
const { browser } = await launchBrowser();
const results = [];
for (const noise of ['on', 'off']) {
    const dir = path.join(out, `frames-${noise}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`${baseUrl}/src/weather/index.html?data=demo&tz=America/Chicago&page=${pageName}&pagems=600000${noise === 'off' ? '&noise=0' : ''}`);
    await new Promise((r) => setTimeout(r, 3000));
    const cdp = await page.createCDPSession();
    const frames = [];
    cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
        frames.push({ t: metadata.timestamp, data });
        await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'png', maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
    await new Promise((r) => setTimeout(r, seconds * 1000));
    await cdp.send('Page.stopScreencast');
    await page.close();
    // Hold each captured frame until the next one, at 60 fps
    const list = [];
    frames.forEach((f, i) => {
        const file = path.join(dir, `f${String(i).padStart(5, '0')}.png`);
        fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
        const next = frames[i + 1]?.t ?? f.t + 1 / 60;
        list.push(`file '${path.basename(file)}'`, `duration ${Math.max(1 / 60, next - f.t).toFixed(4)}`);
    });
    fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n') + '\n');
    const src = path.join(out, `source-${noise}.mkv`);
    const enc = path.join(out, `encode-${noise}.mp4`);
    const ff = (a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: ['ignore', 'pipe', 'pipe'] });
    ff(['-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'fps=60,scale=1280:720,format=yuv444p', '-c:v', 'ffv1', src]);
    ff(['-i', src, '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', `${kbps}k`, '-minrate', `${kbps}k`, '-maxrate', `${kbps}k`,
        '-bufsize', `${kbps}k`, '-x264-params', 'nal-hrd=cbr:keyint=120', '-pix_fmt', 'yuv420p', enc]);
    const run = (crop) => {
        const lavfi = crop
            ? `[0:v]format=yuv420p,${crop}[a];[1:v]format=yuv420p,${crop}[b];[a][b]psnr`
            : '[0:v]format=yuv420p[a];[1:v]format=yuv420p[b];[a][b]psnr';
        // ffmpeg prints the PSNR summary on stderr
        const r = spawnSync('ffmpeg', ['-hide_banner', '-i', enc, '-i', src, '-lavfi', lavfi, '-f', 'null', '-'], { encoding: 'utf8' });
        return Number((r.stderr.match(/average:([\d.]+)/) || [])[1]);
    };
    const whole = run('');
    // The text panel: frame x 312-1608, y 224-904, at 720p
    const text = run('crop=864:453:208:149');
    ff(['-ss', String(seconds / 2), '-i', enc, '-frames:v', '1', path.join(out, `still-${noise}.png`)]);
    results.push({ noise, frames: frames.length, psnrWhole: whole, psnrText: text, bytes: fs.statSync(enc).size });
}
await browser.close();
await server.close();
console.table(results);
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));

