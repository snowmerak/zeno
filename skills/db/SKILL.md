# @zeno/db — Agent Skill

**Library**: `@zeno/db` (High-performance Log-Structured Key-Value Storage Engine for Deno, inspired by Bitcask)
**Status**: append-only logs, KeyDir offset tracking, crash recovery, and compaction merges complete (2026-05)
**Version of this skill**: 1.0.0 (Initial release)

---

## 1. Library Purpose

`@zeno/db` provides a robust, zero-dependency, in-process Key-Value storage engine. It is optimized for heavy write scenarios, utilizing sequential append-only writes, in-memory hash directory offset indexing (`KeyDir`), and our high-density `@zeno/codec` serialization substrate to persist structured records safely on disk.

---

## 2. API Architecture

### 2.1 Storage Options (`DbOptions`)
Configurations for segment logs and persistence flushes.
```ts
export interface DbOptions {
  dataDir: string;           // Target directory for segment files
  maxSegmentSize?: number;   // Maximum bytes per segment before rolling over
  syncOnWrite?: boolean;     // Call file.sync() on set/delete writes
}
```

### 2.2 Core BitcaskStore Operations (`engine.ts`)
The `BitcaskStore` class handles all CRUD, startup recovery, and compaction routines.

```ts
import { BitcaskStore } from "@zeno/db";

// 1. Open / Restore database
const db = await BitcaskStore.open({
  dataDir: "./data",
  maxSegmentSize: 5 * 1024 * 1024,
});

// 2. Set (Sequential Append)
await db.set("username", new TextEncoder().encode("zeno_user"));

// 3. Get (O(1) Memory Index + 1 Disk Seek)
const val = await db.get("username");

// 4. Delete (Appends Tombstone)
await db.delete("username");

// 5. Close (Sync and release file handles)
await db.close();
```

### 2.3 Compaction & Merges
Compaction runs sequentially inside the exclusive Promise write queue. It resolves space leaks by scanning all cold read-only segment files, writing only active/valid key-value entries to `segment.00000000.db`, and deleting the old delta files.

```ts
// Safely compact cold segments on disk
await db.merge();
```

---

## 3. Design Decisions & Trade-offs

1. **Mutex Write Synchronization**: Built a custom cross-platform in-memory async promise queue (`AsyncQueue`) inside `engine.ts` to sequence all writes and rollovers, eliminating unstable OS-level file locking dependencies.
2. **IEEE 802.3 CRC32 Checking**: Integrated a precomputed table-based CRC32 checker to verify binary data integrity on every single read, safely trapping bit flips or incomplete sector writes.
3. **Sequential Recovery**: Startup scanner sequentially parses `segment.*.db` files chronologically. If a partial record (underflow `RangeError`) is found at the end of the active file due to an abrupt crash, it is gracefully discarded to restore the last clean transaction state.
4. **Base Compactor ID**: Decided on `0` (`segment.00000000.db`) as the final compacted file identifier. Since alphabetical file sorting processes `0` first during chronological startup, the compacted records are loaded instantly at boot, followed by subsequent delta segments.
