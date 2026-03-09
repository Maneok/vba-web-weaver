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
  clause_lcbft: boolean;
  clause_travail_dissimule: boolean;
  clause_rgpd: boolean;
  clauses_supplementaires: string;

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
  statut: string; // brouillon | envoyee | signee
  signature_expert: string;
  signature_client: string;
  date_signature: string;

  // Meta
  cabinet_id: string;
  created_by: string;
  wizard_step: number;
}

export const LM_TOTAL_STEPS = 6;

export const LM_STEP_LABELS = [
  "Client",
  "Missions",
  "Details",
  "Honoraires",
  "Apercu",
  "Export",
] as const;

export const LM_STEP_TITLES = [
  "Pour quel client ?",
  "Quelles missions realiser ?",
  "Precisez les modalites",
  "Definissez vos honoraires",
  "Verifiez votre lettre",
  "Votre lettre est prete !",
] as const;

/** Estimated seconds per step */
export const LM_STEP_DURATIONS = [30, 60, 45, 30, 30, 15] as const;

export const INITIAL_LM_WIZARD_DATA: LMWizardData = {
  client_id: "",
  client_ref: "",
  raison_sociale: "",
  siren: "",
  forme_juridique: "",
  type_mission: "",
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
  missions_selected: [],
  duree: "1",
  date_debut: new Date().toISOString().slice(0, 10),
  tacite_reconduction: true,
  preavis_mois: 3,
  associe_signataire: "",
  chef_mission: "",
  referent_lcb: "",
  clause_lcbft: true,
  clause_travail_dissimule: true,
  clause_rgpd: true,
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
  statut: string;
  created_at: string;
  updated_at: string;
  wizard_data: LMWizardData;
}
