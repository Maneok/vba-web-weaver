/**
 * Object diff utilities for change tracking and audit trails.
 */

export interface DiffEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/** Detect changed fields between two objects (shallow comparison) */
export function objectDiff<T extends Record<string, unknown>>(
  original: T,
  updated: T,
  ignoreFields?: string[]
): DiffEntry[] {
  if (!original || !updated) return [];
  const ignored = new Set(ignoreFields ?? []);
  const diffs: DiffEntry[] = [];
  const allKeys = new Set([...Object.keys(original), ...Object.keys(updated)]);

  for (const key of allKeys) {
    if (ignored.has(key)) continue;
    const oldVal = original[key];
    const newVal = updated[key];

    // Simple equality check (handles null, undefined, primitives)
    if (oldVal !== newVal) {
      // Skip if both are equivalent empty values
      if ((oldVal === "" || oldVal === null || oldVal === undefined) &&
          (newVal === "" || newVal === null || newVal === undefined)) {
        continue;
      }
      diffs.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  }

  return diffs;
}

/** Format a diff entry for display (French labels) */
export function formatDiffEntry(entry: DiffEntry): string {
  const { field, oldValue, newValue } = entry;
  const oldStr = oldValue === null || oldValue === undefined ? "(vide)" : String(oldValue);
  const newStr = newValue === null || newValue === undefined ? "(vide)" : String(newValue);

  if (!oldStr || oldStr === "(vide)") {
    return `${field}: ajouté → "${newStr}"`;
  }
  if (!newStr || newStr === "(vide)") {
    return `${field}: "${oldStr}" → supprimé`;
  }
  return `${field}: "${oldStr}" → "${newStr}"`;
}

/** Quick check if two objects have any differences */
export function hasChanges<T extends Record<string, unknown>>(
  original: T,
  updated: T,
  ignoreFields?: string[]
): boolean {
  return objectDiff(original, updated, ignoreFields).length > 0;
}
