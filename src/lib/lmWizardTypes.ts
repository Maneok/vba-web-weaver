// ──────────────────────────────────────────────
// Types centraux du wizard Lettre de Mission (6 étapes)
// ──────────────────────────────────────────────

export interface MissionSubOption {
  id: string;
  label: string;
  selected: boolean;
}

export interface MissionSelection {
  section_id: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
  selected: boolean;
  locked?: boolean;
  sous_options: MissionSubOption[];
}

export interface LMWizardData {
  // Step 1 — Client & type
  client_id: string;
  client_ref: string;
  raison_sociale: string;
  siren: string;
  forme_juridique: string;
  type_mission: string; // TENUE | SURVEILLANCE | REVISION
  mission_type_id: string; // normative OEC mission type (presentation, examen_limite, etc.)

  // Client info (pre-filled)
  dirigeant: string;
  qualite_dirigeant: string;
  adresse: string;
  cp: string;
  ville: string;
  capital: string;
  ape: string;
  rcs: string;
  email: string;
  telephone: string;
  date_cloture: string;

  // Step 2 — Missions
  missions_selected: MissionSelection[];

  // Step 3 — Détails & modalités
  duree: string; // "1" | "2" | "3"
  date_debut: string;
  tacite_reconduction: boolean;
  preavis_mois: number;
  associe_signataire: string;
  chef_mission: string;
  referent_lcb: string;
  validateur: string; // C) Co-édition: collaborateur qui valide
  clause_lcbft: boolean;
  clause_travail_dissimule: boolean;
  clause_rgpd: boolean;
  clause_conciliation_croec: boolean;
  clauses_supplementaires: string;

  // Mission-specific variables (dynamic per mission type)
  specific_variables: Record<string, string>;

  // Honoraires de succès (OPT-11)
  honoraires_succes_prevu: boolean;
  honoraires_succes_conditions: string;
  honoraires_succes_montant: string;

  // Step 4 — Honoraires
  honoraires_ht: number;
  taux_tva: number;
  frequence_facturation: string; // MENSUEL | TRIMESTRIEL | ANNUEL
  echeance_jours: number;
  mode_paiement: string; // virement | prelevement | cheque
  iban: string;
  bic: string;
  taux_horaire_complementaire: number;

  // Step 5/6 — Preview & export
  numero_lettre: string;
  statut: string; // brouillon | en_validation | envoyee | signee | archivee
  signature_expert: string;
  signature_client: string;
  date_signature: string;

  // E) Annexes automatiques
  annexes: string[]; // computed list of annexe IDs

  // H) Temps de création
  started_at: string; // ISO timestamp when wizard opened
  duration_seconds: number; // computed on final export

  // Modele integration
  modele_id: string; // selected LM modele ID (empty = GRIMY default)

  // Meta
  cabinet_id: string;
  created_by: string;
  wizard_step: number;
}

export const LM_TOTAL_STEPS = 8;

export const LM_STEP_LABELS = [
  "Client",
  "Mission",
  "Prestations",
  "Parametres",
  "Honoraires",
  "Clauses",
  "Apercu",
  "Export",
] as const;

export const LM_STEP_TITLES = [
  "Pour quel client ?",
  "Quel type de mission ?",
  "Quelles prestations complementaires ?",
  "Modele, duree et responsable",
  "Definissez vos honoraires",
  "Clauses et conditions generales",
  "Verifiez votre lettre",
  "Votre lettre est prete !",
] as const;

/** Estimated seconds per step */
export const LM_STEP_DURATIONS = [20, 30, 30, 30, 30, 15, 30, 15] as const;

/** C) Statuts workflow */
export const LM_STATUTS = [
  { value: "brouillon", label: "Brouillon", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { value: "en_validation", label: "En validation", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "envoyee", label: "Envoyee", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "signee", label: "Signee", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "archivee", label: "Archivee", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { value: "resiliee", label: "Resiliee", color: "bg-red-500/10 text-red-400 border-red-500/20" },
] as const;

export const INITIAL_LM_WIZARD_DATA: LMWizardData = {
  client_id: "",
  client_ref: "",
  raison_sociale: "",
  siren: "",
  forme_juridique: "",
  type_mission: "",
  mission_type_id: "presentation",
  dirigeant: "",
  qualite_dirigeant: "Gerant",
  adresse: "",
  cp: "",
  ville: "",
  capital: "",
  ape: "",
  rcs: "",
  email: "",
  telephone: "",
  date_cloture: "",
  specific_variables: {},
  honoraires_succes_prevu: false,
  honoraires_succes_conditions: "",
  honoraires_succes_montant: "",
  missions_selected: [],
  duree: "1",
  date_debut: new Date().toISOString().slice(0, 10),
  tacite_reconduction: true,
  preavis_mois: 3,
  associe_signataire: "",
  chef_mission: "",
  referent_lcb: "",
  validateur: "",
  clause_lcbft: true,
  clause_travail_dissimule: true,
  clause_rgpd: true,
  clause_conciliation_croec: true,
  clauses_supplementaires: "",
  honoraires_ht: 0,
  taux_tva: 20,
  frequence_facturation: "MENSUEL",
  echeance_jours: 30,
  mode_paiement: "virement",
  iban: "",
  bic: "",
  taux_horaire_complementaire: 0,
  numero_lettre: "",
  statut: "brouillon",
  signature_expert: "",
  signature_client: "",
  date_signature: "",
  annexes: [],
  started_at: "",
  duration_seconds: 0,
  modele_id: "",
  cabinet_id: "",
  created_by: "",
  wizard_step: 0,
};

export interface SavedLetter {
  id: string;
  numero: string;
  client_ref: string;
  raison_sociale: string;
  type_mission: string;
  status: string;
  created_at: string;
  updated_at: string;
  wizard_data: LMWizardData;
  duration_seconds?: number;
  honoraires_ht?: number;
  missions_count?: number;
}

/** E) Compute auto annexes from wizard data */
export function computeAnnexes(data: LMWizardData): string[] {
  const annexes: string[] = [];
  // Always
  annexes.push("cgv_cabinet");
  annexes.push("autorisation_liasse");
  annexes.push("repartition_travaux");
  if (data.clause_travail_dissimule !== false) annexes.push("clause_travail_dissimule");

  // Social missions → annexe repartition travaux sociaux
  if (data.missions_selected.some((m) => m.section_id === "social" && m.selected)) {
    annexes.push("repartition_travaux_sociaux");
  }
  // SEPA → mandat SEPA
  if (data.mode_paiement === "prelevement") {
    annexes.push("mandat_sepa");
  }
  // Missions complementaires (conseil)
  if (data.missions_selected.some((m) => m.section_id === "conseil" && m.selected)) {
    annexes.push("detail_missions_complementaires");
  }
  return annexes;
}

/** E) Annexe labels */
export const ANNEXE_LABELS: Record<string, string> = {
  cgv_cabinet: "Conditions Generales d'Intervention",
  clause_travail_dissimule: "Clause relative au travail dissimule",
  repartition_travaux_sociaux: "Repartition des travaux sociaux",
  mandat_sepa: "Mandat de prelevement SEPA",
  detail_missions_complementaires: "Detail des missions complementaires",
};

/** OPT-8: Typed honoraires data */
export interface HonorairesData {
  forfait_annuel?: number;
  setup?: number;
  taux_horaire_ec?: number;
  taux_horaire_collab?: number;
  social_par_bulletin?: number;
  juridique_annuel?: number;
  controle_fiscal_option?: 'A' | 'B' | 'aucune';
  honoraires_succes?: { active: boolean; conditions?: string; montant?: string };
  frequence_facturation?: 'mensuel' | 'trimestriel' | 'annuel';
}

/** H) Format duration */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const min = Math.floor(seconds / 60) % 60;
  const sec = Math.floor(seconds % 60);
  if (h === 0 && min === 0) return `${sec}s`;
  if (h === 0) return `${min} min ${sec > 0 ? `${sec} s` : ""}`.trim();
  return `${h}h ${min > 0 ? `${min} min ` : ""}${sec > 0 ? `${sec} s` : ""}`.trim();
}
