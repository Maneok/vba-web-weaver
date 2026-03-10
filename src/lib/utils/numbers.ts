/**
 * Number formatting and manipulation utilities.
 * Centralizes scattered toLocaleString("fr-FR") calls.
 */

/** Format a number as currency (default EUR, French locale) */
export function formatCurrency(
  value: number | null | undefined,
  options?: { currency?: string; locale?: string; decimals?: number }
): string {
  const { currency = "EUR", locale = "fr-FR", decimals = 2 } = options ?? {};
  const num = value ?? 0;
  if (!isFinite(num)) return formatCurrency(0, options);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/** Parse a French-formatted currency string back to a number */
export function parseCurrency(text: string): number | null {
  if (!text || typeof text !== "string") return null;
  // Remove currency symbols, non-breaking spaces, regular spaces
  const cleaned = text
    .replace(/[€$£¥]/g, "")
    .replace(/[A-Z]{3}/g, "")        // Remove currency codes like EUR
    .replace(/\u00A0/g, "")          // non-breaking space
    .replace(/\s/g, "")              // regular spaces
    .replace(/\./g, "")              // thousands separator (FR uses .)
    .replace(",", ".")               // decimal separator (FR uses ,)
    .trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isFinite(num) ? num : null;
}

/** Clamp a number to [min, max] range */
export function clamp(value: number, min: number, max: number): number {
  if (!isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Round to N decimal places (avoids floating-point issues) */
export function roundTo(value: number, decimals: number = 2): number {
  if (!isFinite(value)) return 0;
  const factor = Math.pow(10, Math.max(0, Math.round(decimals)));
  return Math.round(value * factor) / factor;
}
