import { describe, it, expect } from "vitest";

// String utilities
import {
  removeDiacritics, normalizeCompanyName, normalizeName,
  normalizeWhitespace, truncateText, slugify,
  maskSensitiveData, extractInitials,
} from "../lib/stringUtils";

// Number utilities
import {
  roundToCents, formatEuro, formatNumber, parseFrenchNumber,
  isSuspiciouslyRound, calculatePaymentSchedule,
  validateCapitalHonorairesRatio, calculateTVA,
} from "../lib/numberUtils";

// Date utilities
import {
  getFrenchHolidays, isBusinessDay, addBusinessDays,
  isReasonableDate, daysBetween, isExpiringSoon, getQuarter,
  formatDateFR, daysUntil, timeAgo,
} from "../lib/dateUtils";

// Validation extended
import {
  validateSIRET, validateTVAIntra, isDisposableEmail,
  validatePhoneType, validateClientDates, validateBeneficiaryPercentages,
  validateNAF, validateRCS,
} from "../lib/validationExtended";

// Compliance
import {
  detectShellCompanySignals, calculateClientCompleteness,
  levenshteinDistance, nameSimilarity, classifyMissionRisk,
  calculateAlertePriority, generateComplianceRef,
  isHighRiskJurisdiction,
} from "../lib/complianceUtils";

// Collections
import { groupBy, deduplicateBy, chunk, findDuplicates } from "../lib/collectionUtils";

// Security
import { generateSecureToken, sanitizeFilename, rateLimitKey } from "../lib/securityUtils";

import type { Client, AlerteRegistre } from "../lib/types";

// Helper
function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    ref: "CLI-26-001", etat: "VALIDE", comptable: "MAGALIE",
    mission: "TENUE COMPTABLE", raisonSociale: "TEST SARL", forme: "SARL",
    adresse: "1 RUE DE LA PAIX", cp: "75001", ville: "PARIS",
    siren: "123 456 789", capital: 10000, ape: "62.20Z",
    dirigeant: "DUPONT JEAN", domaine: "INFORMATIQUE", effectif: "5 SALARIES",
    tel: "0100000000", mail: "test@example.com",
    dateCreation: "2015-01-01", dateReprise: "", honoraires: 5000,
    reprise: 0, juridique: 0, frequence: "MENSUEL", iban: "", bic: "",
    associe: "DIDIER", superviseur: "SAMUEL",
    ppe: "NON", paysRisque: "NON", atypique: "NON",
    distanciel: "NON", cash: "NON", pression: "NON",
    scoreActivite: 25, scorePays: 0, scoreMission: 25, scoreMaturite: 0,
    scoreStructure: 20, malus: 0, scoreGlobal: 14, nivVigilance: "SIMPLIFIEE",
    dateCreationLigne: "2024-01-01", dateDerniereRevue: "2024-01-01",
    dateButoir: "2030-01-01", etatPilotage: "A JOUR",
    dateExpCni: "2030-01-01", statut: "ACTIF",
    be: "DUPONT JEAN 100%", lienKbis: "https://example.com/kbis",
    lienStatuts: "", lienCni: "",
    ...overrides,
  };
}

// ======================================================================
// FEATURE 1: removeDiacritics
// ======================================================================
describe("F1: removeDiacritics", () => {
  it("removes French accents", () => {
    expect(removeDiacritics("éàüîôç")).toBe("eauioc");
  });
  it("handles empty/null", () => {
    expect(removeDiacritics("")).toBe("");
    expect(removeDiacritics(null as any)).toBe("");
  });
  it("preserves non-accented text", () => {
    expect(removeDiacritics("HELLO")).toBe("HELLO");
  });
  it("handles complex French text", () => {
    expect(removeDiacritics("Société Générale")).toBe("Societe Generale");
  });
});

// ======================================================================
// FEATURE 2: normalizeCompanyName
// ======================================================================
describe("F2: normalizeCompanyName", () => {
  it("strips legal suffixes", () => {
    expect(normalizeCompanyName("DUPONT SARL")).toBe("DUPONT");
  });
  it("removes accents and uppercases", () => {
    expect(normalizeCompanyName("Société Générale SAS")).toBe("GENERALE");
  });
  it("handles null/empty", () => {
    expect(normalizeCompanyName("")).toBe("");
    expect(normalizeCompanyName(null as any)).toBe("");
  });
  it("normalizes whitespace", () => {
    expect(normalizeCompanyName("  TEST   COMPANY  ")).toBe("TEST COMPANY");
  });
});

// ======================================================================
// FEATURE 3: normalizeName
// ======================================================================
describe("F3: normalizeName", () => {
  it("strips titles and accents", () => {
    expect(normalizeName("M. François Lefèvre")).toBe("FRANCOIS LEFEVRE");
  });
  it("handles MME title", () => {
    expect(normalizeName("MME DUPONT Marie")).toBe("DUPONT MARIE");
  });
  it("handles null", () => {
    expect(normalizeName(null as any)).toBe("");
  });
});

// ======================================================================
// FEATURE 4: normalizeWhitespace
// ======================================================================
describe("F4: normalizeWhitespace", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeWhitespace("hello   world")).toBe("hello world");
  });
  it("replaces tabs and newlines", () => {
    expect(normalizeWhitespace("hello\t\nworld")).toBe("hello world");
  });
  it("handles null", () => {
    expect(normalizeWhitespace(null as any)).toBe("");
  });
});

// ======================================================================
// FEATURE 5: truncateText
// ======================================================================
describe("F5: truncateText", () => {
  it("truncates long text", () => {
    const result = truncateText("This is a very long text", 15);
    expect(result.length).toBeLessThanOrEqual(15);
    expect(result).toContain("...");
  });
  it("does not truncate short text", () => {
    expect(truncateText("short", 20)).toBe("short");
  });
  it("handles null", () => {
    expect(truncateText(null as any, 10)).toBe("");
  });
});

// ======================================================================
// FEATURE 6: slugify
// ======================================================================
describe("F6: slugify", () => {
  it("creates URL-safe slug", () => {
    expect(slugify("Société Générale")).toBe("societe-generale");
  });
  it("removes special chars", () => {
    expect(slugify("Hello & World!")).toBe("hello-world");
  });
  it("handles empty", () => {
    expect(slugify("")).toBe("");
  });
});

// ======================================================================
// FEATURE 7: maskSensitiveData
// ======================================================================
describe("F7: maskSensitiveData", () => {
  it("masks IBAN", () => {
    const result = maskSensitiveData("FR7630006000011234567890189", "iban");
    expect(result).toContain("FR76");
    expect(result).toContain("0189");
    expect(result).toContain("****");
  });
  it("masks email", () => {
    const result = maskSensitiveData("jean.dupont@test.fr", "email");
    expect(result).toContain("je***@test.fr");
  });
  it("masks phone", () => {
    const result = maskSensitiveData("0612345678", "phone");
    expect(result).toContain("061");
    expect(result).toContain("78");
  });
  it("masks SIREN", () => {
    const result = maskSensitiveData("123 456 789", "siren");
    expect(result).toContain("123");
    expect(result).toContain("789");
  });
  it("handles empty", () => {
    expect(maskSensitiveData("", "iban")).toBe("");
  });
});

// ======================================================================
// FEATURE 8: extractInitials
// ======================================================================
describe("F8: extractInitials", () => {
  it("extracts initials from name", () => {
    expect(extractInitials("Jean-Pierre Dupont")).toBe("JPD");
  });
  it("limits to maxLen", () => {
    expect(extractInitials("A B C D E", 2)).toBe("AB");
  });
  it("handles single name", () => {
    expect(extractInitials("DUPONT")).toBe("D");
  });
  it("handles empty", () => {
    expect(extractInitials("")).toBe("");
  });
});

// ======================================================================
// FEATURE 9: roundToCents
// ======================================================================
describe("F9: roundToCents", () => {
  it("rounds to 2 decimal places", () => {
    expect(roundToCents(1.999)).toBe(2);
    expect(roundToCents(1.004)).toBe(1);
    expect(roundToCents(99.995)).toBe(100);
  });
  it("handles NaN", () => {
    expect(roundToCents(NaN)).toBe(0);
  });
  it("handles negative", () => {
    expect(roundToCents(-1.999)).toBe(-2);
  });
  it("handles zero", () => {
    expect(roundToCents(0)).toBe(0);
  });
});

// ======================================================================
// FEATURE 10: formatEuro
// ======================================================================
describe("F10: formatEuro", () => {
  it("formats with euro symbol", () => {
    const result = formatEuro(1234.56);
    expect(result).toContain("€");
    expect(result).toMatch(/1[\s\u202f]234,56/);
  });
  it("formats without symbol", () => {
    const result = formatEuro(1234.56, false);
    expect(result).not.toContain("€");
  });
  it("handles NaN", () => {
    expect(formatEuro(NaN)).toContain("0,00");
  });
});

// ======================================================================
// FEATURE 11: formatNumber
// ======================================================================
describe("F11: formatNumber", () => {
  it("formats with FR locale", () => {
    const result = formatNumber(1234567, 0);
    expect(result).toMatch(/1[\s\u202f]234[\s\u202f]567/);
  });
  it("handles decimals", () => {
    const result = formatNumber(1234.5, 2);
    expect(result).toContain(",5");
  });
});

// ======================================================================
// FEATURE 12: parseFrenchNumber
// ======================================================================
describe("F12: parseFrenchNumber", () => {
  it("parses French formatted number", () => {
    expect(parseFrenchNumber("1 234,56")).toBe(1234.56);
  });
  it("returns null for invalid", () => {
    expect(parseFrenchNumber("abc")).toBe(null);
    expect(parseFrenchNumber("")).toBe(null);
  });
  it("handles plain numbers", () => {
    expect(parseFrenchNumber("42")).toBe(42);
  });
});

// ======================================================================
// FEATURE 13: isSuspiciouslyRound
// ======================================================================
describe("F13: isSuspiciouslyRound", () => {
  it("flags 10000", () => {
    expect(isSuspiciouslyRound(10000)).toBe(true);
  });
  it("flags 5500", () => {
    expect(isSuspiciouslyRound(5500)).toBe(true);
  });
  it("does not flag 1234.56", () => {
    expect(isSuspiciouslyRound(1234.56)).toBe(false);
  });
  it("does not flag zero/negative", () => {
    expect(isSuspiciouslyRound(0)).toBe(false);
    expect(isSuspiciouslyRound(-1000)).toBe(false);
  });
});

// ======================================================================
// FEATURE 14: calculatePaymentSchedule
// ======================================================================
describe("F14: calculatePaymentSchedule", () => {
  it("monthly schedule", () => {
    const r = calculatePaymentSchedule(12000, "MENSUEL");
    expect(r.montant).toBe(1000);
    expect(r.echeances).toBe(12);
  });
  it("quarterly schedule", () => {
    const r = calculatePaymentSchedule(12000, "TRIMESTRIEL");
    expect(r.montant).toBe(3000);
    expect(r.echeances).toBe(4);
  });
  it("annual schedule", () => {
    const r = calculatePaymentSchedule(5000, "ANNUEL");
    expect(r.montant).toBe(5000);
    expect(r.echeances).toBe(1);
  });
  it("handles negative", () => {
    const r = calculatePaymentSchedule(-100, "MENSUEL");
    expect(r.montant).toBe(0);
  });
});

// ======================================================================
// FEATURE 15: validateCapitalHonorairesRatio
// ======================================================================
describe("F15: validateCapitalHonorairesRatio", () => {
  it("flags low capital with high honoraires", () => {
    const r = validateCapitalHonorairesRatio(50, 20000);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("flags high capital with low honoraires", () => {
    const r = validateCapitalHonorairesRatio(2000000, 500);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("no warnings for normal ratio with non-round honoraires", () => {
    const r = validateCapitalHonorairesRatio(10000, 4567);
    expect(r.warnings.length).toBe(0);
  });
  it("flags suspiciously round honoraires", () => {
    const r = validateCapitalHonorairesRatio(10000, 50000);
    expect(r.warnings.some(w => w.includes("rond"))).toBe(true);
  });
});

// ======================================================================
// FEATURE 16: calculateTVA
// ======================================================================
describe("F16: calculateTVA", () => {
  it("calculates 20% TVA", () => {
    const r = calculateTVA(1000, 20);
    expect(r.ht).toBe(1000);
    expect(r.tva).toBe(200);
    expect(r.ttc).toBe(1200);
  });
  it("calculates 5.5% TVA", () => {
    const r = calculateTVA(1000, 5.5);
    expect(r.tva).toBe(55);
  });
  it("handles NaN", () => {
    const r = calculateTVA(NaN);
    expect(r.ttc).toBe(0);
  });
});

// ======================================================================
// FEATURE 17: getFrenchHolidays
// ======================================================================
describe("F17: getFrenchHolidays", () => {
  it("returns 11 holidays for 2024", () => {
    const h = getFrenchHolidays(2024);
    expect(h.length).toBe(11);
  });
  it("includes fixed holidays", () => {
    const h = getFrenchHolidays(2024);
    expect(h).toContain("2024-01-01");
    expect(h).toContain("2024-07-14");
    expect(h).toContain("2024-12-25");
  });
  it("includes Easter Monday 2024", () => {
    const h = getFrenchHolidays(2024);
    expect(h).toContain("2024-04-01"); // Lundi de Paques 2024
  });
  it("holidays are sorted", () => {
    const h = getFrenchHolidays(2025);
    for (let i = 1; i < h.length; i++) {
      expect(h[i] >= h[i - 1]).toBe(true);
    }
  });
});

// ======================================================================
// FEATURE 18: isBusinessDay
// ======================================================================
describe("F18: isBusinessDay", () => {
  it("Monday is business day", () => {
    expect(isBusinessDay("2024-01-08")).toBe(true); // Monday
  });
  it("Saturday is not business day", () => {
    expect(isBusinessDay("2024-01-06")).toBe(false); // Saturday
  });
  it("Sunday is not business day", () => {
    expect(isBusinessDay("2024-01-07")).toBe(false); // Sunday
  });
  it("Jan 1 is not business day", () => {
    expect(isBusinessDay("2024-01-01")).toBe(false); // Holiday
  });
  it("invalid date returns false", () => {
    expect(isBusinessDay("invalid")).toBe(false);
  });
});

// ======================================================================
// FEATURE 19: addBusinessDays
// ======================================================================
describe("F19: addBusinessDays", () => {
  it("adds 5 business days (1 week)", () => {
    const result = addBusinessDays("2024-01-08", 5); // Mon
    expect(result).toBe("2024-01-15"); // Next Mon
  });
  it("skips weekends", () => {
    const result = addBusinessDays("2024-01-05", 1); // Friday
    expect(result).toBe("2024-01-08"); // Monday
  });
  it("handles negative days", () => {
    const result = addBusinessDays("2024-01-08", -1); // Monday
    expect(result).toBe("2024-01-05"); // Previous Friday
  });
  it("handles invalid date", () => {
    expect(addBusinessDays("invalid", 5)).toBe("invalid");
  });
});

// ======================================================================
// FEATURE 20: isReasonableDate
// ======================================================================
describe("F20: isReasonableDate", () => {
  it("accepts today", () => {
    expect(isReasonableDate(new Date().toISOString().split("T")[0])).toBe(true);
  });
  it("rejects year 1700", () => {
    expect(isReasonableDate("1700-01-01")).toBe(false);
  });
  it("rejects far future", () => {
    expect(isReasonableDate("2200-01-01")).toBe(false);
  });
  it("rejects invalid date", () => {
    expect(isReasonableDate("not-a-date")).toBe(false);
  });
  it("accepts 10 years past", () => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 10);
    expect(isReasonableDate(d.toISOString().split("T")[0])).toBe(true);
  });
});

// ======================================================================
// FEATURE 21: daysBetween
// ======================================================================
describe("F21: daysBetween", () => {
  it("calculates correct difference", () => {
    expect(daysBetween("2024-01-01", "2024-01-31")).toBe(30);
  });
  it("is absolute (order doesn't matter)", () => {
    expect(daysBetween("2024-01-31", "2024-01-01")).toBe(30);
  });
  it("returns 0 for invalid dates", () => {
    expect(daysBetween("bad", "date")).toBe(0);
  });
});

// ======================================================================
// FEATURE 22: isExpiringSoon
// ======================================================================
describe("F22: isExpiringSoon", () => {
  it("detects expiring within 30 days", () => {
    const d = new Date(); d.setDate(d.getDate() + 15);
    expect(isExpiringSoon(d.toISOString().split("T")[0], 30)).toBe(true);
  });
  it("does not flag far future", () => {
    expect(isExpiringSoon("2099-01-01", 30)).toBe(false);
  });
  it("does not flag past dates", () => {
    expect(isExpiringSoon("2020-01-01", 30)).toBe(false);
  });
  it("handles empty", () => {
    expect(isExpiringSoon("", 30)).toBe(false);
  });
});

// ======================================================================
// FEATURE 23: getQuarter
// ======================================================================
describe("F23: getQuarter", () => {
  it("January is Q1", () => { expect(getQuarter("2024-01-15")).toBe(1); });
  it("April is Q2", () => { expect(getQuarter("2024-04-01")).toBe(2); });
  it("September is Q3", () => { expect(getQuarter("2024-09-30")).toBe(3); });
  it("December is Q4", () => { expect(getQuarter("2024-12-25")).toBe(4); });
  it("invalid returns 0", () => { expect(getQuarter("invalid")).toBe(0); });
});

// ======================================================================
// FEATURE 24: formatDateFR (existing but testing extended)
// ======================================================================
describe("F24: formatDateFR", () => {
  it("formats valid date", () => {
    const result = formatDateFR("2024-01-15");
    expect(result).toContain("2024");
  });
  it("handles null", () => {
    expect(formatDateFR(null)).toBe("\u2014");
  });
  it("handles invalid", () => {
    expect(formatDateFR("invalid")).toBe("invalid");
  });
});

// ======================================================================
// FEATURE 25: validateSIRET
// ======================================================================
describe("F25: validateSIRET", () => {
  it("accepts valid SIRET", () => {
    expect(validateSIRET("73282932000000")).toBe(true);
  });
  it("rejects too short", () => {
    expect(validateSIRET("123456789")).toBe(false);
  });
  it("rejects non-numeric", () => {
    expect(validateSIRET("7328293200007A")).toBe(false);
  });
  it("rejects wrong checksum", () => {
    expect(validateSIRET("73282932000001")).toBe(false);
  });
});

// ======================================================================
// FEATURE 26: validateTVAIntra
// ======================================================================
describe("F26: validateTVAIntra", () => {
  it("accepts valid French TVA", () => {
    expect(validateTVAIntra("FR 44 732829320")).toBe(true);
  });
  it("rejects wrong prefix", () => {
    expect(validateTVAIntra("DE 32 732829320")).toBe(false);
  });
  it("rejects too short", () => {
    expect(validateTVAIntra("FR 32 123")).toBe(false);
  });
});

// ======================================================================
// FEATURE 27: isDisposableEmail
// ======================================================================
describe("F27: isDisposableEmail", () => {
  it("detects yopmail", () => {
    expect(isDisposableEmail("test@yopmail.com")).toBe(true);
  });
  it("detects mailinator", () => {
    expect(isDisposableEmail("test@mailinator.com")).toBe(true);
  });
  it("accepts gmail", () => {
    expect(isDisposableEmail("test@gmail.com")).toBe(false);
  });
  it("handles null", () => {
    expect(isDisposableEmail(null as any)).toBe(false);
  });
  it("handles missing @", () => {
    expect(isDisposableEmail("notanemail")).toBe(false);
  });
});

// ======================================================================
// FEATURE 28: validatePhoneType
// ======================================================================
describe("F28: validatePhoneType", () => {
  it("detects mobile", () => {
    const r = validatePhoneType("06 12 34 56 78");
    expect(r.valid).toBe(true);
    expect(r.type).toBe("mobile");
  });
  it("detects landline", () => {
    const r = validatePhoneType("01 23 45 67 89");
    expect(r.valid).toBe(true);
    expect(r.type).toBe("fixe");
  });
  it("handles +33 prefix", () => {
    const r = validatePhoneType("+33 6 12 34 56 78");
    expect(r.valid).toBe(true);
    expect(r.type).toBe("mobile");
  });
  it("rejects invalid", () => {
    expect(validatePhoneType("123").valid).toBe(false);
  });
  it("handles null", () => {
    expect(validatePhoneType(null as any).valid).toBe(false);
  });
});

// ======================================================================
// FEATURE 29: validateClientDates
// ======================================================================
describe("F29: validateClientDates", () => {
  it("accepts valid dates", () => {
    const r = validateClientDates({ dateCreation: "2015-01-01", dateExpCni: "2030-01-01" });
    expect(r.valid).toBe(true);
  });
  it("rejects future creation date", () => {
    const r = validateClientDates({ dateCreation: "2099-01-01" });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Date de creation dans le futur");
  });
  it("rejects reprise before creation", () => {
    const r = validateClientDates({ dateCreation: "2020-01-01", dateReprise: "2015-01-01" });
    expect(r.valid).toBe(false);
  });
  it("rejects very old CNI", () => {
    const r = validateClientDates({ dateExpCni: "2000-01-01" });
    expect(r.valid).toBe(false);
  });
  it("rejects future review date", () => {
    const r = validateClientDates({ dateDerniereRevue: "2099-01-01" });
    expect(r.valid).toBe(false);
  });
});

// ======================================================================
// FEATURE 30: validateBeneficiaryPercentages
// ======================================================================
describe("F30: validateBeneficiaryPercentages", () => {
  it("accepts valid percentages", () => {
    const r = validateBeneficiaryPercentages([
      { nom: "A", pourcentage: 60 }, { nom: "B", pourcentage: 40 },
    ]);
    expect(r.valid).toBe(true);
  });
  it("rejects total > 100%", () => {
    const r = validateBeneficiaryPercentages([
      { nom: "A", pourcentage: 60 }, { nom: "B", pourcentage: 60 },
    ]);
    expect(r.valid).toBe(false);
  });
  it("rejects negative percentage", () => {
    const r = validateBeneficiaryPercentages([{ nom: "A", pourcentage: -10 }]);
    expect(r.valid).toBe(false);
  });
  it("rejects > 100% for single beneficiary", () => {
    const r = validateBeneficiaryPercentages([{ nom: "A", pourcentage: 150 }]);
    expect(r.valid).toBe(false);
  });
});

// ======================================================================
// FEATURE 31: validateNAF
// ======================================================================
describe("F31: validateNAF", () => {
  it("accepts valid NAF code", () => {
    expect(validateNAF("62.20Z")).toBe(true);
  });
  it("accepts lowercase", () => {
    expect(validateNAF("56.10a")).toBe(true);
  });
  it("rejects invalid format", () => {
    expect(validateNAF("6220Z")).toBe(false);
    expect(validateNAF("")).toBe(false);
  });
});

// ======================================================================
// FEATURE 32: validateRCS
// ======================================================================
describe("F32: validateRCS", () => {
  it("accepts valid RCS", () => {
    expect(validateRCS("RCS PARIS B 123456789")).toBe(true);
  });
  it("accepts without RCS prefix", () => {
    expect(validateRCS("PARIS B 123456789")).toBe(true);
  });
  it("rejects invalid", () => {
    expect(validateRCS("")).toBe(false);
    expect(validateRCS("123")).toBe(false);
  });
});

// ======================================================================
// FEATURE 33: detectShellCompanySignals
// ======================================================================
describe("F33: detectShellCompanySignals", () => {
  it("detects low capital + high honoraires", () => {
    const c = makeClient({ capital: 50, honoraires: 20000 });
    const signals = detectShellCompanySignals(c);
    expect(signals.some(s => s.signal.includes("Capital"))).toBe(true);
  });
  it("detects reprise without employees", () => {
    const c = makeClient({ effectif: "0", dateReprise: "2020-01-01", dateCreation: "2010-01-01" });
    const signals = detectShellCompanySignals(c);
    expect(signals.some(s => s.signal.includes("Reprise"))).toBe(true);
  });
  it("detects PO box address", () => {
    const c = makeClient({ adresse: "BP 123 BOITE POSTALE" });
    const signals = detectShellCompanySignals(c);
    expect(signals.some(s => s.signal.includes("boite postale"))).toBe(true);
  });
  it("detects missing BE", () => {
    const c = makeClient({ be: "" });
    const signals = detectShellCompanySignals(c);
    expect(signals.some(s => s.signal.includes("Beneficiaires"))).toBe(true);
  });
  it("clean client has no high-severity signals", () => {
    const c = makeClient();
    const signals = detectShellCompanySignals(c);
    const highSeverity = signals.filter(s => s.severity === "high");
    expect(highSeverity.length).toBe(0);
  });
});

// ======================================================================
// FEATURE 34: calculateClientCompleteness
// ======================================================================
describe("F34: calculateClientCompleteness", () => {
  it("complete client scores high", () => {
    const c = makeClient({ lienCni: "link", capital: 10000 });
    const r = calculateClientCompleteness(c);
    expect(r.percentage).toBeGreaterThanOrEqual(80);
    expect(r.level).toBe("complet");
  });
  it("empty client scores low", () => {
    const c = makeClient({
      siren: "", mail: "", tel: "", ape: "", be: "",
      capital: 0, honoraires: 0, lienKbis: "", dateExpCni: "",
    });
    const r = calculateClientCompleteness(c);
    expect(r.percentage).toBeLessThan(60);
    expect(r.missingFields.length).toBeGreaterThan(5);
  });
  it("returns missing fields list", () => {
    const c = makeClient({ siren: "" });
    const r = calculateClientCompleteness(c);
    expect(r.missingFields).toContain("SIREN");
  });
});

// ======================================================================
// FEATURE 35: levenshteinDistance
// ======================================================================
describe("F35: levenshteinDistance", () => {
  it("identical strings = 0", () => {
    expect(levenshteinDistance("DUPONT", "DUPONT")).toBe(0);
  });
  it("one char difference = 1", () => {
    expect(levenshteinDistance("DUPONT", "DUPOND")).toBe(1);
  });
  it("empty vs string = string length", () => {
    expect(levenshteinDistance("", "ABC")).toBe(3);
  });
  it("Lefevre vs Lefebvre", () => {
    expect(levenshteinDistance("LEFEVRE", "LEFEBVRE")).toBe(1);
  });
});

// ======================================================================
// FEATURE 36: nameSimilarity
// ======================================================================
describe("F36: nameSimilarity", () => {
  it("identical names = 1", () => {
    expect(nameSimilarity("DUPONT", "DUPONT")).toBe(1);
  });
  it("similar names > 0.8", () => {
    expect(nameSimilarity("LEFEVRE", "LEFEBVRE")).toBeGreaterThan(0.8);
  });
  it("different names < 0.5", () => {
    expect(nameSimilarity("DUPONT", "MARTIN")).toBeLessThan(0.5);
  });
  it("handles empty", () => {
    expect(nameSimilarity("", "TEST")).toBe(0);
  });
});

// ======================================================================
// FEATURE 37: classifyMissionRisk
// ======================================================================
describe("F37: classifyMissionRisk", () => {
  it("DOMICILIATION = tres_eleve", () => {
    expect(classifyMissionRisk("DOMICILIATION")).toBe("tres_eleve");
  });
  it("CONSTITUTION = eleve", () => {
    expect(classifyMissionRisk("CONSTITUTION / CESSION")).toBe("eleve");
  });
  it("CONSEIL = moyen", () => {
    expect(classifyMissionRisk("CONSEIL DE GESTION")).toBe("moyen");
  });
  it("TENUE COMPTABLE = faible", () => {
    expect(classifyMissionRisk("TENUE COMPTABLE")).toBe("faible");
  });
});

// ======================================================================
// FEATURE 38: calculateAlertePriority
// ======================================================================
describe("F38: calculateAlertePriority", () => {
  const base: AlerteRegistre = {
    date: "2024-01-01", clientConcerne: "CLI-1", categorie: "",
    details: "", actionPrise: "", responsable: "", qualification: "",
    statut: "EN COURS", dateButoir: "", typeDecision: "", validateur: "",
  };

  it("TRACFIN = CRITIQUE", () => {
    expect(calculateAlertePriority({ ...base, categorie: "SOUPCON : Tracfin potentiel" })).toBe("CRITIQUE");
  });
  it("GEL = CRITIQUE", () => {
    expect(calculateAlertePriority({ ...base, categorie: "EXTERNE : Gel des avoirs / Sanctions" })).toBe("CRITIQUE");
  });
  it("FLUX = HAUTE", () => {
    expect(calculateAlertePriority({ ...base, categorie: "FLUX : Incoherence / Atypique" })).toBe("HAUTE");
  });
  it("ADMIN = MOYENNE", () => {
    expect(calculateAlertePriority({ ...base, categorie: "ADMIN : KYC Incomplet" })).toBe("MOYENNE");
  });
  it("unknown = BASSE", () => {
    expect(calculateAlertePriority({ ...base, categorie: "Autre" })).toBe("BASSE");
  });
});

// ======================================================================
// FEATURE 39: generateComplianceRef
// ======================================================================
describe("F39: generateComplianceRef", () => {
  it("generates ALERTE ref", () => {
    const ref = generateComplianceRef("ALERTE", 42);
    expect(ref).toMatch(/^ALR-\d{4}-0042$/);
  });
  it("generates DS ref", () => {
    const ref = generateComplianceRef("DS", 1);
    expect(ref).toMatch(/^DS-\d{4}-0001$/);
  });
  it("generates CTRL ref", () => {
    expect(generateComplianceRef("CTRL", 100)).toMatch(/^CTR-\d{4}-0100$/);
  });
});

// ======================================================================
// FEATURE 40: isHighRiskJurisdiction
// ======================================================================
describe("F40: isHighRiskJurisdiction", () => {
  it("IRAN = eleve", () => {
    const r = isHighRiskJurisdiction("IRAN");
    expect(r.isHighRisk).toBe(true);
    expect(r.level).toBe("eleve");
  });
  it("TURQUIE = surveille", () => {
    const r = isHighRiskJurisdiction("TURQUIE");
    expect(r.isMonitored).toBe(true);
    expect(r.level).toBe("surveille");
  });
  it("FRANCE = aucun", () => {
    const r = isHighRiskJurisdiction("FRANCE");
    expect(r.level).toBe("aucun");
  });
  it("handles empty", () => {
    expect(isHighRiskJurisdiction("").level).toBe("aucun");
  });
});

// ======================================================================
// FEATURE 41: groupBy
// ======================================================================
describe("F41: groupBy", () => {
  it("groups items by key", () => {
    const items = [{ cat: "A", v: 1 }, { cat: "B", v: 2 }, { cat: "A", v: 3 }];
    const groups = groupBy(items, i => i.cat);
    expect(groups.get("A")?.length).toBe(2);
    expect(groups.get("B")?.length).toBe(1);
  });
  it("handles empty array", () => {
    const groups = groupBy([], () => "x");
    expect(groups.size).toBe(0);
  });
});

// ======================================================================
// FEATURE 42: deduplicateBy
// ======================================================================
describe("F42: deduplicateBy", () => {
  it("removes duplicates keeping first", () => {
    const items = [{ id: "a", v: 1 }, { id: "b", v: 2 }, { id: "a", v: 3 }];
    const result = deduplicateBy(items, i => i.id);
    expect(result.length).toBe(2);
    expect(result[0].v).toBe(1);
  });
  it("handles empty", () => {
    expect(deduplicateBy([], () => "").length).toBe(0);
  });
});

// ======================================================================
// FEATURE 43: chunk
// ======================================================================
describe("F43: chunk", () => {
  it("splits array into chunks", () => {
    const result = chunk([1, 2, 3, 4, 5], 2);
    expect(result).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("single chunk for size > array", () => {
    const result = chunk([1, 2], 10);
    expect(result).toEqual([[1, 2]]);
  });
  it("handles empty array", () => {
    expect(chunk([], 5)).toEqual([]);
  });
  it("handles size <= 0", () => {
    const result = chunk([1, 2, 3], 0);
    expect(result.length).toBe(1);
  });
});

// ======================================================================
// FEATURE 44: findDuplicates
// ======================================================================
describe("F44: findDuplicates", () => {
  it("finds duplicates", () => {
    const items = [{ siren: "A" }, { siren: "B" }, { siren: "A" }, { siren: "A" }];
    const dups = findDuplicates(items, i => i.siren);
    expect(dups.length).toBe(1);
    expect(dups[0].count).toBe(3);
    expect(dups[0].key).toBe("A");
  });
  it("returns empty for no duplicates", () => {
    const items = [{ siren: "A" }, { siren: "B" }];
    expect(findDuplicates(items, i => i.siren).length).toBe(0);
  });
});

// ======================================================================
// FEATURE 45: generateSecureToken
// ======================================================================
describe("F45: generateSecureToken", () => {
  it("generates correct length", () => {
    const token = generateSecureToken(16);
    expect(token.length).toBe(32); // 16 bytes = 32 hex chars
  });
  it("generates unique tokens", () => {
    const t1 = generateSecureToken();
    const t2 = generateSecureToken();
    expect(t1).not.toBe(t2);
  });
  it("default is 64 hex chars", () => {
    expect(generateSecureToken().length).toBe(64);
  });
});

// ======================================================================
// FEATURE 46: sanitizeFilename
// ======================================================================
describe("F46: sanitizeFilename", () => {
  it("removes path traversal", () => {
    expect(sanitizeFilename("../../etc/passwd")).not.toContain("..");
  });
  it("removes special chars", () => {
    const result = sanitizeFilename("file<>:*?|name.pdf");
    expect(result).not.toMatch(/[<>:*?|]/);
  });
  it("replaces spaces", () => {
    expect(sanitizeFilename("my file name.pdf")).toBe("my_file_name.pdf");
  });
  it("handles empty", () => {
    expect(sanitizeFilename("")).toBe("document");
  });
  it("limits length", () => {
    const longName = "a".repeat(300) + ".pdf";
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(200);
  });
});

// ======================================================================
// FEATURE 47: rateLimitKey
// ======================================================================
describe("F47: rateLimitKey", () => {
  it("generates consistent key within same minute", () => {
    const k1 = rateLimitKey("login", "user@test.fr");
    const k2 = rateLimitKey("login", "user@test.fr");
    expect(k1).toBe(k2);
  });
  it("different actions give different keys", () => {
    const k1 = rateLimitKey("login", "user@test.fr");
    const k2 = rateLimitKey("search", "user@test.fr");
    expect(k1).not.toBe(k2);
  });
  it("starts with rl: prefix", () => {
    expect(rateLimitKey("x", "y")).toMatch(/^rl:/);
  });
});

// ======================================================================
// FEATURE 48: daysUntil (existing but extended tests)
// ======================================================================
describe("F48: daysUntil", () => {
  it("future date returns positive", () => {
    const d = new Date(); d.setDate(d.getDate() + 10);
    expect(daysUntil(d.toISOString())).toBeGreaterThanOrEqual(9);
  });
  it("past date returns negative", () => {
    expect(daysUntil("2020-01-01")).toBeLessThan(0);
  });
  it("invalid date returns -9999", () => {
    expect(daysUntil("invalid")).toBe(-9999);
  });
});

// ======================================================================
// FEATURE 49: timeAgo (existing but extended tests)
// ======================================================================
describe("F49: timeAgo", () => {
  it("recent = A l'instant", () => {
    expect(timeAgo(new Date().toISOString())).toBe("A l'instant");
  });
  it("handles invalid date", () => {
    expect(timeAgo("bad")).toBe("bad");
  });
  it("handles empty", () => {
    expect(timeAgo("")).toBe("");
  });
});

// ======================================================================
// FEATURE 50: Integration — complete workflow validation
// ======================================================================
describe("F50: Integration — full client risk assessment workflow", () => {
  it("complete workflow: create client → validate → score → assess", async () => {
    // Step 1: Validate client data
    const clientData = {
      raisonSociale: "ACME SAS", forme: "SAS", siren: "732 829 320",
      adresse: "10 RUE DE LA PAIX", cp: "75001", ville: "PARIS",
      dirigeant: "DUPONT JEAN",
    };
    const { clientSchema } = await import("../lib/validation");
    const zodResult = clientSchema.safeParse(clientData);
    expect(zodResult.success).toBe(true);

    // Step 2: Validate dates
    const dateResult = validateClientDates({ dateCreation: "2020-01-01", dateExpCni: "2030-01-01" });
    expect(dateResult.valid).toBe(true);

    // Step 3: Check phone
    const phoneResult = validatePhoneType("06 12 34 56 78");
    expect(phoneResult.valid).toBe(true);

    // Step 4: Check for disposable email
    expect(isDisposableEmail("contact@acme-sas.fr")).toBe(false);

    // Step 5: Score risk
    const { calculateRiskScore } = await import("../lib/riskEngine");
    const risk = calculateRiskScore({
      ape: "62.20Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: "2020-01-01", dateReprise: "", effectif: "5",
      forme: "SAS", ppe: false, atypique: false, distanciel: false,
      cash: false, pression: false,
    });
    expect(risk.nivVigilance).toBeDefined();

    // Step 6: Check completeness
    const client = makeClient({
      raisonSociale: "ACME SAS", forme: "SAS", siren: "732829320",
      scoreGlobal: risk.scoreGlobal, nivVigilance: risk.nivVigilance,
    });
    const completeness = calculateClientCompleteness(client);
    expect(completeness.percentage).toBeGreaterThan(0);

    // Step 7: Check shell company signals
    const signals = detectShellCompanySignals(client);
    expect(Array.isArray(signals)).toBe(true);

    // Step 8: Classify mission risk
    const missionRisk = classifyMissionRisk(client.mission);
    expect(missionRisk).toBe("faible");

    // Step 9: Generate compliance ref
    const ref = generateComplianceRef("REV", 1);
    expect(ref).toMatch(/^REV-\d{4}-0001$/);

    // Step 10: Format for display
    const formatted = formatEuro(client.honoraires ?? 0);
    expect(formatted).toContain("€");
  });
});
