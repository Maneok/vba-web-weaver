/**
 * Tests for src/lib/utils/numbers.ts
 * Features #1-4: formatCurrency, parseCurrency, clamp, roundTo
 */

import { formatCurrency, parseCurrency, clamp, roundTo } from "@/lib/utils/numbers";

describe("Feature #1: formatCurrency", () => {
  it("formats positive number as EUR", () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain("1");
    expect(result).toContain("234");
    expect(result).toContain("56");
    expect(result).toMatch(/€|EUR/);
  });

  it("handles null → 0,00 EUR", () => {
    const result = formatCurrency(null);
    expect(result).toContain("0");
    expect(result).toMatch(/€|EUR/);
  });

  it("handles undefined → 0,00 EUR", () => {
    const result = formatCurrency(undefined);
    expect(result).toContain("0");
  });

  it("handles zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("handles negative numbers", () => {
    const result = formatCurrency(-500);
    expect(result).toContain("500");
  });

  it("handles Infinity gracefully", () => {
    const result = formatCurrency(Infinity);
    expect(result).toContain("0");
  });

  it("handles NaN gracefully", () => {
    const result = formatCurrency(NaN);
    expect(result).toContain("0");
  });

  it("supports custom decimals", () => {
    const result = formatCurrency(99.999, { decimals: 0 });
    expect(result).toContain("100");
  });
});

describe("Feature #2: parseCurrency", () => {
  it("parses simple number string", () => {
    expect(parseCurrency("1234")).toBe(1234);
  });

  it("parses French formatted currency", () => {
    // "1 234,56 €" → 1234.56
    expect(parseCurrency("1234,56")).toBe(1234.56);
  });

  it("strips EUR suffix", () => {
    expect(parseCurrency("100EUR")).toBe(100);
  });

  it("strips € symbol", () => {
    expect(parseCurrency("50€")).toBe(50);
  });

  it("returns null for empty string", () => {
    expect(parseCurrency("")).toBeNull();
  });

  it("returns null for non-numeric text", () => {
    expect(parseCurrency("abc")).toBeNull();
  });

  it("returns null for null-like input", () => {
    expect(parseCurrency(null as any)).toBeNull();
  });
});

describe("Feature #3: clamp", () => {
  it("clamps value above max", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it("clamps value below min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it("passes through value in range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it("handles value at min boundary", () => {
    expect(clamp(0, 0, 100)).toBe(0);
  });

  it("handles value at max boundary", () => {
    expect(clamp(100, 0, 100)).toBe(100);
  });

  it("handles NaN → returns min", () => {
    expect(clamp(NaN, 0, 100)).toBe(0);
  });

  it("handles Infinity → returns min (non-finite fallback)", () => {
    expect(clamp(Infinity, 0, 100)).toBe(0);
  });
});

describe("Feature #4: roundTo", () => {
  it("rounds to 2 decimals by default", () => {
    expect(roundTo(3.14159)).toBe(3.14);
  });

  it("rounds to 0 decimals", () => {
    expect(roundTo(3.7, 0)).toBe(4);
  });

  it("rounds to 3 decimals", () => {
    expect(roundTo(1.23456, 3)).toBe(1.235);
  });

  it("handles floating-point edge case (0.1 + 0.2)", () => {
    expect(roundTo(0.1 + 0.2, 1)).toBe(0.3);
  });

  it("handles NaN → 0", () => {
    expect(roundTo(NaN)).toBe(0);
  });

  it("handles negative numbers", () => {
    expect(roundTo(-3.456, 1)).toBe(-3.5);
  });
});
