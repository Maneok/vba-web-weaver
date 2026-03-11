/**
 * Client lifecycle workflow utilities — state transitions, workload, prioritization.
 */

import type { Client, EtatDossier, VigilanceLevel } from "@/lib/types";

/** Valid state transitions for client dossier */
const STATE_TRANSITIONS: Record<EtatDossier, EtatDossier[]> = {
  "PROSPECT": ["EN COURS", "REFUSE", "ARCHIVE"],
  "EN COURS": ["VALIDE", "REFUSE", "ARCHIVE"],
  "VALIDE": ["EN COURS", "ARCHIVE"],
  "REFUSE": ["EN COURS", "ARCHIVE"],
  "ARCHIVE": ["EN COURS"],
};

/** Get valid next statuses for a client state */
export function getNextStatuses(currentState: EtatDossier): EtatDossier[] {
  return STATE_TRANSITIONS[currentState] ?? [];
}

/** Check if a state transition is valid */
export function canTransition(from: EtatDossier, to: EtatDossier): boolean {
  return getNextStatuses(from).includes(to);
}

/** Determine the lifecycle stage of a client */
export function getClientLifecycleStage(client: Partial<Client>): {
  stage: "onboarding" | "actif" | "revue" | "alerte" | "archive";
  label: string;
  description: string;
} {
  if (client.etat === "ARCHIVE") {
    return { stage: "archive", label: "Archive", description: "Dossier archive" };
  }
  if (client.etat === "REFUSE") {
    return { stage: "archive", label: "Refuse", description: "Dossier refuse" };
  }
  if (client.etat === "PROSPECT" || client.etat === "EN COURS") {
    return { stage: "onboarding", label: "En cours d'entree", description: "Onboarding en cours" };
  }

  // Check for alerts
  if (client.etatPilotage === "RETARD") {
    return { stage: "alerte", label: "En alerte", description: "Revue periodique en retard" };
  }
  if (client.etatPilotage === "BIENTÔT") {
    return { stage: "revue", label: "Revue a planifier", description: "Revue periodique a venir" };
  }

  return { stage: "actif", label: "Actif", description: "Dossier a jour" };
}

/** Calculate workload summary from a client list */
export function calculateWorkload(clients: Client[]): {
  total: number;
  byVigilance: Record<VigilanceLevel, number>;
  byEtat: Record<string, number>;
  overdue: number;
  reviewSoon: number;
  averageScore: number;
} {
  const byVigilance: Record<VigilanceLevel, number> = { SIMPLIFIEE: 0, STANDARD: 0, RENFORCEE: 0 };
  const byEtat: Record<string, number> = {};
  let overdue = 0;
  let reviewSoon = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  for (const c of clients) {
    if (c.nivVigilance) byVigilance[c.nivVigilance] = (byVigilance[c.nivVigilance] || 0) + 1;
    byEtat[c.etat] = (byEtat[c.etat] || 0) + 1;
    if (c.etatPilotage === "RETARD") overdue++;
    if (c.etatPilotage === "BIENTÔT") reviewSoon++;
    if (isFinite(c.scoreGlobal)) { scoreSum += c.scoreGlobal; scoreCount++; }
  }

  return {
    total: clients.length,
    byVigilance,
    byEtat,
    overdue,
    reviewSoon,
    averageScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
  };
}

/** Sort clients by urgency/priority (most urgent first) */
export function prioritizeClients(clients: Client[]): Client[] {
  const urgencyOrder: Record<string, number> = { "RETARD": 0, "BIENTÔT": 1, "A JOUR": 2 };
  const vigilanceOrder: Record<string, number> = { "RENFORCEE": 0, "STANDARD": 1, "SIMPLIFIEE": 2 };

  return [...clients].sort((a, b) => {
    // 1. Pilotage urgency
    const uA = urgencyOrder[a.etatPilotage] ?? 3;
    const uB = urgencyOrder[b.etatPilotage] ?? 3;
    if (uA !== uB) return uA - uB;

    // 2. Vigilance level (RENFORCEE first)
    const vA = vigilanceOrder[a.nivVigilance] ?? 3;
    const vB = vigilanceOrder[b.nivVigilance] ?? 3;
    if (vA !== vB) return vA - vB;

    // 3. Score (highest first)
    return (b.scoreGlobal || 0) - (a.scoreGlobal || 0);
  });
}
