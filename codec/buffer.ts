import { BinaryReader, BinaryWriter } from "./types.ts";
import { decodeUvarint, decodeVarint, encodeUvarint, encodeVarint, decodeUvarint64, decodeVarint64, encodeUvarint64, encodeVarint64 } from "./varint.ts";

/**
 * ByteBuffer implements both BinaryWriter and BinaryReader interfaces.
 * It manages an auto-growing internal Uint8Array buffer and uses DataView for
 * cross-platform endian-safe multi-byte encoding.
 */
export class ByteBuffer implements BinaryWriter, BinaryReader {
  private buf: Uint8Array;
  private view: DataView;
  private writePos = 0;
  private readPos = 0;

  constructor(initialCapacity = 64) {
    this.buf = new Uint8Array(initialCapacity);
    this.view = new DataView(this.buf.buffer);
  }

  private ensureCapacity(bytesNeeded: number) {
    const required = this.writePos + bytesNeeded;
    if (required <= this.buf.length) {
      return;
    }
    let newCap = this.buf.length || 64;
    while (newCap < required) {
      newCap *= 2;
    }
    const newBuf = new Uint8Array(newCap);
    newBuf.set(this.buf);
    this.buf = newBuf;
    this.view = new DataView(this.buf.buffer);
  }

  private ensureReadable(bytesNeeded: number) {
    if (this.readPos + bytesNeeded > this.writePos) {
      throw new RangeError(
        `Underflow: requested ${bytesNeeded} bytes, but only ${this.bytesRemaining()} available`,
      );
    }
  }

  // --- BinaryWriter Implementation ---

  writeBoolean(value: boolean): this {
    this.ensureCapacity(1);
    this.buf[this.writePos++] = value ? 1 : 0;
    return this;
  }

  writeInt8(value: number): this {
    this.ensureCapacity(1);
    this.view.setInt8(this.writePos++, value);
    return this;
  }

  writeUint8(value: number): this {
    this.ensureCapacity(1);
    this.buf[this.writePos++] = value & 0xff;
    return this;
  }

  writeInt16(value: number, littleEndian = false): this {
    this.ensureCapacity(2);
    this.view.setInt16(this.writePos, value, littleEndian);
    this.writePos += 2;
    return this;
  }

  writeUint16(value: number, littleEndian = false): this {
    this.ensureCapacity(2);
    this.view.setUint16(this.writePos, value, littleEndian);
    this.writePos += 2;
    return this;
  }

  writeInt32(value: number, littleEndian = false): this {
    this.ensureCapacity(4);
    this.view.setInt32(this.writePos, value, littleEndian);
    this.writePos += 4;
    return this;
  }

  writeUint32(value: number, littleEndian = false): this {
    this.ensureCapacity(4);
    this.view.setUint32(this.writePos, value, littleEndian);
    this.writePos += 4;
    return this;
  }

  writeFloat32(value: number, littleEndian = false): this {
    this.ensureCapacity(4);
    this.view.setFloat32(this.writePos, value, littleEndian);
    this.writePos += 4;
    return this;
  }

  writeFloat64(value: number, littleEndian = false): this {
    this.ensureCapacity(8);
    this.view.setFloat64(this.writePos, value, littleEndian);
    this.writePos += 8;
    return this;
  }

  writeUvarint(value: number): this {
    const encoded = encodeUvarint(value);
    this.writeBytes(encoded);
    return this;
  }

  writeVarint(value: number): this {
    const encoded = encodeVarint(value);
    this.writeBytes(encoded);
    return this;
  }

  writeInt64(value: bigint, littleEndian = false): this {
    this.ensureCapacity(8);
    this.view.setBigInt64(this.writePos, value, littleEndian);
    this.writePos += 8;
    return this;
  }

  writeUint64(value: bigint, littleEndian = false): this {
    this.ensureCapacity(8);
    this.view.setBigUint64(this.writePos, value, littleEndian);
    this.writePos += 8;
    return this;
  }

  writeUvarint64(value: bigint): this {
    const encoded = encodeUvarint64(value);
    this.writeBytes(encoded);
    return this;
  }

  writeVarint64(value: bigint): this {
    const encoded = encodeVarint64(value);
    this.writeBytes(encoded);
    return this;
  }

  writeString(value: string): this {
    const encoded = new TextEncoder().encode(value);
    this.writeUvarint(encoded.length);
    this.writeBytes(encoded);
    return this;
  }

  writeBytes(value: Uint8Array): this {
    this.ensureCapacity(value.length);
    this.buf.set(value, this.writePos);
    this.writePos += value.length;
    return this;
  }

  bytes(): Uint8Array {
    return this.buf.slice(0, this.writePos);
  }

  // --- BinaryReader Implementation ---

  readBoolean(): boolean {
    this.ensureReadable(1);
    return this.buf[this.readPos++] !== 0;
  }

  readInt8(): number {
    this.ensureReadable(1);
    return this.view.getInt8(this.readPos++);
  }

  readUint8(): number {
    this.ensureReadable(1);
    return this.buf[this.readPos++];
  }

  readInt16(littleEndian = false): number {
    this.ensureReadable(2);
    const val = this.view.getInt16(this.readPos, littleEndian);
    this.readPos += 2;
    return val;
  }

  readUint16(littleEndian = false): number {
    this.ensureReadable(2);
    const val = this.view.getUint16(this.readPos, littleEndian);
    this.readPos += 2;
    return val;
  }

  readInt32(littleEndian = false): number {
    this.ensureReadable(4);
    const val = this.view.getInt32(this.readPos, littleEndian);
    this.readPos += 4;
    return val;
  }

  readUint32(littleEndian = false): number {
    this.ensureReadable(4);
    const val = this.view.getUint32(this.readPos, littleEndian);
    this.readPos += 4;
    return val;
  }

  readFloat32(littleEndian = false): number {
    this.ensureReadable(4);
    const val = this.view.getFloat32(this.readPos, littleEndian);
    this.readPos += 4;
    return val;
  }

  readFloat64(littleEndian = false): number {
    this.ensureReadable(8);
    const val = this.view.getFloat64(this.readPos, littleEndian);
    this.readPos += 8;
    return val;
  }

  readUvarint(): number {
    const slice = this.buf.subarray(this.readPos, this.writePos);
    const [val, read] = decodeUvarint(slice);
    this.readPos += read;
    return val;
  }

  readVarint(): number {
    const slice = this.buf.subarray(this.readPos, this.writePos);
    const [val, read] = decodeVarint(slice);
    this.readPos += read;
    return val;
  }

  readInt64(littleEndian = false): bigint {
    this.ensureReadable(8);
    const val = this.view.getBigInt64(this.readPos, littleEndian);
    this.readPos += 8;
    return val;
  }

  readUint64(littleEndian = false): bigint {
    this.ensureReadable(8);
    const val = this.view.getBigUint64(this.readPos, littleEndian);
    this.readPos += 8;
    return val;
  }

  readUvarint64(): bigint {
    const slice = this.buf.subarray(this.readPos, this.writePos);
    const [val, read] = decodeUvarint64(slice);
    this.readPos += read;
    return val;
  }

  readVarint64(): bigint {
    const slice = this.buf.subarray(this.readPos, this.writePos);
    const [val, read] = decodeVarint64(slice);
    this.readPos += read;
    return val;
  }

  readString(): string {
    const len = this.readUvarint();
    const bytes = this.readBytes(len);
    return new TextDecoder().decode(bytes);
  }

  readBytes(length: number): Uint8Array {
    this.ensureReadable(length);
    const bytes = this.buf.slice(this.readPos, this.readPos + length);
    this.readPos += length;
    return bytes;
  }

  bytesRemaining(): number {
    return this.writePos - this.readPos;
  }

  // --- Utility Methods ---

  reset() {
    this.writePos = 0;
    this.readPos = 0;
  }

  clear() {
    this.reset();
  }

  getWritePosition(): number {
    return this.writePos;
  }

  getReadPosition(): number {
    return this.readPos;
  }

  seekRead(pos: number) {
    if (pos < 0 || pos > this.writePos) {
      throw new RangeError(`Seek read position ${pos} out of bounds [0, ${this.writePos}]`);
    }
    this.readPos = pos;
  }

  seekWrite(pos: number) {
    if (pos < 0 || pos > this.buf.length) {
      throw new RangeError(`Seek write position ${pos} out of bounds [0, ${this.buf.length}]`);
    }
    this.writePos = pos;
  }

  unreadBytes(): Uint8Array {
    return this.buf.subarray(this.readPos, this.writePos);
  }

  static from(array: Uint8Array): ByteBuffer {
    const box = new ByteBuffer(array.length);
    box.writeBytes(array);
    return box;
  }
}
