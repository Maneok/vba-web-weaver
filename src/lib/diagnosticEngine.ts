import type { Client, Collaborateur, AlerteRegistre, LogEntry } from "./types";

export interface DiagnosticItem {
  categorie: string;
  indicateur: string;
  statut: "OK" | "ALERTE" | "CRITIQUE";
  detail: string;
  recommandation: string;
  referenceReglementaire?: string;
}

export interface CategoryStats {
  categorie: string;
  total: number;
  ok: number;
  alerte: number;
  critique: number;
  score: number; // 0-100 per category
}

export interface DiagnosticReport {
  dateGeneration: string;
  scoreGlobalDispositif: number;
  noteLettre: string;
  items: DiagnosticItem[];
  synthese: string;
  recommandationsPrioritaires: string[];
  categoryStats: CategoryStats[];
  totalClients: number;
  totalCollaborateurs: number;
  totalAlertes: number;
}

// ---------------------------------------------------------------------------
// Helper: validate SIREN format (9 digits)
// ---------------------------------------------------------------------------
function isValidSiren(siren: string): boolean {
  return /^\d{9}$/.test(siren.replace(/\s/g, ""));
}

// ---------------------------------------------------------------------------
// Helper: validate email format
// ---------------------------------------------------------------------------
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ---------------------------------------------------------------------------
// Helper: validate APE/NAF code format (NN.NNA)
// ---------------------------------------------------------------------------
function isValidApe(ape: string): boolean {
  return /^\d{2}\.\d{2}[A-Z]$/.test(ape.trim());
}

// ---------------------------------------------------------------------------
// Main diagnostic engine
// ---------------------------------------------------------------------------
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
    indicateur: "Taux de dossiers classifies (VALIDE)",
    statut: tauxClassification >= 90 ? "OK" : tauxClassification >= 70 ? "ALERTE" : "CRITIQUE",
    detail: `${valides.length}/${actifs.length} dossiers classes (${tauxClassification}%)`,
    recommandation: tauxClassification < 90 ? "Finaliser la classification de tous les dossiers actifs." : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-5 CMF",
  });

  // === 2. DOSSIERS PROSPECT STAGNANTS ===
  const prospects = clients.filter(c => c.etat === "PROSPECT");
  const prospectAnciens = prospects.filter(c => {
    if (!c.dateCreationLigne) return false;
    const ts = new Date(c.dateCreationLigne).getTime();
    if (isNaN(ts)) return false;
    const diff = (now.getTime() - ts) / (1000 * 60 * 60 * 24);
    return diff > 90;
  });
  if (prospects.length > 0) {
    items.push({
      categorie: "CLASSIFICATION",
      indicateur: "Dossiers prospect stagnants (>90 jours)",
      statut: prospectAnciens.length === 0 ? "OK" : prospectAnciens.length <= 3 ? "ALERTE" : "CRITIQUE",
      detail: `${prospectAnciens.length} prospect(s) non traite(s) depuis plus de 90 jours`,
      recommandation: prospectAnciens.length > 0
        ? "Valider ou refuser les prospects en attente pour maintenir un portefeuille propre."
        : "Aucune action requise.",
      referenceReglementaire: "Art. L.561-5 CMF",
    });
  }

  // === 3. CLIENTS REFUSES - SUIVI (Amélioration #17) ===
  const refuses = clients.filter(c => c.etat === "REFUSE");
  const refusesSansMotif = refuses.filter(c => !c.dateFin);
  if (refuses.length > 0) {
    items.push({
      categorie: "CLASSIFICATION",
      indicateur: "Suivi des dossiers refuses",
      statut: refusesSansMotif.length === 0 ? "OK" : "ALERTE",
      detail: refusesSansMotif.length === 0
        ? `${refuses.length} dossier(s) refuse(s), tous documentes`
        : `${refusesSansMotif.length}/${refuses.length} dossier(s) refuse(s) sans date de fin documentee`,
      recommandation: refusesSansMotif.length > 0
        ? "Documenter la date et les motifs de refus pour tous les dossiers refuses."
        : "Aucune action requise.",
      referenceReglementaire: "Art. L.561-8 CMF",
    });
  }

  // === 4. SCORING COHERENCE ===
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
    referenceReglementaire: "Art. L.561-10 CMF",
  });

  // === 5. SCORING - Clients sans score ===
  const sansScore = actifs.filter(c => c.scoreGlobal === 0 && c.etat === "VALIDE");
  items.push({
    categorie: "SCORING",
    indicateur: "Clients valides sans scoring",
    statut: sansScore.length === 0 ? "OK" : sansScore.length <= 2 ? "ALERTE" : "CRITIQUE",
    detail: sansScore.length === 0
      ? "Tous les clients valides ont un scoring"
      : `${sansScore.length} client(s) valide(s) sans scoring calcule`,
    recommandation: sansScore.length > 0
      ? "Calculer le scoring de risque pour tous les dossiers valides."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-4-1 CMF",
  });

  // === 6. PPE - Clients PPE monitoring (Amélioration #1) ===
  const clientsPPE = actifs.filter(c => c.ppe === "OUI");
  const ppeNonRenforcee = clientsPPE.filter(c => c.nivVigilance !== "RENFORCEE");
  items.push({
    categorie: "SCORING",
    indicateur: "Suivi des clients PPE",
    statut: clientsPPE.length === 0 ? "OK" : ppeNonRenforcee.length === 0 ? "OK" : "CRITIQUE",
    detail: clientsPPE.length === 0
      ? "Aucun client PPE dans le portefeuille"
      : `${clientsPPE.length} client(s) PPE identifie(s), ${ppeNonRenforcee.length} sans vigilance renforcee`,
    recommandation: ppeNonRenforcee.length > 0
      ? `Appliquer immediatement la vigilance renforcee pour: ${ppeNonRenforcee.map(c => c.raisonSociale).join(", ")}`
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-10 CMF",
  });

  // === 7. PAYS A RISQUE monitoring (Amélioration #2) ===
  const clientsPaysRisque = actifs.filter(c => c.paysRisque === "OUI");
  items.push({
    categorie: "SCORING",
    indicateur: "Clients lies a des pays a risque",
    statut: clientsPaysRisque.length === 0 ? "OK" : clientsPaysRisque.length <= 3 ? "ALERTE" : "CRITIQUE",
    detail: clientsPaysRisque.length === 0
      ? "Aucun client avec exposition pays a risque"
      : `${clientsPaysRisque.length} client(s) avec lien pays a risque: ${clientsPaysRisque.slice(0, 5).map(c => c.raisonSociale).join(", ")}${clientsPaysRisque.length > 5 ? ` (+${clientsPaysRisque.length - 5})` : ""}`,
    recommandation: clientsPaysRisque.length > 0
      ? "Verifier que les mesures de vigilance renforcee sont appliquees pour tous les clients lies a des pays a risque."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-10 CMF / Regl. UE 2015/849",
  });

  // === 8. CASH-INTENSIVE monitoring (Amélioration #3) ===
  const clientsCash = actifs.filter(c => c.cash === "OUI");
  const cashSansRenforcee = clientsCash.filter(c => c.nivVigilance === "SIMPLIFIEE");
  items.push({
    categorie: "SCORING",
    indicateur: "Clients cash-intensive",
    statut: clientsCash.length === 0 ? "OK" : cashSansRenforcee.length > 0 ? "CRITIQUE" : "ALERTE",
    detail: clientsCash.length === 0
      ? "Aucun client identifie comme cash-intensive"
      : `${clientsCash.length} client(s) cash-intensive, ${cashSansRenforcee.length} en vigilance simplifiee`,
    recommandation: cashSansRenforcee.length > 0
      ? "Les clients cash-intensive ne doivent pas etre en vigilance simplifiee. Revoir leur classification."
      : clientsCash.length > 0
        ? "Maintenir une surveillance accrue des flux financiers pour les clients cash-intensive."
        : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-10-2 CMF",
  });

  // === 9. DISTANCIEL monitoring (Amélioration #4) ===
  const clientsDistanciels = actifs.filter(c => c.distanciel === "OUI");
  if (clientsDistanciels.length > 0) {
    const distPct = Math.round((clientsDistanciels.length / actifs.length) * 100);
    items.push({
      categorie: "SCORING",
      indicateur: "Clients en relation a distance",
      statut: distPct <= 20 ? "OK" : distPct <= 40 ? "ALERTE" : "CRITIQUE",
      detail: `${clientsDistanciels.length}/${actifs.length} client(s) en relation distancielle (${distPct}%)`,
      recommandation: distPct > 20
        ? "Proportion elevee de relations distancielles. Renforcer les procedures de verification d'identite."
        : "Aucune action requise.",
      referenceReglementaire: "Art. L.561-5-1 CMF",
    });
  }

  // === 10. PRESSION monitoring (Amélioration #5) ===
  const clientsPression = actifs.filter(c => c.pression === "OUI");
  if (clientsPression.length > 0) {
    items.push({
      categorie: "SCORING",
      indicateur: "Clients avec indicateur de pression",
      statut: clientsPression.length <= 2 ? "ALERTE" : "CRITIQUE",
      detail: `${clientsPression.length} client(s) avec indicateur de pression active: ${clientsPression.slice(0, 3).map(c => c.raisonSociale).join(", ")}${clientsPression.length > 3 ? ` (+${clientsPression.length - 3})` : ""}`,
      recommandation: "Examiner attentivement les dossiers avec pression et envisager une declaration de soupcon si necessaire.",
      referenceReglementaire: "Art. L.561-15 CMF",
    });
  }

  // === 11. REVISIONS EN RETARD ===
  const retards = actifs.filter(c => {
    if (!c.dateButoir) return false;
    const d = new Date(c.dateButoir);
    return !isNaN(d.getTime()) && d < now;
  });
  const tauxRetard = actifs.length > 0 ? Math.round((retards.length / actifs.length) * 100) : 0;
  items.push({
    categorie: "REVISIONS",
    indicateur: "Taux de revisions en retard",
    statut: tauxRetard === 0 ? "OK" : tauxRetard <= 20 ? "ALERTE" : "CRITIQUE",
    detail: `${retards.length}/${actifs.length} dossiers en retard de revision (${tauxRetard}%)`,
    recommandation: retards.length > 0
      ? `Planifier en urgence la revue de: ${retards.slice(0, 5).map(c => c.raisonSociale).join(", ")}${retards.length > 5 ? ` et ${retards.length - 5} autres` : ""}`
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-6 CMF",
  });

  // === 12. REVISIONS - Echeances proches ===
  const bientotEchus = actifs.filter(c => {
    if (!c.dateButoir) return false;
    const butoir = new Date(c.dateButoir);
    if (isNaN(butoir.getTime())) return false;
    const diff = (butoir.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 60;
  });
  if (bientotEchus.length > 0) {
    items.push({
      categorie: "REVISIONS",
      indicateur: "Revisions a echeance proche (< 60 jours)",
      statut: bientotEchus.length <= 3 ? "ALERTE" : "CRITIQUE",
      detail: `${bientotEchus.length} dossier(s) arrivent a echeance dans les 60 prochains jours`,
      recommandation: `Anticiper la revue de: ${bientotEchus.slice(0, 5).map(c => c.raisonSociale).join(", ")}`,
      referenceReglementaire: "Art. L.561-6 CMF",
    });
  }

  // === 13. REVISIONS - Clients haute vigilance sans revue recente (Amélioration #13) ===
  const renforceesSansRevue = actifs.filter(c => {
    if (c.nivVigilance !== "RENFORCEE") return false;
    if (!c.dateDerniereRevue) return true;
    const revue = new Date(c.dateDerniereRevue);
    if (isNaN(revue.getTime())) return true;
    const diffMonths = (now.getFullYear() - revue.getFullYear()) * 12 + (now.getMonth() - revue.getMonth());
    return diffMonths > 6;
  });
  items.push({
    categorie: "REVISIONS",
    indicateur: "Clients renforcees sans revue recente (<6 mois)",
    statut: renforceesSansRevue.length === 0 ? "OK" : "CRITIQUE",
    detail: renforceesSansRevue.length === 0
      ? "Tous les clients en vigilance renforcee ont une revue recente"
      : `${renforceesSansRevue.length} client(s) en vigilance renforcee sans revue depuis plus de 6 mois`,
    recommandation: renforceesSansRevue.length > 0
      ? `Revue urgente requise pour: ${renforceesSansRevue.slice(0, 5).map(c => c.raisonSociale).join(", ")}${renforceesSansRevue.length > 5 ? ` (+${renforceesSansRevue.length - 5})` : ""}`
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-6 al.2 CMF",
  });

  // === 14. CNI / PIECES D'IDENTITE PERIMEES ===
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
      : `${cniExp.length} CNI expiree(s): ${cniExp.map(c => c.raisonSociale).join(", ")}`,
    recommandation: cniExp.length > 0
      ? "Demander immediatement le renouvellement des pieces d'identite expirees."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-5 CMF",
  });

  // === 15. CNI - Expirant bientot ===
  const cniBientot = actifs.filter(c => {
    if (!c.dateExpCni) return false;
    const exp = new Date(c.dateExpCni);
    if (isNaN(exp.getTime())) return false;
    const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 90;
  });
  if (cniBientot.length > 0) {
    items.push({
      categorie: "KYC",
      indicateur: "CNI expirant dans les 90 prochains jours",
      statut: "ALERTE",
      detail: `${cniBientot.length} CNI expire(s) prochainement: ${cniBientot.map(c => c.raisonSociale).join(", ")}`,
      recommandation: "Anticiper la demande de renouvellement des pieces d'identite.",
      referenceReglementaire: "Art. L.561-5 CMF",
    });
  }

  // === 16. COMPLETUDE KYC ===
  const kycIncomplets = actifs.filter(c =>
    !(c.siren || "").trim() || !(c.mail || "").trim() || !(c.adresse || "").trim()
  );
  items.push({
    categorie: "KYC",
    indicateur: "Completude des donnees KYC",
    statut: kycIncomplets.length === 0 ? "OK" : kycIncomplets.length <= 3 ? "ALERTE" : "CRITIQUE",
    detail: `${kycIncomplets.length} dossier(s) avec donnees KYC incompletes`,
    recommandation: kycIncomplets.length > 0
      ? "Completer les informations manquantes (SIREN, email, adresse)."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-5 CMF",
  });

  // === 17. BENEFICIAIRES EFFECTIFS ===
  const sansBE = actifs.filter(c => !c.be || c.be.trim() === "");
  items.push({
    categorie: "KYC",
    indicateur: "Beneficiaires effectifs renseignes",
    statut: sansBE.length === 0 ? "OK" : sansBE.length <= 3 ? "ALERTE" : "CRITIQUE",
    detail: sansBE.length === 0
      ? "Tous les dossiers ont leurs beneficiaires effectifs"
      : `${sansBE.length} dossier(s) sans beneficiaire effectif identifie`,
    recommandation: sansBE.length > 0
      ? "Identifier et documenter les beneficiaires effectifs conformement a l'art. L.561-2-2."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-2-2 CMF",
  });

  // === 18. DOCUMENTS JUSTIFICATIFS ===
  const sansDocuments = actifs.filter(c => !c.lienKbis && !c.lienStatuts && !c.lienCni);
  items.push({
    categorie: "KYC",
    indicateur: "Documents justificatifs (KBIS, statuts, CNI)",
    statut: sansDocuments.length === 0 ? "OK" : sansDocuments.length <= 5 ? "ALERTE" : "CRITIQUE",
    detail: sansDocuments.length === 0
      ? "Tous les dossiers ont au moins un document"
      : `${sansDocuments.length} dossier(s) sans aucun document justificatif`,
    recommandation: sansDocuments.length > 0
      ? "Collecter les pieces justificatives (KBIS, statuts, CNI dirigeant) pour tous les clients."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-5 CMF",
  });

  // === 19. VALIDATION FORMAT SIREN (Amélioration #6) ===
  const sirenInvalides = actifs.filter(c => c.siren.trim() !== "" && !isValidSiren(c.siren));
  if (sirenInvalides.length > 0) {
    items.push({
      categorie: "KYC",
      indicateur: "Format SIREN invalide",
      statut: sirenInvalides.length <= 2 ? "ALERTE" : "CRITIQUE",
      detail: `${sirenInvalides.length} client(s) avec un SIREN au format invalide: ${sirenInvalides.slice(0, 5).map(c => `${c.raisonSociale} (${c.siren})`).join(", ")}`,
      recommandation: "Corriger les numeros SIREN invalides (format attendu: 9 chiffres).",
      referenceReglementaire: "Art. L.561-5 CMF",
    });
  }

  // === 20. VALIDATION FORMAT EMAIL (Amélioration #7) ===
  const emailInvalides = actifs.filter(c => c.mail.trim() !== "" && !isValidEmail(c.mail));
  if (emailInvalides.length > 0) {
    items.push({
      categorie: "KYC",
      indicateur: "Format email invalide",
      statut: "ALERTE",
      detail: `${emailInvalides.length} client(s) avec une adresse email au format invalide`,
      recommandation: "Corriger les adresses email invalides dans les fiches clients.",
    });
  }

  // === 21. PRESENCE IBAN (Amélioration #8) ===
  const sansIban = actifs.filter(c => !c.iban || c.iban.trim() === "");
  const tauxSansIban = actifs.length > 0 ? Math.round((sansIban.length / actifs.length) * 100) : 0;
  items.push({
    categorie: "KYC",
    indicateur: "Completude IBAN clients",
    statut: tauxSansIban <= 10 ? "OK" : tauxSansIban <= 30 ? "ALERTE" : "CRITIQUE",
    detail: `${sansIban.length}/${actifs.length} client(s) sans IBAN renseigne (${tauxSansIban}%)`,
    recommandation: sansIban.length > 0
      ? "Collecter les coordonnees bancaires (IBAN) pour les mandats SEPA et la tracabilite financiere."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-5 CMF",
  });

  // === 22. COMPLETUDE DIRIGEANT (Amélioration #9) ===
  const sansDirigeant = actifs.filter(c => !c.dirigeant || c.dirigeant.trim() === "");
  items.push({
    categorie: "KYC",
    indicateur: "Identification du dirigeant",
    statut: sansDirigeant.length === 0 ? "OK" : sansDirigeant.length <= 3 ? "ALERTE" : "CRITIQUE",
    detail: sansDirigeant.length === 0
      ? "Tous les dossiers ont un dirigeant identifie"
      : `${sansDirigeant.length} dossier(s) sans dirigeant identifie`,
    recommandation: sansDirigeant.length > 0
      ? "Identifier et renseigner le dirigeant pour chaque dossier client."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-5 CMF",
  });

  // === 23. SIREN EN DOUBLE (Amélioration #10) ===
  const sirenMap = new Map<string, Client[]>();
  actifs.forEach(c => {
    const s = c.siren.replace(/\s/g, "").trim();
    if (s && s.length >= 9) {
      const existing = sirenMap.get(s) || [];
      existing.push(c);
      sirenMap.set(s, existing);
    }
  });
  const doublons = Array.from(sirenMap.entries()).filter(([, v]) => v.length > 1);
  if (doublons.length > 0) {
    items.push({
      categorie: "KYC",
      indicateur: "Doublons SIREN detectes",
      statut: "ALERTE",
      detail: `${doublons.length} SIREN en doublon: ${doublons.slice(0, 3).map(([s, cs]) => `${s} (${cs.map(c => c.raisonSociale).join(", ")})`).join("; ")}`,
      recommandation: "Verifier et fusionner ou corriger les dossiers en doublon pour eviter les erreurs de suivi.",
    });
  }

  // === 24. COMPLETUDE TELEPHONE (Amélioration #16) ===
  const sansTel = actifs.filter(c => !c.tel || c.tel.trim() === "");
  if (sansTel.length > 0) {
    const tauxSansTel = Math.round((sansTel.length / actifs.length) * 100);
    items.push({
      categorie: "KYC",
      indicateur: "Completude numero de telephone",
      statut: tauxSansTel <= 20 ? "OK" : tauxSansTel <= 40 ? "ALERTE" : "CRITIQUE",
      detail: `${sansTel.length}/${actifs.length} client(s) sans numero de telephone (${tauxSansTel}%)`,
      recommandation: tauxSansTel > 20
        ? "Completer les numeros de telephone pour assurer la joignabilite des clients."
        : "Aucune action requise.",
    });
  }

  // === 25. VALIDATION CODE APE (Amélioration #14) ===
  const apeInvalides = actifs.filter(c => c.ape && c.ape.trim() !== "" && !isValidApe(c.ape));
  if (apeInvalides.length > 0) {
    items.push({
      categorie: "KYC",
      indicateur: "Format code APE/NAF invalide",
      statut: "ALERTE",
      detail: `${apeInvalides.length} client(s) avec un code APE au format invalide: ${apeInvalides.slice(0, 5).map(c => `${c.raisonSociale} (${c.ape})`).join(", ")}`,
      recommandation: "Corriger les codes APE invalides (format attendu: NN.NNA, ex: 56.10A).",
    });
  }

  // === 26. CLIENTS SANS DATE DE CREATION (Amélioration #25) ===
  const sansDateCreation = actifs.filter(c => {
    if (!c.dateCreation) return true;
    const d = new Date(c.dateCreation);
    return isNaN(d.getTime());
  });
  if (sansDateCreation.length > 0) {
    items.push({
      categorie: "KYC",
      indicateur: "Date de creation manquante ou invalide",
      statut: sansDateCreation.length <= 3 ? "ALERTE" : "CRITIQUE",
      detail: `${sansDateCreation.length} client(s) sans date de creation valide`,
      recommandation: "Renseigner la date de creation pour permettre le calcul du score de maturite.",
      referenceReglementaire: "Art. L.561-5 CMF",
    });
  }

  // === 27. COHERENCE CAPITAL / FORME JURIDIQUE (Amélioration #15) ===
  const capitalIncoherent = actifs.filter(c => {
    const forme = (c.forme || "").toUpperCase();
    if (forme.includes("SAS") || forme.includes("SARL") || forme === "SA") {
      return c.capital <= 0;
    }
    return false;
  });
  if (capitalIncoherent.length > 0) {
    items.push({
      categorie: "KYC",
      indicateur: "Coherence capital / forme juridique",
      statut: "ALERTE",
      detail: `${capitalIncoherent.length} societe(s) commerciale(s) avec capital nul ou non renseigne: ${capitalIncoherent.slice(0, 5).map(c => c.raisonSociale).join(", ")}`,
      recommandation: "Verifier et corriger le capital social pour les societes commerciales.",
    });
  }

  // === 28. GOUVERNANCE - Referent LCB-FT ===
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
    referenceReglementaire: "Art. L.561-32 CMF",
  });

  // === 29. SUPPLEANT ===
  const suppleants = collaborateurs.filter(c => c.suppleant && !c.referentLcb);
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
    referenceReglementaire: "Art. L.561-32 CMF",
  });

  // === 30. FORMATION LCB-FT ===
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
    referenceReglementaire: "Art. L.561-36 CMF",
  });

  // === 31. MANUEL INTERNE ===
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
    referenceReglementaire: "Art. L.561-32 CMF",
  });

  // === 32. EQUILIBRE CHARGE COLLABORATEURS (Amélioration #11) ===
  if (collaborateurs.length > 0 && actifs.length > 0) {
    const chargeMap = new Map<string, number>();
    actifs.forEach(c => {
      const comptable = c.comptable.trim();
      if (comptable) {
        chargeMap.set(comptable, (chargeMap.get(comptable) || 0) + 1);
      }
    });
    const charges = Array.from(chargeMap.values());
    const maxCharge = Math.max(...charges, 0);
    const minCharge = Math.min(...charges, 0);
    const moyenne = charges.length > 0 ? Math.round(charges.reduce((a, b) => a + b, 0) / charges.length) : 0;
    const desequilibre = maxCharge > 0 && minCharge > 0 ? maxCharge / minCharge : 1;
    items.push({
      categorie: "GOUVERNANCE",
      indicateur: "Equilibre de charge entre collaborateurs",
      statut: desequilibre <= 2 ? "OK" : desequilibre <= 3 ? "ALERTE" : "CRITIQUE",
      detail: `${chargeMap.size} collaborateur(s) actif(s), charge moyenne: ${moyenne} dossier(s), ratio max/min: ${desequilibre.toFixed(1)}x`,
      recommandation: desequilibre > 2
        ? "La charge de travail est desequilibree entre les collaborateurs. Redistribuer les dossiers."
        : "Aucune action requise.",
    });
  }

  // === 33. COUVERTURE SUPERVISEUR (Amélioration #19) ===
  const sansSuperviseur = actifs.filter(c => !c.superviseur || c.superviseur.trim() === "");
  if (sansSuperviseur.length > 0) {
    const tauxSansSup = Math.round((sansSuperviseur.length / actifs.length) * 100);
    items.push({
      categorie: "GOUVERNANCE",
      indicateur: "Couverture superviseur des dossiers",
      statut: tauxSansSup <= 10 ? "OK" : tauxSansSup <= 30 ? "ALERTE" : "CRITIQUE",
      detail: `${sansSuperviseur.length}/${actifs.length} dossier(s) sans superviseur designe (${tauxSansSup}%)`,
      recommandation: tauxSansSup > 10
        ? "Assigner un superviseur a chaque dossier pour garantir le controle hierarchique."
        : "Aucune action requise.",
      referenceReglementaire: "Art. L.561-32 CMF",
    });
  }

  // === 34. REGISTRE - Alertes en cours ===
  const alertesEnCours = alertes.filter(a => a.statut === "EN COURS");
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

  // === 35. DECLARATIONS TRACFIN ===
  const tracfinDeclarations = alertes.filter(a => (a.typeDecision || "").toLowerCase().includes("tracfin"));
  items.push({
    categorie: "REGISTRE",
    indicateur: "Suivi des declarations TRACFIN",
    statut: "OK",
    detail: `${tracfinDeclarations.length} declaration(s) TRACFIN effectuee(s)`,
    recommandation: "Aucune action requise. Verifier regulierement les retours de TRACFIN.",
    referenceReglementaire: "Art. L.561-15 CMF",
  });

  // === 36. CLIENTS INACTIFS AVEC ALERTES (Amélioration #12) ===
  const inactifsAvecAlertes = clients.filter(c => c.statut === "INACTIF").filter(c => {
    return alertesEnCours.some(a => a.clientConcerne === c.raisonSociale || a.clientConcerne === c.ref);
  });
  if (inactifsAvecAlertes.length > 0) {
    items.push({
      categorie: "REGISTRE",
      indicateur: "Clients inactifs avec alertes en cours",
      statut: "CRITIQUE",
      detail: `${inactifsAvecAlertes.length} client(s) inactif(s) avec des alertes non resolues: ${inactifsAvecAlertes.slice(0, 3).map(c => c.raisonSociale).join(", ")}`,
      recommandation: "Resoudre les alertes avant de cloturer definitivement les dossiers inactifs.",
      referenceReglementaire: "Art. L.561-12 CMF",
    });
  }

  // === 37. DELAI MOYEN TRAITEMENT ALERTES (Amélioration #21) ===
  const alertesResolues = alertes.filter(a => a.statut !== "EN COURS" && a.date && a.dateButoir);
  if (alertesResolues.length >= 3) {
    const delais = alertesResolues.map(a => {
      const debut = new Date(a.date);
      const fin = new Date(a.dateButoir);
      if (isNaN(debut.getTime()) || isNaN(fin.getTime())) return null;
      return Math.abs((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24));
    }).filter((d): d is number => d !== null);
    if (delais.length > 0) {
      const delaiMoyen = Math.round(delais.reduce((a, b) => a + b, 0) / delais.length);
      items.push({
        categorie: "REGISTRE",
        indicateur: "Delai moyen de traitement des alertes",
        statut: delaiMoyen <= 30 ? "OK" : delaiMoyen <= 60 ? "ALERTE" : "CRITIQUE",
        detail: `Delai moyen: ${delaiMoyen} jour(s) sur ${delais.length} alerte(s) resolue(s)`,
        recommandation: delaiMoyen > 30
          ? "Reduire le delai de traitement des alertes. Objectif: moins de 30 jours."
          : "Aucune action requise.",
        referenceReglementaire: "Art. L.561-15 CMF",
      });
    }
  }

  // === 38. TRACABILITE - Journal d'audit ===
  const logsRecents = logs.filter(l => {
    if (!l.horodatage) return false;
    const d = new Date(l.horodatage.replace(" ", "T"));
    if (isNaN(d.getTime())) return false;
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
    referenceReglementaire: "Art. L.561-12 CMF",
  });

  // === 39. DIVERSITE DES ACTIONS ===
  const actionTypes = new Set(logsRecents.map(l => l.typeAction));
  items.push({
    categorie: "TRACABILITE",
    indicateur: "Diversite des actions tracees",
    statut: actionTypes.size >= 4 ? "OK" : actionTypes.size >= 2 ? "ALERTE" : "CRITIQUE",
    detail: `${actionTypes.size} type(s) d'action distinct(s) dans les 90 derniers jours`,
    recommandation: actionTypes.size < 4
      ? "Verifier que les screenings, scorings, revues et alertes sont correctement traces."
      : "Aucune action requise.",
    referenceReglementaire: "Art. L.561-12 CMF",
  });

  // === 40. REPARTITION DES RISQUES ===
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
    referenceReglementaire: "Art. L.561-4-1 CMF",
  });

  // === 41. SCORE MOYEN DU PORTEFEUILLE ===
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
    referenceReglementaire: "Art. L.561-4-1 CMF",
  });

  // === 42. CAPITAL ADEQUACY ===
  const capitalAnomalie = actifs.filter(c => {
    if (c.capital <= 0 || c.honoraires <= 0) return false;
    return c.capital < 100 && c.honoraires > 10000;
  });
  if (capitalAnomalie.length > 0) {
    items.push({
      categorie: "RISQUE GLOBAL",
      indicateur: "Anomalie capital / chiffre d'affaires",
      statut: "ALERTE",
      detail: `${capitalAnomalie.length} client(s) avec capital tres faible (<100€) et honoraires eleves (>10k€)`,
      recommandation: "Examiner les societes a faible capitalisation presentant des flux financiers importants.",
      referenceReglementaire: "Art. L.561-10-2 CMF",
    });
  }

  // === 43. DOMICILIATION ===
  const domicilies = actifs.filter(c => c.mission === "DOMICILIATION");
  if (domicilies.length > 0) {
    items.push({
      categorie: "RISQUE GLOBAL",
      indicateur: "Clients en mission de domiciliation",
      statut: domicilies.length <= 3 ? "ALERTE" : "CRITIQUE",
      detail: `${domicilies.length} client(s) en domiciliation — mission a risque eleve`,
      recommandation: "Appliquer des mesures de vigilance renforcees pour tous les clients domicilies.",
      referenceReglementaire: "Art. L.561-10 CMF",
    });
  }

  // === 44. CONCENTRATION SECTORIELLE (Amélioration #22) ===
  if (actifs.length >= 5) {
    const apeMap = new Map<string, number>();
    actifs.forEach(c => {
      const ape = c.ape.trim();
      if (ape) apeMap.set(ape, (apeMap.get(ape) || 0) + 1);
    });
    const maxConcentration = Math.max(...Array.from(apeMap.values()), 0);
    const tauxConcentration = actifs.length > 0 ? Math.round((maxConcentration / actifs.length) * 100) : 0;
    if (tauxConcentration > 40) {
      const topApe = Array.from(apeMap.entries()).sort((a, b) => b[1] - a[1])[0];
      items.push({
        categorie: "RISQUE GLOBAL",
        indicateur: "Concentration sectorielle du portefeuille",
        statut: tauxConcentration <= 50 ? "ALERTE" : "CRITIQUE",
        detail: `Concentration elevee: ${tauxConcentration}% des clients sur le code APE ${topApe[0]} (${topApe[1]} clients)`,
        recommandation: "La concentration sectorielle augmente le risque systemique. Diversifier le portefeuille.",
      });
    }
  }

  // === 45. ANCIENNETE MOYENNE DU PORTEFEUILLE (Amélioration #18) ===
  const anciennetes = actifs.map(c => {
    if (!c.dateCreationLigne) return null;
    const d = new Date(c.dateCreationLigne);
    if (isNaN(d.getTime())) return null;
    return (now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  }).filter((a): a is number => a !== null);
  if (anciennetes.length > 0) {
    const ancMoyenne = Math.round(anciennetes.reduce((a, b) => a + b, 0) / anciennetes.length * 10) / 10;
    const clientsRecents = anciennetes.filter(a => a < 1).length;
    const tauxRecents = Math.round((clientsRecents / anciennetes.length) * 100);
    items.push({
      categorie: "RISQUE GLOBAL",
      indicateur: "Anciennete moyenne des relations d'affaires",
      statut: tauxRecents <= 30 ? "OK" : tauxRecents <= 50 ? "ALERTE" : "CRITIQUE",
      detail: `Anciennete moyenne: ${ancMoyenne} an(s), ${clientsRecents} client(s) de moins d'un an (${tauxRecents}%)`,
      recommandation: tauxRecents > 30
        ? "Proportion elevee de nouvelles relations. Renforcer les procedures d'entree en relation."
        : "Aucune action requise.",
      referenceReglementaire: "Art. L.561-5 CMF",
    });
  }

  // === CALCUL NOTE GLOBALE (Amélioration #23 - pondération par catégorie) ===
  const critiques = items.filter(i => i.statut === "CRITIQUE").length;
  const alerteCount = items.filter(i => i.statut === "ALERTE").length;
  const okCount = items.filter(i => i.statut === "OK").length;

  // Category weights for weighted score calculation
  const CATEGORY_WEIGHTS: Record<string, number> = {
    "CLASSIFICATION": 1.0,
    "SCORING": 1.5,
    "REVISIONS": 1.2,
    "KYC": 1.3,
    "GOUVERNANCE": 1.4,
    "REGISTRE": 1.1,
    "TRACABILITE": 0.8,
    "RISQUE GLOBAL": 1.2,
  };

  // Compute per-category stats (Amélioration #38)
  const categoriesSet = [...new Set(items.map(i => i.categorie))];
  const categoryStats: CategoryStats[] = categoriesSet.map(cat => {
    const catItems = items.filter(i => i.categorie === cat);
    const catOk = catItems.filter(i => i.statut === "OK").length;
    const catAlerte = catItems.filter(i => i.statut === "ALERTE").length;
    const catCritique = catItems.filter(i => i.statut === "CRITIQUE").length;
    const catMax = catItems.length * 10;
    const catPoints = catOk * 10 + catAlerte * 5;
    const catScore = catMax > 0 ? Math.round((catPoints / catMax) * 100) : 0;
    return {
      categorie: cat,
      total: catItems.length,
      ok: catOk,
      alerte: catAlerte,
      critique: catCritique,
      score: catScore,
    };
  });

  // Weighted global score
  let weightedPoints = 0;
  let weightedMax = 0;
  for (const cs of categoryStats) {
    const weight = CATEGORY_WEIGHTS[cs.categorie] || 1.0;
    weightedPoints += cs.score * weight;
    weightedMax += 100 * weight;
  }
  const scoreDispositif = weightedMax > 0 ? Math.round((weightedPoints / weightedMax) * 100) : 0;

  const noteLettre = scoreDispositif >= 80 ? "A" : scoreDispositif >= 60 ? "B" : scoreDispositif >= 40 ? "C" : "D";

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
    categoryStats,
    totalClients: clients.length,
    totalCollaborateurs: collaborateurs.length,
    totalAlertes: alertes.length,
  };
}
