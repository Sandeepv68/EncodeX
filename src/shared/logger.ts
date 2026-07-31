export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

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

function getTimestamp(): string {
  return new Date().toISOString();
}

const currentLevel = getLogLevel();

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  debug(...args: unknown[]) {
    if (currentLevel > LogLevel.DEBUG) return;
    console.log(`[${getTimestamp()}] [DEBUG] [${this.context}]`, ...args);
  }

  info(...args: unknown[]) {
    if (currentLevel > LogLevel.INFO) return;
    console.log(`[${getTimestamp()}] [INFO] [${this.context}]`, ...args);
  }

  warn(...args: unknown[]) {
    if (currentLevel > LogLevel.WARN) return;
    console.warn(`[${getTimestamp()}] [WARN] [${this.context}]`, ...args);
  }

  error(...args: unknown[]) {
    console.error(`[${getTimestamp()}] [ERROR] [${this.context}]`, ...args);
  }
}
