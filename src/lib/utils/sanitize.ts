/**
 * Input sanitization utilities — XSS prevention, safe filenames, URL validation.
 * Referenced in CLAUDE.md but was missing from the codebase.
 */

/** Strip all HTML tags from a string */
export function sanitizeHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim();
}

/** Sanitize user input for safe storage (XSS prevention) */
export function sanitizeInput(input: string): string {
  if (!input) return "";
  if (typeof input !== "string") return String(input);
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();
}

/** Escape regex special characters in a string */
export function escapeRegex(str: string): string {
  if (!str) return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Sanitize a filename (remove unsafe characters, limit length) */
export function sanitizeFilename(filename: string, maxLength: number = 200): string {
  if (!filename) return "fichier";
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, maxLength) || "fichier";
}

/** Validate and clean a URL (rejects javascript: and data: protocols) */
export function sanitizeUrl(url: string): { valid: boolean; cleaned: string; error?: string } {
  if (!url || typeof url !== "string") {
    return { valid: false, cleaned: "", error: "URL vide" };
  }

  const trimmed = url.trim();

  // Block dangerous protocols
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return { valid: false, cleaned: "", error: "Protocole non autorise" };
  }

  // Must be http(s) or relative
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/") || trimmed.startsWith("./")) {
    return { valid: true, cleaned: trimmed };
  }

  // Add https:// if looks like a domain
  if (/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed)) {
    return { valid: true, cleaned: `https://${trimmed}` };
  }

  return { valid: false, cleaned: "", error: "Format d'URL invalide" };
}
