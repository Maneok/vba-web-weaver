/**
 * Shared date formatting utilities — French locale.
 * Replaces duplicate implementations scattered across the codebase.
 */

/**
 * Formate une date en français.
 * Formats disponibles :
 * - "long"    → "19 mars 2027"
 * - "short"   → "19/03/2027"
 * - "relative"→ "il y a 3 jours" / "dans 5 jours"
 * - "month"   → "mars 2027"
 * - "dayMonth"→ "19 mars"
 */
export function formatDateFr(
  date: string | Date | null | undefined,
  format: "long" | "short" | "relative" | "month" | "dayMonth" = "long"
): string {
  if (!date) return "—";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  const locale = "fr-FR";

  switch (format) {
    case "long":
      return d.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

    case "short":
      return d.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

    case "month":
      return d.toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      });

    case "dayMonth":
      return d.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
      });

    case "relative": {
      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "aujourd'hui";
      if (diffDays === 1) return "demain";
      if (diffDays === -1) return "hier";
      if (diffDays > 1 && diffDays <= 30) return `dans ${diffDays} jours`;
      if (diffDays < -1 && diffDays >= -30) return `il y a ${Math.abs(diffDays)} jours`;
      return d.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }

    default:
      return d.toLocaleDateString(locale);
  }
}

/**
 * Formate une date+heure en français.
 * Ex : "19 mars 2027 à 14h30"
 */
export function formatDateTimeFr(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  const datePart = d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");

  return `${datePart} à ${hours}h${minutes}`;
}

// D1: Handle more formats: "YYYY-MM" (no day), "DD/MM/YYYY", ISO timestamps
export function formatDateFR(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  try {
    const trimmed = dateStr.trim();

    // Handle "YYYY-MM" format (no day) → "février 2025"
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      const [y, m] = trimmed.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }

    // Handle "DD/MM/YYYY" format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split("/").map(Number);
      const d = new Date(year, month - 1, day);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    }

    const d = new Date(trimmed);
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

/** @deprecated Use formatDateFr(dateStr, "relative") instead */
export function formatDateRelative(dateStr: string): string {
  return formatDateFr(dateStr, "relative") || "";
}

// OPT-D1: Cached French holiday computation (one calculation per year)
const _holidayCache = new Map<number, Set<string>>();
export function isFrenchHolidayCached(dateStr: string): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const year = d.getFullYear();
  if (!_holidayCache.has(year)) {
    _holidayCache.set(year, new Set(getFrenchHolidays(year)));
  }
  return _holidayCache.get(year)!.has(d.toISOString().split("T")[0]);
}

// OPT-D2: Format a duration in human-readable French
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min}min ${sec}s` : `${min}min`;
}

// OPT-D3: Get current ISO date string (YYYY-MM-DD) — avoids repeated new Date().toISOString().split("T")[0]
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
