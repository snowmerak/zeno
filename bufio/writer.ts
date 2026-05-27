import { Writer } from "./types.ts";

/**
 * BufWriter wraps an underlying Writer, buffering its write operations.
 * It prevents syscall overhead by aggregating small writes into memory
 * before flushing.
 */
export class BufWriter implements Writer {
  private buf: Uint8Array;
  private wr: Writer;
  private n = 0; // current buffered bytes count
  private err: Error | null = null;

  constructor(wr: Writer, size = 4096) {
    if (size <= 0) {
      throw new RangeError("Buffer size must be positive");
    }
    this.wr = wr;
    this.buf = new Uint8Array(size);
  }

  /**
   * Flushes all buffered bytes to the underlying writer.
   */
  async flush(): Promise<void> {
    if (this.err) {
      throw this.err;
    }
    if (this.n === 0) {
      return;
    }

    try {
      let flushed = 0;
      while (flushed < this.n) {
        const written = await this.wr.write(this.buf.subarray(flushed, this.n));
        if (written <= 0) {
          throw new Error("Short write: underlying writer accepted 0 bytes");
        }
        flushed += written;
      }
      this.n = 0;
    } catch (e) {
      this.err = e as Error;
      throw e;
    }
  }

  /**
   * Writes p.length bytes from p.
   * If the data is larger than the buffer size, it flushes the buffer and writes
   * directly to avoid redundant memory copies.
   */
  async write(p: Uint8Array): Promise<number> {
    if (this.err) {
      throw this.err;
    }
    if (p.length === 0) {
      return 0;
    }

    const available = this.buf.length - this.n;

    // If data doesn't fit in the remaining buffer space
    if (p.length > available) {
      // 1. Flush whatever we currently have in the buffer
      if (this.n > 0) {
        await this.flush();
      }

      // 2. If the data is still larger than our entire buffer capacity, bypass buffering
      if (p.length >= this.buf.length) {
        let writtenTotal = 0;
        while (writtenTotal < p.length) {
          const written = await this.wr.write(p.subarray(writtenTotal));
          if (written <= 0) {
            throw new Error("Short write: underlying writer accepted 0 bytes");
          }
          writtenTotal += written;
        }
        return p.length;
      }
    }

    // Copy data into our buffer
    this.buf.set(p, this.n);
    this.n += p.length;
    return p.length;
  }

  /**
   * Buffers exactly one byte.
   */
  async writeByte(c: number): Promise<void> {
    if (this.n >= this.buf.length) {
      await this.flush();
    }
    this.buf[this.n++] = c & 0xff;
  }

  /**
   * Encodes and writes a UTF-8 string to the buffer.
   */
  async writeString(s: string): Promise<number> {
    const encoded = new TextEncoder().encode(s);
    return await this.write(encoded);
  }

  /**
   * Gets the number of bytes currently buffered and un-flushed.
   */
  getBufferedLength(): number {
    return this.n;
  }
}
