/**
 * Caching types for @zeno/cache
 *
 * Defines unified interfaces for cache stores, telemetry metrics,
 * and configuration options.
 */

export interface CacheStats {
  /** Total number of successful cache hits */
  hits: number;
  /** Total number of cache misses */
  misses: number;
  /** Total number of evicted items due to size limits */
  evictions: number;
  /** Current number of active items in the cache */
  size: number;
}

export interface CacheStore<T = unknown> {
  /**
   * Retrieve an item from the cache.
   * Returns null if key is not found or has expired.
   */
  get(key: string): Promise<T | null>;

  /**
   * Insert or update an item in the cache, optionally specifying a TTL in milliseconds.
   */
  set(key: string, value: T, ttlMs?: number): Promise<void>;

  /**
   * Remove an item from the cache. Returns true if key existed and was deleted.
   */
  delete(key: string): Promise<boolean>;

  /**
   * Clear all items from the cache.
   */
  clear(): Promise<void>;

  /**
   * Return the current number of active items in the cache.
   */
  size(): Promise<number>;

  /**
   * Return current telemetry metrics.
   */
  stats(): Promise<CacheStats>;
}

export interface InMemoryCacheOptions {
  /** Maximum number of items allowed in the cache (default: 1000) */
  maxSize?: number;
  /** Background active TTL sweep interval in milliseconds (default: 30000, 0 to disable) */
  sweepInterval?: number;
}
