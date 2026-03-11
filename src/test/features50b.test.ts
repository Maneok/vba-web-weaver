import { describe, it, expect } from "vitest";

import {
  parseCSV, parseClientCSV, exportClientsCSV,
  flattenClientRecord, detectDataInconsistencies, findClientDuplicates,
} from "../lib/dataImport";

import {
  calculatePortfolioStats, calculateCollabWorkload,
  analyzeScoreDistribution, calculateComplianceMetrics,
  generateComplianceSnapshot,
} from "../lib/portfolioAnalytics";

import {
  generateReviewSchedule, balanceWorkload,
  generateComplianceChecklist, findMandatoryActions,
  runAlertRules, DEFAULT_ALERT_RULES, calculateEscalationStatus,
} from "../lib/workflowEngine";

import {
  auditKycCompleteness, auditDocuments, findOrphanedAlerts,
  calculateDataQualityScore, generateNullabilityReport,
} from "../lib/auditEngine";

import {
  generateRiskScorecard, generateDossierChecklist,
  generateComplianceCertificate, generateScoreExplanation,
} from "../lib/reportUtils";

import type { Client, Collaborateur, AlerteRegistre } from "../lib/types";

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
    scoreActivite: 25, scorePays: 0, scoreMission: 10, scoreMaturite: 0,
    scoreStructure: 20, malus: 0, scoreGlobal: 11, nivVigilance: "SIMPLIFIEE",
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

function makeAlerte(overrides: Partial<AlerteRegistre> = {}): AlerteRegistre {
  return {
    date: "2024-01-01", clientConcerne: "CLI-26-001", categorie: "ADMIN : KYC Incomplet",
    details: "test", actionPrise: "", responsable: "D", qualification: "",
    statut: "EN COURS", dateButoir: "", typeDecision: "", validateur: "",
    ...overrides,
  };
}

// ======================================================================
// F1-F6: DATA IMPORT / CSV
// ======================================================================
describe("F1: parseCSV", () => {
  it("parses basic CSV", () => {
    const rows = parseCSV("a;b;c\n1;2;3\n4;5;6");
    expect(rows.length).toBe(3);
    expect(rows[0]).toEqual(["a", "b", "c"]);
  });
  it("handles quoted fields with semicolons", () => {
    const rows = parseCSV('a;"hello;world";c');
    expect(rows[0][1]).toBe("hello;world");
  });
  it("handles escaped quotes", () => {
    const rows = parseCSV('a;"say ""hello""";c');
    expect(rows[0][1]).toBe('say "hello"');
  });
  it("handles BOM", () => {
    const rows = parseCSV("\uFEFFa;b\n1;2");
    expect(rows[0][0]).toBe("a");
  });
  it("handles empty input", () => {
    expect(parseCSV("")).toEqual([]);
    expect(parseCSV(null as any)).toEqual([]);
  });
  it("handles CRLF line endings", () => {
    const rows = parseCSV("a;b\r\n1;2\r\n3;4");
    expect(rows.length).toBe(3);
  });
});

describe("F2: parseClientCSV", () => {
  it("parses client CSV with header mapping", () => {
    const csv = "raison_sociale;siren;ville\nACME;123456789;PARIS\nTEST;987654321;LYON";
    const result = parseClientCSV(csv);
    expect(result.data.length).toBe(2);
    expect(result.data[0].raisonSociale).toBe("ACME");
    expect(result.data[0].siren).toBe("123456789");
  });
  it("skips rows without raison sociale", () => {
    const csv = "raison_sociale;siren\n;123456789\nACME;987654321";
    const result = parseClientCSV(csv);
    expect(result.data.length).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.skipped).toBe(1);
  });
  it("parses numeric fields", () => {
    const csv = "raison_sociale;capital;honoraires\nACME;10000;5 000,50";
    const result = parseClientCSV(csv);
    expect(result.data[0].capital).toBe(10000);
    expect(result.data[0].honoraires).toBe(5000.5);
  });
  it("handles empty CSV", () => {
    const result = parseClientCSV("");
    expect(result.errors.length).toBe(1);
  });
});

describe("F3: exportClientsCSV", () => {
  it("exports with BOM and semicolons", () => {
    const csv = exportClientsCSV([makeClient()]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain(";");
    expect(csv).toContain("TEST SARL");
  });
  it("exports custom fields", () => {
    const csv = exportClientsCSV([makeClient()], ["ref", "raisonSociale"]);
    expect(csv).toContain("ref;raisonSociale");
  });
});

describe("F4: flattenClientRecord", () => {
  it("flattens to snake_case keys", () => {
    const flat = flattenClientRecord(makeClient());
    expect(flat.raison_sociale).toBe("TEST SARL");
    expect(flat.score_global).toBe(11);
    expect(flat.vigilance).toBe("SIMPLIFIEE");
  });
});

describe("F5: detectDataInconsistencies", () => {
  it("detects vigilance incoherence", () => {
    const issues = detectDataInconsistencies([makeClient({ nivVigilance: "SIMPLIFIEE", ppe: "OUI" })]);
    expect(issues.some(i => i.type === "VIGILANCE_INCOHERENCE")).toBe(true);
  });
  it("detects missing honoraires on VALIDE", () => {
    const issues = detectDataInconsistencies([makeClient({ honoraires: 0 })]);
    expect(issues.some(i => i.type === "HONORAIRES_MANQUANTS")).toBe(true);
  });
  it("clean client has no issues", () => {
    expect(detectDataInconsistencies([makeClient()])).toEqual([]);
  });
});

describe("F6: findClientDuplicates", () => {
  it("finds SIREN duplicates", () => {
    const dups = findClientDuplicates([
      makeClient({ ref: "C1", siren: "123 456 789" }),
      makeClient({ ref: "C2", siren: "123456789" }),
    ]);
    expect(dups.length).toBe(1);
    expect(dups[0].confidence).toBeGreaterThan(0.9);
  });
  it("finds name duplicates", () => {
    const dups = findClientDuplicates([
      makeClient({ ref: "C1", raisonSociale: "ACME SAS", siren: "111222333" }),
      makeClient({ ref: "C2", raisonSociale: "ACME SAS", siren: "444555666" }),
    ]);
    expect(dups.length).toBe(1);
  });
  it("no duplicates in unique set", () => {
    expect(findClientDuplicates([
      makeClient({ ref: "C1", siren: "111222333", raisonSociale: "A" }),
      makeClient({ ref: "C2", siren: "444555666", raisonSociale: "B" }),
    ])).toEqual([]);
  });
});

// ======================================================================
// F7-F11: PORTFOLIO ANALYTICS
// ======================================================================
describe("F7: calculatePortfolioStats", () => {
  it("calculates basic stats", () => {
    const stats = calculatePortfolioStats([
      makeClient({ scoreGlobal: 20 }),
      makeClient({ ref: "C2", scoreGlobal: 60 }),
      makeClient({ ref: "C3", scoreGlobal: 80 }),
    ]);
    expect(stats.actifs).toBe(3);
    expect(stats.scoreMoyen).toBeCloseTo(53.3, 0);
    expect(stats.scoreMin).toBe(20);
    expect(stats.scoreMax).toBe(80);
    expect(stats.quartiles[1]).toBe(60); // median
  });
  it("handles empty portfolio", () => {
    const stats = calculatePortfolioStats([]);
    expect(stats.totalClients).toBe(0);
    expect(stats.scoreMoyen).toBe(0);
  });
  it("counts vigilance repartition", () => {
    const stats = calculatePortfolioStats([
      makeClient({ nivVigilance: "SIMPLIFIEE" }),
      makeClient({ ref: "C2", nivVigilance: "RENFORCEE" }),
    ]);
    expect(stats.repartitionVigilance.SIMPLIFIEE).toBe(1);
    expect(stats.repartitionVigilance.RENFORCEE).toBe(1);
  });
});

describe("F8: calculateCollabWorkload", () => {
  it("distributes workload by comptable", () => {
    const workload = calculateCollabWorkload([
      makeClient({ comptable: "MAGALIE" }),
      makeClient({ ref: "C2", comptable: "MAGALIE" }),
      makeClient({ ref: "C3", comptable: "JULIEN" }),
    ], [makeCollab({ nom: "MAGALIE" }), makeCollab({ nom: "JULIEN" })]);
    const magalie = workload.find(w => w.nom === "MAGALIE");
    expect(magalie?.clientCount).toBe(2);
  });
});

describe("F9: analyzeScoreDistribution", () => {
  it("creates 6 buckets", () => {
    const result = analyzeScoreDistribution([
      makeClient({ scoreGlobal: 10 }),
      makeClient({ ref: "C2", scoreGlobal: 50 }),
      makeClient({ ref: "C3", scoreGlobal: 90 }),
    ]);
    expect(result.buckets.length).toBe(6);
    expect(result.concentration).toBeGreaterThan(0);
  });
  it("handles empty clients", () => {
    const result = analyzeScoreDistribution([]);
    expect(result.buckets.every(b => b.count === 0)).toBe(true);
  });
});

describe("F10: calculateComplianceMetrics", () => {
  it("calculates composite score", () => {
    const metrics = calculateComplianceMetrics(
      [makeClient()],
      [makeCollab({ statutFormation: "A JOUR" })],
      [],
    );
    expect(metrics.tauxFormation).toBe(100);
    expect(metrics.scoreConformite).toBeGreaterThan(0);
    expect(metrics.scoreConformite).toBeLessThanOrEqual(100);
  });
  it("counts open alerts", () => {
    const metrics = calculateComplianceMetrics([], [], [makeAlerte()]);
    expect(metrics.alertesOuvertes).toBe(1);
  });
});

describe("F11: generateComplianceSnapshot", () => {
  it("generates point-in-time snapshot", () => {
    const snap = generateComplianceSnapshot([makeClient()], "Cabinet Test");
    expect(snap.cabinet).toBe("Cabinet Test");
    expect(snap.totalClients).toBe(1);
    expect(snap.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ======================================================================
// F12-F18: WORKFLOW ENGINE
// ======================================================================
describe("F12: generateReviewSchedule", () => {
  it("sorts by urgency (retard first)", () => {
    const schedule = generateReviewSchedule([
      makeClient({ ref: "C1", dateButoir: "2099-01-01" }),
      makeClient({ ref: "C2", dateButoir: "2020-01-01" }),
    ]);
    expect(schedule[0].priority).toBe("retard");
    expect(schedule[0].clientRef).toBe("C2");
  });
  it("assigns priority levels correctly", () => {
    const soon = new Date(); soon.setDate(soon.getDate() + 15);
    const schedule = generateReviewSchedule([
      makeClient({ dateButoir: soon.toISOString().split("T")[0] }),
    ]);
    expect(schedule[0].priority).toBe("urgent");
  });
});

describe("F13: balanceWorkload", () => {
  it("distributes evenly", () => {
    const assignments = balanceWorkload(
      [makeClient({ ref: "C1" }), makeClient({ ref: "C2" }), makeClient({ ref: "C3" })],
      [makeCollab({ nom: "A" }), makeCollab({ nom: "B" })],
      new Map([["A", 0], ["B", 0]]),
    );
    expect(assignments.length).toBe(3);
    const countA = assignments.filter(a => a.assignedTo === "A").length;
    const countB = assignments.filter(a => a.assignedTo === "B").length;
    expect(Math.abs(countA - countB)).toBeLessThanOrEqual(1);
  });
  it("handles no collabs", () => {
    expect(balanceWorkload([makeClient()], [], new Map())).toEqual([]);
  });
});

describe("F14: generateComplianceChecklist", () => {
  it("generates checklist items", () => {
    const checklist = generateComplianceChecklist(makeClient());
    expect(checklist.length).toBeGreaterThan(5);
    expect(checklist.every(i => i.categorie && i.action)).toBe(true);
  });
  it("adds RENFORCEE items for high-risk", () => {
    const checklist = generateComplianceChecklist(makeClient({ nivVigilance: "RENFORCEE" }));
    const renfItems = checklist.filter(i => i.categorie === "VIGILANCE RENFORCEE");
    expect(renfItems.length).toBeGreaterThan(0);
  });
  it("marks present docs as fait", () => {
    const checklist = generateComplianceChecklist(makeClient({ lienKbis: "link" }));
    const kbis = checklist.find(i => i.action.includes("KBIS"));
    expect(kbis?.statut).toBe("fait");
  });
});

describe("F15: findMandatoryActions", () => {
  it("finds expired CNI actions", () => {
    const actions = findMandatoryActions([makeClient({ dateExpCni: "2020-01-01" })]);
    expect(actions.some(a => a.action.includes("CNI"))).toBe(true);
    expect(actions[0].urgence).toBe("critique");
  });
  it("finds overdue reviews", () => {
    const actions = findMandatoryActions([makeClient({ dateButoir: "2020-01-01" })]);
    expect(actions.some(a => a.action.includes("revue"))).toBe(true);
  });
  it("sorted by urgency", () => {
    const actions = findMandatoryActions([
      makeClient({ dateExpCni: "2020-01-01", be: "", lienKbis: "", lienStatuts: "" }),
    ]);
    const urgenceOrder = { critique: 0, haute: 1, moyenne: 2 };
    for (let i = 1; i < actions.length; i++) {
      expect(urgenceOrder[actions[i].urgence]).toBeGreaterThanOrEqual(urgenceOrder[actions[i - 1].urgence]);
    }
  });
});

describe("F16: runAlertRules", () => {
  it("creates alerts for matching rules", () => {
    const alerts = runAlertRules(
      [makeClient({ dateExpCni: "2020-01-01", dateButoir: "2020-01-01" })],
      DEFAULT_ALERT_RULES,
    );
    expect(alerts.length).toBeGreaterThan(0);
  });
  it("skips existing alerts", () => {
    const existing = [makeAlerte({ clientConcerne: "CLI-26-001", categorie: "ADMIN : KYC Incomplet" })];
    const alerts = runAlertRules(
      [makeClient({ dateExpCni: "2020-01-01" })],
      DEFAULT_ALERT_RULES,
      existing,
    );
    // CNI expiree rule uses "ADMIN : KYC Incomplet" category, should be skipped
    const cniAlerts = alerts.filter(a => a.rule === "CNI expiree");
    expect(cniAlerts.length).toBe(0);
  });
  it("skips INACTIF clients", () => {
    const alerts = runAlertRules([makeClient({ statut: "INACTIF", dateExpCni: "2020-01-01" })]);
    expect(alerts.length).toBe(0);
  });
});

describe("F17: calculateEscalationStatus", () => {
  it("overdue alert gets escalation level", () => {
    const result = calculateEscalationStatus(makeAlerte({ dateButoir: "2020-01-01" }));
    expect(result.isOverdue).toBe(true);
    expect(result.escalationLevel).toBe(3);
  });
  it("non-overdue = level 0", () => {
    const result = calculateEscalationStatus(makeAlerte({ dateButoir: "2099-01-01" }));
    expect(result.isOverdue).toBe(false);
    expect(result.escalationLevel).toBe(0);
  });
  it("closed alert = level 0", () => {
    const result = calculateEscalationStatus(makeAlerte({ statut: "CLOTURE", dateButoir: "2020-01-01" }));
    expect(result.escalationLevel).toBe(0);
  });
});

describe("F18: alert escalation levels", () => {
  it("1-14 days = level 1", () => {
    const d = new Date(); d.setDate(d.getDate() - 5);
    const result = calculateEscalationStatus(makeAlerte({ dateButoir: d.toISOString().split("T")[0] }));
    expect(result.escalationLevel).toBe(1);
  });
  it("15-30 days = level 2", () => {
    const d = new Date(); d.setDate(d.getDate() - 20);
    const result = calculateEscalationStatus(makeAlerte({ dateButoir: d.toISOString().split("T")[0] }));
    expect(result.escalationLevel).toBe(2);
  });
});

// ======================================================================
// F19-F24: AUDIT ENGINE
// ======================================================================
describe("F19: auditKycCompleteness", () => {
  it("complete client = complet", () => {
    const result = auditKycCompleteness([makeClient()]);
    expect(result.stats.complets).toBe(1);
    expect(result.stats.taux).toBe(100);
  });
  it("missing fields = findings", () => {
    const result = auditKycCompleteness([makeClient({ siren: "", mail: "", ape: "", be: "" })]);
    expect(result.findings.length).toBe(1);
    expect(result.stats.complets).toBe(0);
  });
  it("ignores INACTIF", () => {
    const result = auditKycCompleteness([makeClient({ statut: "INACTIF", siren: "" })]);
    expect(result.findings.length).toBe(0);
  });
});

describe("F20: auditDocuments", () => {
  it("detects expired CNI", () => {
    const result = auditDocuments([makeClient({ dateExpCni: "2020-01-01" })]);
    expect(result.stats.cniExpirees).toBe(1);
    expect(result.findings.some(f => f.severity === "critique")).toBe(true);
  });
  it("counts missing documents", () => {
    const result = auditDocuments([makeClient({ lienKbis: "", lienStatuts: "" })]);
    expect(result.stats.kbisManquants).toBe(1);
    expect(result.stats.statutsManquants).toBe(1);
  });
});

describe("F21: findOrphanedAlerts", () => {
  it("finds orphaned alerts", () => {
    const refs = new Set(["CLI-26-001"]);
    const orphans = findOrphanedAlerts([makeAlerte({ clientConcerne: "CLI-DELETED" })], refs);
    expect(orphans.length).toBe(1);
  });
  it("no orphans when all refs exist", () => {
    const refs = new Set(["CLI-26-001"]);
    expect(findOrphanedAlerts([makeAlerte()], refs).length).toBe(0);
  });
});

describe("F22: calculateDataQualityScore", () => {
  it("returns score 0-100", () => {
    const result = calculateDataQualityScore([makeClient()]);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
  it("higher for complete clients", () => {
    const good = calculateDataQualityScore([makeClient()]);
    const bad = calculateDataQualityScore([makeClient({
      siren: "", mail: "", adresse: "", dirigeant: "",
      dateExpCni: "2020-01-01", dateButoir: "2020-01-01",
    })]);
    expect(good.score).toBeGreaterThan(bad.score);
  });
  it("has 3 dimensions", () => {
    const result = calculateDataQualityScore([makeClient()]);
    expect(result.details.length).toBe(3);
  });
});

describe("F23: generateNullabilityReport", () => {
  it("reports missing fields sorted by frequency", () => {
    const report = generateNullabilityReport([
      makeClient({ lienStatuts: "", lienCni: "", iban: "" }),
    ]);
    expect(report.length).toBeGreaterThan(0);
    expect(report[0].percentage).toBeGreaterThanOrEqual(report[report.length - 1].percentage);
  });
  it("100% for fields present on all clients", () => {
    const report = generateNullabilityReport([makeClient()]);
    const raisonSociale = report.find(r => r.field === "raisonSociale");
    expect(raisonSociale?.percentage).toBe(0); // 0% missing
  });
});

describe("F24: empty portfolio audit", () => {
  it("handles empty arrays gracefully", () => {
    expect(auditKycCompleteness([]).stats.total).toBe(0);
    expect(auditDocuments([]).findings.length).toBe(0);
    expect(calculateDataQualityScore([]).score).toBe(0);
    expect(generateNullabilityReport([]).length).toBeGreaterThan(0);
  });
});

// ======================================================================
// F25-F34: REPORT UTILS
// ======================================================================
describe("F25: generateRiskScorecard", () => {
  it("generates 5 axes", () => {
    const card = generateRiskScorecard(makeClient());
    expect(card.axes.length).toBe(5);
    expect(card.axes.every(a => a.percentage >= 0 && a.percentage <= 100)).toBe(true);
  });
  it("includes malus breakdown", () => {
    const card = generateRiskScorecard(makeClient({ cash: "OUI" }));
    const cashMalus = card.malus.find(m => m.label.includes("Cash"));
    expect(cashMalus?.actif).toBe(true);
  });
  it("generates recommendations for RENFORCEE", () => {
    const card = generateRiskScorecard(makeClient({ nivVigilance: "RENFORCEE" }));
    expect(card.recommandations.some(r => r.includes("renforcee"))).toBe(true);
  });
});

describe("F26: generateDossierChecklist", () => {
  it("returns checklist items", () => {
    const items = generateDossierChecklist(makeClient());
    expect(items.length).toBeGreaterThan(5);
  });
  it("marks KBIS as ok when present", () => {
    const items = generateDossierChecklist(makeClient({ lienKbis: "link" }));
    const kbis = items.find(i => i.document.includes("KBIS"));
    expect(kbis?.statut).toBe("ok");
  });
  it("marks expired CNI", () => {
    const items = generateDossierChecklist(makeClient({ dateExpCni: "2020-01-01" }));
    const cni = items.find(i => i.document.includes("identite"));
    expect(cni?.statut).toBe("expire");
  });
  it("marks soon-expiring CNI", () => {
    const soon = new Date(); soon.setDate(soon.getDate() + 30);
    const items = generateDossierChecklist(makeClient({ dateExpCni: soon.toISOString().split("T")[0] }));
    const cni = items.find(i => i.document.includes("identite"));
    expect(cni?.statut).toBe("bientot_expire");
  });
});

describe("F27: generateComplianceCertificate", () => {
  it("generates certificate for compliant client", () => {
    const cert = generateComplianceCertificate(makeClient(), "Cabinet X", "M. Expert");
    expect(cert.numero).toContain("CERT");
    expect(cert.cabinetName).toBe("Cabinet X");
    expect(cert.checklistResults.length).toBeGreaterThan(0);
  });
  it("conclusion is conforme for complete client", () => {
    const cert = generateComplianceCertificate(makeClient(), "C", "E");
    expect(cert.conclusion).toBe("conforme");
  });
  it("conclusion is non_conforme for incomplete client", () => {
    const cert = generateComplianceCertificate(
      makeClient({ siren: "", be: "", lienKbis: "", lienStatuts: "", dateExpCni: "2020-01-01", dateButoir: "2020-01-01", scoreGlobal: 0 }),
      "C", "E",
    );
    expect(cert.conclusion).toBe("non_conforme");
  });
  it("prochainExamen is in the future", () => {
    const cert = generateComplianceCertificate(makeClient(), "C", "E");
    expect(new Date(cert.prochainExamen) > new Date()).toBe(true);
  });
});

describe("F28: generateScoreExplanation", () => {
  it("returns 6 factors", () => {
    const exp = generateScoreExplanation(makeClient());
    expect(exp.length).toBe(6);
  });
  it("each factor has label, score, explanation", () => {
    const exp = generateScoreExplanation(makeClient());
    for (const f of exp) {
      expect(f.facteur).toBeTruthy();
      expect(typeof f.score).toBe("number");
      expect(f.explication).toBeTruthy();
    }
  });
});

// ======================================================================
// F29-F34: INTEGRATION & EDGE CASES
// ======================================================================
describe("F29: portfolio with diverse clients", () => {
  const portfolio = [
    makeClient({ ref: "C1", scoreGlobal: 10, nivVigilance: "SIMPLIFIEE", honoraires: 3000, comptable: "A" }),
    makeClient({ ref: "C2", scoreGlobal: 45, nivVigilance: "STANDARD", honoraires: 8000, comptable: "A" }),
    makeClient({ ref: "C3", scoreGlobal: 80, nivVigilance: "RENFORCEE", honoraires: 15000, comptable: "B" }),
    makeClient({ ref: "C4", scoreGlobal: 100, nivVigilance: "RENFORCEE", ppe: "OUI", honoraires: 25000, comptable: "B" }),
  ];

  it("portfolio stats include all clients", () => {
    const stats = calculatePortfolioStats(portfolio);
    expect(stats.actifs).toBe(4);
    expect(stats.totalHonoraires).toBe(51000);
  });
  it("workload split by comptable", () => {
    const workload = calculateCollabWorkload(portfolio, [makeCollab({ nom: "A" }), makeCollab({ nom: "B" })]);
    expect(workload.length).toBe(2);
  });
  it("score distribution detects spread", () => {
    const dist = analyzeScoreDistribution(portfolio);
    const nonEmpty = dist.buckets.filter(b => b.count > 0);
    expect(nonEmpty.length).toBeGreaterThan(1);
  });
});

describe("F30: review schedule with mixed deadlines", () => {
  it("correct priority assignment", () => {
    const past = "2020-01-01";
    const soon = new Date(); soon.setDate(soon.getDate() + 20);
    const future = "2099-01-01";
    const schedule = generateReviewSchedule([
      makeClient({ ref: "C1", dateButoir: past }),
      makeClient({ ref: "C2", dateButoir: soon.toISOString().split("T")[0] }),
      makeClient({ ref: "C3", dateButoir: future }),
    ]);
    expect(schedule[0].priority).toBe("retard");
    expect(schedule[1].priority).toBe("urgent");
    expect(schedule[2].priority).toBe("normal");
  });
});

describe("F31: compliance checklist varies by vigilance", () => {
  it("SIMPLIFIEE has fewer items than RENFORCEE", () => {
    const simple = generateComplianceChecklist(makeClient({ nivVigilance: "SIMPLIFIEE" }));
    const renf = generateComplianceChecklist(makeClient({ nivVigilance: "RENFORCEE" }));
    expect(renf.length).toBeGreaterThan(simple.length);
  });
});

describe("F32: data quality with inconsistencies", () => {
  it("detects vigilance mismatch as inconsistency", () => {
    const result = calculateDataQualityScore([
      makeClient({ nivVigilance: "SIMPLIFIEE", ppe: "OUI" }),
    ]);
    expect(result.consistency).toBeLessThan(100);
  });
});

describe("F33: nullability report ranks fields", () => {
  it("most missing fields first", () => {
    const clients = [
      makeClient({ lienCni: "", lienStatuts: "" }),
      makeClient({ ref: "C2", lienCni: "", lienStatuts: "" }),
    ];
    const report = generateNullabilityReport(clients);
    const cniIdx = report.findIndex(r => r.field === "lienCni");
    const sirenIdx = report.findIndex(r => r.field === "siren");
    expect(report[cniIdx].percentage).toBeGreaterThan(report[sirenIdx].percentage);
  });
});

describe("F34: certificate conclusion logic", () => {
  it("reserve for partially compliant", () => {
    const cert = generateComplianceCertificate(
      makeClient({ siren: "", be: "" }), "C", "E",
    );
    expect(cert.conclusion).toBe("reserve");
  });
});

// ======================================================================
// F35-F40: CROSS-MODULE INTEGRATION
// ======================================================================
describe("F35: full audit pipeline", () => {
  it("KYC + docs + quality combined", () => {
    const clients = [makeClient(), makeClient({ ref: "C2", siren: "", dateExpCni: "2020-01-01" })];
    const kyc = auditKycCompleteness(clients);
    const docs = auditDocuments(clients);
    const quality = calculateDataQualityScore(clients);
    expect(kyc.stats.total).toBe(2);
    expect(docs.stats.cniExpirees).toBe(1);
    expect(quality.score).toBeGreaterThan(0);
  });
});

describe("F36: workflow + alert automation", () => {
  it("mandatory actions align with alert rules", () => {
    const client = makeClient({ dateExpCni: "2020-01-01", dateButoir: "2020-01-01" });
    const actions = findMandatoryActions([client]);
    const alerts = runAlertRules([client]);
    expect(actions.length).toBeGreaterThan(0);
    expect(alerts.length).toBeGreaterThan(0);
  });
});

describe("F37: export → import roundtrip", () => {
  it("export then parse preserves data", () => {
    const original = [makeClient()];
    const csv = exportClientsCSV(original, ["raisonSociale", "siren", "ville"]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(2); // header + 1 row (after BOM)
    expect(lines[1]).toContain("TEST SARL");
  });
});

describe("F38: scorecard for different risk profiles", () => {
  it("high-risk client has more recommendations", () => {
    const low = generateRiskScorecard(makeClient());
    const high = generateRiskScorecard(makeClient({
      nivVigilance: "RENFORCEE", ppe: "OUI", be: "", lienKbis: "", dateExpCni: "2020-01-01",
    }));
    expect(high.recommandations.length).toBeGreaterThan(low.recommandations.length);
  });
});

describe("F39: checklist document status detection", () => {
  it("missing BE marked as manquant", () => {
    const items = generateDossierChecklist(makeClient({ be: "" }));
    const be = items.find(i => i.document.includes("beneficiaires"));
    expect(be?.statut).toBe("manquant");
  });
  it("present SIREN marked as ok", () => {
    const items = generateDossierChecklist(makeClient());
    const siren = items.find(i => i.document.includes("SIREN"));
    expect(siren?.statut).toBe("ok");
  });
});

describe("F40: compliance metrics with empty data", () => {
  it("returns zeros for empty inputs", () => {
    const metrics = calculateComplianceMetrics([], [], []);
    expect(metrics.tauxFormation).toBe(0);
    expect(metrics.tauxKycComplet).toBe(0);
    expect(metrics.scoreConformite).toBe(0);
  });
});

// ======================================================================
// F41-F50: ADVANCED SCENARIOS
// ======================================================================
describe("F41: large portfolio analytics", () => {
  const largePorfolio = Array.from({ length: 50 }, (_, i) =>
    makeClient({ ref: `CLI-${i}`, scoreGlobal: i * 2.4, siren: String(100000000 + i) }),
  );
  it("handles 50 clients", () => {
    const stats = calculatePortfolioStats(largePorfolio);
    expect(stats.actifs).toBe(50);
    expect(stats.ecartType).toBeGreaterThan(0);
  });
  it("distribution has multiple buckets", () => {
    const dist = analyzeScoreDistribution(largePorfolio);
    expect(dist.buckets.filter(b => b.count > 0).length).toBeGreaterThan(3);
  });
});

describe("F42: duplicate detection edge cases", () => {
  it("ignores empty SIREN but still detects name duplicates", () => {
    const dups = findClientDuplicates([
      makeClient({ ref: "C1", siren: "" }),
      makeClient({ ref: "C2", siren: "" }),
    ]);
    expect(dups.length).toBe(1);
  });
  it("ignores short names", () => {
    const dups = findClientDuplicates([
      makeClient({ ref: "C1", raisonSociale: "AB", siren: "111" }),
      makeClient({ ref: "C2", raisonSociale: "AB", siren: "222" }),
    ]);
    expect(dups.length).toBe(0); // name too short for reliable match
  });
});

describe("F43: workload balancing with existing load", () => {
  it("assigns to least loaded collaborateur", () => {
    const assignments = balanceWorkload(
      [makeClient({ ref: "NEW" })],
      [makeCollab({ nom: "A" }), makeCollab({ nom: "B" })],
      new Map([["A", 10], ["B", 2]]),
    );
    expect(assignments[0].assignedTo).toBe("B");
  });
});

describe("F44: alert rules with PPE client", () => {
  it("detects PPE without RENFORCEE", () => {
    const alerts = runAlertRules([makeClient({ ppe: "OUI", nivVigilance: "STANDARD" })]);
    expect(alerts.some(a => a.rule.includes("PPE"))).toBe(true);
  });
});

describe("F45: dossier checklist IBAN field", () => {
  it("IBAN marked ok when present", () => {
    const items = generateDossierChecklist(makeClient({ iban: "FR7630006000011234567890189" }));
    const iban = items.find(i => i.document.includes("IBAN"));
    expect(iban?.statut).toBe("ok");
  });
});

describe("F46: compliance certificate numbering", () => {
  it("includes year and client ref", () => {
    const cert = generateComplianceCertificate(makeClient({ ref: "CLI-42" }), "C", "E");
    expect(cert.numero).toContain(String(new Date().getFullYear()));
    expect(cert.numero).toContain("CLI-42");
  });
});

describe("F47: score explanation completeness", () => {
  it("shows PPE status when active", () => {
    const exp = generateScoreExplanation(makeClient({ ppe: "OUI", paysRisque: "OUI" }));
    const pays = exp.find(f => f.facteur.includes("Pays"));
    expect(pays?.valeur).toContain("Risque");
  });
});

describe("F48: compliance snapshot with retard", () => {
  it("counts overdue clients", () => {
    const snap = generateComplianceSnapshot([
      makeClient({ dateButoir: "2020-01-01" }),
      makeClient({ ref: "C2", dateButoir: "2099-01-01" }),
    ], "Test");
    expect(snap.clientsEnRetard).toBe(1);
  });
});

describe("F49: audit findings severity levels", () => {
  it("many missing fields = critique", () => {
    const result = auditKycCompleteness([
      makeClient({ siren: "", mail: "", adresse: "", dirigeant: "", ape: "", be: "" }),
    ]);
    expect(result.findings[0].severity).toBe("critique");
  });
  it("few missing fields = mineur", () => {
    const result = auditKycCompleteness([makeClient({ tel: "" })]);
    expect(result.findings[0].severity).toBe("mineur");
  });
});

describe("F50: end-to-end compliance assessment", () => {
  it("complete assessment pipeline", () => {
    const clients = [
      makeClient({ ref: "C1", scoreGlobal: 20, nivVigilance: "SIMPLIFIEE" }),
      makeClient({ ref: "C2", scoreGlobal: 80, nivVigilance: "RENFORCEE", ppe: "OUI" }),
    ];
    const collabs = [makeCollab({ referentLcb: true, statutFormation: "A JOUR" })];
    const alertes = [makeAlerte({ clientConcerne: "C2", statut: "EN COURS" })];

    // 1. Portfolio stats
    const stats = calculatePortfolioStats(clients);
    expect(stats.actifs).toBe(2);

    // 2. Compliance metrics
    const metrics = calculateComplianceMetrics(clients, collabs, alertes);
    expect(metrics.scoreConformite).toBeGreaterThan(0);

    // 3. Review schedule
    const schedule = generateReviewSchedule(clients);
    expect(schedule.length).toBe(2);

    // 4. Data quality
    const quality = calculateDataQualityScore(clients);
    expect(quality.score).toBeGreaterThan(0);

    // 5. Generate reports
    const scorecard = generateRiskScorecard(clients[1]);
    expect(scorecard.nivVigilance).toBe("RENFORCEE");

    const cert = generateComplianceCertificate(clients[0], "Cabinet", "Expert");
    expect(cert.conclusion).toBeDefined();

    // 6. Mandatory actions
    const actions = findMandatoryActions(clients);
    expect(Array.isArray(actions)).toBe(true);

    // 7. Alert automation
    const newAlerts = runAlertRules(clients, DEFAULT_ALERT_RULES, alertes);
    expect(Array.isArray(newAlerts)).toBe(true);
  });
});
