/**
 * @zeno/codec
 * High-performance low-level binary serialization and TCP packet framing library.
 */

export * from "./types.ts";
export {
  decodeUvarint,
  decodeVarint,
  encodeUvarint,
  encodeVarint,
  decodeUvarint64,
  decodeVarint64,
  encodeUvarint64,
  encodeVarint64,
} from "./varint.ts";
export { ByteBuffer } from "./buffer.ts";
export { encodeFrame, FrameDecoder, MAGIC_BYTES } from "./frame.ts";
export { defineSchema, SchemaCodec } from "./schema.ts";
export type { SchemaDefinition, SchemaType, TypeFromSchema } from "./schema.ts";

