// ──────────────────────────────────────────────
// Missions par défaut & logique conditionnelle
// ──────────────────────────────────────────────

import type { MissionSelection } from "./lmWizardTypes";

export const DEFAULT_MISSIONS: MissionSelection[] = [
  {
    section_id: "comptabilite",
    label: "Comptabilite",
    description: "Tenue, rapprochement, bilan, liasse fiscale",
    icon: "calculator",
    selected: true,
    sous_options: [
      { id: "saisie", label: "Saisie des ecritures comptables", selected: true },
      { id: "rapprochement", label: "Rapprochement bancaire", selected: true },
      { id: "revision", label: "Revision des comptes", selected: true },
      { id: "bilan", label: "Bilan et compte de resultat", selected: true },
      { id: "liasse", label: "Liasse fiscale", selected: true },
    ],
  },
  {
    section_id: "fiscal",
    label: "Fiscal",
    description: "TVA, IS/IR, CFE, DAS2",
    icon: "landmark",
    selected: true,
    sous_options: [
      { id: "tva", label: "Declarations de TVA", selected: true },
      { id: "is", label: "Declaration IS / IR", selected: true },
      { id: "cfe", label: "CFE / CVAE", selected: false },
      { id: "das2", label: "DAS2 — Honoraires", selected: false },
    ],
  },
  {
    section_id: "social",
    label: "Social",
    description: "Paie, DSN, contrats de travail",
    icon: "users",
    selected: false,
    sous_options: [
      { id: "paie", label: "Bulletins de paie", selected: false },
      { id: "dsn", label: "Declarations sociales (DSN)", selected: false },
      { id: "contrats", label: "Contrats de travail", selected: false },
      { id: "solde", label: "Solde de tout compte", selected: false },
    ],
  },
  {
    section_id: "juridique",
    label: "Juridique",
    description: "PV d'AG, approbation, modifications statutaires",
    icon: "scale",
    selected: false,
    sous_options: [
      { id: "ag", label: "Redaction PV d'AG", selected: false },
      { id: "approbation", label: "Approbation des comptes", selected: false },
      { id: "modifications", label: "Modifications statutaires", selected: false },
    ],
  },
  {
    section_id: "lcbft",
    label: "LCB-FT",
    description: "KYC, vigilance, declaration Tracfin",
    icon: "shield",
    selected: true,
    locked: true,
    sous_options: [
      { id: "kyc", label: "Identification et verification", selected: true },
      { id: "vigilance", label: "Mesures de vigilance", selected: true },
      { id: "declaration", label: "Declaration de soupcon (Tracfin)", selected: true },
    ],
  },
  {
    section_id: "travail_dissimule",
    label: "Travail dissimule",
    description: "Attestation de vigilance",
    icon: "file-warning",
    selected: true,
    locked: true,
    sous_options: [
      { id: "attestation_td", label: "Attestation travail dissimule", selected: true },
    ],
  },
  {
    section_id: "conseil",
    label: "Conseil",
    description: "Gestion, previsionnel, tableau de bord",
    icon: "lightbulb",
    selected: false,
    sous_options: [
      { id: "gestion", label: "Conseil en gestion", selected: false },
      { id: "previsionnel", label: "Budget previsionnel", selected: false },
      { id: "tableau_bord", label: "Tableau de bord periodique", selected: false },
    ],
  },
];

/** SCI → auto-select juridique */
export function applyFormConditionals(
  missions: MissionSelection[],
  forme: string,
  effectif: string
): MissionSelection[] {
  let result = missions.map((m) => ({ ...m, sous_options: m.sous_options.map((s) => ({ ...s })) }));

  // SCI → juridique ON
  if (forme === "SCI") {
    result = result.map((m) =>
      m.section_id === "juridique"
        ? { ...m, selected: true, sous_options: m.sous_options.map((s) => ({ ...s, selected: true })) }
        : m
    );
  }

  // Effectif > 0 → social ON
  if (effectif && parseInt(effectif) > 0) {
    result = result.map((m) =>
      m.section_id === "social"
        ? { ...m, selected: true, sous_options: m.sous_options.map((s) => ({ ...s, selected: true })) }
        : m
    );
  }

  return result;
}

/** Qualités dirigeant */
export const QUALITES_DIRIGEANT = [
  "Gerant",
  "President",
  "Directeur General",
  "Co-gerant",
  "Administrateur",
  "Associe unique",
];

/** Durées proposées */
export const DUREES = [
  { value: "1", label: "1 an", description: "Duree standard" },
  { value: "2", label: "2 ans", description: "Engagement moyen" },
  { value: "3", label: "3 ans", description: "Long terme" },
];

/** Fréquences facturation */
export const FREQUENCES = [
  { value: "MENSUEL", label: "Mensuel" },
  { value: "TRIMESTRIEL", label: "Trimestriel" },
  { value: "ANNUEL", label: "Annuel" },
];

/** Modes paiement */
export const MODES_PAIEMENT = [
  { value: "virement", label: "Virement", icon: "arrow-right" },
  { value: "prelevement", label: "Prelevement SEPA", icon: "credit-card" },
  { value: "cheque", label: "Cheque", icon: "file-text" },
];
