# Zeno

**Deno Library Collection** — A project that builds various useful Deno libraries from scratch and **dogfoods** many libraries from the Deno ecosystem in the process.

## Goals

- Deeply understand Deno while building practical libraries
- When building each library, actually use **as many Deno/JSR libraries as possible**
- Write and maintain **agent skills** together with the code so that AI agents (including future Grok) can accurately understand and use the libraries

## Current Libraries

| Library        | Description                                      | Status                              |
|----------------|--------------------------------------------------|-------------------------------------|
| `@zeno/http`   | Fiber-like HTTP Router (std only)                | Production-ready Core               |
| `@zeno/net`    | TCP/UDP networking library (Go `net`-inspired)   | Fully implemented (TCP & UDP)       |
| `@zeno/log`    | Structured JSON logger with file rotation        | Fully implemented (Logrus style)    |
| `@zeno/http-client` | Class-based HTTP client (Go `http.Client` style) | Fully implemented (Interceptors)    |

## Getting Started

```bash
# Run example server
deno task dev

# Run all tests (including HTTP, TCP, UDP, Logger, and HTTP Client)
deno task test
```

## Important Rule (Agent Skills)

One of the core philosophies of this project:

> **Whenever you add or change a feature, you must also write/update the corresponding agent skill.**

- `skills/http/SKILL.md`, `skills/net/SKILL.md`, `skills/log/SKILL.md`, and `skills/http-client/SKILL.md` are the official design documents.
- Code changes ↔ skill updates must always happen together.

## Structure

```
zeno/
├── http/                 # @zeno/http (Fiber-like router)
├── net/                  # @zeno/net (TCP/UDP Go-inspired networking)
│   └── http-client/      # @zeno/http-client (Client request suite)
├── log/                  # @zeno/log (Logrus-inspired structured JSON logger)
├── skills/               # Agent skills (http/, net/, log/, http-client/)
├── examples/             # Library usage examples (self-dogfood)
├── tests/                # Core test suites
├── scripts/bench/        # Performance benchmarking
└── deno.json
```

For more details, refer to each library's subdirectory README and the corresponding skill document in the `skills/` directory.

## License

MIT (planned)
