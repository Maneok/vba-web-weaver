/**
 * Portfolio analytics, statistics, and trend analysis.
 */

import type { Client, Collaborateur, AlerteRegistre } from "./types";

export interface PortfolioStats {
  totalClients: number;
  actifs: number;
  scoreMoyen: number;
  scoreMedian: number;
  scoreMin: number;
  scoreMax: number;
  ecartType: number;
  quartiles: [number, number, number]; // Q1, Q2 (median), Q3
  repartitionVigilance: { SIMPLIFIEE: number; STANDARD: number; RENFORCEE: number };
  repartitionEtat: Record<string, number>;
  repartitionMission: Record<string, number>;
  repartitionForme: Record<string, number>;
  totalHonoraires: number;
  honorairesMoyen: number;
}

/** Calculate portfolio statistics */
export function calculatePortfolioStats(clients: Client[]): PortfolioStats {
  const actifs = clients.filter(c => c.statut !== "INACTIF");
  const scores = actifs.map(c => c.scoreGlobal ?? 0).sort((a, b) => a - b);

  const sum = scores.reduce((s, v) => s + v, 0);
  const mean = scores.length > 0 ? sum / scores.length : 0;

  // Standard deviation
  const variance = scores.length > 0
    ? scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length
    : 0;

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const q1 = median(scores.slice(0, Math.floor(scores.length / 2)));
  const q2 = median(scores);
  const q3 = median(scores.slice(Math.ceil(scores.length / 2)));

  const vigil = { SIMPLIFIEE: 0, STANDARD: 0, RENFORCEE: 0 };
  const etats: Record<string, number> = {};
  const missions: Record<string, number> = {};
  const formes: Record<string, number> = {};
  let totalHon = 0;

  for (const c of actifs) {
    vigil[c.nivVigilance as keyof typeof vigil] = (vigil[c.nivVigilance as keyof typeof vigil] || 0) + 1;
    etats[c.etat] = (etats[c.etat] || 0) + 1;
    missions[c.mission] = (missions[c.mission] || 0) + 1;
    formes[c.forme] = (formes[c.forme] || 0) + 1;
    totalHon += c.honoraires ?? 0;
  }

  return {
    totalClients: clients.length,
    actifs: actifs.length,
    scoreMoyen: Math.round(mean * 10) / 10,
    scoreMedian: q2,
    scoreMin: scores.length > 0 ? scores[0] : 0,
    scoreMax: scores.length > 0 ? scores[scores.length - 1] : 0,
    ecartType: Math.round(Math.sqrt(variance) * 10) / 10,
    quartiles: [q1, q2, q3],
    repartitionVigilance: vigil,
    repartitionEtat: etats,
    repartitionMission: missions,
    repartitionForme: formes,
    totalHonoraires: totalHon,
    honorairesMoyen: actifs.length > 0 ? Math.round(totalHon / actifs.length) : 0,
  };
}

/** Collaborateur workload analytics */
export interface CollabWorkload {
  nom: string;
  clientCount: number;
  avgScore: number;
  renforceeCount: number;
  honorairesTotal: number;
}

export function calculateCollabWorkload(clients: Client[], collabs: Collaborateur[]): CollabWorkload[] {
  const byCollab = new Map<string, Client[]>();
  for (const c of clients) {
    if (c.statut === "INACTIF") continue;
    const key = (c.comptable || "NON ASSIGNE").toUpperCase();
    const existing = byCollab.get(key) || [];
    existing.push(c);
    byCollab.set(key, existing);
  }

  return Array.from(byCollab.entries()).map(([nom, cls]) => ({
    nom,
    clientCount: cls.length,
    avgScore: cls.length > 0 ? Math.round(cls.reduce((s, c) => s + (c.scoreGlobal ?? 0), 0) / cls.length) : 0,
    renforceeCount: cls.filter(c => c.nivVigilance === "RENFORCEE").length,
    honorairesTotal: cls.reduce((s, c) => s + (c.honoraires ?? 0), 0),
  })).sort((a, b) => b.clientCount - a.clientCount);
}

/** Score distribution analysis — detect bimodal or skewed distributions */
export function analyzeScoreDistribution(clients: Client[]): {
  buckets: { range: string; count: number }[];
  isSkewed: boolean;
  skewDirection: "low" | "high" | "balanced";
  concentration: number; // % of clients in most populated bucket
} {
  const scores = clients.filter(c => c.statut !== "INACTIF").map(c => c.scoreGlobal ?? 0);
  const bucketRanges = [
    { range: "0-20", min: 0, max: 20 },
    { range: "21-40", min: 21, max: 40 },
    { range: "41-60", min: 41, max: 60 },
    { range: "61-80", min: 61, max: 80 },
    { range: "81-100", min: 81, max: 100 },
    { range: "101-120", min: 101, max: 120 },
  ];

  const buckets = bucketRanges.map(({ range, min, max }) => ({
    range,
    count: scores.filter(s => s >= min && s <= max).length,
  }));

  const maxBucket = Math.max(...buckets.map(b => b.count));
  const concentration = scores.length > 0 ? Math.round((maxBucket / scores.length) * 100) : 0;

  const lowHalf = scores.filter(s => s <= 60).length;
  const highHalf = scores.filter(s => s > 60).length;
  const total = scores.length || 1;

  return {
    buckets,
    isSkewed: Math.abs(lowHalf - highHalf) / total > 0.3,
    skewDirection: lowHalf > highHalf * 1.5 ? "low" : highHalf > lowHalf * 1.5 ? "high" : "balanced",
    concentration,
  };
}

/** Compliance metrics dashboard data */
export function calculateComplianceMetrics(
  clients: Client[],
  collabs: Collaborateur[],
  alertes: AlerteRegistre[]
): {
  tauxFormation: number;
  tauxKycComplet: number;
  tauxDocumentsComplets: number;
  tauxRevuesAJour: number;
  alertesOuvertes: number;
  alertesCritiques: number;
  scoreConformite: number;
} {
  const actifs = clients.filter(c => c.statut !== "INACTIF");
  const now = new Date();

  const formes = collabs.filter(c => (c.statutFormation ?? "").includes("A JOUR")).length;
  const tauxFormation = collabs.length > 0 ? Math.round((formes / collabs.length) * 100) : 0;

  const kycOk = actifs.filter(c => c.siren?.trim() && c.mail?.trim() && c.adresse?.trim() && c.dirigeant?.trim()).length;
  const tauxKyc = actifs.length > 0 ? Math.round((kycOk / actifs.length) * 100) : 0;

  const docsOk = actifs.filter(c => c.lienKbis || c.lienStatuts || c.lienCni).length;
  const tauxDocs = actifs.length > 0 ? Math.round((docsOk / actifs.length) * 100) : 0;

  const revuesOk = actifs.filter(c => !c.dateButoir || new Date(c.dateButoir) >= now).length;
  const tauxRevues = actifs.length > 0 ? Math.round((revuesOk / actifs.length) * 100) : 0;

  const ouvertes = alertes.filter(a => a.statut === "EN COURS").length;
  const critiques = alertes.filter(a => a.statut === "EN COURS" && (a.categorie || "").includes("SOUPCON")).length;

  // Composite score (weighted)
  const score = Math.round(tauxFormation * 0.2 + tauxKyc * 0.3 + tauxDocs * 0.2 + tauxRevues * 0.3);

  return {
    tauxFormation, tauxKycComplet: tauxKyc, tauxDocumentsComplets: tauxDocs,
    tauxRevuesAJour: tauxRevues, alertesOuvertes: ouvertes, alertesCritiques: critiques,
    scoreConformite: score,
  };
}

/** Generate compliance snapshot for a point-in-time record */
export function generateComplianceSnapshot(
  clients: Client[], cabinetName: string
): {
  date: string; cabinet: string; totalClients: number;
  repartitionVigilance: Record<string, number>;
  scoreMoyen: number; kycCompletude: number;
  clientsEnRetard: number; documentsManquants: number;
} {
  const actifs = clients.filter(c => c.statut !== "INACTIF");
  const now = new Date();
  const rep: Record<string, number> = { SIMPLIFIEE: 0, STANDARD: 0, RENFORCEE: 0 };
  let scoreSum = 0, kycOk = 0, retard = 0, docsManq = 0;

  for (const c of actifs) {
    rep[c.nivVigilance] = (rep[c.nivVigilance] || 0) + 1;
    scoreSum += c.scoreGlobal ?? 0;
    if (c.siren?.trim() && c.mail?.trim() && c.adresse?.trim() && c.dirigeant?.trim()) kycOk++;
    if (c.dateButoir && new Date(c.dateButoir) < now) retard++;
    if (!c.lienKbis && !c.lienStatuts && !c.lienCni) docsManq++;
  }

  return {
    date: now.toISOString().split("T")[0], cabinet: cabinetName,
    totalClients: actifs.length, repartitionVigilance: rep,
    scoreMoyen: actifs.length > 0 ? Math.round(scoreSum / actifs.length) : 0,
    kycCompletude: actifs.length > 0 ? Math.round((kycOk / actifs.length) * 100) : 0,
    clientsEnRetard: retard, documentsManquants: docsManq,
  };
}
