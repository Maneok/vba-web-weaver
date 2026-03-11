import { describe, it, expect, vi } from "vitest";

// ── Tests for export utility functions ──────────────────────

function escapeCSV(val: unknown): string {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

describe("DashboardExport — escapeCSV", () => {
  it("retourne une chaîne simple telle quelle", () => {
    expect(escapeCSV("hello")).toBe("hello");
  });

  it("échappe les virgules", () => {
    expect(escapeCSV("a,b")).toBe('"a,b"');
  });

  it("échappe les guillemets", () => {
    expect(escapeCSV('a"b')).toBe('"a""b"');
  });

  it("échappe les sauts de ligne", () => {
    expect(escapeCSV("a\nb")).toBe('"a\nb"');
  });

  it("gère null/undefined", () => {
    expect(escapeCSV(null)).toBe("");
    expect(escapeCSV(undefined)).toBe("");
  });

  it("gère les nombres", () => {
    expect(escapeCSV(42)).toBe("42");
  });

  it("gère les chaînes vides", () => {
    expect(escapeCSV("")).toBe("");
  });

  it("gère les combinaisons virgule + guillemet", () => {
    expect(escapeCSV('a,"b"')).toBe('"a,""b"""');
  });
});

describe("DashboardExport — CSV generation", () => {
  it("génère un CSV avec des headers et des lignes", () => {
    const headers = ["Référence", "Raison sociale", "SIREN"];
    const rows = [
      ["CLI-26-001", "SCI Dupont", "123456789"],
      ["CLI-26-002", "SARL Tech, Innovation", "987654321"],
    ];
    const csv = [headers, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Référence,Raison sociale,SIREN");
    expect(lines[2]).toContain('"SARL Tech, Innovation"');
  });

  it("génère la synthèse avec les bonnes valeurs", () => {
    const stats = { totalClients: 30, avgScore: 45, tauxConformite: 80, alertesEnCours: 5, revuesEchues: 3, caPrevisionnel: 120000 };
    const rows = [
      ["Indicateur", "Valeur"],
      ["Clients actifs", stats.totalClients],
      ["Score moyen", stats.avgScore],
      ["Taux de conformité", `${stats.tauxConformite}%`],
      ["Alertes en cours", stats.alertesEnCours],
    ];
    const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\n");
    expect(csv).toContain("Clients actifs,30");
    expect(csv).toContain("Taux de conformité,80%");
  });

  it("gère les données avec accents et caractères spéciaux", () => {
    const row = ["Société à responsabilité limitée", "Côté d'Azur"];
    const csv = row.map(escapeCSV).join(",");
    expect(csv).toContain("Société");
    expect(csv).toContain("Côté");
  });

  it("gère des données vides gracieusement", () => {
    const rows = [
      ["Ref", "Nom"],
      ["CLI-001", ""],
    ];
    const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\n");
    expect(csv).toContain("CLI-001,");
  });
});
