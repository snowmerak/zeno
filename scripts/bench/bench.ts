/**
 * Microbenchmarks for Zeno libraries using native Deno.bench
 *
 * Measures:
 * 1. `@zeno/cache`: InMemoryCacheStore GET and SET throughput.
 * 2. `@zeno/log`: Structured logger Entry chaining and JSON serialization performance.
 * 3. `@zeno/http`: PathTrie path matching search speed compared to RegExp lookup.
 */

import { InMemoryCacheStore } from "../../cache/mod.ts";
import { Logger, LogLevel, LogWriter } from "../../log/mod.ts";
import { PathTrie } from "../../http/trie.ts";

// === 1. @zeno/cache Benchmark Setup ===
const cache = new InMemoryCacheStore<number>({ maxSize: 1000, sweepInterval: 0 });

Deno.bench("Cache - InMemoryCacheStore SET (1 item)", async () => {
  await cache.set("benchmark:key", 42);
});

Deno.bench("Cache - InMemoryCacheStore GET (1 item)", async () => {
  await cache.get("benchmark:key");
});

// === 2. @zeno/log Benchmark Setup ===
class SilentWriter implements LogWriter {
  async write(_msg: string): Promise<void> {}
}
const logger = new Logger({
  level: LogLevel.DEBUG,
  writers: [new SilentWriter()],
});

Deno.bench("Log - Logger fields chaining & JSON serialize", () => {
  logger.withFields({ app: "zeno", cluster: "prod-1", region: "us-east" })
        .withField("transaction_id", 10928)
        .info("Benchmarking structured logging performance");
});

// === 3. @zeno/http PathTrie vs RegExp Benchmark Setup ===
const trie = new PathTrie<string>();
trie.insert("/api/v1/users/:userId/profile", "profile_handler");

// Simple regex simulating path matching for comparison
const regexPattern = /^\/api\/v1\/users\/([^/]+)\/profile$/;

Deno.bench("HTTP - PathTrie search route (/api/v1/users/42/profile)", () => {
  trie.find("/api/v1/users/42/profile");
});

Deno.bench("HTTP - RegExp test & extract (/api/v1/users/42/profile)", () => {
  const match = "/api/v1/users/42/profile".match(regexPattern);
  if (match) {
    const _userId = match[1];
  }
});
