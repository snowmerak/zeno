# @zeno/net — Agent Skill

**Library**: `@zeno/net` (TCP/UDP networking library for Deno)
**Status**: Planning phase (2026-05)
**Version of this skill**: 0.1.0 (initial vision)

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
- Start with **TCP only**.
- UDP will be added in a later phase once Deno's UDP APIs stabilize.

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
- Review support for `close()` + `closeWrite()` style on `TcpListener` (within the limits of current Deno.Conn)

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
- `closeWrite(): Promise<void>` (when possible)
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

## 8. Implementation Progress (as of latest)

**Phase B completed (basic implementation):**
- `listenTCP(options)` and `TcpListener` wrapper implemented
- `dialTCP(address, options)` and `TcpConn` wrapper implemented
- `readLine()` and `writeLine()` convenience methods added to `TcpConn` (bufio-style)
- Async iterable support on listener
- `unwrap()` escape hatches for both
- Basic types defined

**Phase C in progress:**
- Test directory structure created (`tests/net/tcp/`)
- Initial test skeletons for listener and conn
- Focusing on testing strategy around:
  - Connection lifecycle
  - Error handling on closed connections
  - Async iteration behavior
  - Escape hatch reliability

**Phase A (SKILL.md refinement):**
- Will be updated with concrete API decisions and lessons learned from implementation.


---

## 5. Agent Principles for This Library

- Always prefer using Deno's native networking primitives when possible.
- Every new abstraction must have clear "when to use raw Deno API vs this helper" guidance.
- UDP is fundamentally different from TCP — do not try to hide the differences too much.
- Document platform differences (especially UDP behavior across Deno versions and OS).

---

**This skill will be the constitution for @zeno/net.**

Before writing significant code, we will expand this document with concrete API designs, similar to how we did for @zeno/http.
