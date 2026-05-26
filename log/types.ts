/**
 * Logging types for @zeno/log
 *
 * Defines basic types for structured JSON logging, including levels,
 * field mapping, and custom writers.
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export type Fields = Record<string, unknown>;

export interface LogRecord {
  time: string;
  level: LogLevel;
  msg: string;
  fields: Fields;
}

export interface LogWriter {
  /** Write a serialized log message to the destination */
  write(msg: string): Promise<void>;
  /** Optional close cleanup function */
  close?(): Promise<void>;
}
