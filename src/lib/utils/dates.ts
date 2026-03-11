/**
 * Date manipulation utilities.
 * All functions accept Date or ISO string and return new Date objects.
 */

function toDate(input: Date | string): Date {
  if (input instanceof Date) return new Date(input.getTime());
  const d = new Date(input);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${input}`);
  return d;
}

/** Add days to a date (can be negative) */
export function addDays(date: Date | string, days: number): Date {
  const d = toDate(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Add months to a date (handles month-end clamping) */
export function addMonths(date: Date | string, months: number): Date {
  const d = toDate(date);
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Clamp: if day overflowed (e.g. Jan 31 + 1 month → Mar 3), go back to last day of target month
  if (d.getDate() !== originalDay) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

/** Check if a date is a business day (Monday-Friday) */
export function isBusinessDay(date: Date | string): boolean {
  const day = toDate(date).getDay();
  return day !== 0 && day !== 6;
}

/** Get the next business day (skips weekends) */
export function getNextBusinessDay(date: Date | string): Date {
  let d = toDate(date);
  d = addDays(d, 1);
  while (!isBusinessDay(d)) {
    d = addDays(d, 1);
  }
  return d;
}

/** Get the start of day (00:00:00.000) */
export function startOfDay(date: Date | string): Date {
  const d = toDate(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get the end of day (23:59:59.999) */
export function endOfDay(date: Date | string): Date {
  const d = toDate(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Get the number of full days between two dates (positive if a > b) */
export function differenceInDays(dateA: Date | string, dateB: Date | string): number {
  const a = startOfDay(dateA).getTime();
  const b = startOfDay(dateB).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

/** Get the fiscal quarter and year for a date */
export function getQuarter(date: Date | string): { quarter: 1 | 2 | 3 | 4; year: number } {
  const d = toDate(date);
  const month = d.getMonth(); // 0-based
  const quarter = (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
  return { quarter, year: d.getFullYear() };
}
