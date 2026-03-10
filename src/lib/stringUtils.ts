/**
 * String manipulation & normalization utilities for French business data.
 */

/** Remove French diacritics (accents) from a string */
export function removeDiacritics(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Normalize company name: uppercase, strip legal suffixes, remove accents */
export function normalizeCompanyName(name: string): string {
  if (!name || typeof name !== "string") return "";
  let n = removeDiacritics(name).toUpperCase().trim();
  // Strip common legal suffixes
  const suffixes = [
    /\b(SARL|SAS|SA|SCI|SNC|EURL|SELAS|SELARL|SCP|EARL|SE|GIE)\b/g,
    /\b(SOCIETE|ENTREPRISE|COMPAGNIE|HOLDING|GROUPE|CABINET|OFFICE)\b/g,
  ];
  for (const re of suffixes) n = n.replace(re, "");
  return n.replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Normalize person name: uppercase, strip titles, remove accents */
export function normalizeName(name: string): string {
  if (!name || typeof name !== "string") return "";
  let n = removeDiacritics(name).toUpperCase().trim();
  // Remove titles (M., MME, MR, etc.) — match with optional trailing period
  n = n.replace(/\b(MME|MR|MRS|DR|PROF|MAITRE|ME)\b\.?/g, "");
  n = n.replace(/\bM\.\s?/g, "");
  return n.replace(/\s+/g, " ").trim();
}

/** Remove excess whitespace (tabs, newlines, multiple spaces) */
export function normalizeWhitespace(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text.replace(/[\t\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Truncate text with ellipsis, never breaking mid-word */
export function truncateText(text: string, maxLen: number, suffix = "..."): string {
  if (!text || typeof text !== "string") return "";
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen - suffix.length);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > maxLen * 0.5 ? truncated.slice(0, lastSpace) : truncated) + suffix;
}

/** Generate URL-safe slug from text */
export function slugify(text: string): string {
  if (!text || typeof text !== "string") return "";
  return removeDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Mask sensitive data for display (IBAN, email, phone) */
export function maskSensitiveData(value: string, type: "iban" | "email" | "phone" | "siren"): string {
  if (!value || typeof value !== "string") return "";
  switch (type) {
    case "iban": {
      const clean = value.replace(/\s/g, "");
      if (clean.length < 8) return "****";
      return clean.slice(0, 4) + " **** **** " + clean.slice(-4);
    }
    case "email": {
      const [local, domain] = value.split("@");
      if (!domain) return "****";
      return local.slice(0, 2) + "***@" + domain;
    }
    case "phone": {
      if (value.length < 6) return "****";
      return value.slice(0, 3) + " ** ** " + value.slice(-2);
    }
    case "siren": {
      const clean = value.replace(/\s/g, "");
      if (clean.length < 5) return "***";
      return clean.slice(0, 3) + " *** " + clean.slice(-3);
    }
  }
}

/** Extract initials from a name (max 3 chars) */
export function extractInitials(name: string, maxLen = 3): string {
  if (!name || typeof name !== "string") return "";
  return name
    .split(/[\s-]+/)
    .filter(p => p.length > 0)
    .map(p => p[0].toUpperCase())
    .slice(0, maxLen)
    .join("");
}
