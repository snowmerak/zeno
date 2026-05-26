# @zeno/net

TCP/UDP networking library for Deno, with an API inspired by Go's `net` package.

## Current Status (2026-05)

- **TCP**: Fully implemented
  - `listenTCP()` + `TcpListener`
  - `dialTCP()` + `TcpConn`
  - `read()`, `write()`, `readLine()`, `writeLine()`
  - Async iteration support on listeners
- **UDP**: Fully implemented (requires `--unstable-net` flag)
  - `listenUDP()` + `dialUDP()`
  - `UdpConn` (supporting both connectionless `readFrom`/`writeTo` and dialed `read`/`write` with address filtering)
  - Async iteration support for packet streaming
- **Socket Options** (`SetNoDelay`, `SetKeepAlive`, etc.): Not supported (Deno limitation)
- **Half-close** (`closeWrite()`): Currently not supported

## Philosophy

- Provide convenient, Go-like ergonomics on top of Deno's raw networking primitives.
- Always offer easy escape hatches back to the underlying `Deno.Listener` / `Deno.Conn` / `Deno.DatagramConn`.
- Be honest about limitations (especially those coming from Deno itself).

## Basic Usage

### TCP Server

```ts
import { listenTCP } from "@zeno/net";

const listener = await listenTCP({ port: 8080 });

for await (const conn of listener) {
  await conn.writeLine("Hello from server!");
  await conn.close();
}
```

### TCP Client

```ts
import { dialTCP } from "@zeno/net";

const conn = await dialTCP("127.0.0.1:8080");

const line = await conn.readLine();
console.log(line);

await conn.writeLine("Hello from client");
await conn.close();
```

### UDP Connectionless (Server pattern)

```ts
import { listenUDP } from "@zeno/net";

const conn = await listenUDP({ port: 10000 });

const buf = new Uint8Array(1024);
const res = await conn.readFrom(buf);
if (res) {
  const { n, addr } = res;
  console.log(`Received ${n} bytes from ${addr.hostname}`);
  await conn.writeTo(new TextEncoder().encode("Hello UDP"), addr);
}
```

### UDP Dialed (Client pattern)

```ts
import { dialUDP } from "@zeno/net";

const conn = await dialUDP("127.0.0.1:10000");

await conn.write(new TextEncoder().encode("Ping"));

const buf = new Uint8Array(1024);
const n = await conn.read(buf);
```

## Key APIs

| Function / Class     | Description                              | Go Equivalent          |
|----------------------|------------------------------------------|------------------------|
| `listenTCP(options)` | Create a TCP server                      | `net.Listen("tcp", ...)` |
| `dialTCP(addr)`      | Connect to a TCP server                  | `net.Dial("tcp", ...)`   |
| `TcpListener`        | TCP listener with `accept()` and async iteration | `net.TCPListener`     |
| `TcpConn`            | TCP connection with `readLine`/`writeLine` | `net.TCPConn`           |
| `listenUDP(options)` | Bind to a UDP port for receiving packets  | `net.ListenUDP("udp", ...)` |
| `dialUDP(addr)`      | Create a dialed virtual UDP connection   | `net.DialUDP("udp", ...)` |
| `UdpConn`            | UDP socket wrapping `Deno.DatagramConn`   | `net.UDPConn`           |

## Limitations

- No direct control over socket options (due to Deno)
- No half-close support (`closeWrite()`) at the moment
- UDP requires the Deno CLI to run with the `--unstable-net` flag.

For more detailed design decisions and future plans, see the [design document](../skills/net/SKILL.md).

## Related

- Design document: `../skills/net/SKILL.md`
- Follows the same project conventions as `@zeno/http`

