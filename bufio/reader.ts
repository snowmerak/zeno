import { Reader } from "./types.ts";

/**
 * BufReader wraps an underlying Reader, buffering its read operations.
 * It provides byte-by-byte lookups, standard line slices, and delimiter lookups.
 */
export class BufReader implements Reader {
  private buf: Uint8Array;
  private rd: Reader;
  private r = 0; // read index
  private w = 0; // write index
  private err: Error | null = null;

  constructor(rd: Reader, size = 4096) {
    if (size <= 0) {
      throw new RangeError("Buffer size must be positive");
    }
    this.rd = rd;
    this.buf = new Uint8Array(size);
  }

  private async fill(): Promise<void> {
    // Shift unread bytes to the beginning of the buffer
    if (this.r > 0) {
      this.buf.copyWithin(0, this.r, this.w);
      this.w -= this.r;
      this.r = 0;
    }

    if (this.w >= this.buf.length) {
      return; // Buffer is completely full of unread bytes
    }

    try {
      const n = await this.rd.read(this.buf.subarray(this.w));
      if (n === null) {
        return; // EOF reached
      }
      this.w += n;
    } catch (e) {
      this.err = e as Error;
      throw e;
    }
  }

  /**
   * Reads up to p.length bytes into p.
   * Leverages internal memory cache to satisfy reads instantly when available.
   */
  async read(p: Uint8Array): Promise<number | null> {
    if (p.length === 0) {
      return 0;
    }

    if (this.r === this.w) {
      if (this.err) {
        throw this.err;
      }
      // If destination size is larger than our buffer, bypass buffering to avoid double-copying
      if (p.length >= this.buf.length) {
        return await this.rd.read(p);
      }
      // Fill the buffer
      this.r = 0;
      this.w = 0;
      await this.fill();
      if (this.r === this.w) {
        return null; // EOF
      }
    }

    let available = this.w - this.r;
    let toRead = Math.min(p.length, available);
    p.set(this.buf.subarray(this.r, this.r + toRead));
    this.r += toRead;

    // If we still need more bytes and the buffer has been fully consumed,
    // read directly from the underlying reader to avoid blocking.
    if (toRead < p.length && this.r === this.w) {
      const remaining = p.subarray(toRead);
      this.r = 0;
      this.w = 0;
      const n = await this.rd.read(remaining);
      if (n !== null) {
        toRead += n;
      }
    }

    return toRead;
  }

  /**
   * Reads and returns exactly one byte from the buffer.
   * Returns null if EOF is reached.
   */
  async readByte(): Promise<number | null> {
    if (this.r === this.w) {
      await this.fill();
      if (this.r === this.w) {
        return null; // EOF
      }
    }
    return this.buf[this.r++];
  }

  /**
   * Low-level reader searching for a delimiter byte.
   * Returns the slice containing the delimiter, or a partial slice with more: true
   * if the line overflows the buffer capacity.
   */
  async readSlice(delim: number): Promise<{ slice: Uint8Array; more: boolean } | null> {
    let _attempts = 0;
    while (true) {
      const idx = this.buf.subarray(this.r, this.w).indexOf(delim);
      if (idx >= 0) {
        const limit = this.r + idx + 1;
        const slice = this.buf.slice(this.r, limit);
        this.r = limit;
        return { slice, more: false };
      }

      // If buffer is full and contains no delimiter, return the full buffer as a split chunk
      if (this.r === 0 && this.w === this.buf.length) {
        const slice = this.buf.slice(0, this.w);
        this.r = 0;
        this.w = 0;
        return { slice, more: true };
      }

      const sizeBefore = this.w - this.r;
      await this.fill();
      const sizeAfter = this.w - this.r;

      // If no new bytes could be read (EOF)
      if (sizeBefore === sizeAfter) {
        if (this.r === this.w) {
          return null; // Empty EOF
        }
        const slice = this.buf.slice(this.r, this.w);
        this.r = this.w;
        return { slice, more: false };
      }
    }
  }

  /**
   * Reads a line ending in '\n', stripping trailing '\r' and '\n' line endings.
   * If the line is too long for the buffer, the remainder will be returned in subsequent reads.
   */
  async readLine(): Promise<{ line: Uint8Array; more: boolean } | null> {
    const res = await this.readSlice(0x0a); // '\n'
    if (!res) {
      return null;
    }

    let line = res.slice;
    if (!res.more) {
      if (line.length > 0 && line[line.length - 1] === 0x0a) {
        line = line.subarray(0, line.length - 1);
      }
      if (line.length > 0 && line[line.length - 1] === 0x0d) {
        line = line.subarray(0, line.length - 1);
      }
    }

    return { line, more: res.more };
  }

  /**
   * Reads a string up to a single-character delimiter.
   */
  async readString(delim: string): Promise<string | null> {
    if (delim.length !== 1) {
      throw new Error("Delimiter must be exactly 1 character");
    }
    const byte = delim.charCodeAt(0);
    const parts: Uint8Array[] = [];

    while (true) {
      const res = await this.readSlice(byte);
      if (!res) {
        if (parts.length === 0) return null;
        break;
      }
      parts.push(res.slice);
      if (!res.more) {
        break;
      }
    }

    let totalLen = 0;
    for (const p of parts) totalLen += p.length;
    const joined = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) {
      joined.set(p, offset);
      offset += p.length;
    }

    return new TextDecoder().decode(joined);
  }
}
