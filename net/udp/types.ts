/**
 * UDP related types for @zeno/net
 *
 * Designed to feel close to Go's net package conventions
 * while respecting Deno's UDP features.
 */

export interface UdpListenOptions {
  /** Port to listen on */
  port: number;
  /** Hostname to bind to (default: "0.0.0.0") */
  hostname?: string;
}

export interface UdpDialOptions {
  /** Target hostname */
  hostname?: string;
  /** Target port */
  port?: number;
  /** Optional timeout in milliseconds */
  timeout?: number;
}
