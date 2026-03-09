/**
 * Secure localStorage wrapper.
 * Encodes data as base64 to prevent casual inspection.
 * For true encryption, use the AES-GCM encryption module with a per-session key.
 */

const PREFIX = "__lcb_";

export const secureStorage = {
  set(key: string, value: unknown): void {
    try {
      const json = JSON.stringify(value);
      const encoded = btoa(unescape(encodeURIComponent(json)));
      localStorage.setItem(PREFIX + key, encoded);
    } catch {
      // Quota exceeded or encoding error — silently fail
    }
  },

  get<T = unknown>(key: string): T | null {
    try {
      const encoded = localStorage.getItem(PREFIX + key);
      if (!encoded) return null;
      const json = decodeURIComponent(escape(atob(encoded)));
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  },

  remove(key: string): void {
    localStorage.removeItem(PREFIX + key);
  },

  /** Scan for keys matching a prefix (legacy draft migration) */
  scanKeys(prefix: string): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX + prefix)) {
        keys.push(k.slice(PREFIX.length));
      }
    }
    return keys;
  },
};
