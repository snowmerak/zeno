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
import { BufReader, BufWriter, Reader, Writer } from "../../bufio/mod.ts";
import { blake3, encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from "../../crypto/mod.ts";

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

// === 6. @zeno/bufio Benchmark Setup ===

class ChunkReader implements Reader {
  private offset = 0;
  constructor(private data: Uint8Array) {}
  async read(p: Uint8Array): Promise<number | null> {
    if (this.offset >= this.data.length) return null;
    const n = Math.min(p.length, this.data.length - this.offset);
    p.set(this.data.subarray(this.offset, this.offset + n));
    this.offset += n;
    return n;
  }
}

class ChunkWriter implements Writer {
  public bytes: number[] = [];
  async write(p: Uint8Array): Promise<number> {
    for (let i = 0; i < p.length; i++) {
      this.bytes.push(p[i]);
    }
    return p.length;
  }
}

const lineData = new TextEncoder().encode("line1\nline2\nline3\nline4\nline5\n".repeat(100));

Deno.bench("Bufio - BufReader readLine (500 lines)", async () => {
  const rd = new ChunkReader(lineData);
  const reader = new BufReader(rd, 1024);
  while (true) {
    const res = await reader.readLine();
    if (!res) break;
  }
});

Deno.bench("Bufio - BufWriter writeByte (1000 writes, buffered)", async () => {
  const wr = new ChunkWriter();
  const writer = new BufWriter(wr, 1024);
  for (let i = 0; i < 1000; i++) {
    await writer.writeByte(65);
  }
  await writer.flush();
});

Deno.bench("Bufio - Direct mock write (1000 writes, unbuffered)", async () => {
  const wr = new ChunkWriter();
  const single = new Uint8Array([65]);
  for (let i = 0; i < 1000; i++) {
    await wr.write(single);
  }
});

// === 7. @zeno/crypto Benchmark Setup ===
const cryptoKey = crypto.getRandomValues(new Uint8Array(32));
const cryptoPayload = new TextEncoder().encode("Hello, Zeno! Secure cryptography pipeline.");
const { ciphertext: cryptoCiphertext, nonce: cryptoNonce } = encryptXChaCha20Poly1305(cryptoPayload, cryptoKey);

Deno.bench("Crypto - BLAKE3 hash (32 bytes input)", () => {
  blake3(cryptoPayload);
});

Deno.bench("Crypto - XChaCha20-Poly1305 Encrypt", () => {
  encryptXChaCha20Poly1305(cryptoPayload, cryptoKey);
});

Deno.bench("Crypto - XChaCha20-Poly1305 Decrypt", () => {
  decryptXChaCha20Poly1305(cryptoCiphertext, cryptoKey, cryptoNonce);
});

