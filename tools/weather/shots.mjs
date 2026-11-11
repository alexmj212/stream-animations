#!/usr/bin/env node
/**
 * Mock frames of the Exo-Cast weather page, for design review and AJ's
 * gallery: one PNG per page (demo data, pinned clock), plus each ad.
 * Repeated by hand on #164, #169 and the Exo-Cast notes (2026-11-11), so it
 * is a script now (repeat-routines).
 *
 *   npm run weather:shots -- [--out=dir] [--pages=current,ad] [--ads] [--query=extra]
 *
 * --ads shoots every text ad (one break each). Starts its own Vite server.
 */
import { startServer, launchBrowser } from '../lib/browser.js';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../src/config/config.js';
import { ADS } from '../../src/weather/ads.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
}));
const out = args.out || 'tools/motion-results/weather-shots';
const pages = args.pages ? String(args.pages).split(',') : config.weather.pages;
const extra = args.query ? `&${args.query}` : '';
fs.mkdirSync(out, { recursive: true });

const { server, baseUrl } = await startServer();
const base = `${baseUrl}/src/weather/index.html?data=demo&music=0&at=2026-11-10T19:00:00Z`;
const { browser } = await launchBrowser();
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const shoot = async (name, query, waitMs = 2500) => {
    await page.goto(`${base}&${query}${extra}`);
    await new Promise((r) => setTimeout(r, waitMs));
    const file = path.join(out, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(file);
};
for (const p of pages) await shoot(p, `page=${p}&pagems=60000`, p === 'radar' ? 6000 : 2500);
if (args.ads) {
    // Break n shows ad n: run the pages "ad" alone, one page per break
    for (let k = 0; k < ADS.length; k++) await shoot(`ad-${k}`, `pages=ad&pagems=2000`, 2000 * k + 1000);
}
await browser.close();
await server.close();
