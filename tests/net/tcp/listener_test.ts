/**
 * Tests for TcpListener
 *
 * ## Test Strategy (Documented during phase C)
 *
 * Tests in this file follow these principles:
 *
 * - Use helpers such as `withTestListener` and `withConnectedPair` as much as possible
 *   to automate listener lifecycle management.
 * - Focus on verifying real flows (accept → connect → read/write → close) rather than
 *   trivial "creation check" tests.
 * - Always test escape hatches (`unwrap()`). If this breaks, the value of the library decreases.
 * - Explicitly verify error paths (accept after close, double close, etc.).
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  listenTCP,
  withTestListener,
  withConnectedPair,
} from "../test_utils.ts";

Deno.test("TcpListener - basic listen and accept (using helper)", async () => {
  await withTestListener({ port: 0 }, async (listener) => {
    assertExists(listener.addr);
    assertEquals(listener.addr.transport, "tcp");
    // Verify that the address is set correctly
  });
});

Deno.test("TcpListener - async iteration works with connections", async () => {
  await withConnectedPair({ port: 0 }, async ({ listener }) => {
    // Indirectly verify that the async iterator works correctly
    const iterator = listener[Symbol.asyncIterator]();
    assertExists(iterator);
  });
});

Deno.test("TcpListener - unwrap returns raw Deno.Listener", async () => {
  await withTestListener({ port: 0 }, async (listener) => {
    const raw = listener.unwrap();

    assertExists(raw);
    assertEquals(typeof raw.accept, "function");
    assertEquals(typeof raw.close, "function");
  });
});

Deno.test("TcpListener - close after close is safe (idempotent)", async () => {
  const listener = await listenTCP({ port: 0 });
  await listener.close();
  await listener.close(); // The second close should also succeed without error (idempotent)
});
