# @zeno/codec — Agent Skill

**Library**: `@zeno/codec` (High-performance low-level binary serialization and TCP packet framing library for Deno)
**Status**: Varint, ZigZag, ByteBuffer, FrameDecoder, BigInt, and SchemaCodec complete (2026-05)
**Version of this skill**: 1.1.0 (Extended with BigInt and SchemaCodec)

---

## 1. Library Purpose

`@zeno/codec` provides a highly optimized, low-level binary serialization substrate. It deals directly with bits, bytes, endianness, and dynamic sliding buffers. It solves two primary concerns in modern network and distributed application architectures:
1. **Compact Data Representation**: Efficient varint serialization reduces bandwidth and storage.
2. **TCP Stream Framing**: Solves TCP socket packet fragmentation (partial reads) and combining (multiple packets in one socket read) using a sliding receiver buffer.
3. **Structured Schema Mapping**: Packs complex nested JavaScript objects into highly compressed binary payloads using sorted, deterministic key layouts without sending metadata over the wire.

---

## 2. API Architecture

### 2.1 Varint & ZigZag Codec (`varint.ts`)
* **Uvarint (Unsigned Varint)**: Encodes unsigned integers using MSB (Most Significant Bit) continuation flag, utilizing up to 5 bytes for 32-bit integers.
* **Varint (Signed Varint)**: Applies **ZigZag mapping** first (mapping negative numbers to positive ones dynamically: `(n << 1) ^ (n >> 31)` for 32-bit), then encodes via Uvarint. Saves significant space for negative integers which would otherwise require full 32-bit representation.
* **BigInt Support (Uvarint64 & Varint64)**: Implements identical varint compression for native `bigint` 64-bit integer values.

#### Quick Usage:
```ts
import { encodeUvarint, decodeUvarint, encodeVarint64, decodeVarint64 } from "./varint.ts";

const uBytes = encodeUvarint(300); // Protobuf style uvarint
const [uVal, uRead] = decodeUvarint(uBytes); // [300, 2]

const sBytes = encodeVarint64(-9223372036854775808n); // ZigZag + Uvarint64
const [sVal, sRead] = decodeVarint64(sBytes); // [-9223372036854775808n, 10]
```

### 2.2 Dynamic ByteBuffer (`buffer.ts`)
`ByteBuffer` implements both `BinaryWriter` and `BinaryReader` interfaces, using an auto-growing `Uint8Array` internally and backing it with `DataView` for endian-safe multi-byte encoding. Fully supports standard fixed-size `bigint` types (`int64`, `uint64`).

#### Quick Usage:
```ts
import { ByteBuffer } from "./buffer.ts";

// Writing
const writer = new ByteBuffer();
writer
  .writeUint8(255)
  .writeInt16(-1000)
  .writeInt64(-9223372036854775808n) // BigInt support
  .writeFloat64(3.14159)
  .writeString("Hello Zeno")
  .writeUvarint(500);

const bytes = writer.bytes(); // Returns Uint8Array snapshot of written bytes

// Reading
const reader = ByteBuffer.from(bytes);
const uint8Val = reader.readUint8();
const int16Val = reader.readInt16();
const int64Val = reader.readInt64();
const floatVal = reader.readFloat64();
const strVal = reader.readString();
const uvarintVal = reader.readUvarint();
```

### 2.3 Automatic Schema Mapping (`schema.ts`)
`SchemaCodec` maps structured objects into compressed binary bytes. By sorting key fields alphabetically (`Object.keys(schema).sort()`), it ensures a perfectly deterministic binary layout without incurring the overhead of metadata tags (MessagePack style) or external schema compilation (Protobuf style). Supports deeply nested schema mapping.

#### Quick Usage:
```ts
import { defineSchema } from "./schema.ts";

const addressSchema = defineSchema({
  city: "string",
  zipcode: "uint32",
});

const userSchema = defineSchema({
  id: "uint32",
  name: "string",
  vip: "boolean",
  address: addressSchema, // Nested schema mapping
});

// Serialization
const binary = userSchema.encode({
  id: 42,
  name: "Zeno",
  vip: true,
  address: {
    city: "Seoul",
    zipcode: 12345,
  },
});

// Deserialization
const user = userSchema.decode(binary);
```

### 2.4 TCP Packet Framer (`frame.ts`)
Solves TCP steam boundary problems. The frame structure is defined as:
```
[ Magic Bytes: 2B (0x5A, 0x4E - 'ZN') ] [ Payload Length: Uvarint (1-5B) ] [ Payload: Binary ]
```

#### Quick Usage:
```ts
import { encodeFrame, FrameDecoder } from "./frame.ts";

// Encode payload
const payload = new TextEncoder().encode("Zeno TCP Packet");
const framed = encodeFrame(payload);

// Decode with sliding window handling fragmentation
const decoder = new FrameDecoder();

// Append incoming chunk
decoder.append(framed);

// Retrieve all completed frames
let frame = decoder.next();
while (frame !== null) {
  console.log("Decoded Frame:", new TextDecoder().decode(frame));
  frame = decoder.next();
}
```

---

## 3. Design Decisions & Trade-offs

1. **No External Dependencies**: Built entirely using standard ES6 / Deno features (`Uint8Array`, `DataView`, `TextEncoder`, `TextDecoder`) to guarantee maximum reliability and maintainability.
2. **Standard V8 Engine Bit Shifting**: Leverages standard bitwise operations for Varint/ZigZag calculation, allowing V8 compiler to compile these down to extremely fast native assembly instructions.
3. **DataView Endianness**: Standardized on Big-Endian (network byte order) as default, but allows explicit Little-Endian configuration for platform compatibility.
4. **Deterministic Field Sorter**: The SchemaCodec automatically sorts object keys alphabetically during construction, creating stable layouts without requiring manual indices (`@field(1)` etc.) and keeping wire sizes strictly minimal.
