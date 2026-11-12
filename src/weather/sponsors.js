// "This program is made possible by": the Exo-Cast sponsors page (AJ,
// 2026-11-12: "a 'sponsored by' screen that lists users that subscribed or
// sent bits"). Pure data here; WeatherChannel.page_sponsors draws it.

/** Twitch logins are letters, digits and underscores, which the Star4000 atlas has. */
const LOGIN = /^[A-Za-z0-9_]{1,25}$/;

/**
 * Read a sponsor list from text: entries split by commas or semicolons,
 * each `name:kind:amount`, kind `sub` (amount = months), `gift` (subs gifted)
 * or `bits` (bits cheered). Bad entries are dropped; a name seen twice keeps
 * one row per kind with the amounts added.
 * @param {string} text
 * @returns {Array<{name: string, kind: 'sub'|'gift'|'bits', amount: number}>}
 */
export function parseSponsors(text) {
    const byKey = new Map();
    for (const raw of String(text ?? '').split(/[,;]/)) {
        const [name, kind = 'sub', amt] = raw.trim().split(':');
        if (!LOGIN.test(name ?? '') || !['sub', 'gift', 'bits'].includes(kind)) continue;
        const amount = Math.max(1, Math.floor(Number(amt)) || 1);
        const key = `${name.toLowerCase()}:${kind}`;
        const prev = byKey.get(key);
        if (prev) prev.amount += amount;
        else byKey.set(key, { name, kind, amount });
    }
    return [...byKey.values()];
}

/**
 * Sponsors in the order they're billed: subs and gifts first (most months or
 * gifts first), then bits (most first); ties by name.
 * @param {Array<{name: string, kind: string, amount: number}>} list
 */
export function billingOrder(list) {
    const rank = { gift: 0, sub: 0, bits: 1 };
    return [...list].sort((a, b) => rank[a.kind] - rank[b.kind]
        || b.amount - a.amount
        || a.name.localeCompare(b.name));
}

/**
 * What a sponsor row says after the name.
 * @param {{kind: string, amount: number}} s
 */
export function sponsorAmount(s) {
    if (s.kind === 'bits') return `${s.amount} BITS`;
    if (s.kind === 'gift') return `${s.amount} GIFT${s.amount === 1 ? '' : 'S'}`;
    return s.amount > 1 ? `${s.amount} MO SUB` : 'NEW SUB';
}

/**
 * Fit a list into a number of rows: when it runs over, the last row says
 * how many more there are.
 * @param {Array} list
 * @param {number} rows
 * @returns {{shown: Array, more: number}}
 */
export function fitRows(list, rows) {
    if (list.length <= rows) return { shown: list, more: 0 };
    return { shown: list.slice(0, rows - 1), more: list.length - (rows - 1) };
}

/** Made-up sponsors for mocks and the harness (?data=demo). */
export const DEMO_SPONSORS = 'couchgoober:sub:14,SphealOfApproval:bits:500,lechonk_lover:gift:5,'
    + 'NutBucketNick:sub:3,joan_decorates:bits:100,PupPilot:sub:1,bearhug_brad:sub:7,'
    + 'clippy_fan_98:bits:250,HornyJailWarden:gift:1,exo_cast_viewer:sub:22,'
    + 'radarlover:bits:1000,velvetcouch:sub:2';
