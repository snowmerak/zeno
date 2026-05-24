# Benchmark Scripts

This directory collects scripts for performance measurement of @zeno/http.

## Goals

- raw `Deno.serve`
- `@zeno/http` (the one we built)
- Hono
- Oak

Compare and measure the above 4 under the same workload.

## Planned Work

- Simple hello world benchmark
- Path parameter benchmark
- Middleware chain benchmark

Measurement results will be documented under `docs/` or within `http/`.
