/**
 * Security utility functions.
 */

/** Generate a cryptographically secure random token */
export function generateSecureToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hash for comparison (not for passwords — use bcrypt server-side) */
export async function hashForComparison(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, "0")).join("");
}

/** Sanitize filename for safe downloads (remove path traversal, special chars) */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") return "document";
  return filename
    .replace(/[/\\:*?"<>|]/g, "_")  // Remove OS-unsafe chars
    .replace(/\.\./g, "_")           // Remove path traversal
    .replace(/^\./, "_")             // No hidden files
    .replace(/\s+/g, "_")            // Spaces to underscores
    .slice(0, 200)                    // Max length
    .replace(/_+/g, "_")             // Collapse underscores
    .replace(/^_|_$/g, "");          // Trim underscores
}

/** Generate rate-limit key from action + identifier */
export function rateLimitKey(action: string, identifier: string): string {
  const minute = Math.floor(Date.now() / 60000);
  return `rl:${action}:${identifier}:${minute}`;
}
