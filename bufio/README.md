# @zeno/bufio

Zero-dependency, high-performance buffered I/O library for Deno, inspired by Go's `bufio` package.

## Features

- **Sycall Minimization**: Reduces expensive OS read/write syscall overheads by buffering bytes in memory.
- **Go-like Line Streaming (`readLine`)**: Sequentially scans byte streams for lines, automatically stripping `\r` and `\n` line delimiters and correctly handling split buffers on line overflows.
- **Bypass Direct Transfer**: Automatically bypasses internal buffer copying if a single read/write chunk is larger than the buffer capacity, preventing dual memory copies.
- **Delimiter Lookups (`readString`)**: Seamlessly reads up to target character delimiters and decodes UTF-8 strings.
- **Zero External Dependencies**: Standard-compliant and built purely with native JS/TS web standards.

## Installation (when published)

```bash
deno add @zeno/bufio
```

**Note**: Source currently lives under `bufio/` inside the monorepo for monorepo dogfooding convenience. The public API surface is `@zeno/bufio`.

## Basic Usage

### 1. BufReader (Buffered Reading)

```ts
import { BufReader } from "@zeno/bufio";

// Wrap any standard Reader (socket, file, or custom mock)
const file = await Deno.open("large_file.txt", { read: true });
const reader = new BufReader(file, 4096); // 4KB buffer

// Read line sequentially (stripping line endings)
let res = await reader.readLine();
while (res !== null) {
  console.log("Line:", new TextDecoder().decode(res.line));
  if (res.more) {
    console.log(" (Line was split due to buffer limits)");
  }
  res = await reader.readLine();
}

file.close();
```

### 2. BufWriter (Buffered Writing)

```ts
import { BufWriter } from "@zeno/bufio";

const file = await Deno.open("output.txt", { write: true, create: true });
const writer = new BufWriter(file, 4096);

await writer.writeString("Hello Zeno Buffered Writer!\n");
await writer.writeByte(65); // Writes 'A'

// Flush remaining buffered bytes to Deno.Writer
await writer.flush();
file.close();
```

## Related

- **Authoritative design & decisions**: `../skills/bufio/SKILL.md` (the constitutional design specification)
- Part of the Zeno Deno library collection (dogfooding std + Web Standards)
