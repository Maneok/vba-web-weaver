/**
 * Compliance workflow management: scheduling, automation, checklists.
 */

import type { Client, Collaborateur, AlerteRegistre } from "./types";

export interface ReviewScheduleEntry {
  clientRef: string;
  clientName: string;
  vigilance: string;
  dateButoir: string;
  daysRemaining: number;
  priority: "urgent" | "bientot" | "normal" | "retard";
  assignedTo?: string;
}

/** Generate review schedule sorted by urgency */
export function generateReviewSchedule(clients: Client[]): ReviewScheduleEntry[] {
  const now = new Date();
  return clients
    .filter(c => c.statut !== "INACTIF" && c.dateButoir)
    .map(c => {
      const butoir = new Date(c.dateButoir);
      const days = isNaN(butoir.getTime()) ? -9999 : Math.floor((butoir.getTime() - now.getTime()) / 86400000);
      return {
        clientRef: c.ref,
        clientName: c.raisonSociale || c.ref,
        vigilance: c.nivVigilance,
        dateButoir: c.dateButoir,
        daysRemaining: days,
        priority: days < 0 ? "retard" as const : days <= 30 ? "urgent" as const : days <= 60 ? "bientot" as const : "normal" as const,
        assignedTo: c.comptable || undefined,
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/** Batch assign clients to collaborateurs with workload balancing */
export function balanceWorkload(
  unassigned: Client[],
  collabs: Collaborateur[],
  currentAssignments: Map<string, number>
): { clientRef: string; assignedTo: string }[] {
  if (collabs.length === 0) return [];
  const load = new Map<string, number>();
  for (const col of collabs) {
    load.set(col.nom, currentAssignments.get(col.nom) ?? 0);
  }

  const assignments: { clientRef: string; assignedTo: string }[] = [];
  for (const client of unassigned) {
    // Find collaborateur with least clients
    let minCollab = collabs[0].nom;
    let minCount = Infinity;
    for (const [nom, count] of load) {
      if (count < minCount) { minCount = count; minCollab = nom; }
    }
    assignments.push({ clientRef: client.ref, assignedTo: minCollab });
    load.set(minCollab, (load.get(minCollab) ?? 0) + 1);
  }
  return assignments;
}

export interface ComplianceChecklistItem {
  categorie: string;
  action: string;
  obligatoire: boolean;
  statut: "fait" | "a_faire" | "non_applicable";
}

/** Generate compliance checklist based on client risk profile */
export function generateComplianceChecklist(client: Client): ComplianceChecklistItem[] {
  const items: ComplianceChecklistItem[] = [];
  const add = (cat: string, action: string, obligatoire: boolean, fait: boolean) =>
    items.push({ categorie: cat, action, obligatoire, statut: fait ? "fait" : "a_faire" });

  // KYC
  add("KYC", "Verifier l'identite du dirigeant (CNI)", true, !!client.dateExpCni);
  add("KYC", "Obtenir un extrait KBIS < 3 mois", true, !!client.lienKbis);
  add("KYC", "Collecter les statuts a jour", true, !!client.lienStatuts);
  add("KYC", "Identifier les beneficiaires effectifs", true, !!client.be?.trim());
  add("KYC", "Verifier le SIREN", true, !!client.siren?.trim());
  add("KYC", "Verifier l'adresse", true, !!client.adresse?.trim());

  // Scoring
  add("SCORING", "Calculer le scoring de risque", true, (client.scoreGlobal ?? 0) > 0);
  add("SCORING", "Verifier la coherence vigilance / facteurs", true,
    !(client.nivVigilance === "SIMPLIFIEE" && (client.ppe === "OUI" || client.paysRisque === "OUI")));

  // Screening
  add("SCREENING", "Effectuer le screening sanctions", true, false); // Can't know from data
  add("SCREENING", "Verifier le statut PPE", true, client.ppe === "OUI" || client.ppe === "NON");
  add("SCREENING", "Consulter le registre des gels d'avoirs", client.nivVigilance === "RENFORCEE", false);

  // Documents
  add("DOCUMENTS", "Lettre de mission signee", true, false);
  add("DOCUMENTS", "CNI du dirigeant en cours de validite", true,
    !!client.dateExpCni && new Date(client.dateExpCni) > new Date());

  // Renforcee specific
  if (client.nivVigilance === "RENFORCEE") {
    add("VIGILANCE RENFORCEE", "Revue approfondie par un associe", true, false);
    add("VIGILANCE RENFORCEE", "Documentation des mesures renforcees", true, false);
    add("VIGILANCE RENFORCEE", "Suivi renforce des operations", true, false);
  }

  return items;
}

/** Find mandatory actions across all clients */
export function findMandatoryActions(clients: Client[]): {
  clientRef: string;
  clientName: string;
  action: string;
  urgence: "critique" | "haute" | "moyenne";
}[] {
  const actions: { clientRef: string; clientName: string; action: string; urgence: "critique" | "haute" | "moyenne" }[] = [];
  const now = new Date();

  for (const c of clients) {
    if (c.statut === "INACTIF") continue;
    const name = c.raisonSociale || c.ref;

    // Expired CNI
    if (c.dateExpCni && new Date(c.dateExpCni) < now) {
      actions.push({ clientRef: c.ref, clientName: name, action: "Renouveler la CNI du dirigeant", urgence: "critique" });
    }
    // Overdue review
    if (c.dateButoir && new Date(c.dateButoir) < now) {
      actions.push({ clientRef: c.ref, clientName: name, action: "Effectuer la revue periodique", urgence: "critique" });
    }
    // Missing BE for VALIDE
    if (c.etat === "VALIDE" && !c.be?.trim()) {
      actions.push({ clientRef: c.ref, clientName: name, action: "Identifier les beneficiaires effectifs", urgence: "haute" });
    }
    // Missing documents
    if (c.etat === "VALIDE" && !c.lienKbis && !c.lienStatuts) {
      actions.push({ clientRef: c.ref, clientName: name, action: "Collecter KBIS et/ou statuts", urgence: "moyenne" });
    }
    // Scoring incoherence
    if (c.nivVigilance === "SIMPLIFIEE" && (c.ppe === "OUI" || c.paysRisque === "OUI")) {
      actions.push({ clientRef: c.ref, clientName: name, action: "Recalculer le scoring (incoherence detectee)", urgence: "critique" });
    }
  }

  return actions.sort((a, b) => {
    const order = { critique: 0, haute: 1, moyenne: 2 };
    return order[a.urgence] - order[b.urgence];
  });
}

export interface AlertRule {
  name: string;
  condition: (client: Client) => boolean;
  alerteCategorie: string;
  severity: "critique" | "haute" | "moyenne";
}

/** Default alert automation rules */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    name: "CNI expiree",
    condition: (c) => !!c.dateExpCni && new Date(c.dateExpCni) < new Date(),
    alerteCategorie: "ADMIN : KYC Incomplet",
    severity: "critique",
  },
  {
    name: "Revision en retard",
    condition: (c) => !!c.dateButoir && new Date(c.dateButoir) < new Date(),
    alerteCategorie: "ADMIN : KYC Incomplet",
    severity: "critique",
  },
  {
    name: "Scoring incoherent",
    condition: (c) => c.nivVigilance === "SIMPLIFIEE" && (c.ppe === "OUI" || c.paysRisque === "OUI"),
    alerteCategorie: "ANOMALIE : Ecart detecte",
    severity: "critique",
  },
  {
    name: "Client PPE sans vigilance renforcee",
    condition: (c) => c.ppe === "OUI" && c.nivVigilance !== "RENFORCEE",
    alerteCategorie: "PPE : Personne Politiquement Exposee",
    severity: "haute",
  },
];

/** Run alert automation rules against client portfolio */
export function runAlertRules(
  clients: Client[],
  rules: AlertRule[] = DEFAULT_ALERT_RULES,
  existingAlerts: AlerteRegistre[] = []
): { clientRef: string; clientName: string; rule: string; categorie: string; severity: string }[] {
  const alerts: { clientRef: string; clientName: string; rule: string; categorie: string; severity: string }[] = [];
  const existing = new Set(existingAlerts.map(a => `${a.clientConcerne}|${a.categorie}`));

  for (const c of clients) {
    if (c.statut === "INACTIF") continue;
    for (const rule of rules) {
      if (rule.condition(c)) {
        const key = `${c.ref}|${rule.alerteCategorie}`;
        if (!existing.has(key)) {
          alerts.push({
            clientRef: c.ref, clientName: c.raisonSociale || c.ref,
            rule: rule.name, categorie: rule.alerteCategorie, severity: rule.severity,
          });
        }
      }
    }
  }
  return alerts;
}

/** Calculate alert escalation status */
export function calculateEscalationStatus(alerte: AlerteRegistre): {
  isOverdue: boolean;
  daysOverdue: number;
  escalationLevel: 0 | 1 | 2 | 3;
} {
  if (alerte.statut !== "EN COURS" || !alerte.dateButoir) {
    return { isOverdue: false, daysOverdue: 0, escalationLevel: 0 };
  }
  const butoir = new Date(alerte.dateButoir);
  if (isNaN(butoir.getTime())) return { isOverdue: false, daysOverdue: 0, escalationLevel: 0 };
  const days = Math.floor((Date.now() - butoir.getTime()) / 86400000);
  if (days <= 0) return { isOverdue: false, daysOverdue: 0, escalationLevel: 0 };
  return {
    isOverdue: true,
    daysOverdue: days,
    escalationLevel: days > 30 ? 3 : days > 14 ? 2 : 1,
  };
}
