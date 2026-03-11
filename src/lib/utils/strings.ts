/**
 * String manipulation utilities.
 * Handles French diacritical marks and accented characters.
 */

/** Strip diacritical marks (accents) from text */
export function normalizeAccents(text: string): string {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Truncate text to maxLength, appending ellipsis */
export function truncate(text: string, maxLength: number, ellipsis: string = "..."): string {
  if (!text) return "";
  if (maxLength < 1) return ellipsis;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + ellipsis;
}

/** Capitalize first letter, lowercase the rest */
export function capitalize(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/** Extract initials from a full name */
export function getInitials(fullName: string, maxChars: number = 2): string {
  if (!fullName || !fullName.trim()) return "";
  const parts = fullName.trim().split(/[\s\-]+/).filter(Boolean);
  const initials = parts.map(p => p.charAt(0).toUpperCase()).join("");
  return initials.slice(0, Math.max(1, maxChars));
}

/** Convert text to URL-safe slug */
export function slugify(text: string): string {
  if (!text) return "";
  return normalizeAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Split text into highlighted/non-highlighted segments for search display */
export function highlightMatch(
  text: string,
  query: string
): Array<{ text: string; highlight: boolean }> {
  if (!text) return [];
  if (!query || !query.trim()) return [{ text, highlight: false }];

  const normalizedText = normalizeAccents(text.toLowerCase());
  const normalizedQuery = normalizeAccents(query.toLowerCase().trim());

  const segments: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;
  let searchFrom = 0;

  while (searchFrom < normalizedText.length) {
    const idx = normalizedText.indexOf(normalizedQuery, searchFrom);
    if (idx === -1) break;

    if (idx > lastIndex) {
      segments.push({ text: text.slice(lastIndex, idx), highlight: false });
    }
    segments.push({ text: text.slice(idx, idx + normalizedQuery.length), highlight: true });
    lastIndex = idx + normalizedQuery.length;
    searchFrom = lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false });
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }];
}
