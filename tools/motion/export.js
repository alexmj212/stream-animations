#!/usr/bin/env node
/**
 * Render a scene to a transparent video, frame-exact, using the motion
 * harness clock. The main use is turning the stinger into a file for OBS's
 * native Stinger transition (Scene Transitions → + → Stinger), which only
 * accepts video files.
 *
 * Usage:
 *   npm run motion:export -- stinger --color=#ff6600 --duration=1500
 *   npm run motion:export -- stinger --format=mov      # ProRes 4444 (alpha)
 *   npm run motion:export -- sidebar --text="Now Playing" --duration=5000
 *   npm run motion:export -- stinger --format=png      # keep the PNG frames
 *
 * Options: --fps=60 --seed=1 --width=1920 --height=1080 --out=exports
 * Needs ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg) for webm/mov.
 */
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { startServer, launchBrowser, projectRoot } from '../lib/browser.js';
import { installVirtualClock } from './clock.js';
import { SCENARIOS } from './scenes.js';

const argv = process.argv.slice(2);
const flags = Object.fromEntries(
  argv.filter(a => a.startsWith('--')).map(a => {
    const i = a.indexOf('=');
    return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
  })
);
const sceneName = argv.find(a => !a.startsWith('--')) || 'stinger';
const scenario = SCENARIOS.find(s => s.name === sceneName);
if (!scenario) {
  console.error(`Unknown scene "${sceneName}". Available: ${SCENARIOS.map(s => s.name).join(', ')}`);
  process.exit(2);
}

const fps = Number(flags.fps || 60);
const width = Number(flags.width || 1920);
const height = Number(flags.height || 1080);
const seed = Number(flags.seed || 1);
const format = String(flags.format || 'webm');
const outDir = resolve(projectRoot, String(flags.out || 'exports'));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

// Scenario URL with CLI overrides applied
const url = new URL(scenario.url, 'http://x');
for (const key of ['color', 'duration', 'text', 'hold']) {
  if (flags[key] !== undefined) url.searchParams.set(key, String(flags[key]));
}
url.searchParams.set('seed', String(seed));
const durationMs = Number(url.searchParams.get('duration')) || null;
const maxMs = Math.max(scenario.captureMs, (durationMs || 0) + 1000);

const color = (url.searchParams.get('color') || 'default').replace('#', '');
const base = `${sceneName}-${color}${durationMs ? `-${durationMs}ms` : ''}-${fps}fps-seed${seed}`;
const framesDir = resolve(outDir, `${base}-frames`);
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const { server, baseUrl } = await startServer();
const { browser } = await launchBrowser({ width, height });
let frameCount = 0;
let coverStart = null;
let coverEnd = null;
let runStart = null;
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(`(${installVirtualClock.toString()})(${seed});`);
  await page.goto(`${baseUrl}${url.pathname}${url.search}`, { waitUntil: 'load' });
  if (scenario.start?.event) {
    await page.evaluate((name) => window.dispatchEvent(new Event(name)), scenario.start.event);
  } else {
    const start = Date.now();
    while (!(await page.evaluate(() => window.__motion.pending() > 0)) && Date.now() - start < 8000) {
      await new Promise(r => setTimeout(r, 25));
    }
  }

  const dt = 1000 / fps;
  let started = false;
  for (let t = dt; t <= maxMs + dt / 2; t += dt) {
    const { pending, pixels } = await page.evaluate((d) => {
      window.__motion.step(d);
      return { pending: window.__motion.pending(), pixels: window.__motion.pixelStats(4) };
    }, dt);
    if (pixels.visible > 0) started = true;
    if (pixels.opaque >= 0.999) {
      // Video frame N shows virtual time (N+1)*dt, so in video time it is t - dt.
      // Keep the longest unbroken covered run so the Transition Point can't
      // land on a frame inside a gap.
      if (runStart === null) runStart = t - dt;
      if (coverStart === null || (t - dt) - runStart > coverEnd - coverStart) {
        coverStart = runStart;
        coverEnd = t - dt;
      }
    } else {
      runStart = null;
    }
    await page.screenshot({ path: resolve(framesDir, `f${String(frameCount).padStart(5, '0')}.png`), omitBackground: true });
    frameCount++;
    // One-shot scenes: stop one frame after everything is gone
    if (started && pending === 0 && pixels.visible === 0) break;
  }
} finally {
  await browser.close();
  await server.close();
}

const seconds = frameCount / fps;
console.log(`Rendered ${frameCount} frames (${seconds.toFixed(3)}s @ ${fps}fps) → ${framesDir}`);

let outFile = framesDir;
if (format !== 'png') {
  const args = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', resolve(framesDir, 'f%05d.png')];
  if (format === 'mov') {
    outFile = resolve(outDir, `${base}.mov`);
    args.push('-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', outFile);
  } else {
    outFile = resolve(outDir, `${base}.webm`);
    args.push('-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '18', '-row-mt', '1', '-auto-alt-ref', '0', outFile);
  }
  const r = spawnSync(ffmpeg, args, { stdio: 'inherit' });
  if (r.error || r.status !== 0) {
    console.error(`ffmpeg failed (${r.error?.message || `exit ${r.status}`}); PNG frames kept in ${framesDir}`);
    process.exit(1);
  }
  rmSync(framesDir, { recursive: true, force: true });
  console.log(`Wrote ${outFile}`);
}

if (coverStart !== null && existsSync(outFile)) {
  const cut = Math.round((coverStart + coverEnd) / 2);
  console.log(`\nOBS Stinger settings:\n  Video File: ${outFile}\n  Transition Point Type: Time (milliseconds)\n  Transition Point: ${cut} ms   (screen fully covered ${Math.round(coverStart)}–${Math.round(coverEnd)} ms)`);
}
