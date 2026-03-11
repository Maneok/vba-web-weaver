/**
 * AML/Compliance utility functions for LCB-FT risk detection.
 */

import type { Client, AlerteRegistre } from "./types";

/** Shell company risk signals */
export interface ShellCompanySignal {
  signal: string;
  severity: "low" | "medium" | "high";
}

/** Detect shell company indicators from client data */
export function detectShellCompanySignals(client: Client): ShellCompanySignal[] {
  const signals: ShellCompanySignal[] = [];
  const cap = client.capital ?? 0;
  const hon = client.honoraires ?? 0;

  // Low capital with high revenue
  if (cap > 0 && cap < 100 && hon > 10000) {
    signals.push({ signal: "Capital < 100€ avec honoraires > 10k€", severity: "high" });
  }

  // No employees + old company + reprise
  const effectifStr = (client.effectif || "").trim().toUpperCase();
  const noEmployees = !effectifStr || /^0\b|AUCUN|NEANT/i.test(effectifStr);
  if (noEmployees && client.dateReprise && client.dateReprise !== client.dateCreation) {
    signals.push({ signal: "Reprise d'entreprise sans salarie", severity: "medium" });
  }

  // No physical address indicators
  if (client.adresse && /BOITE\s*POSTALE|BP\s+\d|DOMICILI/i.test(client.adresse)) {
    signals.push({ signal: "Adresse de type boite postale ou domiciliation", severity: "medium" });
  }

  // Missing beneficial owner
  if (!client.be || client.be.trim() === "") {
    signals.push({ signal: "Beneficiaires effectifs non renseignes", severity: "high" });
  }

  // Very recent creation with high-risk structure
  if (client.dateCreation) {
    const age = (Date.now() - new Date(client.dateCreation).getTime()) / (365.25 * 86400000);
    if (age < 1 && (client.forme || "").toUpperCase().includes("SAS")) {
      signals.push({ signal: "SAS creee il y a moins d'un an", severity: "low" });
    }
  }

  // Missing key documents
  if (!client.lienKbis && !client.lienStatuts) {
    signals.push({ signal: "Aucun document justificatif (KBIS/statuts)", severity: "medium" });
  }

  return signals;
}

/** Calculate KYC completeness percentage */
export function calculateClientCompleteness(client: Client): {
  percentage: number;
  missingFields: string[];
  level: "complet" | "partiel" | "insuffisant";
} {
  const checks: [string, boolean][] = [
    ["Raison sociale", !!client.raisonSociale?.trim()],
    ["Forme juridique", !!client.forme?.trim()],
    ["SIREN", !!client.siren?.trim()],
    ["Adresse", !!client.adresse?.trim()],
    ["Code postal", !!client.cp?.trim()],
    ["Ville", !!client.ville?.trim()],
    ["Dirigeant", !!client.dirigeant?.trim()],
    ["Email", !!client.mail?.trim()],
    ["Telephone", !!client.tel?.trim()],
    ["Code APE", !!client.ape?.trim()],
    ["Beneficiaires effectifs", !!client.be?.trim()],
    ["Date creation", !!client.dateCreation],
    ["Capital", (client.capital ?? 0) > 0],
    ["Honoraires", (client.honoraires ?? 0) > 0],
    ["KBIS", !!client.lienKbis],
    ["CNI dirigeant", !!client.lienCni || !!client.dateExpCni],
  ];

  const filled = checks.filter(([, ok]) => ok).length;
  const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
  const percentage = Math.round((filled / checks.length) * 100);

  return {
    percentage,
    missingFields: missing,
    level: percentage >= 90 ? "complet" : percentage >= 60 ? "partiel" : "insuffisant",
  };
}

/** Levenshtein distance for fuzzy name matching */
export function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const matrix: number[][] = [];
  for (let i = 0; i <= la; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lb; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[la][lb];
}

/** Detect name similarity (returns similarity ratio 0-1) */
export function nameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;
  const a = name1.toUpperCase().trim();
  const b = name2.toUpperCase().trim();
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/** Classify mission risk level */
export function classifyMissionRisk(mission: string): "faible" | "moyen" | "eleve" | "tres_eleve" {
  const m = (mission || "").toUpperCase();
  if (m.includes("DOMICILIATION")) return "tres_eleve";
  if (m.includes("CONSTITUTION") || m.includes("CESSION")) return "eleve";
  if (m.includes("CONSEIL") || m.includes("REVISION")) return "moyen";
  return "faible";
}

/** Auto-calculate alert priority based on category and context */
export function calculateAlertePriority(alerte: AlerteRegistre): "CRITIQUE" | "HAUTE" | "MOYENNE" | "BASSE" {
  const cat = (alerte.categorie || "").toUpperCase();
  if (cat.includes("TRACFIN") || cat.includes("SOUPCON")) return "CRITIQUE";
  if (cat.includes("GEL") || cat.includes("SANCTIONS") || cat.includes("PPE")) return "CRITIQUE";
  if (cat.includes("FLUX") || cat.includes("ATYPIQUE") || cat.includes("ANOMALIE")) return "HAUTE";
  if (cat.includes("PAYS") || cat.includes("JURIDICTION")) return "HAUTE";
  if (cat.includes("INTERNE") || cat.includes("ERREUR")) return "MOYENNE";
  if (cat.includes("ADMIN") || cat.includes("KYC")) return "MOYENNE";
  return "BASSE";
}

/** Generate compliance reference number */
export function generateComplianceRef(type: "ALERTE" | "DS" | "CTRL" | "REV", index: number): string {
  const year = new Date().getFullYear();
  const prefix = { ALERTE: "ALR", DS: "DS", CTRL: "CTR", REV: "REV" }[type];
  return `${prefix}-${year}-${String(index).padStart(4, "0")}`;
}

/** GAFI high-risk jurisdictions (2024 list) */
const GAFI_HIGH_RISK = new Set([
  "IRAN", "COREE DU NORD", "MYANMAR", "MYANMAR (BIRMANIE)",
]);
const GAFI_MONITORED = new Set([
  "ALBANIE", "BARBADE", "BURKINA FASO", "CAMEROUN", "CONGO (RDC)",
  "CROATIE", "HAITI", "JAMAIQUE", "JORDANIE", "MALI",
  "MOZAMBIQUE", "NIGERIA", "PANAMA", "PHILIPPINES",
  "SENEGAL", "SOUDAN DU SUD", "SYRIE", "TANZANIE",
  "TURQUIE", "VIETNAM", "YEMEN",
]);

/** Check if country is on GAFI risk lists */
export function isHighRiskJurisdiction(country: string): {
  isHighRisk: boolean;
  isMonitored: boolean;
  level: "aucun" | "surveille" | "eleve";
} {
  const normalized = (country || "").toUpperCase().trim();
  if (GAFI_HIGH_RISK.has(normalized)) return { isHighRisk: true, isMonitored: false, level: "eleve" };
  if (GAFI_MONITORED.has(normalized)) return { isHighRisk: false, isMonitored: true, level: "surveille" };
  return { isHighRisk: false, isMonitored: false, level: "aucun" };
}
