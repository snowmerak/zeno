/**
 * Tests for TcpConn
 *
 * ## Test Strategy (Documented during phase C)
 *
 * Most Conn tests are inherently "paired" tests
 * (a server-side listener + a client conn).
 *
 * Therefore, we follow this strategy:
 * - Actively use the `withConnectedPair` helper to easily create listener + client pairs.
 * - Verify read/write, close, closeWrite, and stream behavior.
 * - Clearly test error propagation when one side closes first.
 * - Always verify the `unwrap()` escape hatch as well.
 *
 * Now that we have helpers, we will gradually add real read/write tests.
 */

import { assertEquals } from "@std/assert";
import { withConnectedPair } from "../test_utils.ts";

Deno.test("TcpConn - basic paired connection (smoke test)", async () => {
  await withConnectedPair({ port: 0 }, async ({ client }) => {
    // Verify that the connection itself was established correctly
    assertEquals(client.remoteAddr.transport, "tcp");
    assertEquals(client.localAddr.transport, "tcp");
  });
});

Deno.test("TcpConn - readLine and writeLine basic usage", async () => {
  await withConnectedPair({ port: 0 }, async ({ client, listener }) => {
    // Server side: accept one connection and echo lines
    const serverConnPromise = listener.accept();

    // Client writes a line
    await client.writeLine("hello from client");

    const serverConn = await serverConnPromise;

    // Server reads the line
    const line = await serverConn.readLine();
    assertEquals(line, "hello from client\n");

    // Server writes back
    await serverConn.writeLine("hello from server");

    // Client reads back
    const response = await client.readLine();
    assertEquals(response, "hello from server\n");

    await serverConn.close();
  });
});

