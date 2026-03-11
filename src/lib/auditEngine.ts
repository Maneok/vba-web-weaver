/**
 * Data quality audit engine for compliance verification.
 */

import type { Client, Collaborateur, AlerteRegistre } from "./types";

export interface AuditFinding {
  categorie: string;
  severity: "critique" | "majeur" | "mineur";
  clientRef?: string;
  detail: string;
  recommandation: string;
}

/** Comprehensive KYC completeness audit */
export function auditKycCompleteness(clients: Client[]): {
  findings: AuditFinding[];
  stats: { total: number; complets: number; partiels: number; insuffisants: number; taux: number };
} {
  const findings: AuditFinding[] = [];
  let complets = 0, partiels = 0, insuffisants = 0;
  const actifs = clients.filter(c => c.statut !== "INACTIF" && c.etat === "VALIDE");

  for (const c of actifs) {
    const missing: string[] = [];
    if (!c.siren?.trim()) missing.push("SIREN");
    if (!c.mail?.trim()) missing.push("Email");
    if (!c.adresse?.trim()) missing.push("Adresse");
    if (!c.dirigeant?.trim()) missing.push("Dirigeant");
    if (!c.ape?.trim()) missing.push("Code APE");
    if (!c.be?.trim()) missing.push("Beneficiaires effectifs");
    if (!c.tel?.trim()) missing.push("Telephone");
    if (!c.dateCreation) missing.push("Date creation");

    if (missing.length === 0) { complets++; }
    else if (missing.length <= 3) { partiels++; }
    else { insuffisants++; }

    if (missing.length > 0) {
      findings.push({
        categorie: "KYC",
        severity: missing.length >= 4 ? "critique" : missing.length >= 2 ? "majeur" : "mineur",
        clientRef: c.ref,
        detail: `${missing.length} champ(s) manquant(s): ${missing.join(", ")}`,
        recommandation: "Completer les informations KYC manquantes.",
      });
    }
  }

  return {
    findings,
    stats: {
      total: actifs.length,
      complets, partiels, insuffisants,
      taux: actifs.length > 0 ? Math.round((complets / actifs.length) * 100) : 0,
    },
  };
}

/** Audit document expiry and completeness */
export function auditDocuments(clients: Client[]): {
  findings: AuditFinding[];
  stats: { cniExpirees: number; cniManquantes: number; kbisManquants: number; statutsManquants: number };
} {
  const findings: AuditFinding[] = [];
  const now = new Date();
  let cniExp = 0, cniMissing = 0, kbisMissing = 0, statutsMissing = 0;

  for (const c of clients.filter(c => c.statut !== "INACTIF" && c.etat === "VALIDE")) {
    if (c.dateExpCni) {
      const exp = new Date(c.dateExpCni);
      if (!isNaN(exp.getTime()) && exp < now) {
        cniExp++;
        findings.push({
          categorie: "DOCUMENTS", severity: "critique", clientRef: c.ref,
          detail: `CNI expiree depuis le ${c.dateExpCni}`,
          recommandation: "Demander le renouvellement de la piece d'identite.",
        });
      }
    } else {
      cniMissing++;
    }
    if (!c.lienKbis) kbisMissing++;
    if (!c.lienStatuts) statutsMissing++;
  }
  return { findings, stats: { cniExpirees: cniExp, cniManquantes: cniMissing, kbisManquants: kbisMissing, statutsManquants: statutsMissing } };
}

/** Find orphaned alerts (referencing non-existent clients) */
export function findOrphanedAlerts(alertes: AlerteRegistre[], clientRefs: Set<string>): AuditFinding[] {
  return alertes
    .filter(a => a.clientConcerne && !clientRefs.has(a.clientConcerne))
    .map(a => ({
      categorie: "REGISTRE",
      severity: "mineur" as const,
      detail: `Alerte orpheline: client "${a.clientConcerne}" introuvable dans le portefeuille`,
      recommandation: "Verifier si le client a ete archive ou supprime. Mettre a jour l'alerte.",
    }));
}

/** Comprehensive data quality scorecard */
export function calculateDataQualityScore(clients: Client[]): {
  score: number;
  completeness: number;
  consistency: number;
  timeliness: number;
  details: { dimension: string; score: number; detail: string }[];
} {
  const actifs = clients.filter(c => c.statut !== "INACTIF");
  if (actifs.length === 0) return { score: 0, completeness: 0, consistency: 0, timeliness: 0, details: [] };

  const now = new Date();
  const details: { dimension: string; score: number; detail: string }[] = [];

  // Completeness (40%)
  let completeFields = 0;
  const requiredFields = ["raisonSociale", "forme", "siren", "adresse", "cp", "ville", "dirigeant", "mail", "ape"] as const;
  for (const c of actifs) {
    for (const f of requiredFields) {
      if ((c[f] as string)?.trim()) completeFields++;
    }
  }
  const completeness = Math.round((completeFields / (actifs.length * requiredFields.length)) * 100);
  details.push({ dimension: "Completude", score: completeness, detail: `${completeFields}/${actifs.length * requiredFields.length} champs renseignes` });

  // Consistency (30%)
  let inconsistencies = 0;
  for (const c of actifs) {
    if (c.nivVigilance === "SIMPLIFIEE" && (c.ppe === "OUI" || c.paysRisque === "OUI")) inconsistencies++;
    if (c.scoreGlobal > 60 && c.nivVigilance === "SIMPLIFIEE") inconsistencies++;
    if (c.etat === "VALIDE" && !c.honoraires) inconsistencies++;
  }
  const consistency = Math.round(Math.max(0, 100 - (inconsistencies / actifs.length) * 100));
  details.push({ dimension: "Coherence", score: consistency, detail: `${inconsistencies} incoherence(s) detectee(s)` });

  // Timeliness (30%)
  let outdated = 0;
  for (const c of actifs) {
    if (c.dateExpCni && new Date(c.dateExpCni) < now) outdated++;
    if (c.dateButoir && new Date(c.dateButoir) < now) outdated++;
  }
  const timeliness = Math.round(Math.max(0, 100 - (outdated / (actifs.length * 2)) * 100));
  details.push({ dimension: "Actualite", score: timeliness, detail: `${outdated} donnee(s) perimee(s)` });

  const score = Math.round(completeness * 0.4 + consistency * 0.3 + timeliness * 0.3);
  return { score, completeness, consistency, timeliness, details };
}

/** Data nullability report — which fields are most frequently missing */
export function generateNullabilityReport(clients: Client[]): {
  field: string;
  missing: number;
  total: number;
  percentage: number;
}[] {
  const fields: (keyof Client)[] = [
    "raisonSociale", "forme", "siren", "adresse", "cp", "ville", "dirigeant",
    "mail", "tel", "ape", "capital", "honoraires", "be", "dateCreation",
    "dateExpCni", "lienKbis", "lienStatuts", "lienCni",
  ];
  const actifs = clients.filter(c => c.statut !== "INACTIF");
  return fields.map(field => {
    const missing = actifs.filter(c => {
      const val = c[field];
      return val === null || val === undefined || (typeof val === "string" && val.trim() === "") || val === 0;
    }).length;
    return {
      field,
      missing,
      total: actifs.length,
      percentage: actifs.length > 0 ? Math.round((missing / actifs.length) * 100) : 0,
    };
  }).sort((a, b) => b.percentage - a.percentage);
}
