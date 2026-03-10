/**
 * Collection/Array utility functions.
 */

/** Group items by a key function */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = map.get(key);
    if (existing) existing.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** Deduplicate items by a key function (keeps first occurrence) */
export function deduplicateBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Split array into chunks of specified size */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Find duplicate entries by key */
export function findDuplicates<T>(
  items: T[],
  keyFn: (item: T) => string
): { key: string; count: number; items: T[] }[] {
  const groups = groupBy(items, keyFn);
  const duplicates: { key: string; count: number; items: T[] }[] = [];
  for (const [key, group] of groups) {
    if (group.length > 1) {
      duplicates.push({ key, count: group.length, items: group });
    }
  }
  return duplicates;
}
