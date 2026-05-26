/**
 * Logger and Entry implementations for @zeno/log
 *
 * Implements Logrus-inspired dynamic structured JSON logging using immutable Entry chains.
 */

import { Fields, LogLevel, LogWriter } from "./types.ts";

export class Logger {
  public level: LogLevel = LogLevel.INFO;
  public writers: LogWriter[] = [];

  constructor(options: { level?: LogLevel; writers?: LogWriter[] } = {}) {
    if (options.level) {
      this.level = options.level;
    }
    if (options.writers) {
      this.writers = options.writers;
    }
  }

  withFields(fields: Fields): Entry {
    return new Entry(this, fields);
  }

  withField(key: string, value: unknown): Entry {
    return new Entry(this, { [key]: value });
  }

  withError(err: Error): Entry {
    return new Entry(this, { error: err.message, stack: err.stack });
  }

  debug(msg: string) {
    this._log(LogLevel.DEBUG, msg);
  }

  info(msg: string) {
    this._log(LogLevel.INFO, msg);
  }

  warn(msg: string) {
    this._log(LogLevel.WARN, msg);
  }

  error(msg: string) {
    this._log(LogLevel.ERROR, msg);
  }

  /**
   * Internal logging function called by Entry and Logger itself.
   * Serializes the record to JSON and dispatches to all configured writers.
   */
  _log(level: LogLevel, msg: string, fields: Fields = {}) {
    if (this._shouldLog(level)) {
      const record = this.format(level, msg, fields);
      const serialized = JSON.stringify(record);
      for (const w of this.writers) {
        w.write(serialized).catch((err) => {
          console.error("[@zeno/log] Writer execution failure:", err);
        });
      }
    }
  }

  private _shouldLog(level: LogLevel): boolean {
    const priorities: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 1,
      [LogLevel.INFO]: 2,
      [LogLevel.WARN]: 3,
      [LogLevel.ERROR]: 4,
    };
    return priorities[level] >= priorities[this.level];
  }

  private format(level: LogLevel, msg: string, fields: Fields): Record<string, unknown> {
    return {
      time: new Date().toISOString(),
      level,
      msg,
      ...fields,
    };
  }
}

/**
 * Entry - Represents a structured log record context.
 * Implements immutable field chaining mimicking Go's Logrus Entry.
 */
export class Entry {
  private _fields: Fields;

  constructor(private _logger: Logger, initialFields: Fields = {}) {
    this._fields = { ...initialFields };
  }

  withFields(fields: Fields): Entry {
    return new Entry(this._logger, { ...this._fields, ...fields });
  }

  withField(key: string, value: unknown): Entry {
    return new Entry(this._logger, { ...this._fields, [key]: value });
  }

  withError(err: Error): Entry {
    return new Entry(this._logger, {
      ...this._fields,
      error: err.message,
      stack: err.stack,
    });
  }

  debug(msg: string) {
    this._logger._log(LogLevel.DEBUG, msg, this._fields);
  }

  info(msg: string) {
    this._logger._log(LogLevel.INFO, msg, this._fields);
  }

  warn(msg: string) {
    this._logger._log(LogLevel.WARN, msg, this._fields);
  }

  error(msg: string) {
    this._logger._log(LogLevel.ERROR, msg, this._fields);
  }
}
