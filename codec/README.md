# @zeno/codec

Zero-dependency, high-performance low-level binary serialization and TCP framing library for Deno.

## Features

- **Compact Data Representation**: Protobuf-compatible `Uvarint` and signed `Varint` (applying ZigZag mapping) implementation for high-density 32-bit and 64-bit BigInt packing.
- **Sequential `ByteBuffer`**: Auto-growing binary stream builder and reader wrapping `Uint8Array` and standard `DataView` supporting Big-Endian (network byte order), Little-Endian, and 64-bit BigInt primitives.
- **TCP Packet Framer**: Solves the core TCP packet fragmentation (partial read) and combining (multiple packets packed into a single socket read) issues using magic bytes (`0x5A, 0x4E`) and a sliding receiver buffer in `FrameDecoder`.
- **Automatic Schema Mapping (`SchemaCodec`)**: Deterministic, ordered, schema-driven serialization for complex nested objects without metadata overhead, ensuring optimal compression.
- **Zero External Dependencies**: Standard-compliant and built purely with native JS/TS web standards.

## Installation (when published)

```bash
deno add @zeno/codec
```

**Note**: Source currently lives under `codec/` inside the monorepo for monorepo dogfooding convenience. The public API surface is `@zeno/codec`.

## Basic Usage

### 1. Varint / ZigZag Codecs

```ts
import { encodeUvarint, decodeUvarint, encodeVarint, decodeVarint } from "@zeno/codec";

// Unsigned Varint (Uvarint)
const ubytes = encodeUvarint(150);
const [uval, uread] = decodeUvarint(ubytes);
console.log(uval); // 150

// Signed Varint (Varint with ZigZag mapping)
const sbytes = encodeVarint(-42);
const [sval, sread] = decodeVarint(sbytes);
console.log(sval); // -42
```

### 2. 64-bit BigInt support

```ts
import { encodeUvarint64, decodeUvarint64 } from "@zeno/codec";

const bytes = encodeUvarint64(9876543210987654321n);
const [decoded, read] = decodeUvarint64(bytes);
console.log(decoded); // 9876543210987654321n
```

### 3. ByteBuffer (Read/Write Streams)

```ts
import { ByteBuffer } from "@zeno/codec";

const buf = new ByteBuffer();
buf.writeBoolean(true)
   .writeUint8(255)
   .writeInt16(-1000)
   .writeInt64(-9223372036854775808n) // 64-bit BigInt
   .writeString("Zeno Codec")
   .writeUvarint(20000);

const bytes = buf.bytes(); // Snapshots written binary payload

const reader = ByteBuffer.from(bytes);
console.log(reader.readBoolean()); // true
console.log(reader.readUint8());   // 255
console.log(reader.readInt16());   // -1000
console.log(reader.readInt64());   // -9223372036854775808n
console.log(reader.readString());  // "Zeno Codec"
console.log(reader.readUvarint()); // 20000
```

### 4. Deterministic Schema Serialization (Protobuf-style SchemaCodec)

```ts
import { defineSchema } from "@zeno/codec";

const userSchema = defineSchema({
  id: "uint32",
  name: "string",
  balance: "float64",
  vip: "boolean",
  userId: "uint64",
});

const original = {
  id: 101,
  name: "Hong Gil Dong",
  balance: 5000.75,
  vip: true,
  userId: 987654321012345n,
};

// Encodes dynamically using sorted, deterministic field keys for zero-metadata wire sizes
const binary = userSchema.encode(original);

// Decodes back to structured schema object
const decoded = userSchema.decode(binary);
console.log(decoded.userId); // 987654321012345n
```

### 5. TCP Streaming Frame Decoder

```ts
import { encodeFrame, FrameDecoder } from "@zeno/codec";

const payload = new TextEncoder().encode("TCP Frame Payload");
const framed = encodeFrame(payload);

const decoder = new FrameDecoder();

// Simulating chunk arrival from socket stream
decoder.append(framed.subarray(0, 5)); // Segment A (fragmented)
console.log(decoder.next()); // null (incomplete)

decoder.append(framed.subarray(5));  // Segment B (rest of the payload)
const frame = decoder.next();
console.log(new TextDecoder().decode(frame)); // "TCP Frame Payload"
```

## Related

- **Authoritative design & decisions**: `../skills/codec/SKILL.md` (the constitutional design specification)
- Part of the Zeno Deno library collection (dogfooding std + Web Standards)
