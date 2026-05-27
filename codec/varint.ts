/**
 * Varint and ZigZag binary encoding utility functions for @zeno/codec
 */

/**
 * Encodes an unsigned 32-bit integer into a Protobuf-compatible Uvarint.
 */
export function encodeUvarint(val: number): Uint8Array {
  let num = val >>> 0;
  const temp = new Uint8Array(5);
  let idx = 0;
  while (num >= 0x80) {
    temp[idx++] = (num & 0x7f) | 0x80;
    num >>>= 7;
  }
  temp[idx++] = num & 0x7f;
  return temp.slice(0, idx);
}

/**
 * Decodes a Protobuf-compatible Uvarint from a buffer starting at offset.
 * Returns a tuple of [decoded value, number of bytes read].
 */
export function decodeUvarint(buf: Uint8Array, offset = 0): [number, number] {
  let val = 0;
  let shift = 0;
  let idx = offset;

  while (shift < 35) {
    if (idx >= buf.length) {
      throw new RangeError("Malformed Uvarint: unexpected EOF");
    }
    const b = buf[idx++];
    val |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) {
      return [val >>> 0, idx - offset];
    }
    shift += 7;
  }
  throw new RangeError("Malformed Uvarint: integer overflow");
}

/**
 * Encodes a signed 32-bit integer using ZigZag encoding into Uvarint.
 */
export function encodeVarint(val: number): Uint8Array {
  const intVal = val | 0; // force 32-bit signed
  const zz = (intVal << 1) ^ (intVal >> 31);
  return encodeUvarint(zz);
}

/**
 * Decodes a signed 32-bit integer (encoded with ZigZag/Varint) from a buffer.
 * Returns a tuple of [decoded value, number of bytes read].
 */
export function decodeVarint(buf: Uint8Array, offset = 0): [number, number] {
  const [zz, read] = decodeUvarint(buf, offset);
  const val = (zz >>> 1) ^ -(zz & 1);
  return [val, read];
}

/**
 * Encodes an unsigned 64-bit BigInt integer into a Protobuf-compatible Uvarint64.
 */
export function encodeUvarint64(val: bigint): Uint8Array {
  let num = val & 0xffffffffffffffffn; // force unsigned 64-bit BigInt
  const temp = new Uint8Array(10);
  let idx = 0;
  while (num >= 0x80n) {
    temp[idx++] = Number((num & 0x7fn) | 0x80n);
    num >>= 7n;
  }
  temp[idx++] = Number(num & 0x7fn);
  return temp.slice(0, idx);
}

/**
 * Decodes a Protobuf-compatible Uvarint64 from a buffer starting at offset.
 * Returns a tuple of [decoded BigInt value, number of bytes read].
 */
export function decodeUvarint64(buf: Uint8Array, offset = 0): [bigint, number] {
  let val = 0n;
  let shift = 0n;
  let idx = offset;

  while (shift < 70n) {
    if (idx >= buf.length) {
      throw new RangeError("Malformed Uvarint64: unexpected EOF");
    }
    const b = BigInt(buf[idx++]);
    val |= (b & 0x7fn) << shift;
    if ((b & 0x80n) === 0n) {
      return [val, idx - offset];
    }
    shift += 7n;
  }
  throw new RangeError("Malformed Uvarint64: integer overflow");
}

/**
 * Encodes a signed 64-bit BigInt integer using ZigZag encoding into Uvarint64.
 */
export function encodeVarint64(val: bigint): Uint8Array {
  const zz = (val << 1n) ^ (val >> 63n);
  return encodeUvarint64(zz);
}

/**
 * Decodes a signed 64-bit BigInt integer (encoded with ZigZag/Varint64) from a buffer.
 * Returns a tuple of [decoded BigInt value, number of bytes read].
 */
export function decodeVarint64(buf: Uint8Array, offset = 0): [bigint, number] {
  const [zz, read] = decodeUvarint64(buf, offset);
  const val = (zz >> 1n) ^ -(zz & 1n);
  return [val, read];
}

