/**
 * Statistical calculation utilities for analytics and reporting.
 */

/** Calculate the arithmetic mean */
export function average(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const valid = values.filter(v => isFinite(v));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/** Calculate the median value */
export function median(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].filter(v => isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Calculate the Nth percentile (0-100) */
export function percentile(values: number[], p: number): number {
  if (!values || values.length === 0) return 0;
  const clamped = Math.max(0, Math.min(100, p));
  const sorted = [...values].filter(v => isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const idx = (clamped / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const frac = idx - lower;

  return sorted[lower] + frac * (sorted[upper] - sorted[lower]);
}

/** Calculate the standard deviation */
export function standardDeviation(values: number[]): number {
  if (!values || values.length < 2) return 0;
  const valid = values.filter(v => isFinite(v));
  if (valid.length < 2) return 0;
  const avg = average(valid);
  const squaredDiffs = valid.map(v => (v - avg) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, d) => sum + d, 0) / (valid.length - 1));
}

/** Group values into distribution buckets */
export function distribution(
  values: number[],
  buckets: Array<{ label: string; min: number; max: number }>
): Array<{ label: string; count: number; percentage: number }> {
  if (!values || !buckets) return [];
  const total = values.filter(v => isFinite(v)).length;
  if (total === 0) return buckets.map(b => ({ label: b.label, count: 0, percentage: 0 }));

  return buckets.map(bucket => {
    const count = values.filter(v => isFinite(v) && v >= bucket.min && v < bucket.max).length;
    return {
      label: bucket.label,
      count,
      percentage: Math.round((count / total) * 100),
    };
  });
}
