import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LRUCache } from './cache.js';

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache(3); // Small size for testing
  });

  it('stores and retrieves values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns undefined for non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('tracks cache size', () => {
    expect(cache.size).toBe(0);

    cache.set('key1', 'value1');
    expect(cache.size).toBe(1);

    cache.set('key2', 'value2');
    expect(cache.size).toBe(2);
  });

  it('evicts oldest entry when exceeding maxSize', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // Should evict key1

    expect(cache.size).toBe(3);
    expect(cache.get('key1')).toBeUndefined(); // Oldest, evicted
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  it('moves accessed items to end (most recently used)', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // Access key1, moving it to end
    cache.get('key1');

    // Add key4, should evict key2 (now oldest)
    cache.set('key4', 'value4');

    expect(cache.get('key1')).toBe('value1'); // Accessed recently, kept
    expect(cache.get('key2')).toBeUndefined(); // Oldest, evicted
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  it('updates existing keys without increasing size', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    expect(cache.size).toBe(2);

    cache.set('key1', 'updated'); // Update existing key

    expect(cache.size).toBe(2); // Size unchanged
    expect(cache.get('key1')).toBe('updated');
  });

  it('updates access time on get', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    cache.set('key1', 'value1');

    // Fast forward time
    vi.setSystemTime(now + 30000); // 30 seconds later

    cache.get('key1'); // Should update access time

    // Fast forward more
    vi.setSystemTime(now + 70000); // 70 seconds from start (40 seconds from get)

    // Evict stale entries older than 50 seconds
    const evicted = cache.evictStale(50000);

    expect(evicted).toBe(0); // key1 was accessed 40 seconds ago, should not be evicted
    expect(cache.get('key1')).toBe('value1');

    vi.useRealTimers();
  });

  it('evicts stale entries based on access time', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    // Fast forward time past maxAge
    vi.setSystemTime(now + 70000); // 70 seconds later

    // Evict entries older than 60 seconds
    const evicted = cache.evictStale(60000);

    expect(evicted).toBe(2);
    expect(cache.size).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBeUndefined();

    vi.useRealTimers();
  });

  it('evicts only stale entries, keeps recent ones', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    cache.set('key1', 'value1');

    vi.setSystemTime(now + 30000); // 30 seconds later
    cache.set('key2', 'value2');

    vi.setSystemTime(now + 70000); // 70 seconds from start

    // Evict entries older than 60 seconds
    const evicted = cache.evictStale(60000);

    expect(evicted).toBe(1); // Only key1 evicted
    expect(cache.get('key1')).toBeUndefined(); // Older than 60s
    expect(cache.get('key2')).toBe('value2'); // Only 40s old

    vi.useRealTimers();
  });

  it('has() checks for key existence', () => {
    cache.set('key1', 'value1');

    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(false);
  });

  it('clear() removes all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    expect(cache.size).toBe(2);

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBeUndefined();
  });

  it('handles canvas objects (real use case)', () => {
    // Simulate offscreen canvas caching
    const canvas1 = { type: 'canvas', id: 1 };
    const canvas2 = { type: 'canvas', id: 2 };

    cache.set('bar_100_200_red', canvas1);
    cache.set('bar_150_250_blue', canvas2);

    expect(cache.get('bar_100_200_red')).toBe(canvas1);
    expect(cache.get('bar_150_250_blue')).toBe(canvas2);
  });

  it('defaults to maxSize of 50', () => {
    const defaultCache = new LRUCache();

    // Add 51 entries
    for (let i = 0; i < 51; i++) {
      defaultCache.set(`key${i}`, `value${i}`);
    }

    expect(defaultCache.size).toBe(50);
    expect(defaultCache.get('key0')).toBeUndefined(); // First entry evicted
    expect(defaultCache.get('key50')).toBe('value50'); // Last entry kept
  });
});
