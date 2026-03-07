import type { Client, Collaborateur, AlerteRegistre, LogEntry } from "./types";

export interface DiagnosticItem {
  categorie: string;
  indicateur: string;
  statut: "OK" | "ALERTE" | "CRITIQUE";
  detail: string;
  recommandation: string;
}

export interface DiagnosticReport {
  dateGeneration: string;
  scoreGlobalDispositif: number;
  noteLettre: string;
  items: DiagnosticItem[];
  synthese: string;
  recommandationsPrioritaires: string[];
}

export function runDiagnostic360(
  clients: Client[],
  collaborateurs: Collaborateur[],
  alertes: AlerteRegistre[],
  logs: LogEntry[]
): DiagnosticReport {
  const items: DiagnosticItem[] = [];
  const now = new Date();

  const actifs = clients.filter(c => c.statut !== "INACTIF");
  const valides = clients.filter(c => c.etat === "VALIDE");

  // === 1. COUVERTURE DU PORTEFEUILLE ===
  const tauxClassification = actifs.length > 0
    ? Math.round((valides.length / actifs.length) * 100)
    : 0;
  items.push({
    categorie: "CLASSIFICATION",
    indicateur: `Taux de dossiers classifies (VALIDE)`,
    statut: tauxClassification >= 90 ? "OK" : tauxClassification >= 70 ? "ALERTE" : "CRITIQUE",
    detail: `${valides.length}/${actifs.length} dossiers classes (${tauxClassification}%)`,
    recommandation: tauxClassification < 90 ? "Finaliser la classification de tous les dossiers actifs." : "Aucune action requise.",
  });

  // === 2. SCORING COHERENCE ===
  const incoherences = actifs.filter(c =>
    c.nivVigilance === "SIMPLIFIEE" && (c.ppe === "OUI" || c.paysRisque === "OUI" || c.atypique === "OUI")
  );
  items.push({
    categorie: "SCORING",
    indicateur: "Coherence vigilance / facteurs de risque",
    statut: incoherences.length === 0 ? "OK" : "CRITIQUE",
    detail: incoherences.length === 0
      ? "Aucune incoherence detectee"
      : `${incoherences.length} client(s) en vigilance SIMPLIFIEE avec facteurs de risque actifs: ${incoherences.map(c => c.raisonSociale).join(", ")}`,
    recommandation: incoherences.length > 0
      ? "Recalculer immediatement le scoring de ces clients. Un client PPE/Pays risque/Atypique ne peut etre en vigilance simplifiee."
      : "Aucune action requise.",
  });

  // === 3. REVISIONS ===
  const retards = actifs.filter(c => new Date(c.dateButoir) < now);
  const tauxRetard = actifs.length > 0 ? Math.round((retards.length / actifs.length) * 100) : 0;
  items.push({
    categorie: "REVISIONS",
    indicateur: "Taux de revisions en retard",
    statut: tauxRetard === 0 ? "OK" : tauxRetard <= 20 ? "ALERTE" : "CRITIQUE",
    detail: `${retards.length}/${actifs.length} dossiers en retard de revision (${tauxRetard}%)`,
    recommandation: retards.length > 0
      ? `Planifier en urgence la revue de: ${retards.slice(0, 5).map(c => c.raisonSociale).join(", ")}${retards.length > 5 ? ` et ${retards.length - 5} autres` : ""}`
      : "Aucune action requise.",
  });

  // === 4. CNI / PIECES D'IDENTITE ===
  const cniExp = actifs.filter(c => c.dateExpCni && new Date(c.dateExpCni) < now);
  items.push({
    categorie: "KYC",
    indicateur: "Pieces d'identite perimees",
    statut: cniExp.length === 0 ? "OK" : "CRITIQUE",
    detail: cniExp.length === 0
      ? "Toutes les CNI sont a jour"
      : `${cniExp.length} CNI expiree(s): ${cniExp.map(c => c.raisonSociale).join(", ")}`,
    recommandation: cniExp.length > 0
      ? "Demander immediatement le renouvellement des pieces d'identite expirees."
      : "Aucune action requise.",
  });

  // === 5. COMPLETUDE KYC ===
  const kycIncomplets = actifs.filter(c =>
    !c.siren.trim() || !c.mail.trim() || !c.iban.trim() || !c.adresse.trim()
  );
  items.push({
    categorie: "KYC",
    indicateur: "Completude des donnees KYC",
    statut: kycIncomplets.length === 0 ? "OK" : kycIncomplets.length <= 3 ? "ALERTE" : "CRITIQUE",
    detail: `${kycIncomplets.length} dossier(s) avec donnees KYC incompletes`,
    recommandation: kycIncomplets.length > 0
      ? "Completer les informations manquantes (SIREN, email, IBAN, adresse)."
      : "Aucune action requise.",
  });

  // === 6. GOUVERNANCE & FORMATION ===
  const referents = collaborateurs.filter(c => c.referentLcb);
  items.push({
    categorie: "GOUVERNANCE",
    indicateur: "Referent LCB-FT designe",
    statut: referents.length > 0 ? "OK" : "CRITIQUE",
    detail: referents.length > 0
      ? `Referent(s) LCB-FT: ${referents.map(c => c.nom).join(", ")}`
      : "Aucun referent LCB-FT designe dans le cabinet",
    recommandation: referents.length === 0
      ? "Obligation legale: designer un referent LCB-FT (art. L.561-32 CMF)."
      : "Aucune action requise.",
  });

  const aFormer = collaborateurs.filter(c =>
    c.statutFormation.includes("FORMER") || c.statutFormation.includes("JAMAIS")
  );
  const tauxFormation = collaborateurs.length > 0
    ? Math.round(((collaborateurs.length - aFormer.length) / collaborateurs.length) * 100)
    : 0;
  items.push({
    categorie: "GOUVERNANCE",
    indicateur: "Taux de formation LCB-FT",
    statut: tauxFormation >= 90 ? "OK" : tauxFormation >= 60 ? "ALERTE" : "CRITIQUE",
    detail: `${collaborateurs.length - aFormer.length}/${collaborateurs.length} collaborateurs formes (${tauxFormation}%)`,
    recommandation: aFormer.length > 0
      ? `Former en priorite: ${aFormer.map(c => c.nom).join(", ")}`
      : "Aucune action requise.",
  });

  // === 7. MANUEL INTERNE ===
  const sansManuel = collaborateurs.filter(c => !c.dateSignatureManuel);
  items.push({
    categorie: "GOUVERNANCE",
    indicateur: "Signature du Manuel Interne LAB",
    statut: sansManuel.length === 0 ? "OK" : "ALERTE",
    detail: sansManuel.length === 0
      ? "Tous les collaborateurs ont signe le manuel"
      : `${sansManuel.length} collaborateur(s) sans signature`,
    recommandation: sansManuel.length > 0
      ? "Faire signer le Manuel Interne LCB-FT a tous les collaborateurs."
      : "Aucune action requise.",
  });

  // === 8. REGISTRE DES ALERTES ===
  const alertesEnCours = alertes.filter(a => a.statut === "EN COURS");
  const alertesEnRetard = alertesEnCours.filter(a => new Date(a.dateButoir) < now);
  items.push({
    categorie: "REGISTRE",
    indicateur: "Alertes en cours de traitement",
    statut: alertesEnRetard.length === 0 && alertesEnCours.length <= 3 ? "OK"
      : alertesEnRetard.length > 0 ? "CRITIQUE" : "ALERTE",
    detail: `${alertesEnCours.length} alerte(s) en cours, dont ${alertesEnRetard.length} en depassement d'echeance`,
    recommandation: alertesEnRetard.length > 0
      ? "Traiter immediatement les alertes dont l'echeance est depassee."
      : "Aucune action requise.",
  });

  // === 9. TRACABILITE (LOGS) ===
  const logsRecents = logs.filter(l => {
    const d = new Date(l.horodatage.replace(" ", "T"));
    return (now.getTime() - d.getTime()) < 90 * 24 * 60 * 60 * 1000;
  });
  items.push({
    categorie: "TRACABILITE",
    indicateur: "Activite du journal d'audit (90 derniers jours)",
    statut: logsRecents.length >= 10 ? "OK" : logsRecents.length >= 3 ? "ALERTE" : "CRITIQUE",
    detail: `${logsRecents.length} entree(s) dans le journal sur les 90 derniers jours`,
    recommandation: logsRecents.length < 10
      ? "L'activite de suivi semble faible. Verifier que toutes les actions sont bien tracees."
      : "Aucune action requise.",
  });

  // === 10. REPARTITION DES RISQUES ===
  const renforcees = actifs.filter(c => c.nivVigilance === "RENFORCEE");
  const tauxRenforce = actifs.length > 0 ? Math.round((renforcees.length / actifs.length) * 100) : 0;
  items.push({
    categorie: "RISQUE GLOBAL",
    indicateur: "Proportion de clients en vigilance renforcee",
    statut: tauxRenforce <= 30 ? "OK" : tauxRenforce <= 50 ? "ALERTE" : "CRITIQUE",
    detail: `${renforcees.length}/${actifs.length} clients en vigilance renforcee (${tauxRenforce}%)`,
    recommandation: tauxRenforce > 30
      ? "Le portefeuille presente une concentration de risque elevee. Envisager un examen des acceptations."
      : "Aucune action requise.",
  });

  // === 11. SCORE MOYEN DU PORTEFEUILLE ===
  const scoreMoyen = actifs.length > 0
    ? Math.round(actifs.reduce((s, c) => s + c.scoreGlobal, 0) / actifs.length)
    : 0;
  items.push({
    categorie: "RISQUE GLOBAL",
    indicateur: "Score de risque moyen du portefeuille",
    statut: scoreMoyen <= 40 ? "OK" : scoreMoyen <= 60 ? "ALERTE" : "CRITIQUE",
    detail: `Score moyen: ${scoreMoyen}/120`,
    recommandation: scoreMoyen > 40
      ? "Le niveau de risque moyen est eleve. Renforcer les mesures de vigilance."
      : "Aucune action requise.",
  });

  // === CALCUL NOTE GLOBALE ===
  const critiques = items.filter(i => i.statut === "CRITIQUE").length;
  const alerteCount = items.filter(i => i.statut === "ALERTE").length;
  const okCount = items.filter(i => i.statut === "OK").length;

  // Score sur 100: OK=10pts, ALERTE=5pts, CRITIQUE=0pts
  const maxPoints = items.length * 10;
  const points = okCount * 10 + alerteCount * 5;
  const scoreDispositif = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

  const noteLettre = scoreDispositif >= 80 ? "A" : scoreDispositif >= 60 ? "B" : scoreDispositif >= 40 ? "C" : "D";

  // Recommandations prioritaires
  const recommandationsPrioritaires = items
    .filter(i => i.statut === "CRITIQUE")
    .map(i => i.recommandation)
    .filter(r => r !== "Aucune action requise.");

  const synthese = `Le dispositif LCB-FT du cabinet obtient la note ${noteLettre} (${scoreDispositif}/100). `
    + `${critiques} point(s) critique(s), ${alerteCount} alerte(s), ${okCount} point(s) conformes sur ${items.length} indicateurs analyses. `
    + (critiques > 0
      ? "Des actions correctives urgentes sont necessaires pour assurer la conformite du dispositif."
      : alerteCount > 0
        ? "Des ameliorations sont recommandees pour renforcer le dispositif."
        : "Le dispositif est globalement conforme aux exigences reglementaires.");

  return {
    dateGeneration: now.toISOString().split("T")[0],
    scoreGlobalDispositif: scoreDispositif,
    noteLettre,
    items,
    synthese,
    recommandationsPrioritaires,
  };
}
