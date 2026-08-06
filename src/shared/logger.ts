/**
 * @fileoverview Logger utility for structured logging across the application.
 * Provides contextual logging with timestamps and severity levels. Messages are
 * prefixed with a UTC timestamp, the severity level, and a per-instance context
 * label. The minimum emitted level is resolved once from the LOG_LEVEL
 * environment variable, defaulting to DEBUG.
 */

/**
 * Log severity levels for filtering output. Higher values are more severe.
 * @enum {number} LogLevel
 */
export enum LogLevel {
  /** Fine-grained diagnostic output for development. */
  DEBUG = 0,
  /** General informational output about normal operation. */
  INFO = 1,
  /** Potentially harmful situations that are not fatal. */
  WARN = 2,
  /** Errors that should be investigated and addressed. */
  ERROR = 3,
}

/**
 * Resolves the minimum log level from the LOG_LEVEL environment variable.
 * Recognizes 'DEBUG', 'INFO', 'WARN', and 'ERROR' (case-insensitive); unset or
 * unknown values fall back to DEBUG. When `process` is undefined (e.g. in
 * browser-like contexts) the default DEBUG level is used.
 * @returns {LogLevel} The configured minimum log level.
 */
function getLogLevel(): LogLevel {
  if (typeof process !== 'undefined' && process.env && process.env.LOG_LEVEL) {
    const level = process.env.LOG_LEVEL.toUpperCase();
    if (level === 'DEBUG') return LogLevel.DEBUG;
    if (level === 'INFO') return LogLevel.INFO;
    if (level === 'WARN') return LogLevel.WARN;
    if (level === 'ERROR') return LogLevel.ERROR;
  }
  return LogLevel.DEBUG;
}

/**
 * Returns the current time as an ISO-8601 UTC timestamp.
 * @returns {string} The current date/time in ISO format.
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * The minimum log level resolved once at module load time. Messages with a
 * severity below this level are suppressed by the Logger methods.
 * @const {LogLevel} currentLevel
 */
const currentLevel = getLogLevel();

/**
 * Structured logger that prefixes messages with a UTC timestamp, the severity
 * level, and a per-instance context label. The context lets messages be
 * attributed to a specific subsystem (e.g. 'Transcoder' or 'QueueManager').
 * @class Logger
 */
export class Logger {
  /** Context label attached to every message written by this logger. */
  private context: string;

  /**
   * Creates a Logger bound to the given context label.
   * @param {string} context - The label identifying the logging subsystem.
   */
  constructor(context: string) {
    this.context = context;
  }

  /**
   * Logs a DEBUG message via console.log, unless the configured minimum level
   * is more severe than DEBUG.
   * @param {...unknown[]} args - Values to include in the message.
   * @returns {void}
   */
  debug(...args: unknown[]) {
    if (currentLevel > LogLevel.DEBUG) return;
    console.log(`[${getTimestamp()}] [DEBUG] [${this.context}]`, ...args);
  }

  /**
   * Logs an INFO message via console.log, unless the configured minimum level
   * is more severe than INFO.
   * @param {...unknown[]} args - Values to include in the message.
   * @returns {void}
   */
  info(...args: unknown[]) {
    if (currentLevel > LogLevel.INFO) return;
    console.log(`[${getTimestamp()}] [INFO] [${this.context}]`, ...args);
  }

  /**
   * Logs a WARN message via console.warn, unless the configured minimum level
   * is more severe than WARN.
   * @param {...unknown[]} args - Values to include in the message.
   * @returns {void}
   */
  warn(...args: unknown[]) {
    if (currentLevel > LogLevel.WARN) return;
    console.warn(`[${getTimestamp()}] [WARN] [${this.context}]`, ...args);
  }

  /**
   * Logs an ERROR message via console.error. Always emitted regardless of the
   * configured minimum log level.
   * @param {...unknown[]} args - Values to include in the message.
   * @returns {void}
   */
  error(...args: unknown[]) {
    console.error(`[${getTimestamp()}] [ERROR] [${this.context}]`, ...args);
  }
}
