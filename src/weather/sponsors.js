// "This program is made possible by": the Exo-Cast sponsors page (AJ,
// 2026-11-12: "a 'sponsored by' screen that lists users that subscribed or
// sent bits"). AJ picked the names-only card, listing everyone subscribed
// now plus this month's bit cheerers. Pure data here, plus the source that
// reads Mix It Up; WeatherChannel.page_sponsors draws it.

/** Twitch logins are letters, digits and underscores, which the Star4000 atlas has. */
const LOGIN = /^[A-Za-z0-9_]{1,25}$/;

/**
 * Read a sponsor list from text: entries split by commas or semicolons,
 * each `name:kind:amount`, kind `sub` or `bits`. Bad entries are dropped; a
 * name seen twice keeps one row per kind with the amounts added.
 * @param {string} text
 * @returns {Array<{name: string, kind: 'sub'|'bits', amount: number}>}
 */
export function parseSponsors(text) {
    const byKey = new Map();
    for (const raw of String(text ?? '').split(/[,;]/)) {
        const [name, kind = 'sub', amt] = raw.trim().split(':');
        if (!LOGIN.test(name ?? '') || !['sub', 'bits'].includes(kind)) continue;
        const amount = Math.max(1, Math.floor(Number(amt)) || 1);
        const key = `${name.toLowerCase()}:${kind}`;
        const prev = byKey.get(key);
        if (prev) prev.amount += amount;
        else byKey.set(key, { name, kind, amount });
    }
    return [...byKey.values()];
}

/**
 * Sponsors in billing order: longest subs first, then the biggest cheers;
 * ties by name.
 * @param {Array<{name: string, kind: string, amount: number}>} list
 */
export function billingOrder(list) {
    return [...list].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

/**
 * Up to `rows` rows of a column, taking turns when there are more names than
 * rows: each turn starts where the last one stopped, and the last row says
 * how many more there are, so everyone gets airtime across the breaks.
 * @param {Array} list
 * @param {number} rows
 * @param {number} turn - Which showing this is (0, 1, ...)
 * @returns {{shown: Array, more: number}}
 */
export function rotateRows(list, rows, turn = 0) {
    if (list.length <= rows) return { shown: list, more: 0 };
    const per = rows - 1;
    const start = (Math.max(0, turn) * per) % list.length;
    const shown = Array.from({ length: per }, (_, k) => list[(start + k) % list.length]);
    return { shown, more: list.length - per };
}

/**
 * The name to show for a Mix It Up user: the display name when the atlas can
 * draw it, else the login, else null.
 * @param {Object} pd - UserPlatformData
 */
function showName(pd) {
    if (LOGIN.test(pd?.DisplayName ?? '')) return pd.DisplayName;
    if (LOGIN.test(pd?.Username ?? '')) return pd.Username;
    return null;
}

/** A user's Twitch platform data, whether MIU sends a map or a list. */
function twitchData(user) {
    const pd = user?.PlatformData;
    if (!pd) return null;
    if (Array.isArray(pd)) return pd.find((p) => String(p?.Platform).toLowerCase() === 'twitch') ?? null;
    return pd.Twitch ?? pd.twitch ?? Object.values(pd).find((p) => String(p?.Platform).toLowerCase() === 'twitch') ?? null;
}

/**
 * Sponsors from a page of Mix It Up Developer API users (GET /users): a
 * subscriber (tier above 0, or the Subscriber role) is a `sub` row whose
 * amount is the months since they subscribed; a positive balance of the bits
 * currency is a `bits` row. Users the atlas can't name are left out.
 * @param {Array<Object>} users
 * @param {string|null} bitsCurrencyId
 * @param {number} nowMs
 * @returns {Array<{name: string, kind: 'sub'|'bits', amount: number}>}
 */
export function sponsorsFromUsers(users, bitsCurrencyId, nowMs) {
    const out = [];
    for (const u of users ?? []) {
        const pd = twitchData(u);
        const name = showName(pd);
        if (!name) continue;
        const roles = Array.isArray(pd.Roles) ? pd.Roles.map((r) => String(r).toLowerCase()) : [];
        if (Number(pd.SubscriberTier) > 0 || roles.includes('subscriber')) {
            const since = Date.parse(pd.SubscribeDate ?? '');
            const months = Number.isFinite(since) ? Math.max(1, Math.floor((nowMs - since) / 2629800000) + 1) : 1;
            out.push({ name, kind: 'sub', amount: months });
        }
        const bits = bitsCurrencyId ? Number(u.CurrencyAmounts?.[bitsCurrencyId]) : 0;
        if (bits > 0) out.push({ name, kind: 'bits', amount: Math.floor(bits) });
    }
    return out;
}

/**
 * Where the sponsor names come from (mirrors src/followers/source.js):
 * - Mix It Up's Developer API (default): subscribers from GET /users, bits
 *   from a MIU currency the Bits Cheered command fills (anonymous cheers
 *   never reach it). Local, no tokens, so nothing secret reaches the public
 *   repo or the Pages URL. Refreshed at most every refreshMs, never while
 *   the page is hidden; a failure keeps the last list.
 * - A fixed list (?sponsors= or ?data=demo): no network.
 */
export class SponsorSource {
    /**
     * @param {Object} options
     * @param {Object} options.cfg - config.weather.sponsors
     * @param {string|null} [options.fixed] - A fixed list (parseSponsors text): no MIU
     * @param {() => number} options.now
     * @param {Object} [options.debug]
     * @param {Function} [options.fetch]
     */
    constructor({ cfg, fixed = null, now, debug = null, fetch: fetchImpl }) {
        this.cfg = cfg;
        this.now = now;
        this.debug = debug;
        this.fetch = fetchImpl ?? ((...a) => fetch(...a));
        this.fixed = fixed !== null;
        this.list = fixed !== null ? billingOrder(parseSponsors(fixed)) : [];
        this.lastTry = -Infinity;
        this.busy = null;
    }

    /** Subscribers, longest first. */
    get subs() {
        return this.list.filter((s) => s.kind === 'sub');
    }

    /** Bit cheerers, biggest first. */
    get bits() {
        return this.list.filter((s) => s.kind === 'bits');
    }

    get empty() {
        return this.list.length === 0;
    }

    async getJson(path) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), this.cfg.timeoutMs);
        try {
            const res = await this.fetch(`${this.cfg.api}${path}`, { signal: ctl.signal, cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Fetch the list again if refreshMs has passed. Resolves when done;
     * never throws.
     * @returns {Promise<void>}
     */
    refresh() {
        if (this.fixed) return Promise.resolve();
        if (this.busy) return this.busy;
        if (this.now() - this.lastTry < this.cfg.refreshMs) return Promise.resolve();
        this.lastTry = this.now();
        this.busy = this.load().catch((e) => {
            this.debug?.mark('sponsors-error', { message: String(e?.message ?? e) });
        }).finally(() => {
            this.busy = null;
        });
        return this.busy;
    }

    async load() {
        const currencies = await this.getJson('currency').catch(() => []);
        const want = this.cfg.bitsCurrency.toLowerCase();
        const cur = (Array.isArray(currencies) ? currencies : []).find((c) => String(c?.Name).toLowerCase() === want);
        const users = [];
        const size = this.cfg.pageSize;
        for (let skip = 0; skip < this.cfg.maxUsers; skip += size) {
            const page = await this.getJson(`users?skip=${skip}&pageSize=${size}`);
            const batch = page?.Users ?? [];
            users.push(...batch);
            if (batch.length < size || users.length >= (page?.TotalCount ?? Infinity)) break;
        }
        this.list = billingOrder(sponsorsFromUsers(users, cur?.ID ?? null, this.now()));
        this.debug?.mark('sponsors', { users: users.length, subs: this.subs.length, bits: this.bits.length, currency: !!cur });
    }
}

/** Made-up sponsors for mocks and the harness (?data=demo). */
export const DEMO_SPONSORS = 'couchgoober:sub:14,SphealOfApproval:bits:500,lechonk_lover:sub:5,'
    + 'NutBucketNick:sub:3,joan_decorates:bits:100,PupPilot:sub:1,bearhug_brad:sub:7,'
    + 'clippy_fan_98:bits:250,HornyJailWarden:sub:1,exo_cast_viewer:sub:22,'
    + 'radarlover:bits:1000,velvetcouch:sub:2';
