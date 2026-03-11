/**
 * Tests for src/lib/utils/validators.ts
 * Features #32-36: validateSIRET, validateNAFCode, validateTVAIntra, getPasswordStrength, validateCodePostalEnhanced
 */

import {
  validateSIRET,
  validateNAFCode,
  validateTVAIntra,
  getPasswordStrength,
  validateCodePostalEnhanced,
} from "@/lib/utils/validators";

describe("Feature #32: validateSIRET", () => {
  it("validates a correct SIRET", () => {
    // SIRET of La Poste: 35600000000048
    const result = validateSIRET("35600000000048");
    expect(result.valid).toBe(true);
    expect(result.siren).toBe("356000000");
    expect(result.nic).toBe("00048");
  });

  it("rejects too short input", () => {
    const result = validateSIRET("12345");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("14");
  });

  it("rejects non-numeric input", () => {
    const result = validateSIRET("1234567890ABCD");
    expect(result.valid).toBe(false);
  });

  it("rejects empty input", () => {
    expect(validateSIRET("").valid).toBe(false);
  });

  it("handles spaces in input", () => {
    const result = validateSIRET("356 000 000 00048");
    expect(result.valid).toBe(true);
  });

  it("rejects invalid Luhn checksum", () => {
    const result = validateSIRET("35600000000049");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Luhn");
  });
});

describe("Feature #33: validateNAFCode", () => {
  it("validates correct NAF with dot", () => {
    expect(validateNAFCode("56.10A")).toBe(true);
  });

  it("validates correct NAF without dot", () => {
    expect(validateNAFCode("5610A")).toBe(true);
  });

  it("validates lowercase letter", () => {
    expect(validateNAFCode("69.20z")).toBe(true);
  });

  it("rejects missing letter", () => {
    expect(validateNAFCode("5610")).toBe(false);
  });

  it("rejects too short", () => {
    expect(validateNAFCode("56A")).toBe(false);
  });

  it("rejects empty", () => {
    expect(validateNAFCode("")).toBe(false);
  });
});

describe("Feature #34: validateTVAIntra", () => {
  it("validates correct French TVA", () => {
    // FR + check digits + SIREN
    // For SIREN 356000000: check = (12 + 3*(356000000 % 97)) % 97
    const siren = 356000000;
    const check = (12 + 3 * (siren % 97)) % 97;
    const tva = `FR${check.toString().padStart(2, "0")}${siren}`;
    const result = validateTVAIntra(tva);
    expect(result.valid).toBe(true);
    expect(result.countryCode).toBe("FR");
  });

  it("rejects wrong check digits", () => {
    const result = validateTVAIntra("FR99356000000");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Cle");
  });

  it("rejects empty", () => {
    expect(validateTVAIntra("").valid).toBe(false);
  });

  it("rejects too short", () => {
    expect(validateTVAIntra("FR1").valid).toBe(false);
  });

  it("accepts other EU country (basic format)", () => {
    const result = validateTVAIntra("DE123456789");
    expect(result.valid).toBe(true);
    expect(result.countryCode).toBe("DE");
  });

  it("handles spaces", () => {
    const siren = 356000000;
    const check = (12 + 3 * (siren % 97)) % 97;
    const tva = `FR ${check.toString().padStart(2, "0")} ${siren}`;
    const result = validateTVAIntra(tva);
    expect(result.valid).toBe(true);
  });
});

describe("Feature #35: getPasswordStrength", () => {
  it("empty password → score 0", () => {
    const result = getPasswordStrength("");
    expect(result.score).toBe(0);
    expect(result.label).toBe("Tres faible");
  });

  it("short simple password → score 1", () => {
    const result = getPasswordStrength("abcd1234");
    expect(result.score).toBeLessThanOrEqual(2);
  });

  it("medium password with mixed case + digits → score 2-3", () => {
    const result = getPasswordStrength("Abcdef12");
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("strong password → score 3-4", () => {
    const result = getPasswordStrength("MyP@ssw0rd!2026");
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.label).toMatch(/Fort|Excellent/);
  });

  it("excellent long password → score 4", () => {
    const result = getPasswordStrength("C0mpl3x!P@ssw0rd#2026Long");
    expect(result.score).toBe(4);
    expect(result.label).toBe("Excellent");
    expect(result.suggestions).toHaveLength(0);
  });

  it("penalizes common passwords", () => {
    const result = getPasswordStrength("password123");
    expect(result.score).toBeLessThanOrEqual(2);
  });

  it("penalizes repeated characters", () => {
    const result = getPasswordStrength("aaaaAAAA1111");
    expect(result.score).toBeLessThanOrEqual(3);
  });

  it("returns suggestions for weak passwords", () => {
    const result = getPasswordStrength("abc");
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});

describe("Feature #36: validateCodePostalEnhanced", () => {
  it("validates Paris (75001)", () => {
    const result = validateCodePostalEnhanced("75001");
    expect(result.valid).toBe(true);
    expect(result.departement).toBe("75");
    expect(result.departementNom).toBe("Paris");
    expect(result.region).toBe("Ile-de-France");
  });

  it("validates Lyon (69001)", () => {
    const result = validateCodePostalEnhanced("69001");
    expect(result.valid).toBe(true);
    expect(result.departement).toBe("69");
  });

  it("validates Corsica 2A (20000)", () => {
    const result = validateCodePostalEnhanced("20000");
    expect(result.valid).toBe(true);
    expect(result.departement).toBe("2A");
    expect(result.region).toBe("Corse");
  });

  it("validates Corsica 2B (20200+)", () => {
    const result = validateCodePostalEnhanced("20200");
    expect(result.valid).toBe(true);
    expect(result.departement).toBe("2B");
  });

  it("validates DOM-TOM (97100)", () => {
    const result = validateCodePostalEnhanced("97100");
    expect(result.valid).toBe(true);
    expect(result.departement).toBe("971");
    expect(result.region).toBe("DOM-TOM");
  });

  it("rejects too short", () => {
    expect(validateCodePostalEnhanced("7500").valid).toBe(false);
  });

  it("rejects too long", () => {
    expect(validateCodePostalEnhanced("750001").valid).toBe(false);
  });

  it("rejects empty", () => {
    expect(validateCodePostalEnhanced("").valid).toBe(false);
  });

  it("rejects invalid department (00)", () => {
    const result = validateCodePostalEnhanced("00100");
    expect(result.valid).toBe(false);
  });
});
