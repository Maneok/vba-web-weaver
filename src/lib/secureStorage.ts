/**
 * Secure localStorage wrapper.
 * Encodes data as base64 to prevent casual inspection.
 * For true encryption, use the AES-GCM encryption module with a per-session key.
 */

const PREFIX = "__lcb_";

function utf8ToBase64(str: string): string {
  return btoa(new TextEncoder().encode(str).reduce((s, b) => s + String.fromCharCode(b), ""));
}

function base64ToUtf8(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export const secureStorage = {
  set(key: string, value: unknown): void {
    try {
      const json = JSON.stringify(value);
      const encoded = utf8ToBase64(json);
      localStorage.setItem(PREFIX + key, encoded);
    } catch {
      // Quota exceeded or encoding error — silently fail
    }
  },

  get<T = unknown>(key: string): T | null {
    try {
      const encoded = localStorage.getItem(PREFIX + key);
      if (!encoded) return null;
      const json = base64ToUtf8(encoded);
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      // Ignore
    }
  },

  /** Scan for keys matching a prefix (legacy draft migration) */
  scanKeys(prefix: string): string[] {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(PREFIX + prefix)) {
          keys.push(k.slice(PREFIX.length));
        }
      }
    } catch {
      // Ignore
    }
    return keys;
  },
};
