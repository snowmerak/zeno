/**
 * Codec types for @zeno/codec
 *
 * Defines raw byte stream reader/writer interfaces supporting both fixed-size
 * and variable-length encoding specifications.
 */

export interface BinaryWriter {
  /** Write 1 byte: 1 for true, 0 for false */
  writeBoolean(value: boolean): this;
  /** Write 1 signed byte (-128 to 127) */
  writeInt8(value: number): this;
  /** Write 1 unsigned byte (0 to 255) */
  writeUint8(value: number): this;
  /** Write 2 signed bytes (-32768 to 32767) */
  writeInt16(value: number, littleEndian?: boolean): this;
  /** Write 2 unsigned bytes (0 to 65535) */
  writeUint16(value: number, littleEndian?: boolean): this;
  /** Write 4 signed bytes (-2147483648 to 2147483647) */
  writeInt32(value: number, littleEndian?: boolean): this;
  /** Write 4 unsigned bytes (0 to 4294967295) */
  writeUint32(value: number, littleEndian?: boolean): this;
  /** Write 4 floating point bytes (IEEE 754) */
  writeFloat32(value: number, littleEndian?: boolean): this;
  /** Write 8 floating point bytes (IEEE 754) */
  writeFloat64(value: number, littleEndian?: boolean): this;
  /** Write a variable-length unsigned integer (Uvarint) */
  writeUvarint(value: number): this;
  /** Write a variable-length signed integer (Varint with ZigZag mapping) */
  writeVarint(value: number): this;
  /** Write 8 signed BigInt bytes */
  writeInt64(value: bigint, littleEndian?: boolean): this;
  /** Write 8 unsigned BigInt bytes */
  writeUint64(value: bigint, littleEndian?: boolean): this;
  /** Write a variable-length BigInt unsigned integer (Uvarint64) */
  writeUvarint64(value: bigint): this;
  /** Write a variable-length BigInt signed integer (Varint64 with ZigZag mapping) */
  writeVarint64(value: bigint): this;
  /** Write a variable-length UTF-8 string (prefixed with Uvarint length) */
  writeString(value: string): this;
  /** Write a raw byte array */
  writeBytes(value: Uint8Array): this;
  /** Return a copy of the active written bytes */
  bytes(): Uint8Array;
}

export interface BinaryReader {
  /** Read 1 byte as a boolean */
  readBoolean(): boolean;
  /** Read 1 signed byte */
  readInt8(): number;
  /** Read 1 unsigned byte */
  readUint8(): number;
  /** Read 2 signed bytes */
  readInt16(littleEndian?: boolean): number;
  /** Read 2 unsigned bytes */
  readUint16(littleEndian?: boolean): number;
  /** Read 4 signed bytes */
  readInt32(littleEndian?: boolean): number;
  /** Read 4 unsigned bytes */
  readUint32(littleEndian?: boolean): number;
  /** Read 4 floating point bytes */
  readFloat32(littleEndian?: boolean): number;
  /** Read 8 floating point bytes */
  readFloat64(littleEndian?: boolean): number;
  /** Read a variable-length unsigned integer */
  readUvarint(): number;
  /** Read a variable-length signed integer */
  readVarint(): number;
  /** Read 8 signed BigInt bytes */
  readInt64(littleEndian?: boolean): bigint;
  /** Read 8 unsigned BigInt bytes */
  readUint64(littleEndian?: boolean): bigint;
  /** Read a variable-length BigInt unsigned integer */
  readUvarint64(): bigint;
  /** Read a variable-length BigInt signed integer */
  readVarint64(): bigint;
  /** Read a variable-length UTF-8 string */
  readString(): string;
  /** Read a raw byte array of specific length */
  readBytes(length: number): Uint8Array;
  /** Return the number of bytes remaining in the reader buffer */
  bytesRemaining(): number;
}
