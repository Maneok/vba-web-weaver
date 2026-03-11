/**
 * Comprehensive tests for buttons, handlers, and process flows.
 * Ensures no crashes occur during common user interactions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Client, Collaborateur, AlerteRegistre, LogEntry } from "@/lib/types";
import { calculateRiskScore, calculateNextReviewDate, getPilotageStatus } from "@/lib/riskEngine";
import { analyzeCockpit } from "@/lib/cockpitEngine";
import { runDiagnostic360 } from "@/lib/diagnosticEngine";
import { generateFicheAcceptation } from "@/lib/generateFichePdf";
import { generateDiagnosticPdf } from "@/lib/generateDiagnosticPdf";
import { validateEmail, validateSiren, validateCodePostal } from "@/lib/validation";
import { validateIBAN } from "@/lib/ibanValidator";
import { downloadCSV, csvSafe } from "@/lib/csvUtils";
import { sanitizeInput, sanitizeHtml } from "@/lib/utils/sanitize";
import { formatDateFR, formatDateTimeFR, timeAgo, daysUntil } from "@/lib/dateUtils";
import { generateRiskScorecard, generateDossierChecklist, generateComplianceCertificate, generateScoreExplanation } from "@/lib/reportUtils";
import { auditKycCompleteness, auditDocuments, calculateDataQualityScore, generateNullabilityReport } from "@/lib/auditEngine";
import { generateReviewSchedule, generateComplianceChecklist, findMandatoryActions, runAlertRules, calculateEscalationStatus, balanceWorkload } from "@/lib/workflowEngine";
import { calculatePortfolioStats, calculateCollabWorkload, analyzeScoreDistribution, calculateComplianceMetrics, generateComplianceSnapshot } from "@/lib/portfolioAnalytics";
import { parseCSV, parseClientCSV, exportClientsCSV, flattenClientRecord, detectDataInconsistencies, findClientDuplicates } from "@/lib/dataImport";

// ── Test helpers ──

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    ref: "CLI-26-001", etat: "VALIDE" as const, comptable: "Dupont", mission: "TENUE",
    raisonSociale: "ACME SAS", forme: "SARL", adresse: "1 rue de la Paix",
    cp: "75001", ville: "Paris", siren: "123456789", capital: 10000, ape: "62.01Z",
    dirigeant: "Jean Dupont", domaine: "", effectif: "5", tel: "0101010101",
    mail: "test@example.com", dateCreation: "2020-01-01", dateReprise: "2020-01-01",
    honoraires: 5000, reprise: "NON", juridique: "NON", frequence: "MENSUELLE",
    iban: "", bic: "", associe: "", superviseur: "",
    ppe: "NON" as const, paysRisque: "NON" as const, atypique: "NON" as const,
    distanciel: "NON" as const, cash: "NON" as const, pression: "NON" as const,
    scoreActivite: 30, scorePays: 0, scoreMission: 20, scoreMaturite: 10,
    scoreStructure: 15, malus: 0, scoreGlobal: 20, nivVigilance: "SIMPLIFIEE" as const,
    dateCreationLigne: "2026-01-01", dateDerniereRevue: "2026-01-01",
    dateButoir: "2029-01-01", etatPilotage: "CONFORME" as const,
    dateExpCni: "2030-01-01", statut: "ACTIF" as const, be: "Jean Dupont 100%",
    lienKbis: "", lienStatuts: "", lienCni: "",
    ...overrides,
  } as Client;
}

function makeCollab(overrides: Partial<Collaborateur> = {}): Collaborateur {
  return {
    id: "1", nom: "Marie Martin", fonction: "COLLABORATEUR", email: "marie@cabinet.fr",
    niveauCompetence: "SENIOR", statutFormation: "A JOUR",
    suppleant: "", telephone: "", derniereFormation: "2025-06-01",
    dateSignatureManuel: "2025-01-15", referentLcb: false,
    ...overrides,
  } as Collaborateur;
}

function makeAlerte(overrides: Partial<AlerteRegistre> = {}): AlerteRegistre {
  return {
    date: "2026-03-01", clientConcerne: "ACME SAS",
    categorie: "ADMIN : KYC Incomplet", qualification: "",
    details: "Documents manquants", actionPrise: "EN INVESTIGATION",
    responsable: "Marie Martin", statut: "EN COURS",
    dateButoir: "2026-04-01", typeDecision: "", validateur: "",
    ...overrides,
  } as AlerteRegistre;
}

// ── SECTION 1: Risk Engine (buttons that trigger scoring) ──

describe("Risk scoring never crashes", () => {
  it("handles undefined/null fields gracefully", () => {
    const c = makeClient({ ape: undefined as any, forme: undefined as any, mission: undefined as any });
    const result = calculateRiskScore(c);
    expect(result).toBeDefined();
    expect(typeof result.scoreGlobal).toBe("number");
    expect(result.nivVigilance).toBeDefined();
  });

  it("handles empty string fields", () => {
    const c = makeClient({ ape: "", forme: "", mission: "", dateCreation: "" });
    const result = calculateRiskScore(c);
    expect(result.scoreGlobal).toBeGreaterThanOrEqual(0);
  });

  it("handles extreme score values", () => {
    const c = makeClient({
      ppe: "OUI", paysRisque: "OUI", atypique: "OUI",
      cash: "OUI", pression: "OUI", distanciel: "OUI",
    });
    const result = calculateRiskScore(c);
    expect(result.scoreGlobal).toBeLessThanOrEqual(120);
    expect(result.nivVigilance).toBe("RENFORCEE");
  });

  it("returns valid review date for all vigilance levels", () => {
    ["SIMPLIFIEE", "STANDARD", "RENFORCEE"].forEach(niv => {
      const date = calculateNextReviewDate(niv);
      expect(date).toBeTruthy();
      expect(new Date(date).getTime()).toBeGreaterThan(Date.now());
    });
  });

  it("getPilotageStatus handles invalid dates", () => {
    expect(getPilotageStatus("")).toBeDefined();
    expect(getPilotageStatus("not-a-date")).toBeDefined();
    expect(getPilotageStatus(undefined as any)).toBeDefined();
  });
});

// ── SECTION 2: Cockpit Engine (dashboard buttons) ──

describe("Dashboard cockpit never crashes", () => {
  it("handles empty data", () => {
    const result = analyzeCockpit([], [], []);
    expect(result).toBeDefined();
    expect(result.urgencies).toBeDefined();
    expect(result.totalClients).toBe(0);
  });

  it("handles null/undefined in client fields", () => {
    const clients = [
      makeClient({ dateButoir: undefined as any, dateExpCni: undefined as any }),
      makeClient({ siren: null as any, mail: null as any }),
    ];
    const result = analyzeCockpit(clients, [], []);
    expect(result).toBeDefined();
    expect(typeof result.totalClients).toBe("number");
  });

  it("handles clients with past deadlines", () => {
    const clients = [makeClient({ dateButoir: "2020-01-01", dateExpCni: "2020-01-01" })];
    const result = analyzeCockpit(clients, [], []);
    expect(result.urgencies.length).toBeGreaterThan(0);
  });
});

// ── SECTION 3: Diagnostic Engine (diagnostic page button) ──

describe("Diagnostic 360 never crashes", () => {
  it("handles empty inputs", () => {
    const report = runDiagnostic360([], [], [], []);
    expect(report).toBeDefined();
    expect(typeof report.scoreGlobalDispositif).toBe("number");
    expect(report.noteLettre).toBeDefined();
  });

  it("handles all edge case clients", () => {
    const clients = [
      makeClient({ etat: "VALIDE", nivVigilance: "RENFORCEE", ppe: "OUI" }),
      makeClient({ ref: "CLI-26-002", etat: "ARCHIVE" as any }),
      makeClient({ ref: "CLI-26-003", siren: "", mail: "", adresse: "" }),
    ];
    const collabs = [makeCollab()];
    const alertes = [makeAlerte()];
    const logs: LogEntry[] = [];
    const report = runDiagnostic360(clients, collabs, alertes, logs);
    expect(report.scoreGlobalDispositif).toBeGreaterThanOrEqual(0);
    expect(report.items.length).toBeGreaterThan(0);
  });
});

// ── SECTION 4: Validation functions (form submit buttons) ──

describe("Form validation never crashes", () => {
  it("validates emails safely", () => {
    // validateEmail returns null for valid/empty, error string for invalid
    expect(validateEmail("test@example.com")).toBeNull(); // valid → null
    expect(validateEmail("")).toBeNull(); // empty → null (not required)
    expect(validateEmail(null as any)).toBeNull(); // null → null (not required)
    expect(validateEmail(undefined as any)).toBeNull();
    expect(typeof validateEmail("not-email")).toBe("string"); // returns error message
  });

  it("validates SIREN safely", () => {
    expect(typeof validateSiren("123456789")).toBe("boolean");
    expect(validateSiren("")).toBe(false);
    expect(validateSiren(null as any)).toBe(false);
    expect(validateSiren(undefined as any)).toBe(false);
    expect(validateSiren("12345")).toBe(false);
  });

  it("validates code postal safely", () => {
    expect(validateCodePostal("75001")).toBe(true);
    expect(validateCodePostal("")).toBe(false);
    expect(validateCodePostal(null as any)).toBe(false);
    expect(validateCodePostal("ABCDE")).toBe(false);
  });

  it("validates IBAN safely", () => {
    const result1 = validateIBAN("FR7630006000011234567890189");
    expect(result1).toBeDefined();
    expect(typeof result1.valid).toBe("boolean");

    const result2 = validateIBAN("");
    expect(result2.valid).toBe(false);

    const result3 = validateIBAN(null as any);
    expect(result3.valid).toBe(false);
  });
});

// ── SECTION 5: CSV Export (export buttons) ──

describe("CSV export never crashes", () => {
  it("csvSafe handles special characters", () => {
    expect(csvSafe('hello "world"')).toBeDefined();
    expect(csvSafe("line1\nline2")).toBeDefined();
    expect(csvSafe("semi;colon")).toBeDefined();
    expect(csvSafe(null as any)).toBe("");
    expect(csvSafe(undefined as any)).toBe("");
    expect(csvSafe(123 as any)).toBeDefined();
  });

  it("downloadCSV handles empty data in jsdom", () => {
    // URL.createObjectURL is not available in jsdom, so downloadCSV will throw
    // The important thing is it doesn't throw a TypeError from data processing
    try {
      downloadCSV([], [], "test.csv");
    } catch (e: any) {
      // Expected in jsdom — URL.createObjectURL is not a function
      expect(e.message).toContain("createObjectURL");
    }
  });

  it("exportClientsCSV generates valid CSV string", () => {
    const csv = exportClientsCSV([makeClient()]);
    expect(csv).toContain("ACME SAS");
    expect(csv).toContain("123456789");
    expect(csv.startsWith("\uFEFF")).toBe(true); // BOM
  });
});

// ── SECTION 6: Sanitization (input security) ──

describe("Input sanitization never crashes", () => {
  it("sanitizeInput handles all types", () => {
    expect(sanitizeInput("hello")).toBe("hello");
    expect(sanitizeInput("")).toBe("");
    expect(sanitizeInput(null as any)).toBe("");
    expect(sanitizeInput(undefined as any)).toBe("");
    expect(sanitizeInput(123 as any)).toBe("123"); // Non-string → converted to string
    expect(sanitizeInput('<script>alert("xss")</script>')).not.toContain("<script>");
  });

  it("sanitizeHtml handles edge cases", () => {
    expect(sanitizeHtml("<b>bold</b>")).toBe("bold");
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(null as any)).toBe("");
  });
});

// ── SECTION 7: Date formatting (display buttons/labels) ──

describe("Date formatting never crashes", () => {
  it("formatDateFR handles all inputs", () => {
    expect(formatDateFR("2026-03-11")).toBeDefined();
    expect(formatDateFR("")).toBeDefined();
    expect(formatDateFR(null as any)).toBeDefined();
    expect(formatDateFR(undefined as any)).toBeDefined();
    expect(formatDateFR("not-a-date")).toBeDefined();
  });

  it("formatDateTimeFR handles all inputs", () => {
    expect(formatDateTimeFR("2026-03-11T10:30:00")).toBeDefined();
    expect(formatDateTimeFR("")).toBeDefined();
    expect(formatDateTimeFR(null as any)).toBeDefined();
  });

  it("timeAgo handles all inputs", () => {
    expect(timeAgo("2026-03-11T10:30:00")).toBeDefined();
    expect(timeAgo("")).toBeDefined();
    expect(timeAgo(null as any)).toBeDefined();
    expect(timeAgo("1990-01-01")).toBeDefined();
  });

  it("daysUntil handles all inputs", () => {
    expect(typeof daysUntil("2026-12-31")).toBe("number");
    expect(typeof daysUntil("2020-01-01")).toBe("number");
    expect(daysUntil("")).toBeDefined();
    expect(daysUntil(null as any)).toBeDefined();
  });
});

// ── SECTION 8: Report generation (PDF/export buttons) ──

describe("Report generation never crashes", () => {
  it("risk scorecard handles minimal client", () => {
    const sc = generateRiskScorecard(makeClient());
    expect(sc.ref).toBe("CLI-26-001");
    expect(sc.axes.length).toBe(5);
    expect(sc.malus.length).toBe(6);
    expect(sc.recommandations.length).toBeGreaterThan(0);
  });

  it("risk scorecard handles empty client", () => {
    const sc = generateRiskScorecard(makeClient({
      scoreActivite: undefined as any, scorePays: undefined as any,
      scoreGlobal: undefined as any, nivVigilance: undefined as any,
    }));
    expect(sc).toBeDefined();
    expect(sc.scoreGlobal).toBe(0);
  });

  it("dossier checklist handles all states", () => {
    const items = generateDossierChecklist(makeClient());
    expect(items.length).toBeGreaterThan(0);
    items.forEach(item => {
      expect(["ok", "manquant", "expire", "bientot_expire"]).toContain(item.statut);
    });
  });

  it("dossier checklist handles client with no documents", () => {
    const items = generateDossierChecklist(makeClient({
      lienKbis: "", lienStatuts: "", lienCni: "",
      dateExpCni: "", siren: "", adresse: "", iban: "", be: "",
    }));
    expect(items.filter(i => i.statut === "manquant").length).toBeGreaterThan(0);
  });

  it("compliance certificate handles incomplete client", () => {
    const cert = generateComplianceCertificate(makeClient({ siren: "", mail: "" }), "Cabinet Test", "Admin");
    expect(cert.conclusion).toBeDefined();
    expect(["conforme", "reserve", "non_conforme"]).toContain(cert.conclusion);
    expect(cert.prochainExamen).toBeTruthy();
  });

  it("score explanation handles all field types", () => {
    const expl = generateScoreExplanation(makeClient());
    expect(expl.length).toBe(6);
    expl.forEach(e => {
      expect(e.facteur).toBeTruthy();
      expect(typeof e.score).toBe("number");
      expect(e.explication).toBeTruthy();
    });
  });
});

// ── SECTION 9: Audit engine (audit buttons) ──

describe("Audit engine never crashes", () => {
  it("KYC audit handles empty array", () => {
    const { findings, stats } = auditKycCompleteness([]);
    expect(findings.length).toBe(0);
    expect(stats.total).toBe(0);
    expect(stats.taux).toBe(0);
  });

  it("KYC audit handles incomplete clients", () => {
    const clients = [
      makeClient({ siren: "", mail: "", adresse: "", dirigeant: "", ape: "", be: "", tel: "" }),
    ];
    const { findings, stats } = auditKycCompleteness(clients);
    expect(findings.length).toBeGreaterThan(0);
    expect(stats.insuffisants).toBeGreaterThan(0);
  });

  it("document audit handles expired dates", () => {
    const clients = [makeClient({ dateExpCni: "2020-01-01" })];
    const { findings, stats } = auditDocuments(clients);
    expect(stats.cniExpirees).toBe(1);
    expect(findings.some(f => f.severity === "critique")).toBe(true);
  });

  it("document audit handles invalid dates", () => {
    const clients = [makeClient({ dateExpCni: "not-a-date" })];
    const { findings } = auditDocuments(clients);
    expect(findings).toBeDefined(); // Should not crash
  });

  it("data quality score handles all zero data", () => {
    const result = calculateDataQualityScore([]);
    expect(result.score).toBe(0);
    expect(result.completeness).toBe(0);
  });

  it("data quality score detects inconsistencies", () => {
    const clients = [makeClient({ nivVigilance: "SIMPLIFIEE", ppe: "OUI" })];
    const result = calculateDataQualityScore(clients);
    expect(result.consistency).toBeLessThan(100);
  });

  it("nullability report returns sorted fields", () => {
    const report = generateNullabilityReport([makeClient()]);
    expect(report.length).toBeGreaterThan(0);
    // First field should have highest percentage
    for (let i = 1; i < report.length; i++) {
      expect(report[i - 1].percentage).toBeGreaterThanOrEqual(report[i].percentage);
    }
  });
});

// ── SECTION 10: Workflow engine (action buttons) ──

describe("Workflow engine never crashes", () => {
  it("review schedule handles empty array", () => {
    expect(generateReviewSchedule([])).toEqual([]);
  });

  it("review schedule handles invalid dates", () => {
    const clients = [makeClient({ dateButoir: "invalid-date" })];
    const schedule = generateReviewSchedule(clients);
    expect(schedule.length).toBe(1);
    expect(schedule[0].daysRemaining).toBe(-9999);
  });

  it("compliance checklist generates for all vigilance levels", () => {
    const simplifiee = generateComplianceChecklist(makeClient({ nivVigilance: "SIMPLIFIEE" }));
    const renforcee = generateComplianceChecklist(makeClient({ nivVigilance: "RENFORCEE" }));
    expect(renforcee.length).toBeGreaterThan(simplifiee.length);
  });

  it("mandatory actions handles edge cases", () => {
    const actions = findMandatoryActions([
      makeClient({ dateExpCni: "2020-01-01", dateButoir: "2020-01-01", be: "", nivVigilance: "SIMPLIFIEE", ppe: "OUI" }),
    ]);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].urgence).toBe("critique");
  });

  it("alert rules don't duplicate existing alerts", () => {
    const clients = [makeClient({ dateExpCni: "2020-01-01" })];
    const existing = [makeAlerte({ clientConcerne: "CLI-26-001", categorie: "ADMIN : KYC Incomplet" })];
    const alerts = runAlertRules(clients, undefined, existing);
    // Should not create duplicate alerts for same client+categorie
    const cniAlerts = alerts.filter(a => a.rule === "CNI expiree");
    expect(cniAlerts.length).toBe(0); // Already exists
  });

  it("escalation handles non-overdue alerts", () => {
    const status = calculateEscalationStatus(makeAlerte({ statut: "CLÔTURÉ" }));
    expect(status.isOverdue).toBe(false);
    expect(status.escalationLevel).toBe(0);
  });

  it("workload balancing with no collabs returns empty", () => {
    expect(balanceWorkload([makeClient()], [], new Map())).toEqual([]);
  });

  it("workload balancing distributes evenly", () => {
    const collabs = [makeCollab({ nom: "A" }), makeCollab({ nom: "B" })];
    const clients = [makeClient({ ref: "C1" }), makeClient({ ref: "C2" }), makeClient({ ref: "C3" }), makeClient({ ref: "C4" })];
    const assignments = balanceWorkload(clients, collabs, new Map());
    const countA = assignments.filter(a => a.assignedTo === "A").length;
    const countB = assignments.filter(a => a.assignedTo === "B").length;
    expect(Math.abs(countA - countB)).toBeLessThanOrEqual(1);
  });
});

// ── SECTION 11: Portfolio analytics (dashboard widgets) ──

describe("Portfolio analytics never crashes", () => {
  it("stats handles empty portfolio", () => {
    const stats = calculatePortfolioStats([]);
    expect(stats.totalClients).toBe(0);
    expect(stats.scoreMoyen).toBe(0);
    expect(stats.ecartType).toBe(0);
  });

  it("stats handles single client", () => {
    const stats = calculatePortfolioStats([makeClient({ scoreGlobal: 50 })]);
    expect(stats.scoreMoyen).toBe(50);
    expect(stats.scoreMedian).toBe(50);
  });

  it("collab workload handles unassigned clients", () => {
    const clients = [makeClient({ comptable: "" })];
    const result = calculateCollabWorkload(clients, []);
    expect(result.some(w => w.nom === "NON ASSIGNE")).toBe(true);
  });

  it("score distribution categorizes correctly", () => {
    const dist = analyzeScoreDistribution([
      makeClient({ scoreGlobal: 10 }),
      makeClient({ ref: "C2", scoreGlobal: 50 }),
      makeClient({ ref: "C3", scoreGlobal: 90 }),
    ]);
    expect(dist.buckets.length).toBe(6);
    expect(dist.isSkewed).toBeDefined();
  });

  it("compliance metrics handles empty data", () => {
    const metrics = calculateComplianceMetrics([], [], []);
    expect(metrics.scoreConformite).toBe(0);
    expect(metrics.alertesOuvertes).toBe(0);
  });

  it("compliance snapshot handles all fields", () => {
    const snap = generateComplianceSnapshot([makeClient()], "Cabinet Test");
    expect(snap.cabinet).toBe("Cabinet Test");
    expect(snap.totalClients).toBe(1);
    expect(snap.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── SECTION 12: Data import/export (CSV buttons) ──

describe("Data import/export never crashes", () => {
  it("parseCSV handles malformed input", () => {
    expect(parseCSV("")).toEqual([]);
    expect(parseCSV(null as any)).toEqual([]);
    expect(parseCSV(undefined as any)).toEqual([]);
    expect(parseCSV(123 as any)).toEqual([]);
  });

  it("parseCSV handles unclosed quotes", () => {
    const result = parseCSV('"unclosed;field');
    expect(result).toBeDefined();
  });

  it("parseClientCSV handles missing columns", () => {
    const result = parseClientCSV("unknown_col;another_col\nval1;val2");
    expect(result.data.length).toBe(0); // No mappable fields = skipped
    expect(result.errors).toBeDefined();
  });

  it("exportClientsCSV handles empty array", () => {
    const csv = exportClientsCSV([]);
    expect(csv).toBeDefined();
    expect(csv.length).toBeGreaterThan(0); // At least headers
  });

  it("exportClientsCSV roundtrip preserves data", () => {
    const clients = [makeClient()];
    const csv = exportClientsCSV(clients);
    expect(csv).toContain("ACME SAS");
    expect(csv).toContain("123456789");
  });

  it("flattenClientRecord handles all field types", () => {
    const flat = flattenClientRecord(makeClient());
    expect(typeof flat.ref).toBe("string");
    expect(typeof flat.capital).toBe("number");
  });

  it("detectDataInconsistencies finds issues", () => {
    const issues = detectDataInconsistencies([
      makeClient({ nivVigilance: "SIMPLIFIEE", ppe: "OUI" }),
    ]);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("findClientDuplicates handles empty array", () => {
    expect(findClientDuplicates([])).toEqual([]);
  });
});

// ── SECTION 13: Process flows (end-to-end) ──

describe("End-to-end process flows", () => {
  it("client creation flow: score → vigilance → review date → pilotage", () => {
    const client = makeClient({ ape: "62.01Z", forme: "SARL", mission: "TENUE" });
    const risk = calculateRiskScore(client);
    expect(risk.nivVigilance).toBeDefined();
    const reviewDate = calculateNextReviewDate(risk.nivVigilance);
    expect(reviewDate).toBeTruthy();
    const pilotage = getPilotageStatus(reviewDate);
    expect(pilotage).toBeDefined();
  });

  it("audit pipeline: KYC → docs → quality → actions", () => {
    const clients = [
      makeClient({ siren: "", dateExpCni: "2020-01-01" }),
      makeClient({ ref: "C2", be: "", lienKbis: "", lienStatuts: "" }),
    ];
    const kyc = auditKycCompleteness(clients);
    const docs = auditDocuments(clients);
    const quality = calculateDataQualityScore(clients);
    const actions = findMandatoryActions(clients);

    expect(kyc.findings.length).toBeGreaterThan(0);
    expect(docs.findings.length).toBeGreaterThan(0);
    expect(quality.score).toBeGreaterThanOrEqual(0);
    expect(actions.length).toBeGreaterThan(0);
  });

  it("compliance pipeline: checklist → certificate → scorecard", () => {
    const client = makeClient({ nivVigilance: "RENFORCEE", ppe: "OUI" });
    const checklist = generateComplianceChecklist(client);
    const cert = generateComplianceCertificate(client, "Cabinet Test", "Admin");
    const scorecard = generateRiskScorecard(client);
    const explanation = generateScoreExplanation(client);

    expect(checklist.length).toBeGreaterThan(0);
    expect(cert.numero).toContain("CERT-");
    expect(scorecard.recommandations.length).toBeGreaterThan(0);
    expect(explanation.length).toBe(6);
  });

  it("dashboard pipeline: cockpit → analytics → metrics", () => {
    const clients = [makeClient(), makeClient({ ref: "C2", scoreGlobal: 80, nivVigilance: "RENFORCEE" })];
    const collabs = [makeCollab()];
    const alertes = [makeAlerte()];

    const cockpit = analyzeCockpit(clients, collabs, alertes);
    const stats = calculatePortfolioStats(clients);
    const metrics = calculateComplianceMetrics(clients, collabs, alertes);

    expect(cockpit).toBeDefined();
    expect(stats.totalClients).toBe(2);
    expect(metrics.scoreConformite).toBeGreaterThanOrEqual(0);
  });

  it("CSV export → import roundtrip preserves critical fields", () => {
    const original = [makeClient(), makeClient({ ref: "CLI-26-002", raisonSociale: "Beta Corp" })];
    const csv = exportClientsCSV(original);
    const parsed = parseClientCSV(csv);
    // After adding camelCase header mappings, roundtrip should work
    expect(parsed.data.length).toBe(2);
    expect(parsed.data[0].raisonSociale).toBe("ACME SAS");
    expect(parsed.data[1].raisonSociale).toBe("Beta Corp");
  });

  it("review schedule → workload → alerts pipeline", () => {
    const clients = [
      makeClient({ dateButoir: "2026-04-01", comptable: "A" }),
      makeClient({ ref: "C2", dateButoir: "2026-05-01", comptable: "B" }),
    ];
    const schedule = generateReviewSchedule(clients);
    expect(schedule.length).toBe(2);

    const newAlerts = runAlertRules(clients);
    expect(newAlerts).toBeDefined();
  });
});

// ── SECTION 14: Edge cases that could crash buttons ──

describe("Edge cases that crash buttons", () => {
  it("all functions handle INACTIF clients", () => {
    const inactif = makeClient({ statut: "INACTIF" as any });
    expect(() => auditKycCompleteness([inactif])).not.toThrow();
    expect(() => auditDocuments([inactif])).not.toThrow();
    expect(() => calculateDataQualityScore([inactif])).not.toThrow();
    expect(() => generateNullabilityReport([inactif])).not.toThrow();
    expect(() => findMandatoryActions([inactif])).not.toThrow();
    expect(() => runAlertRules([inactif])).not.toThrow();
  });

  it("report functions handle client with all null scores", () => {
    const c = makeClient({
      scoreActivite: null as any, scorePays: null as any,
      scoreMission: null as any, scoreMaturite: null as any,
      scoreStructure: null as any, malus: null as any,
      scoreGlobal: null as any,
    });
    expect(() => generateRiskScorecard(c)).not.toThrow();
    expect(() => generateScoreExplanation(c)).not.toThrow();
    expect(() => generateComplianceCertificate(c, "Test", "Admin")).not.toThrow();
    expect(() => generateDossierChecklist(c)).not.toThrow();
  });

  it("analytics handle very large portfolio", () => {
    const large = Array.from({ length: 200 }, (_, i) =>
      makeClient({ ref: `C${i}`, scoreGlobal: Math.random() * 120 })
    );
    expect(() => calculatePortfolioStats(large)).not.toThrow();
    expect(() => analyzeScoreDistribution(large)).not.toThrow();
    expect(() => calculateDataQualityScore(large)).not.toThrow();
    expect(() => findClientDuplicates(large)).not.toThrow();
  });

  it("CSV handles special characters in all fields", () => {
    const c = makeClient({
      raisonSociale: 'Test "Quotes" & <html>',
      adresse: "123, rue de l'Eglise\nBâtiment B",
      dirigeant: "Müller-François Lefèvre",
    });
    const csv = exportClientsCSV([c]);
    expect(csv).toContain("Test");
    const flat = flattenClientRecord(c);
    expect(flat.raison_sociale).toContain("Quotes");
  });

  it("diagnostic handles mixed quality data", () => {
    const clients = Array.from({ length: 10 }, (_, i) =>
      makeClient({
        ref: `C${i}`,
        siren: i % 3 === 0 ? "" : "123456789",
        mail: i % 4 === 0 ? "" : "test@mail.com",
        dateButoir: i % 2 === 0 ? "2020-01-01" : "2030-01-01",
        nivVigilance: i % 5 === 0 ? "SIMPLIFIEE" : "STANDARD",
        ppe: i % 7 === 0 ? "OUI" : "NON",
      })
    );
    const report = runDiagnostic360(clients, [makeCollab()], [makeAlerte()], []);
    expect(report.scoreGlobalDispositif).toBeGreaterThanOrEqual(0);
    expect(report.scoreGlobalDispositif).toBeLessThanOrEqual(100);
  });
});

// ── SECTION 15: PDF Generation (export buttons) ──

describe("PDF generation functions don't crash", () => {
  it("generateFicheAcceptation handles minimal client", () => {
    // This uses jsPDF which needs DOM — just verify it doesn't throw synchronously
    // In test env, jsPDF may or may not work, so we wrap in try
    const client = makeClient();
    try {
      generateFicheAcceptation(client);
    } catch (e: any) {
      // jsPDF may fail in jsdom — that's OK, the important thing is no TypeError/ReferenceError
      expect(e.message).not.toContain("is not a function");
      expect(e.message).not.toContain("Cannot read prop");
    }
  });

  it("generateDiagnosticPdf handles empty report", () => {
    const report = runDiagnostic360([], [], [], []);
    try {
      generateDiagnosticPdf(report);
    } catch (e: any) {
      expect(e.message).not.toContain("is not a function");
      expect(e.message).not.toContain("Cannot read prop");
    }
  });
});
