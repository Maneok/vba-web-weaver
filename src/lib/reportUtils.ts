/**
 * Report data generation helpers for PDF/document generation.
 */

import type { Client } from "./types";

/** Risk scorecard data for a single client */
export interface RiskScorecardData {
  ref: string;
  raisonSociale: string;
  date: string;
  axes: { label: string; score: number; max: number; percentage: number }[];
  malus: { label: string; actif: boolean; points: number }[];
  scoreGlobal: number;
  nivVigilance: string;
  recommandations: string[];
}

/** Generate risk scorecard data for a client */
export function generateRiskScorecard(client: Client): RiskScorecardData {
  const axes = [
    { label: "Activite (APE)", score: client.scoreActivite ?? 0, max: 100 },
    { label: "Pays", score: client.scorePays ?? 0, max: 100 },
    { label: "Mission", score: client.scoreMission ?? 0, max: 80 },
    { label: "Maturite", score: client.scoreMaturite ?? 0, max: 80 },
    { label: "Structure juridique", score: client.scoreStructure ?? 0, max: 100 },
  ].map(a => ({ ...a, percentage: a.max > 0 ? Math.round((a.score / a.max) * 100) : 0 }));

  const malus = [
    { label: "Cash intensif", actif: client.cash === "OUI", points: 40 },
    { label: "Pression / menace", actif: client.pression === "OUI", points: 40 },
    { label: "Relation a distance", actif: client.distanciel === "OUI", points: 30 },
    { label: "PPE", actif: client.ppe === "OUI", points: 100 },
    { label: "Operation atypique", actif: client.atypique === "OUI", points: 100 },
    { label: "Pays a risque", actif: client.paysRisque === "OUI", points: 100 },
  ];

  const recs: string[] = [];
  if (client.nivVigilance === "RENFORCEE") {
    recs.push("Appliquer les mesures de vigilance renforcee (art. L.561-10 CMF)");
    recs.push("Revue semestrielle obligatoire");
  }
  if (client.ppe === "OUI") recs.push("Mettre en place un suivi PPE specifique");
  if (!client.be?.trim()) recs.push("Identifier et documenter les beneficiaires effectifs");
  if (!client.lienKbis) recs.push("Collecter un extrait KBIS recent");
  if (client.dateExpCni && new Date(client.dateExpCni) < new Date()) {
    recs.push("Renouveler la piece d'identite du dirigeant (expiree)");
  }
  if (recs.length === 0) recs.push("Aucune action requise — dossier conforme");

  return {
    ref: client.ref, raisonSociale: client.raisonSociale || "",
    date: new Date().toISOString().split("T")[0],
    axes, malus,
    scoreGlobal: client.scoreGlobal ?? 0,
    nivVigilance: client.nivVigilance || "SIMPLIFIEE",
    recommandations: recs,
  };
}

/** Generate dossier checklist data */
export interface DossierCheckItem {
  document: string;
  obligatoire: boolean;
  present: boolean;
  expiration?: string;
  statut: "ok" | "manquant" | "expire" | "bientot_expire";
}

export function generateDossierChecklist(client: Client): DossierCheckItem[] {
  const now = new Date();
  const items: DossierCheckItem[] = [];

  // KBIS
  items.push({
    document: "Extrait KBIS (< 3 mois)",
    obligatoire: true,
    present: !!client.lienKbis,
    statut: client.lienKbis ? "ok" : "manquant",
  });

  // Statuts
  items.push({
    document: "Statuts a jour",
    obligatoire: true,
    present: !!client.lienStatuts,
    statut: client.lienStatuts ? "ok" : "manquant",
  });

  // CNI
  const cniPresent = !!client.lienCni || !!client.dateExpCni;
  let cniStatut: DossierCheckItem["statut"] = "manquant";
  if (cniPresent && client.dateExpCni) {
    const exp = new Date(client.dateExpCni);
    if (!isNaN(exp.getTime())) {
      const days = (exp.getTime() - now.getTime()) / 86400000;
      cniStatut = days < 0 ? "expire" : days < 90 ? "bientot_expire" : "ok";
    }
  } else if (cniPresent) { cniStatut = "ok"; }
  items.push({
    document: "Piece d'identite du dirigeant",
    obligatoire: true,
    present: cniPresent,
    expiration: client.dateExpCni || undefined,
    statut: cniStatut,
  });

  // BE
  items.push({
    document: "Declaration des beneficiaires effectifs",
    obligatoire: true,
    present: !!client.be?.trim(),
    statut: client.be?.trim() ? "ok" : "manquant",
  });

  // SIREN
  items.push({
    document: "Verification SIREN/SIRET",
    obligatoire: true,
    present: !!client.siren?.trim(),
    statut: client.siren?.trim() ? "ok" : "manquant",
  });

  // Justificatif domicile
  items.push({
    document: "Justificatif de domiciliation du siege",
    obligatoire: true,
    present: !!client.adresse?.trim(),
    statut: client.adresse?.trim() ? "ok" : "manquant",
  });

  // IBAN/RIB (si mandat SEPA)
  items.push({
    document: "RIB / IBAN pour mandat SEPA",
    obligatoire: false,
    present: !!client.iban?.trim(),
    statut: client.iban?.trim() ? "ok" : "manquant",
  });

  return items;
}

/** Generate compliance certificate data */
export interface ComplianceCertificateData {
  numero: string;
  date: string;
  clientRef: string;
  clientName: string;
  cabinetName: string;
  revuePar: string;
  vigilance: string;
  scoreGlobal: number;
  checklistResults: { item: string; conforme: boolean }[];
  conclusion: "conforme" | "reserve" | "non_conforme";
  prochainExamen: string;
}

export function generateComplianceCertificate(
  client: Client,
  cabinetName: string,
  revuePar: string
): ComplianceCertificateData {
  const checks = [
    { item: "Identite du client verifiee", conforme: !!client.dirigeant?.trim() },
    { item: "SIREN/SIRET valide", conforme: !!client.siren?.trim() },
    { item: "Beneficiaires effectifs identifies", conforme: !!client.be?.trim() },
    { item: "Documents justificatifs collectes", conforme: !!client.lienKbis || !!client.lienStatuts },
    { item: "Scoring de risque calcule", conforme: (client.scoreGlobal ?? 0) > 0 },
    { item: "Vigilance correctement attribuee", conforme: !(client.nivVigilance === "SIMPLIFIEE" && (client.ppe === "OUI" || client.paysRisque === "OUI")) },
    { item: "Piece d'identite en cours de validite", conforme: !!client.dateExpCni && new Date(client.dateExpCni) > new Date() },
    { item: "Revue periodique a jour", conforme: !!client.dateButoir && new Date(client.dateButoir) > new Date() },
  ];

  const conformeCount = checks.filter(c => c.conforme).length;
  const conclusion = conformeCount === checks.length ? "conforme" : conformeCount >= checks.length * 0.7 ? "reserve" : "non_conforme";

  // Next review based on vigilance
  const nextReview = new Date();
  if (client.nivVigilance === "SIMPLIFIEE") nextReview.setFullYear(nextReview.getFullYear() + 3);
  else if (client.nivVigilance === "STANDARD") nextReview.setFullYear(nextReview.getFullYear() + 1);
  else nextReview.setMonth(nextReview.getMonth() + 6);

  return {
    numero: `CERT-${new Date().getFullYear()}-${client.ref}`,
    date: new Date().toISOString().split("T")[0],
    clientRef: client.ref,
    clientName: client.raisonSociale || client.ref,
    cabinetName, revuePar,
    vigilance: client.nivVigilance || "SIMPLIFIEE",
    scoreGlobal: client.scoreGlobal ?? 0,
    checklistResults: checks,
    conclusion,
    prochainExamen: nextReview.toISOString().split("T")[0],
  };
}

/** Generate score calculation transparency data */
export function generateScoreExplanation(client: Client): {
  facteur: string;
  valeur: string;
  score: number;
  explication: string;
}[] {
  return [
    { facteur: "Activite (APE)", valeur: client.ape || "N/A", score: client.scoreActivite ?? 0, explication: "Score base sur le code APE/NAF de l'entreprise" },
    { facteur: "Pays", valeur: client.paysRisque === "OUI" ? "Risque" : "Standard", score: client.scorePays ?? 0, explication: client.paysRisque === "OUI" ? "Juridiction a risque identifiee" : "Pas de risque pays" },
    { facteur: "Mission", valeur: client.mission || "N/A", score: client.scoreMission ?? 0, explication: "Score base sur le type de mission confiee" },
    { facteur: "Maturite", valeur: client.dateCreation || "N/A", score: client.scoreMaturite ?? 0, explication: "Score base sur l'anciennete et le mode d'entree en relation" },
    { facteur: "Structure", valeur: client.forme || "N/A", score: client.scoreStructure ?? 0, explication: "Score base sur la forme juridique de l'entite" },
    { facteur: "Malus total", valeur: `${client.malus ?? 0} pts`, score: client.malus ?? 0, explication: `Cash: ${client.cash}, Pression: ${client.pression}, Distanciel: ${client.distanciel}` },
  ];
}
