/**
 * Tests for @zeno/cache
 *
 * Implements a highly comprehensive and extensive test suite validating LRU order
 * promotion, passive/active TTL expiration sweeps, telemetry metrics,
 * TTL overwrites, resource sanitization, and heavy stress operations.
 */

import { assertEquals, assertExists, assertFalse } from "@std/assert";
import { LruCache } from "../../cache/lru.ts";
import { InMemoryCacheStore } from "../../cache/mod.ts";

Deno.test("LruCache - basic capacity eviction", () => {
  const lru = new LruCache<string, number>(3);

  lru.set("k1", 1);
  lru.set("k2", 2);
  lru.set("k3", 3);
  assertEquals(lru.size, 3);

  // Inserting 4th item should evict oldest (k1)
  const evicted = lru.set("k4", 4);
  assertEquals(evicted, "k1");
  assertEquals(lru.size, 3);
  assertEquals(lru.get("k1"), undefined);
  assertExists(lru.get("k2"));
  assertExists(lru.get("k3"));
  assertExists(lru.get("k4"));
});

Deno.test("LruCache - access promotion logic", () => {
  const lru = new LruCache<string, number>(3);

  lru.set("k1", 1);
  lru.set("k2", 2);
  lru.set("k3", 3);

  // Access k1, making it most recently used
  lru.get("k1");

  // Insert k4, which should now evict k2 instead of k1!
  const evicted = lru.set("k4", 4);
  assertEquals(evicted, "k2");
  assertEquals(lru.get("k2"), undefined);
  assertExists(lru.get("k1"));
  assertExists(lru.get("k3"));
  assertExists(lru.get("k4"));
});

Deno.test("InMemoryCacheStore - basic CRUD & clear operations", async () => {
  const cache = new InMemoryCacheStore<string>({ maxSize: 10, sweepInterval: 0 });

  try {
    await cache.set("k1", "v1");
    await cache.set("k2", "v2");

    assertEquals(await cache.size(), 2);
    assertEquals(await cache.get("k1"), "v1");

    const deleted = await cache.delete("k1");
    assertEquals(deleted, true);
    assertEquals(await cache.size(), 1);
    assertEquals(await cache.get("k1"), null);

    const deletedNonExistent = await cache.delete("nonexistent");
    assertEquals(deletedNonExistent, false);

    await cache.clear();
    assertEquals(await cache.size(), 0);
  } finally {
    cache.close();
  }
});

Deno.test("InMemoryCacheStore - lazy TTL expiration", async () => {
  const cache = new InMemoryCacheStore<string>({ maxSize: 10, sweepInterval: 0 });

  try {
    await cache.set("k1", "v1", 15); // 15ms TTL
    assertEquals(await cache.get("k1"), "v1");

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Should return null (lazy expiration)
    assertEquals(await cache.get("k1"), null);

    // Check misses count
    const stats = await cache.stats();
    assertEquals(stats.hits, 1);
    assertEquals(stats.misses, 1);
  } finally {
    cache.close();
  }
});

Deno.test("InMemoryCacheStore - active background sweep cleanup", async () => {
  // Config background sweep every 10ms
  const cache = new InMemoryCacheStore<string>({ maxSize: 10, sweepInterval: 10 });

  try {
    await cache.set("k1", "v1", 15);
    await cache.set("k2", "v2", 15);
    await cache.set("k3", "v3"); // persistent

    // Verify initial state
    const initialStats = await cache.stats();
    assertEquals(initialStats.size, 3);

    // Wait for TTL + sweep timer execution
    await new Promise((resolve) => setTimeout(resolve, 35));

    // Active sweep should have cleaned up k1 and k2 in the background.
    // stats() returns current size, which is evaluated against active items.
    const stats = await cache.stats();
    assertEquals(stats.size, 1); // Only k3 remains

    assertEquals(await cache.get("k1"), null);
    assertEquals(await cache.get("k2"), null);
    assertEquals(await cache.get("k3"), "v3");
  } finally {
    cache.close();
  }
});

Deno.test("InMemoryCacheStore - telemetry stats accuracy", async () => {
  const cache = new InMemoryCacheStore<number>({ maxSize: 2, sweepInterval: 0 });

  try {
    await cache.set("k1", 1);
    await cache.set("k2", 2);

    await cache.get("k1"); // Hit
    await cache.get("k2"); // Hit
    await cache.get("k3"); // Miss

    // Trigger eviction
    await cache.set("k4", 4); // Evicts k1 (since k2 was accessed most recently)

    await cache.get("k1"); // Miss (evicted)

    const stats = await cache.stats();
    assertEquals(stats.hits, 2);
    assertEquals(stats.misses, 2);
    assertEquals(stats.evictions, 1);
    assertEquals(stats.size, 2);
  } finally {
    cache.close();
  }
});

Deno.test("InMemoryCacheStore - TTL rollover and overwrite", async () => {
  const cache = new InMemoryCacheStore<string>({ maxSize: 10, sweepInterval: 0 });

  try {
    // 1. Overwrite existing TTL with a longer TTL
    await cache.set("k1", "v1", 20); // 20ms TTL
    await cache.set("k1", "v1-updated", 100); // Overwrite to 100ms TTL

    await new Promise((resolve) => setTimeout(resolve, 40));
    // Should still exist because TTL was extended!
    assertEquals(await cache.get("k1"), "v1-updated");

    // 2. Overwrite TTL with a persistent state (no TTL)
    await cache.set("k1", "v1-persistent"); // No TTL

    await new Promise((resolve) => setTimeout(resolve, 100));
    // Should still exist indefinitely
    assertEquals(await cache.get("k1"), "v1-persistent");
  } finally {
    cache.close();
  }
});

Deno.test("InMemoryCacheStore - resource management (timer clearing sanitization)", () => {
  const cache = new InMemoryCacheStore<string>({ maxSize: 10, sweepInterval: 10 });
  cache.close(); // Verify no resource leak errors occur under Deno test runner
});

Deno.test("InMemoryCacheStore - heavy stress and capacity operations", async () => {
  const cache = new InMemoryCacheStore<number>({ maxSize: 100, sweepInterval: 0 });

  try {
    // Insert 1000 items in a size-100 cache
    for (let i = 0; i < 1000; i++) {
      await cache.set(`key:${i}`, i);
    }

    assertEquals(await cache.size(), 100);

    const stats = await cache.stats();
    assertEquals(stats.evictions, 900);
    assertEquals(stats.size, 100);

    // Old keys (0 to 899) should be evicted
    assertEquals(await cache.get("key:0"), null);
    assertEquals(await cache.get("key:899"), null);

    // Recent keys (900 to 999) should still exist
    assertEquals(await cache.get("key:900"), 900);
    assertEquals(await cache.get("key:999"), 999);
  } finally {
    cache.close();
  }
});
