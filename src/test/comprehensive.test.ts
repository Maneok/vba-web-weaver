import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateRiskScore,
  calculateNextReviewDate,
  getPilotageStatus,
  normalizeAddress,
  calculateDateButoir,
  APE_SCORES,
  MISSION_SCORES,
  APE_CASH,
  PAYS_RISQUE,
  MISSION_FREQUENCE,
} from "../lib/riskEngine";
import { validateIBAN } from "../lib/ibanValidator";
import {
  clientSchema,
  collaborateurSchema,
  alerteSchema,
  validateEmail,
  validateSiren,
  validateCodePostal,
} from "../lib/validation";
import { analyzeCockpit } from "../lib/cockpitEngine";
import { runDiagnostic360 } from "../lib/diagnosticEngine";
import { mapDbClient, mapClientToDb, mapDbCollaborateur, mapDbAlerte, mapDbLog } from "../lib/dbMappers";
import type { Client, Collaborateur, AlerteRegistre } from "../lib/types";
import { RISK_THRESHOLDS, FORMES_JURIDIQUES, MISSIONS, FREQUENCES } from "../lib/constants";

// ── Helpers ──
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

function makeCollab(overrides: Partial<Collaborateur> = {}): Collaborateur {
  return {
    nom: "DUPONT", fonction: "COLLABORATEUR", referentLcb: false,
    suppleant: "", niveauCompetence: "CONFIRME",
    dateSignatureManuel: "2024-01-01", derniereFormation: "2024-01-01",
    statutFormation: "A JOUR", email: "dupont@cabinet.fr",
    ...overrides,
  };
}

const baseRiskParams = {
  ape: "62.20Z", paysRisque: false, mission: "TENUE COMPTABLE",
  dateCreation: "2015-01-01", dateReprise: "", effectif: "5 SALARIES",
  forme: "SARL", ppe: false, atypique: false, distanciel: false,
  cash: false, pression: false,
};

// ============================================================
// 1-10: RISK ENGINE — calculateRiskScore
// ============================================================
describe("riskEngine — calculateRiskScore", () => {
  it("1. low-risk client returns correct sub-scores", () => {
    const r = calculateRiskScore(baseRiskParams);
    expect(r.scoreActivite).toBe(25);
    expect(r.scorePays).toBe(0);
    expect(r.scoreMission).toBe(25);
    expect(r.scoreStructure).toBe(20);
    expect(r.malus).toBe(0);
  });

  it("2. PPE forces score 100 and RENFORCEE", () => {
    const r = calculateRiskScore({ ...baseRiskParams, ppe: true });
    expect(r.scoreGlobal).toBe(100);
    expect(r.nivVigilance).toBe("RENFORCEE");
  });

  it("3. atypique adds configurable malus (default 15)", () => {
    const r = calculateRiskScore({ ...baseRiskParams, atypique: true });
    expect(r.malus).toBe(15);
    // avg=(25+0+25+0+20)/5=14, +15 malus=29 → STANDARD
    expect(r.scoreGlobal).toBe(29);
    expect(r.nivVigilance).toBe("STANDARD");
  });

  it("4. paysRisque=true gives scorePays=100", () => {
    const r = calculateRiskScore({ ...baseRiskParams, paysRisque: true });
    expect(r.scorePays).toBe(100);
    expect(r.nivVigilance).toBe("RENFORCEE");
  });

  it("5. all malus flags sum correctly", () => {
    const r = calculateRiskScore({ ...baseRiskParams, cash: true, distanciel: true, pression: true });
    expect(r.malus).toBe(110); // 40+30+40
  });

  it("6. score capped at 100", () => {
    const r = calculateRiskScore({ ...baseRiskParams, ape: "92.00Z", cash: true, pression: true, distanciel: true });
    expect(r.scoreGlobal).toBe(100);
  });

  it("7. unknown APE defaults to 25", () => {
    const r = calculateRiskScore({ ...baseRiskParams, ape: "99.99Z" });
    expect(r.scoreActivite).toBe(25);
  });

  it("8. DOMICILIATION mission scores 80", () => {
    const r = calculateRiskScore({ ...baseRiskParams, mission: "DOMICILIATION" });
    expect(r.scoreMission).toBe(80);
  });

  it("9. future dateCreation gives scoreMaturite=65", () => {
    const r = calculateRiskScore({ ...baseRiskParams, dateCreation: "2099-01-01" });
    expect(r.scoreMaturite).toBe(65);
  });

  it("10. empty dateCreation gives scoreMaturite=65", () => {
    const r = calculateRiskScore({ ...baseRiskParams, dateCreation: "" });
    expect(r.scoreMaturite).toBe(65);
  });
});

// ============================================================
// 11-15: RISK ENGINE — scoreStructure
// ============================================================
describe("riskEngine — scoreStructure", () => {
  it("11. SARL = 20", () => {
    expect(calculateRiskScore({ ...baseRiskParams, forme: "SARL" }).scoreStructure).toBe(20);
  });

  it("12. SCI = 35", () => {
    expect(calculateRiskScore({ ...baseRiskParams, forme: "SCI" }).scoreStructure).toBe(35);
  });

  it("13. TRUST = 100", () => {
    expect(calculateRiskScore({ ...baseRiskParams, forme: "TRUST" }).scoreStructure).toBe(100);
  });

  it("14. ENTREPRISE INDIVIDUELLE = 20", () => {
    expect(calculateRiskScore({ ...baseRiskParams, forme: "ENTREPRISE INDIVIDUELLE" }).scoreStructure).toBe(20);
  });

  it("15. unknown forme defaults to 20", () => {
    expect(calculateRiskScore({ ...baseRiskParams, forme: "COOPERATIVE" }).scoreStructure).toBe(20);
  });
});

// ============================================================
// 16-20: RISK ENGINE — vigilance thresholds
// ============================================================
describe("riskEngine — vigilance levels", () => {
  it("16. score <= 25 => SIMPLIFIEE", () => {
    const r = calculateRiskScore({ ...baseRiskParams, ape: "86.21Z", forme: "ENTREPRISE INDIVIDUELLE" });
    expect(r.scoreGlobal).toBeLessThanOrEqual(RISK_THRESHOLDS.SIMPLIFIEE_MAX);
    expect(r.nivVigilance).toBe("SIMPLIFIEE");
  });

  it("17. score 26-60 => STANDARD", () => {
    const r = calculateRiskScore({ ...baseRiskParams, ape: "45.11Z", cash: true });
    expect(r.scoreGlobal).toBeGreaterThan(RISK_THRESHOLDS.SIMPLIFIEE_MAX);
    expect(r.scoreGlobal).toBeLessThanOrEqual(RISK_THRESHOLDS.STANDARD_MAX);
    expect(r.nivVigilance).toBe("STANDARD");
  });

  it("18. score >= 60 => RENFORCEE", () => {
    const r = calculateRiskScore({ ...baseRiskParams, ape: "92.00Z" });
    expect(r.nivVigilance).toBe("RENFORCEE");
  });

  it("19. PPE with malus still returns 100 (not above)", () => {
    const r = calculateRiskScore({ ...baseRiskParams, ppe: true, cash: true });
    expect(r.scoreGlobal).toBe(100);
    expect(r.malus).toBe(40);
  });

  it("20. maxCriterion >= 60 uses max + malus instead of avg", () => {
    const r = calculateRiskScore({ ...baseRiskParams, ape: "47.77Z", cash: true });
    expect(r.scoreActivite).toBe(80);
    expect(r.scoreGlobal).toBe(100); // 80 + 40 capped at 100
  });
});

// ============================================================
// 21-25: REVIEW DATES & PILOTAGE STATUS
// ============================================================
describe("riskEngine — review dates & pilotage", () => {
  it("21. SIMPLIFIEE adds 36 months (default)", () => {
    expect(calculateNextReviewDate("SIMPLIFIEE", "2024-01-15")).toBe("2027-01-15");
  });

  it("22. STANDARD adds 24 months (default)", () => {
    expect(calculateNextReviewDate("STANDARD", "2024-06-01")).toBe("2026-06-01");
  });

  it("23. RENFORCEE adds 12 months (default)", () => {
    expect(calculateNextReviewDate("RENFORCEE", "2024-01-01")).toBe("2025-01-01");
  });

  it("24. invalid date falls back to today", () => {
    const result = calculateNextReviewDate("STANDARD", "not-a-date");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("25. getPilotageStatus empty string => RETARD", () => {
    expect(getPilotageStatus("")).toBe("RETARD");
  });

  it("26. getPilotageStatus invalid date => RETARD", () => {
    expect(getPilotageStatus("bad-date")).toBe("RETARD");
  });

  it("27. getPilotageStatus past date => RETARD", () => {
    expect(getPilotageStatus("2020-01-01")).toBe("RETARD");
  });

  it("28. getPilotageStatus within 60 days => BIENTOT", () => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    expect(getPilotageStatus(d.toISOString().split("T")[0])).toBe("BIENTOT");
  });

  it("29. getPilotageStatus far future => A JOUR", () => {
    expect(getPilotageStatus("2099-01-01")).toBe("A JOUR");
  });
});

// ============================================================
// 30-32: ADDRESS NORMALIZATION
// ============================================================
describe("riskEngine — normalizeAddress", () => {
  it("30. normalizes AVENUE to AV", () => {
    expect(normalizeAddress("12 avenue des champs")).toBe("12 AV DES CHAMPS");
  });

  it("31. handles null/undefined gracefully", () => {
    expect(normalizeAddress(null as any)).toBe("");
    expect(normalizeAddress(undefined as any)).toBe("");
  });

  it("32. removes punctuation and extra spaces", () => {
    expect(normalizeAddress("10, RUE  du   LAC.")).toBe("10 RUE DU LAC");
  });
});

// ============================================================
// 33-35: calculateDateButoir
// ============================================================
describe("riskEngine — calculateDateButoir", () => {
  it("33. SIMPLIFIEE => +36 months (default)", () => {
    const result = calculateDateButoir("SIMPLIFIEE");
    const expected = new Date(); expected.setMonth(expected.getMonth() + 36);
    expect(result).toBe(expected.toISOString().split("T")[0]);
  });

  it("34. STANDARD => +24 months (default)", () => {
    const result = calculateDateButoir("STANDARD");
    const expected = new Date(); expected.setMonth(expected.getMonth() + 24);
    expect(result).toBe(expected.toISOString().split("T")[0]);
  });

  it("35. RENFORCEE => +12 months (default)", () => {
    const result = calculateDateButoir("RENFORCEE");
    const expected = new Date(); expected.setMonth(expected.getMonth() + 12);
    expect(result).toBe(expected.toISOString().split("T")[0]);
  });
});

// ============================================================
// 36-45: IBAN VALIDATION
// ============================================================
describe("ibanValidator", () => {
  it("36. valid French IBAN accepted", () => {
    expect(validateIBAN("FR76 3000 6000 0112 3456 7890 189").valid).toBe(true);
  });

  it("37. valid German IBAN accepted", () => {
    expect(validateIBAN("DE89 3704 0044 0532 0130 00").valid).toBe(true);
  });

  it("38. empty IBAN rejected", () => {
    expect(validateIBAN("").valid).toBe(false);
  });

  it("39. null IBAN rejected", () => {
    expect(validateIBAN(null as any).valid).toBe(false);
  });

  it("40. special characters rejected", () => {
    expect(validateIBAN("FR76-3000-6000-0112").valid).toBe(false);
  });

  it("41. too short IBAN rejected", () => {
    expect(validateIBAN("FR76 3000").valid).toBe(false);
  });

  it("42. FR IBAN wrong length rejected with correct message", () => {
    const r = validateIBAN("FR76 3000 6000 0112 3456 78");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("27");
  });

  it("43. DE IBAN wrong length rejected", () => {
    const r = validateIBAN("DE89 3704 0044 0532 0130 001");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("22");
  });

  it("44. unknown country code rejected", () => {
    const r = validateIBAN("XX12 3456 7890 1234 5678 9012");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("inconnu");
  });

  it("45. BNP bank name returned for FR IBAN", () => {
    const r = validateIBAN("FR76 3000 6000 0112 3456 7890 189");
    expect(r.bankName).toBe("BNP Paribas");
  });
});

// ============================================================
// 46-55: VALIDATION (Zod schemas, SIREN, email, CP)
// ============================================================
describe("validation — schemas", () => {
  it("46. clientSchema accepts valid data", () => {
    const r = clientSchema.safeParse({
      raisonSociale: "TEST SARL", forme: "SARL", adresse: "1 RUE TEST",
      cp: "75001", ville: "PARIS", dirigeant: "DUPONT",
    });
    expect(r.success).toBe(true);
  });

  it("47. clientSchema rejects empty raisonSociale", () => {
    const r = clientSchema.safeParse({ raisonSociale: "", forme: "SARL", adresse: "X", cp: "75001", ville: "PARIS", dirigeant: "D" });
    expect(r.success).toBe(false);
  });

  it("48. clientSchema rejects invalid cp", () => {
    const r = clientSchema.safeParse({ raisonSociale: "T", forme: "S", adresse: "X", cp: "123", ville: "P", dirigeant: "D" });
    expect(r.success).toBe(false);
  });

  it("49. clientSchema accepts valid phone", () => {
    const r = clientSchema.safeParse({
      raisonSociale: "T", forme: "S", adresse: "X", cp: "75001", ville: "P", dirigeant: "D",
      tel: "01 23 45 67 89",
    });
    expect(r.success).toBe(true);
  });

  it("50. clientSchema accepts +33 phone format", () => {
    const r = clientSchema.safeParse({
      raisonSociale: "T", forme: "S", adresse: "X", cp: "75001", ville: "P", dirigeant: "D",
      tel: "+33 1 23 45 67 89",
    });
    expect(r.success).toBe(true);
  });

  it("51. collaborateurSchema accepts valid data", () => {
    const r = collaborateurSchema.safeParse({ nom: "DUPONT", fonction: "COLLABORATEUR", email: "d@cabinet.fr" });
    expect(r.success).toBe(true);
  });

  it("52. collaborateurSchema rejects invalid email", () => {
    const r = collaborateurSchema.safeParse({ nom: "D", fonction: "C", email: "not-email" });
    expect(r.success).toBe(false);
  });

  it("53. alerteSchema accepts valid data", () => {
    const r = alerteSchema.safeParse({ date: "2024-01-01", clientConcerne: "CLI-1", categorie: "ADMIN", details: "test", responsable: "D" });
    expect(r.success).toBe(true);
  });
});

describe("validation — functions", () => {
  it("54. validateEmail returns null for valid email", () => {
    expect(validateEmail("test@example.com")).toBe(null);
  });

  it("55. validateEmail returns null for empty (not required)", () => {
    expect(validateEmail("")).toBe(null);
  });

  it("56. validateEmail returns error for invalid", () => {
    expect(validateEmail("not-an-email")).not.toBe(null);
  });

  it("57. validateSiren valid with Luhn", () => {
    expect(validateSiren("732 829 320")).toBe(true);
  });

  it("58. validateSiren rejects non-9-digit", () => {
    expect(validateSiren("1234")).toBe(false);
  });

  it("59. validateCodePostal accepts 75001", () => {
    expect(validateCodePostal("75001")).toBe(true);
  });

  it("60. validateCodePostal accepts DOM-TOM 97400", () => {
    expect(validateCodePostal("97400")).toBe(true);
  });

  it("61. validateCodePostal rejects 00123", () => {
    expect(validateCodePostal("00123")).toBe(false);
  });

  it("62. validateCodePostal rejects non-5-digit", () => {
    expect(validateCodePostal("7500")).toBe(false);
  });
});

// ============================================================
// 63-72: DB MAPPERS
// ============================================================
describe("dbMappers", () => {
  it("63. mapDbClient maps snake_case to camelCase", () => {
    const c = mapDbClient({ raison_sociale: "ACME", forme: "SAS", etat: "VALIDE", cp: "75001" });
    expect(c.raisonSociale).toBe("ACME");
    expect(c.forme).toBe("SAS");
  });

  it("64. mapDbClient defaults etat to VALIDE for unknown", () => {
    const c = mapDbClient({ etat: "UNKNOWN_STATE" });
    expect(c.etat).toBe("VALIDE");
  });

  it("65. mapDbClient defaults nivVigilance to SIMPLIFIEE", () => {
    const c = mapDbClient({ niv_vigilance: null });
    expect(c.nivVigilance).toBe("SIMPLIFIEE");
  });

  it("66. mapDbClient handles null numeric fields", () => {
    const c = mapDbClient({ capital: null, honoraires: null });
    expect(c.capital).toBe(null);
    expect(c.honoraires).toBe(null);
  });

  it("67. mapDbClient handles OUI/NON enum for ppe", () => {
    const c1 = mapDbClient({ ppe: "OUI" });
    expect(c1.ppe).toBe("OUI");
    const c2 = mapDbClient({ ppe: "INVALID" });
    expect(c2.ppe).toBe("NON");
  });

  it("68. mapClientToDb maps camelCase to snake_case", () => {
    const row = mapClientToDb({ raisonSociale: "ACME", cp: "75001" });
    expect(row.raison_sociale).toBe("ACME");
    expect(row.cp).toBe("75001");
  });

  it("69. mapClientToDb strips SIREN spaces", () => {
    const row = mapClientToDb({ siren: "123 456 789" });
    expect(row.siren).toBe("123456789");
  });

  it("70. mapDbCollaborateur maps fields correctly", () => {
    const col = mapDbCollaborateur({ nom: "JEAN", referent_lcb: true, email: "j@t.fr" });
    expect(col.nom).toBe("JEAN");
    expect(col.referentLcb).toBe(true);
  });

  it("71. mapDbAlerte maps fields correctly", () => {
    const a = mapDbAlerte({ date: "2024-01-01", client_concerne: "CLI-1", categorie: "PPE" });
    expect(a.clientConcerne).toBe("CLI-1");
    expect(a.categorie).toBe("PPE");
  });

  it("72. mapDbLog converts timestamp format", () => {
    const l = mapDbLog({ created_at: "2024-01-01T10:30:00Z", user_email: "a@b.fr", action: "CREATION", new_data: {} });
    expect(l.horodatage).toBe("2024-01-01 10:30");
    expect(l.utilisateur).toBe("a@b.fr");
  });
});

// ============================================================
// 73-82: COCKPIT ENGINE
// ============================================================
describe("cockpitEngine", () => {
  it("73. empty arrays return zero urgencies", () => {
    const r = analyzeCockpit([], [], []);
    expect(r.totalClients).toBe(0);
    expect(r.urgencies.length).toBe(0);
  });

  it("74. detects revision en retard", () => {
    const c = makeClient({ dateButoir: "2020-01-01" });
    const r = analyzeCockpit([c], [], []);
    expect(r.revisionsRetard.length).toBe(1);
  });

  it("75. detects expired CNI", () => {
    const c = makeClient({ dateExpCni: "2020-01-01", dateButoir: "2099-01-01" });
    const r = analyzeCockpit([c], [], []);
    expect(r.cniPerimees.length).toBe(1);
    expect(r.cniPerimees[0].severity).toBe("critique");
  });

  it("76. detects scoring incoherence (SIMPLIFIEE + PPE)", () => {
    const c = makeClient({ nivVigilance: "SIMPLIFIEE", ppe: "OUI" });
    const r = analyzeCockpit([c], [], []);
    expect(r.incoherencesScoring.length).toBe(1);
  });

  it("77. detects fantome (no raisonSociale but has ref)", () => {
    const c = makeClient({ raisonSociale: "", ref: "CLI-99" });
    const r = analyzeCockpit([c], [], []);
    expect(r.lignesFantomes.length).toBe(1);
  });

  it("78. detects formation needed", () => {
    const col = makeCollab({ statutFormation: "JAMAIS FORME" });
    const r = analyzeCockpit([], [col], []);
    expect(r.formationsAFaire.length).toBe(1);
    expect(r.formationsAFaire[0].severity).toBe("critique");
  });

  it("79. detects alerte non traitee", () => {
    const alerte: AlerteRegistre = {
      date: "2024-01-01", clientConcerne: "CLI-1", categorie: "PPE",
      details: "test", actionPrise: "rien", responsable: "D",
      qualification: "", statut: "EN COURS", dateButoir: "2020-01-01",
      typeDecision: "", validateur: "",
    };
    const r = analyzeCockpit([], [], [alerte]);
    expect(r.alertesNonTraitees.length).toBe(1);
    expect(r.alertesNonTraitees[0].severity).toBe("critique");
  });

  it("80. detects KYC incomplet (missing SIREN)", () => {
    const c = makeClient({ siren: "" });
    const r = analyzeCockpit([c], [], []);
    expect(r.kycIncomplets.length).toBe(1);
  });

  it("81. detects domiciliation (3+ at same address)", () => {
    const clients = [
      makeClient({ ref: "C1", adresse: "10 RUE X", cp: "75001" }),
      makeClient({ ref: "C2", adresse: "10 RUE X", cp: "75001" }),
      makeClient({ ref: "C3", adresse: "10 RUE X", cp: "75001" }),
    ];
    const r = analyzeCockpit(clients, [], []);
    const dom = r.urgencies.filter(u => u.type === "domiciliation");
    expect(dom.length).toBe(1);
  });

  it("82. sorts urgencies by severity (critique first)", () => {
    const r = analyzeCockpit(
      [makeClient({ dateExpCni: "2020-01-01", dateButoir: "2099-01-01", honoraires: 5000 })],
      [makeCollab({ statutFormation: "A FORMER" })],
      [],
    );
    if (r.urgencies.length >= 2) {
      const critIdx = r.urgencies.findIndex(u => u.severity === "critique");
      const lastCritIdx = r.urgencies.filter(u => u.severity === "critique").length - 1;
      const firstNonCrit = r.urgencies.findIndex(u => u.severity !== "critique");
      if (critIdx >= 0 && firstNonCrit >= 0) {
        expect(critIdx).toBeLessThan(firstNonCrit);
      }
    }
  });
});

// ============================================================
// 83-90: DIAGNOSTIC ENGINE
// ============================================================
describe("diagnosticEngine", () => {
  it("83. empty portfolio returns valid report", () => {
    const r = runDiagnostic360([], [], [], []);
    expect(r.scoreGlobalDispositif).toBeGreaterThanOrEqual(0);
    expect(r.scoreGlobalDispositif).toBeLessThanOrEqual(100);
    expect(["A", "B", "C", "D"]).toContain(r.noteLettre);
  });

  it("84. detects SIREN duplicates", () => {
    const clients = [
      makeClient({ ref: "C1", siren: "123456789" }),
      makeClient({ ref: "C2", siren: "123456789" }),
    ];
    const r = runDiagnostic360(clients, [makeCollab({ referentLcb: true })], [], []);
    const item = r.items.find(i => i.indicateur.includes("Doublons SIREN"));
    expect(item).toBeDefined();
    expect(item!.statut).toBe("ALERTE");
  });

  it("85. detects no referent LCB as CRITIQUE", () => {
    const r = runDiagnostic360([makeClient()], [], [], []);
    const item = r.items.find(i => i.indicateur.includes("Referent LCB-FT"));
    expect(item).toBeDefined();
    expect(item!.statut).toBe("CRITIQUE");
  });

  it("86. referent LCB present => OK", () => {
    const r = runDiagnostic360([], [makeCollab({ referentLcb: true })], [], []);
    const item = r.items.find(i => i.indicateur.includes("Referent LCB-FT"));
    expect(item!.statut).toBe("OK");
  });

  it("87. detects scoring incoherence (SIMPLIFIEE + PPE)", () => {
    const c = makeClient({ nivVigilance: "SIMPLIFIEE", ppe: "OUI" });
    const r = runDiagnostic360([c], [makeCollab({ referentLcb: true })], [], []);
    const item = r.items.find(i => i.indicateur.includes("Coherence"));
    expect(item!.statut).toBe("CRITIQUE");
  });

  it("88. detects expired CNI", () => {
    const c = makeClient({ dateExpCni: "2020-01-01" });
    const r = runDiagnostic360([c], [makeCollab({ referentLcb: true })], [], []);
    const item = r.items.find(i => i.indicateur.includes("Pieces d'identite perimees"));
    expect(item!.statut).toBe("CRITIQUE");
  });

  it("89. high activity logs => OK tracabilite", () => {
    const logs = Array.from({ length: 15 }, (_, i) => ({
      horodatage: new Date().toISOString().replace("T", " ").slice(0, 16),
      utilisateur: "u@t.fr", refClient: "CLI-1",
      typeAction: ["CREATION", "MODIFICATION", "SCREENING", "SCORING_CALCUL", "REVUE_PERIODIQUE"][i % 5],
      details: "",
    }));
    const r = runDiagnostic360([], [makeCollab({ referentLcb: true })], [], logs);
    const item = r.items.find(i => i.indicateur.includes("journal"));
    expect(item!.statut).toBe("OK");
  });

  it("90. synthese contains note", () => {
    const r = runDiagnostic360([makeClient()], [makeCollab({ referentLcb: true })], [], []);
    expect(r.synthese).toContain(r.noteLettre);
  });
});

// ============================================================
// 91-95: LETTRE MISSION ENGINE
// ============================================================
describe("lettreMissionEngine", () => {
  it("91. calcHonorairesMensuels works for valid input", async () => {
    const { calcHonorairesMensuels } = await import("../lib/lettreMissionEngine");
    expect(calcHonorairesMensuels(12000)).toBe(1000);
  });

  it("92. calcHonorairesMensuels returns 0 for NaN", async () => {
    const { calcHonorairesMensuels } = await import("../lib/lettreMissionEngine");
    expect(calcHonorairesMensuels(NaN)).toBe(0);
  });

  it("93. calcHonorairesTrimestriels returns 0 for negative", async () => {
    const { calcHonorairesTrimestriels } = await import("../lib/lettreMissionEngine");
    expect(calcHonorairesTrimestriels(-500)).toBe(0);
  });

  it("94. checkHonorairesConsistency ecart is small", async () => {
    const { checkHonorairesConsistency } = await import("../lib/lettreMissionEngine");
    const r = checkHonorairesConsistency(12000);
    expect(r.ecart).toBeLessThan(1);
  });

  it("95. validateLettreMission rejects missing fields", async () => {
    const { validateLettreMission } = await import("../lib/lettreMissionEngine");
    const c = makeClient({ raisonSociale: "", siren: "" });
    const cab = { nom: "C", siret: "1", numeroOEC: "1", adresse: "", email: "", telephone: "", ics: "" };
    const r = validateLettreMission(c, cab);
    expect(r.valid).toBe(false);
    expect(r.champsManquants).toContain("Raison sociale");
    expect(r.champsManquants).toContain("SIREN");
  });
});

// ============================================================
// 96-100: CONSTANTS & REFERENCE DATA
// ============================================================
describe("constants & reference data", () => {
  it("96. APE_SCORES has 92.00Z as 100 (gambling)", () => {
    expect(APE_SCORES["92.00Z"]).toBe(100);
  });

  it("97. MISSION_SCORES has all defined missions", () => {
    for (const m of MISSIONS) {
      expect(MISSION_SCORES[m]).toBeDefined();
    }
  });

  it("98. APE_CASH list includes known cash-intensive codes", () => {
    expect(APE_CASH).toContain("56.10A");
    expect(APE_CASH).toContain("92.00Z");
  });

  it("99. PAYS_RISQUE includes sanctioned countries", () => {
    expect(PAYS_RISQUE).toContain("IRAN");
    expect(PAYS_RISQUE).toContain("COREE DU NORD");
    expect(PAYS_RISQUE).toContain("RUSSIE");
  });

  it("100. FORMES_JURIDIQUES includes all standard forms", () => {
    expect(FORMES_JURIDIQUES).toContain("SARL");
    expect(FORMES_JURIDIQUES).toContain("SAS");
    expect(FORMES_JURIDIQUES).toContain("TRUST");
    expect(FORMES_JURIDIQUES).toContain("SCI");
  });
});
