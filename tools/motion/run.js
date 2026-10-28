#!/usr/bin/env node
/**
 * Motion harness: renders each scene frame-by-frame on a virtual clock,
 * checks timing / coverage / smoothness / CPU budget, and writes an HTML
 * report with filmstrips and motion charts.
 *
 * Usage:
 *   npm run motion                         # every scenario, seeds 1-3
 *   npm run motion -- stinger              # one scenario
 *   npm run motion -- stinger --seeds=7    # specific layout seed(s)
 *   npm run motion -- --fps=30             # step at another frame rate
 *   npm run motion -- --no-shots           # skip keyframe screenshots (faster)
 *   npm run motion -- --dump               # also write every frame's raw data (capture.json)
 *   npm run motion -- --color=00b3ff       # try another brand color
 *   npm run motion -- --params=scheme=mono # extra URL params for every scene (&-separated)
 *   npm run motion -- --out=before         # write to tools/motion-results-before (keeps other runs)
 *   npm run motion -- --jitter             # uneven frame times (timing/coverage checks only)
 *
 * Exit code is non-zero when any check fails, so it can gate CI.
 * Report: tools/motion-results/index.html
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startServer, launchBrowser } from '../lib/browser.js';
import { installVirtualClock } from './clock.js';
import { SCENARIOS } from './scenes.js';
import { evaluate, workStats } from './analyze.js';
import { renderReport } from './report.js';
import { createRandom } from '../../src/shared/motion.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const flags = Object.fromEntries(
  argv.filter(a => a.startsWith('--')).map(a => {
    const i = a.indexOf('=');
    return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
  })
);
// --out=NAME keeps side-by-side runs (before/after mocks) from wiping each
// other. A run clears only the scene folders it renders.
const outDir = resolve(__dirname, '..', flags.out ? `motion-results-${flags.out}` : 'motion-results');
const names = argv.filter(a => !a.startsWith('--'));
const fps = Number(flags.fps || 60);
const seeds = String(flags.seeds || '1,2,3').split(',').map(Number);
const shots = !flags['no-shots'];
const jitter = !!flags.jitter;
const width = Number(flags.width || 1920);
const height = Number(flags.height || 1080);

const scenarios = names.length ? SCENARIOS.filter(s => names.includes(s.name)) : SCENARIOS;
if (scenarios.length === 0) {
  console.error(`Unknown scenario(s): ${names.join(', ')}. Available: ${SCENARIOS.map(s => s.name).join(', ')}`);
  process.exit(2);
}

async function waitFor(page, fn, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await page.evaluate(fn)) return true;
    await new Promise(r => setTimeout(r, 25));
  }
  return false;
}

async function capture(browser, baseUrl, scenario, seed) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    // Resource failures are reported (with their URL) by the response hook below
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text());
  });
  page.on('response', res => {
    if (res.status() >= 400 && !res.url().endsWith('/favicon.ico')) errors.push(`${res.status()} ${res.url()}`);
  });

  await page.evaluateOnNewDocument(`(${installVirtualClock.toString()})(${seed});`);
  const params = new URL(scenario.url, 'http://x');
  if (flags.color) params.searchParams.set('color', String(flags.color).startsWith('#') ? flags.color : `#${flags.color}`);
  // --params=a=1&b=2: extra scene params, e.g. to mock a look without
  // editing scenes.js
  for (const [k, v] of new URLSearchParams(String(flags.params || ''))) params.searchParams.set(k, v);
  params.searchParams.set('seed', String(seed));
  // Scene events (src/shared/debug.js) for the debugEvents check, added to
  // any channels the scenario or --params asked for (e.g. debug=zones)
  const channels = (params.searchParams.get('debug') || '').split(',').filter(Boolean);
  if (!channels.includes('events')) channels.push('events');
  params.searchParams.set('debug', channels.join(','));
  const url = `${baseUrl}${params.pathname}${params.search}`;
  await page.goto(url, { waitUntil: 'load' });

  if (scenario.start === 'load') {
    const ok = await waitFor(page, () => window.__motion.pending() > 0);
    if (!ok) errors.push('scene never requested an animation frame');
  } else if (scenario.start?.event) {
    // Give module scripts a moment to register their listeners
    await waitFor(page, () => document.readyState === 'complete');
    await page.evaluate((name) => window.dispatchEvent(new Event(name)), scenario.start.event);
    // Extra triggers in the same instant, e.g. OBS firing obsSourceActiveChanged too
    for (const extra of scenario.start.also || []) {
      await page.evaluate(({ event, detail }) => window.dispatchEvent(new CustomEvent(event, { detail })), extra);
    }
  }

  const dt = 1000 / fps;
  const frames = [];
  const shotTimes = (scenario.keyframes || []).map(k => k * (scenario.keyframeSpanMs || scenario.captureMs));
  const shotFiles = [];
  const dir = resolve(outDir, scenario.name, `seed-${seed}`);
  mkdirSync(dir, { recursive: true });

  // --jitter: uneven frame times (0.5x-3x the nominal frame, seeded), like a
  // busy OBS. Scenes positioned from absolute time must still hit their marks.
  const jitterRandom = createRandom(seed * 7919 + 1);
  let elapsed = 0;
  while (elapsed < scenario.captureMs) {
    const d = jitter ? dt * (0.5 + jitterRandom() * 2.5) : dt;
    elapsed += d;
    const frame = await page.evaluate((d, region, textSelector) => {
      const r = window.__motion.step(d);
      r.pixels = window.__motion.pixelStats(2, region);
      // textBox: canvas gaps under the on-screen part of a text element
      const el = textSelector && document.querySelector(textSelector);
      if (el) {
        const b = el.getBoundingClientRect();
        const W = window.innerWidth;
        const H = window.innerHeight;
        const x0 = Math.max(0, b.left) / W;
        const x1 = Math.min(W, b.right) / W;
        const y0 = Math.max(0, b.top) / H;
        const y1 = Math.min(H, b.bottom) / H;
        r.pixels.textGaps = x1 > x0 && y1 > y0
          ? window.__motion.pixelStats(2, { x0, x1, y0, y1 }).regionGaps
          : null;
      }
      return r;
    }, d, scenario.region || null, scenario.textBox?.selector || null);
    frames.push(frame);

    while (shots && shotTimes.length && frame.t >= shotTimes[0] - dt / 2) {
      const at = shotTimes.shift();
      const file = `t${String(Math.round(at)).padStart(5, '0')}.png`;
      await page.screenshot({ path: resolve(dir, file), omitBackground: true });
      shotFiles.push({ at, file: `${scenario.name}/seed-${seed}/${file}` });
    }
  }

  // scene: the createDebug() name, when a variant scenario reuses a scene
  const debug = await page.evaluate((name) => window.__debug?.[name]?.snapshot() ?? null, scenario.scene || scenario.name);
  await page.close();
  return { frames, errors, shots: shotFiles, debug };
}

async function main() {
  // Clear only the scenes this run renders, so `--out=x stinger` then
  // `--out=x sidebar` keeps both (the report covers the latest run)
  for (const s of scenarios) rmSync(resolve(outDir, s.name), { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const { server, baseUrl } = await startServer();
  const { browser, executablePath } = await launchBrowser({ width, height });
  console.log(`Chrome: ${executablePath}\nServing ${baseUrl}  fps=${fps} seeds=${seeds.join(',')}\n`);

  const runs = [];
  try {
    for (const scenario of scenarios) {
      for (const seed of seeds) {
        const t0 = Date.now();
        const { frames, errors, shots: shotFiles, debug } = await capture(browser, baseUrl, scenario, seed);
        // Velocity estimates on uneven frames are noisy; jitter runs check
        // timing and coverage only. Frames can be up to 3x nominal, so the
        // usual 2-frame duration tolerance becomes 2 of the longest frames.
        const spec = jitter
          ? { ...scenario, fps, checks: { ...scenario.checks, noVelocitySteps: false, workP95Ms: undefined, durationToleranceMs: 2 * 3 * 1000 / fps } }
          : { ...scenario, fps };
        const { results, timeline, tracks } = evaluate(spec, frames, debug);
        results.unshift({
          name: 'No page errors',
          pass: errors.length === 0,
          detail: errors.length ? errors.slice(0, 3).join(' | ') : 'console clean'
        });
        const pass = results.every(r => r.pass);
        runs.push({
          scenario: scenario.name, seed, pass, results, timeline,
          work: workStats(frames), shots: shotFiles, frames,
          tracks: Object.fromEntries(tracks), markers: scenario.markers || []
        });

        if (flags.dump) {
          writeFileSync(resolve(outDir, scenario.name, `seed-${seed}`, 'capture.json'), JSON.stringify({ frames }, null, 1));
        }
        console.log(`${pass ? 'PASS' : 'FAIL'}  ${scenario.name} seed=${seed}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        for (const r of results) console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}: ${r.detail}`);
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const summary = runs.map(({ frames, tracks, ...rest }) => rest);
  writeFileSync(resolve(outDir, 'report.json'), JSON.stringify({ fps, width, height, runs: summary }, null, 2));
  writeFileSync(resolve(outDir, 'index.html'), renderReport({ fps, width, height, runs }));
  const failed = runs.filter(r => !r.pass).length;
  console.log(`\n${runs.length - failed}/${runs.length} runs passed. Report: ${resolve(outDir, 'index.html')}`);
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
