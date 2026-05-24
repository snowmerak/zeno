# @zeno/http — Agent Skill

**Library**: `@zeno/http` (Zeno project's first official library)
**Status**: Architecture locked + Core implementation largely complete (2026-05)
**Version of this skill**: 0.2.0 (post Group/Context refactor + stabilization phase)

---

## 1. Library Purpose

`@zeno/http` is a **pure Deno-native HTTP routing library** that provides a developer experience (DX) similar to **Go's Fiber** on Deno.

### Core Values
- **Fiber-like Ergonomics**: Intuitive routing, powerful Context, middleware, grouping
- **Maximum Dogfooding**: Built from scratch using only Deno's basic APIs (`Deno.serve`, Web Standards) and `@std/*` packages
- **Long-term Agent Friendliness**: Designed from the beginning so that AI agents (including future Grok) using this library can understand the exact API and intent through documentation

Existing frameworks such as Hono and Oak are **not used as a base**.  
They are only used as **comparison targets** and for **future adapter layers**.

---

## 2. Locked Architectural Decisions (2026-05)

This decision must be updated together with this skill file and plan.md when changed.

### 2.1 Context API — Hybrid Style
**Decision**: Based on Web Standard Request/Response, while providing rich helpers on Context for real usage

**Main interface direction** (example):
```ts
interface Context {
  req: Request;                    // Original Request (read-only)
  res: Response;                   // Response (initially basic, later in builder form)
  params: Record<string, string>;  // path parameter
  query: URLSearchParams;          // query string helper

  json<T = unknown>(data: T, init?: ResponseInit): Response;
  text(text: string, init?: ResponseInit): Response;
  // html, redirect, setCookie, getCookie etc. helpers
}
```

**Reason for choice**:
- Familiar to Deno users with Web APIs
- Provides convenient DX like Fiber (ctx.json(), ctx.params)
- Maximizes dogfooding opportunities (lots of logic that directly handles Request/Response)

### 2.2 Middleware — Afterware Friendly
**Decision**: Support a form where the response can be naturally modified **after** calling next()

**Basic signature direction**:
```ts
type Next = () => Promise<Response>;
type Middleware = (ctx: Context, next: Next) => Promise<Response | void>;
```

**Emphasis**:
- "After" work such as logging, response time measurement, header addition, compression, and error wrapping should be convenient
- Not just before-only, but aiming for the post-processing convenience that Fiber users expect

### 2.4 Group Implementation Approach (Locked + Option A)
**Decision**: RouterGroup does not inherit from Router. Instead, it is implemented as a separate class that only shares the `IRouteRegistrar` interface. It internally holds `parent: Router` and delegates route registration to the root.

**Reasons**:
- Router must be the single source of truth for the trie (actual routing state). Having a trie per Group would cause state dispersion and increased complexity.
- At route registration time, the group's middleware is eagerly combined (combinedHandlers) and inserted into the root trie.
- Nested groups capture parent middleware by passing it as `inherited` at construction time.
- Custom notFound/methodNotAllowed are registered per-prefix on the root and looked up accordingly.

Although this approach may "look inconvenient," it was chosen to keep the runtime request path simple and fast. (Lazy delegation at request time would incur the cost of traversing the group tree on every request.)

**Option A Application (2026-05)**: Under the above design, the goal is to make "up to 1~2 levels of nesting work practically well," and more extreme usage is explicitly documented as a limitation.

### 2.3 Path Matching — Lightweight Radix Trie (from scratch)
**Decision**: Build a lightweight Radix Tree / Trie data structure for URL routing **from scratch from the beginning**

**Target supported features** (sequentially after MVP):
- `:param` (required parameters)
- `*wildcard` or `:param*`
- Priority-based matching
- High accuracy + good performance

**Reason for choice**:
- One of the biggest dogfooding + learning values for @zeno/http
- Advantageous for long-term performance and feature extensibility
- The story of "building a Trie directly in Deno" itself is powerful

---

## 3. MVP Scope (Current Stage)

**Included (as of 2026-05, largely complete)**:
- Router + Context (Builder) core
- HTTP method routing + PathTrie
- Route grouping + middleware inheritance (including nested, some edges still weak)
- Group-level custom notFound/methodNotAllowed (works in most cases)
- Context helpers (status, json, text, html, redirect, cookies) - some residual weakness in cookie header reliability
- Middleware (afterware friendly)
- onError + 404/405 handling

**Clear weaknesses (currently actively managing, under Option A)**:
- Group: 1~2 levels of nesting + middleware are practically supported. 3+ levels + simultaneous use of custom notFound/methodNotAllowed are considered advanced usage (guarantee is weak).
- Context cookie: Some edge cases in Set-Cookie header merging after setCookie have insufficient reliability.
- These two areas are managed with a practical scope + clear documentation rather than pursuing "perfection".

**Intentionally excluded (after MVP)**:
- Validation, WebSocket, Static files, Template, etc. (recommended as separate middleware/libraries)

---

## 4. Dogfooding Targets (Actively Used in This Library)

### Mandatory / Main
- `@std/http`
- `@std/path`, `@std/fs`
- `@std/log` (base for logger middleware)
- `@std/testing` + `@std/assert`
- `@std/async`
- `@std/crypto` (for request id etc.)

### Comparison / Reference (No Direct Dependency)
- Hono, Oak (for performance/DX benchmarking and documentation)

---

## 5. Important Principles Agents Should Know

1. **Never import and use Hono or Oak** (unless for an adapter layer).
2. Context is a "convenient Web Standard wrapper", not a completely new abstraction.
3. The Path Trie implementation is the pride of this library. Accuracy and maintainability come before performance.
4. In middleware, "after" is considered more important than "before".
5. All major decisions are recorded in this SKILL.md and plan.md.

---

## 6. Usage Example (Future Form — Not Yet Implemented)

```ts
import { createApp } from "@zeno/http";

const app = createApp();

app.use(async (ctx, next) => {
  const start = Date.now();
  const res = await next();
  console.log(`${ctx.req.method} ${ctx.req.url} - ${Date.now() - start}ms`);
  return res;
});

app.group("/api", (api) => {
  api.get("/users/:id", async (ctx) => {
    const userId = ctx.params.id;
    const user = await getUser(userId);
    return ctx.json(user);
  });
});

Deno.serve(app.fetch); // or app.listen(...)
```

---

## 2.5 PathTrie (Radix Tree) Implementation Notes (2026-05 Update)

We implemented **PathTrie**, the core routing component of `@zeno/http`, from scratch. This is one of the biggest dogfooding values in this project.

### Implementation Approach
- **Correctness First**: Initially prioritized "all common HTTP routing patterns work correctly" over aggressive compression.
- For static segments, we applied basic Radix-style edge compression, but prioritized stability considering complexity when mixed with param/wildcard.
- In mid-2026-05, we added a large number of stress tests for shared prefixes (`/api/v1` vs `/api/v2` etc.), deep nesting, and priority, strengthening the insertion/find logic multiple times.

### Currently Supported Patterns (Reliable)
- Static paths (`/users/profile`)
- Named parameters (`/users/:id`, `/orgs/:orgId/repos/:repoId`)
- Catch-all wildcards (`/files/*`)
- Named wildcards (`/files/:path*`)
- Static + wildcard combinations (`/download/:version/*`)
- Priority: **static > param > wildcard** (at the same level)

### Priority Rules (Explicit)
1. Static segment has the highest priority
2. Next is Named Parameter (`:id`)
3. Finally Wildcard (`*` or `:name*`)

This rule is implemented by searching in the order of static → param → wildcard in `find()`.

### Major Design Decisions & Lessons (Obtained Through Dogfooding)
- When param and wildcard are supported at the same node, priority and continuation handling is very tricky. (It is often better to avoid mixing or clearly treat wildcard as a "last resort".)
- In cases with many shared prefixes (e.g. versioned APIs), it is essential to select the "longest common prefix" during insertion.
- Writing a large number of tests first (TDD-like) and improving the implementation while observing failing cases was very effective. We heavily used `@std/assert` + the Deno test runner.

### Current Limitations (Known Limitations)
- Some complex continuation cases when param and wildcard are at the same level are not yet perfect (in real routers, such mixing is often not recommended anyway).
- Character-level extreme compression is still at a conservative level (can be optimized later if needed).
- Delete (remove) functionality does not exist yet (will be added if needed).

### Test Strategy
- More than 14 tests in `tests/http/trie_test.ts` (static, param, wildcard, shared prefix stress, priority, etc.).
- Actively dogfooding `@std/assert` and `@std/testing`.

This content should continue to be updated as the Trie implementation progresses.

### Securing Router.fetch this-binding Safety (2026-05, during basic-api real server testing)

**Discovery Background**: During the "basic-api handler mass addition + kill & restart & curl test" phase, every request to `Deno.serve({ port }, app.fetch)` caused `TypeError: Cannot read properties of undefined (reading 'findRoute')` (router.ts:134). The latent bug surfaced as real usage paths increased after the Group refactor.

**Cause**: Because `fetch` was a regular class method (`async fetch(req)`), when a bare function reference was extracted, `this` became undefined (strict mode). All `this.findRoute`, `this.pathMethods`, `this.globalMiddlewares` etc. inside fetch broke. (In tests, `app.fetch(req)` direct calls preserved `this`, so they passed.)

**Solution**: Changed `fetch` to an instance arrow field
```ts
fetch = async (req: Request): Promise<Response> => {
  // ... existing body (all this. are safe)
};
```
Now `Deno.serve(app.fetch)`, `const h = app.fetch; h(req)`, and any callback passing are all safe.

**Impact and Lessons**:
- The `Deno.serve(app.fetch)` examples in examples/basic-api, http/README.md, and SKILL.md now **actually work**.
- When exposing Deno/Web API handlers externally, using an arrow field (or binding in the constructor) is a dogfooding best practice.
- This important stabilization fix was discovered while fulfilling the "kill → restart → actual curl test of new handlers (DELETE/PUT/search/POST body /error)" request.

We explicitly record such runtime this-binding issues so that future agents do not fall into the same trap.

---

## 7. When This Skill Needs to Be Updated

- When adding new helpers to the Context API
- When changing the middleware compose method
- When changing Trie implementation details
- When introducing new middleware patterns
- When changing JSR publishing related policies

**Rule**: Whenever there is an important change in the code, this file must also be updated together.

---

## 8. Related Documents

- Project plan.md (refer to the latest version in the sessions folder)
- Zeno MEMORY.md (top-level project conventions)
- Internal documents in the `http/` directory (after implementation)

---

**This skill is the "constitution" of @zeno/http.**  
Before starting implementation, understand this content sufficiently, and continue to update it as you implement.