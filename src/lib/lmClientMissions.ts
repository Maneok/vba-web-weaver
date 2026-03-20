// ──────────────────────────────────────────────
// Prestations spécifiques par type de client
// Vérifié obligations réelles 2025-2026 par type de société
// ──────────────────────────────────────────────

export interface ClientMissionSousOption {
  id: string;
  label: string;
  defaultSelected: boolean;
  description?: string;
}

export interface ClientMissionPrestation {
  id: string;
  label: string;
  description: string;
  icon: string;
  locked: boolean;
  defaultSelected: boolean;
  sous_options: ClientMissionSousOption[];
}

export function getMissionsForClientType(clientTypeId: string): ClientMissionPrestation[] {
  return CLIENT_MISSIONS[clientTypeId] || CLIENT_MISSIONS['sas_is'];
}

/** Total default-selected count for a client type */
export function getDefaultSelectedCount(clientTypeId: string): { missions: number; sousOptions: number } {
  const missions = getMissionsForClientType(clientTypeId);
  const selected = missions.filter(m => m.defaultSelected);
  const sousCount = selected.reduce((sum, m) => sum + m.sous_options.filter(s => s.defaultSelected).length, 0);
  return { missions: selected.length, sousOptions: sousCount };
}

const LCB_FT_STANDARD: ClientMissionPrestation = {
  id: 'lcbft',
  label: 'LCB-FT',
  description: 'Obligations de vigilance — KYC, Tracfin',
  icon: 'shield-check',
  locked: true,
  defaultSelected: true,
  sous_options: [
    { id: 'identification_verification', label: 'Identification et vérification du client et BE', defaultSelected: true },
    { id: 'vigilance_continue', label: 'Vigilance continue durant la relation', defaultSelected: true },
    { id: 'declaration_soupcon', label: 'Déclaration de soupçon Tracfin (si nécessaire)', defaultSelected: true },
    { id: 'conservation_documents', label: 'Conservation des documents 5 ans (art. L.561-12 CMF)', defaultSelected: true },
  ],
};

// ============================================================
// SAS / SASU à l'IS
// Président = assimilé salarié (pas TNS)
// Comptabilité d'engagement obligatoire
// ============================================================

const MISSIONS_SAS_IS: ClientMissionPrestation[] = [
  {
    id: 'comptabilite', label: 'Comptabilité', description: 'Tenue, rapprochement, révision, bilan, liasse', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'revision_comptes', label: 'Révision des comptes', defaultSelected: true },
      { id: 'bilan_cr', label: 'Bilan et compte de résultat', defaultSelected: true },
      { id: 'annexe_legale', label: 'Annexe légale (si seuils dépassés)', defaultSelected: false },
      { id: 'liasse_fiscale', label: 'Liasse fiscale IS (2050-2059)', defaultSelected: true },
      { id: 'fec', label: 'Fichier des Écritures Comptables (FEC)', defaultSelected: true },
      { id: 'situations_intermediaires', label: 'Situations intermédiaires (trimestrielles/semestrielles)', defaultSelected: false, description: 'Bilan intermédiaire pour le suivi de gestion' },
      { id: 'tableaux_bord', label: 'Tableaux de bord mensuels', defaultSelected: false },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal', description: 'TVA, IS, CFE, CVAE, DAS2', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'tva', label: 'Déclarations de TVA (CA3 mensuelle ou CA12 annuelle)', defaultSelected: true },
      { id: 'is_2065', label: 'Déclaration de résultat IS (2065)', defaultSelected: true },
      { id: 'is_acomptes', label: 'Acomptes trimestriels IS', defaultSelected: true },
      { id: 'cfe', label: 'CFE (Cotisation Foncière des Entreprises)', defaultSelected: false },
      { id: 'cvae', label: 'CVAE (si CA > 500K€)', defaultSelected: false },
      { id: 'das2', label: 'DAS2 — Déclaration des honoraires versés', defaultSelected: false },
      { id: 'taxe_apprentissage', label: 'Taxe d\'apprentissage / Formation continue', defaultSelected: false, description: 'Si salariés' },
    ],
  },
  {
    id: 'social', label: 'Social / Paie', description: 'Bulletins, DSN, charges sociales', icon: 'users', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'bulletins_paie', label: 'Bulletins de paie (salariés + président si rémunéré)', defaultSelected: true },
      { id: 'dsn', label: 'DSN mensuelle (Déclaration Sociale Nominative)', defaultSelected: true },
      { id: 'charges_sociales', label: 'Déclarations de charges sociales', defaultSelected: true },
      { id: 'contrats_travail', label: 'Rédaction des contrats de travail', defaultSelected: false },
      { id: 'solde_tout_compte', label: 'Solde de tout compte / Certificats de travail', defaultSelected: false },
      { id: 'dpae', label: 'DPAE (Déclaration Préalable À l\'Embauche)', defaultSelected: false },
      { id: 'registre_personnel', label: 'Registre unique du personnel', defaultSelected: false },
    ],
  },
  {
    id: 'juridique', label: 'Juridique annuel', description: 'AG, approbation comptes, dépôt greffe', icon: 'scale', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'pv_ago', label: 'PV d\'Assemblée Générale annuelle (décision de l\'associé unique si SASU)', defaultSelected: true },
      { id: 'approbation_comptes', label: 'Approbation des comptes annuels', defaultSelected: true },
      { id: 'affectation_resultat', label: 'Affectation du résultat', defaultSelected: true },
      { id: 'depot_greffe', label: 'Dépôt des comptes au greffe du tribunal de commerce', defaultSelected: true },
      { id: 'rapport_gestion', label: 'Rapport de gestion (si seuils dépassés)', defaultSelected: false },
      { id: 'modifications_statutaires', label: 'Modifications statutaires (siège, capital, objet social)', defaultSelected: false },
    ],
  },
  { ...LCB_FT_STANDARD },
  {
    id: 'conseil', label: 'Conseil & accompagnement', description: 'Optimisation, stratégie, pilotage', icon: 'lightbulb', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'conseil_fiscal', label: 'Optimisation fiscale (IS, CIR, JEI, crédits d\'impôt)', defaultSelected: false },
      { id: 'conseil_remuneration', label: 'Arbitrage rémunération / dividendes du dirigeant', defaultSelected: false, description: 'Président assimilé salarié — optimisation charges sociales' },
      { id: 'previsionnel', label: 'Prévisionnel / Business plan', defaultSelected: false },
      { id: 'conseil_gestion', label: 'Conseil en gestion (trésorerie, BFR, rentabilité)', defaultSelected: false },
    ],
  },
];

// ============================================================
// SARL / EURL à l'IS
// Gérant majoritaire = TNS (Travailleur Non Salarié)
// Gérant minoritaire/égalitaire = assimilé salarié
// ============================================================

const MISSIONS_SARL_IS: ClientMissionPrestation[] = [
  {
    id: 'comptabilite', label: 'Comptabilité', description: 'Tenue, rapprochement, révision, bilan, liasse', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'revision_comptes', label: 'Révision des comptes', defaultSelected: true },
      { id: 'bilan_cr', label: 'Bilan et compte de résultat', defaultSelected: true },
      { id: 'annexe_legale', label: 'Annexe légale', defaultSelected: false },
      { id: 'liasse_fiscale', label: 'Liasse fiscale IS (2050-2059)', defaultSelected: true },
      { id: 'fec', label: 'Fichier des Écritures Comptables (FEC)', defaultSelected: true },
      { id: 'situations_intermediaires', label: 'Situations intermédiaires', defaultSelected: false },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal', description: 'TVA, IS, CFE, DAS2', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'tva', label: 'Déclarations de TVA', defaultSelected: true },
      { id: 'is_2065', label: 'Déclaration de résultat IS (2065)', defaultSelected: true },
      { id: 'is_acomptes', label: 'Acomptes trimestriels IS', defaultSelected: true },
      { id: 'cfe', label: 'CFE', defaultSelected: false },
      { id: 'das2', label: 'DAS2 — Honoraires', defaultSelected: false },
    ],
  },
  {
    id: 'social', label: 'Social / Paie', description: 'Bulletins, DSN, TNS gérant, charges', icon: 'users', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'bulletins_paie', label: 'Bulletins de paie salariés', defaultSelected: true },
      { id: 'dsn', label: 'DSN mensuelle', defaultSelected: true },
      { id: 'tns_gerant', label: 'Déclaration sociale TNS gérant majoritaire (DSI/DS PAMC)', defaultSelected: true, description: 'Gérant majoritaire SARL = travailleur non salarié SSI' },
      { id: 'charges_sociales', label: 'Déclarations de charges sociales', defaultSelected: true },
      { id: 'contrats_travail', label: 'Contrats de travail', defaultSelected: false },
      { id: 'solde_tout_compte', label: 'Solde de tout compte / Certificats', defaultSelected: false },
    ],
  },
  {
    id: 'juridique', label: 'Juridique annuel', description: 'AG, approbation, dépôt greffe', icon: 'scale', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'pv_ago', label: 'PV d\'AGO (ou décision de l\'associé unique si EURL)', defaultSelected: true },
      { id: 'approbation_comptes', label: 'Approbation des comptes', defaultSelected: true },
      { id: 'affectation_resultat', label: 'Affectation du résultat', defaultSelected: true },
      { id: 'depot_greffe', label: 'Dépôt des comptes au greffe', defaultSelected: true },
      { id: 'modifications_statutaires', label: 'Modifications statutaires', defaultSelected: false },
    ],
  },
  { ...LCB_FT_STANDARD },
  {
    id: 'conseil', label: 'Conseil', description: 'Optimisation, rémunération gérant', icon: 'lightbulb', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'conseil_fiscal', label: 'Optimisation fiscale IS', defaultSelected: false },
      { id: 'conseil_remuneration', label: 'Arbitrage rémunération / dividendes gérant TNS', defaultSelected: false, description: 'Impact cotisations SSI vs flat tax dividendes' },
      { id: 'previsionnel', label: 'Prévisionnel', defaultSelected: false },
    ],
  },
];

// ============================================================
// SARL / EURL à l'IR (option temporaire 5 ans max)
// Régime BIC — liasse 2031/2033
// ============================================================

const MISSIONS_SARL_IR: ClientMissionPrestation[] = [
  {
    id: 'comptabilite', label: 'Comptabilité', description: 'Tenue, bilan, liasse BIC', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'revision_comptes', label: 'Révision des comptes', defaultSelected: true },
      { id: 'bilan_cr', label: 'Bilan et compte de résultat', defaultSelected: true },
      { id: 'liasse_bic', label: 'Liasse fiscale BIC (2031/2033)', defaultSelected: true },
      { id: 'fec', label: 'FEC', defaultSelected: true },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal', description: 'TVA, BIC, quote-part IR associés', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'tva', label: 'Déclarations de TVA', defaultSelected: true },
      { id: 'liasse_bic_2031', label: 'Déclaration de résultat BIC (2031)', defaultSelected: true },
      { id: 'quote_part_ir', label: 'Répartition quote-part résultat par associé (2042 C PRO)', defaultSelected: true, description: 'Chaque associé déclare sa quote-part à l\'IR' },
      { id: 'cfe', label: 'CFE', defaultSelected: false },
    ],
  },
  {
    id: 'social', label: 'Social / Paie', description: 'TNS gérant, salariés', icon: 'users', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'tns_gerant', label: 'Déclaration sociale TNS gérant', defaultSelected: true },
      { id: 'bulletins_paie', label: 'Bulletins de paie salariés (si applicables)', defaultSelected: false },
      { id: 'dsn', label: 'DSN mensuelle', defaultSelected: false },
    ],
  },
  {
    id: 'juridique', label: 'Juridique', description: 'AG, approbation, dépôt', icon: 'scale', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'pv_ago', label: 'PV d\'AGO', defaultSelected: true },
      { id: 'approbation_comptes', label: 'Approbation des comptes', defaultSelected: true },
      { id: 'depot_greffe', label: 'Dépôt des comptes au greffe', defaultSelected: true },
    ],
  },
  { ...LCB_FT_STANDARD },
];

// ============================================================
// SARL de famille (IR de droit — art. 239 bis AA CGI)
// ============================================================

const MISSIONS_SARL_FAMILLE: ClientMissionPrestation[] = [
  ...MISSIONS_SARL_IR.map(m => m.id === 'fiscal' ? {
    ...m, description: 'TVA, BIC, quote-part IR, LMNP si meublé',
    sous_options: [
      ...m.sous_options,
      { id: 'lmnp_famille', label: 'Régime LMNP via SARL de famille (si location meublée)', defaultSelected: false, description: 'Avantage : amortissement BIC sans IS' },
    ],
  } : m),
];

// ============================================================
// SCI à l'IR (revenus fonciers)
// Comptabilité de TRÉSORERIE (pas d'engagement)
// ============================================================

const MISSIONS_SCI_IR: ClientMissionPrestation[] = [
  {
    id: 'comptabilite', label: 'Comptabilité SCI', description: 'Comptabilité de trésorerie, suivi loyers et charges', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'saisie_recettes_depenses', label: 'Saisie des recettes et dépenses', defaultSelected: true, description: 'Comptabilité de trésorerie (pas d\'engagement)' },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'suivi_loyers', label: 'Suivi des loyers encaissés et charges locatives', defaultSelected: true },
      { id: 'suivi_emprunts', label: 'Suivi des emprunts immobiliers (capital + intérêts)', defaultSelected: true },
      { id: 'suivi_travaux', label: 'Suivi des travaux et charges déductibles', defaultSelected: true },
      { id: 'etat_rapprochement', label: 'État de rapprochement annuel', defaultSelected: true },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal SCI IR', description: '2072, revenus fonciers 2044, plus-values', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'declaration_2072', label: 'Déclaration 2072 — résultats de la SCI', defaultSelected: true },
      { id: 'aide_2044_associes', label: 'Aide à la déclaration 2044 de chaque associé (revenus fonciers)', defaultSelected: true, description: 'Répartition de la quote-part résultat par associé' },
      { id: 'tva_immobiliere', label: 'TVA immobilière (si applicable — VEFA, local commercial)', defaultSelected: false },
      { id: 'plus_values_immo', label: 'Calcul de plus-values immobilières (si cession)', defaultSelected: false, description: 'Régime des particuliers — abattement pour durée de détention' },
      { id: 'ifi', label: 'Aide IFI associés (si patrimoine > seuil)', defaultSelected: false },
    ],
  },
  {
    id: 'juridique', label: 'Juridique SCI', description: 'AG annuelle, rapport gérant, cessions parts', icon: 'scale', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'pv_ago', label: 'PV d\'AG annuelle d\'approbation des comptes', defaultSelected: true },
      { id: 'rapport_gerant', label: 'Rapport de gérance annuel', defaultSelected: true },
      { id: 'cessions_parts', label: 'Acte de cession de parts sociales', defaultSelected: false, description: 'Agrément, enregistrement, droits d\'enregistrement' },
      { id: 'modifications_statutaires', label: 'Modifications statutaires', defaultSelected: false },
      { id: 'registre_decisions', label: 'Tenue du registre des décisions', defaultSelected: true },
    ],
  },
  { ...LCB_FT_STANDARD },
  {
    id: 'conseil', label: 'Conseil patrimonial', description: 'Stratégie SCI, démembrement, transmission', icon: 'lightbulb', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'conseil_ir_vs_is', label: 'Étude IR vs IS (opportunité de passage à l\'IS)', defaultSelected: false },
      { id: 'conseil_transmission', label: 'Stratégie de transmission (donation parts, démembrement)', defaultSelected: false },
      { id: 'conseil_financement', label: 'Conseil en financement immobilier', defaultSelected: false },
    ],
  },
];

// ============================================================
// SCI à l'IS
// Comptabilité d'ENGAGEMENT obligatoire
// Amortissements du bien + bilan complet
// ============================================================

const MISSIONS_SCI_IS: ClientMissionPrestation[] = [
  {
    id: 'comptabilite', label: 'Comptabilité SCI IS', description: 'Comptabilité d\'engagement, amortissements, bilan complet', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables (engagement)', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'revision_comptes', label: 'Révision des comptes', defaultSelected: true },
      { id: 'amortissements_immo', label: 'Calcul des amortissements immobiliers (bien, travaux)', defaultSelected: true, description: 'Avantage IS : amortissement déductible du résultat' },
      { id: 'bilan_cr', label: 'Bilan et compte de résultat', defaultSelected: true },
      { id: 'liasse_fiscale_is', label: 'Liasse fiscale IS', defaultSelected: true },
      { id: 'fec', label: 'FEC', defaultSelected: true },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal SCI IS', description: 'IS, TVA, CFE', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'is_2065', label: 'Déclaration IS (2065)', defaultSelected: true },
      { id: 'is_acomptes', label: 'Acomptes trimestriels IS', defaultSelected: true },
      { id: 'tva', label: 'TVA (si applicable)', defaultSelected: false },
      { id: 'cfe', label: 'CFE', defaultSelected: false },
      { id: 'plus_values_pro', label: 'Plus-values professionnelles (si cession)', defaultSelected: false, description: 'Régime des plus-values professionnelles, pas des particuliers' },
    ],
  },
  {
    id: 'juridique', label: 'Juridique', description: 'AG, approbation, dépôt greffe', icon: 'scale', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'pv_ago', label: 'PV d\'AG annuelle', defaultSelected: true },
      { id: 'approbation_comptes', label: 'Approbation des comptes', defaultSelected: true },
      { id: 'depot_greffe', label: 'Dépôt des comptes au greffe', defaultSelected: true },
    ],
  },
  { ...LCB_FT_STANDARD },
];

// ============================================================
// LMNP (Loueur Meublé Non Professionnel)
// Régime BIC — amortissements
// Réforme 2025 : réintégration amortissements en plus-value
// ============================================================

const MISSIONS_LMNP: ClientMissionPrestation[] = [
  {
    id: 'comptabilite', label: 'Comptabilité LMNP', description: 'BIC, amortissements, immobilisations', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des recettes et dépenses', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'amortissements', label: 'Tableau des amortissements (bien, meubles, travaux)', defaultSelected: true, description: 'Amortissement linéaire : bien 25-40 ans, meubles 5-10 ans, travaux 10-15 ans' },
      { id: 'tableau_immobilisations', label: 'Tableau des immobilisations', defaultSelected: true },
      { id: 'bilan_cr_bic', label: 'Bilan et compte de résultat BIC', defaultSelected: true },
      { id: 'fec', label: 'FEC', defaultSelected: true },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal LMNP', description: 'Liasse 2031/2033, déclaration revenus BIC', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'liasse_2031_2033', label: 'Liasse fiscale 2031 / 2033', defaultSelected: true },
      { id: 'declaration_bic_ir', label: 'Déclaration des revenus BIC (2042 C PRO)', defaultSelected: true },
      { id: 'cfe', label: 'CFE (Cotisation Foncière des Entreprises)', defaultSelected: true, description: 'Tout LMNP est redevable de la CFE' },
      { id: 'tva_residence_services', label: 'TVA (si résidence de services / tourisme)', defaultSelected: false },
      { id: 'suivi_deficits', label: 'Suivi des déficits reportables (10 ans BIC)', defaultSelected: true },
    ],
  },
  { ...LCB_FT_STANDARD },
  {
    id: 'conseil', label: 'Conseil LMNP', description: 'Amortissements, plus-values, passage LMP', icon: 'lightbulb', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'optimisation_amortissements', label: 'Optimisation des amortissements et charges déductibles', defaultSelected: false },
      { id: 'simulation_plus_value', label: 'Simulation plus-value en cas de cession', defaultSelected: false, description: 'Réforme 2025 : réintégration des amortissements dans la plus-value' },
      { id: 'passage_lmp', label: 'Étude passage LMP (seuil 23K€ + revenus du foyer)', defaultSelected: false },
      { id: 'micro_vs_reel', label: 'Comparatif micro-BIC vs réel', defaultSelected: false },
    ],
  },
];

// ============================================================
// LMP (Loueur Meublé Professionnel)
// Cotisations sociales SSI OBLIGATOIRES
// Plus-values professionnelles
// ============================================================

const MISSIONS_LMP: ClientMissionPrestation[] = [
  ...MISSIONS_LMNP.filter(m => m.id !== 'conseil').map(m => {
    if (m.id === 'fiscal') {
      return { ...m, sous_options: [
        ...m.sous_options,
        { id: 'plus_values_pro', label: 'Plus-values professionnelles (régime LMP)', defaultSelected: false, description: 'Exonération possible si recettes < 90K€ pendant 5 ans' },
      ]};
    }
    return m;
  }),
  {
    id: 'social', label: 'Cotisations sociales LMP', description: 'SSI obligatoire, URSSAF', icon: 'users', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'ssi_lmp', label: 'Déclaration et suivi cotisations SSI (ex-RSI)', defaultSelected: true, description: 'LMP = affiliation SSI obligatoire' },
      { id: 'regularisation_ssi', label: 'Régularisation annuelle des cotisations', defaultSelected: true },
    ],
  },
  { ...LCB_FT_STANDARD },
  {
    id: 'conseil', label: 'Conseil LMP', description: 'Optimisation, passage LMNP, exonérations', icon: 'lightbulb', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'optimisation_amortissements', label: 'Optimisation amortissements', defaultSelected: false },
      { id: 'exoneration_pv', label: 'Étude exonération plus-values (art. 151 septies CGI)', defaultSelected: false },
      { id: 'passage_lmnp', label: 'Étude repassage LMNP si revenus baissent', defaultSelected: false },
    ],
  },
];

// ============================================================
// Micro-entreprise / Auto-entrepreneur
// Comptabilité ultra-simplifiée
// ============================================================

const MISSIONS_MICRO: ClientMissionPrestation[] = [
  {
    id: 'suivi', label: 'Suivi comptable simplifié', description: 'Livre recettes, registre achats, suivi CA', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'livre_recettes', label: 'Tenue du livre des recettes', defaultSelected: true },
      { id: 'registre_achats', label: 'Registre des achats (si activité de vente)', defaultSelected: false },
      { id: 'suivi_ca_plafonds', label: 'Suivi du CA vs plafonds micro (188 700€ vente / 77 700€ services)', defaultSelected: true, description: 'Alerte automatique si proche des seuils' },
      { id: 'facturation', label: 'Vérification conformité des factures', defaultSelected: false },
    ],
  },
  {
    id: 'fiscal', label: 'Déclarations', description: 'CA URSSAF, franchise TVA, 2042 C PRO', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'declaration_ca_urssaf', label: 'Déclaration de CA à l\'URSSAF (mensuelle ou trimestrielle)', defaultSelected: true },
      { id: 'franchise_tva', label: 'Suivi franchise en base de TVA (36 800€ services / 91 900€ vente)', defaultSelected: true },
      { id: 'aide_2042_cpro', label: 'Aide à la déclaration 2042 C PRO', defaultSelected: true },
      { id: 'cfe_initiale', label: 'CFE (exonérée la 1ère année, puis à déclarer)', defaultSelected: true },
      { id: 'versement_liberatoire', label: 'Option versement libératoire IR (si éligible)', defaultSelected: false },
    ],
  },
  { ...LCB_FT_STANDARD },
  {
    id: 'conseil', label: 'Conseil & orientation', description: 'Choix régime, seuils, évolution statut', icon: 'lightbulb', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'conseil_regime', label: 'Conseil choix de régime (micro vs réel)', defaultSelected: true },
      { id: 'alerte_seuils', label: 'Alerte dépassement seuils micro', defaultSelected: true },
      { id: 'evolution_statut', label: 'Accompagnement passage en société (SASU, EURL)', defaultSelected: false },
      { id: 'acre', label: 'Vérification éligibilité ACRE', defaultSelected: false },
    ],
  },
];

// ============================================================
// EI au réel (BIC ou BNC)
// Comptabilité complète — bilan + liasse
// ============================================================

const MISSIONS_EI_REEL: ClientMissionPrestation[] = [
  {
    id: 'comptabilite', label: 'Comptabilité EI', description: 'Tenue, bilan, liasse BIC ou BNC', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'revision_comptes', label: 'Révision des comptes', defaultSelected: true },
      { id: 'bilan_cr', label: 'Bilan et compte de résultat', defaultSelected: true },
      { id: 'liasse_bic_ou_bnc', label: 'Liasse fiscale (2031 BIC ou 2035 BNC selon activité)', defaultSelected: true },
      { id: 'fec', label: 'FEC', defaultSelected: true },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal EI', description: 'TVA, IR pro, CFE', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'tva', label: 'Déclarations de TVA', defaultSelected: true },
      { id: 'ir_pro', label: 'Déclaration revenus professionnels (2042 C PRO)', defaultSelected: true },
      { id: 'cfe', label: 'CFE', defaultSelected: false },
    ],
  },
  {
    id: 'social', label: 'Social TNS', description: 'Cotisations SSI / URSSAF', icon: 'users', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'dsi', label: 'Déclaration sociale des indépendants (DSI)', defaultSelected: true },
      { id: 'suivi_urssaf', label: 'Suivi cotisations URSSAF / SSI', defaultSelected: true },
      { id: 'bulletins_paie', label: 'Bulletins de paie salariés (si applicable)', defaultSelected: false },
    ],
  },
  { ...LCB_FT_STANDARD },
];

// ============================================================
// Profession libérale BNC
// Déclaration 2035 — comptabilité recettes/dépenses
// ============================================================

const MISSIONS_BNC: ClientMissionPrestation[] = [
  {
    id: 'comptabilite', label: 'Comptabilité BNC', description: 'Recettes/dépenses, 2035, immobilisations', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'saisie_recettes_depenses', label: 'Saisie des recettes et dépenses', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'tableau_immobilisations', label: 'Tableau des immobilisations et amortissements', defaultSelected: true },
      { id: 'declaration_2035', label: 'Déclaration contrôlée 2035', defaultSelected: true },
      { id: 'fec', label: 'FEC', defaultSelected: true },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal BNC', description: 'TVA, IR BNC, AGA', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'tva', label: 'Déclarations de TVA (si assujetti)', defaultSelected: true },
      { id: 'ir_bnc', label: 'Déclaration revenus BNC (2042 C PRO)', defaultSelected: true },
      { id: 'cfe', label: 'CFE', defaultSelected: false },
    ],
  },
  {
    id: 'social', label: 'Social TNS / CIPAV / CARCDSF', description: 'Cotisations caisses de retraite libérales', icon: 'users', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'dsi', label: 'Déclaration sociale des indépendants', defaultSelected: true },
      { id: 'caisse_retraite', label: 'Suivi cotisations caisse de retraite (CIPAV, CARCDSF, CARMF...)', defaultSelected: true, description: 'Selon la profession réglementée' },
      { id: 'urssaf', label: 'Suivi cotisations URSSAF', defaultSelected: true },
    ],
  },
  { ...LCB_FT_STANDARD },
];

// ============================================================
// SELARL / SELAS — Professions libérales en société
// SELARL : gérant = TNS | SELAS : président = assimilé salarié
// ============================================================

const MISSIONS_SELARL: ClientMissionPrestation[] = [
  ...MISSIONS_SARL_IS.map(m => {
    if (m.id === 'social') {
      return { ...m, label: 'Social / Paie', description: 'TNS gérant SELARL, salariés, collaborateurs libéraux',
        sous_options: [
          ...m.sous_options,
          { id: 'collaborateurs_liberaux', label: 'Gestion des collaborateurs libéraux (rétrocessions)', defaultSelected: false, description: 'Spécifique aux cabinets libéraux' },
        ]
      };
    }
    return m;
  }),
];

const MISSIONS_SELAS: ClientMissionPrestation[] = [
  ...MISSIONS_SAS_IS.map(m => {
    if (m.id === 'social') {
      return { ...m, description: 'Président assimilé salarié, collaborateurs libéraux',
        sous_options: [
          ...m.sous_options,
          { id: 'collaborateurs_liberaux', label: 'Gestion des collaborateurs libéraux (rétrocessions)', defaultSelected: false },
        ]
      };
    }
    return m;
  }),
];

// ============================================================
// SCM/SCP — professions libérales en société civile
// ============================================================

const MISSIONS_SCM_SCP: ClientMissionPrestation[] = [
  {
    id: 'comptabilite', label: 'Comptabilité SCM/SCP', description: 'Tenue, répartition charges entre associés', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'repartition_charges', label: 'Répartition des charges entre associés', defaultSelected: true, description: 'Clé de répartition statutaire' },
      { id: 'bilan_cr', label: 'Bilan et compte de résultat', defaultSelected: true },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal', description: 'Déclaration 2036, TVA, CFE', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'declaration_2036', label: 'Déclaration 2036 (résultats SCM)', defaultSelected: true },
      { id: 'tva', label: 'Déclarations de TVA', defaultSelected: true },
      { id: 'cfe', label: 'CFE', defaultSelected: false },
    ],
  },
  {
    id: 'social', label: 'Social', description: 'Paie salariés, DSN', icon: 'users', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'bulletins_paie', label: 'Bulletins de paie (personnel commun)', defaultSelected: true },
      { id: 'dsn', label: 'DSN', defaultSelected: true },
    ],
  },
  {
    id: 'juridique', label: 'Juridique', description: 'AG annuelle, répartition', icon: 'scale', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'pv_ago', label: 'PV d\'AG annuelle', defaultSelected: true },
      { id: 'rapport_gerant', label: 'Rapport de gérance', defaultSelected: true },
    ],
  },
  { ...LCB_FT_STANDARD },
];

// ============================================================
// IRPP — Particulier
// ============================================================

const MISSIONS_IRPP: ClientMissionPrestation[] = [
  {
    id: 'fiscal', label: 'Déclaration de revenus', description: '2042, fonciers, capitaux mobiliers, plus-values, IFI', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'declaration_2042', label: 'Déclaration 2042 (revenus du foyer)', defaultSelected: true },
      { id: 'revenus_fonciers', label: 'Revenus fonciers (2044 / 2044 S)', defaultSelected: false },
      { id: 'capitaux_mobiliers', label: 'Revenus de capitaux mobiliers (PFU / barème)', defaultSelected: false },
      { id: 'plus_values_mobilieres', label: 'Plus-values sur valeurs mobilières', defaultSelected: false },
      { id: 'plus_values_immobilieres', label: 'Plus-values immobilières', defaultSelected: false },
      { id: 'ifi', label: 'IFI — Impôt sur la Fortune Immobilière (si patrimoine > 1,3M€)', defaultSelected: false },
      { id: 'credits_reductions', label: 'Optimisation crédits et réductions d\'impôt', defaultSelected: true },
      { id: 'revenus_etrangers', label: 'Revenus de source étrangère', defaultSelected: false },
    ],
  },
  { ...LCB_FT_STANDARD },
  {
    id: 'conseil', label: 'Conseil patrimonial', description: 'Optimisation, transmission, investissements', icon: 'lightbulb', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'optimisation_fiscale', label: 'Optimisation fiscale personnelle', defaultSelected: false },
      { id: 'conseil_transmission', label: 'Transmission / succession / donation', defaultSelected: false },
      { id: 'conseil_investissement', label: 'Conseil en investissements (SCPI, assurance-vie, PER)', defaultSelected: false },
    ],
  },
];

// ============================================================
// Association loi 1901
// CAC obligatoire si subventions > 153K€
// ============================================================

const MISSIONS_ASSOCIATION: ClientMissionPrestation[] = [
  {
    id: 'comptabilite', label: 'Comptabilité associative', description: 'Plan comptable associatif, rapport financier', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables (plan comptable associatif)', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'rapport_financier', label: 'Rapport financier annuel (trésorier)', defaultSelected: true },
      { id: 'compte_resultat_associatif', label: 'Compte de résultat par section analytique', defaultSelected: false },
      { id: 'compte_emploi_ressources', label: 'Compte d\'emploi des ressources (si subventions > 153K€)', defaultSelected: false, description: 'Obligatoire si subventions publiques > 153 000€' },
      { id: 'fonds_dedies', label: 'Suivi des fonds dédiés (subventions affectées)', defaultSelected: false },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal association', description: 'TVA, IS activités lucratives, taxe salaires', icon: 'landmark', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'tva_association', label: 'TVA (si activités lucratives > seuil franchise)', defaultSelected: false },
      { id: 'is_activites_lucratives', label: 'IS sur activités lucratives (si sectorisation)', defaultSelected: false },
      { id: 'taxe_salaires', label: 'Taxe sur les salaires', defaultSelected: false },
      { id: 'recu_fiscal', label: 'Émission des reçus fiscaux pour dons', defaultSelected: false, description: 'Si l\'association est reconnue d\'intérêt général' },
    ],
  },
  {
    id: 'social', label: 'Social / Paie', description: 'Salariés, bénévoles, DSN', icon: 'users', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'bulletins_paie', label: 'Bulletins de paie salariés', defaultSelected: true },
      { id: 'dsn', label: 'DSN mensuelle', defaultSelected: true },
      { id: 'contrats_travail', label: 'Contrats de travail', defaultSelected: false },
      { id: 'benevoles', label: 'Suivi des remboursements bénévoles', defaultSelected: false },
    ],
  },
  { ...LCB_FT_STANDARD },
];

// ============================================================
// Holding
// Intégration fiscale, conventions, consolidation
// ============================================================

const MISSIONS_HOLDING: ClientMissionPrestation[] = [
  {
    id: 'comptabilite', label: 'Comptabilité holding', description: 'Comptes sociaux, suivi participations', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'revision_comptes', label: 'Révision des comptes', defaultSelected: true },
      { id: 'suivi_participations', label: 'Suivi du portefeuille de participations', defaultSelected: true },
      { id: 'bilan_cr', label: 'Bilan et compte de résultat', defaultSelected: true },
      { id: 'liasse_fiscale', label: 'Liasse fiscale IS', defaultSelected: true },
      { id: 'consolidation', label: 'Comptes consolidés (si obligatoire ou volontaire)', defaultSelected: false, description: 'Obligatoire si seuils dépassés (art. L233-16 C.com)' },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal holding', description: 'IS, régime mère-fille, intégration fiscale', icon: 'landmark', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'is_2065', label: 'Déclaration IS (2065)', defaultSelected: true },
      { id: 'is_acomptes', label: 'Acomptes IS', defaultSelected: true },
      { id: 'regime_mere_fille', label: 'Régime mère-fille (exonération dividendes 95%)', defaultSelected: true, description: 'Si détention ≥ 5% du capital des filiales' },
      { id: 'integration_fiscale', label: 'Intégration fiscale (si groupe)', defaultSelected: false, description: 'Détention ≥ 95% — compensation résultats du groupe' },
      { id: 'convention_tresorerie', label: 'Convention de trésorerie intra-groupe', defaultSelected: false, description: 'Centralisation de trésorerie — attention taux d\'intérêt' },
      { id: 'tva', label: 'TVA (si applicable)', defaultSelected: false },
    ],
  },
  {
    id: 'juridique', label: 'Juridique holding', description: 'AG, conventions réglementées, dépôt', icon: 'scale', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'pv_ago', label: 'PV d\'AG annuelle', defaultSelected: true },
      { id: 'approbation_comptes', label: 'Approbation des comptes', defaultSelected: true },
      { id: 'conventions_reglementees', label: 'Rapport spécial sur les conventions réglementées', defaultSelected: true, description: 'Conventions entre la holding et ses filiales' },
      { id: 'depot_greffe', label: 'Dépôt des comptes au greffe', defaultSelected: true },
    ],
  },
  { ...LCB_FT_STANDARD },
  {
    id: 'conseil', label: 'Conseil stratégique', description: 'Structuration, management fees, transmission', icon: 'lightbulb', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'structuration_groupe', label: 'Conseil en structuration du groupe', defaultSelected: false },
      { id: 'management_fees', label: 'Convention de management fees (pricing, justification)', defaultSelected: false },
      { id: 'transmission_holding', label: 'Transmission via la holding (Pacte Dutreil)', defaultSelected: false },
    ],
  },
];

// ============================================================
// Création d'entreprise
// ============================================================

const MISSIONS_CREATION: ClientMissionPrestation[] = [
  {
    id: 'previsionnel', label: 'Prévisionnel', description: 'Business plan, plan de financement, CR prévisionnel', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'business_plan', label: 'Business plan complet', defaultSelected: true },
      { id: 'plan_financement', label: 'Plan de financement', defaultSelected: true },
      { id: 'cr_previsionnel', label: 'Compte de résultat prévisionnel (3 ans)', defaultSelected: true },
      { id: 'plan_tresorerie', label: 'Plan de trésorerie mensuel', defaultSelected: false },
    ],
  },
  {
    id: 'conseil_creation', label: 'Choix de statut', description: 'Forme juridique, régime fiscal, régime social', icon: 'lightbulb', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'choix_forme', label: 'Choix de la forme juridique', defaultSelected: true },
      { id: 'choix_regime_fiscal', label: 'Choix du régime fiscal (IS/IR/micro)', defaultSelected: true },
      { id: 'choix_regime_social', label: 'Choix du régime social dirigeant', defaultSelected: true },
      { id: 'comparatif', label: 'Comparatif chiffré des options', defaultSelected: true },
    ],
  },
  {
    id: 'formalites', label: 'Formalités de création', description: 'Statuts, immatriculation, domiciliation', icon: 'scale', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'redaction_statuts', label: 'Rédaction des statuts', defaultSelected: true },
      { id: 'immatriculation', label: 'Formalités d\'immatriculation', defaultSelected: true },
      { id: 'depot_capital', label: 'Accompagnement dépôt de capital', defaultSelected: false },
    ],
  },
  { ...LCB_FT_STANDARD },
];

// ============================================================
// Syndicat de copropriété
// ============================================================

const MISSIONS_COPRO: ClientMissionPrestation[] = [
  {
    id: 'verification', label: 'Vérification des comptes', description: 'Contrôle des comptes du syndic', icon: 'calculator', locked: false, defaultSelected: true,
    sous_options: [
      { id: 'controle_charges', label: 'Contrôle des charges et dépenses', defaultSelected: true },
      { id: 'controle_tresorerie', label: 'Contrôle de la trésorerie', defaultSelected: true },
      { id: 'controle_budget', label: 'Analyse du budget prévisionnel', defaultSelected: true },
      { id: 'rapport_verification', label: 'Rapport de vérification pour l\'AG', defaultSelected: true },
    ],
  },
  { ...LCB_FT_STANDARD },
  {
    id: 'conseil', label: 'Conseil copropriété', description: 'Analyse charges, plan pluriannuel', icon: 'lightbulb', locked: false, defaultSelected: false,
    sous_options: [
      { id: 'analyse_charges', label: 'Analyse comparative des charges', defaultSelected: false },
      { id: 'plan_pluriannuel', label: 'Aide plan pluriannuel de travaux', defaultSelected: false },
    ],
  },
];

// ============================================================
// MAPPING FINAL
// ============================================================

const CLIENT_MISSIONS: Record<string, ClientMissionPrestation[]> = {
  'sas_is': MISSIONS_SAS_IS,
  'sarl_is': MISSIONS_SARL_IS,
  'sarl_ir': MISSIONS_SARL_IR,
  'sarl_famille': MISSIONS_SARL_FAMILLE,
  'sa': MISSIONS_SAS_IS, // SA similaire SAS côté missions
  'snc': MISSIONS_SARL_IR, // SNC = IR, similaire SARL IR
  'selarl': MISSIONS_SELARL,
  'selas': MISSIONS_SELAS,
  'sci_ir': MISSIONS_SCI_IR,
  'sci_is': MISSIONS_SCI_IS,
  'scm': MISSIONS_SCM_SCP,
  'scp': MISSIONS_BNC, // SCP = exercice libéral, comptabilité BNC
  'ei_reel': MISSIONS_EI_REEL,
  'micro': MISSIONS_MICRO,
  'profession_liberale': MISSIONS_BNC,
  'lmnp': MISSIONS_LMNP,
  'lmp': MISSIONS_LMP,
  'irpp': MISSIONS_IRPP,
  'association': MISSIONS_ASSOCIATION,
  'holding': MISSIONS_HOLDING,
  'creation': MISSIONS_CREATION,
  'syndicat_copro': MISSIONS_COPRO,
};
