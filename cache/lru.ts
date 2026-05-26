/**
 * LRU Cache implementation for @zeno/cache
 *
 * Implements a lightweight, extremely fast O(1) Least Recently Used (LRU)
 * cache by leveraging the native JavaScript Map insertion-order guarantee.
 */

export class LruCache<K = string, V = unknown> {
  private _map = new Map<K, V>();

  constructor(private _maxSize: number) {
    if (_maxSize <= 0) {
      throw new Error("LruCache size must be greater than 0");
    }
  }

  get size(): number {
    return this._map.size;
  }

  /**
   * Retrieve an item from the cache.
   * Promotes the item to "most recently used" (end of Map) if found.
   */
  get(key: K): V | undefined {
    if (!this._map.has(key)) {
      return undefined;
    }
    const val = this._map.get(key)!;
    // Move to end (most recently used)
    this._map.delete(key);
    this._map.set(key, val);
    return val;
  }

  /**
   * Insert or update an item.
   * If the cache size limit is reached, evicts the oldest item (first in Map).
   * Returns the evicted key if eviction occurred, otherwise null.
   */
  set(key: K, value: V): K | null {
    let evictedKey: K | null = null;

    if (this._map.has(key)) {
      this._map.delete(key);
    } else if (this._map.size >= this._maxSize) {
      // Evict the first key (oldest inserted / accessed)
      const oldestKey = this._map.keys().next().value;
      if (oldestKey !== undefined) {
        this._map.delete(oldestKey);
        evictedKey = oldestKey;
      }
    }

    this._map.set(key, value);
    return evictedKey;
  }

  /**
   * Remove an item from the cache.
   */
  delete(key: K): boolean {
    return this._map.delete(key);
  }

  /**
   * Clear all items.
   */
  clear(): void {
    this._map.clear();
  }

  /**
   * Return an iterator over keys.
   */
  keys(): IterableIterator<K> {
    return this._map.keys();
  }

  /**
   * Return an iterator over entries.
   */
  entries(): IterableIterator<[K, V]> {
    return this._map.entries();
  }
}
