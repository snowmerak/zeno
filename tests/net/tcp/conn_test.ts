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
 * - Verify read/write, close, and stream behavior.
 * - Clearly test error propagation when one side closes first.
 * - Always verify the `unwrap()` escape hatch as well.
 *
 * Now that we have helpers, we will gradually add real read/write tests.
 */

import { assertEquals, assertRejects } from "@std/assert";
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
    const serverConn = await listener.accept();

    await client.writeLine("hello from client");

    const line = await serverConn.readLine();
    assertEquals(line, "hello from client\n");

    await serverConn.writeLine("hello from server");

    const response = await client.readLine();
    assertEquals(response, "hello from server\n");

    await serverConn.close();
  });
});

Deno.test("TcpConn - readLine handles multiple lines", async () => {
  await withConnectedPair({ port: 0 }, async ({ client, listener }) => {
    const serverConn = await listener.accept();

    await client.writeLine("line1");
    await client.writeLine("line2");

    const l1 = await serverConn.readLine();
    const l2 = await serverConn.readLine();

    assertEquals(l1, "line1\n");
    assertEquals(l2, "line2\n");

    await serverConn.close();
  });
});

Deno.test("TcpConn - write after peer closes should eventually fail", async () => {
  await withConnectedPair({ port: 0 }, async ({ client, listener }) => {
    const serverConn = await listener.accept();

    // Peer (server) closes the connection first
    await serverConn.close();

    await assertRejects(
      async () => {
        // The first write may succeed due to buffering.
        // A second write (or after some time) should fail when the OS detects the closed peer.
        await client.write(new TextEncoder().encode("first write after peer close"));
        await client.write(new TextEncoder().encode("second write - should fail"));
      },
      Error,
    );
  });
});

Deno.test("TcpConn - write after close should fail", async () => {
  await withConnectedPair({ port: 0 }, async ({ client }) => {
    await client.close();

    await assertRejects(
      async () => {
        await client.write(new TextEncoder().encode("this should fail"));
      },
      Error,
      // Error message can vary by platform (e.g. "Broken pipe", "Bad resource", etc.)
    );
  });
});

