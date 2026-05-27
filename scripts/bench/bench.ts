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
import { encodeUvarint, decodeUvarint, defineSchema } from "../../codec/mod.ts";
import { BitcaskStore } from "../../db/mod.ts";

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

// === 4. @zeno/codec Benchmark Setup ===
const valToEncode = 123456789;
const encodedVarint = encodeUvarint(valToEncode);

const schema = defineSchema({
  id: "uint32",
  name: "string",
  balance: "float64",
  vip: "boolean",
});
const obj = { id: 101, name: "Zeno Codec", balance: 99.9, vip: true };
const encodedSchema = schema.encode(obj);

Deno.bench("Codec - Varint encodeUvarint (32-bit)", () => {
  encodeUvarint(valToEncode);
});

Deno.bench("Codec - Varint decodeUvarint (32-bit)", () => {
  decodeUvarint(encodedVarint);
});

Deno.bench("Codec - SchemaCodec encode object", () => {
  schema.encode(obj);
});

Deno.bench("Codec - SchemaCodec decode object", () => {
  schema.decode(encodedSchema);
});

Deno.bench("Codec - JSON stringify comparison", () => {
  JSON.stringify(obj);
});

Deno.bench("Codec - JSON parse comparison", () => {
  JSON.parse('{"id":101,"name":"Zeno Codec","balance":99.9,"vip":true}');
});

// === 5. @zeno/db Benchmark Setup ===
const dbPath = "./test_db_bench";
try {
  await Deno.remove(dbPath, { recursive: true });
} catch (_) {}
const db = await BitcaskStore.open({ dataDir: dbPath, syncOnWrite: false });
await db.set("bench:key", new TextEncoder().encode("benchmark_value"));

Deno.bench("DB - BitcaskStore set() write", async () => {
  await db.set("bench:write_key", new TextEncoder().encode("value"));
});

Deno.bench("DB - BitcaskStore get() read", async () => {
  await db.get("bench:key");
});

Deno.bench("DB - Teardown / Close DB", async () => {
  await db.close();
  try {
    await Deno.remove(dbPath, { recursive: true });
  } catch (_) {}
});
