/**
 * Data import, CSV parsing, and bulk client operations.
 */

import type { Client } from "./types";

export interface CsvParseError {
  row: number;
  field: string;
  message: string;
}

export interface CsvParseResult<T> {
  data: T[];
  errors: CsvParseError[];
  skipped: number;
  total: number;
}

/** Parse CSV string into rows (handles quoted fields, semicolons, newlines in quotes) */
export function parseCSV(csv: string): string[][] {
  if (!csv || typeof csv !== "string") return [];
  // Strip BOM
  const text = csv.charCodeAt(0) === 0xFEFF ? csv.slice(1) : csv;
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ";") { row.push(current.trim()); current = ""; }
      else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        row.push(current.trim());
        if (row.some(c => c !== "")) rows.push(row);
        row = []; current = "";
        if (ch === "\r") i++;
      } else { current += ch; }
    }
  }
  row.push(current.trim());
  if (row.some(c => c !== "")) rows.push(row);
  return rows;
}

/** Column header → Client field mapping */
const CSV_FIELD_MAP: Record<string, keyof Client> = {
  "raison_sociale": "raisonSociale", "raison sociale": "raisonSociale", "nom": "raisonSociale",
  "forme": "forme", "forme_juridique": "forme", "forme juridique": "forme",
  "siren": "siren", "adresse": "adresse", "cp": "cp", "code_postal": "cp",
  "code postal": "cp", "ville": "ville", "dirigeant": "dirigeant",
  "email": "mail", "mail": "mail", "telephone": "tel", "tel": "tel",
  "ape": "ape", "naf": "ape", "code_ape": "ape", "capital": "capital",
  "effectif": "effectif", "honoraires": "honoraires", "mission": "mission",
  "frequence": "frequence", "date_creation": "dateCreation", "date creation": "dateCreation",
};

/** Parse CSV into partial Client objects with row-level validation */
export function parseClientCSV(csv: string): CsvParseResult<Partial<Client>> {
  const rows = parseCSV(csv);
  if (rows.length < 2) return { data: [], errors: [{ row: 0, field: "", message: "Fichier vide ou sans en-tete" }], skipped: 0, total: 0 };

  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z_\s]/g, "").trim());
  const fieldMap: (keyof Client | null)[] = headers.map(h => CSV_FIELD_MAP[h] ?? null);
  const data: Partial<Client>[] = [];
  const errors: CsvParseError[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const client: Partial<Client> = {};
    let hasData = false;
    for (let j = 0; j < fieldMap.length; j++) {
      const field = fieldMap[j];
      if (!field || !row[j]) continue;
      hasData = true;
      if (field === "capital" || field === "honoraires") {
        const num = parseFloat(row[j].replace(/\s/g, "").replace(",", "."));
        (client as any)[field] = isFinite(num) ? num : null;
      } else {
        (client as any)[field] = row[j];
      }
    }
    if (!hasData) { skipped++; continue; }
    if (!client.raisonSociale) {
      errors.push({ row: i + 1, field: "raisonSociale", message: "Raison sociale manquante" });
      skipped++; continue;
    }
    data.push(client);
  }
  return { data, errors, skipped, total: rows.length - 1 };
}

/** Export clients to CSV string with BOM */
export function exportClientsCSV(
  clients: Client[],
  fields?: (keyof Client)[]
): string {
  const cols = fields ?? [
    "ref", "raisonSociale", "forme", "siren", "adresse", "cp", "ville",
    "dirigeant", "mail", "tel", "ape", "mission", "honoraires",
    "scoreGlobal", "nivVigilance", "dateButoir", "statut",
  ];
  const esc = (v: unknown): string => {
    const s = String(v ?? "");
    return (s.includes(";") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + [cols.join(";"), ...clients.map(c => cols.map(col => esc(c[col])).join(";"))].join("\n");
}

/** Flatten client into flat key-value pairs for analytics export */
export function flattenClientRecord(client: Client): Record<string, string | number | null> {
  return {
    ref: client.ref, raison_sociale: client.raisonSociale, forme: client.forme,
    siren: client.siren, adresse: client.adresse, cp: client.cp, ville: client.ville,
    dirigeant: client.dirigeant, email: client.mail, tel: client.tel,
    ape: client.ape, mission: client.mission,
    capital: client.capital ?? null, honoraires: client.honoraires ?? null,
    score_global: client.scoreGlobal, vigilance: client.nivVigilance,
    etat: client.etat, statut: client.statut, date_butoir: client.dateButoir,
    ppe: client.ppe, pays_risque: client.paysRisque,
  };
}

/** Detect data inconsistencies across portfolio */
export function detectDataInconsistencies(clients: Client[]): {
  type: string; ref: string; detail: string;
}[] {
  const issues: { type: string; ref: string; detail: string }[] = [];
  for (const c of clients) {
    if (c.siren && !/^\d{3}\s?\d{3}\s?\d{3}$/.test(c.siren.trim()))
      issues.push({ type: "FORMAT_SIREN", ref: c.ref, detail: `SIREN invalide: "${c.siren}"` });
    if (c.nivVigilance === "SIMPLIFIEE" && (c.ppe === "OUI" || c.paysRisque === "OUI" || c.atypique === "OUI"))
      issues.push({ type: "VIGILANCE_INCOHERENCE", ref: c.ref, detail: "SIMPLIFIEE avec facteurs de risque actifs" });
    if (c.scoreGlobal > 60 && c.nivVigilance === "SIMPLIFIEE")
      issues.push({ type: "SCORE_VIGILANCE", ref: c.ref, detail: `Score ${c.scoreGlobal} mais vigilance SIMPLIFIEE` });
    if (c.etat === "VALIDE" && (c.honoraires === null || c.honoraires === undefined || c.honoraires === 0))
      issues.push({ type: "HONORAIRES_MANQUANTS", ref: c.ref, detail: "Client valide sans honoraires" });
    if (c.capital !== null && c.capital !== undefined && c.capital < 0)
      issues.push({ type: "CAPITAL_NEGATIF", ref: c.ref, detail: `Capital negatif: ${c.capital}` });
  }
  return issues;
}

/** Find potential client duplicates by fuzzy name + SIREN matching */
export function findClientDuplicates(clients: Client[]): {
  client1: string; client2: string; reason: string; confidence: number;
}[] {
  const duplicates: { client1: string; client2: string; reason: string; confidence: number }[] = [];
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const a = clients[i], b = clients[j];
      // Exact SIREN match
      const sirenA = (a.siren || "").replace(/\s/g, "");
      const sirenB = (b.siren || "").replace(/\s/g, "");
      if (sirenA.length >= 9 && sirenA === sirenB) {
        duplicates.push({ client1: a.ref, client2: b.ref, reason: `SIREN identique: ${sirenA}`, confidence: 0.95 });
        continue;
      }
      // Name similarity
      const nameA = (a.raisonSociale || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const nameB = (b.raisonSociale || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (nameA.length > 3 && nameB.length > 3 && nameA === nameB) {
        duplicates.push({ client1: a.ref, client2: b.ref, reason: `Nom identique: ${a.raisonSociale}`, confidence: 0.8 });
      }
    }
  }
  return duplicates;
}
