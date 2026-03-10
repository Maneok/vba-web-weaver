/**
 * File-related utilities for the GED module.
 */

/** Format bytes to human-readable French file size */
export function formatFileSize(bytes: number): string {
  if (!isFinite(bytes) || bytes < 0) return "0 o";
  if (bytes === 0) return "0 o";

  const units = ["o", "Ko", "Mo", "Go", "To"];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  // No decimals for bytes, 1 decimal for others
  const formatted = unitIndex === 0
    ? Math.round(size).toString()
    : size.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

  return `${formatted} ${units[unitIndex]}`;
}

/** Extract file extension from filename (lowercase, without dot) */
export function getFileExtension(filename: string): string {
  if (!filename) return "";
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) return ""; // no dot, or dotfile like .gitignore
  return filename.slice(lastDot + 1).toLowerCase();
}

const MIME_MAP: Record<string, string> = {
  // Documents
  pdf: "document", doc: "document", docx: "document", odt: "document",
  txt: "document", rtf: "document",
  // Spreadsheets
  xls: "spreadsheet", xlsx: "spreadsheet", ods: "spreadsheet", csv: "spreadsheet",
  // Images
  jpg: "image", jpeg: "image", png: "image", gif: "image",
  webp: "image", svg: "image", bmp: "image", tiff: "image",
  // Archives
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
  // Video
  mp4: "video", avi: "video", mov: "video", mkv: "video", webm: "video",
  // Audio
  mp3: "audio", wav: "audio", ogg: "audio", flac: "audio", aac: "audio",
};

/** Categorize a file by its extension */
export function getMimeCategory(
  filename: string
): "image" | "document" | "spreadsheet" | "archive" | "video" | "audio" | "other" {
  const ext = getFileExtension(filename);
  return (MIME_MAP[ext] as ReturnType<typeof getMimeCategory>) ?? "other";
}
