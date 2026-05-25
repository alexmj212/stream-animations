#!/usr/bin/env node
/**
 * Capture screenshots of each scene at meaningful phase points.
 * Output: tools/benchmark-results/screenshots/<scene>-<label>.png
 *
 * Usage: node tools/benchmark/capture.js [color=#ff6600]
 */

import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');
const outDir = resolve(__dirname, '..', 'benchmark-results', 'screenshots');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const color = (process.argv[2] || '#ff6600').replace(/^#/, '%23').replace(/^/, '#').replace('#%23', '%23');
// Convert "#ff6600" → "%23ff6600"
const colorParam = '%23' + (process.argv[2] || '#ff6600').replace(/^#/, '');

const CHROME_CANDIDATES = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const chromePath = CHROME_CANDIDATES.find(p => existsSync(p));

// (scene, urlSuffix, [{label, atMs, triggerAtMs?}])
const PLAN = [
  {
    name: 'background',
    url: `/src/background/index.html?color=${colorParam}`,
    shots: [
      { label: 'a-2s', atMs: 2000 },
      { label: 'b-8s', atMs: 8000 },
      { label: 'c-15s', atMs: 15000 }
    ]
  },
  {
    name: 'sidebar',
    url: `/src/sidebar/index.html?color=${colorParam}`,
    shots: [
      { label: 'a-in-500ms',  atMs: 500 },
      { label: 'b-in-1200ms', atMs: 1200 },
      { label: 'c-hold-2500ms', atMs: 2500 },
      { label: 'd-out-4000ms', atMs: 4000 }
    ]
  },
  {
    name: 'shade',
    url: `/src/shade/index.html?color=${colorParam}&text=NEW+RAID+INCOMING`,
    shots: [
      { label: 'a-in-600ms',  atMs: 600 },
      { label: 'b-mid-2500ms', atMs: 2500 },
      { label: 'c-late-5500ms', atMs: 5500 }
    ]
  },
  {
    name: 'stinger',
    url: `/src/stinger/index.html?color=${colorParam}&duration=3000`,
    // Stinger needs a transitionStart event before anything happens
    trigger: { atMs: 200 },
    shots: [
      { label: 'a-in-400ms',  atMs: 400 },     // ~200ms into the in phase
      { label: 'b-in-900ms', atMs: 900 },      // near full coverage
      { label: 'c-pause-1500ms', atMs: 1500 }, // hold
      { label: 'd-out-2500ms', atMs: 2500 },   // mid out
      { label: 'e-out-2900ms', atMs: 2900 }    // near end
    ]
  }
];

async function captureScene(browser, baseUrl, scene) {
  console.log(`\n=== ${scene.name} ===`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  // Silence
  page.on('pageerror', err => console.log(`  [pageerror] ${err.message}`));

  // Inject a representative dark-gray backdrop so we can see how these look
  // composited over typical stream content (game footage rarely is pure black).
  await page.evaluateOnNewDocument(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.style.background = '#1f2233';
    }, { once: true });
  });

  const navStart = Date.now();
  await page.goto(baseUrl + scene.url, { waitUntil: 'load' });

  if (scene.trigger) {
    const wait = scene.trigger.atMs - (Date.now() - navStart);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    await page.evaluate(() => window.dispatchEvent(new Event('transitionStart')));
  }

  for (const shot of scene.shots) {
    const wait = (scene.trigger?.atMs ?? 0) + shot.atMs - (Date.now() - navStart);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const path = resolve(outDir, `${scene.name}-${shot.label}.png`);
    await page.screenshot({ path, omitBackground: false });
    console.log(`  wrote ${shot.label}`);
  }
  await page.close();
}

async function main() {
  console.log(`Color: #${(process.argv[2] || '#ff6600').replace(/^#/, '')}`);
  const server = await createServer({
    root: projectRoot,
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'warn'
  });
  await server.listen();
  const baseUrl = `http://127.0.0.1:${server.config.server.port}`;
  console.log(`Vite listening at ${baseUrl}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--window-size=1920,1080'
    ]
  });

  try {
    for (const scene of PLAN) {
      await captureScene(browser, baseUrl, scene);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(`\nOutput: ${outDir}`);
}

main().catch(err => { console.error(err); process.exit(1); });
