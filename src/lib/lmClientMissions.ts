// ──────────────────────────────────────────────
// Prestations spécifiques par type de client
// ──────────────────────────────────────────────

export interface ClientMissionPrestation {
  id: string;
  label: string;
  description: string;
  icon: string;
  locked: boolean;
  defaultSelected: boolean;
  sous_options: {
    id: string;
    label: string;
    defaultSelected: boolean;
    description?: string;
  }[];
}

export function getMissionsForClientType(clientTypeId: string): ClientMissionPrestation[] {
  return BASE_MISSIONS[clientTypeId] || GENERIC_MISSIONS;
}

// ── SOCIÉTÉS COMMERCIALES IS (SAS, SARL, SELARL, SELAS, SA, SNC) ──

const MISSIONS_SOCIETE_IS: ClientMissionPrestation[] = [
  {
    id: 'comptabilite',
    label: 'Comptabilité',
    description: 'Tenue, rapprochement, bilan, liasse fiscale',
    icon: 'calculator',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'revision_comptes', label: 'Révision des comptes', defaultSelected: true },
      { id: 'bilan_cr', label: 'Bilan et compte de résultat', defaultSelected: true },
      { id: 'liasse_fiscale', label: 'Liasse fiscale', defaultSelected: true },
      { id: 'situations_intermediaires', label: 'Situations intermédiaires', defaultSelected: false, description: 'Bilan trimestriel ou semestriel' },
      { id: 'tableaux_bord', label: 'Tableaux de bord mensuels', defaultSelected: false },
    ],
  },
  {
    id: 'fiscal',
    label: 'Fiscal',
    description: 'TVA, IS, CFE, CVAE, DAS2',
    icon: 'landmark',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'tva', label: 'Déclarations de TVA', defaultSelected: true },
      { id: 'is', label: 'Déclaration IS (2065)', defaultSelected: true },
      { id: 'cfe', label: 'CFE / CVAE', defaultSelected: false },
      { id: 'das2', label: 'DAS2 — Honoraires', defaultSelected: false },
      { id: 'is_acomptes', label: 'Acomptes IS', defaultSelected: true },
      { id: 'liasse_is', label: 'Liasse fiscale IS (2050-2059)', defaultSelected: true },
    ],
  },
  {
    id: 'social',
    label: 'Social / Paie',
    description: 'Bulletins de paie, DSN, contrats de travail',
    icon: 'users',
    locked: false,
    defaultSelected: false,
    sous_options: [
      { id: 'bulletins_paie', label: 'Bulletins de paie', defaultSelected: true },
      { id: 'dsn', label: 'DSN (Déclaration Sociale Nominative)', defaultSelected: true },
      { id: 'contrats_travail', label: 'Rédaction contrats de travail', defaultSelected: false },
      { id: 'solde_tout_compte', label: 'Solde de tout compte / attestations', defaultSelected: false },
      { id: 'charges_sociales', label: 'Déclarations de charges sociales', defaultSelected: true },
      { id: 'tns', label: 'Déclaration TNS (gérant majoritaire)', defaultSelected: false, description: 'Pour les gérants SARL' },
    ],
  },
  {
    id: 'juridique',
    label: 'Juridique annuel',
    description: "PV d'AG, approbation comptes, dépôt greffe",
    icon: 'scale',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'pv_ago', label: "PV d'Assemblée Générale Ordinaire", defaultSelected: true },
      { id: 'approbation_comptes', label: 'Approbation des comptes', defaultSelected: true },
      { id: 'affectation_resultat', label: 'Affectation du résultat', defaultSelected: true },
      { id: 'depot_greffe', label: 'Dépôt des comptes au greffe', defaultSelected: true },
      { id: 'modifications_statutaires', label: 'Modifications statutaires', defaultSelected: false, description: 'Changement de siège, augmentation capital...' },
    ],
  },
  {
    id: 'lcbft',
    label: 'LCB-FT',
    description: 'KYC, vigilance, déclaration Tracfin',
    icon: 'shield-check',
    locked: true,
    defaultSelected: true,
    sous_options: [
      { id: 'identification_verification', label: 'Identification et vérification', defaultSelected: true },
      { id: 'vigilance_continue', label: 'Vigilance continue', defaultSelected: true },
      { id: 'declaration_soupcon', label: 'Déclaration de soupçon (si nécessaire)', defaultSelected: true },
      { id: 'conservation_documents', label: 'Conservation des documents 5 ans', defaultSelected: true },
    ],
  },
  {
    id: 'conseil',
    label: 'Conseil & accompagnement',
    description: 'Optimisation, tableaux de bord, conseil stratégique',
    icon: 'lightbulb',
    locked: false,
    defaultSelected: false,
    sous_options: [
      { id: 'conseil_fiscal', label: "Conseil fiscal (optimisation IS/IR, crédits d'impôt)", defaultSelected: false },
      { id: 'conseil_social', label: 'Conseil social (rémunération dirigeant, épargne salariale)', defaultSelected: false },
      { id: 'previsionnel', label: 'Prévisionnel / Business plan', defaultSelected: false },
      { id: 'conseil_gestion', label: 'Conseil en gestion (trésorerie, rentabilité)', defaultSelected: false },
    ],
  },
];

// ── SCI IR ──

const MISSIONS_SCI_IR: ClientMissionPrestation[] = [
  {
    id: 'comptabilite',
    label: 'Comptabilité SCI',
    description: 'Comptabilité de trésorerie, suivi des loyers',
    icon: 'calculator',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures (recettes/dépenses)', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'suivi_loyers', label: 'Suivi des loyers et charges locatives', defaultSelected: true },
      { id: 'suivi_emprunts', label: 'Suivi des emprunts immobiliers', defaultSelected: true },
      { id: 'tableau_tresorerie', label: 'Tableau de trésorerie', defaultSelected: false },
    ],
  },
  {
    id: 'fiscal',
    label: 'Fiscal SCI',
    description: 'Déclaration 2072, revenus fonciers associés',
    icon: 'landmark',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'declaration_2072', label: 'Déclaration 2072 (résultats SCI)', defaultSelected: true },
      { id: 'revenus_fonciers_associes', label: 'Aide déclaration revenus fonciers associés (2044)', defaultSelected: true },
      { id: 'tva_immo', label: 'TVA immobilière (si applicable)', defaultSelected: false },
      { id: 'plus_values', label: 'Calcul de plus-values immobilières', defaultSelected: false },
    ],
  },
  {
    id: 'juridique',
    label: 'Juridique SCI',
    description: 'AG annuelle, PV, modifications',
    icon: 'scale',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'pv_ago', label: "PV d'AG annuelle d'approbation des comptes", defaultSelected: true },
      { id: 'rapport_gerant', label: 'Rapport de gérance', defaultSelected: true },
      { id: 'cessions_parts', label: 'Cessions de parts sociales', defaultSelected: false },
      { id: 'modifications_statutaires', label: 'Modifications statutaires', defaultSelected: false },
    ],
  },
  {
    id: 'lcbft',
    label: 'LCB-FT',
    description: 'KYC, vigilance, Tracfin',
    icon: 'shield-check',
    locked: true,
    defaultSelected: true,
    sous_options: [
      { id: 'identification_verification', label: 'Identification et vérification', defaultSelected: true },
      { id: 'vigilance_continue', label: 'Vigilance continue', defaultSelected: true },
      { id: 'declaration_soupcon', label: 'Déclaration de soupçon (si nécessaire)', defaultSelected: true },
      { id: 'conservation_documents', label: 'Conservation des documents 5 ans', defaultSelected: true },
    ],
  },
  {
    id: 'conseil',
    label: 'Conseil patrimonial',
    description: 'Stratégie immobilière, transmission, démembrement',
    icon: 'lightbulb',
    locked: false,
    defaultSelected: false,
    sous_options: [
      { id: 'conseil_patrimonial', label: 'Conseil patrimonial (transmission, donation)', defaultSelected: false },
      { id: 'conseil_fiscal_sci', label: 'Conseil fiscal SCI (IR vs IS)', defaultSelected: false },
      { id: 'demembrement', label: 'Stratégie de démembrement', defaultSelected: false },
    ],
  },
];

// ── SCI IS ──

const MISSIONS_SCI_IS: ClientMissionPrestation[] = [
  {
    id: 'comptabilite',
    label: 'Comptabilité SCI IS',
    description: "Comptabilité d'engagement, amortissements, bilan complet",
    icon: 'calculator',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'revision_comptes', label: 'Révision des comptes', defaultSelected: true },
      { id: 'amortissements', label: 'Calcul des amortissements immobiliers', defaultSelected: true },
      { id: 'bilan_cr', label: 'Bilan et compte de résultat', defaultSelected: true },
      { id: 'liasse_fiscale', label: 'Liasse fiscale IS', defaultSelected: true },
    ],
  },
  {
    id: 'fiscal',
    label: 'Fiscal SCI IS',
    description: 'IS, TVA, CFE, liasse',
    icon: 'landmark',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'tva', label: 'Déclarations de TVA', defaultSelected: false },
      { id: 'is', label: 'Déclaration IS', defaultSelected: true },
      { id: 'is_acomptes', label: 'Acomptes IS', defaultSelected: true },
      { id: 'cfe', label: 'CFE', defaultSelected: false },
    ],
  },
  {
    id: 'juridique',
    label: 'Juridique SCI',
    description: 'AG, approbation, dépôt greffe',
    icon: 'scale',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'pv_ago', label: "PV d'AG annuelle", defaultSelected: true },
      { id: 'approbation_comptes', label: 'Approbation des comptes', defaultSelected: true },
      { id: 'depot_greffe', label: 'Dépôt des comptes au greffe', defaultSelected: true },
    ],
  },
  {
    id: 'lcbft',
    label: 'LCB-FT',
    description: 'KYC, vigilance',
    icon: 'shield-check',
    locked: true,
    defaultSelected: true,
    sous_options: [
      { id: 'identification_verification', label: 'Identification et vérification', defaultSelected: true },
      { id: 'vigilance_continue', label: 'Vigilance continue', defaultSelected: true },
      { id: 'conservation_documents', label: 'Conservation des documents 5 ans', defaultSelected: true },
    ],
  },
];

// ── LMNP ──

const MISSIONS_LMNP: ClientMissionPrestation[] = [
  {
    id: 'comptabilite',
    label: 'Comptabilité LMNP',
    description: 'Saisie, amortissements, tableau immobilisations',
    icon: 'calculator',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'amortissements', label: 'Tableau des amortissements (bien, meubles, travaux)', defaultSelected: true },
      { id: 'tableau_immobilisations', label: 'Tableau des immobilisations', defaultSelected: true },
      { id: 'bilan_cr', label: 'Bilan et compte de résultat BIC', defaultSelected: true },
    ],
  },
  {
    id: 'fiscal',
    label: 'Fiscal LMNP',
    description: 'Liasse 2031/2033, CFE, TVA si applicable',
    icon: 'landmark',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'liasse_2031', label: 'Liasse fiscale 2031 / 2033', defaultSelected: true },
      { id: 'declaration_revenus', label: 'Aide à la déclaration des revenus BIC', defaultSelected: true },
      { id: 'cfe', label: 'CFE', defaultSelected: true },
      { id: 'tva_lmnp', label: 'TVA (si résidence de services)', defaultSelected: false },
      { id: 'adhesion_cga', label: 'Adhésion CGA / Attestation', defaultSelected: false },
    ],
  },
  {
    id: 'lcbft',
    label: 'LCB-FT',
    description: 'KYC, vigilance',
    icon: 'shield-check',
    locked: true,
    defaultSelected: true,
    sous_options: [
      { id: 'identification_verification', label: 'Identification et vérification', defaultSelected: true },
      { id: 'vigilance_continue', label: 'Vigilance continue', defaultSelected: true },
      { id: 'conservation_documents', label: 'Conservation des documents 5 ans', defaultSelected: true },
    ],
  },
  {
    id: 'conseil',
    label: 'Conseil LMNP',
    description: 'Optimisation amortissements, stratégie locative',
    icon: 'lightbulb',
    locked: false,
    defaultSelected: false,
    sous_options: [
      { id: 'optimisation_amortissements', label: 'Optimisation des amortissements', defaultSelected: false },
      { id: 'passage_lmp', label: 'Étude passage LMP', defaultSelected: false },
      { id: 'conseil_investissement', label: 'Conseil investissement immobilier', defaultSelected: false },
    ],
  },
];

// ── MICRO-ENTREPRISE ──

const MISSIONS_MICRO: ClientMissionPrestation[] = [
  {
    id: 'suivi',
    label: 'Suivi comptable simplifié',
    description: 'Livre des recettes, registre des achats',
    icon: 'calculator',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'livre_recettes', label: 'Tenue du livre des recettes', defaultSelected: true },
      { id: 'registre_achats', label: 'Registre des achats (si vente)', defaultSelected: false },
      { id: 'suivi_ca', label: "Suivi du chiffre d'affaires vs plafonds", defaultSelected: true },
    ],
  },
  {
    id: 'fiscal',
    label: 'Déclarations',
    description: 'Déclaration CA URSSAF, TVA si franchise dépassée',
    icon: 'landmark',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'declaration_ca', label: "Déclaration de CA à l'URSSAF", defaultSelected: true },
      { id: 'tva_franchise', label: 'Suivi franchise en base de TVA', defaultSelected: true },
      { id: 'aide_declaration_ir', label: 'Aide à la déclaration de revenus (2042 C PRO)', defaultSelected: true },
    ],
  },
  {
    id: 'lcbft',
    label: 'LCB-FT',
    description: 'KYC, vigilance',
    icon: 'shield-check',
    locked: true,
    defaultSelected: true,
    sous_options: [
      { id: 'identification_verification', label: 'Identification et vérification', defaultSelected: true },
      { id: 'vigilance_continue', label: 'Vigilance continue', defaultSelected: true },
    ],
  },
  {
    id: 'conseil',
    label: 'Conseil & orientation',
    description: 'Choix de régime, dépassement seuils, évolution statut',
    icon: 'lightbulb',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'conseil_regime', label: 'Conseil choix de régime (micro vs réel)', defaultSelected: true },
      { id: 'alerte_seuils', label: 'Alerte dépassement seuils', defaultSelected: true },
      { id: 'evolution_statut', label: 'Accompagnement évolution statut juridique', defaultSelected: false },
    ],
  },
];

// ── EI RÉEL (BIC/BNC) ──

const MISSIONS_EI_REEL: ClientMissionPrestation[] = [
  {
    id: 'comptabilite',
    label: 'Comptabilité EI',
    description: 'Saisie, rapprochement, bilan, liasse',
    icon: 'calculator',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'revision_comptes', label: 'Révision des comptes', defaultSelected: true },
      { id: 'bilan_cr', label: 'Bilan et compte de résultat', defaultSelected: true },
      { id: 'liasse_fiscale', label: 'Liasse fiscale (2031 BIC ou 2035 BNC)', defaultSelected: true },
    ],
  },
  {
    id: 'fiscal',
    label: 'Fiscal EI',
    description: 'TVA, IR pro, CFE',
    icon: 'landmark',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'tva', label: 'Déclarations de TVA', defaultSelected: true },
      { id: 'ir_pro', label: 'Déclaration revenus professionnels (2042 C PRO)', defaultSelected: true },
      { id: 'cfe', label: 'CFE', defaultSelected: false },
      { id: 'adhesion_oga', label: 'Adhésion OGA / CGA / AGA', defaultSelected: false },
    ],
  },
  {
    id: 'social',
    label: 'Social TNS',
    description: 'Déclarations sociales du dirigeant TNS',
    icon: 'users',
    locked: false,
    defaultSelected: false,
    sous_options: [
      { id: 'ds_tns', label: 'Déclaration sociale des indépendants (DSI)', defaultSelected: true },
      { id: 'urssaf', label: 'Suivi cotisations URSSAF', defaultSelected: true },
    ],
  },
  {
    id: 'lcbft',
    label: 'LCB-FT',
    description: 'KYC, vigilance',
    icon: 'shield-check',
    locked: true,
    defaultSelected: true,
    sous_options: [
      { id: 'identification_verification', label: 'Identification et vérification', defaultSelected: true },
      { id: 'vigilance_continue', label: 'Vigilance continue', defaultSelected: true },
      { id: 'conservation_documents', label: 'Conservation des documents 5 ans', defaultSelected: true },
    ],
  },
];

// ── PROFESSION LIBÉRALE BNC ──

const MISSIONS_BNC: ClientMissionPrestation[] = [
  {
    id: 'comptabilite',
    label: 'Comptabilité BNC',
    description: 'Recettes/dépenses, 2035, tableau des immobilisations',
    icon: 'calculator',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures (recettes/dépenses)', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'tableau_immobilisations', label: 'Tableau des immobilisations et amortissements', defaultSelected: true },
      { id: 'declaration_2035', label: 'Déclaration 2035', defaultSelected: true },
    ],
  },
  {
    id: 'fiscal',
    label: 'Fiscal BNC',
    description: 'TVA, IR, AGA',
    icon: 'landmark',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'tva', label: 'Déclarations de TVA', defaultSelected: true },
      { id: 'ir_pro', label: 'Déclaration de revenus professionnels', defaultSelected: true },
      { id: 'adhesion_aga', label: 'Adhésion AGA', defaultSelected: false },
    ],
  },
  {
    id: 'social',
    label: 'Social TNS / CIPAV',
    description: 'Cotisations sociales, CIPAV ou URSSAF',
    icon: 'users',
    locked: false,
    defaultSelected: false,
    sous_options: [
      { id: 'ds_tns', label: 'Déclaration sociale des indépendants', defaultSelected: true },
      { id: 'cipav', label: 'Suivi cotisations CIPAV (si profession réglementée)', defaultSelected: false },
    ],
  },
  {
    id: 'lcbft',
    label: 'LCB-FT',
    description: 'KYC, vigilance',
    icon: 'shield-check',
    locked: true,
    defaultSelected: true,
    sous_options: [
      { id: 'identification_verification', label: 'Identification et vérification', defaultSelected: true },
      { id: 'vigilance_continue', label: 'Vigilance continue', defaultSelected: true },
      { id: 'conservation_documents', label: 'Conservation des documents 5 ans', defaultSelected: true },
    ],
  },
];

// ── IRPP PARTICULIER ──

const MISSIONS_IRPP: ClientMissionPrestation[] = [
  {
    id: 'fiscal',
    label: 'Déclaration de revenus',
    description: '2042, revenus fonciers, capitaux mobiliers, plus-values',
    icon: 'landmark',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'declaration_2042', label: 'Déclaration 2042 (revenus)', defaultSelected: true },
      { id: 'revenus_fonciers', label: 'Revenus fonciers (2044)', defaultSelected: false },
      { id: 'capitaux_mobiliers', label: 'Revenus de capitaux mobiliers', defaultSelected: false },
      { id: 'plus_values', label: 'Plus-values mobilières et immobilières', defaultSelected: false },
      { id: 'ifi', label: 'IFI (Impôt sur la Fortune Immobilière)', defaultSelected: false },
      { id: 'credits_impots', label: "Crédits et réductions d'impôt", defaultSelected: true },
    ],
  },
  {
    id: 'lcbft',
    label: 'LCB-FT',
    description: 'KYC, vigilance',
    icon: 'shield-check',
    locked: true,
    defaultSelected: true,
    sous_options: [
      { id: 'identification_verification', label: 'Identification et vérification', defaultSelected: true },
      { id: 'vigilance_continue', label: 'Vigilance continue', defaultSelected: true },
    ],
  },
  {
    id: 'conseil',
    label: 'Conseil patrimonial',
    description: 'Optimisation fiscale, transmission, investissements',
    icon: 'lightbulb',
    locked: false,
    defaultSelected: false,
    sous_options: [
      { id: 'optimisation_fiscale', label: 'Optimisation fiscale personnelle', defaultSelected: false },
      { id: 'conseil_transmission', label: 'Conseil en transmission / succession', defaultSelected: false },
      { id: 'conseil_investissement', label: 'Conseil en investissement', defaultSelected: false },
    ],
  },
];

// ── ASSOCIATION ──

const MISSIONS_ASSOCIATION: ClientMissionPrestation[] = [
  {
    id: 'comptabilite',
    label: 'Comptabilité associative',
    description: "Tenue, rapprochement, compte emploi ressources",
    icon: 'calculator',
    locked: false,
    defaultSelected: true,
    sous_options: [
      { id: 'saisie_ecritures', label: 'Saisie des écritures comptables', defaultSelected: true },
      { id: 'rapprochement_bancaire', label: 'Rapprochement bancaire', defaultSelected: true },
      { id: 'rapport_financier', label: 'Rapport financier annuel', defaultSelected: true },
      { id: 'compte_emploi_ressources', label: "Compte d'emploi des ressources (si subventions)", defaultSelected: false },
    ],
  },
  {
    id: 'fiscal',
    label: 'Fiscal association',
    description: 'Déclarations spécifiques, TVA si assujettie',
    icon: 'landmark',
    locked: false,
    defaultSelected: false,
    sous_options: [
      { id: 'tva', label: 'TVA (si assujettie)', defaultSelected: false },
      { id: 'is_association', label: 'IS associatif (activités lucratives)', defaultSelected: false },
      { id: 'taxe_salaires', label: 'Taxe sur les salaires', defaultSelected: false },
    ],
  },
  {
    id: 'social',
    label: 'Social / Paie',
    description: 'Bulletins de paie salariés, DSN',
    icon: 'users',
    locked: false,
    defaultSelected: false,
    sous_options: [
      { id: 'bulletins_paie', label: 'Bulletins de paie', defaultSelected: true },
      { id: 'dsn', label: 'DSN', defaultSelected: true },
      { id: 'contrats_travail', label: 'Contrats de travail', defaultSelected: false },
    ],
  },
  {
    id: 'lcbft',
    label: 'LCB-FT',
    description: 'KYC, vigilance',
    icon: 'shield-check',
    locked: true,
    defaultSelected: true,
    sous_options: [
      { id: 'identification_verification', label: 'Identification et vérification', defaultSelected: true },
      { id: 'vigilance_continue', label: 'Vigilance continue', defaultSelected: true },
    ],
  },
];

// ── MAPPING PRINCIPAL ──

const BASE_MISSIONS: Record<string, ClientMissionPrestation[]> = {
  'sas_is': MISSIONS_SOCIETE_IS,
  'sarl_is': MISSIONS_SOCIETE_IS,
  'sarl_ir': MISSIONS_SOCIETE_IS,
  'sarl_famille': MISSIONS_SOCIETE_IS,
  'sa': MISSIONS_SOCIETE_IS,
  'snc': MISSIONS_SOCIETE_IS,
  'selarl': MISSIONS_SOCIETE_IS,
  'selas': MISSIONS_SOCIETE_IS,
  'sci_ir': MISSIONS_SCI_IR,
  'sci_is': MISSIONS_SCI_IS,
  'scm': MISSIONS_SCI_IR,
  'scp': MISSIONS_SCI_IR,
  'ei_reel': MISSIONS_EI_REEL,
  'micro': MISSIONS_MICRO,
  'profession_liberale': MISSIONS_BNC,
  'lmnp': MISSIONS_LMNP,
  'lmp': MISSIONS_LMNP,
  'irpp': MISSIONS_IRPP,
  'association': MISSIONS_ASSOCIATION,
  'holding': MISSIONS_SOCIETE_IS,
  'creation': MISSIONS_MICRO,
  'syndicat_copro': MISSIONS_ASSOCIATION,
};

const GENERIC_MISSIONS = MISSIONS_SOCIETE_IS;
