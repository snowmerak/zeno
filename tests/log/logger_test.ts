/**
 * Tests for @zeno/log
 *
 * Validates JSON formatting, Logrus-style chaining immutability,
 * size-based file rotation rollover, backup limits, and concurrent writing safety.
 */

import { assertEquals, assertExists, assertFalse } from "@std/assert";
import { Logger, LogLevel, LogWriter, FileRotationWriter } from "../../log/mod.ts";

/** Simple in-memory capturing writer for testing output formatting */
class MemoryWriter implements LogWriter {
  public records: any[] = [];

  async write(msg: string): Promise<void> {
    this.records.push(JSON.parse(msg));
  }
}

Deno.test("Logger - JSON formatting and LogLevel filtering", async () => {
  const writer = new MemoryWriter();
  const logger = new Logger({
    level: LogLevel.INFO,
    writers: [writer],
  });

  logger.debug("should not log");
  logger.info("info message");
  logger.warn("warning message");

  assertEquals(writer.records.length, 2);

  const [r1, r2] = writer.records;
  assertEquals(r1.level, LogLevel.INFO);
  assertEquals(r1.msg, "info message");
  assertExists(r1.time);

  assertEquals(r2.level, LogLevel.WARN);
  assertEquals(r2.msg, "warning message");
});

Deno.test("Logger - Logrus chaining and Entry immutability", async () => {
  const writer = new MemoryWriter();
  const logger = new Logger({
    level: LogLevel.DEBUG,
    writers: [writer],
  });

  const baseEntry = logger.withFields({ app: "zeno", env: "test" });
  const userEntry = baseEntry.withField("user", "snow");

  baseEntry.info("Base log");
  userEntry.warn("User log");

  assertEquals(writer.records.length, 2);
  const [r1, r2] = writer.records;

  // e1 (baseEntry) should only have app and env
  assertEquals(r1.app, "zeno");
  assertEquals(r1.env, "test");
  assertFalse("user" in r1);

  // e2 (userEntry) should have app, env, and user
  assertEquals(r2.app, "zeno");
  assertEquals(r2.env, "test");
  assertEquals(r2.user, "snow");
});

Deno.test("Logger - Error chaining with withError", async () => {
  const writer = new MemoryWriter();
  const logger = new Logger({
    writers: [writer],
  });

  const testError = new Error("connection failure");
  logger.withError(testError).error("Failed database operation");

  assertEquals(writer.records.length, 1);
  const record = writer.records[0];
  assertEquals(record.error, "connection failure");
  assertExists(record.stack);
});

Deno.test("FileRotationWriter - size-based rollover and backup limits", async () => {
  const filename = "./test_rotation.log";
  // Clean any previous test files
  const cleanFiles = async () => {
    for (const f of [filename, `${filename}.1`, `${filename}.2`, `${filename}.3`]) {
      try {
        await Deno.remove(f);
      } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) throw err;
      }
    }
  };
  await cleanFiles();

  // Create a writer with maxSize of 50 bytes and maxBackups of 2
  const writer = new FileRotationWriter({
    filename,
    maxSize: 50,
    maxBackups: 2,
  });

  try {
    // Write 4 messages. Each message will be around 25 bytes after TextEncoder + newline.
    // Writing 4 messages should trigger rotation twice.
    await writer.write("msg 1: 1234567890"); // ~20 bytes -> app.log
    await writer.write("msg 2: 1234567890"); // ~20 bytes -> app.log (size ~40 bytes)
    await writer.write("msg 3: 1234567890"); // ~20 bytes -> triggers rotation! app.log -> app.log.1. New active is app.log.
    await writer.write("msg 4: 1234567890"); // ~20 bytes -> app.log (size ~40 bytes)
    await writer.write("msg 5: 1234567890"); // ~20 bytes -> triggers rotation! app.log -> app.log.1, app.log.1 -> app.log.2. New active is app.log.

    await writer.close();

    // Verify files
    const activeStat = await Deno.stat(filename);
    assertExists(activeStat);

    const b1Stat = await Deno.stat(`${filename}.1`);
    assertExists(b1Stat);

    const b2Stat = await Deno.stat(`${filename}.2`);
    assertExists(b2Stat);

    // Backup 3 should NOT exist because maxBackups is 2
    let b3Exists = true;
    try {
      await Deno.stat(`${filename}.3`);
    } catch {
      b3Exists = false;
    }
    assertFalse(b3Exists);
  } finally {
    await cleanFiles();
  }
});

Deno.test("FileRotationWriter - concurrent safety / AsyncQueue stress test", async () => {
  const filename = "./test_concurrent.log";
  const cleanFiles = async () => {
    try {
      await Deno.remove(filename);
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) throw err;
    }
  };
  await cleanFiles();

  // maxSize set large enough to not rotate in this test
  const writer = new FileRotationWriter({
    filename,
    maxSize: 1024 * 1024,
  });

  try {
    // Dispatch 100 concurrent writes
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(writer.write(`concurrent log line: ${i}`));
    }
    await Promise.all(promises);

    await writer.close();

    // Read the file and verify we have exactly 100 lines
    const content = await Deno.readTextFile(filename);
    const lines = content.trim().split("\n").filter(Boolean);
    assertEquals(lines.length, 100);

    // Verify all indexes are present in the output
    const indexes = lines.map(line => {
      const parts = line.split("line: ");
      return parseInt(parts[1], 10);
    });
    indexes.sort((a, b) => a - b);
    assertEquals(indexes.length, 100);
    for (let i = 0; i < 100; i++) {
      assertEquals(indexes[i], i);
    }
  } finally {
    await cleanFiles();
  }
});
