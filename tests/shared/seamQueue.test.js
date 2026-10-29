import { describe, it, expect } from 'vitest';
import { playOnSeam, seamHeld, SEAM_LOCK } from '../../src/shared/seamQueue.js';

/** A FIFO stand-in for navigator.locks with one named lock. */
function fakeLocks() {
    let tail = Promise.resolve();
    const names = [];
    return {
        names,
        request(name, cb) {
            names.push(name);
            const run = tail.then(() => cb());
            tail = run.catch(() => {});
            return run;
        }
    };
}

/** An alert that ends when the test says so. */
function alert(log, id) {
    let end;
    const play = () => new Promise(resolve => { log.push(`${id} start`); end = () => { log.push(`${id} end`); resolve(); }; });
    return { play, end: () => end() };
}

const tick = () => new Promise(r => setTimeout(r, 0));

describe('playOnSeam', () => {
    it('plays a second portrait alert only after the first ends (ALERT-1)', async () => {
        const locks = fakeLocks();
        const log = [];
        const toast = alert(log, 'toast');
        const sidebar = alert(log, 'sidebar');
        playOnSeam(true, toast.play, { locks, setTimer: () => {} });
        playOnSeam(true, sidebar.play, { locks, setTimer: () => {} });
        await tick();
        expect(log).toEqual(['toast start']);
        toast.end();
        await tick();
        expect(log).toEqual(['toast start', 'toast end', 'sidebar start']);
        expect(locks.names).toEqual([SEAM_LOCK, SEAM_LOCK]);
    });

    it('plays at once on 16:9, without taking the lock', async () => {
        const locks = fakeLocks();
        const log = [];
        playOnSeam(false, alert(log, 'a').play, { locks, setTimer: () => {} });
        playOnSeam(false, alert(log, 'b').play, { locks, setTimer: () => {} });
        await tick();
        expect(log).toEqual(['a start', 'b start']);
        expect(locks.names).toEqual([]);
    });

    it('plays at once where Web Locks are missing', async () => {
        const log = [];
        playOnSeam(true, alert(log, 'a').play, { locks: null, setTimer: () => {} });
        await tick();
        expect(log).toEqual(['a start']);
    });

    it('frees the seam after maxHoldMs if an alert never reports its end', async () => {
        const locks = fakeLocks();
        const log = [];
        const timers = [];
        playOnSeam(true, alert(log, 'stuck').play, { locks, maxHoldMs: 5000, setTimer: (fn, ms) => timers.push({ fn, ms }) });
        playOnSeam(true, alert(log, 'next').play, { locks, setTimer: () => {} });
        await tick();
        expect(log).toEqual(['stuck start']);
        expect(timers[0].ms).toBe(5000);
        timers[0].fn();
        await tick();
        expect(log).toEqual(['stuck start', 'next start']);
    });

    it('reports how long the alert waited', async () => {
        const locks = fakeLocks();
        let t = 0;
        const waits = [];
        const first = alert([], 'a');
        playOnSeam(true, first.play, { locks, now: () => t, onStart: w => waits.push(w), setTimer: () => {} });
        playOnSeam(true, alert([], 'b').play, { locks, now: () => t, onStart: w => waits.push(w), setTimer: () => {} });
        await tick();
        t = 4200;
        first.end();
        await tick();
        expect(waits).toEqual([0, 4200]);
    });
});

describe('seamHeld', () => {
    const locks = (names) => ({ query: async () => ({ held: names.map(name => ({ name })), pending: [] }) });

    it('is true while an alert holds the seam lock', async () => {
        expect(await seamHeld(locks([SEAM_LOCK]))).toBe(true);
        expect(await seamHeld(locks(['something-else']))).toBe(false);
        expect(await seamHeld(locks([]))).toBe(false);
    });

    it('is false without Web Locks, or when the query fails', async () => {
        expect(await seamHeld(null)).toBe(false);
        expect(await seamHeld({ query: async () => { throw new Error('nope'); } })).toBe(false);
    });
});
