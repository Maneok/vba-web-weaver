/**
 * Export and download utilities.
 */

/** Generate a timestamped filename (French format) */
export function generateTimestampedFilename(baseName: string, extension: string): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}h${pad(now.getMinutes())}`;
  const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = extension.replace(/^\./, "");
  return `${safeName}_${date}_${time}.${safeExt}`;
}

/** Trigger a browser download for a Blob */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export data as a formatted JSON file download */
export function exportToJson<T>(data: T[], filename?: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const name = filename ?? generateTimestampedFilename("export", "json");
  downloadBlob(blob, name);
}
