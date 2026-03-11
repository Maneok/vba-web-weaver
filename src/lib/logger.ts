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

// OPT-47: Dedup repeated errors within a short window to avoid log spam
const _recentErrors = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000;
function isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = _recentErrors.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  _recentErrors.set(key, now);
  // Prune old entries periodically
  if (_recentErrors.size > 100) {
    for (const [k, t] of _recentErrors) {
      if (now - t > DEDUP_WINDOW_MS) _recentErrors.delete(k);
    }
  }
  return false;
}

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
    if (shouldLog("error")) {
      const dedupKey = `${tag}:${args[0]}`;
      if (isDuplicate(dedupKey)) return;
      console.error(formatPrefix("error", tag), ...args);
      // In production, capture stack trace for debugging
      if (!IS_DEV) {
        const err = args.find(a => a instanceof Error) as Error | undefined;
        if (err?.stack) console.error(formatPrefix("error", tag), "Stack:", err.stack);
      }
    }
  },
};
