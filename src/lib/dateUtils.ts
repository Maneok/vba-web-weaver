/**
 * Shared date formatting utilities — French locale.
 * Replaces duplicate implementations scattered across the codebase.
 */

export function formatDateFR(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr ?? "\u2014";
  }
}

export function formatDateTimeFR(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T"));
  if (isNaN(date.getTime())) return dateStr;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "A l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days}j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return -9999;
  const diff = target.getTime() - Date.now();
  // Use floor for consistent behavior: past dates return negative, future dates count full days
  // e.g. deadline 1 second ago → -1, deadline 23h from now → 0
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
