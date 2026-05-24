# Zeno

**Deno Library Collection** — A project that builds various useful Deno libraries from scratch and **dogfoods** many libraries from the Deno ecosystem in the process.

## Goals

- Deeply understand Deno while building practical libraries
- When building each library, actually use **as many Deno/JSR libraries as possible**
- Write and maintain **agent skills** together with the code so that AI agents (including future Grok) can accurately understand and use the libraries

## Current Libraries

| Library        | Description                                      | Status                              |
|----------------|--------------------------------------------------|-------------------------------------|
| `@zeno/http`   | Fiber-like HTTP Router (std only)                | Early implementation                |
| `@zeno/net`    | TCP/UDP networking library (Go `net`-inspired)   | TCP basic implementation in progress |

(Planned: Redis client, HTTP client, etc.)

## Getting Started

```bash
# Run example server (placeholder)
deno task dev

# Run tests
deno task test
```

## Important Rule (Agent Skills)

One of the core philosophies of this project:

> **Whenever you add or change a feature, you must also write/update the corresponding agent skill.**

- `skills/http/SKILL.md` and `skills/net/SKILL.md` are the official design documents.
- Code changes ↔ skill updates must always happen together.

## Structure

```
zeno/
├── http/                 # @zeno/http (first library)
├── net/                  # @zeno/net (TCP/UDP networking)
├── skills/               # Agent skills (http/, net/, ...)
├── examples/             # Library usage examples (self-dogfood)
├── tests/
├── scripts/bench/        # Performance benchmarking
└── deno.json
```

For more details, refer to each library's subdirectory README and the corresponding skill document in the `skills/` directory.

## License

MIT (planned)
