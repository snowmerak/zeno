# @zeno/net Test Strategy

This directory contains tests for the `@zeno/net` library.

## Overall Philosophy (Documented during phase C)

Testing a networking library is significantly more difficult than testing a normal application.
Main reasons:

- A server and client (or listener and connection) must exist and interact simultaneously.
- Asynchronous behavior + resource management issues (missing `close` calls make tests flaky).
- We must also verify that escape hatches (`unwrap()`) work correctly.

### Core Principles

1. **Actively use helpers**
   - Maximize the use of `withTestListener`, `withConnectedPair`, `connectToListener`, etc.
   - Do not manually repeat `listen` + `dial` + `close` in every test.

2. **Focus tests on realistic usage scenarios**
   - Instead of trivial tests like "does the object get created?",
     verify real flows: accept → connect → read/write → close.

3. **Explicitly test error paths**
   - Operations after close
   - Behavior when the peer closes first
   - Dialing with an invalid address

4. **Escape hatch verification is mandatory**
   - Confirm that raw `Deno.Listener` / `Deno.Conn` obtained via `unwrap()` work correctly.
   - If this breaks, the value of the library drops significantly.

5. **Minimize flakiness**
   - Avoid tests that heavily depend on timing whenever possible.
   - Inside helpers, clean up resources as safely as possible.

## Directory Structure

- `tcp/` — TCP-related tests
- `test_utils.ts` — Common test helpers (most important)

## Future Direction

- Once TCP tests become reasonably stable, we will add more complex scenarios
  (concurrent connections, graceful shutdown, framing helpers, etc.).
- When UDP support begins, the `udp/` directory will follow the same strategy.
