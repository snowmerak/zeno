# @zeno/bufio — Agent Skill

**Library**: `@zeno/bufio` (Go-inspired high-performance buffered I/O library for Deno)
**Status**: BufReader sliding limits, BufWriter direct-bypass flushes, and line normalizations complete (2026-05)
**Version of this skill**: 1.0.0 (Initial release)

---

## 1. Library Purpose

`@zeno/bufio` provides a highly optimized buffered reading and writing layer. It wraps any generic JS/TS stream reader or writer to cache minor operations in memory, preventing redundant OS-level read/write syscall overheads, and exposing standard Go-like parsing utilities.

---

## 2. API Architecture

### 2.1 Reader & Writer Contracts (`types.ts`)
```ts
export interface Reader {
  read(p: Uint8Array): Promise<number | null>;
}
export interface Writer {
  write(p: Uint8Array): Promise<number>;
}
```

### 2.2 BufReader (Buffered Reading, `reader.ts`)
Maintains a sliding buffer (`buf`) with read pointer `r` and write pointer `w`.

* **`read(p)`**: Instantly satisfies reads from cache. Bypasses buffering to prevent double-copying if `p.length >= buf.length`.
* **`readByte()`**: Fetches and returns exactly 1 byte.
* **`readLine()`**: Scans up to `\n`, returning the line with `\r` and `\n` stripped. Handles split chunks on buffer limit overflows via `more: true`.
* **`readString(delim)`**: Decodes a UTF-8 string up to a character delimiter.

```ts
import { BufReader } from "@zeno/bufio";

const reader = new BufReader(rawConn, 4096);
const lineRes = await reader.readLine();
if (lineRes) {
  console.log("Line:", new TextDecoder().decode(lineRes.line));
}
```

### 2.3 BufWriter (Buffered Writing, `writer.ts`)
Aggregates minor byte writes into memory.

* **`write(p)`**: Adds bytes to buffer. If the data exceeds the buffer capacity, it flushes the buffer and writes directly to avoid double-copying.
* **`writeByte(c)`**: Caches exactly 1 byte.
* **`writeString(s)`**: Encodes and buffers a string.
* **`flush()`**: Flushes remaining bytes to the underlying writer sequentially.

```ts
import { BufWriter } from "@zeno/bufio";

const writer = new BufWriter(rawConn, 4096);
await writer.writeString("Ping\n");
await writer.flush();
```

---

## 3. Design Decisions & Trade-offs

1. **Sliding Memory Shift**: `BufReader` leverages V8-native `copyWithin` to shift unread bytes to the beginning of the buffer before `fill()`, ensuring $O(1)$ allocations.
2. **Standard Rollover Splits**: Matches Go's exact line split design contract: if a line is longer than the buffer capacity, it returns the buffer limit slice immediately and marks `more = true`.
3. **No Double-Copy Bypass**: Direct write and read bypass logic ensures that large payload arrays are read/written directly from/to the OS file descriptor without redundant copy sweeps into the intermediate cache.
