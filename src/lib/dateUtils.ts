/**
 * Shared date formatting utilities — French locale.
 * Replaces duplicate implementations scattered across the codebase.
 */

export function formatDateFR(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr ?? "\u2014";
  }
}

export function formatDateTimeFR(dateStr: string): string {
  if (!dateStr) return "\u2014";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR", {
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
  if (!dateStr) return "";
  const date = new Date(dateStr.includes("T") ? dateStr : dateStr.replace(/\s/, "T"));
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

const MS_PER_DAY = 86400000;

/** French public holidays for a given year (fixed + Easter-based) */
export function getFrenchHolidays(year: number): string[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fixed = [
    `${year}-01-01`, `${year}-05-01`, `${year}-05-08`,
    `${year}-07-14`, `${year}-08-15`, `${year}-11-01`,
    `${year}-11-11`, `${year}-12-25`,
  ];
  // Anonymous Gregorian Easter algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const lundiPaques = new Date(easter.getTime() + MS_PER_DAY);
  const ascension = new Date(easter.getTime() + 39 * MS_PER_DAY);
  const lundiPentecote = new Date(easter.getTime() + 50 * MS_PER_DAY);
  return [...fixed, fmt(lundiPaques), fmt(ascension), fmt(lundiPentecote)].sort();
}

/** Check if a date is a French business day */
export function isBusinessDay(dateStr: string): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  const iso = d.toISOString().split("T")[0];
  return !getFrenchHolidays(d.getFullYear()).includes(iso);
}

/** Add N business days to a date */
export function addBusinessDays(startDate: string, days: number): string {
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return startDate;
  let remaining = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;
  while (remaining > 0) {
    d.setDate(d.getDate() + direction);
    const iso = d.toISOString().split("T")[0];
    if (isBusinessDay(iso)) remaining--;
  }
  return d.toISOString().split("T")[0];
}

/** Check if date is within reasonable range */
export function isReasonableDate(dateStr: string, maxYearsPast = 100, maxYearsFuture = 10): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const minDate = new Date(now.getFullYear() - maxYearsPast, 0, 1);
  const maxDate = new Date(now.getFullYear() + maxYearsFuture, 11, 31);
  return d >= minDate && d <= maxDate;
}

/** Calculate days between two dates (absolute) */
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  return Math.abs(Math.floor((d2.getTime() - d1.getTime()) / MS_PER_DAY));
}

/** Check if date expires within N days */
export function isExpiringSoon(dateStr: string, withinDays: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const diff = (d.getTime() - Date.now()) / MS_PER_DAY;
  return diff > 0 && diff <= withinDays;
}

/** Get fiscal quarter (1-4) for a date */
export function getQuarter(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.floor(d.getMonth() / 3) + 1;
}
