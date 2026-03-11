/**
 * Tests for src/lib/utils/sanitize.ts
 * Features #1-5: sanitizeHtml, sanitizeInput, escapeRegex, sanitizeFilename, sanitizeUrl
 */
import { sanitizeHtml, sanitizeInput, escapeRegex, sanitizeFilename, sanitizeUrl } from "@/lib/utils/sanitize";

describe("Feature #1: sanitizeHtml", () => {
  it("strips HTML tags", () => {
    expect(sanitizeHtml("<p>Hello</p>")).toBe("Hello");
  });
  it("strips script tags and content", () => {
    expect(sanitizeHtml('before<script>alert("xss")</script>after')).toBe("beforeafter");
  });
  it("handles nested tags", () => {
    expect(sanitizeHtml("<div><b>Bold</b></div>")).toBe("Bold");
  });
  it("handles empty string", () => {
    expect(sanitizeHtml("")).toBe("");
  });
  it("preserves plain text", () => {
    expect(sanitizeHtml("Just text")).toBe("Just text");
  });
  it("decodes HTML entities", () => {
    expect(sanitizeHtml("&lt;script&gt;")).toBe("<script>");
  });
});

describe("Feature #2: sanitizeInput", () => {
  it("escapes angle brackets", () => {
    expect(sanitizeInput("<script>")).toBe("&lt;script&gt;");
  });
  it("escapes quotes", () => {
    expect(sanitizeInput('"hello\'')).toBe("&quot;hello&#x27;");
  });
  it("escapes ampersand", () => {
    expect(sanitizeInput("a & b")).toBe("a &amp; b");
  });
  it("handles empty string", () => {
    expect(sanitizeInput("")).toBe("");
  });
  it("trims whitespace", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello");
  });
});

describe("Feature #3: escapeRegex", () => {
  it("escapes dots", () => {
    expect(escapeRegex("file.txt")).toBe("file\\.txt");
  });
  it("escapes brackets", () => {
    expect(escapeRegex("[test]")).toBe("\\[test\\]");
  });
  it("escapes all special chars", () => {
    expect(escapeRegex("a+b*c?")).toBe("a\\+b\\*c\\?");
  });
  it("handles empty string", () => {
    expect(escapeRegex("")).toBe("");
  });
  it("preserved text works in RegExp", () => {
    const escaped = escapeRegex("test.file");
    const regex = new RegExp(escaped);
    expect(regex.test("test.file")).toBe(true);
    expect(regex.test("testXfile")).toBe(false);
  });
});

describe("Feature #4: sanitizeFilename", () => {
  it("removes unsafe characters", () => {
    expect(sanitizeFilename('file<>:"/|?*name.pdf')).toBe("filename.pdf");
  });
  it("collapses double dots and strips path traversal", () => {
    const result = sanitizeFilename("../../etc/passwd");
    expect(result).not.toContain("..");
    expect(result.length).toBeGreaterThan(0);
  });
  it("limits length", () => {
    const long = "a".repeat(300) + ".pdf";
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(200);
  });
  it("returns 'fichier' for empty", () => {
    expect(sanitizeFilename("")).toBe("fichier");
  });
  it("preserves valid filenames", () => {
    expect(sanitizeFilename("rapport-2026.pdf")).toBe("rapport-2026.pdf");
  });
});

describe("Feature #5: sanitizeUrl", () => {
  it("accepts https URLs", () => {
    const result = sanitizeUrl("https://example.com");
    expect(result.valid).toBe(true);
    expect(result.cleaned).toBe("https://example.com");
  });
  it("rejects javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert(1)").valid).toBe(false);
  });
  it("rejects data: protocol", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>").valid).toBe(false);
  });
  it("accepts relative URLs", () => {
    expect(sanitizeUrl("/path/to/page").valid).toBe(true);
  });
  it("adds https:// to bare domains", () => {
    const result = sanitizeUrl("example.com");
    expect(result.cleaned).toBe("https://example.com");
  });
  it("rejects empty", () => {
    expect(sanitizeUrl("").valid).toBe(false);
  });
  it("rejects invalid format", () => {
    expect(sanitizeUrl("not a url !@#").valid).toBe(false);
  });
});
