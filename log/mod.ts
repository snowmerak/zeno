/**
 * @zeno/log - Main entry point
 *
 * Provides a Go Logrus-inspired structured JSON logger with file rotation support.
 */

import { Logger } from "./logger.ts";
import { ConsoleWriter } from "./writer.ts";

export { Logger, Entry } from "./logger.ts";
export { ConsoleWriter, FileRotationWriter } from "./writer.ts";
export type { LogWriter, LogRecord } from "./types.ts";
export { LogLevel } from "./types.ts";

/**
 * Default pre-configured Logger instance writing to Console (stdout) at INFO level.
 */
export const log = new Logger({
  writers: [new ConsoleWriter()],
});
