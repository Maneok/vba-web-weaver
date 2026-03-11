import { describe, it, expect } from "vitest";
import {
  removeDiacritics,
  normalizeCompanyName,
  normalizeName,
  normalizeWhitespace,
  truncateText,
  slugify,
  maskSensitiveData,
  extractInitials,
} from "@/lib/stringUtils";

describe("removeDiacritics", () => {
  it("removes French accents (é→e, à→a, ç→c, ê→e, ü→u, ô→o)", () => {
    expect(removeDiacritics("éàçêüô")).toBe("eaceuo");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(removeDiacritics("")).toBe("");
    expect(removeDiacritics(null as unknown as string)).toBe("");
    expect(removeDiacritics(undefined as unknown as string)).toBe("");
  });

  it("preserves non-accented characters", () => {
    expect(removeDiacritics("Hello World 123!")).toBe("Hello World 123!");
  });
});

describe("normalizeCompanyName", () => {
  it("removes SARL, SAS, SCI, etc.", () => {
    expect(normalizeCompanyName("Dupont SARL")).toBe("DUPONT");
    expect(normalizeCompanyName("SAS Martin")).toBe("MARTIN");
    expect(normalizeCompanyName("SCI Les Oliviers")).toBe("LES OLIVIERS");
  });

  it("uppercases the result", () => {
    expect(normalizeCompanyName("entreprise duval")).toBe("DUVAL");
  });

  it("strips accents", () => {
    expect(normalizeCompanyName("Société Générale")).toBe("GENERALE");
  });

  it("removes non-alphanumeric chars", () => {
    expect(normalizeCompanyName("L'Atelier & Co.")).toBe("L ATELIER CO");
  });

  it("returns empty for falsy input", () => {
    expect(normalizeCompanyName("")).toBe("");
    expect(normalizeCompanyName(null as unknown as string)).toBe("");
    expect(normalizeCompanyName(undefined as unknown as string)).toBe("");
  });
});

describe("normalizeName", () => {
  it("removes MME, DR, MAITRE titles", () => {
    expect(normalizeName("MME Marie Curie")).toBe("MARIE CURIE");
    expect(normalizeName("DR Pierre Martin")).toBe("PIERRE MARTIN");
    expect(normalizeName("MAITRE Jacques Lefevre")).toBe("JACQUES LEFEVRE");
    expect(normalizeName("MR Paul Durand")).toBe("PAUL DURAND");
  });

  it("uppercases the result", () => {
    expect(normalizeName("jean dupont")).toBe("JEAN DUPONT");
  });

  it("strips accents", () => {
    expect(normalizeName("Hélène Müller")).toBe("HELENE MULLER");
  });

  it("returns empty for falsy input", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName(null as unknown as string)).toBe("");
    expect(normalizeName(undefined as unknown as string)).toBe("");
  });
});

describe("normalizeWhitespace", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeWhitespace("hello    world")).toBe("hello world");
  });

  it("replaces tabs and newlines with spaces", () => {
    expect(normalizeWhitespace("hello\tworld\nfoo")).toBe("hello world foo");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeWhitespace("  hello world  ")).toBe("hello world");
  });

  it("returns empty for falsy input", () => {
    expect(normalizeWhitespace("")).toBe("");
    expect(normalizeWhitespace(null as unknown as string)).toBe("");
    expect(normalizeWhitespace(undefined as unknown as string)).toBe("");
  });
});

describe("truncateText", () => {
  it("returns full text if under maxLen", () => {
    expect(truncateText("short text", 50)).toBe("short text");
  });

  it("truncates and adds ellipsis", () => {
    const result = truncateText("This is a longer sentence that should be cut", 20);
    expect(result).toMatch(/\.\.\.$/);
    expect(result.length).toBeLessThanOrEqual(20);
    // Should cut at a space boundary when possible
    expect(result).toBe("This is a longer...");
  });

  it("adds custom suffix", () => {
    const result = truncateText("This is a longer sentence that should be cut", 25, " [...]");
    expect(result).toMatch(/\[\.\.\.\]$/);
  });

  it("returns empty for falsy input", () => {
    expect(truncateText("", 10)).toBe("");
    expect(truncateText(null as unknown as string, 10)).toBe("");
    expect(truncateText(undefined as unknown as string, 10)).toBe("");
  });
});

describe("slugify", () => {
  it("lowercases the text", () => {
    expect(slugify("HELLO")).toBe("hello");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("removes accents", () => {
    expect(slugify("café crème")).toBe("cafe-creme");
  });

  it("strips leading/trailing hyphens", () => {
    expect(slugify(" hello world ")).toBe("hello-world");
    expect(slugify("--hello--")).toBe("hello");
  });

  it("returns empty for falsy input", () => {
    expect(slugify("")).toBe("");
    expect(slugify(null as unknown as string)).toBe("");
    expect(slugify(undefined as unknown as string)).toBe("");
  });
});

describe("maskSensitiveData", () => {
  it("IBAN: shows first 4 and last 4 chars", () => {
    const result = maskSensitiveData("FR76 1234 5678 9012 3456 789", "iban");
    expect(result).toMatch(/^FR76/);
    expect(result).toMatch(/6789$/);
    expect(result).toContain("****");
  });

  it("email: shows first 2 chars + domain", () => {
    const result = maskSensitiveData("jean.dupont@example.com", "email");
    expect(result).toBe("je***@example.com");
  });

  it("phone: shows first 3 and last 2", () => {
    const result = maskSensitiveData("0612345678", "phone");
    expect(result.startsWith("061")).toBe(true);
    expect(result.endsWith("78")).toBe(true);
    expect(result).toContain("**");
  });

  it("SIREN: shows first 3 and last 3", () => {
    const result = maskSensitiveData("123456789", "siren");
    expect(result).toMatch(/^123/);
    expect(result).toMatch(/789$/);
    expect(result).toContain("***");
  });

  it("returns empty for falsy input", () => {
    expect(maskSensitiveData("", "iban")).toBe("");
    expect(maskSensitiveData(null as unknown as string, "email")).toBe("");
    expect(maskSensitiveData(undefined as unknown as string, "phone")).toBe("");
  });
});

describe("extractInitials", () => {
  it("gets first letter of each word", () => {
    expect(extractInitials("Jean Dupont")).toBe("JD");
  });

  it("max 3 chars by default", () => {
    expect(extractInitials("Jean Pierre Marie Dupont")).toBe("JPM");
  });

  it("returns empty for falsy input", () => {
    expect(extractInitials("")).toBe("");
    expect(extractInitials(null as unknown as string)).toBe("");
    expect(extractInitials(undefined as unknown as string)).toBe("");
  });

  it("handles hyphenated names", () => {
    expect(extractInitials("Jean-Pierre Dupont")).toBe("JPD");
  });

  it("respects custom maxLen parameter", () => {
    expect(extractInitials("Jean Pierre Marie Dupont", 2)).toBe("JP");
  });
});
