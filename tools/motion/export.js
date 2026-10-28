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
 *   npm run motion:export -- epcot --loop --fps=30     # one seamless loop as MP4
 *
 * --loop renders exactly one period of a looping scene (epcot: ?loop= /
 * ?speed=, real length loopPeriod/speed) as an opaque H.264 MP4 and checks
 * the seam: the frame one period after the first must match the first.
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
import { config } from '../../src/config/config.js';

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
const loop = !!flags.loop;
const format = String(flags.format || (loop ? 'mp4' : 'webm'));
const outDir = resolve(projectRoot, String(flags.out || 'exports'));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

// Scenario URL with CLI overrides applied
const url = new URL(scenario.url, 'http://x');
for (const key of ['color', 'duration', 'text', 'hold', 'speed', 'pattern', 'scheme', 'style', 'colorlayout']) {
  if (flags[key] !== undefined) url.searchParams.set(key, String(flags[key]));
}
url.searchParams.set('seed', String(seed));
let periodMs = null;
if (loop) {
  const cfg = config[sceneName] || {};
  const loopSeconds = Number(typeof flags.loop === 'string' ? flags.loop : cfg.loopPeriod);
  const speed = Number(url.searchParams.get('speed') || cfg.speedDefault || 1);
  if (!(loopSeconds > 0)) {
    console.error(`--loop needs a loop period: ${sceneName} has none in config; pass --loop=SECONDS`);
    process.exit(2);
  }
  url.searchParams.set('loop', String(loopSeconds));
  url.searchParams.set('speed', String(speed));
  periodMs = loopSeconds / speed * 1000;
  // A loop must be a whole number of frames, or the clip and the seam
  // check would be off by a fraction of a frame
  const frames = periodMs * fps / 1000;
  if (Math.abs(frames - Math.round(frames)) > 1e-6) {
    console.error(`--loop: ${(periodMs / 1000).toFixed(3)}s at ${fps}fps is ${frames.toFixed(2)} frames, not a whole number; pick another --fps, --loop or --speed`);
    process.exit(2);
  }
}
const durationMs = Number(url.searchParams.get('duration')) || null;
const maxMs = loop ? periodMs : Math.max(scenario.captureMs, (durationMs || 0) + 1000);

const color = (url.searchParams.get('color') || 'default').replace('#', '');
const base = loop
  ? `${sceneName}-loop-${Math.round(periodMs / 1000)}s-${height}p${fps}-seed${seed}`
  : `${sceneName}-${color}${durationMs ? `-${durationMs}ms` : ''}-${fps}fps-seed${seed}`;
const framesDir = resolve(outDir, `${base}-frames`);
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const { server, baseUrl } = await startServer();
const { browser } = await launchBrowser({ width, height });
let frameCount = 0;
let coverStart = null;
let coverEnd = null;
let runStart = null;
const seamFile = resolve(framesDir, 'seam.png');
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
  // A loop is exactly round(period/dt) frames: frames at dt..period, so the
  // frame after the last (period+dt) should equal the first (dt)
  const loopFrames = loop ? Math.round(periodMs / dt) : Infinity;
  let started = false;
  for (let t = dt; loop ? frameCount < loopFrames : t <= maxMs + dt / 2; t += dt) {
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
    await page.screenshot({ path: resolve(framesDir, `f${String(frameCount).padStart(5, '0')}.png`), omitBackground: !loop });
    frameCount++;
    // One-shot scenes: stop one frame after everything is gone
    if (!loop && started && pending === 0 && pixels.visible === 0) break;
  }
  if (loop) {
    await page.evaluate((d) => window.__motion.step(d), dt);
    await page.screenshot({ path: seamFile });
  }
} finally {
  await browser.close();
  await server.close();
}

const seconds = frameCount / fps;
console.log(`Rendered ${frameCount} frames (${seconds.toFixed(3)}s @ ${fps}fps) → ${framesDir}`);

let seamPsnr = null;
if (loop) {
  // PSNR between the first frame and the frame one period later
  // ("inf" = pixel-identical); ffmpeg prints it on stderr
  const r = spawnSync(ffmpeg, ['-loglevel', 'info', '-i', resolve(framesDir, 'f00000.png'), '-i', seamFile, '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  seamPsnr = (r.stderr || '').match(/average:(\S+)/)?.[1] ?? null;
  rmSync(seamFile, { force: true });
}

let outFile = framesDir;
if (format !== 'png') {
  const args = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', resolve(framesDir, 'f%05d.png')];
  if (format === 'mp4') {
    outFile = resolve(outDir, `${base}.mp4`);
    args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile);
  } else if (format === 'mov') {
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

if (loop) {
  const seamless = seamPsnr === 'inf';
  console.log(`\nLoop: ${frameCount} frames = ${(frameCount / fps).toFixed(3)}s (period ${(periodMs / 1000).toFixed(3)}s)`);
  console.log(`Seam: first frame vs one period later: PSNR ${seamPsnr ?? 'unknown'} dB ${seamless ? '(identical, seamless)' : '(NOT identical)'}`);
  if (!seamless) process.exitCode = 1;
}

if (!loop && coverStart !== null && existsSync(outFile)) {
  const cut = Math.round((coverStart + coverEnd) / 2);
  console.log(`\nOBS Stinger settings:\n  Video File: ${outFile}\n  Transition Point Type: Time (milliseconds)\n  Transition Point: ${cut} ms   (screen fully covered ${Math.round(coverStart)}–${Math.round(coverEnd)} ms)`);
}
