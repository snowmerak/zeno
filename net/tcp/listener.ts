/**
 * TcpListener implementation
 *
 * Designed to feel as close as possible to Go's net.TCPListener.
 * Since Deno currently exposes almost no socket options,
 * we do not provide SetDeadline, SetKeepAlive, etc.
 */

import type { TcpListenOptions } from "./types.ts";
import type { TcpConn } from "./conn.ts";
import { TcpConnImpl } from "./conn.ts";

export interface TcpListener {
  /** Accept the next incoming connection */
  accept(): Promise<TcpConn>;

  /** Close the listener */
  close(): Promise<void>;

  /** The address this listener is bound to */
  readonly addr: Deno.NetAddr;

  /** Async iterable support: for await (const conn of listener) {} */
  [Symbol.asyncIterator](): AsyncIterableIterator<TcpConn>;

  /**
   * Escape hatch to the raw Deno.Listener.
   * Use this when you need functionality not provided by @zeno/net.
   */
  unwrap(): Deno.Listener;
}

export class TcpListenerImpl implements TcpListener {
  private _closed = false;

  constructor(private _listener: Deno.Listener) {}

  get addr(): Deno.NetAddr {
    return this._listener.addr as Deno.NetAddr;
  }

  async accept(): Promise<TcpConn> {
    if (this._closed) {
      throw new Error("Listener is closed");
    }
    const conn = await this._listener.accept();
    return new TcpConnImpl(conn);
  }

  async close(): Promise<void> {
    if (!this._closed) {
      this._closed = true;
      this._listener.close();
    }
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<TcpConn> {
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: async () => {
        try {
          const conn = await this.accept();
          return { done: false, value: conn };
        } catch (err) {
          if (this._closed) {
            return { done: true, value: undefined };
          }
          throw err;
        }
      },
    };
  }

  unwrap(): Deno.Listener {
    return this._listener;
  }
}

/**
 * Creates a TCP listener.
 * Similar to `net.Listen("tcp", addr)` in Go.
 */
export async function listenTCP(
  options: TcpListenOptions,
): Promise<TcpListener> {
  const listener = Deno.listen({
    transport: "tcp",
    hostname: options.hostname ?? "0.0.0.0",
    port: options.port,
  });

  return new TcpListenerImpl(listener);
}
