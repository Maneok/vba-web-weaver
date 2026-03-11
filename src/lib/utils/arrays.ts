/**
 * Typed array manipulation utilities.
 * All functions are pure and return new arrays.
 */

/** Group array items by a key function */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

/** Sort array by key function (returns new array) */
export function sortBy<T>(
  items: T[],
  keyFn: (item: T) => string | number,
  order: "asc" | "desc" = "asc"
): T[] {
  const sorted = [...items].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (typeof ka === "number" && typeof kb === "number") {
      return ka - kb;
    }
    return String(ka).localeCompare(String(kb), "fr-FR");
  });
  return order === "desc" ? sorted.reverse() : sorted;
}

/** Remove duplicates by key function (keeps first occurrence) */
export function uniqBy<T>(items: T[], keyFn: (item: T) => string | number): T[] {
  const seen = new Set<string | number>();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Split array into chunks of given size */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) return [];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/** Remove null, undefined, false, 0, and empty string from array */
export function compact<T>(items: (T | null | undefined | false | 0 | "")[]): T[] {
  return items.filter(Boolean) as T[];
}

/** Create a lookup dictionary from array by key function */
export function indexBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T> {
  const result: Record<string, T> = {};
  for (const item of items) {
    result[keyFn(item)] = item;
  }
  return result;
}
