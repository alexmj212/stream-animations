import { describe, it, expect, vi } from 'vitest';
import { parseSponsors, billingOrder, rotateRows, sponsorsFromUsers, SponsorSource, DEMO_SPONSORS } from '../../src/weather/sponsors.js';
import { WeatherChannel } from '../../src/weather/WeatherChannel.js';
import { GLYPHS } from '../../src/weather/pixelfont.js';
import { config } from '../../src/config/config.js';

describe('parseSponsors', () => {
    it('reads name:kind:amount entries, drops bad ones and adds up repeats', () => {
        const list = parseSponsors('a_b:sub:3, bad name:sub, x:gift:2, c:bits:100; c:bits:50,d');
        expect(list).toEqual([
            { name: 'a_b', kind: 'sub', amount: 3 },
            { name: 'c', kind: 'bits', amount: 150 },
            { name: 'd', kind: 'sub', amount: 1 }
        ]);
        expect(parseSponsors('')).toEqual([]);
        expect(parseSponsors(null)).toEqual([]);
    });

    it('only passes names the Star4000 atlas can draw', () => {
        for (const s of parseSponsors(DEMO_SPONSORS)) {
            for (const ch of s.name) expect(GLYPHS[ch], ch).toBeDefined();
        }
    });
});

describe('billingOrder', () => {
    it('bills the biggest first, ties by name', () => {
        const out = billingOrder([{ name: 'b', amount: 1 }, { name: 'a', amount: 1 }, { name: 'z', amount: 9 }]);
        expect(out.map((s) => s.name)).toEqual(['z', 'a', 'b']);
    });
});

describe('rotateRows', () => {
    const names = Array.from({ length: 8 }, (_, k) => k);
    it('shows a short list whole', () => {
        expect(rotateRows([1, 2], 6, 3)).toEqual({ shown: [1, 2], more: 0 });
    });
    it('takes turns through a long list, the last row counting the rest', () => {
        expect(rotateRows(names, 6, 0)).toEqual({ shown: [0, 1, 2, 3, 4], more: 3 });
        expect(rotateRows(names, 6, 1)).toEqual({ shown: [5, 6, 7, 0, 1], more: 3 });
    });
    it('bills everyone within a few turns', () => {
        const seen = new Set();
        for (let t = 0; t < 2; t++) rotateRows(names, 6, t).shown.forEach((n) => seen.add(n));
        expect(seen.size).toBe(names.length);
    });
});

describe('sponsorsFromUsers', () => {
    const now = Date.parse('2026-11-12T00:00:00Z');
    it('lists subscribers and bits from MIU users, map or list platform data', () => {
        const users = [
            { PlatformData: { Twitch: { Platform: 'Twitch', Username: 'subby', DisplayName: 'Subby', SubscriberTier: 1, SubscribeDate: '2026-08-20T00:00:00Z' } }, CurrencyAmounts: {} },
            { PlatformData: [{ Platform: 'Twitch', Username: 'roley', Roles: ['User', 'Subscriber'] }] },
            { PlatformData: { Twitch: { Platform: 'Twitch', Username: 'cheery', SubscriberTier: 0 } }, CurrencyAmounts: { cur1: 250, other: 9 } },
            { PlatformData: { Twitch: { Platform: 'Twitch', Username: 'lurker', SubscriberTier: 0 } }, CurrencyAmounts: { cur1: 0 } }
        ];
        expect(sponsorsFromUsers(users, 'cur1', now)).toEqual([
            { name: 'Subby', kind: 'sub', amount: 3 },
            { name: 'roley', kind: 'sub', amount: 1 },
            { name: 'cheery', kind: 'bits', amount: 250 }
        ]);
    });

    it('falls back to the login for a display name the atlas lacks, and skips the unnameable', () => {
        const users = [
            { PlatformData: { Twitch: { Username: 'kana_fan', DisplayName: 'かなファン', SubscriberTier: 1 } } },
            { PlatformData: { Twitch: { Username: '', DisplayName: '', SubscriberTier: 1 } } },
            {}
        ];
        expect(sponsorsFromUsers(users, null, now).map((s) => s.name)).toEqual(['kana_fan']);
    });
});

/** A fetch stand-in answering MIU's routes. */
function miu(users, currencies = [{ ID: 'c1', Name: 'Sponsor Bits' }]) {
    return vi.fn(async (url) => {
        const u = new URL(url);
        if (u.pathname.endsWith('/currency')) return { ok: true, json: async () => currencies };
        const skip = Number(u.searchParams.get('skip'));
        const size = Number(u.searchParams.get('pageSize'));
        return { ok: true, json: async () => ({ TotalCount: users.length, Users: users.slice(skip, skip + size) }) };
    });
}
const sub = (n) => ({ PlatformData: { Twitch: { Username: n, SubscriberTier: 1 } }, CurrencyAmounts: {} });

describe('SponsorSource', () => {
    const cfg = { ...config.weather.sponsors, pageSize: 2 };

    it('pages through MIU users and finds the bits currency by name', async () => {
        const users = [sub('a'), sub('b'), sub('c'), { PlatformData: { Twitch: { Username: 'd' } }, CurrencyAmounts: { c1: 100 } }];
        const fetch = miu(users);
        const src = new SponsorSource({ cfg, now: () => 0, fetch });
        await src.refresh();
        expect(src.subs.map((s) => s.name)).toEqual(['a', 'b', 'c']);
        expect(src.bits).toEqual([{ name: 'd', kind: 'bits', amount: 100 }]);
        expect(fetch.mock.calls[0][0]).toBe('http://localhost:8911/api/v2/currency');
        expect(fetch.mock.calls.filter(([u]) => u.includes('/users')).length).toBe(2);
    });

    it('asks MIU at most once per refreshMs, and keeps the last list on a failure', async () => {
        let t = 0;
        const fetch = miu([sub('a')]);
        const src = new SponsorSource({ cfg, now: () => t, fetch });
        await src.refresh();
        await src.refresh();
        expect(fetch.mock.calls.length).toBe(2);
        t = cfg.refreshMs;
        fetch.mockImplementation(async () => { throw new Error('MIU closed'); });
        await src.refresh();
        expect(src.subs.map((s) => s.name)).toEqual(['a']);
    });

    it('never fetches with a fixed list', async () => {
        const fetch = vi.fn();
        const src = new SponsorSource({ cfg, fixed: 'x:sub,y:bits:5', now: () => 0, fetch });
        await src.refresh();
        expect(fetch).not.toHaveBeenCalled();
        expect(src.empty).toBe(false);
        expect(new SponsorSource({ cfg, fixed: '', now: () => 0, fetch }).empty).toBe(true);
    });
});

describe('the sponsors page in the rotation', () => {
    const layout = (pages, sponsors, holdPage = false) => {
        const tv = { pages, holdPage, sponsors, schedule: [], scheduledRegions: 0, startRegion: 1, regions: [{}, {}, {}] };
        return Array.from({ length: pages.length * 2 }, (_, k) => WeatherChannel.prototype.slot.call(tv, k));
    };
    const pages = ['current', 'ad', 'sponsors', 'id'];

    it('bills sponsors after the ad when there are names', () => {
        const s = layout(pages, { empty: false });
        expect(s.slice(0, 4).map((x) => x.page)).toEqual(pages);
        expect(s.slice(0, 4).every((x) => x.regionIndex === 1)).toBe(true);
        expect(s[4].regionIndex).toBe(2);
    });

    it('leaves the page out, not empty, when there are none', () => {
        const s = layout(pages, { empty: true });
        expect(s.slice(0, 3).map((x) => x.page)).toEqual(['current', 'ad', 'id']);
        expect(s[3].regionIndex).toBe(2);
        expect(layout(pages, null).some((x) => x.page === 'sponsors')).toBe(false);
    });

    it('still shows a held sponsors page for mocks', () => {
        expect(layout(['sponsors'], { empty: true }, true)[0].page).toBe('sponsors');
    });

    it('is in the default rotation, right after an ad', () => {
        const p = config.weather.pages;
        p.forEach((name, k) => {
            if (name === 'sponsors') expect(p[k - 1]).toBe('ad');
        });
        expect(p).toContain('sponsors');
    });
});
