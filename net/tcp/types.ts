/**
 * TCP related types for @zeno/net
 *
 * These types aim to stay close to Go's net package conventions
 * while respecting Deno's current capabilities.
 */

export interface TcpListenOptions {
  /** Port to listen on */
  port: number;
  /** Hostname to bind to (default: "0.0.0.0") */
  hostname?: string;
  // backlog, reusePort, etc. are currently limited in Deno
}

export interface TcpDialOptions {
  /** Target hostname */
  hostname: string;
  /** Target port */
  port: number;
  /** Connection timeout in milliseconds */
  timeout?: number;
  // keepAlive, localAddr, etc. are currently limited in Deno
}

/** Common interface for network addresses */
export type NetAddr = Deno.NetAddr;
