#!/usr/bin/env node
/**
 * Post-deploy smoke test for the Pages loader. Opens <base>/stinger/ the way
 * an OBS browser source does, then checks that:
 *   - the loader kept the URL and its params (no redirect),
 *   - the build stamp matches the expected commit (and version.json, if served),
 *   - ?debug=build shows that build on screen,
 *   - the stinger still catches transitionStart after the loader's
 *     document.write, and covers the screen at the cut,
 *   - there are no page errors.
 *
 * Usage:
 *   npm run pages:smoke -- https://alexmj212.dev/stream-animations <sha>
 *   npm run pages:smoke -- http://127.0.0.1:8811 <sha> --shot=pages.png
 *
 * <sha> is a commit prefix (7+ chars); main's HEAD after a deploy. Exit 0 on
 * pass. The cloud container can't reach Pages, so run it against live Pages
 * from a machine that can, or against a locally staged _site (QA charter).
 */
import { launchBrowser } from '../lib/browser.js';

const args = process.argv.slice(2);
const [base, sha] = args.filter(a => !a.startsWith('--')).map(s => s.replace(/\/$/, ''));
const shot = args.find(a => a.startsWith('--shot='))?.slice(7);
if (!base || !sha) {
  console.error('Usage: npm run pages:smoke -- <base-url> <sha> [--shot=file.png]');
  process.exit(2);
}

const query = '?color=%23ff6600&duration=1500&debug=build';
const { browser } = await launchBrowser();
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const logs = [];
page.on('console', m => logs.push(m.text()));
page.on('pageerror', e => logs.push(`PAGEERROR ${e.message}`));

const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail });

try {
  await page.goto(`${base}/stinger/${query}`);
  await page.waitForSelector('meta[name="build"]', { timeout: 20000 });
  const version = await page.evaluate(async (u) => {
    try { return await (await fetch(u, { cache: 'no-store' })).json(); } catch { return null; }
  }, `${base}/version.json`);
  const build = await page.$eval('meta[name="build"]', m => m.content);
  const short = sha.slice(0, 7);

  check('URL kept', page.url() === `${base}/stinger/${query}`, page.url());
  check('Build stamp', build.endsWith(short), `meta build "${build}", expected ...${short}`);
  check('version.json', !!version && String(version.commit).startsWith(short), version ? JSON.stringify(version) : 'not served');

  const t0 = Date.now();
  while (!logs.some(l => l.includes('[Stinger] Initialized')) && Date.now() - t0 < 10000) {
    await new Promise(r => setTimeout(r, 50));
  }
  const overlay = await page.evaluate(() =>
    [...document.querySelectorAll('body div')].map(e => e.textContent).find(t => /^build /.test(t || '')) || null);
  check('debug=build overlay', overlay === `build ${build}`, overlay ?? 'not shown');

  await page.evaluate(() => window.dispatchEvent(new Event('transitionStart')));
  await new Promise(r => setTimeout(r, 750));
  const covered = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let opaque = 0;
    let n = 0;
    for (let i = 3; i < d.length; i += 4 * 97) {
      n++;
      if (d[i] >= 250) opaque++;
    }
    return opaque / n;
  });
  if (shot) await page.screenshot({ path: shot });
  await new Promise(r => setTimeout(r, 1200));
  const starts = logs.filter(l => l.includes('starting transition')).length;
  check('Stinger plays after the loader', starts === 1 && covered > 0.99,
    `${starts} start(s), ${(covered * 100).toFixed(1)}% covered at ~750ms (real time, so roughly the cut)`);

  const errors = logs.filter(l => l.startsWith('PAGEERROR') || /^stream-animations loader:/.test(l));
  check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'console clean');
} finally {
  await browser.close();
}

for (const r of results) console.log(`${r.pass ? '✓' : '✗'} ${r.name}: ${r.detail}`);
process.exit(results.every(r => r.pass) ? 0 : 1);
