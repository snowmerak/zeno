# @zeno/net — Agent Skill

**Library**: `@zeno/net` (TCP/UDP networking library for Deno)
**Status**: TCP & UDP implementation complete (2026-05)
**Version of this skill**: 0.2.0 (TCP + UDP release)

---

## 1. Library Purpose

`@zeno/net` aims to provide a **practical, Fiber-like or higher-level experience** for raw TCP and UDP networking on Deno, built on top of Deno's excellent low-level primitives.

Deno already provides very good base APIs:
- `Deno.listen({ transport: "tcp", ... })` + `Deno.Conn`
- `Deno.connect({ transport: "tcp", ... })`
- UDP support via transport options (status varies by Deno version)

The goal of this library is **not** to replace these primitives, but to provide ergonomic wrappers, servers, clients, and utilities that make common patterns much more pleasant while still allowing escape hatches to the raw APIs.

### Core Values (following project philosophy)
- Strong **Dogfooding** of Deno's own networking + std libraries
- Create **agent-friendly** abstractions with clear documentation (this SKILL.md)
- Practical balance between high-level convenience and low-level control
- Excellent support for both TCP (reliable) and UDP (best-effort)

---

## 2. Initial Scope (MVP)

### High Priority (Start Here)
- **TCP Server** ergonomics (`TcpServer` / listener wrapper with connection handling)
- **TCP Client** connection helper with reconnection, buffering, etc.
- Clean `Conn` / connection abstraction with helpers (readLine, writeAll, etc.)
- Basic framing utilities (length-prefixed, line-based, etc.)

### Medium Priority
- UDP Datagram server/client wrappers (once stable APIs are confirmed)
- Connection pooling / manager
- Timeout and deadline helpers on connections

### Out of Scope (for now)
- HTTP/2, WebSocket (those belong in http or separate libs)
- TLS (can be layered later)
- High-level protocols (MQTT, Redis, etc. — those would be separate libraries that *use* @zeno/net)

---

## 3. Design Principles

- **Escape hatches everywhere**: Users should always be able to get the raw `Deno.Conn` or `Deno.Listener` easily.
- **Async iteration friendly**: `for await (const conn of server)` should just work nicely.
- **Resource management**: Proper `Symbol.dispose` / `close()` support.
- **Minimal magic**: Prefer explicit over clever.
- Follow the same "document limitations honestly" culture as @zeno/http.

---

## 4. Current Deno TCP API Landscape (as of Deno 2.8)

Deno provides solid low-level TCP primitives:

**Core APIs:**
- `Deno.listen({ transport: "tcp", port, hostname? })` → `Deno.Listener`
- `Deno.connect({ transport: "tcp", hostname, port })` → `Promise<Deno.Conn>`

**What Deno gives us:**
- `Deno.Listener`: `accept()`, `close()`, `addr`, async iterable
- `Deno.Conn`: `read()`, `write()`, `close()`, `readable`, `writable`, `localAddr`, `remoteAddr`

**What Deno does NOT provide** (things Go's net gives):
- High-level `Dial` / `Listen` style functions with rich options
- `TCPConn` with `SetNoDelay`, `SetKeepAlive`, `SetKeepAlivePeriod`
- `TCPListener` with `SetDeadline`, `File()` etc.
- Built-in buffered I/O helpers
- Connection state management
- Nice server lifecycle (graceful shutdown, etc.)

---

## 5. Go net Package Inspiration

Go's `net` package strikes a good balance:
- `net.Listen("tcp", addr)` / `net.Dial("tcp", addr)`
- `net.TCPListener`, `net.TCPConn` with useful methods
- `net.SplitHostPort`, address types
- `net.Dialer` with `Timeout`, `KeepAlive`, `LocalAddr`, etc.

We can aim for a **similar ergonomic feel** while staying true to Deno's async/streams model.

---

## 6. Decisions (Locked - 2026-05)

**Library Name**: `@zeno/net` (will cover TCP + UDP later)

**Scope Decision**:
- TCP implementation complete.
- UDP implementation complete (requires `--unstable-net` flag).

**Socket Options**:
- Socket option controls such as `SetNoDelay`, `SetKeepAlive`, `SetKeepAlivePeriod` are explicitly marked as **Out of Scope** because Deno currently does not support them.
- Provide raw `Deno.Conn` via escape hatch so users can handle advanced cases themselves.

**API Style Goal**:
- Aim to preserve the feel of Go's `net` package as much as possible.
- Mix of function style and class style:
  - `listen("tcp", addr)` / `dial("tcp", addr)`
  - Provide `TcpListener` and `TcpConn` classes
- Naturally expose Deno's `readable`/`writable` Streams as well.

**Abstraction Level**:
- Medium level (goal: convenience similar to Go net)
- Provide Buffered I/O helpers (`readLine`, `writeAll`, etc.)
- Consider separating Framing utilities into their own module

**Graceful Shutdown**:
- `close()` is supported. Half-close is currently out of scope due to Deno limitations.

---

## 7. Proposed TCP API Design (Go net style)

### Function style (similar to Go)

```ts
// Server
const listener = await listen("tcp", ":8080");
const listener = await listenTCP({ port: 8080 });

// Client
const conn = await dial("tcp", "127.0.0.1:8080");
const conn = await dialTCP("127.0.0.1:8080", { timeout: 5000 });
```

### Class style

```ts
// Listener
const listener = await listenTCP({ port: 8080 });

for await (const conn of listener) {
  // ...
}
await listener.close();

// Conn
const conn = await dialTCP(...);
await conn.write(new TextEncoder().encode("hello\n"));
const data = await conn.read(1024);
await conn.close();
```

### Main methods provided by TcpConn (inspired by Go net.TCPConn + adjusted for current Deno reality)

- `read(p: Uint8Array): Promise<number | null>`
- `write(p: Uint8Array): Promise<number>`
- `close(): Promise<void>`
- `close(): Promise<void>`
- `readable: ReadableStream<Uint8Array>`
- `writable: WritableStream<Uint8Array>`
- `localAddr`, `remoteAddr`
- `readLine(): Promise<string | null>`
- `writeLine(text: string): Promise<void>` (implemented)

**Note**: Methods such as `SetNoDelay` and `SetKeepAlive` are **not provided** (not supported by current Deno).

### Escape Hatch

```ts
const rawConn: Deno.Conn = conn.unwrap();  // or similar
const rawListener: Deno.Listener = listener.unwrap();
```

---

## 8. UDP API Design (Go net style)

### Function style (similar to Go)

```ts
// Server (Listen)
const conn = await listenUDP({ port: 10000 });

// Client (Dial)
const conn = await dialUDP("127.0.0.1:10000");
```

### Class style (UdpConn)

`UdpConn` supports both **connectionless** and **dialed (connected)** paradigms:

#### 1. Connectionless (Server pattern)
```ts
const conn = await listenUDP({ port: 10000 });

// Receive packet from any sender
const buf = new Uint8Array(1024);
const res = await conn.readFrom(buf);
if (res) {
  const { n, addr } = res;
  console.log(`Received ${n} bytes from ${addr.hostname}:${addr.port}`);
  
  // Reply to the sender
  await conn.writeTo(new TextEncoder().encode("Pong"), addr);
}
```

#### 2. Dialed (Client pattern)
```ts
const conn = await dialUDP("127.0.0.1:10000");

// Write directly to the pre-configured remote address
await conn.write(new TextEncoder().encode("Ping"));

// Read packets only from the pre-configured remote address (ignores others)
const buf = new Uint8Array(1024);
const n = await conn.read(buf);
```

#### 3. Streaming (Async Iterator)
```ts
const conn = await listenUDP({ port: 10000 });
for await (const [data, addr] of conn) {
  console.log(`Packet received from ${addr.hostname}:`, data);
}
```

### Escape Hatch
```ts
const rawDatagramConn: Deno.DatagramConn = conn.unwrap();
```

---

## 9. Implementation Progress (as of latest)

**Phase B & C completed (TCP + UDP implementation & validation):**
- **TCP**: `listenTCP`/`dialTCP` wrappers, connection buffering, `readLine`/`writeLine` bufio-style convenience helpers, robust integration tests.
- **UDP**: `listenUDP`/`dialUDP` wrappers wrapping Deno's unstable `Deno.listenDatagram` API. Implements connectionless (`readFrom`/`writeTo`) and simulated connected/dialed (`read`/`write` with address filtering) patterns. Full suite of integration tests covering dual-mode behavior.
- Deno configuration updated to automatically apply `--unstable-net` for test compilation and execution.


---

## 5. Agent Principles for This Library

- Always prefer using Deno's native networking primitives when possible.
- Every new abstraction must have clear "when to use raw Deno API vs this helper" guidance.
- UDP is fundamentally different from TCP — do not try to hide the differences too much.
- Document platform differences (especially UDP behavior across Deno versions and OS).

---

**This skill will be the constitution for @zeno/net.**

Before writing significant code, we will expand this document with concrete API designs, similar to how we did for @zeno/http.
