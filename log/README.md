# @zeno/log

Structured JSON logging library for Deno, with an API inspired by Go's `logrus` package.

## Features

- **Logrus-inspired ergonomics**: Chain metadata context using `.withFields()`, `.withField()`, and `.withError()`.
- **High Performance**: Leverage native JavaScript objects (`Record<string, unknown>`) directly for structured logging, avoiding runtime reflection overhead.
- **Immutable Entry Spawning**: Spawning new entries creates a clean, independent `Entry` copy, preventing dynamic field leakage or concurrency conflicts.
- **Built-in File Rotation (`FileRotationWriter`)**: Size-based active log rolling, backup roll limits, and automatic rolling name rollover out of the box.
- **Thread Safety**: Integrated `AsyncQueue` guarantees fully serialized sequential execution for all check, rollover, and write operations, preventing concurrent file corruption.
- **Zero External Dependencies**: Built strictly on Deno native files system APIs and Web Standards.

## Installation (when published)

```bash
deno add @zeno/log
```

**Note**: Source currently lives under `log/` inside the monorepo for monorepo dogfooding convenience. The public API surface is `@zeno/log`.

## Basic Usage

```ts
import { log, Logger, ConsoleWriter, FileRotationWriter } from "@zeno/log";

// 1. Basic logging using the default pre-configured log instance (Console at INFO level)
log.info("App started successfully");

// 2. Chaining fields (Logrus-style)
log.withFields({ user: "snow", ip: "127.0.0.1" })
   .withField("action", "login")
   .info("User successfully logged in");

// 3. Chaining errors
try {
  throw new Error("Connection failed");
} catch (err) {
  log.withError(err).error("Database query execution failure");
}
```

## Log File Rotation

To log to a size-limited file that automatically rolls over:

```ts
import { Logger, LogLevel, FileRotationWriter, ConsoleWriter } from "@zeno/log";

// 1. Create a size-based rotation writer
const rotatedWriter = new FileRotationWriter({
  filename: "./logs/app.log",
  maxSize: 10 * 1024 * 1024, // 10MB limit before rolling over
  maxBackups: 5,             // keep up to 5 rolled backup files
});

// 2. Configure a Logger with multiple writers
const logger = new Logger({
  level: LogLevel.DEBUG,
  writers: [rotatedWriter, new ConsoleWriter()],
});

logger.debug("This goes to both the console and the rotated log file!");
```

### File Rollover Behavior
* When the size of `app.log` exceeds `maxSize` on a write operation:
  * Close the current active log handle.
  * Delete the oldest backup exceeding the limit: e.g. `app.log.5` is removed.
  * Roll over existing backups: `app.log.4` -> `app.log.5`, `app.log.3` -> `app.log.4`, ..., `app.log.1` -> `app.log.2`.
  * Rename active file `app.log` -> `app.log.1`.
  * Create a fresh active file `app.log` to continue writes.

---

## Limitations

- **String-only Custom Formatters**: Designed exclusively for high-performance structured JSON logging. Plain-text log formatters are out of scope.
- **Permissions**: Requires `--allow-read` and `--allow-write` permissions to write and roll log files.

## Related

- **Authoritative design & decisions**: `../skills/log/SKILL.md` (the "constitution")
- Part of the Zeno Deno library collection (dogfooding std + Web Standards)
