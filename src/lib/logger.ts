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

/** Keys whose values must be redacted in logged objects to prevent credential leaks */
const SENSITIVE_KEYS = new Set([
  "password", "mot_de_passe", "token", "access_token", "refresh_token",
  "secret", "api_key", "apikey", "authorization", "encryption_key",
  "credit_card", "carte", "iban", "bic", "cvv", "ssn",
]);

/** Deep-redact sensitive fields from an object before logging */
function redactSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value;
  if (value instanceof Error) return value;
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      redacted[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : redactSensitive(v);
    }
    return redacted;
  }
  return value;
}

/** Redact sensitive fields from log arguments */
function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map(redactSensitive);
}

export const logger = {
  debug(tag: string, ...args: unknown[]): void {
    if (shouldLog("debug")) console.log(formatPrefix("debug", tag), ...sanitizeArgs(args));
  },

  info(tag: string, ...args: unknown[]): void {
    if (shouldLog("info")) console.log(formatPrefix("info", tag), ...sanitizeArgs(args));
  },

  warn(tag: string, ...args: unknown[]): void {
    if (shouldLog("warn")) console.warn(formatPrefix("warn", tag), ...sanitizeArgs(args));
  },

  error(tag: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      // OPT: Early dedup check before building format prefix
      if (isDuplicate(`${tag}:${args[0]}`)) return;
      console.error(formatPrefix("error", tag), ...sanitizeArgs(args));
      // In production, capture stack trace for debugging
      if (!IS_DEV) {
        const err = args.find(a => a instanceof Error) as Error | undefined;
        if (err?.stack) console.error(formatPrefix("error", tag), "Stack:", err.stack);
      }
    }
  },

  // OPT-LOG1: Performance timing helper — measures duration of async operations
  async time<T>(tag: string, label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      if (shouldLog("debug")) {
        console.log(formatPrefix("debug", tag), `${label}: ${(performance.now() - start).toFixed(1)}ms`);
      }
      return result;
    } catch (e) {
      if (shouldLog("error")) {
        console.error(formatPrefix("error", tag), `${label} failed after ${(performance.now() - start).toFixed(1)}ms`);
      }
      throw e;
    }
  },

  // OPT-LOG2: Group related logs together for cleaner dev console
  group(tag: string, label: string): void {
    if (IS_DEV) console.groupCollapsed(formatPrefix("debug", tag), label);
  },
  groupEnd(): void {
    if (IS_DEV) console.groupEnd();
  },
};
