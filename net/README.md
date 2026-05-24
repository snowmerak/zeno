# @zeno/net

TCP/UDP networking library for Deno, designed with a Go `net` package-inspired API.

## Current Status

- **TCP**: In active design & early implementation phase
- **UDP**: Planned (after TCP stabilizes)
- **Socket Options** (`SetNoDelay`, `SetKeepAlive`, etc.): Not supported (Deno limitation)

## Philosophy

- Provide convenient, Go-like ergonomics on top of Deno's raw networking primitives.
- Always offer escape hatches back to `Deno.Conn` / `Deno.Listener`.
- Document limitations honestly (especially around what Deno itself does not expose).

## Example (Planned API)

```ts
import { listenTCP, dialTCP } from "@zeno/net";

// Server
const listener = await listenTCP({ port: 8080 });

for await (const conn of listener) {
  await conn.write(new TextEncoder().encode("Hello\n"));
  await conn.close();
}

// Client
const conn = await dialTCP("127.0.0.1:8080");
const data = await conn.read(1024);
await conn.close();
```

## Related

- Design document: `../skills/net/SKILL.md`
- Follows the same conventions as `@zeno/http`
