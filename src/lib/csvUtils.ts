/**
 * Shared CSV export utilities.
 * Handles BOM, CSV injection protection, and objectURL cleanup.
 */

/** Protect against CSV injection (=, +, -, @, tab, CR) */
export function csvSafe(val: unknown): string {
  const s = String(val ?? "");
  const escaped = s.replace(/"/g, '""');
  // Always quote to handle embedded newlines, semicolons, and CSV injection
  if (/^[=+\-@\t\r]/.test(s)) return `"'${escaped}"`;
  return `"${escaped}"`;
}

/** Export data as a CSV file with UTF-8 BOM for Excel compatibility */
export function downloadCSV(
  headers: string[],
  rows: string[][],
  filename: string,
): void {
  const csv = [
    headers.join(";"),
    ...rows.map(r => r.map(csvSafe).join(";")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
