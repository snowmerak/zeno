/**
 * UdpConn implementation wrapping Deno.DatagramConn.
 *
 * Provides a Go-inspired UDP socket abstraction supporting both
 * connectionless (readFrom/writeTo) and dialed (read/write) operational modes.
 */

import type { UdpDialOptions } from "./types.ts";

export interface UdpConn {
  /** Local address of the connection */
  readonly localAddr: Deno.NetAddr;

  /** Pre-configured remote address if the connection is dialed */
  readonly remoteAddr?: Deno.NetAddr;

  /** Send a datagram packet to a specific address */
  writeTo(p: Uint8Array, addr: Deno.NetAddr): Promise<number>;

  /** Receive a datagram packet from any address */
  readFrom(p: Uint8Array): Promise<{ n: number; addr: Deno.NetAddr } | null>;

  /** Send a datagram packet to the pre-configured remote address */
  write(p: Uint8Array): Promise<number>;

  /** Receive a datagram packet only from the pre-configured remote address */
  read(p: Uint8Array): Promise<number | null>;

  /** Close the UDP socket */
  close(): Promise<void>;

  /** Async iterable for streaming incoming datagrams */
  [Symbol.asyncIterator](): AsyncIterableIterator<[Uint8Array, Deno.NetAddr]>;

  /** Escape hatch to retrieve the raw Deno.DatagramConn */
  unwrap(): Deno.DatagramConn;
}

export class UdpConnImpl implements UdpConn {
  private _closed = false;

  constructor(
    private _conn: Deno.DatagramConn,
    private _remoteAddr?: Deno.NetAddr,
  ) {}

  get localAddr(): Deno.NetAddr {
    return this._conn.addr as Deno.NetAddr;
  }

  get remoteAddr(): Deno.NetAddr | undefined {
    return this._remoteAddr;
  }

  async writeTo(p: Uint8Array, addr: Deno.NetAddr): Promise<number> {
    if (this._closed) {
      throw new Error("Socket is closed");
    }
    const targetAddr = { ...addr };
    if (targetAddr.hostname === "0.0.0.0" || targetAddr.hostname === "::") {
      targetAddr.hostname = "127.0.0.1";
    }
    await this._conn.send(p, targetAddr);
    return p.length;
  }

  async readFrom(p: Uint8Array): Promise<{ n: number; addr: Deno.NetAddr } | null> {
    try {
      const [data, addr] = await this._conn.receive();
      const n = Math.min(data.length, p.length);
      p.set(data.subarray(0, n));
      return { n, addr: addr as Deno.NetAddr };
    } catch (err) {
      if (this._closed) {
        return null;
      }
      if (err instanceof Deno.errors.BadResource || err instanceof Deno.errors.Interrupted) {
        return null;
      }
      throw err;
    }
  }

  async write(p: Uint8Array): Promise<number> {
    if (!this._remoteAddr) {
      throw new Error("UDP socket is not dialed (connected)");
    }
    return await this.writeTo(p, this._remoteAddr);
  }

  async read(p: Uint8Array): Promise<number | null> {
    if (!this._remoteAddr) {
      throw new Error("UDP socket is not dialed (connected)");
    }

    const targetHostname = this._remoteAddr.hostname;
    const targetPort = this._remoteAddr.port;

    while (true) {
      const res = await this.readFrom(p);
      if (res === null) {
        return null;
      }

      const { n, addr } = res;

      // Filter: only accept packets from the dialed remote address
      const isSamePort = addr.port === targetPort;
      const isSameHost = addr.hostname === targetHostname ||
        (addr.hostname === "127.0.0.1" && targetHostname === "localhost") ||
        (addr.hostname === "localhost" && targetHostname === "127.0.0.1") ||
        (addr.hostname === "::1" && targetHostname === "localhost") ||
        (addr.hostname === "localhost" && targetHostname === "::1");

      if (isSamePort && isSameHost) {
        return n;
      }
      // Silently ignore packets from other senders (matching OS connected socket behavior)
    }
  }

  async close(): Promise<void> {
    if (!this._closed) {
      this._closed = true;
      try {
        this._conn.close();
      } catch (err) {
        if (!(err instanceof Deno.errors.BadResource)) {
          throw err;
        }
      }
    }
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<[Uint8Array, Deno.NetAddr]> {
    const conn = this._conn;
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: async () => {
        try {
          const [data, addr] = await conn.receive();
          return { done: false, value: [data, addr as Deno.NetAddr] };
        } catch (err) {
          if (this._closed) {
            return { done: true, value: undefined };
          }
          if (err instanceof Deno.errors.BadResource || err instanceof Deno.errors.Interrupted) {
            return { done: true, value: undefined };
          }
          throw err;
        }
      },
    };
  }

  unwrap(): Deno.DatagramConn {
    return this._conn;
  }
}
