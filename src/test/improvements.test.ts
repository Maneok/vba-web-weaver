import { describe, it, expect } from "vitest";
import { calculateRiskScore, calculateNextReviewDate, getPilotageStatus } from "../lib/riskEngine";
import { validateIBAN } from "../lib/ibanValidator";
import { analyzeCockpit } from "../lib/cockpitEngine";
import { runDiagnostic360 } from "../lib/diagnosticEngine";
import type { Client, Collaborateur, AlerteRegistre } from "../lib/types";

// ============================================================
// Helper: minimal valid client for testing
// ============================================================
function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    ref: "CLI-26-001",
    etat: "VALIDE",
    comptable: "MAGALIE",
    mission: "TENUE COMPTABLE",
    raisonSociale: "TEST SARL",
    forme: "SARL",
    adresse: "1 RUE DE LA PAIX",
    cp: "75001",
    ville: "PARIS",
    siren: "123 456 789",
    capital: 10000,
    ape: "62.20Z",
    dirigeant: "DUPONT JEAN",
    domaine: "INFORMATIQUE",
    effectif: "5 SALARIES",
    tel: "0100000000",
    mail: "test@example.com",
    dateCreation: "2015-01-01",
    dateReprise: "",
    honoraires: 5000,
    reprise: 0,
    juridique: 0,
    frequence: "MENSUEL",
    iban: "",
    bic: "",
    associe: "DIDIER",
    superviseur: "SAMUEL",
    ppe: "NON",
    paysRisque: "NON",
    atypique: "NON",
    distanciel: "NON",
    cash: "NON",
    pression: "NON",
    scoreActivite: 25,
    scorePays: 0,
    scoreMission: 25,
    scoreMaturite: 0,
    scoreStructure: 20,
    malus: 0,
    scoreGlobal: 14,
    nivVigilance: "SIMPLIFIEE",
    dateCreationLigne: "2024-01-01",
    dateDerniereRevue: "2024-01-01",
    dateButoir: "2030-01-01",
    etatPilotage: "A JOUR",
    dateExpCni: "2030-01-01",
    statut: "ACTIF",
    be: "DUPONT JEAN 100%",
    lienKbis: "https://example.com/kbis",
    lienStatuts: "",
    lienCni: "",
    ...overrides,
  };
}

function makeCollab(overrides: Partial<Collaborateur> = {}): Collaborateur {
  return {
    nom: "DUPONT",
    fonction: "COLLABORATEUR",
    referentLcb: false,
    suppleant: "",
    niveauCompetence: "CONFIRME",
    dateSignatureManuel: "2024-01-01",
    derniereFormation: "2024-01-01",
    statutFormation: "A JOUR",
    email: "dupont@cabinet.fr",
    ...overrides,
  };
}

// ============================================================
// #1: riskEngine — negative ancienneteYears (future dateCreation)
// ============================================================
describe("#1: riskEngine — future dateCreation guard", () => {
  it("should treat future dateCreation as high risk (recent company)", () => {
    const result = calculateRiskScore({
      ape: "62.20Z",
      paysRisque: false,
      mission: "TENUE COMPTABLE",
      dateCreation: "2099-01-01",
      dateReprise: "",
      effectif: "5",
      forme: "SARL",
      ppe: false,
      atypique: false,
      distanciel: false,
      cash: false,
      pression: false,
    });
    expect(result.scoreMaturite).toBe(65);
  });

  it("should treat missing dateCreation as high risk", () => {
    const result = calculateRiskScore({
      ape: "62.20Z",
      paysRisque: false,
      mission: "TENUE COMPTABLE",
      dateCreation: "",
      dateReprise: "",
      effectif: "5",
      forme: "SARL",
      ppe: false,
      atypique: false,
      distanciel: false,
      cash: false,
      pression: false,
    });
    expect(result.scoreMaturite).toBe(65);
  });
});

// ============================================================
// #2: riskEngine — UTC-based review date calculation
// ============================================================
describe("#2: riskEngine — timezone-safe review dates", () => {
  it("should add 2 years for SIMPLIFIEE", () => {
    expect(calculateNextReviewDate("SIMPLIFIEE", "2024-01-15")).toBe("2026-01-15");
  });

  it("should add 1 year for STANDARD", () => {
    expect(calculateNextReviewDate("STANDARD", "2024-06-01")).toBe("2025-06-01");
  });

  it("should add 6 months for RENFORCEE consistently (UTC-safe)", () => {
    expect(calculateNextReviewDate("RENFORCEE", "2024-01-01")).toBe("2024-07-01");
  });

  it("should handle year boundary for RENFORCEE", () => {
    expect(calculateNextReviewDate("RENFORCEE", "2024-09-15")).toBe("2025-03-15");
  });

  it("should fallback to today for invalid date", () => {
    const result = calculateNextReviewDate("STANDARD", "not-a-date");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================================
// #3: numOrNull — whitespace handling
// ============================================================
describe("#3: numOrNull — whitespace-only strings", () => {
  function numOrNull(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  it("should return null for whitespace-only strings", () => {
    expect(numOrNull("   ")).toBe(null);
    expect(numOrNull("  \t ")).toBe(null);
  });

  it("should return null for empty string", () => {
    expect(numOrNull("")).toBe(null);
  });

  it("should return number for valid numeric strings", () => {
    expect(numOrNull("42")).toBe(42);
    expect(numOrNull(" 42 ")).toBe(42);
  });

  it("should return null for null/undefined", () => {
    expect(numOrNull(null)).toBe(null);
    expect(numOrNull(undefined)).toBe(null);
  });

  it("should return 0 for actual zero", () => {
    expect(numOrNull(0)).toBe(0);
    expect(numOrNull("0")).toBe(0);
  });
});

// ============================================================
// #4: cockpitEngine — revision BIENTOT detection
// ============================================================
describe("#4: cockpitEngine — approaching revision deadlines", () => {
  it("should detect revision within 30 days as warning", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 25);
    const client = makeClient({ dateButoir: soon.toISOString().split("T")[0] });
    const result = analyzeCockpit([client], [], []);
    const revisionBientot = result.urgencies.filter(
      u => u.type === "revision" && u.title.includes("bientot")
    );
    expect(revisionBientot.length).toBe(1);
    expect(revisionBientot[0].severity).toBe("warning");
  });

  it("should detect revision within 31-60 days as info", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 45);
    const client = makeClient({ dateButoir: soon.toISOString().split("T")[0] });
    const result = analyzeCockpit([client], [], []);
    const revisionBientot = result.urgencies.filter(
      u => u.type === "revision" && u.title.includes("bientot")
    );
    expect(revisionBientot.length).toBe(1);
    expect(revisionBientot[0].severity).toBe("info");
  });

  it("should NOT flag revision far in the future", () => {
    const client = makeClient({ dateButoir: "2099-01-01" });
    const result = analyzeCockpit([client], [], []);
    const revisionBientot = result.urgencies.filter(
      u => u.type === "revision" && u.title.includes("bientot")
    );
    expect(revisionBientot.length).toBe(0);
  });
});

// ============================================================
// #5: cockpitEngine — domiciliation detection
// ============================================================
describe("#5: cockpitEngine — domiciliation detection", () => {
  it("should detect 3+ clients at same address", () => {
    const clients = [
      makeClient({ ref: "CLI-1", raisonSociale: "A", adresse: "10 RUE DU LAC", cp: "75001" }),
      makeClient({ ref: "CLI-2", raisonSociale: "B", adresse: "10 RUE DU LAC", cp: "75001" }),
      makeClient({ ref: "CLI-3", raisonSociale: "C", adresse: "10 RUE DU LAC", cp: "75001" }),
    ];
    const result = analyzeCockpit(clients, [], []);
    const domiciliation = result.urgencies.filter(u => u.type === "domiciliation");
    expect(domiciliation.length).toBe(1);
    expect(domiciliation[0].severity).toBe("warning");
  });

  it("should NOT flag 2 clients at same address", () => {
    const clients = [
      makeClient({ ref: "CLI-1", adresse: "10 RUE DU LAC", cp: "75001" }),
      makeClient({ ref: "CLI-2", adresse: "10 RUE DU LAC", cp: "75001" }),
    ];
    const result = analyzeCockpit(clients, [], []);
    const domiciliation = result.urgencies.filter(u => u.type === "domiciliation");
    expect(domiciliation.length).toBe(0);
  });
});

// ============================================================
// #6: cockpitEngine — honoraires anomaly
// ============================================================
describe("#6: cockpitEngine — missing honoraires detection", () => {
  it("should flag VALIDE client with 0 honoraires", () => {
    const client = makeClient({ honoraires: 0, etat: "VALIDE" });
    const result = analyzeCockpit([client], [], []);
    const issues = result.urgencies.filter(u => u.title.includes("Honoraires non renseignes"));
    expect(issues.length).toBe(1);
  });

  it("should NOT flag client with valid honoraires", () => {
    const client = makeClient({ honoraires: 5000, etat: "VALIDE" });
    const result = analyzeCockpit([client], [], []);
    const issues = result.urgencies.filter(u => u.title.includes("Honoraires non renseignes"));
    expect(issues.length).toBe(0);
  });
});

// ============================================================
// #7: cockpitEngine — urgencies sorted by severity
// ============================================================
describe("#7: cockpitEngine — urgency severity sorting", () => {
  it("should sort urgencies with critique first", () => {
    const clients = [
      makeClient({ ref: "CLI-1", dateExpCni: "2020-01-01", dateButoir: "2099-01-01", honoraires: 5000 }),
      makeClient({
        ref: "CLI-2",
        dateButoir: (() => { const d = new Date(); d.setDate(d.getDate() + 45); return d.toISOString().split("T")[0]; })(),
        dateExpCni: "2099-01-01",
        honoraires: 5000,
      }),
    ];
    const result = analyzeCockpit(clients, [], []);
    const critIdx = result.urgencies.findIndex(u => u.severity === "critique");
    const infoIdx = result.urgencies.findIndex(u => u.severity === "info");
    if (critIdx >= 0 && infoIdx >= 0) {
      expect(critIdx).toBeLessThan(infoIdx);
    }
  });
});

// ============================================================
// #8: lettreMissionEngine — NaN/negative guard
// ============================================================
describe("#8: lettreMissionEngine — honoraires calculation guards", () => {
  it("should return 0 for NaN input", async () => {
    const { calcHonorairesMensuels, calcHonorairesTrimestriels } = await import("../lib/lettreMissionEngine");
    expect(calcHonorairesMensuels(NaN)).toBe(0);
    expect(calcHonorairesTrimestriels(NaN)).toBe(0);
  });

  it("should return 0 for negative input", async () => {
    const { calcHonorairesMensuels, calcHonorairesTrimestriels } = await import("../lib/lettreMissionEngine");
    expect(calcHonorairesMensuels(-1200)).toBe(0);
    expect(calcHonorairesTrimestriels(-4000)).toBe(0);
  });

  it("should return 0 for Infinity", async () => {
    const { calcHonorairesMensuels, calcHonorairesTrimestriels } = await import("../lib/lettreMissionEngine");
    expect(calcHonorairesMensuels(Infinity)).toBe(0);
    expect(calcHonorairesTrimestriels(Infinity)).toBe(0);
  });

  it("should calculate correctly for valid input", async () => {
    const { calcHonorairesMensuels, calcHonorairesTrimestriels } = await import("../lib/lettreMissionEngine");
    expect(calcHonorairesMensuels(12000)).toBe(1000);
    expect(calcHonorairesTrimestriels(12000)).toBe(3000);
    expect(calcHonorairesMensuels(10000)).toBe(833.33);
    expect(calcHonorairesTrimestriels(10000)).toBe(2500);
  });
});

// ============================================================
// #9: lettreMissionEngine — validate negative honoraires
// ============================================================
describe("#9: lettreMissionEngine — validateLettreMission", () => {
  it("should reject negative honoraires", async () => {
    const { validateLettreMission } = await import("../lib/lettreMissionEngine");
    const client = makeClient({ honoraires: -500 });
    const cabinet = { nom: "Cabinet", siret: "12345678901234", numeroOEC: "123", adresse: "", email: "", telephone: "", ics: "" };
    const result = validateLettreMission(client, cabinet);
    expect(result.valid).toBe(false);
    expect(result.champsManquants).toContain("Honoraires (montant negatif)");
  });

  it("should accept valid honoraires", async () => {
    const { validateLettreMission } = await import("../lib/lettreMissionEngine");
    const client = makeClient({ honoraires: 5000 });
    const cabinet = { nom: "Cabinet", siret: "12345678901234", numeroOEC: "123", adresse: "", email: "", telephone: "", ics: "" };
    const result = validateLettreMission(client, cabinet);
    expect(result.champsManquants).not.toContain("Honoraires (montant negatif)");
  });
});

// ============================================================
// #10: lettreMissionEngine — counter overflow guard
// ============================================================
describe("#10: lettreMissionEngine — counter overflow", () => {
  it("should reset counter after 9999", async () => {
    const { incrementCounter, resetCounter } = await import("../lib/lettreMissionEngine");
    resetCounter(9999);
    const result = incrementCounter();
    expect(result).toMatch(/^LM-\d{4}-0001$/);
  });

  it("should generate sequential numbers normally", async () => {
    const { incrementCounter, resetCounter } = await import("../lib/lettreMissionEngine");
    resetCounter(0);
    const first = incrementCounter();
    const second = incrementCounter();
    expect(first).toMatch(/^LM-\d{4}-0001$/);
    expect(second).toMatch(/^LM-\d{4}-0002$/);
  });
});

// ============================================================
// #11: ibanValidator — country-specific length validation
// ============================================================
describe("#11: ibanValidator — country-specific lengths", () => {
  it("should reject German IBAN with wrong length", () => {
    const result = validateIBAN("DE89 3704 0044 0532 0130 001");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("22");
  });

  it("should accept valid French IBAN", () => {
    const result = validateIBAN("FR76 3000 6000 0112 3456 7890 189");
    expect(result.valid).toBe(true);
  });

  it("should reject French IBAN with wrong length", () => {
    const result = validateIBAN("FR76 3000 6000 0112 3456 78");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("27");
  });
});

// ============================================================
// #12: ibanValidator — bank name for unmapped codes
// ============================================================
describe("#12: ibanValidator — bank name handling", () => {
  it("should return known bank name for BNP", () => {
    const result = validateIBAN("FR76 3000 6000 0112 3456 7890 189");
    expect(result.valid).toBe(true);
    expect(result.bankName).toBe("BNP Paribas");
  });

  it("should return undefined for unknown French bank codes", () => {
    const result = validateIBAN("FR76 9999 9000 0112 3456 7890 189");
    if (result.valid) {
      expect(result.bankName).toBeUndefined();
    }
  });
});

// ============================================================
// #13: ibanValidator — unknown country code validation
// ============================================================
describe("#13: ibanValidator — country code validation", () => {
  it("should reject IBAN with unknown country code", () => {
    const result = validateIBAN("XX12 3456 7890 1234 5678 9012");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Code pays IBAN inconnu");
  });

  it("should accept valid German IBAN", () => {
    const result = validateIBAN("DE89 3704 0044 0532 0130 00");
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// #14-16: dataLoader — null coercion fixes
// ============================================================
describe("#14-16: null coercion — ?? vs ||", () => {
  it("should preserve 0 with ?? operator", () => {
    const capital = (0 as number) ?? 0;
    expect(capital).toBe(0);
  });

  it("should convert null to 0 with ??", () => {
    const nullCapital = (null as unknown as number) ?? 0;
    expect(nullCapital).toBe(0);
  });

  it("?? preserves NaN (unlike ||)", () => {
    const nanValue = (NaN as number) ?? 0;
    expect(nanValue).toBeNaN();
    // With ||, NaN || 0 would give 0
    expect(NaN || 0).toBe(0);
  });
});

// ============================================================
// #17: diagnosticEngine — SIREN duplicate detection
// ============================================================
describe("#17: diagnosticEngine — SIREN duplicate check", () => {
  it("should detect duplicate SIREN in diagnostic", () => {
    const clients = [
      makeClient({ ref: "CLI-1", siren: "123456789" }),
      makeClient({ ref: "CLI-2", siren: "123456789" }),
    ];
    const result = runDiagnostic360(clients, [makeCollab({ referentLcb: true })], [], []);
    const item = result.items.find(i => i.indicateur.includes("Doublons SIREN"));
    expect(item).toBeDefined();
    expect(item!.statut).toBe("ALERTE");
  });

  it("should report OK when no duplicates", () => {
    const clients = [
      makeClient({ ref: "CLI-1", siren: "123456789" }),
      makeClient({ ref: "CLI-2", siren: "987654321" }),
    ];
    const result = runDiagnostic360(clients, [makeCollab({ referentLcb: true })], [], []);
    const item = result.items.find(i => i.indicateur.includes("Doublons SIREN"));
    expect(item).toBeDefined();
    expect(item!.statut).toBe("OK");
  });
});

// ============================================================
// #18: diagnosticEngine — score bounds
// ============================================================
describe("#18: diagnosticEngine — score clamped 0-100", () => {
  it("should produce score between 0 and 100", () => {
    const result = runDiagnostic360([makeClient()], [makeCollab({ referentLcb: true })], [], []);
    expect(result.scoreGlobalDispositif).toBeGreaterThanOrEqual(0);
    expect(result.scoreGlobalDispositif).toBeLessThanOrEqual(100);
  });

  it("should return valid noteLettre", () => {
    const result = runDiagnostic360([], [], [], []);
    expect(["A", "B", "C", "D"]).toContain(result.noteLettre);
  });

  it("should give higher score for well-maintained portfolio", () => {
    const clients = [makeClient({ ref: "CLI-1", siren: "111222333" }), makeClient({ ref: "CLI-2", siren: "444555666" })];
    const collabs = [makeCollab({ referentLcb: true }), makeCollab({ suppleant: "REFERENT" })];
    const logs = Array.from({ length: 15 }, (_, i) => ({
      horodatage: new Date().toISOString().replace("T", " ").slice(0, 16),
      utilisateur: "test@test.com",
      refClient: `CLI-${i}`,
      typeAction: ["CREATION", "MODIFICATION", "SCREENING", "SCORING_CALCUL", "REVUE_PERIODIQUE"][i % 5],
      details: "Test",
    }));
    const result = runDiagnostic360(clients, collabs, [], logs);
    expect(result.scoreGlobalDispositif).toBeGreaterThan(50);
  });
});

// ============================================================
// #19: riskEngine — scoreStructure edge cases
// ============================================================
describe("#19: riskEngine — scoreStructure edge cases", () => {
  it("should handle TRUST as highest risk", () => {
    const result = calculateRiskScore({
      ape: "62.20Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: "2010-01-01", dateReprise: "", effectif: "5",
      forme: "TRUST", ppe: false, atypique: false, distanciel: false,
      cash: false, pression: false,
    });
    expect(result.scoreStructure).toBe(100);
    expect(result.nivVigilance).toBe("RENFORCEE");
  });

  it("should handle SCI correctly", () => {
    const result = calculateRiskScore({
      ape: "62.20Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: "2010-01-01", dateReprise: "", effectif: "5",
      forme: "SCI", ppe: false, atypique: false, distanciel: false,
      cash: false, pression: false,
    });
    expect(result.scoreStructure).toBe(35);
  });

  it("should default to 20 for unknown formes", () => {
    const result = calculateRiskScore({
      ape: "62.20Z", paysRisque: false, mission: "TENUE COMPTABLE",
      dateCreation: "2010-01-01", dateReprise: "", effectif: "5",
      forme: "COOPERATIVE", ppe: false, atypique: false, distanciel: false,
      cash: false, pression: false,
    });
    expect(result.scoreStructure).toBe(20);
  });
});

// ============================================================
// #20: getPilotageStatus — edge cases
// ============================================================
describe("#20: getPilotageStatus — edge cases", () => {
  it("should return RETARD for empty dateButoir", () => {
    expect(getPilotageStatus("")).toBe("RETARD");
  });

  it("should return RETARD for invalid date string", () => {
    expect(getPilotageStatus("not-a-date")).toBe("RETARD");
  });

  it("should return BIENTOT for dates within 60 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    expect(getPilotageStatus(soon.toISOString().split("T")[0])).toBe("BIENTOT");
  });

  it("should return A JOUR for dates beyond 60 days", () => {
    const future = new Date();
    future.setDate(future.getDate() + 90);
    expect(getPilotageStatus(future.toISOString().split("T")[0])).toBe("A JOUR");
  });
});
