import { logger } from "@/lib/logger";

// Clé lue depuis variable d'environnement — OBLIGATOIRE, pas de fallback
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;
const ENCRYPTION_SALT = import.meta.env.VITE_ENCRYPTION_SALT;

if (!ENCRYPTION_KEY || !ENCRYPTION_SALT) {
  logger.error("[Encryption] VITE_ENCRYPTION_KEY and VITE_ENCRYPTION_SALT must be set");
}

// FIX 14: Cache derived key — PBKDF2 with 1M iterations is expensive
let _cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;
  if (!ENCRYPTION_KEY || !ENCRYPTION_SALT) throw new Error("Encryption keys not configured");
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(ENCRYPTION_KEY),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  _cachedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode(ENCRYPTION_SALT || ""), iterations: 1000000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  return _cachedKey;
}

export async function encryptField(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  if (!ENCRYPTION_KEY || !ENCRYPTION_SALT) throw new Error("Encryption keys not configured");
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  // Use chunked conversion to avoid "Maximum call stack size exceeded" on large data
  let binary = "";
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

export async function decryptField(encrypted: string): Promise<string> {
  if (!encrypted) return "";
  if (!ENCRYPTION_KEY || !ENCRYPTION_SALT) throw new Error("Encryption keys not configured");
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    // FIX 15: Never return raw ciphertext — return masked placeholder
    return "••••••••";
  }
}
