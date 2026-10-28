import { describe, it, expect, vi, afterEach } from 'vitest';
import { debugChannels, createDebug, DEBUG_CHANNELS, IDLE_GAP_MS } from '../../src/shared/debug.js';

afterEach(() => { delete window.__debug; });

describe('debugChannels', () => {
  it('is empty without ?debug or when turned off', () => {
    expect(debugChannels('').size).toBe(0);
    expect(debugChannels('?debug=0').size).toBe(0);
    expect(debugChannels('?debug=false').size).toBe(0);
  });

  it('turns everything on for 1, true and all', () => {
    for (const v of ['1', 'true', 'all']) expect([...debugChannels(`?debug=${v}`)]).toEqual(DEBUG_CHANNELS);
  });

  it('takes a comma list and drops unknown channels', () => {
    expect([...debugChannels('?debug=frames,nope,events')].sort()).toEqual(['events', 'frames']);
  });
});

describe('createDebug', () => {
  it('is a no-op that exposes nothing when off', () => {
    const d = createDebug('stinger', { search: '' });
    expect(d.enabled).toBe(false);
    d.mark('start');
    d.frame(16);
    expect(d.snapshot()).toBe(null);
    expect(window.__debug).toBeUndefined();
  });

  it('records events and exposes itself on window.__debug', () => {
    let t = 0;
    const d = createDebug('stinger', { search: '?debug=events', now: () => t });
    t = 5;
    d.mark('trigger', { source: 'obsSourceActiveChanged' });
    expect(window.__debug.stinger).toBe(d);
    const names = d.snapshot().events.map(e => e.name);
    expect(names).toEqual(['init', 'trigger']);
    expect(d.snapshot().events[1]).toEqual({ t: 5, name: 'trigger', data: { source: 'obsSourceActiveChanged' } });
  });

  it('counts frame times, long frames and idle gaps separately', () => {
    const d = createDebug('sidebar', { search: '?debug=frames', now: () => 0 });
    for (const ts of [0, 16, 33, 83, 100]) d.frame(ts); // one 50ms frame
    d.frame(100 + IDLE_GAP_MS + 1); // idle between plays, not a frame
    d.frame(100 + IDLE_GAP_MS + 17);
    const f = d.snapshot().frames;
    expect(f.count).toBe(5);
    expect(f.long).toBe(1);
    expect(f.maxMs).toBe(50);
    expect(f.gaps).toBe(1);
  });

  it('reports events to ?debugReport', () => {
    const send = vi.fn();
    const d = createDebug('shade', { search: '?debug=events&debugReport=http://127.0.0.1:9999/', now: () => 1, send });
    d.mark('end');
    expect(send).toHaveBeenCalledTimes(2); // init + end
    const body = JSON.parse(send.mock.calls[1][1]);
    expect(send.mock.calls[1][0]).toBe('http://127.0.0.1:9999/');
    expect(body).toMatchObject({ scene: 'shade', kind: 'event', name: 'end' });
  });
});
