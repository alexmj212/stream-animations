/**
 * Where the script runs vs where OBS runs. On Defiant, Node only exists in
 * WSL (2026-10-31: the first dry run of #147 from WSL failed with 1006,
 * because 127.0.0.1 in WSL's NAT network isn't Windows, and `tasklist`
 * isn't on WSL's PATH under that name). These helpers find the Windows side
 * from inside WSL; on native Windows they are no-ops.
 */

/**
 * @param {{platform: string, env: Object, procVersion?: string}} p
 * @returns {boolean} true inside WSL
 */
export function isWsl({ platform, env, procVersion = '' }) {
    return platform === 'linux' && (!!env.WSL_DISTRO_NAME || /microsoft/i.test(procVersion));
}

/**
 * The Windows host's address as seen from WSL2 (NAT mode): the default
 * gateway, else the resolv.conf nameserver.
 * @param {string} ipRoute - output of `ip route show default`
 * @param {string} resolvConf - /etc/resolv.conf
 * @returns {string[]} candidate IPs, best first
 */
export function wslHostIps(ipRoute, resolvConf) {
    const ips = [];
    const gw = /default via (\d+\.\d+\.\d+\.\d+)/.exec(ipRoute);
    if (gw) ips.push(gw[1]);
    const ns = /^nameserver\s+(\d+\.\d+\.\d+\.\d+)/m.exec(resolvConf);
    if (ns && !ips.includes(ns[1])) ips.push(ns[1]);
    return ips;
}

/**
 * websocket URLs to try in order. 127.0.0.1 first (native Windows, or WSL
 * in mirrored networking mode), then the WSL host addresses.
 * @param {string|undefined} explicit - --url
 * @param {string[]} hostIps
 * @param {number} [port]
 * @returns {string[]}
 */
export function wsCandidates(explicit, hostIps, port = 4455) {
    if (explicit) return [explicit];
    return ['127.0.0.1', ...hostIps].map(h => `ws://${h}:${port}`);
}

/**
 * Turn a Windows path into the path this process can open.
 * @param {string} winPath - e.g. C:\Users\Alex\AppData\Roaming
 * @param {boolean} wsl
 * @returns {string}
 */
export function localPath(winPath, wsl) {
    if (!wsl) return winPath;
    const m = /^([A-Za-z]):[\\/](.*)$/.exec(winPath.trim());
    if (!m) return winPath;
    return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
}
