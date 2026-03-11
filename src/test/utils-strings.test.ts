/**
 * Tests for src/lib/utils/strings.ts
 * Features #5-10: truncate, capitalize, getInitials, slugify, highlightMatch, normalizeAccents
 */

import { truncate, capitalize, getInitials, slugify, highlightMatch, normalizeAccents } from "@/lib/utils/strings";

describe("Feature #5: truncate", () => {
  it("truncates long text", () => {
    expect(truncate("Hello World", 5)).toBe("Hello...");
  });

  it("does not truncate short text", () => {
    expect(truncate("Hi", 10)).toBe("Hi");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });

  it("handles null-like input", () => {
    expect(truncate(null as any, 5)).toBe("");
  });

  it("uses custom ellipsis", () => {
    expect(truncate("Hello World", 5, "…")).toBe("Hello…");
  });

  it("handles maxLength of 0", () => {
    expect(truncate("Hello", 0)).toBe("...");
  });
});

describe("Feature #6: capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("lowercases the rest", () => {
    expect(capitalize("HELLO")).toBe("Hello");
  });

  it("handles single character", () => {
    expect(capitalize("h")).toBe("H");
  });

  it("handles empty string", () => {
    expect(capitalize("")).toBe("");
  });

  it("handles accented characters", () => {
    expect(capitalize("écran")).toBe("Écran");
  });
});

describe("Feature #7: getInitials", () => {
  it("extracts 2 initials by default", () => {
    expect(getInitials("Jean Dupont")).toBe("JD");
  });

  it("handles hyphenated names", () => {
    expect(getInitials("Jean-Pierre Dupont")).toBe("JP");
  });

  it("handles single name", () => {
    expect(getInitials("Jean")).toBe("J");
  });

  it("handles 3 names with maxChars=3", () => {
    expect(getInitials("Jean Pierre Dupont", 3)).toBe("JPD");
  });

  it("handles empty string", () => {
    expect(getInitials("")).toBe("");
  });

  it("handles whitespace-only string", () => {
    expect(getInitials("   ")).toBe("");
  });
});

describe("Feature #8: slugify", () => {
  it("converts to lowercase slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips accents", () => {
    expect(slugify("Écran résumé")).toBe("ecran-resume");
  });

  it("removes special characters", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("Hello   World")).toBe("hello-world");
  });

  it("removes leading/trailing hyphens", () => {
    expect(slugify("-Hello World-")).toBe("hello-world");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});

describe("Feature #9: highlightMatch", () => {
  it("highlights a match in text", () => {
    const result = highlightMatch("Bonjour le monde", "le");
    expect(result).toEqual([
      { text: "Bonjour ", highlight: false },
      { text: "le", highlight: true },
      { text: " monde", highlight: false },
    ]);
  });

  it("handles no match", () => {
    const result = highlightMatch("Hello", "xyz");
    expect(result).toEqual([{ text: "Hello", highlight: false }]);
  });

  it("handles accent-insensitive match", () => {
    const result = highlightMatch("Écran", "ecran");
    expect(result.some(s => s.highlight)).toBe(true);
  });

  it("handles empty query", () => {
    const result = highlightMatch("Hello", "");
    expect(result).toEqual([{ text: "Hello", highlight: false }]);
  });

  it("handles empty text", () => {
    expect(highlightMatch("", "test")).toEqual([]);
  });

  it("handles multiple matches", () => {
    const result = highlightMatch("le le le", "le");
    const highlighted = result.filter(s => s.highlight);
    expect(highlighted.length).toBe(3);
  });
});

describe("Feature #10: normalizeAccents", () => {
  it("strips French accents", () => {
    expect(normalizeAccents("écran")).toBe("ecran");
    expect(normalizeAccents("résumé")).toBe("resume");
    expect(normalizeAccents("Échéances")).toBe("Echeances");
  });

  it("strips cedilla", () => {
    expect(normalizeAccents("façade")).toBe("facade");
  });

  it("preserves non-accented text", () => {
    expect(normalizeAccents("hello")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(normalizeAccents("")).toBe("");
  });

  it("handles umlauts and tildes", () => {
    expect(normalizeAccents("über naïve señor")).toBe("uber naive senor");
  });
});
