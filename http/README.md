# @zeno/http

**Zeno project's first official library**

An HTTP routing library that provides a developer experience similar to Go's Fiber on **pure Deno**.

> **Important**: This library does not use Hono or Oak as a base.  
> It is built from scratch using only Deno's basic APIs (`Deno.serve`, Web Standards) + `@std/*`.  
> (Maximum dogfooding purpose)

## Official Documentation (Agent Skill)

The **latest architecture, design decisions, and dogfooding records** of this library are in the following file:

- [skills/http/SKILL.md](../skills/http/SKILL.md)

Always refer to this file with the highest priority. It is continuously updated together with the code.

## Current Status (2026-05)

- Architecture locked
- Core (Router, Group, Context Builder, Middleware, Error handling) largely complete
- 85+ tests passing, real server dogfooding (basic-api) verified
- Some residual weakness remains in Group and Context cookie areas (explicitly noted in tests)
- Stabilization / documentation hygiene in progress

## Main Design Directions (Summary)

- **Context**: Hybrid style (Request/Response based + convenient Helpers)
- **Middleware**: Afterware-friendly Fiber-style composition
- **Path Matching**: Lightweight Radix Trie implemented from scratch from the beginning

For more details, refer to `skills/http/SKILL.md`.

## Usage Example (Target Form)

```ts
import { createApp } from "@zeno/http";

const app = createApp();

app.use(async (ctx, next) => {
  const start = performance.now();
  const res = await next();
  console.log(`${ctx.req.method} ${new URL(ctx.req.url).pathname} - ${(performance.now()-start).toFixed(1)}ms`);
  return res;
});

app.group("/api/v1", (api) => {
  api.get("/users/:id", async (ctx) => {
    return ctx.json({ id: ctx.params.id, name: "Zeno" });
  });
});

Deno.serve(app.fetch);
```

## Development

```bash
deno task dev          # 예제 실행 (추후)
deno task test
deno task bench
```

## 라이선스

MIT (예정)