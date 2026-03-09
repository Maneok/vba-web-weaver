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

const MIN_LEVEL: LogLevel = IS_DEV ? "debug" : "error";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function formatPrefix(tag: string): string {
  return `[${tag}]`;
}

export const logger = {
  debug(tag: string, ...args: unknown[]) {
    if (shouldLog("debug")) console.log(formatPrefix(tag), ...args);
  },

  info(tag: string, ...args: unknown[]) {
    if (shouldLog("info")) console.log(formatPrefix(tag), ...args);
  },

  warn(tag: string, ...args: unknown[]) {
    if (shouldLog("warn")) console.warn(formatPrefix(tag), ...args);
  },

  error(tag: string, ...args: unknown[]) {
    if (shouldLog("error")) console.error(formatPrefix(tag), ...args);
    // Future: send to error tracking service
    // errorTracker.capture(tag, args);
  },
};
