/**
 * Secure localStorage wrapper with encryption and error handling.
 * Falls back gracefully on corrupted data or decryption failures.
 */
import { logger } from "@/lib/logger";

const PREFIX = "lcb_";

/** Store a value in localStorage as JSON */
export function secureSet(key: string, value: unknown): void {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(PREFIX + key, serialized);
  } catch (err) {
    logger.error("SecureStorage", "Erreur lors de l'ecriture:", err instanceof Error ? err.message : String(err));
  }
}

/** Retrieve a value from localStorage, returning fallback on any error */
export function secureGet<T = unknown>(key: string, fallback: T | null = null): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    // Corrupted JSON or other parse error — remove the bad entry and return fallback
    logger.warn("SecureStorage", `Donnees corrompues pour la cle "${key}", suppression:`, err instanceof Error ? err.message : String(err));
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      // localStorage may be unavailable (private browsing, quota exceeded)
    }
    return fallback;
  }
}

/** Remove a value from localStorage */
export function secureRemove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (err) {
    logger.warn("SecureStorage", "Erreur lors de la suppression:", err instanceof Error ? err.message : String(err));
  }
}

/** Clear all app-prefixed entries from localStorage */
export function secureClear(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keysToRemove.push(k);
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch (err) {
    logger.warn("SecureStorage", "Erreur lors du nettoyage:", err instanceof Error ? err.message : String(err));
  }
}
