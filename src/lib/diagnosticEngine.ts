import type { Client, Collaborateur, AlerteRegistre, LogEntry } from "./types";

// ── Thresholds & constants ──
const THRESHOLD_CLASSIFICATION_OK = 90;
const THRESHOLD_CLASSIFICATION_WARN = 70;
const THRESHOLD_PROSPECT_STALE_DAYS = 90;
const THRESHOLD_PROSPECT_STALE_WARN = 3;
const THRESHOLD_CLIENTS_SANS_SCORE_WARN = 2;
const THRESHOLD_RETARD_WARN_PCT = 20;
const THRESHOLD_REVISION_SOON_DAYS = 60;
const THRESHOLD_REVISION_SOON_WARN = 3;
const THRESHOLD_CNI_EXPIRY_SOON_DAYS = 90;
const THRESHOLD_KYC_INCOMPLETE_WARN = 3;
const THRESHOLD_BE_MISSING_WARN = 3;
const THRESHOLD_DOCS_MISSING_WARN = 5;
const THRESHOLD_FORMATION_OK_PCT = 90;
const THRESHOLD_FORMATION_WARN_PCT = 60;
const THRESHOLD_LOGS_OK = 10;
const THRESHOLD_LOGS_WARN = 3;
const THRESHOLD_LOG_WINDOW_DAYS = 90;
const THRESHOLD_ACTION_DIVERSITY_OK = 4;
const THRESHOLD_ACTION_DIVERSITY_WARN = 2;
const THRESHOLD_RENFORCEE_OK_PCT = 30;
const THRESHOLD_RENFORCEE_WARN_PCT = 50;
const THRESHOLD_SCORE_MOYEN_OK = 40;
const THRESHOLD_SCORE_MOYEN_WARN = 60;
const THRESHOLD_CAPITAL_LOW = 100;
const THRESHOLD_HONORAIRES_HIGH = 10000;
const THRESHOLD_DOMICILIATION_WARN = 3;
const SCORE_OK_POINTS = 10;
const SCORE_ALERTE_POINTS = 5;
const NOTE_A_THRESHOLD = 80;
const NOTE_B_THRESHOLD = 60;
const NOTE_C_THRESHOLD = 40;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface DiagnosticItem {
  categorie: string;
  indicateur: string;
  statut: "OK" | "ALERTE" | "CRITIQUE";
  detail: string;
  recommandation: string;
  referenceReglementaire?: string;
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

  // Guard against null/undefined inputs
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeCollaborateurs = Array.isArray(collaborateurs) ? collaborateurs : [];
  const safeAlertes = Array.isArray(alertes) ? alertes : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  const actifs = safeClients.filter(c => c.statut !== "INACTIF");
  const valides = safeClients.filter(c => c.etat === "VALIDE");

  // === 1. COUVERTURE DU PORTEFEUILLE ===
  const tauxClassification = actifs.length > 0
    ? Math.round((valides.length / actifs.length) * 100)
    : 0;
  items.push({
    categorie: "CLASSIFICATION",
    indicateur: "Taux de dossiers classifies (VALIDE)",
    statut: tauxClassification >= THRESHOLD_CLASSIFICATION_OK ? "OK" : tauxClassification >= THRESHOLD_CLASSIFICATION_WARN ? "ALERTE" : "CRITIQUE",
    detail: `${valides.length}/${actifs.length} dossiers classes (${tauxClassification}%)`,
    recommandation: tauxClassification < THRESHOLD_CLASSIFICATION_OK ? "Finaliser la classification de tous les dossiers actifs." : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-5 CMF",
  });

  // === 2. DOSSIERS PROSPECT STAGNANTS ===
  const prospects = safeClients.filter(c => c.etat === "PROSPECT");
  const prospectAnciens = prospects.filter(c => {
    if (!c.dateCreationLigne) return false;
    const ts = new Date(c.dateCreationLigne).getTime();
    if (isNaN(ts)) return false;
    const diff = (now.getTime() - ts) / MS_PER_DAY;
    return diff > THRESHOLD_PROSPECT_STALE_DAYS;
  });
  if (prospects.length > 0) {
    items.push({
      categorie: "CLASSIFICATION",
      indicateur: "Dossiers prospect stagnants (>90 jours)",
      statut: prospectAnciens.length === 0 ? "OK" : prospectAnciens.length <= THRESHOLD_PROSPECT_STALE_WARN ? "ALERTE" : "CRITIQUE",
      detail: `${prospectAnciens.length} prospect(s) non traite(s) depuis plus de ${THRESHOLD_PROSPECT_STALE_DAYS} jours`,
      recommandation: prospectAnciens.length > 0
        ? "Valider ou refuser les prospects en attente pour maintenir un portefeuille propre."
        : "Aucune action requise.",
    });
  }

  // === 3. SCORING COHERENCE ===
  const incoherences = actifs.filter(c =>
    c.nivVigilance === "SIMPLIFIEE" && (c.ppe === "OUI" || c.paysRisque === "OUI" || c.atypique === "OUI")
  );
  items.push({
    categorie: "SCORING",
    indicateur: "Coherence vigilance / facteurs de risque",
    statut: incoherences.length === 0 ? "OK" : "CRITIQUE",
    detail: incoherences.length === 0
      ? "Aucune incoherence detectee"
      : `${incoherences.length} client(s) en vigilance SIMPLIFIEE avec facteurs de risque actifs: ${incoherences.map(c => c.raisonSociale || "Inconnu").join(", ")}`,
    recommandation: incoherences.length > 0
      ? "Recalculer immediatement le scoring de ces clients. Un client PPE/Pays risque/Atypique ne peut etre en vigilance simplifiee."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-10 CMF",
  });

  // === 4. SCORING - Clients sans score ===
  const sansScore = actifs.filter(c => (c.scoreGlobal ?? 0) === 0 && c.etat === "VALIDE");
  items.push({
    categorie: "SCORING",
    indicateur: "Clients valides sans scoring",
    statut: sansScore.length === 0 ? "OK" : sansScore.length <= THRESHOLD_CLIENTS_SANS_SCORE_WARN ? "ALERTE" : "CRITIQUE",
    detail: sansScore.length === 0
      ? "Tous les clients valides ont un scoring"
      : `${sansScore.length} client(s) valide(s) sans scoring calcule`,
    recommandation: sansScore.length > 0
      ? "Calculer le scoring de risque pour tous les dossiers valides."
      : "Aucune action requise.",
  });

  // === 5. REVISIONS ===
  const retards = actifs.filter(c => {
    if (!c.dateButoir) return false;
    const d = new Date(c.dateButoir);
    return !isNaN(d.getTime()) && d < now;
  });
  const tauxRetard = actifs.length > 0 ? Math.round((retards.length / actifs.length) * 100) : 0;
  items.push({
    categorie: "REVISIONS",
    indicateur: "Taux de revisions en retard",
    statut: tauxRetard === 0 ? "OK" : tauxRetard <= THRESHOLD_RETARD_WARN_PCT ? "ALERTE" : "CRITIQUE",
    detail: `${retards.length}/${actifs.length} dossiers en retard de revision (${tauxRetard}%)`,
    recommandation: retards.length > 0
      ? `Planifier en urgence la revue de: ${retards.slice(0, 5).map(c => c.raisonSociale || "Inconnu").join(", ")}${retards.length > 5 ? ` et ${retards.length - 5} autres` : ""}`
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-6 CMF",
  });

  // === 6. REVISIONS - Echeances proches ===
  const bientotEchus = actifs.filter(c => {
    if (!c.dateButoir) return false;
    const butoir = new Date(c.dateButoir);
    if (isNaN(butoir.getTime())) return false;
    const diff = (butoir.getTime() - now.getTime()) / MS_PER_DAY;
    return diff > 0 && diff <= THRESHOLD_REVISION_SOON_DAYS;
  });
  if (bientotEchus.length > 0) {
    items.push({
      categorie: "REVISIONS",
      indicateur: "Revisions a echeance proche (< 60 jours)",
      statut: bientotEchus.length <= THRESHOLD_REVISION_SOON_WARN ? "ALERTE" : "CRITIQUE",
      detail: `${bientotEchus.length} dossier(s) arrivent a echeance dans les ${THRESHOLD_REVISION_SOON_DAYS} prochains jours`,
      recommandation: `Anticiper la revue de: ${bientotEchus.slice(0, 5).map(c => c.raisonSociale || "Inconnu").join(", ")}`,
    });
  }

  // === 7. CNI / PIECES D'IDENTITE ===
  const cniExp = actifs.filter(c => {
    if (!c.dateExpCni) return false;
    const d = new Date(c.dateExpCni);
    return !isNaN(d.getTime()) && d < now;
  });
  items.push({
    categorie: "KYC",
    indicateur: "Pieces d'identite perimees",
    statut: cniExp.length === 0 ? "OK" : "CRITIQUE",
    detail: cniExp.length === 0
      ? "Toutes les CNI sont a jour"
      : `${cniExp.length} CNI expiree(s): ${cniExp.map(c => c.raisonSociale || "Inconnu").join(", ")}`,
    recommandation: cniExp.length > 0
      ? "Demander immediatement le renouvellement des pieces d'identite expirees."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-5 CMF",
  });

  // === 8. CNI - Expirant bientot ===
  const cniBientot = actifs.filter(c => {
    if (!c.dateExpCni) return false;
    const exp = new Date(c.dateExpCni);
    if (isNaN(exp.getTime())) return false;
    const diff = (exp.getTime() - now.getTime()) / MS_PER_DAY;
    return diff > 0 && diff <= THRESHOLD_CNI_EXPIRY_SOON_DAYS;
  });
  if (cniBientot.length > 0) {
    items.push({
      categorie: "KYC",
      indicateur: "CNI expirant dans les 90 prochains jours",
      statut: "ALERTE",
      detail: `${cniBientot.length} CNI expirant dans les ${THRESHOLD_CNI_EXPIRY_SOON_DAYS} prochains jours: ${cniBientot.map(c => c.raisonSociale || "Inconnu").join(", ")}`,
      recommandation: "Anticiper la demande de renouvellement des pieces d'identite.",
    });
  }

  // === 9. COMPLETUDE KYC ===
  const kycIncomplets = actifs.filter(c =>
    !c.siren?.trim() || !c.mail?.trim() || !c.adresse?.trim()
  );
  items.push({
    categorie: "KYC",
    indicateur: "Completude des donnees KYC",
    statut: kycIncomplets.length === 0 ? "OK" : kycIncomplets.length <= THRESHOLD_KYC_INCOMPLETE_WARN ? "ALERTE" : "CRITIQUE",
    detail: `${kycIncomplets.length} dossier(s) avec donnees KYC incompletes`,
    recommandation: kycIncomplets.length > 0
      ? "Completer les informations manquantes (SIREN, email, adresse)."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-5 CMF",
  });

  // === 10. BENEFICIAIRES EFFECTIFS ===
  const sansBE = actifs.filter(c => !c.be || c.be.trim() === "");
  items.push({
    categorie: "KYC",
    indicateur: "Beneficiaires effectifs renseignes",
    statut: sansBE.length === 0 ? "OK" : sansBE.length <= THRESHOLD_BE_MISSING_WARN ? "ALERTE" : "CRITIQUE",
    detail: sansBE.length === 0
      ? "Tous les dossiers ont leurs beneficiaires effectifs"
      : `${sansBE.length} dossier(s) sans beneficiaire effectif identifie`,
    recommandation: sansBE.length > 0
      ? "Identifier et documenter les beneficiaires effectifs conformement a l'art. L.561-2-2."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-2-2 CMF",
  });

  // === 11. DOCUMENTS ===
  const sansDocuments = actifs.filter(c => !c.lienKbis && !c.lienStatuts && !c.lienCni);
  items.push({
    categorie: "KYC",
    indicateur: "Documents justificatifs (KBIS, statuts, CNI)",
    statut: sansDocuments.length === 0 ? "OK" : sansDocuments.length <= THRESHOLD_DOCS_MISSING_WARN ? "ALERTE" : "CRITIQUE",
    detail: sansDocuments.length === 0
      ? "Tous les dossiers ont au moins un document"
      : `${sansDocuments.length} dossier(s) sans aucun document justificatif`,
    recommandation: sansDocuments.length > 0
      ? "Collecter les pieces justificatives (KBIS, statuts, CNI dirigeant) pour tous les clients."
      : "Aucune action requise.",
  });

  // === 12. GOUVERNANCE & FORMATION ===
  const referents = safeCollaborateurs.filter(c => c.referentLcb);
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
    referenceReglementaire: "Art. L.561-32 CMF",
  });

  // === 13. SUPPLEANT ===
  const suppleants = safeCollaborateurs.filter(c => c.suppleant && !c.referentLcb);
  items.push({
    categorie: "GOUVERNANCE",
    indicateur: "Suppleant du referent designe",
    statut: suppleants.length > 0 ? "OK" : "ALERTE",
    detail: suppleants.length > 0
      ? `${suppleants.length} suppleant(s) designe(s)`
      : "Aucun suppleant designe pour le referent LCB-FT",
    recommandation: suppleants.length === 0
      ? "Designer au moins un suppleant pour assurer la continuite du dispositif."
      : "Aucune action requise.",
  });

  // === 14. FORMATION ===
  const aFormer = safeCollaborateurs.filter(c =>
    (c.statutFormation ?? "").includes("FORMER") || (c.statutFormation ?? "").includes("JAMAIS")
  );
  const tauxFormation = safeCollaborateurs.length > 0
    ? Math.round(((safeCollaborateurs.length - aFormer.length) / safeCollaborateurs.length) * 100)
    : 0;
  items.push({
    categorie: "GOUVERNANCE",
    indicateur: "Taux de formation LCB-FT",
    statut: tauxFormation >= THRESHOLD_FORMATION_OK_PCT ? "OK" : tauxFormation >= THRESHOLD_FORMATION_WARN_PCT ? "ALERTE" : "CRITIQUE",
    detail: `${safeCollaborateurs.length - aFormer.length}/${safeCollaborateurs.length} collaborateurs formes (${tauxFormation}%)`,
    recommandation: aFormer.length > 0
      ? `Former en priorite: ${aFormer.map(c => c.nom).join(", ")}`
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-36 CMF",
  });

  // === 15. MANUEL INTERNE ===
  const sansManuel = safeCollaborateurs.filter(c => !c.dateSignatureManuel);
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
    referenceReglementaire: "Art. L.561-32 CMF",
  });

  // === 16. REGISTRE DES ALERTES ===
  const alertesEnCours = safeAlertes.filter(a => a.statut === "EN COURS");
  const alertesEnRetard = alertesEnCours.filter(a => {
    if (!a.dateButoir) return false;
    const d = new Date(a.dateButoir);
    return !isNaN(d.getTime()) && d < now;
  });
  items.push({
    categorie: "REGISTRE",
    indicateur: "Alertes en cours de traitement",
    statut: alertesEnRetard.length === 0 && alertesEnCours.length <= 3 ? "OK"
      : alertesEnRetard.length > 0 ? "CRITIQUE" : "ALERTE",
    detail: `${alertesEnCours.length} alerte(s) en cours, dont ${alertesEnRetard.length} en depassement d'echeance`,
    recommandation: alertesEnRetard.length > 0
      ? "Traiter immediatement les alertes dont l'echeance est depassee."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-15 CMF",
  });

  // === 17. DECLARATIONS TRACFIN ===
  const tracfinDeclarations = safeAlertes.filter(a => (a.typeDecision || "").toLowerCase().includes("tracfin"));
  items.push({
    categorie: "REGISTRE",
    indicateur: "Suivi des declarations TRACFIN",
    statut: "OK",
    detail: `${tracfinDeclarations.length} declaration(s) TRACFIN effectuee(s)`,
    recommandation: "Aucune action requise. Verifier regulierement les retours de TRACFIN.",
    referenceReglementaire: "Art. L.561-15 CMF",
  });

  // === 18. TRACABILITE (LOGS) ===
  const logsRecents = safeLogs.filter(l => {
    if (!l.horodatage) return false;
    const d = new Date(l.horodatage.replace(" ", "T"));
    if (isNaN(d.getTime())) return false;
    return (now.getTime() - d.getTime()) < THRESHOLD_LOG_WINDOW_DAYS * MS_PER_DAY;
  });
  items.push({
    categorie: "TRACABILITE",
    indicateur: "Activite du journal d'audit (90 derniers jours)",
    statut: logsRecents.length >= THRESHOLD_LOGS_OK ? "OK" : logsRecents.length >= THRESHOLD_LOGS_WARN ? "ALERTE" : "CRITIQUE",
    detail: `${logsRecents.length} entree(s) dans le journal sur les ${THRESHOLD_LOG_WINDOW_DAYS} derniers jours`,
    recommandation: logsRecents.length < 10
      ? "L'activite de suivi semble faible. Verifier que toutes les actions sont bien tracees."
      : "Aucune action requise.",
  });

  // === 19. DIVERSITE DES ACTIONS ===
  const actionTypes = new Set(logsRecents.map(l => l.typeAction));
  items.push({
    categorie: "TRACABILITE",
    indicateur: "Diversite des actions tracees",
    statut: actionTypes.size >= THRESHOLD_ACTION_DIVERSITY_OK ? "OK" : actionTypes.size >= THRESHOLD_ACTION_DIVERSITY_WARN ? "ALERTE" : "CRITIQUE",
    detail: `${actionTypes.size} type(s) d'action distinct(s) dans les ${THRESHOLD_LOG_WINDOW_DAYS} derniers jours`,
    recommandation: actionTypes.size < THRESHOLD_ACTION_DIVERSITY_OK
      ? "Verifier que les screenings, scorings, revues et alertes sont correctement traces."
      : "Aucune action requise.",
  });

  // === 20. REPARTITION DES RISQUES ===
  const renforcees = actifs.filter(c => c.nivVigilance === "RENFORCEE");
  const tauxRenforce = actifs.length > 0 ? Math.round((renforcees.length / actifs.length) * 100) : 0;
  items.push({
    categorie: "RISQUE GLOBAL",
    indicateur: "Proportion de clients en vigilance renforcee",
    statut: tauxRenforce <= THRESHOLD_RENFORCEE_OK_PCT ? "OK" : tauxRenforce <= THRESHOLD_RENFORCEE_WARN_PCT ? "ALERTE" : "CRITIQUE",
    detail: `${renforcees.length}/${actifs.length} clients en vigilance renforcee (${tauxRenforce}%)`,
    recommandation: tauxRenforce > THRESHOLD_RENFORCEE_OK_PCT
      ? "Le portefeuille presente une concentration de risque elevee. Envisager un examen des acceptations."
      : "Aucune action requise.",
  });

  // === 21. SCORE MOYEN DU PORTEFEUILLE ===
  const scoreMoyen = actifs.length > 0
    ? Math.round(actifs.reduce((s, c) => s + (c.scoreGlobal ?? 0), 0) / actifs.length)
    : 0;
  items.push({
    categorie: "RISQUE GLOBAL",
    indicateur: "Score de risque moyen du portefeuille",
    statut: scoreMoyen <= THRESHOLD_SCORE_MOYEN_OK ? "OK" : scoreMoyen <= THRESHOLD_SCORE_MOYEN_WARN ? "ALERTE" : "CRITIQUE",
    detail: `Score moyen: ${scoreMoyen}/120`,
    recommandation: scoreMoyen > THRESHOLD_SCORE_MOYEN_OK
      ? "Le niveau de risque moyen est eleve. Renforcer les mesures de vigilance."
      : "Aucune action requise.",
  });

  // === 22. CAPITAL ADEQUACY ===
  const capitalAnomalie = actifs.filter(c => {
    const cap = c.capital ?? 0;
    const hon = c.honoraires ?? 0;
    if (cap <= 0 || hon <= 0) return false;
    return cap < THRESHOLD_CAPITAL_LOW && hon > THRESHOLD_HONORAIRES_HIGH;
  });
  if (capitalAnomalie.length > 0) {
    items.push({
      categorie: "RISQUE GLOBAL",
      indicateur: "Anomalie capital / chiffre d'affaires",
      statut: "ALERTE",
      detail: `${capitalAnomalie.length} client(s) avec capital tres faible (<100€) et honoraires eleves (>10k€)`,
      recommandation: "Examiner les societes a faible capitalisation presentant des flux financiers importants.",
    });
  }

  // === 23. DOMICILIATION ===
  const domicilies = actifs.filter(c => c.mission === "DOMICILIATION");
  if (domicilies.length > 0) {
    items.push({
      categorie: "RISQUE GLOBAL",
      indicateur: "Clients en mission de domiciliation",
      statut: domicilies.length <= THRESHOLD_DOMICILIATION_WARN ? "ALERTE" : "CRITIQUE",
      detail: `${domicilies.length} client(s) en domiciliation — mission a risque eleve`,
      recommandation: "Appliquer des mesures de vigilance renforcees pour tous les clients domicilies.",
      referenceReglementaire: "Art. L.561-10 CMF",
    });
  }

  // === CALCUL NOTE GLOBALE ===
  const critiques = items.filter(i => i.statut === "CRITIQUE").length;
  const alerteCount = items.filter(i => i.statut === "ALERTE").length;
  const okCount = items.filter(i => i.statut === "OK").length;

  // Score pondéré: OK=10pts, ALERTE=5pts, CRITIQUE=0pts
  const maxPoints = items.length * SCORE_OK_POINTS;
  const points = okCount * SCORE_OK_POINTS + alerteCount * SCORE_ALERTE_POINTS;
  const scoreDispositif = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

  const noteLettre = scoreDispositif >= NOTE_A_THRESHOLD ? "A" : scoreDispositif >= NOTE_B_THRESHOLD ? "B" : scoreDispositif >= NOTE_C_THRESHOLD ? "C" : "D";

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
