#!/usr/bin/env node
/**
 * Headless benchmark harness for stream-animations.
 *
 * Boots Vite's dev server, drives each scene in headless Chrome via
 * puppeteer-core, and captures both PerformanceMonitor metrics and
 * Canvas 2D method-level instrumentation.
 *
 * Usage:
 *   node tools/benchmark/run.js                  # all scenes
 *   node tools/benchmark/run.js stinger          # one scene
 *   node tools/benchmark/run.js --duration 20    # override sample window
 *   node tools/benchmark/run.js --headed         # show browser
 */

import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');
const resultsDir = resolve(__dirname, '..', 'benchmark-results');
const instrumentSrc = readFileSync(resolve(__dirname, 'instrument.js'), 'utf8');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const SCENE_DEFS = [
  {
    name: 'background',
    url: '/src/background/index.html?perf=true&color=%23ff6600',
    warmupMs: 2000,
    sampleMs: 10000,
    trigger: null
  },
  {
    name: 'sidebar',
    url: '/src/sidebar/index.html?perf=true&color=%23ff6600',
    warmupMs: 1000,
    sampleMs: 10000,
    trigger: null
  },
  {
    name: 'shade',
    url: '/src/shade/index.html?perf=true&color=%23ff6600&text=BENCHMARK+RAID',
    warmupMs: 2000,
    sampleMs: 10000,
    trigger: null
  },
  {
    name: 'stinger',
    url: '/src/stinger/index.html?perf=true&color=%23ff6600&duration=3000',
    warmupMs: 500,
    sampleMs: 12000,
    // Fire transitions repeatedly so we measure the actual animating window
    trigger: async (page) => {
      const total = 4;
      for (let i = 0; i < total; i++) {
        await page.evaluate(() => window.dispatchEvent(new Event('transitionStart')));
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
];

const requestedScenes = argv.filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(
  argv
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    })
);
const headed = !!flags.headed;
const durationOverride = flags.duration ? Number(flags.duration) * 1000 : null;

const scenes = SCENE_DEFS.filter(
  s => requestedScenes.length === 0 || requestedScenes.includes(s.name)
);

if (scenes.length === 0) {
  console.error(`Unknown scenes: ${requestedScenes.join(', ')}`);
  console.error(`Available: ${SCENE_DEFS.map(s => s.name).join(', ')}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// System Chrome detection
// ---------------------------------------------------------------------------
const CHROME_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];
const chromePath = CHROME_CANDIDATES.find(p => existsSync(p));
if (!chromePath) {
  console.error('No system Chrome/Chromium found. Tried:', CHROME_CANDIDATES);
  process.exit(1);
}

if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
async function benchmarkScene(browser, baseUrl, scene) {
  const sampleMs = durationOverride ?? scene.sampleMs;
  console.log(`\n=== ${scene.name} ===`);
  console.log(`  url: ${scene.url}`);
  console.log(`  warmup: ${scene.warmupMs}ms  sample: ${sampleMs}ms`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  // Forward useful console output but filter known noise
  page.on('console', (msg) => {
    const text = msg.text();
    if (/\[Stinger\]|\[Cache\]|Initialized|cleanup/i.test(text)) return;
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`  [page ${msg.type()}] ${text}`);
    }
  });
  page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`));

  // Inject instrumentation BEFORE the page's scripts run
  await page.evaluateOnNewDocument(instrumentSrc);

  // CDP performance metrics
  const cdp = await page.createCDPSession();
  await cdp.send('Performance.enable');

  const startNav = Date.now();
  await page.goto(baseUrl + scene.url, { waitUntil: 'load' });

  // Wait for perfMonitor API to be exposed
  await page.waitForFunction(
    'window.perfMonitor && window.__canvasStats && window.__canvasStats.started',
    { timeout: 5000 }
  );

  // Warmup
  await new Promise(r => setTimeout(r, scene.warmupMs));

  // Reset counters at the start of the sample window
  await page.evaluate(() => {
    window.perfMonitor.reset();
    window.__canvasStatsReset();
  });

  const sampleStart = Date.now();
  const cdpBefore = await cdp.send('Performance.getMetrics');

  // Fire trigger and sample in parallel
  const triggerPromise = scene.trigger ? scene.trigger(page) : Promise.resolve();
  const sampleTimeout = new Promise(r => setTimeout(r, sampleMs));
  await Promise.all([triggerPromise, sampleTimeout]);

  const cdpAfter = await cdp.send('Performance.getMetrics');
  const actualMs = Date.now() - sampleStart;

  // Pull stats
  const metrics = await page.evaluate(() => {
    const perf = window.perfMonitor.getCurrentMetrics();
    const cstats = window.__canvasStats;

    // Compute totals + per-call mean
    const perCall = {};
    for (const m of Object.keys(cstats.calls)) {
      const calls = cstats.calls[m];
      const t = cstats.timeMs[m];
      if (calls > 0) {
        perCall[m] = { calls, totalMs: t, meanUs: (t / calls) * 1000 };
      }
    }
    return {
      perf,
      canvas: {
        ...perCall,
        _totals: {
          fillStyleSets: cstats.fillStyleSets,
          globalAlphaSets: cstats.globalAlphaSets,
          gradientObjectsCreated: cstats.gradientObjectsCreated,
          canvasGetContextCalls: cstats.canvasGetContextCalls,
          drawImageMB: (cstats.drawImageBytes / 1048576)
        }
      }
    };
  });

  // CDP frame timing delta
  const metricsMap = (m) => Object.fromEntries(m.metrics.map(x => [x.name, x.value]));
  const before = metricsMap(cdpBefore);
  const after = metricsMap(cdpAfter);
  const cdpDelta = {
    taskDurationMs: ((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1000,
    scriptDurationMs: ((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)) * 1000,
    layoutDurationMs: ((after.LayoutDuration ?? 0) - (before.LayoutDuration ?? 0)) * 1000,
    recalcStyleMs: ((after.RecalcStyleDuration ?? 0) - (before.RecalcStyleDuration ?? 0)) * 1000,
    jsHeapUsedMB: (after.JSHeapUsedSize ?? 0) / 1048576,
    nodes: after.Nodes,
    frames: after.Frames
  };

  // Aggregate hot path
  const sortedDraw = Object.entries(metrics.canvas)
    .filter(([k]) => !k.startsWith('_'))
    .sort((a, b) => b[1].totalMs - a[1].totalMs);

  await page.close();

  const result = {
    scene: scene.name,
    sampleDurationMs: actualMs,
    perf: metrics.perf,
    cdp: cdpDelta,
    canvasCalls: Object.fromEntries(sortedDraw),
    canvasTotals: metrics.canvas._totals,
    navMs: sampleStart - startNav
  };

  // Console summary
  console.log(`  fps=${result.perf.fps}  avgFrame=${result.perf.avgFrameTime}ms  p99=${result.perf.p99FrameTime}ms  dropped=${result.perf.droppedFrames}`);
  console.log(`  cdp: scriptMs=${cdpDelta.scriptDurationMs.toFixed(0)}  taskMs=${cdpDelta.taskDurationMs.toFixed(0)}  jsHeap=${cdpDelta.jsHeapUsedMB.toFixed(1)}MB`);
  console.log('  hot path (ms total / per-call us):');
  for (const [name, v] of sortedDraw.slice(0, 8)) {
    console.log(
      `    ${name.padEnd(22)} ${v.totalMs.toFixed(2).padStart(8)} ms  ` +
      `${String(v.calls).padStart(7)} calls  ` +
      `${v.meanUs.toFixed(2).padStart(6)} us/call`
    );
  }
  console.log(`  state changes: fillStyle=${result.canvasTotals.fillStyleSets}  globalAlpha=${result.canvasTotals.globalAlphaSets}  gradientsCreated=${result.canvasTotals.gradientObjectsCreated}`);

  return result;
}

async function main() {
  console.log(`Booting Vite dev server on project root: ${projectRoot}`);
  const server = await createServer({
    root: projectRoot,
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'warn'
  });
  await server.listen();
  const baseUrl = `http://127.0.0.1:${server.config.server.port}`;
  console.log(`Vite listening at ${baseUrl}`);

  console.log(`Launching ${headed ? 'headed' : 'headless'} Chrome: ${chromePath}`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: !headed,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      // Use a real GPU pipeline when available — OBS Browser Source also goes through CEF's GPU process
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--window-size=1920,1080'
    ]
  });

  const results = [];
  try {
    for (const scene of scenes) {
      const r = await benchmarkScene(browser, baseUrl, scene);
      results.push(r);
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = resolve(resultsDir, `bench-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    viewport: { width: 1920, height: 1080 },
    chromePath,
    results
  }, null, 2));
  const latestPath = resolve(resultsDir, 'latest.json');
  writeFileSync(latestPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    viewport: { width: 1920, height: 1080 },
    chromePath,
    results
  }, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(`Wrote ${latestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
