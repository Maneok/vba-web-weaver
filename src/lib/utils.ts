import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compute user/entity initials (max 2 chars) from a display name */
export function getUserInitials(name: string | undefined | null): string {
  if (!name?.trim()) return "U";
  const parts = name.trim().split(/[\s-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// OPT-U1: Format a number with French locale (e.g. 1 234,56 €)
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// OPT-U2: Format euros
export function formatEuros(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });
}

// OPT-U3: Pluralize a French word (simple s-suffix)
export function pluralize(count: number, singular: string, plural?: string): string {
  return count <= 1 ? singular : (plural ?? singular + "s");
}

// OPT-U4: Capitalize first letter
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// OPT-U5: Truncate text with ellipsis
export function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen - 1) + "\u2026";
}

// OPT-U6: Generate a deterministic color hue from a string (for avatars)
export function stringToHue(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}
