/**
 * LRU Cache with time-based eviction for managing offscreen canvas cache
 *
 * Uses native Map which maintains insertion order for O(1) LRU operations.
 * Supports both size-based (LRU) and time-based (stale) eviction.
 *
 * Usage:
 *   const cache = new LRUCache(50); // Max 50 entries
 *
 *   cache.set('key', canvas);
 *   const cached = cache.get('key');
 *
 *   // Periodic cleanup (e.g., every 30 seconds)
 *   setInterval(() => cache.evictStale(60000), 30000);
 */

export class LRUCache {
  /**
   * @param {number} maxSize - Maximum number of cache entries (default: 50)
   */
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.accessTimes = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined if not found
   */
  get(key) {
    if (!this.cache.has(key)) return undefined;

    // Update access time
    this.accessTimes.set(key, Date.now());

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // Delete if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end (most recently used)
    this.cache.set(key, value);
    this.accessTimes.set(key, Date.now());

    // Evict oldest if over size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.accessTimes.delete(firstKey);
    }
  }

  /**
   * Remove entries that haven't been accessed for maxAgeMs milliseconds
   * @param {number} maxAgeMs - Maximum age in milliseconds (default: 60000 = 60 seconds)
   * @returns {number} Number of entries evicted
   */
  evictStale(maxAgeMs = 60000) {
    const now = Date.now();
    let evicted = 0;

    for (const [key, accessTime] of this.accessTimes) {
      if (now - accessTime > maxAgeMs) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.accessTimes.clear();
  }

  /**
   * Get current cache size
   * @returns {number} Number of entries in cache
   */
  get size() {
    return this.cache.size;
  }
}
