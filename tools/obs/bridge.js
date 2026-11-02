/**
 * An obs-websocket connection through Windows Python (tools/obs/obs-bridge.py),
 * for when tools/obs/restart.js runs in WSL and can't reach OBS directly
 * (Defiant, 2026-10-31: 1006 on 127.0.0.1 and on the WSL host address).
 * Same shape as ObsSocket for the restart flow: `call(type, data)` and `close()`.
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

/**
 * @param {Object} opts
 * @param {string[]} opts.command - e.g. ['cmd.exe', '/c', 'python', '<win path to obs-bridge.py>', 'localhost', '4455']
 * @param {string} opts.password - written to the bridge's stdin, never argv
 * @param {Object} [opts.spawnOptions]
 * @param {Function} [opts.spawnImpl] - for tests
 * @returns {Promise<{call: Function, close: Function}>}
 */
export function connectBridge({ command, password, spawnOptions = {}, spawnImpl = spawn }) {
    const child = spawnImpl(command[0], command.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], ...spawnOptions });
    const pending = new Map();
    let nextId = 1;
    let stderr = '';
    child.stderr?.on('data', d => { stderr += d; });

    const ready = new Promise((resolve, reject) => {
        pending.set(0, { resolve, reject });
        const fail = why => {
            for (const p of pending.values()) p.reject(new Error(`${why}${stderr ? `: ${stderr.trim().slice(-300)}` : ''}`));
            pending.clear();
        };
        child.on('error', e => fail(`bridge failed to start (${e.message})`));
        child.on('exit', code => fail(`bridge exited (${code})`));
    });

    createInterface({ input: child.stdout }).on('line', line => {
        let msg;
        try { msg = JSON.parse(line); } catch { return; }
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        if (msg.error !== undefined) p.reject(new Error(msg.error));
        else p.resolve(msg.data || {});
    });

    child.stdin.write(`${password}\n`);

    const conn = {
        call(type, data = {}) {
            const id = nextId++;
            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject });
                child.stdin.write(`${JSON.stringify({ id, type, data })}\n`);
            });
        },
        async close() {
            child.stdin.end();
        }
    };
    return ready.then(() => conn, e => { child.kill?.(); throw e; });
}
