/**
 * @zeno/cache - Main entry point
 *
 * Provides a lightweight, high-performance in-memory cache with LRU eviction
 * and TTL support.
 */

export { LruCache } from "./lru.ts";
export { InMemoryCacheStore } from "./store.ts";
export type { CacheStats, CacheStore, InMemoryCacheOptions } from "./types.ts";
