/**
 * Tests for src/lib/utils/format.ts
 * Features #11-15: formatSiren, formatSiret, formatIban, formatDuration, pluralize
 */
import { formatSiren, formatSiret, formatIban, formatDuration, pluralize } from "@/lib/utils/format";

describe("Feature #11: formatSiren", () => {
  it("formats 9-digit SIREN", () => { expect(formatSiren("123456789")).toBe("123 456 789"); });
  it("handles already spaced", () => { expect(formatSiren("123 456 789")).toBe("123 456 789"); });
  it("returns original for wrong length", () => { expect(formatSiren("12345")).toBe("12345"); });
  it("handles empty", () => { expect(formatSiren("")).toBe(""); });
});

describe("Feature #12: formatSiret", () => {
  it("formats 14-digit SIRET", () => { expect(formatSiret("12345678901234")).toBe("123 456 789 01234"); });
  it("handles wrong length", () => { expect(formatSiret("12345")).toBe("12345"); });
  it("handles empty", () => { expect(formatSiret("")).toBe(""); });
});

describe("Feature #13: formatIban", () => {
  it("formats IBAN with spaces every 4", () => {
    expect(formatIban("FR7630006000011234567890189")).toBe("FR76 3000 6000 0112 3456 7890 189");
  });
  it("uppercases", () => { expect(formatIban("fr7612345678")).toMatch(/^FR76/); });
  it("strips existing spaces", () => {
    expect(formatIban("FR76 3000 6000")).toBe("FR76 3000 6000");
  });
  it("handles empty", () => { expect(formatIban("")).toBe(""); });
});

describe("Feature #14: formatDuration", () => {
  it("seconds only", () => { expect(formatDuration(30)).toBe("30s"); });
  it("minutes and seconds", () => { expect(formatDuration(90)).toBe("1min 30s"); });
  it("minutes only (exact)", () => { expect(formatDuration(120)).toBe("2min"); });
  it("hours and minutes", () => { expect(formatDuration(3750)).toBe("1h 2min"); });
  it("hours only (exact)", () => { expect(formatDuration(3600)).toBe("1h"); });
  it("zero", () => { expect(formatDuration(0)).toBe("0s"); });
  it("negative → 0s", () => { expect(formatDuration(-10)).toBe("0s"); });
  it("NaN → 0s", () => { expect(formatDuration(NaN)).toBe("0s"); });
});

describe("Feature #15: pluralize", () => {
  it("singular for 0", () => { expect(pluralize(0, "client")).toBe("0 client"); });
  it("singular for 1", () => { expect(pluralize(1, "client")).toBe("1 client"); });
  it("plural for 2+", () => { expect(pluralize(5, "client")).toBe("5 clients"); });
  it("custom plural", () => { expect(pluralize(3, "travail", "travaux")).toBe("3 travaux"); });
  it("negative singular", () => { expect(pluralize(-1, "jour")).toBe("-1 jour"); });
});
