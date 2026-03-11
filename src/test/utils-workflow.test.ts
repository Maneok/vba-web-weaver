/**
 * Tests for src/lib/utils/workflow.ts
 * Features #22-26: getNextStatuses, canTransition, getClientLifecycleStage, calculateWorkload, prioritizeClients
 */
import { getNextStatuses, canTransition, getClientLifecycleStage, calculateWorkload, prioritizeClients } from "@/lib/utils/workflow";
import type { Client } from "@/lib/types";

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  ref: "CLI-26-001", etat: "VALIDE", comptable: "MAGALIE", mission: "TENUE COMPTABLE",
  raisonSociale: "Test SARL", forme: "SARL", adresse: "", cp: "75001", ville: "Paris",
  siren: "123456789", capital: 10000, ape: "69.20Z", dirigeant: "Jean", domaine: "",
  effectif: "5", tel: "", mail: "", dateCreation: "2020-01-01", dateReprise: "",
  honoraires: 5000, reprise: 0, juridique: 0, frequence: "MENSUEL", iban: "", bic: "",
  associe: "DIDIER", superviseur: "SAMUEL", ppe: "NON", paysRisque: "NON",
  atypique: "NON", distanciel: "NON", cash: "NON", pression: "NON",
  scoreActivite: 25, scorePays: 0, scoreMission: 20, scoreMaturite: 10, scoreStructure: 15,
  malus: 0, scoreGlobal: 35, nivVigilance: "STANDARD",
  dateCreationLigne: "2025-01-01", dateDerniereRevue: "2025-01-01",
  dateButoir: "2027-01-01", etatPilotage: "A JOUR", dateExpCni: "2028-01-01",
  statut: "ACTIF", be: "Jean",
  ...overrides,
} as Client);

describe("Feature #22: getNextStatuses", () => {
  it("PROSPECT can go to EN COURS, REFUSE, ARCHIVE", () => {
    expect(getNextStatuses("PROSPECT")).toContain("EN COURS");
    expect(getNextStatuses("PROSPECT")).toContain("REFUSE");
    expect(getNextStatuses("PROSPECT")).toContain("ARCHIVE");
  });
  it("VALIDE can go to EN COURS, ARCHIVE", () => {
    expect(getNextStatuses("VALIDE")).toContain("EN COURS");
    expect(getNextStatuses("VALIDE")).toContain("ARCHIVE");
  });
  it("ARCHIVE can only go to EN COURS", () => {
    expect(getNextStatuses("ARCHIVE")).toEqual(["EN COURS"]);
  });
});

describe("Feature #23: canTransition", () => {
  it("allows valid transitions", () => {
    expect(canTransition("PROSPECT", "EN COURS")).toBe(true);
    expect(canTransition("EN COURS", "VALIDE")).toBe(true);
  });
  it("rejects invalid transitions", () => {
    expect(canTransition("PROSPECT", "VALIDE")).toBe(false);
    expect(canTransition("ARCHIVE", "VALIDE")).toBe(false);
  });
});

describe("Feature #24: getClientLifecycleStage", () => {
  it("PROSPECT → onboarding", () => {
    expect(getClientLifecycleStage({ etat: "PROSPECT" }).stage).toBe("onboarding");
  });
  it("VALIDE + A JOUR → actif", () => {
    expect(getClientLifecycleStage({ etat: "VALIDE", etatPilotage: "A JOUR" }).stage).toBe("actif");
  });
  it("VALIDE + RETARD → alerte", () => {
    expect(getClientLifecycleStage({ etat: "VALIDE", etatPilotage: "RETARD" }).stage).toBe("alerte");
  });
  it("ARCHIVE → archive", () => {
    expect(getClientLifecycleStage({ etat: "ARCHIVE" }).stage).toBe("archive");
  });
  it("VALIDE + BIENTÔT → revue", () => {
    expect(getClientLifecycleStage({ etat: "VALIDE", etatPilotage: "BIENTÔT" }).stage).toBe("revue");
  });
});

describe("Feature #25: calculateWorkload", () => {
  it("calculates totals correctly", () => {
    const clients = [
      makeClient({ nivVigilance: "RENFORCEE", etatPilotage: "RETARD", scoreGlobal: 80 }),
      makeClient({ nivVigilance: "STANDARD", etatPilotage: "A JOUR", scoreGlobal: 40 }),
      makeClient({ nivVigilance: "SIMPLIFIEE", etatPilotage: "BIENTÔT", scoreGlobal: 20 }),
    ];
    const result = calculateWorkload(clients);
    expect(result.total).toBe(3);
    expect(result.overdue).toBe(1);
    expect(result.reviewSoon).toBe(1);
    expect(result.byVigilance.RENFORCEE).toBe(1);
    expect(result.byVigilance.STANDARD).toBe(1);
    expect(result.averageScore).toBe(47); // (80+40+20)/3 = 46.67 → 47
  });
  it("handles empty list", () => {
    const result = calculateWorkload([]);
    expect(result.total).toBe(0);
    expect(result.averageScore).toBe(0);
  });
});

describe("Feature #26: prioritizeClients", () => {
  it("sorts RETARD before A JOUR", () => {
    const clients = [
      makeClient({ ref: "A", etatPilotage: "A JOUR", nivVigilance: "STANDARD" }),
      makeClient({ ref: "B", etatPilotage: "RETARD", nivVigilance: "STANDARD" }),
    ];
    const result = prioritizeClients(clients);
    expect(result[0].ref).toBe("B");
  });
  it("sorts RENFORCEE before SIMPLIFIEE at same urgency", () => {
    const clients = [
      makeClient({ ref: "A", etatPilotage: "A JOUR", nivVigilance: "SIMPLIFIEE" }),
      makeClient({ ref: "B", etatPilotage: "A JOUR", nivVigilance: "RENFORCEE" }),
    ];
    const result = prioritizeClients(clients);
    expect(result[0].ref).toBe("B");
  });
  it("does not mutate original", () => {
    const clients = [makeClient({ ref: "A" }), makeClient({ ref: "B" })];
    prioritizeClients(clients);
    expect(clients[0].ref).toBe("A");
  });
});
