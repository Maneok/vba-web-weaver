/**
 * Tests for src/lib/utils/export.ts
 * Features #45-47: generateTimestampedFilename, downloadBlob, exportToJson
 */

import { generateTimestampedFilename, downloadBlob, exportToJson } from "@/lib/utils/export";

// jsdom doesn't have URL.createObjectURL — polyfill for tests
beforeAll(() => {
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn();
  }
});

describe("Feature #45: generateTimestampedFilename", () => {
  it("generates filename with date and time", () => {
    const result = generateTimestampedFilename("export-clients", "csv");
    expect(result).toMatch(/^export-clients_\d{4}-\d{2}-\d{2}_\d{2}h\d{2}\.csv$/);
  });

  it("sanitizes special characters in base name", () => {
    const result = generateTimestampedFilename("export clients!", "pdf");
    expect(result).not.toContain(" ");
    expect(result).not.toContain("!");
    expect(result).toMatch(/\.pdf$/);
  });

  it("strips leading dot from extension", () => {
    const result = generateTimestampedFilename("file", ".json");
    expect(result).toMatch(/\.json$/);
    expect(result).not.toContain("..");
  });

  it("handles empty base name", () => {
    const result = generateTimestampedFilename("", "csv");
    expect(result).toMatch(/\.csv$/);
  });
});

describe("Feature #46: downloadBlob", () => {
  it("creates and clicks a download link", () => {
    const mockClick = vi.fn();
    const mockAnchor = {
      href: "",
      download: "",
      style: { display: "" },
      click: mockClick,
    };
    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

    const blob = new Blob(["test"], { type: "text/plain" });
    downloadBlob(blob, "test.txt");

    expect(mockClick).toHaveBeenCalled();
    expect(mockAnchor.download).toBe("test.txt");

    vi.restoreAllMocks();
  });
});

describe("Feature #47: exportToJson", () => {
  it("creates JSON blob and triggers download", () => {
    const mockClick = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "", download: "", style: { display: "" }, click: mockClick,
    } as any);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

    const data = [{ id: 1, name: "Test" }];
    exportToJson(data, "test-export.json");

    expect(mockClick).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it("generates timestamped filename when none provided", () => {
    const mockAnchor = { href: "", download: "", style: { display: "" }, click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

    exportToJson([]);

    expect(mockAnchor.download).toMatch(/export.*\.json$/);

    vi.restoreAllMocks();
  });
});
