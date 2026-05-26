# @zeno/cache

Zero-dependency, high-performance in-memory cache library for Deno, with LRU eviction and TTL support.

## Features

- **Unified Interface (`CacheStore`)**: Designed with standard `get`, `set`, `delete`, `clear`, `size`, and `stats` APIs, enabling drop-in Redis cache store drivers in the future.
- **Native V8 Map Optimized LRU**:
  - Leverages JS native `Map` insertion-order contract to implement $O(1)$ Least Recently Used (LRU) eviction.
  - Access promotes item to the end (MRU) in $O(1)$ by deleting and re-inserting.
  - Eviction discards the first item in the map (`map.keys().next().value`) in $O(1)$ time complexity.
  - Avoids doubly-linked list node creations, minimizing GC overhead.
- **Passive + Active TTL Expiration**:
  - **Passive (Lazy)**: Expired keys are checked and deleted at access time on `get()`.
  - **Active (Sweep)**: Runs a periodic `setInterval` background sweeping task that actively removes expired items to prevent memory leak accumulation over idle keys.
- **Observability Telemetry**: Tracks hits, misses, evictions, and size metrics dynamically.
- **Resource Management**: Integrates a `close()` method to release standard sweep timers, ensuring zero leaks in test pipelines.

## Installation (when published)

```bash
deno add @zeno/cache
```

**Note**: Source currently lives under `cache/` inside the monorepo for monorepo dogfooding convenience. The public API surface is `@zeno/cache`.

## Basic Usage

```ts
import { InMemoryCacheStore } from "@zeno/cache";

// Create cache holding maximum 100 items, sweeping for expired keys every 10 seconds
const cache = new InMemoryCacheStore({
  maxSize: 100,
  sweepInterval: 10000, // Background sweep every 10s
});

// 1. Insert items with optional TTL (in milliseconds)
await cache.set("user:session:123", { id: 42, role: "admin" }, 60000); // 1 minute TTL
await cache.set("config:global", { debug: true });                     // Persistent (no TTL)

// 2. Retrieve items
const session = await cache.get("user:session:123");
console.log(session); // { id: 42, role: "admin" }

// 3. Telemetry stats
const stats = await cache.stats();
console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}, Evictions: ${stats.evictions}`);

// 4. Delete & Clear
await cache.delete("user:session:123");
await cache.clear();

// 5. Clean up background timers when done (crucial to prevent Deno resource leaks)
cache.close();
```

## TTL Overwrites and Rollover

You can dynamically overwrite existing items, which also rolls over their TTL:

```ts
await cache.set("key", "value", 100); // Expires in 100ms
await cache.set("key", "value-updated", 500); // Overwritten to expire in 500ms

await new Promise(r => setTimeout(r, 150));
console.log(await cache.get("key")); // "value-updated" (still active!)
```

---

## Limitations

- **Memory Constraints**: Being purely in-memory, the storage space is bound to the V8 heap limits of the running Deno process. For distributed systems or persistence, adapt this store to a Redis-based Store implementing the same `CacheStore` interface.

## Related

- **Authoritative design & decisions**: `../skills/cache/SKILL.md` (the "constitution")
- Part of the Zeno Deno library collection (dogfooding std + Web Standards)
