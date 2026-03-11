/**
 * Table/list manipulation utilities — multi-sort, date range filter, column stats, pagination.
 */

export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

/** Sort by multiple columns in order of priority */
export function multiSort<T extends Record<string, unknown>>(
  items: T[],
  sorts: SortConfig[]
): T[] {
  if (!sorts || sorts.length === 0) return [...items];

  return [...items].sort((a, b) => {
    for (const { key, direction } of sorts) {
      const va = a[key];
      const vb = b[key];

      let cmp = 0;
      if (va === vb) continue;
      if (va === null || va === undefined) { cmp = -1; }
      else if (vb === null || vb === undefined) { cmp = 1; }
      else if (typeof va === "number" && typeof vb === "number") { cmp = va - vb; }
      else { cmp = String(va).localeCompare(String(vb), "fr-FR"); }

      if (cmp !== 0) return direction === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

/** Filter items by a date range on a specific field */
export function filterByDateRange<T>(
  items: T[],
  dateField: keyof T,
  startDate?: string,
  endDate?: string
): T[] {
  return items.filter(item => {
    const val = item[dateField];
    if (!val) return false;
    const d = new Date(String(val));
    if (isNaN(d.getTime())) return false;
    if (startDate && d < new Date(startDate)) return false;
    if (endDate && d > new Date(endDate)) return false;
    return true;
  });
}

/** Compute min/max/average/sum for a numeric column */
export function computeColumnStats<T>(
  items: T[],
  field: keyof T
): { min: number; max: number; average: number; sum: number; count: number } {
  const values: number[] = [];
  for (const item of items) {
    const val = item[field];
    const num = typeof val === "number" ? val : parseFloat(String(val));
    if (isFinite(num)) values.push(num);
  }

  if (values.length === 0) {
    return { min: 0, max: 0, average: 0, sum: 0, count: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    average: Math.round((sum / values.length) * 100) / 100,
    sum: Math.round(sum * 100) / 100,
    count: values.length,
  };
}

/** Paginate items with full metadata */
export function paginateWithInfo<T>(
  items: T[],
  page: number,
  pageSize: number
): {
  data: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  startIndex: number;
  endIndex: number;
} {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeSize));
  const clampedPage = Math.min(safePage, totalPages);
  const startIndex = (clampedPage - 1) * safeSize;
  const endIndex = Math.min(startIndex + safeSize, totalItems);

  return {
    data: items.slice(startIndex, endIndex),
    page: clampedPage,
    pageSize: safeSize,
    totalItems,
    totalPages,
    hasNext: clampedPage < totalPages,
    hasPrev: clampedPage > 1,
    startIndex,
    endIndex,
  };
}
