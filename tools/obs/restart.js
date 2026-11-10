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
 * Runs from native Windows or from WSL (Defiant's Node lives in WSL; see
 * tools/obs/host.js).
 *
 * Usage (from the repo on Defiant):
 *   (password: OBS_WS_PASSWORD, else read from obs-websocket's config.json)
 *   npm run obs:restart -- --dry-run   checks only
 *   npm run obs:restart -- --camera    restart + camera check
 * From WSL it reaches OBS through Windows Python + obsws_python
 * (tools/obs/obs-bridge.py); --url connects directly instead.
 * Options: --url=ws://127.0.0.1:4455 --python=<windows python command>
 *          --obs-dir="C:\Program Files\obs-studio"
 *          --shots=<dir> (default: the claude folder on the Desktop)
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { join, posix, win32 } from 'node:path';
import { ObsSocket, EVENTS } from '../../src/shared/obs.js';
import { restartObs } from './restart-flow.js';
import { isWsl, wslHostIps, wsCandidates, localPath } from './host.js';
import { connectBridge } from './bridge.js';

if (typeof globalThis.WebSocket !== 'function') {
    console.error(`obs:restart needs Node 22 or newer (global WebSocket); this is ${process.version}.`);
    process.exit(2);
}

const run = promisify(execFile);
const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
}));

const read = p => readFile(p, 'utf8').catch(() => '');
const wsl = isWsl({ platform: process.platform, env: process.env, procVersion: await read('/proc/version') });
// Windows tools: under WSL they are reached through interop by their .exe name.
const exe = name => (wsl ? `${name}.exe` : name);
const winEnv = async name => {
    if (!wsl) return process.env[name] || '';
    const { stdout } = await run('cmd.exe', ['/c', `echo %${name}%`], { cwd: '/mnt/c' });
    return stdout.trim();
};
const P = wsl ? posix : win32;

const hostIps = wsl
    ? wslHostIps((await run('ip', ['route', 'show', 'default']).catch(() => ({ stdout: '' }))).stdout,
        await read('/etc/resolv.conf'))
    : [];
const urls = wsCandidates(args.url, hostIps);
const obsDir = args['obs-dir'] || 'C:\\Program Files\\obs-studio';
const appData = localPath(await winEnv('APPDATA'), wsl);
const sceneFile = P.join(appData, 'obs-studio', 'basic', 'scenes', 'Archive_1.json');
const logDir = P.join(appData, 'obs-studio', 'logs');
// The password: OBS_WS_PASSWORD, else obs-websocket's own config (the same
// source Defiant's obs-ops skill reads). Never printed.
const wsConfig = P.join(appData, 'obs-studio', 'plugin_config', 'obs-websocket', 'config.json');
const password = process.env.OBS_WS_PASSWORD ||
    (await read(wsConfig).then(t => JSON.parse(t).server_password).catch(() => '')) || '';
// From WSL, talk to OBS through Windows Python (tools/obs/obs-bridge.py)
// unless --url is given: WSL's NAT network can't reach it (2026-10-31).
const useBridge = wsl && !args.url;
const bridgeScript = useBridge
    ? (await run('wslpath', ['-w', new URL('./obs-bridge.py', import.meta.url).pathname])).stdout.trim()
    : '';
const shotDir = args.shots || P.join(localPath(await winEnv('USERPROFILE'), wsl), 'OneDrive', 'Desktop', 'claude');

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

let goodUrl = null;
async function connect() {
    if (useBridge) {
        const obs = await connectBridge({
            command: ['cmd.exe', '/c', args.python || 'python', bridgeScript, 'localhost', '4455'],
            password,
            spawnOptions: { cwd: '/mnt/c' }
        });
        goodUrl = 'bridge: Windows Python -> ws://localhost:4455';
        return obs;
    }
    let last;
    for (const url of goodUrl ? [goodUrl] : urls) {
        const obs = new ObsSocket({ url, password, events: EVENTS.GENERAL });
        try {
            await obs.connect();
        } catch (e) {
            last = new Error(`${url}: ${e.message}`);
            continue;
        }
        goodUrl = url;
        obs.close = async () => obs.ws?.close();
        return obs;
    }
    throw last;
}

async function isRunning() {
    const { stdout } = await run(exe('tasklist'), ['/FI', 'IMAGENAME eq obs64.exe', '/NH']);
    return /obs64\.exe/i.test(stdout);
}

async function logLines(sinceMs) {
    const files = await readdir(logDir);
    let newest = null;
    for (const f of files.filter(f => f.endsWith('.txt'))) {
        const s = await stat(P.join(logDir, f));
        if (!newest || s.mtimeMs > newest.mtimeMs) newest = { f, mtimeMs: s.mtimeMs };
    }
    // OBS names a log after its start time; birthtime isn't reliable on WSL's /mnt/c.
    if (!newest || newest.mtimeMs < sinceMs) return ['(no OBS log written since the relaunch)'];
    return (await readFile(P.join(logDir, newest.f), 'utf8')).split(/\r?\n/);
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
    closeObs: async () => { await run(exe('taskkill'), ['/IM', 'obs64.exe']); },
    isRunning,
    // Start-Process gives OBS its own folder as working directory (it needs
    // it) and returns at once, from Windows or from WSL alike.
    launchObs: async () => {
        const dir = win32.join(obsDir, 'bin', '64bit').replace(/'/g, "''");
        await run(exe('powershell'), ['-NoProfile', '-Command',
            `Start-Process -FilePath '${dir}\\obs64.exe' -WorkingDirectory '${dir}'`],
        wsl ? { cwd: '/mnt/c' } : {});
    },
    logLines,
    saveShot: async (name, dataUrl) => {
        await mkdir(shotDir, { recursive: true });
        const path = P.join(shotDir, `${name}-${stamp()}.png`);
        await writeFile(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
        return path;
    },
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    log: msg => console.error(msg)
}, { dryRun: !!args['dry-run'], cameraCheck: !!args.camera });

summary.runFrom = wsl ? 'wsl' : process.platform;
summary.url = goodUrl || urls;
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
