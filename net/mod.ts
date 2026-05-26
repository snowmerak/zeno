/**
 * @zeno/net
 *
 * TCP/UDP networking library with a Go `net` package-inspired API built on top of Deno primitives.
 *
 * Current Focus: TCP only (UDP will be added later)
 *
 * Design Goals:
 * - Provide ergonomic TCP server/client abstractions
 * - Stay reasonably close to the feel of Go's `net` package where it makes sense
 * - Always provide escape hatches back to the raw Deno APIs
 * - Be a good citizen in the Deno ecosystem
 */

// TCP exports (Phase 1)
export { listenTCP, dialTCP } from "./tcp/mod.ts";
export type {
  TcpListener,
  TcpConn,
  TcpListenOptions,
  TcpDialOptions,
} from "./tcp/mod.ts";

// UDP exports (Phase 2)
export { listenUDP, dialUDP } from "./udp/mod.ts";
export type {
  UdpConn,
  UdpListenOptions,
  UdpDialOptions,
} from "./udp/mod.ts";
