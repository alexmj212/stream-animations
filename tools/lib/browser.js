/**
 * Shared headless-browser plumbing for the tools/ scripts: find a Chrome
 * binary, boot Vite on the project root, launch puppeteer-core.
 */
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// CHROME_PATH wins; then common system installs; then the Playwright-managed
// Chromium that ships in Claude Code cloud containers.
export const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/opt/pw-browsers/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean);

export function findChrome() {
  const found = CHROME_CANDIDATES.find(p => existsSync(p));
  if (!found) {
    throw new Error(`No Chrome/Chromium found (set CHROME_PATH). Tried:\n  ${CHROME_CANDIDATES.join('\n  ')}`);
  }
  return found;
}

export async function startServer() {
  const server = await createServer({
    root: projectRoot,
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'warn'
  });
  await server.listen();
  const { port } = server.httpServer.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

export async function launchBrowser({ headed = false, width = 1920, height = 1080 } = {}) {
  const executablePath = findChrome();
  const browser = await puppeteer.launch({
    executablePath,
    headless: !headed,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--window-size=${width},${height}`
    ]
  });
  return { browser, executablePath };
}
