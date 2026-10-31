import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { connectBridge } from '../../tools/obs/bridge.js';

const script = resolve('tools/obs/obs-bridge.py');
const fixtures = resolve('tests/obs/fixtures');
let python = null;
for (const p of ['python3', 'python']) {
    try { execFileSync(p, ['--version']); python = p; break; } catch { /* next */ }
}
const opts = password => ({
    command: [python, script, 'localhost', '4455'],
    password,
    spawnOptions: { env: { ...process.env, PYTHONPATH: fixtures } }
});

describe.skipIf(!python)('obs bridge (real obs-bridge.py, fake obsws_python)', () => {
    it('passes requests and answers through', async () => {
        const obs = await connectBridge(opts('pw'));
        expect(await obs.call('GetVersion')).toEqual({ echo: 'GetVersion', data: null });
        expect(await obs.call('SetCurrentProgramScene', { sceneName: 'BRB' }))
            .toEqual({ echo: 'SetCurrentProgramScene', data: { sceneName: 'BRB' } });
        await expect(obs.call('Boom')).rejects.toThrow(/Boom/);
        await obs.close();
    });

    it('rejects a bad password at connect', async () => {
        await expect(connectBridge(opts('nope'))).rejects.toThrow(/authentication failed/);
    });
});
