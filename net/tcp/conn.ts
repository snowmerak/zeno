/**
 * TcpConn implementation
 *
 * Aimed at providing a feel similar to Go's net.TCPConn.
 * Provides a more convenient API on top of Deno.Conn.
 */

import type { TcpDialOptions } from "./types.ts";

export interface TcpConn {
  /** Read data into the buffer. Returns number of bytes read or null on EOF. */
  read(p: Uint8Array): Promise<number | null>;

  /** Write data. */
  write(p: Uint8Array): Promise<number>;

  /** Close the connection. */
  close(): Promise<void>;

  /** Half-close the write side (if supported by underlying platform). */
  closeWrite(): Promise<void>;

  /** The local address of this connection. */
  readonly localAddr: Deno.NetAddr;

  /** The remote address of this connection. */
  readonly remoteAddr: Deno.NetAddr;

  /** ReadableStream view of the connection. */
  readonly readable: ReadableStream<Uint8Array>;

  /** WritableStream view of the connection. */
  readonly writable: WritableStream<Uint8Array>;

  /**
   * Escape hatch to the raw Deno.Conn.
   */
  unwrap(): Deno.Conn;

  // === Bufio-style convenience methods (Go net + bufio 느낌) ===

  /** Read a single line (including the newline character). Returns null on EOF. */
  readLine(): Promise<string | null>;

  /** Write a string followed by a newline. */
  writeLine(text: string): Promise<void>;
}

export class TcpConnImpl implements TcpConn {
  private _readBuffer = new Uint8Array(0);

  constructor(private _conn: Deno.Conn) {}

  get localAddr(): Deno.NetAddr {
    return this._conn.localAddr as Deno.NetAddr;
  }

  get remoteAddr(): Deno.NetAddr {
    return this._conn.remoteAddr as Deno.NetAddr;
  }

  get readable(): ReadableStream<Uint8Array> {
    return this._conn.readable;
  }

  get writable(): WritableStream<Uint8Array> {
    return this._conn.writable;
  }

  async read(p: Uint8Array): Promise<number | null> {
    return await this._conn.read(p);
  }

  async write(p: Uint8Array): Promise<number> {
    return await this._conn.write(p);
  }

  async close(): Promise<void> {
    this._conn.close();
  }

  async closeWrite(): Promise<void> {
    try {
      await this._conn.writable.close();
    } catch {
      // Ignore if already closed or not supported
    }
  }

  unwrap(): Deno.Conn {
    return this._conn;
  }

  // === Line-based helpers ===

  async readLine(): Promise<string | null> {
    const decoder = new TextDecoder();

    while (true) {
      // Check if we already have a newline in the buffer
      const newlineIndex = this._findNewline(this._readBuffer);
      if (newlineIndex !== -1) {
        const lineBytes = this._readBuffer.slice(0, newlineIndex + 1);
        this._readBuffer = this._readBuffer.slice(newlineIndex + 1);

        return decoder.decode(lineBytes);
      }

      // Need more data
      const chunk = new Uint8Array(1024);
      const bytesRead = await this._conn.read(chunk);

      if (bytesRead === null) {
        // EOF
        if (this._readBuffer.length > 0) {
          const remaining = decoder.decode(this._readBuffer);
          this._readBuffer = new Uint8Array(0);
          return remaining;
        }
        return null;
      }

      // Append to buffer
      const newBuffer = new Uint8Array(this._readBuffer.length + bytesRead);
      newBuffer.set(this._readBuffer);
      newBuffer.set(chunk.subarray(0, bytesRead), this._readBuffer.length);
      this._readBuffer = newBuffer;
    }
  }

  async writeLine(text: string): Promise<void> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text + "\n");
    await this._conn.write(data);
  }

  private _findNewline(buffer: Uint8Array): number {
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0x0a) { // '\n'
        return i;
      }
    }
    return -1;
  }
}

/**
 * Connects to a TCP address.
 * Similar to `net.Dial("tcp", addr)` in Go.
 *
 * Currently only supports a simple "host:port" format.
 */
export async function dialTCP(
  address: string,
  options: Partial<TcpDialOptions> = {},
): Promise<TcpConn> {
  // Simple address parsing (host:port)
  const [hostname, portStr] = address.split(":");
  const port = parseInt(portStr, 10);

  if (!hostname || !port) {
    throw new Error(`Invalid address format. Expected "host:port", got "${address}"`);
  }

  const conn = await Deno.connect({
    transport: "tcp",
    hostname,
    port,
  });

  return new TcpConnImpl(conn);
}

