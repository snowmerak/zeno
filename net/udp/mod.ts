/**
 * UDP module entry points.
 *
 * Implements listenUDP and dialUDP functions inspired by Go's net package.
 */

import { type UdpConn, UdpConnImpl } from "./conn.ts";
import type { UdpListenOptions, UdpDialOptions } from "./types.ts";

export { UdpConnImpl } from "./conn.ts";
export type { UdpConn } from "./conn.ts";
export type { UdpListenOptions, UdpDialOptions } from "./types.ts";

/**
 * Binds to a UDP address to listen for incoming datagrams.
 * Similar to Go's net.ListenUDP("udp", ...)
 */
export async function listenUDP(
  options: UdpListenOptions,
): Promise<UdpConn> {
  const conn = Deno.listenDatagram({
    transport: "udp",
    port: options.port,
    hostname: options.hostname ?? "0.0.0.0",
  });
  return new UdpConnImpl(conn);
}

/**
 * Creates a UDP client connection targeting a specific remote address.
 * Similar to Go's net.DialUDP("udp", ...)
 */
export async function dialUDP(
  address: string,
  _options: UdpDialOptions = {},
): Promise<UdpConn> {
  const [hostname, portStr] = address.split(":");
  const port = parseInt(portStr, 10);

  if (!hostname || !port) {
    throw new Error(`Invalid address format. Expected "host:port", got "${address}"`);
  }

  let targetHost = hostname;
  if (targetHost === "0.0.0.0" || targetHost === "::") {
    targetHost = "127.0.0.1";
  }

  // Bind to an ephemeral port (port 0) on the wildcard address
  const conn = Deno.listenDatagram({
    transport: "udp",
    port: 0,
    hostname: "0.0.0.0",
  });

  const remoteAddr: Deno.NetAddr = {
    transport: "udp",
    hostname: targetHost,
    port,
  };

  return new UdpConnImpl(conn, remoteAddr);
}
