/**
 * Test utilities for @zeno/net
 *
 * ## Test Strategy Philosophy (Documented during phase C)
 *
 * Networking tests are inherently complex because two entities
 * (server/client or listener/connection) must operate simultaneously.
 * Therefore, we follow these principles:
 *
 * 1. **Actively use test helpers**:
 *    - Avoid manually writing `listenTCP` + `dialTCP` in every test.
 *    - Use helpers like `withTestListener` to automatically manage the listener lifecycle.
 *
 * 2. **Isolation**:
 *    - Each test should use an independent port (preferably port 0).
 *    - Do not rely on global state.
 *
 * 3. **Focus on realistic scenarios**:
 *    - Do not only test trivial cases like "does the listener get created?".
 *    - Verify real flows: accept → connect → read/write → close.
 *
 * 4. **Explicitly test error cases**:
 *    - accept after close
 *    - read/write after close
 *    - behavior when the peer closes first
 *
 * 5. **Test escape hatches**:
 *    - Verify that raw Deno objects obtained via `unwrap()` work correctly.
 *    - If this breaks, the value of the library decreases significantly.
 *
 * 6. **Minimize flakiness**:
 *    - Avoid tests that depend heavily on timing.
 *    - Use minimal sleep + retry only when necessary, and prefer event-driven approaches.
 */

import { listenTCP } from "../../net/tcp/listener.ts";
import type { TcpListener, TcpConn } from "../../net/tcp/mod.ts";
import type { TcpListenOptions } from "../../net/tcp/types.ts";

/**
 * Creates a TCP listener for testing and automatically closes it after the test finishes.
 *
 * Usage example:
 * ```ts
 * await withTestListener({ port: 0 }, async (listener) => {
 *   // use listener here
 * });
 * // listener is already closed here
 * ```
 */
export async function withTestListener<T>(
  options: TcpListenOptions,
  fn: (listener: TcpListener) => Promise<T>,
): Promise<T> {
  const listener = await listenTCP(options);
  try {
    return await fn(listener);
  } finally {
    await listener.close();
  }
}

/**
 * Simple client helper that connects to the given listener.
 * Reduces the repetitive "one listener + one client" pattern commonly used in tests.
 */
export async function connectToListener(
  listener: TcpListener,
): Promise<TcpConn> {
  const addr = listener.addr;

  // Normalize address for local testing (0.0.0.0 / :: cannot be connected to directly on some OSes)
  let hostname = addr.hostname;
  if (hostname === "0.0.0.0" || hostname === "::") {
    hostname = "127.0.0.1";
  }

  const { dialTCP } = await import("../../net/tcp/mod.ts");
  const conn = await dialTCP(`${hostname}:${addr.port}`);
  return conn;
}

/**
 * Convenience helper that creates both a listener and a client at once.
 * Covers the most frequently used test pattern.
 */
export async function withConnectedPair<T>(
  listenOptions: TcpListenOptions = { port: 0 },
  fn: (args: { listener: TcpListener; client: TcpConn }) => Promise<T>,
): Promise<T> {
  return await withTestListener(listenOptions, async (listener) => {
    const client = await connectToListener(listener);
    try {
      return await fn({ listener, client });
    } finally {
      await client.close();
    }
  });
}
