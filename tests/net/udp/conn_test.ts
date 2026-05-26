/**
 * Tests for UdpConn
 *
 * Validates connectionless and dialed UDP sockets, addressing filtering,
 * packet streaming, and unwrap escape hatch behavior.
 */

import { assertEquals, assertExists } from "@std/assert";
import { listenUDP, dialUDP } from "../../../net/mod.ts";

Deno.test("UdpConn - basic connectionless packet exchange (readFrom / writeTo)", async () => {
  const s1 = await listenUDP({ port: 0 });
  const s2 = await listenUDP({ port: 0 });

  try {
    const payload = new TextEncoder().encode("hello connectionless UDP");
    await s1.writeTo(payload, s2.localAddr);

    const buf = new Uint8Array(1024);
    const res = await s2.readFrom(buf);

    assertExists(res);
    assertEquals(res.n, payload.length);
    assertEquals(new TextDecoder().decode(buf.subarray(0, res.n)), "hello connectionless UDP");
    assertEquals(res.addr.port, s1.localAddr.port);
  } finally {
    await s1.close();
    await s2.close();
  }
});

Deno.test("UdpConn - basic dialed virtual connection (read / write)", async () => {
  const server = await listenUDP({ port: 0 });
  const client = await dialUDP(`127.0.0.1:${server.localAddr.port}`);

  try {
    const clientPayload = new TextEncoder().encode("ping from client");
    await client.write(clientPayload);

    const serverBuf = new Uint8Array(1024);
    const serverRes = await server.readFrom(serverBuf);

    assertExists(serverRes);
    assertEquals(new TextDecoder().decode(serverBuf.subarray(0, serverRes.n)), "ping from client");

    // Reply from server to client
    const serverPayload = new TextEncoder().encode("pong from server");
    await server.writeTo(serverPayload, serverRes.addr);

    const clientBuf = new Uint8Array(1024);
    const clientReadBytes = await client.read(clientBuf);

    assertExists(clientReadBytes);
    assertEquals(new TextDecoder().decode(clientBuf.subarray(0, clientReadBytes)), "pong from server");
  } finally {
    await server.close();
    await client.close();
  }
});

Deno.test("UdpConn - dialed socket filters out other senders", async () => {
  const server = await listenUDP({ port: 0 });
  const client = await dialUDP(`127.0.0.1:${server.localAddr.port}`);
  const intruder = await listenUDP({ port: 0 });

  try {
    // 1. Intruder sends a packet to the client
    const intruderPayload = new TextEncoder().encode("intruder payload");
    await intruder.writeTo(intruderPayload, client.localAddr);

    // 2. Server sends a valid packet to the client
    const serverPayload = new TextEncoder().encode("valid server payload");
    await server.writeTo(serverPayload, client.localAddr);

    // 3. Client calls read() - should ignore the intruder and return the server's packet
    const buf = new Uint8Array(1024);
    const n = await client.read(buf);

    assertExists(n);
    assertEquals(new TextDecoder().decode(buf.subarray(0, n)), "valid server payload");
  } finally {
    await server.close();
    await client.close();
    await intruder.close();
  }
});

Deno.test("UdpConn - async iterator streams datagrams", async () => {
  const s1 = await listenUDP({ port: 0 });
  const s2 = await listenUDP({ port: 0 });

  try {
    const p1 = new TextEncoder().encode("p1");
    const p2 = new TextEncoder().encode("p2");
    const p3 = new TextEncoder().encode("p3");

    await s1.writeTo(p1, s2.localAddr);
    await s1.writeTo(p2, s2.localAddr);
    await s1.writeTo(p3, s2.localAddr);

    const packets: string[] = [];
    const iterator = s2[Symbol.asyncIterator]();

    for (let i = 0; i < 3; i++) {
      const next = await iterator.next();
      if (next.done) {
        break;
      }
      const [data] = next.value;
      packets.push(new TextDecoder().decode(data));
    }

    assertEquals(packets, ["p1", "p2", "p3"]);
  } finally {
    await s1.close();
    await s2.close();
  }
});

Deno.test("UdpConn - unwrap returns raw DatagramConn", async () => {
  const conn = await listenUDP({ port: 0 });
  try {
    const raw = conn.unwrap();
    assertExists(raw);
    assertEquals(typeof raw.send, "function");
    assertEquals(typeof raw.receive, "function");
  } finally {
    await conn.close();
  }
});

Deno.test("UdpConn - close after close is idempotent", async () => {
  const conn = await listenUDP({ port: 0 });
  await conn.close();
  await conn.close(); // Second close should succeed without throwing
});
