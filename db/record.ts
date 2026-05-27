import { ByteBuffer } from "../codec/mod.ts";
import { crc32 } from "./crc32.ts";
import { BitcaskRecord } from "./types.ts";

/**
 * Serializes a record into append-ready binary bytes.
 * Layout: [ CRC32: 4B ] [ Timestamp: Varint64 ] [ Type: Uint8 ] [ Key Length: Uvarint ] [ Value Length: Uvarint ] [ Key ] [ Value ]
 */
export function marshalRecord(
  timestamp: bigint,
  type: number,
  key: string,
  value: Uint8Array,
): Uint8Array {
  const buf = new ByteBuffer();
  buf.writeVarint64(timestamp);
  buf.writeUint8(type);

  const keyBytes = new TextEncoder().encode(key);
  buf.writeUvarint(keyBytes.length);
  buf.writeUvarint(value.length);
  buf.writeBytes(keyBytes);
  buf.writeBytes(value);

  const payload = buf.bytes();
  const sum = crc32(payload);

  const finalBuf = new ByteBuffer(4 + payload.length);
  finalBuf.writeUint32(sum);
  finalBuf.writeBytes(payload);

  return finalBuf.bytes();
}

/**
 * Deserializes raw binary bytes into a validated BitcaskRecord.
 * Verifies CRC32 integrity check and throws Error if data is corrupted.
 */
export function unmarshalRecord(data: Uint8Array): BitcaskRecord {
  if (data.length < 4) {
    throw new RangeError("Record too short: CRC header missing");
  }

  const reader = ByteBuffer.from(data);
  const expectedCrc = reader.readUint32();

  const payload = data.subarray(4);
  const actualCrc = crc32(payload);

  if (expectedCrc !== actualCrc) {
    throw new Error(
      `CRC integrity mismatch: expected 0x${expectedCrc.toString(16)}, got 0x${actualCrc.toString(16)}`,
    );
  }

  const timestamp = reader.readVarint64();
  const type = reader.readUint8();
  const keyLen = reader.readUvarint();
  const valLen = reader.readUvarint();

  const keyBytes = reader.readBytes(keyLen);
  const key = new TextDecoder().decode(keyBytes);
  const value = reader.readBytes(valLen);

  return {
    crc: expectedCrc,
    timestamp,
    type,
    key,
    value,
  };
}

/**
 * Sequential reader used for scanning segment files during startup or compaction.
 * Automatically recovers from unexpected EOFs by returning null.
 */
export function readRecord(buf: ByteBuffer): { record: BitcaskRecord; size: number } | null {
  const startPos = buf.getReadPosition();
  if (buf.bytesRemaining() < 4) {
    return null;
  }

  try {
    const expectedCrc = buf.readUint32();
    const payloadStart = buf.getReadPosition();

    const timestamp = buf.readVarint64();
    const type = buf.readUint8();
    const keyLen = buf.readUvarint();
    const valLen = buf.readUvarint();

    const keyBytes = buf.readBytes(keyLen);
    const key = new TextDecoder().decode(keyBytes);
    const value = buf.readBytes(valLen);
    const payloadEnd = buf.getReadPosition();

    const size = payloadEnd - startPos;
    const payload = buf.bytes().subarray(payloadStart, payloadEnd);
    const actualCrc = crc32(payload);

    if (expectedCrc !== actualCrc) {
      throw new Error(
        `CRC integrity mismatch: expected 0x${expectedCrc.toString(16)}, got 0x${actualCrc.toString(16)}`,
      );
    }

    return {
      record: {
        crc: expectedCrc,
        timestamp,
        type,
        key,
        value,
      },
      size,
    };
  } catch (err) {
    if (err instanceof RangeError) {
      // Revert read index and return null to signify incomplete stream end
      buf.seekRead(startPos);
      return null;
    }
    throw err;
  }
}
