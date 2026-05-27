import { assertEquals, assertExists, assertThrows, assertRejects } from "@std/assert";
import { BitcaskStore } from "../../db/engine.ts";

// Helper to clean test directories
async function cleanupDir(dir: string) {
  try {
    await Deno.remove(dir, { recursive: true });
  } catch (_) {
    // Ignore if already deleted
  }
}

Deno.test("BitcaskStore - basic CRUD and persistence recovery", async () => {
  const dir = "./test_db_crud";
  await cleanupDir(dir);

  try {
    const db = await BitcaskStore.open({ dataDir: dir });
    await db.set("k1", new TextEncoder().encode("v1"));
    await db.set("k2", new TextEncoder().encode("v2"));

    const v1 = await db.get("k1");
    const v2 = await db.get("k2");
    assertExists(v1);
    assertExists(v2);
    assertEquals(new TextDecoder().decode(v1), "v1");
    assertEquals(new TextDecoder().decode(v2), "v2");

    await db.close();

    // Reopen and recover state
    const db2 = await BitcaskStore.open({ dataDir: dir });
    const recoveredV1 = await db2.get("k1");
    const recoveredV2 = await db2.get("k2");
    assertExists(recoveredV1);
    assertExists(recoveredV2);
    assertEquals(new TextDecoder().decode(recoveredV1), "v1");
    assertEquals(new TextDecoder().decode(recoveredV2), "v2");

    await db2.close();
  } finally {
    await cleanupDir(dir);
  }
});

Deno.test("BitcaskStore - active segment rollover", async () => {
  const dir = "./test_db_rollover";
  await cleanupDir(dir);

  try {
    // Set maxSegmentSize to 50 bytes to trigger immediate rollovers
    const db = await BitcaskStore.open({
      dataDir: dir,
      maxSegmentSize: 50,
    });

    // Write multiple keys. Each record will exceed 50 bytes when serialized, triggering rollovers
    await db.set("key1", new Uint8Array(20));
    await db.set("key2", new Uint8Array(20));
    await db.set("key3", new Uint8Array(20));

    // Verify keys exist across multiple segments
    const entry1 = db.getEntry("key1");
    const entry2 = db.getEntry("key2");
    const entry3 = db.getEntry("key3");

    assertExists(entry1);
    assertExists(entry2);
    assertExists(entry3);

    // Assert they are saved in separate segment file IDs
    assertEquals(entry1.fileId, 1);
    assertEquals(entry2.fileId, 2);
    assertEquals(entry3.fileId, 3);

    await db.close();

    // Recover from multiple segment files on disk
    const db2 = await BitcaskStore.open({
      dataDir: dir,
      maxSegmentSize: 50,
    });

    const v1 = await db2.get("key1");
    const v2 = await db2.get("key2");
    const v3 = await db2.get("key3");

    assertExists(v1);
    assertExists(v2);
    assertExists(v3);
    assertEquals(v1.length, 20);

    await db2.close();
  } finally {
    await cleanupDir(dir);
  }
});

Deno.test("BitcaskStore - tombstone deletion and recovery", async () => {
  const dir = "./test_db_delete";
  await cleanupDir(dir);

  try {
    const db = await BitcaskStore.open({ dataDir: dir });
    await db.set("temp", new TextEncoder().encode("val"));
    assertEquals(new TextDecoder().decode((await db.get("temp"))!), "val");

    // Delete temporary key
    const deleted = await db.delete("temp");
    assertEquals(deleted, true);
    assertEquals(await db.get("temp"), null);

    await db.close();

    // Reopen and ensure tombstone is recovered as deleted
    const db2 = await BitcaskStore.open({ dataDir: dir });
    assertEquals(await db2.get("temp"), null);

    // Try deleting non-existent key
    const deleteNonExistent = await db2.delete("missing");
    assertEquals(deleteNonExistent, false);

    await db2.close();
  } finally {
    await cleanupDir(dir);
  }
});

Deno.test("BitcaskStore - log compaction merge", async () => {
  const dir = "./test_db_merge";
  await cleanupDir(dir);

  try {
    const db = await BitcaskStore.open({
      dataDir: dir,
      maxSegmentSize: 30, // Trigger frequent rollovers
    });

    // Write keys (triggering multiple delta segments)
    await db.set("k1", new TextEncoder().encode("apple")); // fileId: 1
    await db.set("k2", new TextEncoder().encode("banana")); // fileId: 2
    await db.set("k1", new TextEncoder().encode("apricot")); // fileId: 3 (stale "apple")
    await db.set("k3", new TextEncoder().encode("cherry")); // fileId: 4
    await db.delete("k2"); // fileId: 5 (tombstone stale "banana")

    // Run merge compaction
    await db.merge();

    // Verify in-memory KeyDir points to base compacted segment 0
    const entry1 = db.getEntry("k1");
    const entry3 = db.getEntry("k3");
    const entry2 = db.getEntry("k2");

    assertExists(entry1);
    assertExists(entry3);
    assertEquals(entry2, undefined); // Deleted key completely pruned

    assertEquals(entry1.fileId, 0); // Redirected to compacted segment 0
    assertEquals(entry3.fileId, 0); // Redirected to compacted segment 0

    // Ensure values remain correct and retrievable from base segment
    assertEquals(new TextDecoder().decode((await db.get("k1"))!), "apricot");
    assertEquals(new TextDecoder().decode((await db.get("k3"))!), "cherry");

    await db.close();

    // Reopen from compacted disk state
    const db2 = await BitcaskStore.open({ dataDir: dir });
    assertEquals(new TextDecoder().decode((await db2.get("k1"))!), "apricot");
    assertEquals(new TextDecoder().decode((await db2.get("k3"))!), "cherry");
    assertEquals(await db2.get("k2"), null);

    await db2.close();
  } finally {
    await cleanupDir(dir);
  }
});

Deno.test("BitcaskStore - CRC32 checksum corruption detection", async () => {
  const dir = "./test_db_crc";
  await cleanupDir(dir);

  try {
    const db = await BitcaskStore.open({ dataDir: dir });
    await db.set("safe", new TextEncoder().encode("highly_secure_data"));
    await db.close();

    const segmentPath = `${dir}/segment.00000001.db`;

    // Reopen database successfully first
    const db2 = await BitcaskStore.open({ dataDir: dir });

    // Manually open active segment file on disk and corrupt a byte in the payload AFTER opening
    const bytes = await Deno.readFile(segmentPath);
    bytes[25] ^= 0xff;
    await Deno.writeFile(segmentPath, bytes);

    // Attempt reading corrupted data (must throw CRC mismatch asynchronously)
    await assertRejects(
      () => db2.get("safe"),
      Error,
      "CRC integrity mismatch",
    );

    await db2.close();
  } finally {
    await cleanupDir(dir);
  }
});
