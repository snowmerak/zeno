# @zeno/cache — Agent Skill

**Library**: `@zeno/cache` (In-memory cache with LRU and TTL for Deno)
**Status**: Implementation complete (2026-05)
**Version of this skill**: 0.1.0 (initial specification)

---

## 1. Library Purpose

`@zeno/cache` is a **zero-dependency, high-performance in-memory cache library** for Deno. It features $O(1)$ Least Recently Used (LRU) eviction, dynamic Time-To-Live (TTL) expiration, proactive background sweep cleanup, and telemetry statistics.

### Core Values
* **Zero Dependencies**: Built strictly on native JS/TS and standard Web timers.
* **Unified Interface (`CacheStore`)**: Designed with standard `get`, `set`, `delete`, `clear` methods, allowing seamless drop-in Redis driver support in the future.
* **Native V8 Map Optimization**:
  * > [!TIP]
  * > Instead of implementing complex doubly-linked list nodes (which adds garbage collection overhead and code complexity), `@zeno/cache` leverages JavaScript's native `Map` insertion-order contract.
  * > Accessing an item re-inserts it in $O(1)$ to mark it as most recently used.
  * > Eviction deletes the oldest item via `map.keys().next().value` in $O(1)$ time complexity.
* **Passive + Active TTL Expiration**:
  * **Passive (Lazy)**: Expired keys are checked and deleted on `get()` access.
  * **Active (Sweep)**: Runs a periodic `setInterval` background sweeper that cleans up all expired items to prevent silent memory leaks under inactive read patterns.
  * **Resource Sanitization**: Provides `close()` to clear active timers, preventing Deno test runner leaks.

---

## 2. API Design & Specifications

### 2.1 Unified CacheStore Interface
```ts
export interface CacheStore<T = unknown> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  size(): Promise<number>;
  stats(): Promise<CacheStats>;
}
```

### 2.3 Usage Example
```ts
import { InMemoryCacheStore } from "@zeno/cache";

// Create cache holding maximum 100 items, sweeping for expired keys every 10 seconds
const cache = new InMemoryCacheStore({
  maxSize: 100,
  sweepInterval: 10000,
});

// Set keys with optional TTL (in milliseconds)
await cache.set("session:123", { userId: 42 }, 60000); // 1 minute TTL
await cache.set("config:global", { debug: true });     // Persistent (no TTL)

// Get keys
const session = await cache.get("session:123");
console.log(session); // { userId: 42 }

// Check statistics
const stats = await cache.stats();
console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}, Evictions: ${stats.evictions}`);

// Clean up timer when done (crucial in Deno tests)
cache.close();
```

---

## 3. Eviction & TTL rollover Mechanics

* **Eviction**:
  * Triggered when `cache.size >= maxSize` during `set()`.
  * The oldest inserted/accessed key is immediately evicted. `stats.evictions` increments.
* **Passive (Lazy) Expiration**:
  * Checked during `get(key)`. If `Date.now() > item.expiresAt`, the item is deleted, and it is counted as a `miss` instead of a `hit`.
* **Active (Sweep) Expiration**:
  * Sweeps the entire cache at every `sweepInterval` interval.
  * Ensures memory is cleaned up even if expired keys are never queried again.

---

## 4. Verification & Testing Strategy

Tests are under `tests/cache/cache_test.ts` and focus on:
1. **LRU Eviction correctness**: Inserting `N+1` items into a cache of size `N` and asserting that the oldest item is evicted, while accessing an item moves it to the most recently used state.
2. **Lazy and Active Expiration**: Asserting that expired keys are correctly returned as `null` after TTL, and background sweep timer successfully cleans up keys without client access.
3. **Telemetry Statistics**: Asserting that `hits`, `misses`, `evictions`, and `size` metrics are accurately tracked under various mutation sequences.
4. **Deno Timer Sanitization**: Ensuring `cache.close()` correctly releases background timers and prevents test leaks.
