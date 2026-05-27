import { ByteBuffer } from "../codec/mod.ts";
import { marshalRecord, readRecord, unmarshalRecord } from "./record.ts";
import { BitcaskRecord, DbOptions, KeyDirEntry } from "./types.ts";

/**
 * Sequential promise queue to guarantee exclusive, thread-safe database operations.
 */
class AsyncQueue {
  private promise: Promise<void> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.promise.then(fn);
    this.promise = next.then(
      () => {},
      () => {},
    );
    return next;
  }
}

/**
 * BitcaskStore - High-performance in-process Log-Structured Key-Value Engine.
 * Employs sequential append-only writes, in-memory index directory lookup,
 * and background compaction sweeps.
 */
export class BitcaskStore {
  private dataDir: string;
  private maxSegmentSize: number;
  private syncOnWrite: boolean;

  private keyDir = new Map<string, KeyDirEntry>();
  private activeFile?: Deno.FsFile;
  private activeFileId = 1;
  private activeSize = 0;

  private readPool = new Map<number, Deno.FsFile>();
  private queue = new AsyncQueue();
  private closed = false;

  private constructor(options: DbOptions) {
    this.dataDir = options.dataDir;
    this.maxSegmentSize = options.maxSegmentSize ?? 10 * 1024 * 1024; // Default: 10MB
    this.syncOnWrite = options.syncOnWrite ?? false;
  }

  /**
   * Opens and recovers the Bitcask DB store at options.dataDir.
   */
  static async open(options: DbOptions): Promise<BitcaskStore> {
    await Deno.mkdir(options.dataDir, { recursive: true });
    const store = new BitcaskStore(options);
    await store.loadIndexAndActive();
    return store;
  }

  /**
   * Retrieves the raw byte payload associated with a key.
   * Returns null if key is not found or has been deleted.
   */
  async get(key: string): Promise<Uint8Array | null> {
    this.ensureNotClosed();
    const entry = this.keyDir.get(key);
    if (!entry) {
      return null;
    }

    let file = this.activeFile;
    if (entry.fileId !== this.activeFileId) {
      let cached = this.readPool.get(entry.fileId);
      if (!cached) {
        const path = this.getSegmentPath(entry.fileId);
        cached = await Deno.open(path, { read: true });
        this.readPool.set(entry.fileId, cached);
      }
      file = cached;
    }

    if (!file) {
      throw new Error(`Failed to resolve segment handle for file ID: ${entry.fileId}`);
    }

    // Seek to recorded offset
    await file.seek(entry.offset, Deno.SeekMode.Start);

    // Read full record size sequentially (handle fragmented reads)
    const bytes = new Uint8Array(entry.size);
    let totalRead = 0;
    while (totalRead < entry.size) {
      const n = await file.read(bytes.subarray(totalRead));
      if (n === null) {
        throw new Error(
          `Unexpected EOF while reading record of size ${entry.size} at offset ${entry.offset} in segment ${entry.fileId}`,
        );
      }
      totalRead += n;
    }

    const record = unmarshalRecord(bytes);
    if (record.type === 0) {
      return null; // Deleted tombstone
    }
    return record.value;
  }

  /**
   * Persists a key-value record to the append-only logs.
   */
  async set(key: string, value: Uint8Array): Promise<void> {
    this.ensureNotClosed();
    await this.queue.enqueue(async () => {
      this.ensureNotClosed();
      const timestamp = BigInt(Date.now());
      const recordBytes = marshalRecord(timestamp, 1, key, value);

      // Perform rollover if segment size limit is exceeded
      if (this.activeFile && this.activeSize + recordBytes.length > this.maxSegmentSize) {
        await this.rollover();
      }

      if (!this.activeFile) {
        const path = this.getSegmentPath(this.activeFileId);
        this.activeFile = await Deno.open(path, { read: true, write: true, create: true });
        this.activeSize = 0;
      }

      const writeOffset = this.activeSize;
      await this.activeFile.write(recordBytes);
      this.activeSize += recordBytes.length;

      if (this.syncOnWrite) {
        await this.activeFile.sync();
      }

      this.keyDir.set(key, {
        fileId: this.activeFileId,
        offset: writeOffset,
        size: recordBytes.length,
        timestamp,
      });
    });
  }

  /**
   * Appends a tombstone record marking the key as deleted.
   * Returns true if key existed and was deleted, false otherwise.
   */
  async delete(key: string): Promise<boolean> {
    this.ensureNotClosed();
    return await this.queue.enqueue(async () => {
      this.ensureNotClosed();
      if (!this.keyDir.has(key)) {
        return false;
      }

      const timestamp = BigInt(Date.now());
      const recordBytes = marshalRecord(timestamp, 0, key, new Uint8Array(0));

      if (this.activeFile && this.activeSize + recordBytes.length > this.maxSegmentSize) {
        await this.rollover();
      }

      if (!this.activeFile) {
        const path = this.getSegmentPath(this.activeFileId);
        this.activeFile = await Deno.open(path, { read: true, write: true, create: true });
        this.activeSize = 0;
      }

      await this.activeFile.write(recordBytes);
      this.activeSize += recordBytes.length;

      if (this.syncOnWrite) {
        await this.activeFile.sync();
      }

      this.keyDir.delete(key);
      return true;
    });
  }

  /**
   * Merges all cold, frozen segments (segment 0 and delta files up to activeId - 1)
   * into a consolidated segment.00000000.db base file, discarding stale/deleted keys.
   */
  async merge(): Promise<void> {
    this.ensureNotClosed();
    await this.queue.enqueue(async () => {
      this.ensureNotClosed();

      // Filter KeyDir entries that exist in cold segments
      const mergeCandidates: Array<{ key: string; entry: KeyDirEntry }> = [];
      for (const [key, entry] of this.keyDir.entries()) {
        if (entry.fileId < this.activeFileId) {
          mergeCandidates.push({ key, entry });
        }
      }

      if (mergeCandidates.length === 0) {
        return; // Nothing to compact
      }

      const mergeTempPath = `${this.dataDir}/segment.merge_temp.db`;
      const mergeFile = await Deno.open(mergeTempPath, {
        read: true,
        write: true,
        create: true,
        truncate: true,
      });

      const updates: Array<{ key: string; entry: KeyDirEntry }> = [];
      let mergedSize = 0;

      for (const { key, entry } of mergeCandidates) {
        let file = this.activeFile;
        if (entry.fileId !== this.activeFileId) {
          let cached = this.readPool.get(entry.fileId);
          if (!cached) {
            const path = this.getSegmentPath(entry.fileId);
            cached = await Deno.open(path, { read: true });
            this.readPool.set(entry.fileId, cached);
          }
          file = cached;
        }

        if (!file) continue;

        // Read cold record
        await file.seek(entry.offset, Deno.SeekMode.Start);
        const recordBytes = new Uint8Array(entry.size);
        let totalRead = 0;
        while (totalRead < entry.size) {
          const n = await file.read(recordBytes.subarray(totalRead));
          if (n === null) {
            throw new Error(`Unexpected EOF during merge read`);
          }
          totalRead += n;
        }

        // Append to merge segment
        await mergeFile.write(recordBytes);

        updates.push({
          key,
          entry: {
            fileId: 0, // Compacted segment ID is always 0
            offset: mergedSize,
            size: entry.size,
            timestamp: entry.timestamp,
          },
        });

        mergedSize += entry.size;
      }

      mergeFile.close();

      // Close and remove all compacted cold file handles
      for (const [fileId, handle] of this.readPool.entries()) {
        if (fileId < this.activeFileId) {
          handle.close();
          this.readPool.delete(fileId);
        }
      }

      // Delete all compacted cold segment files from disk (0 and all frozen IDs < activeFileId)
      for (let fileId = 0; fileId < this.activeFileId; fileId++) {
        const path = this.getSegmentPath(fileId);
        try {
          await Deno.remove(path);
        } catch (err) {
          if (!(err instanceof Deno.errors.NotFound)) {
            throw err;
          }
        }
      }

      // Rename temp file to final base segment
      const baseSegmentPath = this.getSegmentPath(0);
      await Deno.rename(mergeTempPath, baseSegmentPath);

      // Open new base segment and pool it
      const baseHandle = await Deno.open(baseSegmentPath, { read: true });
      this.readPool.set(0, baseHandle);

      // Atomically update KeyDir ensuring concurrent writes are preserved
      for (const update of updates) {
        const current = this.keyDir.get(update.key);
        if (current && current.fileId < this.activeFileId) {
          this.keyDir.set(update.key, update.entry);
        }
      }
    });
  }

  /**
   * Gracefully syncs and closes all open active and read-only file handlers.
   */
  async close(): Promise<void> {
    if (this.closed) return;
    await this.queue.enqueue(async () => {
      if (this.closed) return;
      if (this.activeFile) {
        await this.activeFile.sync();
        this.activeFile.close();
        this.activeFile = undefined;
      }
      for (const handle of this.readPool.values()) {
        handle.close();
      }
      this.readPool.clear();
      this.closed = true;
    });
  }

  /**
   * Internal routine sequentially parsing segment database logs chronologically.
   */
  private async loadIndexAndActive() {
    const segments: Array<{ fileId: number; name: string }> = [];
    for await (const entry of Deno.readDir(this.dataDir)) {
      if (entry.isFile && /^segment\.\d{8}\.db$/.test(entry.name)) {
        const parts = entry.name.split(".");
        const fileId = parseInt(parts[1], 10);
        segments.push({ fileId, name: entry.name });
      }
    }

    // Sort alphabetically to process chronologically
    segments.sort((a, b) => a.name.localeCompare(b.name));

    for (const segment of segments) {
      const path = `${this.dataDir}/${segment.name}`;
      const bytes = await Deno.readFile(path);
      const buf = ByteBuffer.from(bytes);

      while (buf.bytesRemaining() > 0) {
        const startPos = buf.getReadPosition();
        const parsed = readRecord(buf);
        if (!parsed) {
          break; // Partial EOF record encountered
        }
        const size = parsed.size;
        const record = parsed.record;

        if (record.type === 1) {
          this.keyDir.set(record.key, {
            fileId: segment.fileId,
            offset: startPos,
            size,
            timestamp: record.timestamp,
          });
        } else {
          this.keyDir.delete(record.key);
        }
      }
    }

    if (segments.length === 0) {
      this.activeFileId = 1;
      const path = this.getSegmentPath(this.activeFileId);
      this.activeFile = await Deno.open(path, { read: true, write: true, create: true });
      this.activeSize = 0;
    } else {
      const last = segments[segments.length - 1];
      this.activeFileId = last.fileId;
      const path = this.getSegmentPath(this.activeFileId);
      this.activeFile = await Deno.open(path, { read: true, write: true, create: true });
      const currentEnd = await this.activeFile.seek(0, Deno.SeekMode.End);
      this.activeSize = Number(currentEnd);

      // Open cold files read-only and cache them in readPool
      for (let i = 0; i < segments.length - 1; i++) {
        const coldSeg = segments[i];
        const coldPath = `${this.dataDir}/${coldSeg.name}`;
        const handle = await Deno.open(coldPath, { read: true });
        this.readPool.set(coldSeg.fileId, handle);
      }
    }
  }

  private async rollover() {
    if (this.activeFile) {
      await this.activeFile.sync();
      this.activeFile.close();
      this.activeFile = undefined;
    }

    // Cache old active segment as read-only in pool
    const frozenPath = this.getSegmentPath(this.activeFileId);
    const readHandle = await Deno.open(frozenPath, { read: true });
    this.readPool.set(this.activeFileId, readHandle);

    this.activeFileId++;
    const nextPath = this.getSegmentPath(this.activeFileId);
    this.activeFile = await Deno.open(nextPath, { read: true, write: true, create: true });
    this.activeSize = 0;
  }

  private getSegmentPath(fileId: number): string {
    return `${this.dataDir}/segment.${fileId.toString().padStart(8, "0")}.db`;
  }

  private ensureNotClosed() {
    if (this.closed) {
      throw new Error("BitcaskStore is closed");
    }
  }

  // Escape hatch for testing
  getKeys(): string[] {
    return Array.from(this.keyDir.keys());
  }

  getEntry(key: string): KeyDirEntry | undefined {
    return this.keyDir.get(key);
  }
}
