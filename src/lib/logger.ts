/**
 * Centralized logging service.
 * In production, logs are suppressed (except errors).
 * Can be extended to send errors to an external service (Sentry, LogRocket, etc.).
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const IS_DEV = import.meta.env.DEV;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = IS_DEV ? "debug" : "warn";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function timestamp(): string {
  return new Date().toISOString();
}

function formatPrefix(level: LogLevel, tag: string): string {
  return `${timestamp()} [${level.toUpperCase()}] [${tag}]`;
}

export const logger = {
  debug(tag: string, ...args: unknown[]): void {
    if (shouldLog("debug")) console.log(formatPrefix("debug", tag), ...args);
  },

  info(tag: string, ...args: unknown[]): void {
    if (shouldLog("info")) console.log(formatPrefix("info", tag), ...args);
  },

  warn(tag: string, ...args: unknown[]): void {
    if (shouldLog("warn")) console.warn(formatPrefix("warn", tag), ...args);
  },

  error(tag: string, ...args: unknown[]): void {
    if (shouldLog("error")) console.error(formatPrefix("error", tag), ...args);
  },
};
