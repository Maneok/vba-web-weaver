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
    category: "core",
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
    category: "core",
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
    category: "core",
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
    category: "core",
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
    category: "obligatoire",
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
    category: "obligatoire",
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
    category: "optionnel",
    sous_options: [
      { id: "gestion", label: "Conseil en gestion", selected: false },
      { id: "previsionnel", label: "Budget previsionnel", selected: false },
      { id: "tableau_bord", label: "Tableau de bord periodique", selected: false },
    ],
  },
];

// ─── (1) Mission presets by legal form ───
export interface MissionPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  formes: string[]; // matching forme_juridique values
  sections: Record<string, boolean>; // section_id → selected
  subOptions?: Record<string, string[]>; // section_id → selected sub-option ids
}

export const MISSION_PRESETS: MissionPreset[] = [
  {
    id: "pack_comptable_standard",
    label: "Pack Comptable Standard",
    description: "Tenue + Fiscal + LCB-FT — ideal pour TPE/PME",
    icon: "briefcase",
    formes: ["SARL", "SAS", "SASU", "EURL", "ENTREPRISE INDIVIDUELLE", "SA"],
    sections: { comptabilite: true, fiscal: true, social: false, juridique: false, conseil: false },
  },
  {
    id: "pack_sarl_complet",
    label: "Pack SARL Complet",
    description: "Comptabilite + Social + Fiscal + Juridique",
    icon: "building2",
    formes: ["SARL", "EURL"],
    sections: { comptabilite: true, fiscal: true, social: true, juridique: true, conseil: false },
  },
  {
    id: "pack_sas_complet",
    label: "Pack SAS / SASU",
    description: "Tenue complete avec paie et juridique annuel",
    icon: "building",
    formes: ["SAS", "SASU", "SA"],
    sections: { comptabilite: true, fiscal: true, social: true, juridique: true, conseil: false },
  },
  {
    id: "pack_sci",
    label: "Pack SCI",
    description: "Comptabilite + Fiscal + Juridique (AG obligatoire)",
    icon: "home",
    formes: ["SCI"],
    sections: { comptabilite: true, fiscal: true, social: false, juridique: true, conseil: false },
    subOptions: { juridique: ["ag", "approbation"] },
  },
  {
    id: "pack_association",
    label: "Pack Association",
    description: "Comptabilite + Fiscal (TVA exoneree) + Conseil",
    icon: "heart",
    formes: ["ASSOCIATION", "ASSO"],
    sections: { comptabilite: true, fiscal: true, social: false, juridique: false, conseil: true },
  },
  {
    id: "pack_ei_micro",
    label: "Pack Micro / EI",
    description: "Tenue simplifiee + Fiscal IR + Conseil gestion",
    icon: "user",
    formes: ["ENTREPRISE INDIVIDUELLE", "MICRO-ENTREPRISE"],
    sections: { comptabilite: true, fiscal: true, social: false, juridique: false, conseil: true },
    subOptions: { comptabilite: ["saisie", "rapprochement", "bilan"], fiscal: ["is"] },
  },
];

/** Apply a mission preset to the current missions list */
export function applyMissionPreset(preset: MissionPreset, baseMissions: MissionSelection[]): MissionSelection[] {
  return baseMissions.map((m) => {
    if (m.locked) return { ...m, sous_options: m.sous_options.map((s) => ({ ...s })) };
    const shouldSelect = preset.sections[m.section_id] ?? false;
    const presetSubs = preset.subOptions?.[m.section_id];
    return {
      ...m,
      selected: shouldSelect,
      sous_options: m.sous_options.map((s) => ({
        ...s,
        selected: shouldSelect ? (presetSubs ? presetSubs.includes(s.id) : true) : false,
      })),
    };
  });
}

/** Get recommended presets for a given forme juridique */
export function getPresetsForForme(forme: string): MissionPreset[] {
  if (!forme) return MISSION_PRESETS;
  const matching = MISSION_PRESETS.filter((p) => p.formes.some((f) => forme.toUpperCase().includes(f)));
  // Always include all presets, matching ones first
  const rest = MISSION_PRESETS.filter((p) => !matching.includes(p));
  return [...matching, ...rest];
}

// ─── (2) Fee suggestion ranges by mission type & legal form ───
export interface FeeRange {
  label: string;
  min: number;
  max: number;
  typical: number;
}

export const FEE_PRESETS: { value: number; label: string }[] = [
  { value: 2400, label: "2 400 €" },
  { value: 4800, label: "4 800 €" },
  { value: 7200, label: "7 200 €" },
  { value: 12000, label: "12 000 €" },
];

export const FEE_RANGES: Record<string, FeeRange> = {
  "ENTREPRISE INDIVIDUELLE": { label: "EI / Micro", min: 1200, max: 4800, typical: 2400 },
  SCI: { label: "SCI", min: 1500, max: 5000, typical: 2500 },
  EURL: { label: "EURL", min: 2400, max: 7200, typical: 4000 },
  SARL: { label: "SARL", min: 3600, max: 12000, typical: 6000 },
  SAS: { label: "SAS / SASU", min: 3600, max: 15000, typical: 7200 },
  SASU: { label: "SAS / SASU", min: 3600, max: 15000, typical: 7200 },
  SA: { label: "SA", min: 6000, max: 25000, typical: 12000 },
  ASSOCIATION: { label: "Association", min: 1200, max: 6000, typical: 3000 },
};

export function getFeeRange(forme: string): FeeRange | null {
  if (!forme) return null;
  const upper = forme.toUpperCase();
  return FEE_RANGES[upper] || null;
}

// ─── (3) Common supplementary clause templates ───
export const CLAUSE_TEMPLATES = [
  { id: "paiement_30j", label: "Paiement a 30 jours", text: "Les honoraires sont payables a 30 jours date de facture. Tout retard de paiement entrainera l'application de penalites de retard au taux legal en vigueur." },
  { id: "revision_annuelle", label: "Revision annuelle des honoraires", text: "Les honoraires pourront etre revises annuellement, a la date anniversaire du contrat, en fonction de l'evolution de l'indice Syntec et du volume d'activite." },
  { id: "confidentialite", label: "Clause de confidentialite", text: "Les parties s'engagent mutuellement a ne divulguer aucune information confidentielle dont elles auraient connaissance dans le cadre de l'execution de la presente lettre de mission." },
  { id: "resiliation_anticipee", label: "Resiliation anticipee", text: "Chaque partie pourra resilier la presente lettre de mission par lettre recommandee avec accuse de reception, moyennant le respect d'un preavis de 3 mois." },
  { id: "limitation_responsabilite", label: "Limitation de responsabilite", text: "La responsabilite du cabinet est limitee au montant des honoraires annuels percus au titre de la presente mission, sauf faute lourde ou intentionnelle." },
  { id: "sous_traitance", label: "Sous-traitance autorisee", text: "Le cabinet se reserve le droit de faire appel a des sous-traitants pour l'execution de certaines taches, sous sa responsabilite et dans le respect du secret professionnel." },
  { id: "dossier_permanent", label: "Constitution du dossier permanent", text: "Le client s'engage a fournir dans un delai de 30 jours les pieces necessaires a la constitution et a la mise a jour du dossier permanent." },
  { id: "demat_factures", label: "Dematerialisation des factures", text: "Le client s'engage a transmettre l'ensemble de ses pieces comptables par voie dematerialisee via la plateforme mise a disposition par le cabinet." },
];

// ─── (4) Smart sub-option auto-select based on effectif ───
export function getSmartSubOptions(effectif: string): Record<string, string[]> {
  const n = parseInt(effectif) || 0;
  const result: Record<string, string[]> = {};
  if (n >= 1) {
    result.social = ["paie", "dsn"];
  }
  if (n >= 5) {
    result.social = ["paie", "dsn", "contrats"];
  }
  if (n >= 10) {
    result.social = ["paie", "dsn", "contrats", "solde"];
  }
  return result;
}

/** SCI → auto-select juridique */
export function applyFormConditionals(
  missions: MissionSelection[],
  forme: string,
  effectif: string
): MissionSelection[] {
  // (F9) Deep copy with guard against undefined sous_options
  let result = missions.map((m) => ({ ...m, sous_options: (m.sous_options || []).map((s) => ({ ...s })) }));

  // SCI → juridique ON
  if (forme === "SCI") {
    result = result.map((m) =>
      m.section_id === "juridique"
        ? { ...m, selected: true, sous_options: m.sous_options.map((s) => ({ ...s, selected: true })) }
        : m
    );
  }

  // Effectif > 0 → social ON with smart sub-options
  if (effectif && parseInt(effectif) > 0) {
    const smartSubs = getSmartSubOptions(effectif);
    result = result.map((m) =>
      m.section_id === "social"
        ? {
            ...m,
            selected: true,
            sous_options: m.sous_options.map((s) => ({
              ...s,
              selected: smartSubs.social ? smartSubs.social.includes(s.id) : true,
            })),
          }
        : m
    );
  }

  return result;
}

/** Qualités dirigeant — (8) expanded list */
export const QUALITES_DIRIGEANT = [
  "Gerant",
  "President",
  "Directeur General",
  "Co-gerant",
  "Administrateur",
  "Associe unique",
  "Tresorier",
  "Secretaire general",
  "Directeur Administratif et Financier",
  "Representant legal",
];

/** Durées proposées — (5) with legal context */
export const DUREES = [
  { value: "1", label: "1 an", description: "Duree standard (recommande)", icon: "calendar" },
  { value: "2", label: "2 ans", description: "Engagement moyen terme", icon: "calendar-range" },
  { value: "3", label: "3 ans", description: "Engagement long terme — fidelite", icon: "calendar-check" },
];

/** Fréquences facturation — (6) with descriptions */
export const FREQUENCES = [
  { value: "MENSUEL", label: "Mensuel", description: "12 factures / an", icon: "calendar-days" },
  { value: "TRIMESTRIEL", label: "Trimestriel", description: "4 factures / an", icon: "calendar-range" },
  { value: "ANNUEL", label: "Annuel", description: "1 facture / an", icon: "calendar" },
];

/** Modes paiement — (7) with descriptions */
export const MODES_PAIEMENT = [
  { value: "virement", label: "Virement", icon: "arrow-right", description: "Virement bancaire classique" },
  { value: "prelevement", label: "Prelevement SEPA", icon: "credit-card", description: "Prelevement automatique" },
  { value: "cheque", label: "Cheque", icon: "file-text", description: "Cheque bancaire" },
];

/** Echeance jours options — (37) */
export const ECHEANCE_OPTIONS = [
  { value: 0, label: "Comptant", description: "A reception" },
  { value: 15, label: "15 jours", description: "Net 15" },
  { value: 30, label: "30 jours", description: "Net 30 (standard)" },
  { value: 45, label: "45 jours", description: "Net 45" },
  { value: 60, label: "60 jours", description: "Net 60" },
];
