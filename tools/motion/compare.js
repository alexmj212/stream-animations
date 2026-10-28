#!/usr/bin/env node
/**
 * Side-by-side mock for design decisions: one row per keyframe, one column
 * per harness run, composited over a backdrop and labelled. Made because
 * every look change needs before/after frames for AJ, and they were being
 * stitched by hand each time (2026-10-28, palette thread).
 *
 * Usage (run the harness into separate folders first, see run.js --out):
 *   npm run motion -- stinger --seeds=1 --out=before
 *   npm run motion -- stinger --seeds=1 --out=after --params=scheme=illuminations
 *   npm run motion:compare -- --runs=before,after \
 *     --frames=stinger/seed-1/t00750.png,sidebar/seed-1/t02500.png \
 *     --out=/mnt/project-files/design-review/compare.png
 *
 * Options:
 *   --labels=Before,After    column titles (default: the run names)
 *   --bg=#1b1d22             backdrop under the transparent frames, or an image path
 *   --scale=0.5              size of each tile relative to the 1920x1080 frame
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from '../lib/browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const i = a.indexOf('=');
  return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));

const runs = String(flags.runs || '').split(',').filter(Boolean);
const frames = String(flags.frames || '').split(',').filter(Boolean);
if (!runs.length || !frames.length || !flags.out) {
  console.error('Usage: compare.js --runs=a,b --frames=scene/seed-1/t00750.png,... --out=file.png');
  process.exit(2);
}
const labels = flags.labels ? String(flags.labels).split(',') : runs;
const scale = Number(flags.scale || 0.5);
const bg = String(flags.bg || '#1b1d22');

const dataUrl = (path) => `data:image/${extname(path).slice(1) || 'png'};base64,${readFileSync(path).toString('base64')}`;
const tiles = frames.map(f => runs.map(r => {
  const p = resolve(__dirname, '..', `motion-results-${r}`, f);
  if (!existsSync(p)) throw new Error(`Missing ${p} - run the harness with --out=${r} first`);
  return dataUrl(p);
}));
const bgImage = existsSync(bg) ? dataUrl(bg) : null;

const W = Math.round(1920 * scale), H = Math.round(1080 * scale), PAD = 16, HEAD = 40, SIDE = 220;
const width = SIDE + runs.length * (W + PAD) + PAD;
const height = HEAD + frames.length * (H + PAD) + PAD;

const { browser } = await launchBrowser({ width, height });
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:#0d0e11"><canvas id="c" width="${width}" height="${height}"></canvas></body></html>`);
await page.evaluate(async ({ tiles, labels, frames, bg, bgImage, W, H, PAD, HEAD, SIDE }) => {
  const load = (src) => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; });
  const ctx = document.getElementById('c').getContext('2d');
  const back = bgImage ? await load(bgImage) : null;
  ctx.font = '600 22px sans-serif';
  ctx.fillStyle = '#e8e8ea';
  labels.forEach((l, c) => ctx.fillText(l, SIDE + c * (W + PAD), 28));
  for (let r = 0; r < tiles.length; r++) {
    const y = HEAD + r * (H + PAD);
    ctx.fillStyle = '#b8b9bf';
    ctx.font = '16px monospace';
    frames[r].split('/').forEach((part, i) => ctx.fillText(part, PAD, y + 24 + i * 22));
    for (let c = 0; c < tiles[r].length; c++) {
      const x = SIDE + c * (W + PAD);
      if (back) ctx.drawImage(back, x, y, W, H);
      else { ctx.fillStyle = bg; ctx.fillRect(x, y, W, H); }
      ctx.drawImage(await load(tiles[r][c]), x, y, W, H);
    }
  }
}, { tiles, labels, frames, bg, bgImage, W, H, PAD, HEAD, SIDE });
mkdirSync(dirname(resolve(String(flags.out))), { recursive: true });
await (await page.$('#c')).screenshot({ path: resolve(String(flags.out)) });
await browser.close();
console.log(`Wrote ${resolve(String(flags.out))}`);
