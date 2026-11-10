import { describe, it, expect } from 'vitest';
import { isWsl, wslHostIps, wsCandidates, localPath } from '../../tools/obs/host.js';

describe('obs host helpers', () => {
    it('detects WSL', () => {
        expect(isWsl({ platform: 'linux', env: { WSL_DISTRO_NAME: 'Ubuntu' } })).toBe(true);
        expect(isWsl({ platform: 'linux', env: {}, procVersion: 'Linux 6.6 microsoft-standard-WSL2' })).toBe(true);
        expect(isWsl({ platform: 'win32', env: {} })).toBe(false);
        expect(isWsl({ platform: 'linux', env: {}, procVersion: 'Linux 6.8 generic' })).toBe(false);
    });

    it('finds the Windows host from WSL', () => {
        const route = 'default via 172.29.48.1 dev eth0 proto kernel\n';
        expect(wslHostIps(route, 'nameserver 10.255.255.254\n')).toEqual(['172.29.48.1', '10.255.255.254']);
        expect(wslHostIps('', '# x\nnameserver 172.29.48.1\n')).toEqual(['172.29.48.1']);
    });

    it('tries localhost first, an explicit --url only', () => {
        expect(wsCandidates(undefined, ['172.29.48.1'])).toEqual(['ws://127.0.0.1:4455', 'ws://172.29.48.1:4455']);
        expect(wsCandidates('ws://h:1', ['x'])).toEqual(['ws://h:1']);
    });

    it('maps Windows paths into /mnt under WSL', () => {
        expect(localPath('C:\\Users\\Alex\\AppData\\Roaming', true)).toBe('/mnt/c/Users/Alex/AppData/Roaming');
        expect(localPath('C:\\Users\\Alex', false)).toBe('C:\\Users\\Alex');
    });
});
