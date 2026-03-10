/**
 * Tests for src/lib/utils/phone.ts
 * Features #25-26: formatPhoneFR, parsePhoneFR
 */

import { formatPhoneFR, parsePhoneFR } from "@/lib/utils/phone";

describe("Feature #25: formatPhoneFR", () => {
  it("formats 10-digit national number", () => {
    expect(formatPhoneFR("0612345678")).toBe("06 12 34 56 78");
  });

  it("formats international +33 number", () => {
    expect(formatPhoneFR("+33612345678")).toBe("+33 6 12 34 56 78");
  });

  it("handles already formatted input", () => {
    expect(formatPhoneFR("06 12 34 56 78")).toBe("06 12 34 56 78");
  });

  it("handles dotted format", () => {
    expect(formatPhoneFR("06.12.34.56.78")).toBe("06 12 34 56 78");
  });

  it("handles empty string", () => {
    expect(formatPhoneFR("")).toBe("");
  });

  it("returns original for unrecognized format", () => {
    expect(formatPhoneFR("123")).toBe("123");
  });

  it("handles landline numbers", () => {
    expect(formatPhoneFR("0145678901")).toBe("01 45 67 89 01");
  });
});

describe("Feature #26: parsePhoneFR", () => {
  it("parses national number", () => {
    const result = parsePhoneFR("0612345678");
    expect(result.isValid).toBe(true);
    expect(result.national).toBe("0612345678");
    expect(result.international).toBe("+33612345678");
  });

  it("parses international number", () => {
    const result = parsePhoneFR("+33612345678");
    expect(result.isValid).toBe(true);
    expect(result.national).toBe("0612345678");
  });

  it("parses number with spaces", () => {
    const result = parsePhoneFR("06 12 34 56 78");
    expect(result.isValid).toBe(true);
  });

  it("rejects empty string", () => {
    expect(parsePhoneFR("").isValid).toBe(false);
  });

  it("rejects too short number", () => {
    expect(parsePhoneFR("0612").isValid).toBe(false);
  });

  it("rejects invalid prefix (00)", () => {
    expect(parsePhoneFR("0012345678").isValid).toBe(false);
  });

  it("accepts all valid prefixes 01-09", () => {
    for (let i = 1; i <= 9; i++) {
      const result = parsePhoneFR(`0${i}12345678`);
      expect(result.isValid).toBe(true);
    }
  });

  it("parses 33-prefixed without +", () => {
    const result = parsePhoneFR("33612345678");
    expect(result.isValid).toBe(true);
    expect(result.national).toBe("0612345678");
  });
});
