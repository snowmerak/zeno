import { decodeUvarint, encodeUvarint } from "./varint.ts";

export const MAGIC_BYTES = new Uint8Array([0x5A, 0x4E]); // 'ZN'

/**
 * Encodes a binary payload into a Zeno magic-prefixed and length-prefixed packet frame.
 * Format: [ Magic: 2B (0x5A, 0x4E) ] [ Payload Length: Uvarint (1-5B) ] [ Payload ]
 */
export function encodeFrame(payload: Uint8Array): Uint8Array {
  const lenPrefix = encodeUvarint(payload.length);
  const frame = new Uint8Array(MAGIC_BYTES.length + lenPrefix.length + payload.length);
  frame.set(MAGIC_BYTES, 0);
  frame.set(lenPrefix, MAGIC_BYTES.length);
  frame.set(payload, MAGIC_BYTES.length + lenPrefix.length);
  return frame;
}

/**
 * FrameDecoder handles TCP packet streaming by accumulating incoming fragmented chunks,
 * verifying packet integrity via Magic Bytes, and slicing complete frames.
 */
export class FrameDecoder {
  private buffer = new Uint8Array(0);

  /**
   * Appends incoming fragmented TCP socket data to the decoder buffer.
   */
  append(chunk: Uint8Array) {
    if (chunk.length === 0) return;
    const nextBuf = new Uint8Array(this.buffer.length + chunk.length);
    nextBuf.set(this.buffer, 0);
    nextBuf.set(chunk, this.buffer.length);
    this.buffer = nextBuf;
  }

  /**
   * Tries to decode the next complete frame payload from the buffer.
   * If a complete frame is successfully parsed, it is sliced off the internal buffer and returned.
   * If data is incomplete, returns null.
   * Throws an Error if magic bytes are invalid (indicates stream corruption).
   */
  next(): Uint8Array | null {
    if (this.buffer.length < 2) {
      return null;
    }

    // Verify magic bytes
    if (this.buffer[0] !== MAGIC_BYTES[0] || this.buffer[1] !== MAGIC_BYTES[1]) {
      throw new Error(
        `Corrupted TCP stream: invalid magic bytes [0x${this.buffer[0].toString(16)}, 0x${this.buffer[1].toString(16)}]`,
      );
    }

    try {
      // Decode payload length
      const [payloadLen, bytesRead] = decodeUvarint(this.buffer, 2);
      const headerLen = 2 + bytesRead;
      const totalLen = headerLen + payloadLen;

      if (this.buffer.length < totalLen) {
        // Incomplete payload
        return null;
      }

      // Slice out the complete payload
      const payload = this.buffer.slice(headerLen, totalLen);

      // Advance buffer
      this.buffer = this.buffer.slice(totalLen);

      return payload;
    } catch (err) {
      if (err instanceof RangeError && err.message.includes("unexpected EOF")) {
        // Length prefix varint was split/fragmented across TCP reads
        return null;
      }
      throw err;
    }
  }

  /**
   * Gets the remaining unparsed bytes inside the decoder.
   */
  getBufferLength(): number {
    return this.buffer.length;
  }

  /**
   * Clears all buffered bytes.
   */
  reset() {
    this.buffer = new Uint8Array(0);
  }
}
