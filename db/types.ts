export interface DbOptions {
  /** Directory path to save segment files */
  dataDir: string;
  /** Maximum size in bytes of a single segment before rolling over (Default: 10MB) */
  maxSegmentSize?: number;
  /** Force sync files to disk on write (Default: false) */
  syncOnWrite?: boolean;
}

export interface KeyDirEntry {
  fileId: number;      // Segment file ID (e.g. 1 for segment.00000001.db)
  offset: number;      // Absolute byte offset in segment file where record starts
  size: number;        // Total record size in bytes (including CRC and lengths)
  timestamp: bigint;   // Epoch timestamp in milliseconds
}

export interface BitcaskRecord {
  crc: number;         // 32-bit polynomial CRC calculated over the rest of the record
  timestamp: bigint;   // Epoch timestamp in milliseconds
  type: number;        // 1 = Set, 0 = Delete (Tombstone)
  key: string;         // Lookup key
  value: Uint8Array;   // Binary payload
}
