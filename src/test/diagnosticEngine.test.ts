import { describe, it, expect } from "vitest";
import { runDiagnostic360, THRESHOLDS, type DiagnosticReport } from "../lib/diagnosticEngine";
import type { Client, Collaborateur, AlerteRegistre, LogEntry } from "../lib/types";

// ---------------------------------------------------------------------------
// Helpers to create test fixtures
// ---------------------------------------------------------------------------
function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    ref: "CLI-26-001",
    etat: "VALIDE",
    comptable: "Dupont",
    mission: "TENUE COMPTABLE",
    raisonSociale: "Test SARL",
    forme: "SARL",
    adresse: "1 rue Test",
    cp: "75001",
    ville: "Paris",
    siren: "123456789",
    capital: 10000,
    ape: "56.10A",
    dirigeant: "Jean Test",
    domaine: "Restauration",
    effectif: "3 A 5 SALARIES",
    tel: "0102030405",
    mail: "test@example.com",
    dateCreation: "2015-01-01",
    dateReprise: "2020-01-01",
    honoraires: 5000,
    reprise: 0,
    juridique: 0,
    frequence: "MENSUEL",
    iban: "FR7630006000011234567890189",
    bic: "BNPAFRPP",
    associe: "Martin",
    superviseur: "Durand",
    ppe: "NON",
    paysRisque: "NON",
    atypique: "NON",
    distanciel: "NON",
    cash: "NON",
    pression: "NON",
    scoreActivite: 30,
    scorePays: 0,
    scoreMission: 10,
    scoreMaturite: 20,
    scoreStructure: 20,
    malus: 0,
    scoreGlobal: 30,
    nivVigilance: "STANDARD",
    dateCreationLigne: "2024-01-01",
    dateDerniereRevue: "2025-12-01",
    dateButoir: "2027-01-01",
    etatPilotage: "A JOUR",
    dateExpCni: "2030-01-01",
    statut: "ACTIF",
    be: "Jean Test (100%)",
    ...overrides,
  };
}

function makeCollaborateur(overrides: Partial<Collaborateur> = {}): Collaborateur {
  return {
    nom: "Dupont",
    fonction: "Expert-comptable",
    referentLcb: false,
    suppleant: "",
    niveauCompetence: "SENIOR",
    dateSignatureManuel: "2024-01-01",
    derniereFormation: "2024-06-01",
    statutFormation: "A JOUR",
    email: "dupont@cabinet.fr",
    ...overrides,
  };
}

function makeAlerte(overrides: Partial<AlerteRegistre> = {}): AlerteRegistre {
  return {
    date: "2025-01-01",
    clientConcerne: "Test SARL",
    categorie: "SCORING",
    details: "Anomalie detectee",
    actionPrise: "Revue effectuee",
    responsable: "Dupont",
    qualification: "SOUPCON",
    statut: "CLOS",
    dateButoir: "2025-03-01",
    typeDecision: "CLASSEMENT",
    validateur: "Martin",
    ...overrides,
  };
}

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    horodatage: "2025-12-01 10:00:00",
    utilisateur: "Dupont",
    refClient: "CLI-26-001",
    typeAction: "SCORING",
    details: "Calcul scoring",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("diagnosticEngine - runDiagnostic360", () => {
  // === Report structure ===
  it("should return a valid report structure", () => {
    const report = runDiagnostic360([], [], [], []);
    expect(report).toHaveProperty("dateGeneration");
    expect(report).toHaveProperty("scoreGlobalDispositif");
    expect(report).toHaveProperty("noteLettre");
    expect(report).toHaveProperty("items");
    expect(report).toHaveProperty("synthese");
    expect(report).toHaveProperty("syntheseSimple");
    expect(report).toHaveProperty("recommandationsPrioritaires");
    expect(report).toHaveProperty("categoryStats");
    expect(report).toHaveProperty("totalClients");
    expect(report).toHaveProperty("totalCollaborateurs");
    expect(report).toHaveProperty("totalAlertes");
  });

  it("should handle empty data gracefully", () => {
    const report = runDiagnostic360([], [], [], []);
    expect(report.items.length).toBeGreaterThan(0);
    expect(report.noteLettre).toMatch(/^[A-D]$/);
    expect(report.totalClients).toBe(0);
  });

  it("should generate proper dateGeneration", () => {
    const report = runDiagnostic360([], [], [], []);
    expect(report.dateGeneration).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // === SIREN validation ===
  it("should detect SIREN format issues", () => {
    const clients = [makeClient({ siren: "ABC" })];
    const report = runDiagnostic360(clients, [], [], []);
    const sirenItem = report.items.find(i => i.indicateur.includes("SIREN invalide"));
    expect(sirenItem).toBeDefined();
    expect(sirenItem?.statut).not.toBe("OK");
  });

  it("should not flag valid 9-digit SIREN", () => {
    const clients = [makeClient({ siren: "123456789" })];
    const report = runDiagnostic360(clients, [], [], []);
    const sirenItem = report.items.find(i => i.indicateur.includes("SIREN invalide"));
    expect(sirenItem).toBeUndefined();
  });

  // === PPE ===
  it("should detect PPE clients without reinforced vigilance", () => {
    const clients = [makeClient({ ppe: "OUI", nivVigilance: "STANDARD" })];
    const report = runDiagnostic360(clients, [], [], []);
    const ppeItem = report.items.find(i => i.indicateur.includes("PPE"));
    expect(ppeItem).toBeDefined();
  });

  // === Scoring coherence ===
  it("should detect scoring incoherence (SIMPLIFIEE + risk factors)", () => {
    const clients = [makeClient({ nivVigilance: "SIMPLIFIEE", ppe: "OUI" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("Coherence vigilance"));
    expect(item).toBeDefined();
    expect(item?.statut).toBe("CRITIQUE");
  });

  // === Classification ===
  it("should mark classification as OK when all clients are validated", () => {
    const clients = [makeClient({ etat: "VALIDE", statut: "ACTIF" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("classifies"));
    expect(item).toBeDefined();
    expect(item?.statut).toBe("OK");
  });

  // === Revisions ===
  it("should detect overdue revisions", () => {
    const clients = [makeClient({ dateButoir: "2020-01-01" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("retard"));
    expect(item).toBeDefined();
    expect(item?.statut).not.toBe("OK");
  });

  // === KYC ===
  it("should detect expired CNI", () => {
    const clients = [makeClient({ dateExpCni: "2020-01-01" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("perimees"));
    expect(item?.statut).toBe("CRITIQUE");
  });

  it("should detect missing beneficiaires effectifs", () => {
    const clients = [makeClient({ be: "" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("Beneficiaires"));
    expect(item?.statut).not.toBe("OK");
  });

  it("should detect missing IBAN", () => {
    const clients = [makeClient({ iban: "" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("IBAN"));
    expect(item).toBeDefined();
  });

  it("should detect missing dirigeant", () => {
    const clients = [makeClient({ dirigeant: "" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("dirigeant"));
    expect(item).toBeDefined();
    expect(item?.statut).not.toBe("OK");
  });

  it("should detect invalid email format", () => {
    const clients = [makeClient({ mail: "not-an-email" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("email invalide"));
    expect(item).toBeDefined();
  });

  // === SIREN duplicates ===
  it("should detect duplicate SIREN", () => {
    const clients = [
      makeClient({ ref: "CLI-26-001", siren: "123456789" }),
      makeClient({ ref: "CLI-26-002", raisonSociale: "Test2", siren: "123456789" }),
    ];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("Doublons SIREN"));
    expect(item).toBeDefined();
    expect(item?.statut).toBe("ALERTE");
  });

  it("should not flag SIREN duplicates for invalid SIRENs", () => {
    const clients = [
      makeClient({ ref: "CLI-26-001", siren: "ABC" }),
      makeClient({ ref: "CLI-26-002", raisonSociale: "Test2", siren: "ABC" }),
    ];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("Doublons SIREN"));
    // Should not find duplicates because ABC is not a valid SIREN
    expect(item).toBeUndefined();
  });

  // === Gouvernance ===
  it("should detect missing referent LCB-FT", () => {
    const collabs = [makeCollaborateur({ referentLcb: false })];
    const report = runDiagnostic360([], collabs, [], []);
    const item = report.items.find(i => i.indicateur.includes("Referent"));
    expect(item?.statut).toBe("CRITIQUE");
  });

  it("should detect existing referent LCB-FT", () => {
    const collabs = [makeCollaborateur({ referentLcb: true })];
    const report = runDiagnostic360([], collabs, [], []);
    const item = report.items.find(i => i.indicateur.includes("Referent LCB-FT designe"));
    expect(item?.statut).toBe("OK");
  });

  it("should detect insufficient training rate", () => {
    const collabs = [
      makeCollaborateur({ nom: "A", statutFormation: "A FORMER" }),
      makeCollaborateur({ nom: "B", statutFormation: "A FORMER" }),
      makeCollaborateur({ nom: "C", statutFormation: "A JOUR" }),
    ];
    const report = runDiagnostic360([], collabs, [], []);
    const item = report.items.find(i => i.indicateur.includes("formation"));
    expect(item).toBeDefined();
    expect(item?.statut).not.toBe("OK");
  });

  // === Registre ===
  it("should detect alertes en retard", () => {
    const alertes = [makeAlerte({ statut: "EN COURS", dateButoir: "2020-01-01" })];
    const report = runDiagnostic360([], [], alertes, []);
    const item = report.items.find(i => i.indicateur.includes("Alertes en cours"));
    expect(item?.statut).toBe("CRITIQUE");
  });

  // === Category stats ===
  it("should compute category stats", () => {
    const clients = [makeClient()];
    const collabs = [makeCollaborateur({ referentLcb: true })];
    const report = runDiagnostic360(clients, collabs, [], []);
    expect(report.categoryStats.length).toBeGreaterThan(0);
    for (const cs of report.categoryStats) {
      expect(cs.total).toBe(cs.ok + cs.alerte + cs.critique);
      expect(cs.score).toBeGreaterThanOrEqual(0);
      expect(cs.score).toBeLessThanOrEqual(100);
    }
  });

  it("should sort categoryStats by weight (most important first)", () => {
    const clients = [makeClient()];
    const collabs = [makeCollaborateur({ referentLcb: true })];
    const report = runDiagnostic360(clients, collabs, [], []);
    // SCORING has weight 1.5, should come before CLASSIFICATION with weight 1.0
    const scoringIdx = report.categoryStats.findIndex(cs => cs.categorie === "SCORING");
    const classIdx = report.categoryStats.findIndex(cs => cs.categorie === "CLASSIFICATION");
    if (scoringIdx >= 0 && classIdx >= 0) {
      expect(scoringIdx).toBeLessThan(classIdx);
    }
  });

  it("should include categoryStats with meta field", () => {
    const clients = [makeClient()];
    const report = runDiagnostic360(clients, [makeCollaborateur({ referentLcb: true })], [], []);
    for (const cs of report.categoryStats) {
      expect(cs.meta).toBeDefined();
      expect(cs.meta.icon).toBeDefined();
      expect(cs.meta.description).toBeDefined();
      expect(cs.meta.positiveMessage).toBeDefined();
    }
  });

  // === Note assignment ===
  it("should assign note A for a well-configured cabinet", () => {
    const clients = [
      makeClient(),
      makeClient({ ref: "CLI-26-002", raisonSociale: "Test2 SAS", siren: "987654321" }),
    ];
    const collabs = [
      makeCollaborateur({ referentLcb: true, nom: "Referent" }),
      makeCollaborateur({ suppleant: "Referent", nom: "Suppleant" }),
    ];
    const logs = Array.from({ length: 15 }, (_, i) =>
      makeLog({
        typeAction: ["SCORING", "SCREENING", "REVUE", "ALERTE", "KYC"][i % 5],
        horodatage: `2026-02-${String(i + 1).padStart(2, "0")} 10:00:00`,
      })
    );
    const report = runDiagnostic360(clients, collabs, [], logs);
    expect(report.noteLettre).toBe("A");
    expect(report.scoreGlobalDispositif).toBeGreaterThanOrEqual(80);
  });

  it("should assign note D for a poorly configured cabinet", () => {
    const clients = [
      makeClient({
        etat: "PROSPECT",
        be: "",
        siren: "",
        mail: "",
        adresse: "",
        dateExpCni: "2020-01-01",
        dateButoir: "2020-01-01",
        scoreGlobal: 0,
        nivVigilance: "SIMPLIFIEE",
        ppe: "OUI",
        dirigeant: "",
        iban: "",
        superviseur: "",
      }),
    ];
    const report = runDiagnostic360(clients, [], [], []);
    expect(["C", "D"]).toContain(report.noteLettre);
    expect(report.recommandationsPrioritaires.length).toBeGreaterThan(0);
  });

  // === Cash-intensive (bug fix: now also flags STANDARD) ===
  it("should detect cash-intensive clients in simplified vigilance", () => {
    const clients = [makeClient({ cash: "OUI", nivVigilance: "SIMPLIFIEE" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("cash-intensive"));
    expect(item).toBeDefined();
    expect(item?.statut).toBe("CRITIQUE");
  });

  it("should detect cash-intensive clients in standard vigilance (must be reinforced)", () => {
    const clients = [makeClient({ cash: "OUI", nivVigilance: "STANDARD" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("cash-intensive"));
    expect(item).toBeDefined();
    expect(item?.statut).toBe("CRITIQUE");
  });

  it("should mark cash-intensive clients OK when vigilance is reinforced", () => {
    const clients = [makeClient({ cash: "OUI", nivVigilance: "RENFORCEE", dateDerniereRevue: "2026-01-01" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("cash-intensive"));
    expect(item).toBeDefined();
    expect(item?.statut).toBe("OK");
  });

  // === Pression ===
  it("should detect clients with pression flag", () => {
    const clients = [makeClient({ pression: "OUI" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("pression"));
    expect(item).toBeDefined();
  });

  // === Reinforced vigilance ===
  it("should detect reinforced clients without recent review", () => {
    const clients = [makeClient({ nivVigilance: "RENFORCEE", dateDerniereRevue: "2024-01-01" })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("renforcees sans revue"));
    expect(item).toBeDefined();
    expect(item?.statut).toBe("CRITIQUE");
  });

  // === Pays a risque ===
  it("should detect clients lies a des pays a risque", () => {
    const clients = [
      makeClient({ paysRisque: "OUI" }),
      makeClient({ ref: "CLI-26-002", raisonSociale: "PaysRisque2", siren: "222333444", paysRisque: "OUI" }),
      makeClient({ ref: "CLI-26-003", raisonSociale: "PaysRisque3", siren: "333444555", paysRisque: "OUI" }),
      makeClient({ ref: "CLI-26-004", raisonSociale: "PaysRisque4", siren: "444555666", paysRisque: "OUI" }),
    ];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("pays a risque"));
    expect(item).toBeDefined();
    expect(item?.statut).toBe("CRITIQUE");
  });

  // === References reglementaires ===
  it("should include referenceReglementaire on key items", () => {
    const clients = [makeClient()];
    const report = runDiagnostic360(clients, [makeCollaborateur({ referentLcb: true })], [], []);
    const itemsWithRef = report.items.filter(i => i.referenceReglementaire);
    expect(itemsWithRef.length).toBeGreaterThan(5);
  });

  // === Totals ===
  it("should track totalClients, totalCollaborateurs, totalAlertes", () => {
    const report = runDiagnostic360(
      [makeClient(), makeClient({ ref: "CLI-26-002", raisonSociale: "Other", siren: "111222333" })],
      [makeCollaborateur()],
      [makeAlerte()],
      []
    );
    expect(report.totalClients).toBe(2);
    expect(report.totalCollaborateurs).toBe(1);
    expect(report.totalAlertes).toBe(1);
  });

  // === SyntheseSimple ===
  it("should include syntheseSimple in report", () => {
    const report = runDiagnostic360([], [], [], []);
    expect(report.syntheseSimple).toBeDefined();
    expect(report.syntheseSimple.length).toBeGreaterThan(0);
  });

  it("should include note letter in syntheseSimple", () => {
    const report = runDiagnostic360([], [], [], []);
    expect(report.syntheseSimple).toContain(`Note ${report.noteLettre}`);
  });

  it("should provide positive syntheseSimple for score >= 80", () => {
    const clients = [
      makeClient(),
      makeClient({ ref: "CLI-26-002", raisonSociale: "Test2", siren: "987654321" }),
    ];
    const collabs = [
      makeCollaborateur({ referentLcb: true, nom: "Referent" }),
      makeCollaborateur({ suppleant: "Referent", nom: "Suppleant" }),
    ];
    const logs = Array.from({ length: 15 }, (_, i) =>
      makeLog({
        typeAction: ["SCORING", "SCREENING", "REVUE", "ALERTE", "KYC"][i % 5],
        horodatage: `2026-02-${String(i + 1).padStart(2, "0")} 10:00:00`,
      })
    );
    const report = runDiagnostic360(clients, collabs, [], logs);
    if (report.scoreGlobalDispositif >= 80) {
      expect(report.syntheseSimple).toContain("bien organise");
    }
  });

  // === UX metadata ===
  it("should assign actionUrl to items with corrective actions", () => {
    const clients = [makeClient({ be: "", siren: "" })];
    const report = runDiagnostic360(clients, [], [], []);
    const itemsWithAction = report.items.filter(i => i.statut !== "OK" && i.actionUrl);
    expect(itemsWithAction.length).toBeGreaterThan(0);
  });

  it("should assign difficulte and impact to all items", () => {
    const clients = [makeClient()];
    const report = runDiagnostic360(clients, [makeCollaborateur({ referentLcb: true })], [], []);
    for (const item of report.items) {
      expect(item.difficulte).toBeDefined();
      expect(["facile", "moyen", "complexe"]).toContain(item.difficulte);
      expect(item.impact).toBeDefined();
      expect(["faible", "moyen", "fort"]).toContain(item.impact);
    }
  });

  // === Bug fix: desequilibre calculation ===
  it("should handle collaborateur charge desequilibre correctly", () => {
    const clients = [
      makeClient({ ref: "CLI-26-001", comptable: "A" }),
      makeClient({ ref: "CLI-26-002", raisonSociale: "Test2", siren: "222222222", comptable: "A" }),
      makeClient({ ref: "CLI-26-003", raisonSociale: "Test3", siren: "333333333", comptable: "A" }),
      makeClient({ ref: "CLI-26-004", raisonSociale: "Test4", siren: "444444444", comptable: "B" }),
    ];
    const collabs = [
      makeCollaborateur({ nom: "A", referentLcb: true }),
      makeCollaborateur({ nom: "B" }),
    ];
    const report = runDiagnostic360(clients, collabs, [], []);
    const item = report.items.find(i => i.indicateur.includes("Equilibre de charge"));
    expect(item).toBeDefined();
    // 3:1 ratio should trigger ALERTE (>2 but <=3)
    expect(item?.statut).toBe("ALERTE");
  });

  it("should not crash on single collaborateur charge calculation", () => {
    const clients = [
      makeClient({ ref: "CLI-26-001", comptable: "A" }),
    ];
    const collabs = [makeCollaborateur({ nom: "A", referentLcb: true })];
    const report = runDiagnostic360(clients, collabs, [], []);
    const item = report.items.find(i => i.indicateur.includes("Equilibre de charge"));
    expect(item).toBeDefined();
    // Single collaborator: ratio 1:1 = OK
    expect(item?.statut).toBe("OK");
  });

  // === Bug fix: capital threshold ===
  it("should detect commercial companies with insufficient capital", () => {
    const clients = [makeClient({ forme: "SAS", capital: 500 })];
    const report = runDiagnostic360(clients, [], [], []);
    const item = report.items.find(i => i.indicateur.includes("capital"));
    expect(item).toBeDefined();
    expect(item?.statut).toBe("ALERTE");
  });

  // === THRESHOLDS export ===
  it("should export THRESHOLDS constant", () => {
    expect(THRESHOLDS).toBeDefined();
    expect(THRESHOLDS.CLASSIFICATION_OK_PCT).toBe(90);
    expect(THRESHOLDS.REINFORCED_REVIEW_MONTHS).toBe(6);
    expect(THRESHOLDS.CAPITAL_MIN_COMMERCIAL).toBe(1000);
  });

  // === Score boundary tests ===
  it("should assign note boundaries correctly", () => {
    // We can't easily force exact scores, but verify the score is always 0-100
    const report = runDiagnostic360([], [], [], []);
    expect(report.scoreGlobalDispositif).toBeGreaterThanOrEqual(0);
    expect(report.scoreGlobalDispositif).toBeLessThanOrEqual(100);
  });

  // === Date edge cases ===
  it("should handle clients with invalid dates gracefully", () => {
    const clients = [makeClient({ dateButoir: "invalid-date", dateExpCni: "", dateDerniereRevue: "nope" })];
    const report = runDiagnostic360(clients, [], [], []);
    // Should not crash
    expect(report.items.length).toBeGreaterThan(0);
    expect(report.noteLettre).toMatch(/^[A-D]$/);
  });

  it("should handle clients with empty string dates", () => {
    const clients = [makeClient({ dateButoir: "", dateExpCni: "", dateCreationLigne: "" })];
    const report = runDiagnostic360(clients, [], [], []);
    expect(report.items.length).toBeGreaterThan(0);
  });

  // === Large dataset ===
  it("should handle large client sets without errors", () => {
    const clients = Array.from({ length: 100 }, (_, i) =>
      makeClient({
        ref: `CLI-26-${String(i).padStart(3, "0")}`,
        raisonSociale: `Client ${i}`,
        siren: String(100000000 + i),
      })
    );
    const report = runDiagnostic360(clients, [makeCollaborateur({ referentLcb: true })], [], []);
    expect(report.totalClients).toBe(100);
    expect(report.items.length).toBeGreaterThan(10);
  });
});
