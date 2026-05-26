/**
 * Log writers for @zeno/log
 *
 * Implements ConsoleWriter and a size-based FileRotationWriter
 * built from scratch on Deno without any external dependencies.
 */

import type { LogWriter } from "./types.ts";

/**
 * ConsoleWriter - Writes serialized log messages to Deno.stdout or Deno.stderr
 */
export class ConsoleWriter implements LogWriter {
  private encoder = new TextEncoder();

  constructor(private useStderr = false) {}

  async write(msg: string): Promise<void> {
    const data = this.encoder.encode(msg + "\n");
    const stream = this.useStderr ? Deno.stderr : Deno.stdout;
    await stream.write(data);
  }
}

export interface FileRotationWriterOptions {
  /** Target log file path (e.g. "app.log") */
  filename: string;
  /** Maximum file size in bytes before rotating (e.g. 10 * 1024 * 1024) */
  maxSize: number;
  /** Maximum number of rolled backup files to keep (default: 5) */
  maxBackups?: number;
}

/**
 * FileRotationWriter - Writes to a log file, automatically rolling it over
 * when the file size exceeds a configured limit.
 *
 * Employs a thread-safe promise queue to guarantee sequential execution of all
 * file check, rotation, and write operations.
 */
export class FileRotationWriter implements LogWriter {
  private _file?: Deno.FsFile;
  private _currentSize = 0;
  private _encoder = new TextEncoder();
  private _queue = new AsyncQueue();
  private _maxBackups: number;

  constructor(private options: FileRotationWriterOptions) {
    this._maxBackups = options.maxBackups ?? 5;
  }

  async write(msg: string): Promise<void> {
    const data = this._encoder.encode(msg + "\n");
    await this._queue.enqueue(async () => {
      await this.ensureFileOpen();

      // Check if we need to rotate
      if (this._currentSize + data.length > this.options.maxSize) {
        await this.rotate();
      }

      if (this._file) {
        await this._file.write(data);
        this._currentSize += data.length;
      }
    });
  }

  async close(): Promise<void> {
    await this._queue.enqueue(async () => {
      if (this._file) {
        this._file.close();
        this._file = undefined;
      }
    });
  }

  private async ensureFileOpen(): Promise<void> {
    if (this._file) {
      return;
    }

    // Lazy open file
    try {
      this._file = await Deno.open(this.options.filename, {
        write: true,
        create: true,
        append: true,
      });

      // Retrieve current file size
      const stat = await Deno.stat(this.options.filename);
      this._currentSize = stat.size;
    } catch (err) {
      console.error(`[@zeno/log] Failed to open log file ${this.options.filename}:`, err);
    }
  }

  private async rotate(): Promise<void> {
    // 1. Close current file
    if (this._file) {
      this._file.close();
      this._file = undefined;
    }

    const baseName = this.options.filename;

    // 2. Remove oldest backup exceeding maxBackups limit
    const oldestBackup = `${baseName}.${this._maxBackups}`;
    try {
      await Deno.remove(oldestBackup);
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) {
        throw err;
      }
    }

    // 3. Roll over existing backups (e.g. app.log.4 -> app.log.5)
    for (let i = this._maxBackups - 1; i >= 1; i--) {
      const oldPath = `${baseName}.${i}`;
      const newPath = `${baseName}.${i + 1}`;
      try {
        await Deno.rename(oldPath, newPath);
      } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
          throw err;
        }
      }
    }

    // 4. Rename current active file to app.log.1
    try {
      await Deno.rename(baseName, `${baseName}.1`);
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) {
        throw err;
      }
    }

    // 5. Create fresh active log file
    this._file = await Deno.open(baseName, {
      write: true,
      create: true,
      append: true,
    });
    this._currentSize = 0;
  }
}

/**
 * Lightweight sequential promise queue to prevent write interleaving and state races
 */
class AsyncQueue {
  private promise: Promise<void> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.promise.then(fn);
    this.promise = next.then(
      () => {},
      () => {},
    );
    return next;
  }
}
