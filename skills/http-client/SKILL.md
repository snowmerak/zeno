# @zeno/http-client — Agent Skill

**Library**: `@zeno/http-client` **Status**: Planning / Early Design (2026-05) **Version of this
skill**: 0.1.0

---

## 1. Library Purpose

`@zeno/http-client` provides a **practical, class-based HTTP client library** for Deno, inspired by
Go's `net/http.Client`.

Deno ships with a capable `fetch`, but real-world usage repeatedly needs:

- `baseURL` + path combination with sensible joining
- Automatic JSON serialization (request body) and parsing (response)
- Per-request and default timeout handling (AbortSignal based)
- Request and Response interceptors (for auth, logging, transforms, etc.)
- Ergonomic query parameter handling
- Standardized, typed error handling for HTTP failures and timeouts
- Excellent TypeScript generics for response data

**Goal**: Deliver a lightweight, native-feeling HTTP client that captures the spirit of Go's
`http.Client` while fully embracing Web Standards (Request/Response/fetch) and staying within
`@std/*` + Deno builtins only.

---

## 2. Design Decisions (Locked)

### 2.1 API Style

**Chosen**: Class-based (Go `http.Client` style)

- `new HttpClient({ baseURL?, headers?, timeout? })`
- `client.get<T>()`, `client.post()`, `client.request(method, url, options)`
- Fluent interceptor registration: `.useRequestInterceptor(fn).useResponseInterceptor(fn)`
- Return value is always `HttpResponse<T>` (or throws `HttpError`/`TimeoutError`)

**Rationale**: Developers familiar with Go (or similar clients) get immediate productivity.
Consistent instance-based configuration (defaults + per-call overrides) is clearer than free
functions for clients that carry state (baseURL, headers, interceptors).

### 2.2 Implementation Constraints

**Chosen**: Use only `@std/*` and Web Standards / Deno builtins. Zero external dependencies.

- Dogfood `@std/assert`, `@std/async`, `@std/log`, `@std/testing` where useful.
- No `ky`, `axios`, `undici` wrappers, etc.
- Keep the implementation small and auditable.

### 2.3 Relationship with `@zeno/http`

- Completely separate library: `@zeno/http` = server/router, `@zeno/http-client` = client.
- **Strong dogfooding**: Use the existing `@zeno/http` (createApp + handlers) as the real test
  server for integration tests. No mocks for core happy-path and error scenarios.

### 2.4 Escape Hatches

- Always possible to reach raw `fetch`, `Request`, `Response`.
- `client.unwrap()` returns `{ fetch: typeof fetch }`.
- `HttpResponse.raw` gives the original `Response`.
- `RequestOptions.fetchOptions` and `signal` allow full control when needed.

### 2.5 Interceptor Model (Simple & Predictable)

- Two separate chains: request then response.
- Registered in order, executed in registration order (no priority).
- Request interceptors receive a mutable `Request` and must return it (or a new one).
- Response interceptors receive the `Response`. **Warning**: reading the body inside a response
  interceptor will consume the stream; downstream `parseResponse` or later interceptors will see an
  empty body. Clone if you need to inspect without consuming.
- Errors thrown inside interceptors propagate normally (treated as request failures).

### 2.6 Error Handling Philosophy

- Non-2xx responses → throw `HttpError` (contains status, statusText, data, raw Response).
- Timeouts and abort → `TimeoutError`.
- Network / fetch failures → re-thrown as-is (or wrapped only if we can add value without hiding).
- Callers can always catch specific errors or fall back to `raw` Response.

---

## 3. Scope (MVP / Current)

### In Scope

- `HttpClient` class with constructor options + fluent API
- Base URL + automatic path joining
- Query parameter object → URLSearchParams
- Automatic JSON body (object → JSON.stringify + content-type if not set)
- Response parsing: JSON (application/json), text (text/*), else `data: undefined`
- Timeout (default + per-request, AbortController based)
- Request + Response interceptors (arrays, async supported)
- `HttpError` and `TimeoutError` classes
- TypeScript generics on response data (`get<User>`, etc.)
- Escape hatches everywhere

### Out of Scope (for initial / current version)

- GraphQL-specific client
- WebSocket / SSE
- Advanced FormData / multipart / file uploads (basic bodies supported via fetchOptions)
- Custom redirect policy (respect native fetch behavior)
- Built-in retry (implement via interceptor or wrapper)
- Cookie jar / persistent state (can be done with interceptors)
- Full `HttpRequest` builder class separate from options (keep simple)

---

## 4. Dogfooding Targets

**Mandatory**:

- Web Standards (Request, Response, Headers, fetch, AbortController, URL)
- `@std/testing` (for structured tests)
- `@zeno/http` (as real integration server — the whole point of the monorepo)

**Optional / Future**:

- `@std/async` (delays, retry helpers if we add convenience later)
- `@zeno/net` (if we ever want a lower-level transport)

---

## 5. Testing Strategy

**Core Principle**: Real servers, not mocks, for everything that touches the network.

- Use `Deno.serve` + an `@zeno/http` app (createApp + routes + middleware) running on a random port
  (`port: 0`).
- Integration tests live in `tests/http-client/integration_test.ts`.
- Cover: success paths (typed JSON GET/POST), query params, custom headers, non-2xx error paths
  (expect HttpError + .data), timeouts (short timeout + slow handler), interceptor mutation +
  short-circuit, body variants (object, string, Uint8Array).
- Unit tests (if any) only for pure helpers (URL building, header merging, parse logic) — keep
  minimal.
- Always clean up servers (`server.shutdown()` in finally).
- Use `sanitizeResources: false, sanitizeOps: false` on server tests (standard for Deno.serve in
  tests).

See the actual `integration_test.ts` for the living example of this strategy.

---

## 6. Detailed API Specification (Authoritative)

### 6.1 HttpClient Class

```ts
export class HttpClient {
  constructor(options?: HttpClientOptions);

  // Fluent registration (chainable)
  useRequestInterceptor(interceptor: RequestInterceptor): this;
  useResponseInterceptor(interceptor: ResponseInterceptor): this;

  // Convenience methods (delegate to request)
  get<T = unknown>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>;
  post<T = unknown>(
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>>;
  put<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>>;
  patch<T = unknown>(
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>>;
  delete<T = unknown>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>;

  // Primary method
  request<T = unknown>(
    method: string,
    url: string,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>>;

  // Escape hatch
  unwrap(): { fetch: typeof fetch };
}
```

### 6.2 Options & Types

```ts
interface HttpClientOptions {
  baseURL?: string; // trailing slash normalized away
  headers?: HeadersInit; // default headers for every request
  timeout?: number; // default timeout in ms (can be overridden per request)
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: HeadersInit;
  body?: unknown; // object → auto JSON + content-type (unless already set)
  timeout?: number; // overrides client default
  signal?: AbortSignal;
  fetchOptions?: Omit<RequestInit, "method" | "headers" | "body" | "signal">;
}

interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Headers;
  data: T; // parsed according to content-type (json / text / undefined)
  raw: Response; // original response; body already consumed for .data
}

type RequestInterceptor = (req: Request) => Request | Promise<Request>;
type ResponseInterceptor = (res: Response) => Response | Promise<Response>;
```

### 6.3 URL Building Rules (buildURL)

- If baseURL present: strip trailing `/` from base, ensure path starts with `/`.
- Query: converted via URLSearchParams; falsy values (null/undefined) skipped.
- Existing `?` in path is respected when appending more params.

### 6.4 Body Handling (request method)

- If `body` is string or Uint8Array → pass through as-is.
- If object (non-null) → `JSON.stringify`, set `content-type: application/json` **only if not
  already present** in final headers.
- `null` / `undefined` body → no body sent.

### 6.5 Header Merging

- Start with client's default Headers.
- Per-request headers (via options.headers) are applied with `set` (later wins on same key).
- Case-insensitive via the `Headers` API.

### 6.6 Timeout Implementation

- Per-request `timeout` takes precedence over `HttpClientOptions.timeout`.
- If timeout > 0 and no external `signal`, create internal `AbortController`, schedule
  `setTimeout(abort, timeout)`.
- AbortError from DOMException → converted to `TimeoutError`.
- Always clear timeout in finally.

### 6.7 Response Parsing (parseResponse)

- If `content-type` contains `application/json` → try `res.json()`, on failure → `data = undefined`.
- Else if contains `text/` → `res.text()`.
- Otherwise → `data = undefined` (body consumed if possible).
- `raw` always points to the original Response (already read for .data).

### 6.8 Error Behavior

- After response interceptors, if `!res.ok` → throw `new HttpError(res, parsedData)`.
- `HttpError` extends Error, carries: `status`, `statusText`, `response` (raw), `data`.
- Timeout / abort during fetch → `TimeoutError`.
- Interceptor or fetch errors bubble up unchanged (unless TimeoutError mapping applies).

### 6.9 HttpError & TimeoutError

See `net/http-client/errors.ts` for exact implementation. They are exported from the package entry.

---

## 7. Current Implementation Status (as of 2026-05)

**Core implementation complete** (net/http-client/):

- Full `HttpClient` with all convenience methods + `request()`
- Interceptor chains (request + response)
- URL building, header merging, body auto-JSON, response parsing
- Timeout with AbortController + cleanup
- `HttpError` + `TimeoutError`
- Escape hatch (`unwrap`)
- Re-exports via `net/http-client/mod.ts`

**Tests**:

- `tests/http-client/integration_test.ts`: real-server integration using `@zeno/http` + `Deno.serve`
  (GET, POST JSON, typed responses) — passing.
- `client_test.ts`: placeholder (will be cleaned or removed once integration is authoritative).

**Docs**:

- `net/http-client/README.md` (initial)
- This SKILL.md (authoritative design + decisions)

**Known Placement Note**: Source currently lives under `net/http-client/` for monorepo convenience.
Public surface is presented as `@zeno/http-client`. Future JSR publishing may split it into its own
package while keeping the same import path.

---

## 8. Agent Principles & Workflow for This Library

- **Update this SKILL.md first** before any significant API change or new feature. It is the
  constitution.
- Every new behavior must be reflected here (signatures, edge cases, error semantics, limitations).
- When writing tests, prefer real `@zeno/http` servers and document why a particular route/handler
  exists in the test file.
- After implementation or test changes, run `deno task test:http-client` and ensure the SKILL.md
  still matches reality.
- All comments, READMEs, and docs in this area must be English (project convention since 2026-05).
- Be honest about limitations (Deno AbortSignal, body stream consumption in interceptors, etc.).

---

**This document (SKILL.md) is the constitution for `@zeno/http-client`.** All design decisions,
code, tests, and documentation must stay in sync with it.
