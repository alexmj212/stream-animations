#!/usr/bin/env node
/**
 * Collector for `?debugReport=` (src/shared/debug.js). Scenes running in OBS,
 * or anywhere without devtools, POST their debug events here; each line is
 * appended to a JSONL file and echoed, so an agent can check triggers, timing
 * and long-run frame stats without watching the stream.
 *
 * Usage:
 *   npm run debug:collect                      # port 9777, tools/debug-results/
 *   npm run debug:collect -- --port=9777 --out=soak.jsonl
 *
 * Then point a browser source at e.g.
 *   .../stinger/index.html?debug=events,frames&debugReport=http://127.0.0.1:9777/
 *
 * Ctrl+C prints a summary per scene: event counts and the latest frame stats.
 */
import { createServer } from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const port = Number(flags.port || 9777);
const outDir = resolve(__dirname, '..', 'debug-results');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, flags.out || `debug-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);

const summary = new Map();

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') {
    res.writeHead(204);
    res.end();
    return;
  }
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    res.writeHead(204);
    res.end();
    let msg;
    try { msg = JSON.parse(body); } catch { return; }
    appendFileSync(outFile, JSON.stringify({ received: Date.now(), ...msg }) + '\n');
    const s = summary.get(msg.scene) || { events: {}, frames: null };
    if (msg.kind === 'event') s.events[msg.name] = (s.events[msg.name] || 0) + 1;
    if (msg.kind === 'frames') s.frames = msg.frames;
    summary.set(msg.scene, s);
    const detail = msg.kind === 'frames'
      ? `frames n=${msg.frames.count} mean=${msg.frames.meanMs.toFixed(1)}ms max=${msg.frames.maxMs.toFixed(1)}ms long=${msg.frames.long}`
      : `${msg.name} ${JSON.stringify(msg.data ?? {})}`;
    console.log(`${new Date(msg.wall).toISOString()} ${msg.scene} ${detail}`);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Collecting on http://127.0.0.1:${port}/ -> ${outFile}`);
});

process.on('SIGINT', () => {
  console.log('\nSummary');
  for (const [scene, s] of summary) console.log(`  ${scene}: ${JSON.stringify(s)}`);
  process.exit(0);
});
