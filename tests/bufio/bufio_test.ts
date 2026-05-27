import { assertEquals, assertExists } from "@std/assert";
import { BufReader } from "../../bufio/reader.ts";
import { BufWriter } from "../../bufio/writer.ts";
import { Reader, Writer } from "../../bufio/types.ts";

class MockReader implements Reader {
  private offset = 0;
  constructor(private data: Uint8Array) {}

  async read(p: Uint8Array): Promise<number | null> {
    if (this.offset >= this.data.length) {
      return null; // EOF
    }
    const toRead = Math.min(p.length, this.data.length - this.offset);
    p.set(this.data.subarray(this.offset, this.offset + toRead));
    this.offset += toRead;
    return toRead;
  }
}

class MockWriter implements Writer {
  public bytes: number[] = [];

  async write(p: Uint8Array): Promise<number> {
    for (const b of p) {
      this.bytes.push(b);
    }
    return p.length;
  }
}

// --- BufReader Tests ---

Deno.test("BufReader - basic reading and single bytes", async () => {
  const data = new TextEncoder().encode("Hello World");
  const mock = new MockReader(data);
  const reader = new BufReader(mock, 4); // Small 4B buffer

  const b1 = await reader.readByte();
  assertEquals(b1, 72); // 'H'

  const p = new Uint8Array(5);
  const n = await reader.read(p);
  assertEquals(n, 5);
  assertEquals(new TextDecoder().decode(p), "ello ");

  const remaining = new Uint8Array(10);
  const n2 = await reader.read(remaining);
  assertEquals(n2, 5);
  assertEquals(new TextDecoder().decode(remaining.subarray(0, 5)), "World");

  // EOF
  assertEquals(await reader.read(p), null);
  assertEquals(await reader.readByte(), null);
});

Deno.test("BufReader - readLine with CR/LF stripping", async () => {
  const data = new TextEncoder().encode("Line1\nLine2\r\nLine3");
  const mock = new MockReader(data);
  const reader = new BufReader(mock, 64);

  const r1 = await reader.readLine();
  assertExists(r1);
  assertEquals(new TextDecoder().decode(r1.line), "Line1");
  assertEquals(r1.more, false);

  const r2 = await reader.readLine();
  assertExists(r2);
  assertEquals(new TextDecoder().decode(r2.line), "Line2");
  assertEquals(r2.more, false);

  const r3 = await reader.readLine();
  assertExists(r3);
  assertEquals(new TextDecoder().decode(r3.line), "Line3");
  assertEquals(r3.more, false);

  // EOF
  assertEquals(await reader.readLine(), null);
});

Deno.test("BufReader - readLine buffer overflow splits", async () => {
  const data = new TextEncoder().encode("ThisIsALongLineExceedingLimit\n");
  const mock = new MockReader(data);
  const reader = new BufReader(mock, 8); // Very small 8B buffer

  // Read part 1
  const r1 = await reader.readLine();
  assertExists(r1);
  assertEquals(new TextDecoder().decode(r1.line), "ThisIsAL");
  assertEquals(r1.more, true);

  // Read part 2
  const r2 = await reader.readLine();
  assertExists(r2);
  assertEquals(new TextDecoder().decode(r2.line), "ongLineE");
  assertEquals(r2.more, true);

  // Read part 3
  const r3 = await reader.readLine();
  assertExists(r3);
  assertEquals(new TextDecoder().decode(r3.line), "xceeding");
  assertEquals(r3.more, true);

  // Read part 4 (final, strips \n)
  const r4 = await reader.readLine();
  assertExists(r4);
  assertEquals(new TextDecoder().decode(r4.line), "Limit");
  assertEquals(r4.more, false);

  assertEquals(await reader.readLine(), null);
});

Deno.test("BufReader - readString delimiter lookups", async () => {
  const data = new TextEncoder().encode("apple,banana,orange");
  const mock = new MockReader(data);
  const reader = new BufReader(mock, 16);

  const s1 = await reader.readString(",");
  assertEquals(s1, "apple,");

  const s2 = await reader.readString(",");
  assertEquals(s2, "banana,");

  const s3 = await reader.readString(",");
  assertEquals(s3, "orange"); // Trailing without delimiter

  assertEquals(await reader.readString(","), null);
});

// --- BufWriter Tests ---

Deno.test("BufWriter - buffering, rollover, and flushes", async () => {
  const mock = new MockWriter();
  const writer = new BufWriter(mock, 8); // Small 8B buffer

  // Writes must be cached in memory
  await writer.write(new Uint8Array([1, 2, 3]));
  assertEquals(writer.getBufferedLength(), 3);
  assertEquals(mock.bytes.length, 0); // Not flushed yet

  // Write exceeding space (3 + 6 = 9 > 8) flushes buffer first
  await writer.write(new Uint8Array([4, 5, 6, 7, 8, 9]));
  assertEquals(mock.bytes.length, 3); // Stale 3 bytes flushed
  assertEquals(writer.getBufferedLength(), 6); // New 6 bytes buffered

  // Write string
  await writer.writeString("AB"); // 6 + 2 = 8 (full buffer)
  assertEquals(writer.getBufferedLength(), 8);
  assertEquals(mock.bytes.length, 3);

  // Write single byte triggers rollover flush (8 + 1 = 9 > 8)
  await writer.writeByte(99);
  assertEquals(mock.bytes.length, 11); // Old 8 bytes flushed
  assertEquals(writer.getBufferedLength(), 1); // 1 byte (99) buffered

  // Manual flush
  await writer.flush();
  assertEquals(mock.bytes.length, 12);
  assertEquals(writer.getBufferedLength(), 0);

  assertEquals(mock.bytes, [1, 2, 3, 4, 5, 6, 7, 8, 9, 65, 66, 99]);
});

Deno.test("BufWriter - large writes bypass buffer copies", async () => {
  const mock = new MockWriter();
  const writer = new BufWriter(mock, 4); // Small 4B buffer

  const largeData = new Uint8Array([10, 20, 30, 40, 50, 60]);
  await writer.write(largeData);

  // Directly bypassed buffer and wrote everything to mock writer immediately!
  assertEquals(writer.getBufferedLength(), 0);
  assertEquals(mock.bytes.length, 6);
  assertEquals(mock.bytes, [10, 20, 30, 40, 50, 60]);
});

Deno.test("BufReader - invalid buffer size throws RangeError", () => {
  const mock = new MockReader(new Uint8Array(0));
  try {
    new BufReader(mock, 0);
    throw new Error("Expected failure");
  } catch (e) {
    assertEquals(e instanceof RangeError, true);
  }
  try {
    new BufReader(mock, -5);
    throw new Error("Expected failure");
  } catch (e) {
    assertEquals(e instanceof RangeError, true);
  }
});

Deno.test("BufReader - empty reader and EOF behaviors", async () => {
  const mock = new MockReader(new Uint8Array(0));
  const reader = new BufReader(mock, 16);

  const p = new Uint8Array(5);
  const n = await reader.read(p);
  assertEquals(n, null);

  const b = await reader.readByte();
  assertEquals(b, null);

  const l = await reader.readLine();
  assertEquals(l, null);
});

Deno.test("BufReader - propagation of underlying reader errors", async () => {
  class ErrorReader implements Reader {
    async read(_p: Uint8Array): Promise<number | null> {
      throw new Error("Underlying read failure");
    }
  }

  const mock = new ErrorReader();
  const reader = new BufReader(mock, 16);

  try {
    await reader.readByte();
    throw new Error("Expected error");
  } catch (e) {
    assertEquals((e as Error).message, "Underlying read failure");
  }

  // Error is cached/propagated persistently on subsequent reads
  try {
    const p = new Uint8Array(5);
    await reader.read(p);
    throw new Error("Expected cached error");
  } catch (e) {
    assertEquals((e as Error).message, "Underlying read failure");
  }
});

Deno.test("BufWriter - invalid buffer size throws RangeError", () => {
  const mock = new MockWriter();
  try {
    new BufWriter(mock, 0);
    throw new Error("Expected failure");
  } catch (e) {
    assertEquals(e instanceof RangeError, true);
  }
  try {
    new BufWriter(mock, -10);
    throw new Error("Expected failure");
  } catch (e) {
    assertEquals(e instanceof RangeError, true);
  }
});

Deno.test("BufWriter - propagates errors and throws on short writes", async () => {
  class ErrorWriter implements Writer {
    async write(_p: Uint8Array): Promise<number> {
      throw new Error("Underlying write failure");
    }
  }

  const mock = new ErrorWriter();
  const writer = new BufWriter(mock, 8);

  await writer.write(new Uint8Array([1, 2, 3]));
  try {
    await writer.flush();
    throw new Error("Expected error");
  } catch (e) {
    assertEquals((e as Error).message, "Underlying write failure");
  }

  // Write after error should persistently throw the error
  try {
    await writer.write(new Uint8Array([4]));
    throw new Error("Expected cached error");
  } catch (e) {
    assertEquals((e as Error).message, "Underlying write failure");
  }
});

Deno.test("BufWriter - throws on short writes (0 bytes)", async () => {
  class ZeroWriter implements Writer {
    async write(_p: Uint8Array): Promise<number> {
      return 0;
    }
  }

  const mock = new ZeroWriter();
  const writer = new BufWriter(mock, 8);

  await writer.write(new Uint8Array([1, 2, 3]));
  try {
    await writer.flush();
    throw new Error("Expected short write error");
  } catch (e) {
    assertEquals((e as Error).message, "Short write: underlying writer accepted 0 bytes");
  }
});

