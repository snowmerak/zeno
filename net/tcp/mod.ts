/**
 * TCP module for @zeno/net
 *
 * Provides Go net-inspired TCP abstractions on Deno.
 */

// Main functions
export { listenTCP } from "./listener.ts";
export { dialTCP } from "./conn.ts";

// Re-export implementation classes for advanced use / testing
export { TcpListenerImpl } from "./listener.ts";
export { TcpConnImpl } from "./conn.ts";

export type {
  TcpListener,
} from "./listener.ts";

export type {
  TcpConn,
} from "./conn.ts";

export type {
  TcpListenOptions,
  TcpDialOptions,
} from "./types.ts";
