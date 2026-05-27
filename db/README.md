# @zeno/db

Zero-dependency, high-performance in-process Log-Structured Key-Value Storage Engine for Deno, inspired by the Bitcask design.

## Features

- **Sequential Append-Only Writes**: Rapid data writes with zero disk seeks by writing records chronologically to segment logs.
- **$O(1)$ Read Complexity**: Fully populates an in-memory `KeyDir` index at startup, ensuring every value lookup performs exactly one disk seek and one read.
- **`@zeno/codec` Integration**: Dogfoods `@zeno/codec`'s binary marshaller and compact BigInt/Varint structures.
- **CRC32 Checksum Validation**: IEEE 802.3 polynomial table checksum verifies binary integrity on every read, catching disk corruption early.
- **Background Compaction (Compaction Merges)**: Automatic log compaction merges cold read-only segments to release space leaks from overwritten or deleted keys.
- **Crash Recovery**: Sequential startup scanners automatically detect and gracefully discard partial/corrupted records written during an active crash event.

## Installation (when published)

```bash
deno add @zeno/db
```

**Note**: Source currently lives under `db/` inside the monorepo for monorepo dogfooding convenience. The public API surface is `@zeno/db`.

## Basic Usage

```ts
import { BitcaskStore } from "@zeno/db";

// Open (or create) database store inside a target directory
const db = await BitcaskStore.open({
  dataDir: "./data",
  maxSegmentSize: 2 * 1024 * 1024, // 2MB segment rollover
  syncOnWrite: true,              // Flush OS file buffer to disk on set()
});

// 1. Insert values
await db.set("user:101", new TextEncoder().encode("Alice"));
await db.set("user:102", new TextEncoder().encode("Bob"));

// 2. Retrieve values
const data = await db.get("user:101");
if (data) {
  console.log("Found:", new TextDecoder().decode(data)); // "Alice"
}

// 3. Deletion (Appends tombstone, removes from in-memory index)
const deleted = await db.delete("user:102");
console.log("Deleted:", deleted); // true

// 4. Background Compaction
// Merges segment.00000000.db and all frozen deltas to release stale record space
await db.merge();

// 5. Safe Resource Sanitization
await db.close();
```

## Related

- **Authoritative design & decisions**: `../skills/db/SKILL.md` (the constitutional design specification)
- Part of the Zeno Deno library collection (dogfooding std + Web Standards)
