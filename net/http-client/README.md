# @zeno/http-client

A practical, class-based HTTP client for Deno, inspired by Go's `net/http.Client`.

## Features

- Class-based API (`new HttpClient({ baseURL, headers, timeout })`)
- Base URL + sensible path joining
- Automatic JSON request body + response parsing (with TypeScript generics)
- Ergonomic query parameter objects
- Timeout (default + per-request) via AbortController
- Request and Response interceptors (fluent registration)
- `HttpError` for non-2xx responses + `TimeoutError`
- Full escape hatches (`unwrap()`, `HttpResponse.raw`, `fetchOptions`)
- Zero external dependencies — only Web Standards + `@std/*`

## Installation (when published)

```bash
deno add @zeno/http-client
```

**Note**: Source currently lives under `net/http-client/` inside the monorepo for dogfooding
convenience. The public API surface is `@zeno/http-client`.

## Basic Usage

```ts
import { HttpClient } from "@zeno/http-client";

const client = new HttpClient({
  baseURL: "https://api.example.com",
  timeout: 5000,
  headers: { "User-Agent": "my-app/1.0" },
});

// GET with typed JSON response
const user = await client.get<User>("/users/42");
console.log(user.data.name);

// POST with automatic JSON serialization
await client.post("/users", {
  name: "Alice",
  email: "alice@example.com",
});

// Query parameters (objects are converted safely)
const search = await client.get("/search", {
  query: { q: "deno", limit: 10, active: true },
});
```

## Interceptors

Request interceptors run before the fetch (auth, logging, mutation).

Response interceptors run after the response arrives but before body parsing and error throwing.

```ts
client
  .useRequestInterceptor((req) => {
    req.headers.set("Authorization", `Bearer ${token}`);
    return req;
  })
  .useResponseInterceptor((res) => {
    console.log(`Response: ${res.status}`);
    return res;
  });
```

**Important**: Reading the body inside a response interceptor consumes the stream. Later code
(including `HttpResponse.data`) will see an empty body. Clone the response if you need to inspect
without side effects.

## Error Handling

```ts
import { HttpError, TimeoutError } from "@zeno/http-client";

try {
  const res = await client.get("/maybe-missing");
} catch (err) {
  if (err instanceof HttpError) {
    console.error(`HTTP ${err.status}:`, err.data);
    // err.response is the original Response
  } else if (err instanceof TimeoutError) {
    console.error("Request timed out");
  } else {
    throw err;
  }
}
```

Non-2xx responses always throw `HttpError` (with `.status`, `.data`, `.raw`).

## Timeout

Both client-level default and per-request overrides are supported:

```ts
const client = new HttpClient({ timeout: 5000 });

await client.get("/slow", { timeout: 100 }); // this call uses 100ms
```

## Testing & Dogfooding

All integration tests spin up a real `@zeno/http` server (using `createApp` + `Deno.serve` on a
random port) — no mocks. See `tests/http-client/integration_test.ts` and
`skills/http-client/SKILL.md` §5 for the strategy.

This is intentional dogfooding of both `@zeno/http` (server) and the client itself.

## Limitations (honest)

- No built-in retry or exponential backoff (easy to implement with an interceptor).
- Response body is a one-time stream: interceptors that read `.text()` / `.json()` prevent normal
  parsing.
- No cookie jar or persistent auth state (implement via interceptors if needed).
- Socket / transport options are not exposed (Deno limitation — use escape hatch to raw `fetch` /
  `Request` when required).
- Currently part of the monorepo source layout (`net/http-client`); JSR package may be published
  separately later under the same name.

## Comparison with Go `http.Client`

We aim for the same _feel_:

- One `HttpClient` instance holds configuration (baseURL, defaults, interceptors).
- Simple `client.Get(...)` / `client.Post(...)` / `client.Do(...)`-style `request(...)`.
- Explicit error types instead of always checking `Response.Status`.

We stay closer to Web Standards than to Go's `http.Request` struct.

## Related

- **Authoritative design & decisions**: `../skills/http-client/SKILL.md` (the "constitution")
- Sister library: `@zeno/http` (the server/router used for real integration tests)
- Part of the Zeno Deno library collection (dogfooding std + Web Standards)

## Contributing / Development

```bash
deno task test:http-client   # runs the real-server integration suite
deno lint net/http-client/
deno check net/http-client/
```

Always update `skills/http-client/SKILL.md` before changing the public API.
