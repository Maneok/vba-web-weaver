/**
 * Tests for src/lib/utils/csvImport.ts
 * Features #27-30: parseCSV, validateCSVHeaders, mapCSVRow, detectDelimiter
 */
import { parseCSV, validateCSVHeaders, mapCSVRow, detectDelimiter } from "@/lib/utils/csvImport";

describe("Feature #27: parseCSV", () => {
  it("parses simple CSV", () => {
    const csv = "nom,siren,ville\nDupont,123456789,Paris\nMartin,987654321,Lyon";
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["nom", "siren", "ville"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].nom).toBe("Dupont");
    expect(result.rows[1].ville).toBe("Lyon");
  });
  it("handles semicolon delimiter", () => {
    const csv = "nom;siren\nDupont;123456789";
    const result = parseCSV(csv, { delimiter: ";" });
    expect(result.rows[0].nom).toBe("Dupont");
  });
  it("strips quotes", () => {
    const csv = '"nom","ville"\n"Dupont","Paris"';
    const result = parseCSV(csv);
    expect(result.rows[0].nom).toBe("Dupont");
  });
  it("reports column count mismatch", () => {
    const csv = "a,b,c\n1,2";
    const result = parseCSV(csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.rows).toHaveLength(0);
  });
  it("handles empty CSV", () => {
    const result = parseCSV("");
    expect(result.errors).toContain("Fichier CSV vide");
  });
  it("skips empty lines", () => {
    const csv = "a,b\n1,2\n\n3,4";
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(2);
  });
});

describe("Feature #28: validateCSVHeaders", () => {
  it("valid when all required present", () => {
    const result = validateCSVHeaders(["nom", "siren", "ville"], ["nom", "siren"]);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
  it("invalid when missing required", () => {
    const result = validateCSVHeaders(["nom"], ["nom", "siren"]);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("siren");
  });
  it("reports extra columns", () => {
    const result = validateCSVHeaders(["nom", "extra"], ["nom"], ["siren"]);
    expect(result.extra).toContain("extra");
  });
  it("case insensitive", () => {
    const result = validateCSVHeaders(["NOM", "SIREN"], ["nom", "siren"]);
    expect(result.valid).toBe(true);
  });
});

describe("Feature #29: mapCSVRow", () => {
  it("maps fields correctly", () => {
    const row = { "nom_societe": "Dupont", "numero_siren": "123" };
    const mapping = { "nom_societe": "raisonSociale", "numero_siren": "siren" };
    const result = mapCSVRow(row, mapping);
    expect(result.raisonSociale).toBe("Dupont");
    expect(result.siren).toBe("123");
  });
  it("handles missing fields", () => {
    const row = { "nom": "Test" };
    const mapping = { "nom": "raisonSociale", "siren": "siren" };
    const result = mapCSVRow(row, mapping);
    expect(result.raisonSociale).toBe("Test");
    expect(result.siren).toBeUndefined();
  });
  it("case insensitive key matching", () => {
    const row = { "NOM": "Test" };
    const mapping = { "nom": "raisonSociale" };
    const result = mapCSVRow(row, mapping);
    expect(result.raisonSociale).toBe("Test");
  });
});

describe("Feature #30: detectDelimiter", () => {
  it("detects comma", () => { expect(detectDelimiter("a,b,c,d")).toBe(","); });
  it("detects semicolon", () => { expect(detectDelimiter("a;b;c;d")).toBe(";"); });
  it("detects tab", () => { expect(detectDelimiter("a\tb\tc\td")).toBe("\t"); });
  it("detects pipe", () => { expect(detectDelimiter("a|b|c|d")).toBe("|"); });
  it("defaults to comma for empty", () => { expect(detectDelimiter("")).toBe(","); });
});
