/**
 * Client-side cryptographic utilities — ID generation, hashing, tokens.
 */

/** Generate a UUID v4 */
export function generateId(): string {
  // Use crypto API if available, fallback to Math.random
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Generate a SHA-256 hash of a string (async, uses Web Crypto API) */
export async function hashString(input: string): Promise<string> {
  if (!input) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  const array = Array.from(new Uint8Array(buffer));
  return array.map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Generate a cryptographically secure random token */
export function generateSecureToken(length: number = 32): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, "0")).join("").slice(0, length);
  }
  // Fallback
  let token = "";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}
