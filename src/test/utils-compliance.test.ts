/**
 * Tests for src/lib/utils/compliance.ts
 * Features #37-41: calculateReviewDeadline, isReviewOverdue, calculateKycCompleteness, maskSensitiveData, getComplianceStatus
 */

import {
  calculateReviewDeadline,
  isReviewOverdue,
  calculateKycCompleteness,
  maskSensitiveData,
  getComplianceStatus,
} from "@/lib/utils/compliance";
import type { Client } from "@/lib/types";

const makeClient = (overrides: Partial<Client> = {}): Partial<Client> => ({
  ref: "CLI-26-001",
  raisonSociale: "Test SARL",
  siren: "123456789",
  dirigeant: "Jean Dupont",
  adresse: "1 rue de la Paix",
  cp: "75001",
  ville: "Paris",
  forme: "SARL",
  dateCreation: "2020-01-01",
  ape: "69.20Z",
  mission: "TENUE COMPTABLE",
  comptable: "MAGALIE",
  mail: "test@example.fr",
  tel: "0612345678",
  dateExpCni: "2028-01-01",
  lienKbis: "https://example.fr/kbis.pdf",
  lienCni: "https://example.fr/cni.pdf",
  be: "Jean Dupont 100%",
  iban: "FR7630006000011234567890189",
  nivVigilance: "STANDARD",
  dateButoir: "2027-01-01",
  dateDerniereRevue: "2025-01-01",
  etat: "VALIDE",
  ppe: "NON",
  ...overrides,
});

describe("Feature #37: calculateReviewDeadline", () => {
  it("SIMPLIFIEE → 3 years", () => {
    const result = calculateReviewDeadline("SIMPLIFIEE", "2025-01-01");
    expect(result.getFullYear()).toBe(2028);
    expect(result.getMonth()).toBe(0);
  });

  it("STANDARD → 2 years", () => {
    const result = calculateReviewDeadline("STANDARD", "2025-06-15");
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(5);
  });

  it("RENFORCEE → 1 year", () => {
    const result = calculateReviewDeadline("RENFORCEE", "2025-03-10");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
  });

  it("accepts Date object", () => {
    const result = calculateReviewDeadline("STANDARD", new Date(2025, 0, 1));
    expect(result.getFullYear()).toBe(2027);
  });
});

describe("Feature #38: isReviewOverdue", () => {
  it("future deadline → not overdue", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const result = isReviewOverdue(future);
    expect(result.overdue).toBe(false);
    expect(result.urgency).toBe("normal");
  });

  it("past deadline → overdue + critique", () => {
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    const result = isReviewOverdue(past);
    expect(result.overdue).toBe(true);
    expect(result.urgency).toBe("critique");
    expect(result.daysRemaining).toBeLessThan(0);
  });

  it("deadline in 3 days → urgent", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    const result = isReviewOverdue(soon);
    expect(result.urgency).toBe("urgent");
  });

  it("deadline in 15 days → attention", () => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    const result = isReviewOverdue(d);
    expect(result.urgency).toBe("attention");
  });

  it("empty string → overdue + critique", () => {
    const result = isReviewOverdue("");
    expect(result.overdue).toBe(true);
    expect(result.urgency).toBe("critique");
  });
});

describe("Feature #39: calculateKycCompleteness", () => {
  it("full client → high percentage + complet", () => {
    const result = calculateKycCompleteness(makeClient());
    expect(result.percentage).toBeGreaterThanOrEqual(90);
    expect(result.status).toBe("complet");
  });

  it("minimal client → low percentage + insuffisant", () => {
    const result = calculateKycCompleteness({ ref: "CLI-001" });
    expect(result.percentage).toBeLessThan(50);
    expect(result.status).toBe("insuffisant");
    expect(result.missingFields.length).toBeGreaterThan(5);
  });

  it("partial client → partiel", () => {
    const result = calculateKycCompleteness(makeClient({
      mail: "",
      tel: "",
      dateExpCni: "",
      lienKbis: undefined,
      lienCni: undefined,
      be: "",
      iban: "",
    }));
    expect(result.status).toBe("partiel");
  });

  it("lists missing fields in French", () => {
    const result = calculateKycCompleteness({ ref: "CLI-001" });
    expect(result.missingFields).toContain("Raison sociale");
    expect(result.missingFields).toContain("SIREN");
  });

  it("empty object → insuffisant", () => {
    const result = calculateKycCompleteness({});
    expect(result.status).toBe("insuffisant");
    expect(result.percentage).toBe(0);
  });
});

describe("Feature #40: maskSensitiveData", () => {
  it("masks IBAN", () => {
    const result = maskSensitiveData("FR7630006000011234567890189", "iban");
    expect(result).toBe("FR76****0189");
    expect(result).not.toContain("00011234");
  });

  it("masks SIREN", () => {
    const result = maskSensitiveData("123456789", "siren");
    expect(result).toBe("***789");
  });

  it("masks email", () => {
    const result = maskSensitiveData("jean@example.fr", "email");
    expect(result).toBe("j***@example.fr");
  });

  it("masks phone", () => {
    const result = maskSensitiveData("0612345678", "phone");
    expect(result).toBe("06 ** ** ** 78");
  });

  it("masks CNI", () => {
    const result = maskSensitiveData("AB1234567", "cni");
    expect(result).toBe("****4567");
  });

  it("handles empty value", () => {
    expect(maskSensitiveData("", "iban")).toBe("");
  });
});

describe("Feature #41: getComplianceStatus", () => {
  it("full compliant client → conforme", () => {
    const result = getComplianceStatus(makeClient());
    expect(result.status).toBe("conforme");
    expect(result.issues).toHaveLength(0);
  });

  it("missing KBIS → a_verifier", () => {
    const result = getComplianceStatus(makeClient({ lienKbis: undefined }));
    expect(result.issues.some(i => i.includes("KBIS"))).toBe(true);
  });

  it("missing CNI link → a_verifier", () => {
    const result = getComplianceStatus(makeClient({ lienCni: undefined }));
    expect(result.issues.some(i => i.includes("identite"))).toBe(true);
  });

  it("expired CNI → issue reported", () => {
    const result = getComplianceStatus(makeClient({ dateExpCni: "2020-01-01" }));
    expect(result.issues.some(i => i.includes("CNI expiree"))).toBe(true);
  });

  it("PPE without renforcee → issue reported", () => {
    const result = getComplianceStatus(makeClient({ ppe: "OUI", nivVigilance: "STANDARD" }));
    expect(result.issues.some(i => i.includes("PPE"))).toBe(true);
  });

  it("many issues → non_conforme", () => {
    const result = getComplianceStatus(makeClient({
      lienKbis: undefined,
      lienCni: undefined,
      dateExpCni: "2020-01-01",
      ppe: "OUI",
      nivVigilance: "STANDARD",
    }));
    expect(result.status).toBe("non_conforme");
    expect(result.issues.length).toBeGreaterThan(2);
  });

  it("missing dateExpCni → issue", () => {
    const result = getComplianceStatus(makeClient({ dateExpCni: "" }));
    expect(result.issues.some(i => i.includes("CNI manquante"))).toBe(true);
  });
});
