import { ByteBuffer } from "./buffer.ts";

export type SchemaType =
  | "boolean"
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "int64"
  | "uint64"
  | "float32"
  | "float64"
  | "string"
  | "bytes"
  | "varint"
  | "uvarint"
  | "varint64"
  | "uvarint64"
  | SchemaCodec<any>;

export type SchemaDefinition = Record<string, SchemaType>;

// Extract the compile-time TypeScript type from a SchemaDefinition
export type TypeFromSchema<T extends SchemaDefinition> = {
  [K in keyof T]: T[K] extends "boolean" ? boolean
    : T[K] extends "int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32" | "varint" | "uvarint" | "float32" | "float64" ? number
    : T[K] extends "int64" | "uint64" | "varint64" | "uvarint64" ? bigint
    : T[K] extends "string" ? string
    : T[K] extends "bytes" ? Uint8Array
    : T[K] extends SchemaCodec<infer U> ? TypeFromSchema<U>
    : never;
};

/**
 * SchemaCodec implements automatic schema-driven binary serialization.
 * It serializes values sequentially in alphabetical sorted order of schema keys,
 * ensuring high compression without transmitting metadata over the wire.
 */
export class SchemaCodec<T extends SchemaDefinition> {
  private keys: string[];

  constructor(public schema: T) {
    this.keys = Object.keys(schema).sort(); // Sort keys to guarantee deterministic byte layout
  }

  /**
   * Encodes a JavaScript object matching the schema into a compressed binary Uint8Array.
   */
  encode(value: TypeFromSchema<T>): Uint8Array {
    const buf = new ByteBuffer();
    this.encodeTo(value, buf);
    return buf.bytes();
  }

  /**
   * Decodes a binary Uint8Array back into a structured JavaScript object.
   */
  decode(data: Uint8Array): TypeFromSchema<T> {
    const buf = ByteBuffer.from(data);
    return this.decodeFrom(buf);
  }

  /**
   * Writes values directly to an active ByteBuffer (supports nested schema recursion).
   */
  encodeTo(value: any, buf: ByteBuffer) {
    for (const key of this.keys) {
      const fieldVal = value[key];
      const type = this.schema[key];

      if (fieldVal === undefined || fieldVal === null) {
        throw new TypeError(`Missing value for required schema field: "${key}"`);
      }

      if (type instanceof SchemaCodec) {
        type.encodeTo(fieldVal, buf);
      } else {
        switch (type) {
          case "boolean":
            buf.writeBoolean(!!fieldVal);
            break;
          case "int8":
            buf.writeInt8(Number(fieldVal));
            break;
          case "uint8":
            buf.writeUint8(Number(fieldVal));
            break;
          case "int16":
            buf.writeInt16(Number(fieldVal));
            break;
          case "uint16":
            buf.writeUint16(Number(fieldVal));
            break;
          case "int32":
            buf.writeInt32(Number(fieldVal));
            break;
          case "uint32":
            buf.writeUint32(Number(fieldVal));
            break;
          case "int64":
            buf.writeInt64(BigInt(fieldVal));
            break;
          case "uint64":
            buf.writeUint64(BigInt(fieldVal));
            break;
          case "float32":
            buf.writeFloat32(Number(fieldVal));
            break;
          case "float64":
            buf.writeFloat64(Number(fieldVal));
            break;
          case "string":
            buf.writeString(String(fieldVal));
            break;
          case "bytes":
            if (!(fieldVal instanceof Uint8Array)) {
              throw new TypeError(`Field "${key}" must be a Uint8Array`);
            }
            buf.writeUvarint(fieldVal.length);
            buf.writeBytes(fieldVal);
            break;
          case "varint":
            buf.writeVarint(Number(fieldVal));
            break;
          case "uvarint":
            buf.writeUvarint(Number(fieldVal));
            break;
          case "varint64":
            buf.writeVarint64(BigInt(fieldVal));
            break;
          case "uvarint64":
            buf.writeUvarint64(BigInt(fieldVal));
            break;
          default:
            throw new TypeError(`Unknown schema field type: "${type}"`);
        }
      }
    }
  }

  /**
   * Reads and parses a structured object from an active ByteBuffer.
   */
  decodeFrom(buf: ByteBuffer): TypeFromSchema<T> {
    const result: any = {};
    for (const key of this.keys) {
      const type = this.schema[key];

      if (type instanceof SchemaCodec) {
        result[key] = type.decodeFrom(buf);
      } else {
        switch (type) {
          case "boolean":
            result[key] = buf.readBoolean();
            break;
          case "int8":
            result[key] = buf.readInt8();
            break;
          case "uint8":
            result[key] = buf.readUint8();
            break;
          case "int16":
            result[key] = buf.readInt16();
            break;
          case "uint16":
            result[key] = buf.readUint16();
            break;
          case "int32":
            result[key] = buf.readInt32();
            break;
          case "uint32":
            result[key] = buf.readUint32();
            break;
          case "int64":
            result[key] = buf.readInt64();
            break;
          case "uint64":
            result[key] = buf.readUint64();
            break;
          case "float32":
            result[key] = buf.readFloat32();
            break;
          case "float64":
            result[key] = buf.readFloat64();
            break;
          case "string":
            result[key] = buf.readString();
            break;
          case "bytes": {
            const len = buf.readUvarint();
            result[key] = buf.readBytes(len);
            break;
          }
          case "varint":
            result[key] = buf.readVarint();
            break;
          case "uvarint":
            result[key] = buf.readUvarint();
            break;
          case "varint64":
            result[key] = buf.readVarint64();
            break;
          case "uvarint64":
            result[key] = buf.readUvarint64();
            break;
          default:
            throw new TypeError(`Unknown schema field type: "${type}"`);
        }
      }
    }
    return result as TypeFromSchema<T>;
  }
}

/**
 * Declares a deterministic Zeno static schema codec.
 */
export function defineSchema<T extends SchemaDefinition>(schema: T): SchemaCodec<T> {
  return new SchemaCodec(schema);
}
