import { assertEquals, assertThrows } from "@std/assert";
import { decodeUvarint, decodeVarint, encodeUvarint, encodeVarint, decodeUvarint64, decodeVarint64, encodeUvarint64, encodeVarint64 } from "../../codec/varint.ts";
import { ByteBuffer } from "../../codec/buffer.ts";
import { encodeFrame, FrameDecoder, MAGIC_BYTES } from "../../codec/frame.ts";
import { defineSchema } from "../../codec/schema.ts";

// --- Varint & ZigZag Tests ---

Deno.test("Varint - encode/decode Uvarint values", () => {
  const cases = [0, 1, 127, 128, 300, 16384, 2147483647, 4294967295];
  for (const val of cases) {
    const encoded = encodeUvarint(val);
    const [decoded, read] = decodeUvarint(encoded);
    assertEquals(decoded, val);
    assertEquals(read, encoded.length);
  }
});

Deno.test("Varint - encode/decode Varint (signed) values", () => {
  const cases = [0, 1, -1, 127, -128, 300, -300, 2147483647, -2147483648];
  for (const val of cases) {
    const encoded = encodeVarint(val);
    const [decoded, read] = decodeVarint(encoded);
    assertEquals(decoded, val);
    assertEquals(read, encoded.length);
  }
});

Deno.test("Varint - malformed Varint edge cases", () => {
  // Unexpected EOF (empty or partial)
  assertThrows(() => decodeUvarint(new Uint8Array([])), RangeError, "unexpected EOF");
  assertThrows(() => decodeUvarint(new Uint8Array([0x80, 0x80])), RangeError, "unexpected EOF");

  // Overflow (varint too long)
  const overflow = new Uint8Array([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01]);
  assertThrows(() => decodeUvarint(overflow), RangeError, "integer overflow");
});

// --- ByteBuffer Tests ---

Deno.test("ByteBuffer - basic read and write fixed types", () => {
  const buf = new ByteBuffer();
  buf.writeBoolean(true);
  buf.writeBoolean(false);
  buf.writeInt8(-128);
  buf.writeUint8(255);
  buf.writeInt16(-32768);
  buf.writeUint16(65535);
  buf.writeInt32(-2147483648);
  buf.writeUint32(4294967295);

  assertEquals(buf.bytesRemaining(), 16);

  const reader = ByteBuffer.from(buf.bytes());
  assertEquals(reader.readBoolean(), true);
  assertEquals(reader.readBoolean(), false);
  assertEquals(reader.readInt8(), -128);
  assertEquals(reader.readUint8(), 255);
  assertEquals(reader.readInt16(), -32768);
  assertEquals(reader.readUint16(), 65535);
  assertEquals(reader.readInt32(), -2147483648);
  assertEquals(reader.readUint32(), 4294967295);
  assertEquals(reader.bytesRemaining(), 0);
});

Deno.test("ByteBuffer - endianness options", () => {
  const buf = new ByteBuffer();
  // Big Endian by default, Little Endian as opt-in
  buf.writeInt16(4660, true);  // 0x1234 Little-Endian
  buf.writeInt32(305419896, true); // 0x12345678 Little-Endian
  buf.writeFloat32(1.23, true);
  buf.writeFloat64(9.876, true);

  const reader = ByteBuffer.from(buf.bytes());
  assertEquals(reader.readInt16(true), 4660);
  assertEquals(reader.readInt32(true), 305419896);
  assertEquals(Math.abs(reader.readFloat32(true) - 1.23) < 0.0001, true);
  assertEquals(reader.readFloat64(true), 9.876);
});

Deno.test("ByteBuffer - float32 and float64 encoding", () => {
  const buf = new ByteBuffer();
  buf.writeFloat32(1.5);
  buf.writeFloat64(-123.456);

  const reader = ByteBuffer.from(buf.bytes());
  assertEquals(reader.readFloat32(), 1.5);
  assertEquals(reader.readFloat64(), -123.456);
});

Deno.test("ByteBuffer - strings and dynamic byte arrays", () => {
  const buf = new ByteBuffer();
  buf.writeString("안녕하세요 Zeno");
  buf.writeBytes(new Uint8Array([10, 20, 30]));

  const reader = ByteBuffer.from(buf.bytes());
  assertEquals(reader.readString(), "안녕하세요 Zeno");
  const bytes = reader.readBytes(3);
  assertEquals(bytes[0], 10);
  assertEquals(bytes[1], 20);
  assertEquals(bytes[2], 30);
});

Deno.test("ByteBuffer - varint in buffer", () => {
  const buf = new ByteBuffer();
  buf.writeUvarint(100000);
  buf.writeVarint(-50000);

  const reader = ByteBuffer.from(buf.bytes());
  assertEquals(reader.readUvarint(), 100000);
  assertEquals(reader.readVarint(), -50000);
});

Deno.test("ByteBuffer - underflow error on read", () => {
  const buf = new ByteBuffer();
  buf.writeUint8(1);

  const reader = ByteBuffer.from(buf.bytes());
  assertEquals(reader.readUint8(), 1);
  assertThrows(() => reader.readUint8(), RangeError, "Underflow");
});

Deno.test("ByteBuffer - position and seeking", () => {
  const buf = new ByteBuffer();
  buf.writeInt32(100);
  buf.writeInt32(200);

  const reader = ByteBuffer.from(buf.bytes());
  assertEquals(reader.getReadPosition(), 0);
  assertEquals(reader.readInt32(), 100);
  assertEquals(reader.getReadPosition(), 4);

  // Seek back to start
  reader.seekRead(0);
  assertEquals(reader.readInt32(), 100);

  // Seek write
  const writer = new ByteBuffer();
  writer.writeInt32(0);
  writer.seekWrite(0);
  writer.writeInt32(999);
  assertEquals(ByteBuffer.from(writer.bytes()).readInt32(), 999);
});

// --- FrameDecoder Tests ---

Deno.test("FrameDecoder - basic framing", () => {
  const payload = new TextEncoder().encode("Hello World");
  const framed = encodeFrame(payload);

  // Verify framed magic bytes
  assertEquals(framed[0], MAGIC_BYTES[0]);
  assertEquals(framed[1], MAGIC_BYTES[1]);

  const decoder = new FrameDecoder();
  decoder.append(framed);
  const decoded = decoder.next();
  assertEquals(decoded !== null, true);
  assertEquals(new TextDecoder().decode(decoded!), "Hello World");

  // No further frames should exist
  assertEquals(decoder.next(), null);
  assertEquals(decoder.getBufferLength(), 0);
});

Deno.test("FrameDecoder - multi-frame single packet read", () => {
  const f1 = encodeFrame(new TextEncoder().encode("Frame1"));
  const f2 = encodeFrame(new TextEncoder().encode("Frame2"));
  
  const chunk = new Uint8Array(f1.length + f2.length);
  chunk.set(f1, 0);
  chunk.set(f2, f1.length);

  const decoder = new FrameDecoder();
  decoder.append(chunk);

  const r1 = decoder.next();
  const r2 = decoder.next();
  assertEquals(r1 !== null, true);
  assertEquals(r2 !== null, true);
  assertEquals(new TextDecoder().decode(r1!), "Frame1");
  assertEquals(new TextDecoder().decode(r2!), "Frame2");
  assertEquals(decoder.next(), null);
});

Deno.test("FrameDecoder - split packet fragmentation", () => {
  const payload = new TextEncoder().encode("Framed Packet Data");
  const framed = encodeFrame(payload);

  const decoder = new FrameDecoder();

  // Send first half
  const chunk1 = framed.subarray(0, Math.floor(framed.length / 2));
  decoder.append(chunk1);
  assertEquals(decoder.next(), null); // Incomplete frame

  // Send second half
  const chunk2 = framed.subarray(Math.floor(framed.length / 2));
  decoder.append(chunk2);

  const decoded = decoder.next();
  assertEquals(decoded !== null, true);
  assertEquals(new TextDecoder().decode(decoded!), "Framed Packet Data");
  assertEquals(decoder.next(), null);
});

Deno.test("FrameDecoder - corrupted stream throws", () => {
  const badData = new Uint8Array([0x00, 0x11, 0x22]);
  const decoder = new FrameDecoder();
  decoder.append(badData);
  assertThrows(() => decoder.next(), Error, "Corrupted TCP stream");
});

// --- BigInt Extension Tests ---

Deno.test("Varint64 - BigInt Uvarint64 & Varint64 encoding", () => {
  const uCases = [0n, 1n, 300n, 4294967295n, 18446744073709551615n];
  for (const val of uCases) {
    const encoded = encodeUvarint64(val);
    const [decoded, read] = decodeUvarint64(encoded);
    assertEquals(decoded, val);
    assertEquals(read, encoded.length);
  }

  const sCases = [0n, 1n, -1n, -9223372036854775808n, 9223372036854775807n];
  for (const val of sCases) {
    const encoded = encodeVarint64(val);
    const [decoded, read] = decodeVarint64(encoded);
    assertEquals(decoded, val);
    assertEquals(read, encoded.length);
  }
});

Deno.test("ByteBuffer - BigInt fixed type read/write", () => {
  const buf = new ByteBuffer();
  buf.writeInt64(-9223372036854775808n);
  buf.writeUint64(18446744073709551615n);
  buf.writeInt64(123456789012345n, true); // Little Endian
  buf.writeUint64(987654321098765n, true); // Little Endian
  buf.writeUvarint64(999999999999999n);
  buf.writeVarint64(-999999999999999n);

  const reader = ByteBuffer.from(buf.bytes());
  assertEquals(reader.readInt64(), -9223372036854775808n);
  assertEquals(reader.readUint64(), 18446744073709551615n);
  assertEquals(reader.readInt64(true), 123456789012345n);
  assertEquals(reader.readUint64(true), 987654321098765n);
  assertEquals(reader.readUvarint64(), 999999999999999n);
  assertEquals(reader.readVarint64(), -999999999999999n);
});

// --- SchemaCodec Tests ---

Deno.test("SchemaCodec - flat schema serialization & deserialization", () => {
  const userSchema = defineSchema({
    id: "uint32",
    name: "string",
    balance: "float64",
    vip: "boolean",
    userId: "uint64",
  });

  const original = {
    id: 101,
    name: "홍길동",
    balance: 5000.75,
    vip: true,
    userId: 987654321012345n,
  };

  const encoded = userSchema.encode(original);
  const decoded = userSchema.decode(encoded);

  assertEquals(decoded.id, original.id);
  assertEquals(decoded.name, original.name);
  assertEquals(decoded.balance, original.balance);
  assertEquals(decoded.vip, original.vip);
  assertEquals(decoded.userId, original.userId);
});

Deno.test("SchemaCodec - nested schema mapping", () => {
  const addressSchema = defineSchema({
    city: "string",
    zipcode: "uint32",
  });

  const profileSchema = defineSchema({
    email: "string",
    age: "uint8",
    address: addressSchema,
  });

  const original = {
    email: "test@zeno.dev",
    age: 30,
    address: {
      city: "Seoul",
      zipcode: 12345,
    },
  };

  const encoded = profileSchema.encode(original);
  const decoded = profileSchema.decode(encoded);

  assertEquals(decoded.email, original.email);
  assertEquals(decoded.age, original.age);
  assertEquals(decoded.address.city, original.address.city);
  assertEquals(decoded.address.zipcode, original.address.zipcode);
});

Deno.test("SchemaCodec - missing fields throw", () => {
  const schema = defineSchema({
    req: "string",
  });

  // Missing 'req' property
  assertThrows(() => schema.encode({} as any), TypeError, "Missing value for required schema field");
});

