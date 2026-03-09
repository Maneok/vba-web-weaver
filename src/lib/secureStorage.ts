/**
 * Secure localStorage wrapper.
 * Encodes data as base64 to prevent casual inspection.
 * For true encryption, use the AES-GCM encryption module with a per-session key.
 */

const PREFIX = "__lcb_";

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  // Chunked conversion to avoid stack overflow on large data
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
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
