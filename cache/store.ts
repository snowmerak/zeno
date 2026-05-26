/**
 * InMemoryCacheStore implementation for @zeno/cache
 *
 * Implements CacheStore interface with lazy TTL expiration, proactive background
 * sweeping to prevent memory leaks, and rich statistics telemetry.
 */

import { LruCache } from "./lru.ts";
import type { CacheStats, CacheStore, InMemoryCacheOptions } from "./types.ts";

interface CacheItem<T> {
  value: T;
  expiresAt?: number; // epoch ms
}

export class InMemoryCacheStore<T = unknown> implements CacheStore<T> {
  private _lru: LruCache<string, CacheItem<T>>;
  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;
  private _sweepTimer?: number;

  constructor(options: InMemoryCacheOptions = {}) {
    const maxSize = options.maxSize ?? 1000;
    this._lru = new LruCache<string, CacheItem<T>>(maxSize);

    const sweepInterval = options.sweepInterval ?? 30000;
    if (sweepInterval > 0) {
      // Lazy binding for setInterval in standard Web/Deno context
      this._sweepTimer = setInterval(() => {
        this.sweep();
      }, sweepInterval) as unknown as number;
    }
  }

  async get(key: string): Promise<T | null> {
    const item = this._lru.get(key);

    if (!item) {
      this._misses++;
      return null;
    }

    // Lazy expiration check
    if (item.expiresAt !== undefined && Date.now() > item.expiresAt) {
      this._lru.delete(key);
      this._misses++;
      return null;
    }

    this._hits++;
    return item.value;
  }

  async set(key: string, value: T, ttlMs?: number): Promise<void> {
    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : undefined;
    const item: CacheItem<T> = { value, expiresAt };

    const evictedKey = this._lru.set(key, item);
    if (evictedKey !== null) {
      this._evictions++;
    }
  }

  async delete(key: string): Promise<boolean> {
    return this._lru.delete(key);
  }

  async clear(): Promise<void> {
    this._lru.clear();
  }

  async size(): Promise<number> {
    // Return active size (excluding expired items if they are currently residing in cache)
    this.sweep(); // Active sweep first to ensure accurate size
    return this._lru.size;
  }

  async stats(): Promise<CacheStats> {
    return {
      hits: this._hits,
      misses: this._misses,
      evictions: this._evictions,
      size: this._lru.size,
    };
  }

  /**
   * Proactive sweep of expired keys.
   * Walks through all cached items and removes any that have crossed their expiration time.
   */
  sweep(): void {
    const now = Date.now();
    for (const [key, item] of this._lru.entries()) {
      if (item.expiresAt !== undefined && now > item.expiresAt) {
        this._lru.delete(key);
      }
    }
  }

  /**
   * Closes the cache and clears active background sweep timers.
   * Crucial for Deno test resource sanitization.
   */
  close(): void {
    if (this._sweepTimer) {
      clearInterval(this._sweepTimer);
      this._sweepTimer = undefined;
    }
  }
}
