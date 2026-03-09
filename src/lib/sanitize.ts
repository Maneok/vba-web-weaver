/**
 * Input sanitization utilities for LCB-FT platform.
 * Prevents XSS, injection, and ensures data quality.
 */

const MAX_TEXT_LENGTH = 500;

/** Strip HTML tags, trim whitespace, and limit length. */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

/** Trim, lowercase, and validate email format. Returns empty string if invalid. */
export function sanitizeEmail(input: string): string {
  const cleaned = input.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : "";
}

/** Strip non-digits and validate SIREN (9 digits) or SIRET (14 digits). Returns empty string if invalid. */
export function sanitizeSiren(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 9 || digits.length === 14) return digits;
  return "";
}

/** Escape HTML special characters to prevent XSS. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
