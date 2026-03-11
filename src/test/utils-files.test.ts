/**
 * Tests for src/lib/utils/files.ts
 * Features #27-29: formatFileSize, getFileExtension, getMimeCategory
 */

import { formatFileSize, getFileExtension, getMimeCategory } from "@/lib/utils/files";

describe("Feature #27: formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 o");
  });

  it("formats kilobytes", () => {
    const result = formatFileSize(1536);
    expect(result).toContain("Ko");
  });

  it("formats megabytes", () => {
    const result = formatFileSize(2 * 1024 * 1024);
    expect(result).toContain("Mo");
  });

  it("formats gigabytes", () => {
    const result = formatFileSize(5 * 1024 * 1024 * 1024);
    expect(result).toContain("Go");
  });

  it("handles 0 bytes", () => {
    expect(formatFileSize(0)).toBe("0 o");
  });

  it("handles negative values", () => {
    expect(formatFileSize(-100)).toBe("0 o");
  });

  it("handles NaN", () => {
    expect(formatFileSize(NaN)).toBe("0 o");
  });
});

describe("Feature #28: getFileExtension", () => {
  it("extracts pdf extension", () => {
    expect(getFileExtension("rapport.pdf")).toBe("pdf");
  });

  it("handles uppercase", () => {
    expect(getFileExtension("PHOTO.JPG")).toBe("jpg");
  });

  it("handles multiple dots", () => {
    expect(getFileExtension("archive.tar.gz")).toBe("gz");
  });

  it("handles no extension", () => {
    expect(getFileExtension("Makefile")).toBe("");
  });

  it("handles dotfile", () => {
    expect(getFileExtension(".gitignore")).toBe("");
  });

  it("handles empty string", () => {
    expect(getFileExtension("")).toBe("");
  });
});

describe("Feature #29: getMimeCategory", () => {
  it("categorizes PDF as document", () => {
    expect(getMimeCategory("file.pdf")).toBe("document");
  });

  it("categorizes XLSX as spreadsheet", () => {
    expect(getMimeCategory("data.xlsx")).toBe("spreadsheet");
  });

  it("categorizes JPG as image", () => {
    expect(getMimeCategory("photo.jpg")).toBe("image");
  });

  it("categorizes PNG as image", () => {
    expect(getMimeCategory("logo.png")).toBe("image");
  });

  it("categorizes ZIP as archive", () => {
    expect(getMimeCategory("backup.zip")).toBe("archive");
  });

  it("categorizes MP4 as video", () => {
    expect(getMimeCategory("clip.mp4")).toBe("video");
  });

  it("categorizes MP3 as audio", () => {
    expect(getMimeCategory("song.mp3")).toBe("audio");
  });

  it("categorizes CSV as spreadsheet", () => {
    expect(getMimeCategory("export.csv")).toBe("spreadsheet");
  });

  it("returns 'other' for unknown extension", () => {
    expect(getMimeCategory("file.xyz")).toBe("other");
  });

  it("returns 'other' for no extension", () => {
    expect(getMimeCategory("README")).toBe("other");
  });
});
