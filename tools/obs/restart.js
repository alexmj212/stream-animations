#!/usr/bin/env node
/**
 * Safe OBS restart on Defiant (Windows). Refuses while anything is live,
 * backs up the scene collection, closes OBS cleanly (never a kill), waits for
 * obs64.exe to exit, relaunches it, starts the Replay Buffer and Vertical
 * Backtrack again, optionally runs the camera check, then lists new errors in
 * the OBS log. Prints a JSON summary. The flow is tools/obs/restart-flow.js.
 *
 * Only after AJ has OK'd the restart in words, and never while AJ is live.
 * Mix It Up and the docks reconnect on their own; checking them is a manual
 * step in the obs-restart skill (tools/obs/obs-restart-skill.md).
 *
 * Usage (from the repo on Defiant):
 *   set OBS_WS_PASSWORD=...            (never stored in the repo)
 *   npm run obs:restart -- --dry-run   checks only
 *   npm run obs:restart -- --camera    restart + camera check
 * Options: --url=ws://127.0.0.1:4455 --obs-dir="C:\Program Files\obs-studio"
 *          --shots=<dir> (default: the claude folder on the Desktop)
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ObsSocket, EVENTS } from '../../src/shared/obs.js';
import { restartObs } from './restart-flow.js';

const run = promisify(execFile);
const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
}));

const url = args.url || 'ws://127.0.0.1:4455';
const password = process.env.OBS_WS_PASSWORD || '';
const obsDir = args['obs-dir'] || 'C:\\Program Files\\obs-studio';
const appData = process.env.APPDATA || '';
const sceneFile = join(appData, 'obs-studio', 'basic', 'scenes', 'Archive_1.json');
const logDir = join(appData, 'obs-studio', 'logs');
const shotDir = args.shots || join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'claude');

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

async function connect() {
    const obs = new ObsSocket({ url, password, events: EVENTS.GENERAL });
    await obs.connect();
    obs.close = async () => obs.ws?.close();
    return obs;
}

async function isRunning() {
    const { stdout } = await run('tasklist', ['/FI', 'IMAGENAME eq obs64.exe', '/NH']);
    return /obs64\.exe/i.test(stdout);
}

async function logLines(sinceMs) {
    const files = await readdir(logDir);
    let newest = null;
    for (const f of files.filter(f => f.endsWith('.txt'))) {
        const s = await stat(join(logDir, f));
        if (!newest || s.mtimeMs > newest.mtimeMs) newest = { f, mtimeMs: s.mtimeMs, birth: s.birthtimeMs };
    }
    if (!newest || newest.birth < sinceMs - 5000) return ['(no OBS log created since the relaunch)'];
    return (await readFile(join(logDir, newest.f), 'utf8')).split(/\r?\n/);
}

const summary = await restartObs({
    connect,
    backup: async () => {
        const to = `${sceneFile}.bak-${stamp()}`;
        await copyFile(sceneFile, to);
        return to;
    },
    // taskkill without /F sends WM_CLOSE: the same as closing the window,
    // so OBS saves the scene collection and Aitum's config on the way out.
    closeObs: async () => { await run('taskkill', ['/IM', 'obs64.exe']); },
    isRunning,
    launchObs: async () => {
        const cwd = join(obsDir, 'bin', '64bit'); // OBS needs its own folder as cwd
        spawn(join(cwd, 'obs64.exe'), [], { cwd, detached: true, stdio: 'ignore' }).unref();
    },
    logLines,
    saveShot: async (name, dataUrl) => {
        await mkdir(shotDir, { recursive: true });
        const path = join(shotDir, `${name}-${stamp()}.png`);
        await writeFile(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
        return path;
    },
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    log: msg => console.error(msg)
}, { dryRun: !!args['dry-run'], cameraCheck: !!args.camera });

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
