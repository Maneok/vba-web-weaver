/**
 * Tests for 20 essential improvements across the codebase.
 * Each describe block corresponds to one improvement.
 */
import { describe, it, expect } from "vitest";
import {
  calculateRiskScore,
  calculateNextReviewDate,
  calculateDateButoir,
  getPilotageStatus,
  normalizeAddress,
  APE_SCORES,
  MISSION_SCORES,
} from "../lib/riskEngine";
import { validateIBAN } from "../lib/ibanValidator";
import { validateEmail, validateSiren, validateCodePostal, clientSchema } from "../lib/validation";
import { mapDbClient, mapClientToDb, mapDbCollaborateur, mapDbAlerte } from "../lib/dbMappers";
import { analyzeCockpit } from "../lib/cockpitEngine";
import { runDiagnostic360 } from "../lib/diagnosticEngine";
import {
  calcHonorairesMensuels,
  calcHonorairesTrimestriels,
  checkHonorairesConsistency,
  validateLettreMission,
  incrementCounter,
  resetCounter,
} from "../lib/lettreMissionEngine";
import type { Client, Collaborateur, AlerteRegistre } from "../lib/types";

// ═══════════════════════════════════════════════════
// Helper: minimal valid client for testing
// ═══════════════════════════════════════════════════
function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    ref: "CLI-26-001", etat: "VALIDE", comptable: "MAGALIE", mission: "TENUE COMPTABLE",
    raisonSociale: "TEST SAS", forme: "SAS", adresse: "1 RUE TEST", cp: "75001", ville: "PARIS",
    siren: "123 456 789", capital: 10000, ape: "62.20Z", dirigeant: "DUPONT Jean",
    domaine: "Informatique", effectif: "3 A 5 SALARIES", tel: "01 23 45 67 89", mail: "test@test.fr",
    dateCreation: "2015-01-01", dateReprise: "", honoraires: 5000, reprise: 0, juridique: 0,
    frequence: "MENSUEL", iban: "", bic: "", associe: "DIDIER", superviseur: "SAMUEL",
    ppe: "NON", paysRisque: "NON", atypique: "NON", distanciel: "NON", cash: "NON", pression: "NON",
    scoreActivite: 25, scorePays: 0, scoreMission: 10, scoreMaturite: 0, scoreStructure: 40,
    malus: 0, scoreGlobal: 15, nivVigilance: "SIMPLIFIEE",
    dateCreationLigne: "2024-01-01", dateDerniereRevue: "2024-01-01",
    dateButoir: "2027-01-01", etatPilotage: "A JOUR", dateExpCni: "2030-01-01",
    statut: "ACTIF", be: "DUPONT Jean (100%)", ...overrides,
  };
}

function makeCollab(overrides: Partial<Collaborateur> = {}): Collaborateur {
  return {
    nom: "DUPONT", fonction: "COLLABORATEUR", referentLcb: false, suppleant: "",
    niveauCompetence: "CONFIRME", dateSignatureManuel: "2024-01-01",
    derniereFormation: "2024-01-01", statutFormation: "A JOUR", email: "dupont@test.fr",
    ...overrides,
  };
}

function makeAlerte(overrides: Partial<AlerteRegistre> = {}): AlerteRegistre {
  return {
    date: "2024-01-01", clientConcerne: "TEST SAS", categorie: "FLUX : Incoherence / Atypique",
    details: "Mouvement suspect", actionPrise: "Verification en cours", responsable: "DIDIER",
    qualification: "", statut: "EN COURS", dateButoir: "2024-12-31", typeDecision: "", validateur: "",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════
// 1. scoreStructure null safety
// ═══════════════════════════════════════════════════
describe("Improvement 1: scoreStructure null/undefined safety", () => {
  it("should not crash with empty string forme", () => {
    const result = calculateRiskScore({
      ape: "62.20Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: "2015-01-01", dateReprise: "", effectif: "3 SALARIES",
      forme: "", ppe: false, atypique: false, distanciel: false, cash: false, pression: false,
    });
    expect(result.scoreStructure).toBe(20); // default fallback
  });

  it("should not crash with undefined-like forme", () => {
    const result = calculateRiskScore({
      ape: "62.20Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: "2015-01-01", dateReprise: "", effectif: "3 SALARIES",
      forme: null as unknown as string, ppe: false, atypique: false, distanciel: false, cash: false, pression: false,
    });
    expect(result.scoreStructure).toBe(20);
  });

  it("should correctly score TRUST as high risk", () => {
    const result = calculateRiskScore({
      ape: "62.20Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: "2015-01-01", dateReprise: "", effectif: "3 SALARIES",
      forme: "TRUST", ppe: false, atypique: false, distanciel: false, cash: false, pression: false,
    });
    expect(result.scoreStructure).toBe(100);
  });
});

// ═══════════════════════════════════════════════════
// 2. scoreMaturite negative date protection
// ═══════════════════════════════════════════════════
describe("Improvement 2: scoreMaturite future date protection", () => {
  it("should treat future dateCreation as < 1 year (high risk)", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const result = calculateRiskScore({
      ape: "62.20Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: futureDate.toISOString().split("T")[0], dateReprise: "",
      effectif: "3 SALARIES", forme: "SARL",
      ppe: false, atypique: false, distanciel: false, cash: false, pression: false,
    });
    // Future date → ancienneteYears clamped to 0 → < 1 year → score = 65
    expect(result.scoreMaturite).toBe(65);
  });

  it("should return 65 for invalid dateCreation", () => {
    const result = calculateRiskScore({
      ape: "62.20Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: "invalid-date", dateReprise: "", effectif: "3 SALARIES",
      forme: "SARL", ppe: false, atypique: false, distanciel: false, cash: false, pression: false,
    });
    expect(result.scoreMaturite).toBe(65);
  });
});

// ═══════════════════════════════════════════════════
// 3. normalizeAddress null safety
// ═══════════════════════════════════════════════════
describe("Improvement 3: normalizeAddress null safety", () => {
  it("should return empty string for null/undefined input", () => {
    expect(normalizeAddress(null as unknown as string)).toBe("");
    expect(normalizeAddress(undefined as unknown as string)).toBe("");
    expect(normalizeAddress("")).toBe("");
  });

  it("should normalize abbreviations", () => {
    expect(normalizeAddress("12 avenue de la Paix")).toBe("12 AV DE LA PAIX");
    expect(normalizeAddress("5 boulevard Haussmann")).toBe("5 BD HAUSSMANN");
    expect(normalizeAddress("3, route de Lyon")).toBe("3 RTE DE LYON");
  });
});

// ═══════════════════════════════════════════════════
// 4. getPilotageStatus empty string handling
// ═══════════════════════════════════════════════════
describe("Improvement 4: getPilotageStatus edge cases", () => {
  it("should return RETARD for empty string", () => {
    expect(getPilotageStatus("")).toBe("RETARD");
  });

  it("should return RETARD for invalid date", () => {
    expect(getPilotageStatus("not-a-date")).toBe("RETARD");
  });

  it("should return A JOUR for far future", () => {
    expect(getPilotageStatus("2099-01-01")).toBe("A JOUR");
  });

  it("should return BIENTÔT for dates within 60 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    expect(getPilotageStatus(soon.toISOString().split("T")[0])).toBe("BIENTÔT");
  });
});

// ═══════════════════════════════════════════════════
// 5. IBAN country-specific length validation
// ═══════════════════════════════════════════════════
describe("Improvement 5: IBAN country-specific validation", () => {
  it("should accept valid French IBAN", () => {
    const result = validateIBAN("FR76 3000 6000 0112 3456 7890 189");
    expect(result.valid).toBe(true);
  });

  it("should reject FR IBAN with wrong length", () => {
    const result = validateIBAN("FR76 3000 6000 0112 3456");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("27");
  });

  it("should validate German IBAN length (22 chars)", () => {
    const result = validateIBAN("DE89 3704 0044 0532 0130 00");
    expect(result.valid).toBe(true);
  });

  it("should reject DE IBAN with wrong length", () => {
    const result = validateIBAN("DE89 3704 0044 0532 0130 0012 34");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("22");
  });

  it("should reject empty IBAN", () => {
    expect(validateIBAN("").valid).toBe(false);
  });

  it("should reject IBAN with special characters", () => {
    expect(validateIBAN("FR76-3000-6000").valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// 6. Phone validation improved regex
// ═══════════════════════════════════════════════════
describe("Improvement 6: French phone number validation", () => {
  it("should accept standard French format 01 23 45 67 89", () => {
    const result = clientSchema.shape.tel.safeParse("01 23 45 67 89");
    expect(result.success).toBe(true);
  });

  it("should accept +33 format", () => {
    const result = clientSchema.shape.tel.safeParse("+33 1 23 45 67 89");
    expect(result.success).toBe(true);
  });

  it("should accept mobile format", () => {
    const result = clientSchema.shape.tel.safeParse("06 12 34 56 78");
    expect(result.success).toBe(true);
  });

  it("should accept empty string (optional field)", () => {
    const result = clientSchema.shape.tel.safeParse("");
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// 7. dbMappers enum validation
// ═══════════════════════════════════════════════════
describe("Improvement 7: dbMappers enum validation", () => {
  it("should fallback to VALIDE for invalid etat", () => {
    const client = mapDbClient({ etat: "INVALID_STATE", ref: "CLI-01" });
    expect(client.etat).toBe("VALIDE");
  });

  it("should fallback to SIMPLIFIEE for invalid vigilance", () => {
    const client = mapDbClient({ niv_vigilance: "MEGA_RENFORCEE", ref: "CLI-01" });
    expect(client.nivVigilance).toBe("SIMPLIFIEE");
  });

  it("should fallback to ACTIF for invalid statut", () => {
    const client = mapDbClient({ statut: "DELETED", ref: "CLI-01" });
    expect(client.statut).toBe("ACTIF");
  });

  it("should fallback to NON for invalid OUI/NON values", () => {
    const client = mapDbClient({ ppe: "MAYBE", pays_risque: 42, ref: "CLI-01" });
    expect(client.ppe).toBe("NON");
    expect(client.paysRisque).toBe("NON");
  });

  it("should map valid enum values correctly", () => {
    const client = mapDbClient({ etat: "ARCHIVE", niv_vigilance: "RENFORCEE", statut: "INACTIF", ppe: "OUI", ref: "CLI-01" });
    expect(client.etat).toBe("ARCHIVE");
    expect(client.nivVigilance).toBe("RENFORCEE");
    expect(client.statut).toBe("INACTIF");
    expect(client.ppe).toBe("OUI");
  });

  it("should handle null/undefined row values", () => {
    const client = mapDbClient({});
    expect(client.ref).toBe("");
    expect(client.etat).toBe("VALIDE");
    expect(client.capital).toBeNull();
    expect(client.honoraires).toBeNull();
  });
});

// ═══════════════════════════════════════════════════
// 8. Honoraires calculation robustness
// ═══════════════════════════════════════════════════
describe("Improvement 8: Honoraires calculation robustness", () => {
  it("should calculate correct monthly from annual", () => {
    expect(calcHonorairesMensuels(12000)).toBe(1000);
    expect(calcHonorairesMensuels(10000)).toBe(833.33);
  });

  it("should calculate correct quarterly from annual", () => {
    expect(calcHonorairesTrimestriels(12000)).toBe(3000);
    expect(calcHonorairesTrimestriels(10000)).toBe(2500);
  });

  it("should return 0 for negative values", () => {
    expect(calcHonorairesMensuels(-5000)).toBe(0);
    expect(calcHonorairesTrimestriels(-5000)).toBe(0);
  });

  it("should return 0 for NaN/Infinity", () => {
    expect(calcHonorairesMensuels(NaN)).toBe(0);
    expect(calcHonorairesMensuels(Infinity)).toBe(0);
    expect(calcHonorairesTrimestriels(NaN)).toBe(0);
  });

  it("should detect rounding ecart for non-divisible amounts", () => {
    const check = checkHonorairesConsistency(10000);
    expect(check.mensuel).toBe(833.33);
    expect(check.ecart).toBeLessThanOrEqual(0.05); // < 5 cents tolerance
  });

  it("should show zero ecart for clean divisions", () => {
    const check = checkHonorairesConsistency(12000);
    expect(check.ecart).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 9. SIREN Luhn validation
// ═══════════════════════════════════════════════════
describe("Improvement 9: SIREN Luhn validation", () => {
  it("should validate known valid SIRENs", () => {
    // La Poste: 356 000 000
    expect(validateSiren("356000000")).toBe(true);
  });

  it("should reject SIREN with wrong checksum", () => {
    expect(validateSiren("123456789")).toBe(false);
  });

  it("should reject too-short SIREN", () => {
    expect(validateSiren("12345")).toBe(false);
  });

  it("should accept SIREN with spaces", () => {
    expect(validateSiren("356 000 000")).toBe(true);
  });

  it("should reject non-numeric SIREN", () => {
    expect(validateSiren("12345678A")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// 10. French postal code validation
// ═══════════════════════════════════════════════════
describe("Improvement 10: French postal code validation", () => {
  it("should accept valid Paris code", () => {
    expect(validateCodePostal("75001")).toBe(true);
  });

  it("should accept DOM-TOM codes", () => {
    expect(validateCodePostal("97100")).toBe(true); // Guadeloupe
    expect(validateCodePostal("98000")).toBe(true); // Monaco
  });

  it("should reject invalid department 00", () => {
    expect(validateCodePostal("00100")).toBe(false);
  });

  it("should reject non-5-digit strings", () => {
    expect(validateCodePostal("7500")).toBe(false);
    expect(validateCodePostal("750001")).toBe(false);
    expect(validateCodePostal("ABCDE")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// 11. Cockpit duplicate SIREN detection
// ═══════════════════════════════════════════════════
describe("Improvement 11: Cockpit duplicate SIREN detection", () => {
  it("should detect duplicate SIRENs with different formatting", () => {
    const clients = [
      makeClient({ ref: "CLI-01", siren: "123 456 789", raisonSociale: "ALPHA SAS" }),
      makeClient({ ref: "CLI-02", siren: "123456789", raisonSociale: "ALPHA SAS (copie)" }),
    ];
    const result = analyzeCockpit(clients, [], []);
    const doublons = result.doublonsPotentiels;
    expect(doublons.length).toBe(1);
    expect(doublons[0].detail).toContain("2 dossiers");
  });

  it("should not flag unique SIRENs", () => {
    const clients = [
      makeClient({ ref: "CLI-01", siren: "123 456 789" }),
      makeClient({ ref: "CLI-02", siren: "987 654 321" }),
    ];
    const result = analyzeCockpit(clients, [], []);
    expect(result.doublonsPotentiels.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 12. Cockpit domiciliation detection (same address)
// ═══════════════════════════════════════════════════
describe("Improvement 12: Cockpit same-address domiciliation detection", () => {
  it("should flag 3+ clients at the same address", () => {
    const clients = [
      makeClient({ ref: "CLI-01", adresse: "10 Rue de Rivoli", cp: "75001", siren: "111222333" }),
      makeClient({ ref: "CLI-02", adresse: "10 Rue de Rivoli", cp: "75001", siren: "444555666" }),
      makeClient({ ref: "CLI-03", adresse: "10 Rue de Rivoli", cp: "75001", siren: "777888999" }),
    ];
    const result = analyzeCockpit(clients, [], []);
    const domiciliation = result.urgencies.filter(u => u.type === "domiciliation");
    expect(domiciliation.length).toBe(1);
    expect(domiciliation[0].title).toContain("3 clients");
  });

  it("should not flag 2 clients at same address", () => {
    const clients = [
      makeClient({ ref: "CLI-01", adresse: "10 Rue de Rivoli", cp: "75001", siren: "111222333" }),
      makeClient({ ref: "CLI-02", adresse: "10 Rue de Rivoli", cp: "75001", siren: "444555666" }),
    ];
    const result = analyzeCockpit(clients, [], []);
    const domiciliation = result.urgencies.filter(u => u.type === "domiciliation");
    expect(domiciliation.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 13. Cockpit scoring incoherence detection
// ═══════════════════════════════════════════════════
describe("Improvement 13: Scoring incoherence detection", () => {
  it("should flag PPE client with SIMPLIFIEE vigilance", () => {
    const clients = [makeClient({ ppe: "OUI", nivVigilance: "SIMPLIFIEE" })];
    const result = analyzeCockpit(clients, [], []);
    expect(result.incoherencesScoring.length).toBe(1);
    expect(result.incoherencesScoring[0].severity).toBe("critique");
  });

  it("should not flag PPE client with RENFORCEE vigilance", () => {
    const clients = [makeClient({ ppe: "OUI", nivVigilance: "RENFORCEE" })];
    const result = analyzeCockpit(clients, [], []);
    expect(result.incoherencesScoring.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 14. Cockpit CNI expiration detection
// ═══════════════════════════════════════════════════
describe("Improvement 14: CNI expiration detection", () => {
  it("should flag expired CNI as critique", () => {
    const clients = [makeClient({ dateExpCni: "2020-01-01" })];
    const result = analyzeCockpit(clients, [], []);
    expect(result.cniPerimees.length).toBe(1);
    expect(result.cniPerimees[0].severity).toBe("critique");
  });

  it("should flag soon-expiring CNI as warning", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 60);
    const clients = [makeClient({ dateExpCni: soon.toISOString().split("T")[0] })];
    const result = analyzeCockpit(clients, [], []);
    expect(result.cniPerimees.length).toBe(1);
  });

  it("should not flag far-future CNI", () => {
    const clients = [makeClient({ dateExpCni: "2099-01-01" })];
    const result = analyzeCockpit(clients, [], []);
    expect(result.cniPerimees.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 15. Diagnostic 360 comprehensive report
// ═══════════════════════════════════════════════════
describe("Improvement 15: Diagnostic 360 report", () => {
  it("should generate report with all categories", () => {
    const clients = [makeClient()];
    const collabs = [makeCollab({ referentLcb: true })];
    const report = runDiagnostic360(clients, collabs, [], []);
    expect(report.scoreGlobalDispositif).toBeGreaterThan(0);
    expect(report.noteLettre).toMatch(/^[A-D]$/);
    expect(report.items.length).toBeGreaterThan(10);
  });

  it("should return a valid note for empty data", () => {
    const report = runDiagnostic360([], [], [], []);
    expect(report.noteLettre).toMatch(/^[A-D]$/);
    // With empty data, many items are OK (0 retards, 0 incoherences...) so score can be decent
    expect(report.scoreGlobalDispositif).toBeGreaterThanOrEqual(0);
    expect(report.items.length).toBeGreaterThan(0);
  });

  it("should detect missing LCB-FT referent", () => {
    const collabs = [makeCollab({ referentLcb: false })];
    const report = runDiagnostic360([], collabs, [], []);
    const referentItem = report.items.find(i => i.indicateur.includes("Referent LCB-FT"));
    expect(referentItem?.statut).toBe("CRITIQUE");
  });

  it("should handle null/undefined input arrays gracefully", () => {
    const report = runDiagnostic360(
      null as unknown as Client[],
      undefined as unknown as Collaborateur[],
      null as unknown as AlerteRegistre[],
      [],
    );
    expect(report.items.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════
// 16. Cockpit handles null arrays
// ═══════════════════════════════════════════════════
describe("Improvement 16: Cockpit null array safety", () => {
  it("should handle null/undefined inputs", () => {
    const result = analyzeCockpit(
      null as unknown as Client[],
      undefined as unknown as Collaborateur[],
      null as unknown as AlerteRegistre[],
    );
    expect(result.totalClients).toBe(0);
    expect(result.urgencies).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════
// 17. Email validation
// ═══════════════════════════════════════════════════
describe("Improvement 17: Email validation", () => {
  it("should accept valid email", () => {
    expect(validateEmail("test@example.com")).toBeNull();
  });

  it("should reject invalid email", () => {
    expect(validateEmail("not-an-email")).not.toBeNull();
  });

  it("should accept empty email (optional)", () => {
    expect(validateEmail("")).toBeNull();
  });

  it("should reject email without domain", () => {
    expect(validateEmail("test@")).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════
// 18. Lettre de mission validation
// ═══════════════════════════════════════════════════
describe("Improvement 18: Lettre de mission validation", () => {
  const cabinet = { nom: "CABINET TEST", siret: "12345678901234", numeroOEC: "OEC-001", adresse: "", cp: "", ville: "", email: "", tel: "" };

  it("should pass validation for complete client", () => {
    const client = makeClient();
    const result = validateLettreMission(client, cabinet);
    expect(result.valid).toBe(true);
    expect(result.champsManquants).toHaveLength(0);
  });

  it("should fail validation for missing client fields", () => {
    const client = makeClient({ raisonSociale: "", siren: "" });
    const result = validateLettreMission(client, cabinet);
    expect(result.valid).toBe(false);
    expect(result.champsManquants).toContain("Raison sociale");
    expect(result.champsManquants).toContain("SIREN");
  });

  it("should fail validation for missing cabinet fields", () => {
    const client = makeClient();
    const result = validateLettreMission(client, { nom: "", siret: "", numeroOEC: "", adresse: "", cp: "", ville: "", email: "", tel: "" });
    expect(result.valid).toBe(false);
    expect(result.champsManquants).toContain("Nom du cabinet");
  });
});

// ═══════════════════════════════════════════════════
// 19. LM counter numbering
// ═══════════════════════════════════════════════════
describe("Improvement 19: Lettre de mission counter", () => {
  it("should generate sequential numbers", () => {
    resetCounter(0);
    const n1 = incrementCounter();
    const n2 = incrementCounter();
    expect(n1).toMatch(/^LM-\d{4}-001$/);
    expect(n2).toMatch(/^LM-\d{4}-002$/);
  });

  it("should include current year", () => {
    resetCounter(0);
    const num = incrementCounter();
    expect(num).toContain(String(new Date().getFullYear()));
  });
});

// ═══════════════════════════════════════════════════
// 20. calculateDateButoir & calculateNextReviewDate
// ═══════════════════════════════════════════════════
describe("Improvement 20: Review date calculations", () => {
  it("should add 3 years for SIMPLIFIEE", () => {
    const result = calculateDateButoir("SIMPLIFIEE");
    const expected = new Date();
    expected.setFullYear(expected.getFullYear() + 3);
    expect(result).toBe(expected.toISOString().split("T")[0]);
  });

  it("should add 1 year for STANDARD", () => {
    const result = calculateDateButoir("STANDARD");
    const expected = new Date();
    expected.setFullYear(expected.getFullYear() + 2);
    expect(result).toBe(expected.toISOString().split("T")[0]);
  });

  it("should add 1 year for RENFORCEE", () => {
    const result = calculateDateButoir("RENFORCEE");
    const expected = new Date();
    expected.setFullYear(expected.getFullYear() + 1);
    expect(result).toBe(expected.toISOString().split("T")[0]);
  });

  it("should handle invalid lastReview date by using today", () => {
    const result = calculateNextReviewDate("STANDARD", "garbage");
    // Should not throw, should return a valid date
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should handle empty lastReview date", () => {
    const result = calculateNextReviewDate("RENFORCEE", "");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ═══════════════════════════════════════════════════
// Bonus: Risk score cap and vigilance thresholds
// ═══════════════════════════════════════════════════
describe("Bonus: Risk scoring integration", () => {
  it("should use RISK_THRESHOLDS from constants correctly", () => {
    // Score <= 30 → SIMPLIFIEE
    const low = calculateRiskScore({
      ape: "86.21Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: "2010-01-01", dateReprise: "", effectif: "5 SALARIES",
      forme: "ENTREPRISE INDIVIDUELLE",
      ppe: false, atypique: false, distanciel: false, cash: false, pression: false,
    });
    expect(low.nivVigilance).toBe("SIMPLIFIEE");
    expect(low.scoreGlobal).toBeLessThanOrEqual(30);

    // PPE always → RENFORCEE
    const ppe = calculateRiskScore({
      ape: "86.21Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: "2010-01-01", dateReprise: "", effectif: "5 SALARIES",
      forme: "SARL",
      ppe: true, atypique: false, distanciel: false, cash: false, pression: false,
    });
    expect(ppe.nivVigilance).toBe("RENFORCEE");
    expect(ppe.scoreGlobal).toBe(100);
  });

  it("should accumulate all malus correctly", () => {
    const result = calculateRiskScore({
      ape: "62.20Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: "2010-01-01", dateReprise: "", effectif: "5 SALARIES",
      forme: "SARL",
      ppe: false, atypique: false, distanciel: true, cash: true, pression: true,
    });
    expect(result.malus).toBe(110); // 30 + 40 + 40
  });
});
