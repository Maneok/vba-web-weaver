import type { Client, Collaborateur, AlerteRegistre } from "./types";
import { COCKPIT_CRITIQUE_DAYS, CNI_WARNING_DAYS, CNI_URGENT_DAYS } from "./constants";

export interface CockpitUrgency {
  type: "revision" | "cni" | "scoring" | "fantome" | "formation" | "alerte" | "kyc" | "document" | "capital" | "doublon" | "be" | "domiciliation";
  severity: "critique" | "warning" | "info";
  title: string;
  detail: string;
  ref?: string;
}

export interface CockpitSummary {
  totalClients: number;
  clientsActifs: number;
  totalHonoraires: number;
  urgencies: CockpitUrgency[];
  revisionsRetard: CockpitUrgency[];
  cniPerimees: CockpitUrgency[];
  incoherencesScoring: CockpitUrgency[];
  lignesFantomes: CockpitUrgency[];
  formationsAFaire: CockpitUrgency[];
  alertesNonTraitees: CockpitUrgency[];
  kycIncomplets: CockpitUrgency[];
  documentManquants: CockpitUrgency[];
  anomaliesCapital: CockpitUrgency[];
  doublonsPotentiels: CockpitUrgency[];
  beManquants: CockpitUrgency[];
  // Stats
  tauxFormation: number;
  tauxKycComplet: number;
  scoreMoyen: number;
  alertesEnRetard: number;
}

export function analyzeCockpit(
  clients: Client[],
  collaborateurs: Collaborateur[],
  alertes: AlerteRegistre[]
): CockpitSummary {
  // Guard against null/undefined inputs
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeCollaborateurs = Array.isArray(collaborateurs) ? collaborateurs : [];
  const safeAlertes = Array.isArray(alertes) ? alertes : [];

  const now = new Date();
  const urgencies: CockpitUrgency[] = [];

  // 1. Revisions en retard
  const revisionsRetard: CockpitUrgency[] = [];
  for (const c of safeClients) {
    if (c.statut === "INACTIF") continue;
    if (!c.dateButoir) continue;
    const butoir = new Date(c.dateButoir);
    if (isNaN(butoir.getTime())) continue;
    if (butoir < now) {
      const daysLate = Math.floor((now.getTime() - butoir.getTime()) / (1000 * 60 * 60 * 24));
      const u: CockpitUrgency = {
        type: "revision",
        severity: daysLate > COCKPIT_CRITIQUE_DAYS ? "critique" : "warning",
        title: `${c.raisonSociale || c.ref || "Client inconnu"} — Revision en retard`,
        detail: `Butoir depasse de ${daysLate} jours (${c.dateButoir}). Vigilance: ${c.nivVigilance}`,
        ref: c.ref,
      };
      revisionsRetard.push(u);
      urgencies.push(u);
    } else {
      // Revision approaching within 60 days
      const daysUntil = Math.floor((butoir.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 60) {
        const u: CockpitUrgency = {
          type: "revision",
          severity: daysUntil <= 30 ? "warning" : "info",
          title: `${c.raisonSociale || c.ref || "Client inconnu"} — Revision bientot`,
          detail: `Revision dans ${daysUntil} jours (${c.dateButoir}). Vigilance: ${c.nivVigilance}`,
          ref: c.ref,
        };
        urgencies.push(u);
      }
    }
  }

  // 2. CNI perimees
  const cniPerimees: CockpitUrgency[] = [];
  for (const c of safeClients) {
    if (c.statut === "INACTIF" || !c.dateExpCni) continue;
    const expCni = new Date(c.dateExpCni);
    if (isNaN(expCni.getTime())) continue;
    if (expCni < now) {
      const u: CockpitUrgency = {
        type: "cni",
        severity: "critique",
        title: `${c.raisonSociale || c.ref || "Client inconnu"} — CNI expiree`,
        detail: `Piece d'identite du dirigeant expiree le ${c.dateExpCni}`,
        ref: c.ref,
      };
      cniPerimees.push(u);
      urgencies.push(u);
    } else {
      const daysUntil = Math.floor((expCni.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil < CNI_WARNING_DAYS) {
        const u: CockpitUrgency = {
          type: "cni",
          severity: daysUntil < CNI_URGENT_DAYS ? "critique" : "warning",
          title: `${c.raisonSociale || c.ref || "Client inconnu"} — CNI bientot expiree`,
          detail: `Expire dans ${daysUntil} jours (${c.dateExpCni})`,
          ref: c.ref,
        };
        cniPerimees.push(u);
        urgencies.push(u);
      }
    }
  }

  // 3. Incoherences scoring: Simplifie + (PPE/Pays/Atypique/Cash)
  const incoherencesScoring: CockpitUrgency[] = [];
  for (const c of safeClients) {
    if (c.statut === "INACTIF") continue;
    if (c.nivVigilance === "SIMPLIFIEE") {
      const flags: string[] = [];
      if (c.ppe === "OUI") flags.push("PPE");
      if (c.paysRisque === "OUI") flags.push("Pays a risque");
      if (c.atypique === "OUI") flags.push("Atypique");
      if (c.cash === "OUI") flags.push("Cash");
      if (flags.length > 0) {
        const u: CockpitUrgency = {
          type: "scoring",
          severity: "critique",
          title: `${c.raisonSociale || c.ref || "Client inconnu"} — Incoherence scoring`,
          detail: `Vigilance SIMPLIFIEE alors que: ${flags.join(", ")}. Score: ${c.scoreGlobal}`,
          ref: c.ref,
        };
        incoherencesScoring.push(u);
        urgencies.push(u);
      }
    }
  }

  // 4. Lignes fantomes (ref ou honoraires mais pas de raison sociale)
  const lignesFantomes: CockpitUrgency[] = [];
  for (const c of safeClients) {
    if (!c.raisonSociale && (c.ref || (c.honoraires ?? 0) > 0)) {
      const u: CockpitUrgency = {
        type: "fantome",
        severity: "warning",
        title: `Ligne fantome detectee — ${c.ref}`,
        detail: `Donnees presentes (ref: ${c.ref}, honoraires: ${c.honoraires}) mais raison sociale manquante`,
        ref: c.ref,
      };
      lignesFantomes.push(u);
      urgencies.push(u);
    }
  }

  // 5. Formations a faire
  const formationsAFaire: CockpitUrgency[] = [];
  for (const col of safeCollaborateurs) {
    if ((col.statutFormation ?? "").includes("FORMER") || (col.statutFormation ?? "").includes("JAMAIS")) {
      const u: CockpitUrgency = {
        type: "formation",
        severity: (col.statutFormation ?? "").includes("JAMAIS") ? "critique" : "warning",
        title: `${col.nom} — Formation LCB-FT requise`,
        detail: `Statut: ${col.statutFormation}. Fonction: ${col.fonction}`,
      };
      formationsAFaire.push(u);
      urgencies.push(u);
    }
  }

  // 6. Alertes non traitees
  const alertesNonTraitees: CockpitUrgency[] = [];
  for (const a of safeAlertes) {
    if (a.statut === "EN COURS") {
      const echeance = a.dateButoir ? new Date(a.dateButoir) : null;
      const isOverdue = echeance && !isNaN(echeance.getTime()) && echeance < now;
      const daysOverdue = isOverdue ? Math.floor((now.getTime() - echeance.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const u: CockpitUrgency = {
        type: "alerte",
        severity: isOverdue ? "critique" : "warning",
        title: `${a.clientConcerne} — ${a.categorie}`,
        detail: `Action: ${a.actionPrise}. Responsable: ${a.responsable}. Echeance: ${a.dateButoir}${isOverdue ? ` (DEPASSEE de ${daysOverdue}j)` : ""}`,
      };
      alertesNonTraitees.push(u);
      urgencies.push(u);
    }
  }

  // 7. KYC incomplets
  const kycIncomplets: CockpitUrgency[] = [];
  for (const c of safeClients) {
    if (c.statut === "INACTIF") continue;
    const missing: string[] = [];
    if (!c.siren || c.siren.trim() === "") missing.push("SIREN");
    if (!c.mail || c.mail.trim() === "") missing.push("Email");
    if (!c.adresse || c.adresse.trim() === "") missing.push("Adresse");
    if (!c.dirigeant || c.dirigeant.trim() === "") missing.push("Dirigeant");
    if (!c.ape || c.ape.trim() === "") missing.push("Code APE");
    if (missing.length > 0) {
      const u: CockpitUrgency = {
        type: "kyc",
        severity: missing.length >= 3 ? "critique" : missing.length >= 2 ? "warning" : "info",
        title: `${c.raisonSociale || c.ref || "Client inconnu"} — KYC incomplet`,
        detail: `Champs manquants: ${missing.join(", ")}`,
        ref: c.ref,
      };
      kycIncomplets.push(u);
      urgencies.push(u);
    }
  }

  // 8. Documents manquants
  const documentManquants: CockpitUrgency[] = [];
  for (const c of safeClients) {
    if (c.statut === "INACTIF" || c.etat !== "VALIDE") continue;
    if (!c.lienKbis && !c.lienStatuts && !c.lienCni) {
      const u: CockpitUrgency = {
        type: "document",
        severity: "warning",
        title: `${c.raisonSociale || c.ref || "Client inconnu"} — Documents manquants`,
        detail: "Aucun document justificatif (KBIS, statuts, CNI) dans le dossier",
        ref: c.ref,
      };
      documentManquants.push(u);
      urgencies.push(u);
    }
  }

  // 9. Anomalies capital
  const anomaliesCapital: CockpitUrgency[] = [];
  for (const c of safeClients) {
    if (c.statut === "INACTIF") continue;
    if ((c.capital ?? 0) > 0 && (c.capital ?? 0) < 100 && (c.honoraires ?? 0) > 10000) {
      const u: CockpitUrgency = {
        type: "capital",
        severity: "warning",
        title: `${c.raisonSociale || c.ref || "Client inconnu"} — Capital anormalement faible`,
        detail: `Capital: ${c.capital}€ / Honoraires: ${c.honoraires}€ — ratio suspect`,
        ref: c.ref,
      };
      anomaliesCapital.push(u);
      urgencies.push(u);
    }
  }

  // 10. Doublons potentiels (même SIREN) — with normalized dedup
  const doublonsPotentiels: CockpitUrgency[] = [];
  const sirenMap = new Map<string, { names: string[]; refs: string[] }>();
  for (const c of safeClients) {
    if (!c.siren || c.siren.trim() === "") continue;
    if (!c.ref || c.ref.trim() === "") continue;
    // Normalize SIREN by removing spaces for consistent dedup
    const normalizedSiren = c.siren.replace(/\s/g, "");
    if (normalizedSiren.length < 9) continue;
    const existing = sirenMap.get(normalizedSiren) || { names: [], refs: [] };
    existing.names.push(c.raisonSociale || c.ref);
    existing.refs.push(c.ref);
    sirenMap.set(normalizedSiren, existing);
  }
  for (const [siren, { names, refs }] of sirenMap) {
    if (names.length > 1) {
      const formattedSiren = `${siren.slice(0, 3)} ${siren.slice(3, 6)} ${siren.slice(6, 9)}`;
      const u: CockpitUrgency = {
        type: "doublon",
        severity: "warning",
        title: `Doublon detecte — SIREN ${formattedSiren}`,
        detail: `${names.length} dossiers avec le meme SIREN: ${names.map((n, i) => `${n} (${refs[i]})`).join(", ")}. Verifiez s'il s'agit d'un doublon ou d'entites distinctes.`,
      };
      doublonsPotentiels.push(u);
      urgencies.push(u);
    }
  }

  // 11. Beneficiaires effectifs manquants
  const beManquants: CockpitUrgency[] = [];
  for (const c of safeClients) {
    if (c.statut === "INACTIF" || c.etat !== "VALIDE") continue;
    if (!c.be || c.be.trim() === "") {
      const u: CockpitUrgency = {
        type: "be",
        severity: c.nivVigilance === "RENFORCEE" ? "critique" : "warning",
        title: `${c.raisonSociale || c.ref || "Client inconnu"} — BE non renseigne`,
        detail: `Beneficiaires effectifs non identifies. Vigilance: ${c.nivVigilance}`,
        ref: c.ref,
      };
      beManquants.push(u);
      urgencies.push(u);
    }
  }

  // 12. Domiciliation detection — multiple clients at exact same address
  const adresseMap = new Map<string, string[]>();
  for (const c of safeClients) {
    if (c.statut === "INACTIF" || !c.adresse || !c.cp) continue;
    const key = `${c.adresse.trim().toUpperCase()}|${c.cp.trim()}`;
    if (!key || key === "|") continue;
    const existing = adresseMap.get(key) || [];
    existing.push(c.raisonSociale || c.ref || "Inconnu");
    adresseMap.set(key, existing);
  }
  for (const [addr, names] of adresseMap) {
    if (names.length >= 3) {
      const u: CockpitUrgency = {
        type: "domiciliation",
        severity: "warning",
        title: `Domiciliation suspecte — ${names.length} clients meme adresse`,
        detail: `Adresse: ${addr.replace("|", " ")}. Clients: ${names.slice(0, 5).join(", ")}${names.length > 5 ? `...` : ""}`,
      };
      urgencies.push(u);
    }
  }

  // 13. Honoraires anomaly — VALIDE client with missing honoraires
  for (const c of safeClients) {
    if (c.statut === "INACTIF" || c.etat !== "VALIDE") continue;
    if (c.honoraires === null || c.honoraires === undefined || c.honoraires === 0) {
      const u: CockpitUrgency = {
        type: "capital",
        severity: "info",
        title: `${c.raisonSociale || c.ref || "Client inconnu"} — Honoraires non renseignes`,
        detail: `Client valide sans honoraires. Mission: ${c.mission}`,
        ref: c.ref,
      };
      urgencies.push(u);
    }
  }

  // Sort urgencies: critique first, then warning, then info
  const severityOrder = { critique: 0, warning: 1, info: 2 };
  urgencies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Stats
  const actifs = safeClients.filter(c => c.statut !== "INACTIF");
  const formesOk = safeCollaborateurs.filter(c => (c.statutFormation ?? "").includes("A JOUR")).length;
  const tauxFormation = safeCollaborateurs.length > 0 ? Math.round((formesOk / safeCollaborateurs.length) * 100) : 0;

  const kycComplets = actifs.filter(c =>
    c.siren?.trim() && c.mail?.trim() && c.adresse?.trim() && c.dirigeant?.trim()
  ).length;
  const tauxKycComplet = actifs.length > 0 ? Math.round((kycComplets / actifs.length) * 100) : 0;

  const scoreMoyen = actifs.length > 0
    ? Math.round(actifs.reduce((sum, c) => sum + (c.scoreGlobal ?? 0), 0) / actifs.length)
    : 0;

  const alertesEnRetard = alertesNonTraitees.filter(u => u.severity === "critique").length;

  return {
    totalClients: safeClients.length,
    clientsActifs: actifs.length,
    totalHonoraires: safeClients.reduce((sum, c) => sum + (c.honoraires ?? 0), 0),
    urgencies,
    revisionsRetard,
    cniPerimees,
    incoherencesScoring,
    lignesFantomes,
    formationsAFaire,
    alertesNonTraitees,
    kycIncomplets,
    documentManquants,
    anomaliesCapital,
    doublonsPotentiels,
    beManquants,
    tauxFormation,
    tauxKycComplet,
    scoreMoyen,
    alertesEnRetard,
  };
}
