/**
 * CSV import/parsing utilities for bulk data import.
 */

/** Auto-detect CSV delimiter from first line */
export function detectDelimiter(firstLine: string): string {
  if (!firstLine) return ",";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let maxCount = 0;

  for (const delim of candidates) {
    const count = (firstLine.match(new RegExp(delim.replace(/[|\\]/g, "\\$&"), "g")) || []).length;
    if (count > maxCount) {
      maxCount = count;
      best = delim;
    }
  }
  return best;
}

/** Parse a CSV string into an array of objects */
export function parseCSV(csvText: string, options?: { delimiter?: string; hasHeader?: boolean }): {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
} {
  if (!csvText || !csvText.trim()) {
    return { headers: [], rows: [], errors: ["Fichier CSV vide"] };
  }

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ["Aucune ligne trouvee"] };
  }

  const delimiter = options?.delimiter ?? detectDelimiter(lines[0]);
  const hasHeader = options?.hasHeader ?? true;
  const errors: string[] = [];

  const headers = hasHeader
    ? lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ""))
    : lines[0].split(delimiter).map((_, i) => `col_${i + 1}`);

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: Record<string, string>[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ""));

    if (values.length !== headers.length) {
      errors.push(`Ligne ${i + (hasHeader ? 2 : 1)}: ${values.length} colonnes au lieu de ${headers.length}`);
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows, errors };
}

/** Validate that CSV headers match expected schema */
export function validateCSVHeaders(
  headers: string[],
  required: string[],
  optional?: string[]
): { valid: boolean; missing: string[]; extra: string[] } {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  const normalizedRequired = required.map(r => r.toLowerCase().trim());
  const normalizedOptional = (optional ?? []).map(o => o.toLowerCase().trim());

  const missing = normalizedRequired.filter(r => !normalizedHeaders.includes(r));
  const allExpected = new Set([...normalizedRequired, ...normalizedOptional]);
  const extra = normalizedHeaders.filter(h => !allExpected.has(h));

  return {
    valid: missing.length === 0,
    missing: missing.map(m => required[normalizedRequired.indexOf(m)]),
    extra: extra.map(e => headers[normalizedHeaders.indexOf(e)]),
  };
}

/** Map a CSV row to a client-like structure (field name mapping) */
export function mapCSVRow(
  row: Record<string, string>,
  fieldMapping: Record<string, string>
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [csvField, appField] of Object.entries(fieldMapping)) {
    const normalizedKey = Object.keys(row).find(k => k.toLowerCase().trim() === csvField.toLowerCase().trim());
    if (normalizedKey && row[normalizedKey] !== undefined) {
      mapped[appField] = row[normalizedKey];
    }
  }
  return mapped;
}
