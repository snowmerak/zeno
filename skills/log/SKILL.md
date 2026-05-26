# @zeno/log — Agent Skill

**Library**: `@zeno/log` (Structured JSON logging for Deno)
**Status**: Implementation complete (2026-05)
**Version of this skill**: 0.1.0 (initial specification)

---

## 1. Library Purpose

`@zeno/log` is a **zero-dependency, structured JSON logging library** for Deno, heavily inspired by Go's famous `logrus` package. It provides rich metadata chaining, standard logging levels, and built-in **size-based file rotation** out of the box.

### Core Values
* **Zero Dependencies**: Built strictly on Deno's native APIs and Web Standards.
* **Logrus-like Ergonomics**: Chain context effortlessly using `.withFields()`, `.withField()`, and `.withError()`.
* **TypeScript Performance Advantage**:
  * > [!TIP]
  * > In Go, structured logging with dynamic maps (`map[string]interface{}`) requires reflection and interface casting, which incurs a runtime performance penalty.
  * > In TypeScript, JavaScript objects (`Record<string, unknown>`) are **highly optimized native structures** at the V8 engine level. Chaining and serializing dynamic fields has virtually zero reflection overhead, making this pattern extremely fast and natural.
* **Thread-Safe File Rotation**: Built-in size-based rolling files using a sequential async queue.

---

## 2. API Design & Specifications

### 2.1 Log Levels
```ts
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}
```

### 2.2 Entry Chaining (Logrus Style)
Spawning entries creates **immutable Entry instances**. A parent logger or entry can spawn multiple independent entries without mutual state mutation.

```ts
import { log, Logger, ConsoleWriter, FileRotationWriter } from "@zeno/log";

// 1. Basic logging using default logger (Console at INFO)
log.info("App started");

// 2. Chaining fields
log.withFields({ user: "snow", ip: "127.0.0.1" })
   .withField("action", "login")
   .info("User successfully logged in");

// 3. Chaining errors
try {
  throw new Error("DB Connection timeout");
} catch (err) {
  log.withError(err).error("Database operation failed");
}
```

---

## 3. File Rotation Mechanism

`FileRotationWriter` implements size-based log file rolling:
* **Check on Write**: Every log entry check if `currentSize + newPayloadSize > maxSize`.
* **Backup Rollover**:
  * Deletes the oldest backup when rollover exceeds `maxBackups`.
  * Rolls over existing backups: `app.log.4` -> `app.log.5`, `app.log.3` -> `app.log.4`, etc.
  * Renames `app.log` -> `app.log.1`.
  * Re-opens a fresh `app.log` to continue active writes.
* **Thread-Safety Guarantee**:
  * Built-in `AsyncQueue` sequences all check, rename, delete, and write operations in a strictly ordered promise chain. This prevents concurrent file read/write interferences.

### Configuration Example
```ts
const rotatedWriter = new FileRotationWriter({
  filename: "./logs/app.log",
  maxSize: 10 * 1024 * 1024, // 10MB
  maxBackups: 5,             // keep up to 5 backups
});

const logger = new Logger({
  level: LogLevel.DEBUG,
  writers: [rotatedWriter, new ConsoleWriter()],
});
```

---

## 4. Verification & Testing Strategy

Tests reside in `tests/log/logger_test.ts` and focus on:
1. **Serialization Correctness**: Asserting that logged output is a valid JSON string containing `time`, `level`, `msg`, and all chained custom fields.
2. **Chaining Immutability**: Ensuring that calling `withFields` does not modify the base logger/entry state.
3. **Rollover Triggering**: Validating that size-bound writes successfully rollover, create backup files `.1`, `.2`, etc., and clean up files exceeding `maxBackups`.
4. **Concurrent Safety**: Stress-testing simultaneous writes to verify that the async queue successfully serializes writes.
