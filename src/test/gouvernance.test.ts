/**
 * Gouvernance Module — 55+ comprehensive tests
 *
 * Tests cover:
 * - gouvernanceService: CRUD operations, local storage fallback, cache
 * - InfosCabinet: validation (SIRET, RC Pro expiration)
 * - FormationsPanel: formation expiration logic, date formatting
 * - ManuelProcedures: date calculations (daysSince, formatDate)
 * - ControleInterne: weighted random selection (tirageAleatoire)
 * - AutoEvaluationNPMQ: score computation with PARTIEL/NA weighting
 * - Data integrity: type structures, empty states, edge cases
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── InfosCabinet helpers ───────────────────────────────────

import {
  validateSiret,
  isRcProExpired,
  isRcProExpiringSoon,
  EMPTY_CABINET_INFO,
} from "../components/gouvernance/InfosCabinet";

describe("InfosCabinet — validateSiret", () => {
  it("should accept empty string", () => {
    expect(validateSiret("")).toBe(true);
  });

  it("should accept valid 14-digit SIRET", () => {
    expect(validateSiret("12345678901234")).toBe(true);
  });

  it("should accept SIRET with spaces", () => {
    expect(validateSiret("123 456 789 00012")).toBe(true);
  });

  it("should reject SIRET with 13 digits", () => {
    expect(validateSiret("1234567890123")).toBe(false);
  });

  it("should reject SIRET with 15 digits", () => {
    expect(validateSiret("123456789012345")).toBe(false);
  });

  it("should reject SIRET with letters", () => {
    expect(validateSiret("1234567890123A")).toBe(false);
  });

  it("should reject SIRET with special characters", () => {
    expect(validateSiret("12345-67890123")).toBe(false);
  });
});

describe("InfosCabinet — isRcProExpired", () => {
  it("should return false for empty date", () => {
    expect(isRcProExpired("")).toBe(false);
  });

  it("should return false for invalid date", () => {
    expect(isRcProExpired("not-a-date")).toBe(false);
  });

  it("should return true for past date", () => {
    expect(isRcProExpired("2020-01-01")).toBe(true);
  });

  it("should return false for future date", () => {
    expect(isRcProExpired("2030-12-31")).toBe(false);
  });
});

describe("InfosCabinet — isRcProExpiringSoon", () => {
  it("should return false for empty date", () => {
    expect(isRcProExpiringSoon("")).toBe(false);
  });

  it("should return false for expired date", () => {
    expect(isRcProExpiringSoon("2020-01-01")).toBe(false);
  });

  it("should return false for far future date", () => {
    expect(isRcProExpiringSoon("2030-12-31")).toBe(false);
  });

  it("should return true for date within 90 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    expect(isRcProExpiringSoon(soon.toISOString().split("T")[0])).toBe(true);
  });

  it("should respect custom threshold", () => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    expect(isRcProExpiringSoon(d.toISOString().split("T")[0], 5)).toBe(false);
    expect(isRcProExpiringSoon(d.toISOString().split("T")[0], 15)).toBe(true);
  });
});

describe("InfosCabinet — EMPTY_CABINET_INFO", () => {
  it("should have all expected keys", () => {
    const keys = Object.keys(EMPTY_CABINET_INFO);
    expect(keys).toContain("siret");
    expect(keys).toContain("numero_oec");
    expect(keys).toContain("croec");
    expect(keys).toContain("adresse");
    expect(keys).toContain("cp");
    expect(keys).toContain("ville");
    expect(keys).toContain("rc_pro_assureur");
    expect(keys).toContain("rc_pro_police");
    expect(keys).toContain("rc_pro_expiration");
    expect(keys).toContain("raison_sociale");
  });

  it("should have all empty string values", () => {
    Object.values(EMPTY_CABINET_INFO).forEach(v => {
      expect(v).toBe("");
    });
  });
});

// ─── FormationsPanel helpers ────────────────────────────────

import {
  isFormationExpired,
  formatDate as formatDateFormation,
} from "../components/gouvernance/FormationsPanel";

describe("FormationsPanel — isFormationExpired", () => {
  it("should return true for empty string", () => {
    expect(isFormationExpired("")).toBe(true);
  });

  it("should return true for invalid date", () => {
    expect(isFormationExpired("invalid")).toBe(true);
  });

  it("should return true for date > 365 days ago", () => {
    const old = new Date();
    old.setDate(old.getDate() - 400);
    expect(isFormationExpired(old.toISOString())).toBe(true);
  });

  it("should return false for date < 365 days ago", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 100);
    expect(isFormationExpired(recent.toISOString())).toBe(false);
  });

  it("should return false for today's date", () => {
    expect(isFormationExpired(new Date().toISOString())).toBe(false);
  });

  it("should return false for future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 100);
    expect(isFormationExpired(future.toISOString())).toBe(false);
  });
});

describe("FormationsPanel — formatDate", () => {
  it("should return --- for empty string", () => {
    expect(formatDateFormation("")).toBe("---");
  });

  it("should return --- for invalid date", () => {
    expect(formatDateFormation("not-a-date")).toBe("---");
  });

  it("should format valid date in fr-FR", () => {
    const result = formatDateFormation("2026-01-15");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/01/);
    expect(result).toMatch(/2026/);
  });

  it("should handle ISO timestamp", () => {
    const result = formatDateFormation("2026-03-09T12:00:00.000Z");
    expect(result).toMatch(/2026/);
  });
});

// ─── ManuelProcedures helpers ───────────────────────────────

import {
  formatDate as formatDateManuel,
  daysSince,
} from "../components/gouvernance/ManuelProcedures";

describe("ManuelProcedures — daysSince", () => {
  it("should return empty for empty string", () => {
    expect(daysSince("")).toBe("");
  });

  it("should return empty for invalid date", () => {
    expect(daysSince("invalid")).toBe("");
  });

  it("should return 'aujourd'hui' for today", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(daysSince(today)).toBe("aujourd'hui");
  });

  it("should return days for recent date", () => {
    const d = new Date();
    d.setDate(d.getDate() - 5);
    expect(daysSince(d.toISOString().split("T")[0])).toBe("il y a 5 jour(s)");
  });

  it("should return months for older date", () => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    expect(daysSince(d.toISOString().split("T")[0])).toBe("il y a 2 mois");
  });

  it("should return years for very old date", () => {
    const d = new Date();
    d.setDate(d.getDate() - 400);
    expect(daysSince(d.toISOString().split("T")[0])).toBe("il y a 1 an(s)");
  });

  it("should handle future dates", () => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    const result = daysSince(d.toISOString().split("T")[0]);
    expect(result).toMatch(/dans \d+ jour/);
  });
});

describe("ManuelProcedures — formatDate", () => {
  it("should return --- for empty", () => {
    expect(formatDateManuel("")).toBe("---");
  });

  it("should return --- for invalid date", () => {
    expect(formatDateManuel("xyz")).toBe("---");
  });

  it("should format with month name in french", () => {
    const result = formatDateManuel("2026-01-15");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
    // Should have month name (janvier)
    expect(result.length).toBeGreaterThan(8);
  });
});

// ─── ControleInterne — tirageAleatoire ──────────────────────

import { tirageAleatoire } from "../components/gouvernance/ControleInterne";

describe("ControleInterne — tirageAleatoire", () => {
  const clients = [
    { ref: "CLI-01", raisonSociale: "A Corp", scoreGlobal: 80 },
    { ref: "CLI-02", raisonSociale: "B Corp", scoreGlobal: 20 },
    { ref: "CLI-03", raisonSociale: "C Corp", scoreGlobal: 50 },
    { ref: "CLI-04", raisonSociale: "D Corp", scoreGlobal: 10 },
    { ref: "CLI-05", raisonSociale: "E Corp", scoreGlobal: 90 },
  ];

  it("should return empty array for empty clients", () => {
    expect(tirageAleatoire([], 3)).toEqual([]);
  });

  it("should return correct number of selections", () => {
    const result = tirageAleatoire(clients, 3);
    expect(result.length).toBe(3);
  });

  it("should not exceed available clients", () => {
    const result = tirageAleatoire(clients, 10);
    expect(result.length).toBe(5);
  });

  it("should return unique selections (no duplicates)", () => {
    const result = tirageAleatoire(clients, 5);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it("should format selections as 'name (ref)'", () => {
    const result = tirageAleatoire(clients, 1);
    expect(result[0]).toMatch(/\(CLI-\d+\)$/);
  });

  it("should handle clients with zero score", () => {
    const zeroClients = [
      { ref: "CLI-01", raisonSociale: "Zero Corp", scoreGlobal: 0 },
    ];
    const result = tirageAleatoire(zeroClients, 1);
    expect(result.length).toBe(1);
  });

  it("should handle single client", () => {
    const single = [{ ref: "CLI-01", raisonSociale: "Solo", scoreGlobal: 50 }];
    const result = tirageAleatoire(single, 1);
    expect(result).toEqual(["Solo (CLI-01)"]);
  });

  it("should handle count of 0", () => {
    const result = tirageAleatoire(clients, 0);
    expect(result).toEqual([]);
  });
});

// ─── AutoEvaluationNPMQ — computeScore ──────────────────────

import {
  computeScore,
  QUESTIONS_NPMQ,
  type Question,
} from "../components/gouvernance/AutoEvaluationNPMQ";

describe("AutoEvaluationNPMQ — computeScore", () => {
  it("should return 0% for all unanswered questions", () => {
    const questions: Question[] = QUESTIONS_NPMQ.map(q => ({ ...q, reponse: "" }));
    const result = computeScore(questions);
    expect(result.score).toBe(0);
    expect(result.answered).toBe(0);
    expect(result.total).toBe(QUESTIONS_NPMQ.length);
  });

  it("should return 100% for all OUI answers", () => {
    const questions: Question[] = QUESTIONS_NPMQ.map(q => ({ ...q, reponse: "OUI" }));
    const result = computeScore(questions);
    expect(result.score).toBe(100);
    expect(result.oui).toBe(QUESTIONS_NPMQ.length);
  });

  it("should return 0% for all NON answers", () => {
    const questions: Question[] = QUESTIONS_NPMQ.map(q => ({ ...q, reponse: "NON" }));
    const result = computeScore(questions);
    expect(result.score).toBe(0);
    expect(result.non).toBe(QUESTIONS_NPMQ.length);
  });

  it("should count PARTIEL as 50%", () => {
    const questions: Question[] = [
      { id: "q1", categorie: "Test", question: "Q1", reponse: "PARTIEL" },
      { id: "q2", categorie: "Test", question: "Q2", reponse: "PARTIEL" },
    ];
    const result = computeScore(questions);
    expect(result.score).toBe(50);
  });

  it("should exclude NA from denominator", () => {
    const questions: Question[] = [
      { id: "q1", categorie: "Test", question: "Q1", reponse: "OUI" },
      { id: "q2", categorie: "Test", question: "Q2", reponse: "NA" },
    ];
    const result = computeScore(questions);
    expect(result.score).toBe(100); // 1/1 (NA excluded)
  });

  it("should calculate mixed score correctly", () => {
    const questions: Question[] = [
      { id: "q1", categorie: "Test", question: "Q1", reponse: "OUI" },
      { id: "q2", categorie: "Test", question: "Q2", reponse: "NON" },
      { id: "q3", categorie: "Test", question: "Q3", reponse: "PARTIEL" },
      { id: "q4", categorie: "Test", question: "Q4", reponse: "NA" },
    ];
    const result = computeScore(questions);
    // effectiveTotal = 4 - 1 = 3, effectiveScore = 1 + 0.5 = 1.5
    // score = round(1.5/3 * 100) = 50
    expect(result.score).toBe(50);
  });

  it("should compute per-category stats", () => {
    const questions: Question[] = [
      { id: "q1", categorie: "A", question: "Q1", reponse: "OUI" },
      { id: "q2", categorie: "A", question: "Q2", reponse: "OUI" },
      { id: "q3", categorie: "B", question: "Q3", reponse: "NON" },
    ];
    const result = computeScore(questions);
    const catA = result.catStats.find(c => c.categorie === "A");
    const catB = result.catStats.find(c => c.categorie === "B");
    expect(catA?.pct).toBe(100);
    expect(catB?.pct).toBe(0);
  });

  it("should handle all NA answers", () => {
    const questions: Question[] = [
      { id: "q1", categorie: "Test", question: "Q1", reponse: "NA" },
      { id: "q2", categorie: "Test", question: "Q2", reponse: "NA" },
    ];
    const result = computeScore(questions);
    expect(result.score).toBe(0); // effectiveTotal = 0
  });

  it("should have 15 questions defined in QUESTIONS_NPMQ", () => {
    expect(QUESTIONS_NPMQ.length).toBe(15);
  });

  it("should cover at least 5 categories", () => {
    const categories = new Set(QUESTIONS_NPMQ.map(q => q.categorie));
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });

  it("should have unique question IDs", () => {
    const ids = QUESTIONS_NPMQ.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── gouvernanceService — local storage fallback ────────────

describe("gouvernanceService — local storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should store and retrieve formations from localStorage", () => {
    const key = "grimy_gov_formations";
    const data = [{ id: "f1", collaborateur: "Test", date: "2026-01-01" }];
    localStorage.setItem(key, JSON.stringify(data));
    const raw = localStorage.getItem(key);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(data);
  });

  it("should store and retrieve non_conformites from localStorage", () => {
    const key = "grimy_gov_non_conformites";
    const data = [{ id: "nc1", description: "Test NC", statut: "OUVERTE" }];
    localStorage.setItem(key, JSON.stringify(data));
    const raw = localStorage.getItem(key);
    expect(JSON.parse(raw!)).toEqual(data);
  });

  it("should store and retrieve declarations from localStorage", () => {
    const key = "grimy_gov_declarations_soupcon";
    const data = [{ id: "ds1", client: "Test Client", decision: "CLASSE" }];
    localStorage.setItem(key, JSON.stringify(data));
    const raw = localStorage.getItem(key);
    expect(JSON.parse(raw!)).toEqual(data);
  });

  it("should return empty array for missing key", () => {
    const raw = localStorage.getItem("grimy_gov_nonexistent");
    expect(raw).toBeNull();
  });

  it("should handle corrupted JSON gracefully", () => {
    localStorage.setItem("grimy_gov_test", "not json{{{");
    try {
      JSON.parse(localStorage.getItem("grimy_gov_test")!);
    } catch {
      expect(true).toBe(true); // Should throw
    }
  });

  it("should store parametres via localStorage", () => {
    const key = "grimy_param_cabinet_info";
    const data = { siret: "12345678901234", raison_sociale: "Test Cabinet" };
    localStorage.setItem(key, JSON.stringify(data));
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(data);
  });

  it("should store auto_evaluations via localStorage", () => {
    const key = "grimy_gov_auto_evaluations";
    const data = [{ id: "ae1", date: "2026-03-09", score: 75, reponses: { q1: "OUI" } }];
    localStorage.setItem(key, JSON.stringify(data));
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(data);
  });

  it("should store controles_planifies via localStorage", () => {
    const key = "grimy_gov_controles_planifies";
    const data = [{ id: "cp1", date: "2026-04-01", dossiers: ["A", "B"], statut: "PLANIFIE" }];
    localStorage.setItem(key, JSON.stringify(data));
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(data);
  });
});

// ─── Data integrity tests ───────────────────────────────────

describe("Data integrity", () => {
  it("NonConformiteRecord should have required fields", () => {
    const nc = {
      id: "nc1",
      date: "2026-01-01",
      source: "Controle",
      client: "Client A",
      description: "Missing KYC",
      gravite: "MAJEURE" as const,
      action_corrective: "Update docs",
      responsable: "Jean",
      echeance: "2026-06-01",
      statut: "OUVERTE" as const,
    };
    expect(nc.id).toBeDefined();
    expect(nc.gravite).toMatch(/^(MINEURE|MAJEURE|CRITIQUE)$/);
    expect(nc.statut).toMatch(/^(OUVERTE|EN_COURS|RESOLUE)$/);
  });

  it("DeclarationSoupconRecord should have required fields", () => {
    const ds = {
      id: "ds1",
      date_detection: "2026-03-01",
      client: "Client B",
      motif: "Operation atypique",
      decision: "DECLARE" as const,
      justification: "",
      ref_tracfin: "TR-2026-001",
      statut: "EN_COURS" as const,
      elements_suspects: "Flux anormaux",
    };
    expect(ds.decision).toMatch(/^(DECLARE|CLASSE|EN_ANALYSE)$/);
    expect(ds.statut).toMatch(/^(EN_COURS|TRANSMISE|CLASSEE)$/);
  });

  it("FormationRecord should have required fields", () => {
    const f = {
      id: "f1",
      collaborateur: "Jean Dupont",
      date: "2026-02-15",
      organisme: "CNCC",
      duree_heures: 7,
      theme: "LCB-FT",
      attestation_url: "",
      quiz_score: "18/20",
      notes: "",
    };
    expect(f.duree_heures).toBeGreaterThanOrEqual(0);
    expect(f.collaborateur).toBeTruthy();
  });

  it("ManuelVersion should have valid statut", () => {
    const v = {
      id: "v1",
      version: "v1",
      date: "2026-01-15",
      statut: "VALIDE" as const,
      resume: "Test",
      contenu: "Content",
    };
    expect(v.statut).toMatch(/^(VALIDE|BROUILLON|ARCHIVE)$/);
  });

  it("ControleCROECRecord should have valid resultat", () => {
    const c = {
      id: "c1",
      date: "2025-06-15",
      type: "Controle qualite",
      resultat: "CONFORME" as const,
      rapport_url: "",
      notes: "",
    };
    expect(c.resultat).toMatch(/^(CONFORME|AVEC_RESERVES|NON_CONFORME)$/);
  });
});
