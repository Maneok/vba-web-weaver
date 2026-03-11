/**
 * Tests for src/lib/utils/search.ts
 * Features #42-44: fuzzyMatch, normalizeSearchTerm, searchClients
 */

import { fuzzyMatch, normalizeSearchTerm, searchClients } from "@/lib/utils/search";
import type { Client } from "@/lib/types";

const makeClient = (overrides: Partial<Client>): Client => ({
  ref: "CLI-26-001",
  etat: "VALIDE",
  comptable: "MAGALIE",
  mission: "TENUE COMPTABLE",
  raisonSociale: "Test SARL",
  forme: "SARL",
  adresse: "1 rue test",
  cp: "75001",
  ville: "Paris",
  siren: "123456789",
  capital: 10000,
  ape: "69.20Z",
  dirigeant: "Jean Dupont",
  domaine: "Comptabilite",
  effectif: "5",
  tel: "0612345678",
  mail: "test@test.fr",
  dateCreation: "2020-01-01",
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
  scoreMission: 20,
  scoreMaturite: 10,
  scoreStructure: 15,
  malus: 0,
  scoreGlobal: 35,
  nivVigilance: "STANDARD",
  dateCreationLigne: "2025-01-01",
  dateDerniereRevue: "2025-01-01",
  dateButoir: "2027-01-01",
  etatPilotage: "A JOUR",
  dateExpCni: "2028-01-01",
  statut: "ACTIF",
  be: "Jean Dupont",
  ...overrides,
} as Client);

describe("Feature #42: fuzzyMatch", () => {
  it("exact match → score 1", () => {
    const result = fuzzyMatch("hello", "hello");
    expect(result.match).toBe(true);
    expect(result.score).toBe(1);
  });

  it("contains match → score >= 0.5", () => {
    const result = fuzzyMatch("Hello World", "World");
    expect(result.match).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.5);
  });

  it("accent-insensitive match", () => {
    const result = fuzzyMatch("Société Française", "societe");
    expect(result.match).toBe(true);
  });

  it("no match → score 0", () => {
    const result = fuzzyMatch("hello", "xyz");
    expect(result.match).toBe(false);
  });

  it("empty query → no match", () => {
    expect(fuzzyMatch("hello", "").match).toBe(false);
  });

  it("empty text → no match", () => {
    expect(fuzzyMatch("", "hello").match).toBe(false);
  });

  it("partial character match", () => {
    const result = fuzzyMatch("abcdef", "ace");
    // 'a', 'c', 'e' are present in order
    expect(result.score).toBeGreaterThan(0);
  });
});

describe("Feature #43: normalizeSearchTerm", () => {
  it("lowercases", () => {
    expect(normalizeSearchTerm("HELLO")).toBe("hello");
  });

  it("strips accents", () => {
    expect(normalizeSearchTerm("Écran")).toBe("ecran");
  });

  it("trims whitespace", () => {
    expect(normalizeSearchTerm("  hello  ")).toBe("hello");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeSearchTerm("hello   world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(normalizeSearchTerm("")).toBe("");
  });

  it("combines all transformations", () => {
    expect(normalizeSearchTerm("  Écran  Résumé  ")).toBe("ecran resume");
  });
});

describe("Feature #44: searchClients", () => {
  const clients = [
    makeClient({ ref: "CLI-26-001", raisonSociale: "Société Dupont", siren: "111111111", ville: "Paris" }),
    makeClient({ ref: "CLI-26-002", raisonSociale: "Martin & Fils", siren: "222222222", ville: "Lyon" }),
    makeClient({ ref: "CLI-26-003", raisonSociale: "Boulangerie Française", siren: "333333333", ville: "Marseille" }),
  ];

  it("finds by raison sociale", () => {
    const result = searchClients(clients, "Dupont");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].ref).toBe("CLI-26-001"); // best match first
  });

  it("finds by ref", () => {
    const result = searchClients(clients, "CLI-26-002");
    expect(result).toHaveLength(1);
    expect(result[0].raisonSociale).toBe("Martin & Fils");
  });

  it("finds by SIREN", () => {
    const result = searchClients(clients, "333333333");
    expect(result).toHaveLength(1);
  });

  it("finds by ville", () => {
    const result = searchClients(clients, "Lyon");
    expect(result).toHaveLength(1);
  });

  it("accent-insensitive search", () => {
    const result = searchClients(clients, "societe");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].ref).toBe("CLI-26-001");
  });

  it("returns all for empty query", () => {
    expect(searchClients(clients, "")).toHaveLength(3);
  });

  it("returns empty for no match", () => {
    expect(searchClients(clients, "zzzzzzzzz")).toHaveLength(0);
  });

  it("sorts by relevance (exact > prefix > contains)", () => {
    const result = searchClients(clients, "Martin");
    expect(result[0].raisonSociale).toBe("Martin & Fils");
  });
});
