/**
 * Input sanitization utilities — XSS prevention, safe filenames, URL validation.
 * Referenced in CLAUDE.md but was missing from the codebase.
 */

/** Strip all HTML tags from a string.
 * OPT-7: Decode entities BEFORE stripping tags to prevent &lt;script&gt; bypass. */
export function sanitizeHtml(input: string): string {
  if (!input) return "";
  // Phase 1: Decode HTML entities so encoded tags become real tags
  // OPT-43: Also handle numeric entities (&#60; &#x3C; etc.) to prevent bypass
  let decoded = input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  // Phase 2: Remove dangerous patterns before stripping tags
  decoded = decoded
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    // Strip event handler attributes (onerror=, onclick=, onload=, etc.)
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // Strip javascript: / vbscript: URLs
    .replace(/\b(?:java\s*script|vb\s*script)\s*:/gi, "")
    .replace(/<[^>]+>/g, "");
  return decoded.trim();
}

/** Sanitize user input for safe storage (XSS prevention) */
export function sanitizeInput(input: string): string {
  if (!input) return "";
  if (typeof input !== "string") return String(input);
  let cleaned = input;
  // Strip javascript: / vbscript: URLs (case-insensitive, handles whitespace obfuscation)
  cleaned = cleaned.replace(/\b(?:java\s*script|vb\s*script)\s*:/gi, "");
  // Strip event handler attributes (onerror, onclick, onload, etc.)
  cleaned = cleaned.replace(/\bon\w+\s*=/gi, "");
  return cleaned
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
