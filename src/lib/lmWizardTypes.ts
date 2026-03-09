// ──────────────────────────────────────────────
// Types pour le wizard Lettre de Mission (10 étapes)
// ──────────────────────────────────────────────

export interface LMWizardData {
  // Step 1 — Client
  client_id: string;
  client_ref: string;
  raison_sociale: string;
  siren: string;

  // Step 2 — Type de lettre
  template_id: string;
  forme_juridique: string;
  type_mission: "TENUE" | "SURVEILLANCE" | "REVISION" | "CAC";

  // Step 3 — Informations client
  dirigeant: string;
  qualite_dirigeant: string;
  adresse: string;
  cp: string;
  ville: string;
  capital: string;
  ape: string;
  email: string;
  telephone: string;
  rcs: string;
  date_cloture: string;

  // Step 4 — Missions
  missions_selected: MissionSelection[];

  // Step 5 — Modalités
  duree: string;
  date_debut: string;
  tacite_reconduction: boolean;
  preavis_mois: number;
  frequence_rdv: string;
  lieu_execution: string;

  // Step 6 — Honoraires
  honoraires_ht: number;
  taux_tva: number;
  frequence_facturation: string;
  mode_paiement: string;
  iban: string;
  bic: string;
  echeance_jours: number;
  taux_horaire_complementaire: number;

  // Step 7 — Intervenants
  associe_signataire: string;
  chef_mission: string;
  collaborateurs: string[];
  referent_lcb: string;
  numero_oec: string;

  // Step 8 — Clauses
  clause_lcbft: boolean;
  clause_travail_dissimule: boolean;
  clause_rgpd: boolean;
  clause_responsabilite: boolean;
  plafond_responsabilite: number;
  clauses_supplementaires: string;

  // Meta
  statut: "BROUILLON" | "ENVOYEE" | "SIGNEE" | "ARCHIVEE";
  wizard_step: number;
}

export interface MissionSelection {
  section_id: string;
  label: string;
  selected: boolean;
  sous_options: { id: string; label: string; selected: boolean }[];
}

export const LM_STEP_LABELS = [
  "Client",
  "Type",
  "Informations",
  "Missions",
  "Modalites",
  "Honoraires",
  "Intervenants",
  "Clauses",
  "Apercu",
  "Export",
] as const;

export const LM_STEP_DESCRIPTIONS = [
  "Selectionnez le client concerne",
  "Choisissez le type de lettre de mission",
  "Verifiez les informations du client",
  "Selectionnez les missions a inclure",
  "Definissez les modalites du contrat",
  "Configurez les honoraires et la facturation",
  "Designez l'equipe intervenante",
  "Activez les clauses reglementaires",
  "Previsualisation de la lettre",
  "Exportez et envoyez la lettre",
] as const;

export const INITIAL_LM_WIZARD_DATA: LMWizardData = {
  client_id: "",
  client_ref: "",
  raison_sociale: "",
  siren: "",
  template_id: "default",
  forme_juridique: "SARL",
  type_mission: "TENUE",
  dirigeant: "",
  qualite_dirigeant: "Gerant",
  adresse: "",
  cp: "",
  ville: "",
  capital: "",
  ape: "",
  email: "",
  telephone: "",
  rcs: "",
  date_cloture: "",
  missions_selected: [],
  duree: "1 an",
  date_debut: new Date().toISOString().slice(0, 10),
  tacite_reconduction: true,
  preavis_mois: 3,
  frequence_rdv: "TRIMESTRIEL",
  lieu_execution: "cabinet",
  honoraires_ht: 0,
  taux_tva: 20,
  frequence_facturation: "MENSUEL",
  mode_paiement: "virement",
  iban: "",
  bic: "",
  echeance_jours: 30,
  taux_horaire_complementaire: 150,
  associe_signataire: "",
  chef_mission: "",
  collaborateurs: [],
  referent_lcb: "",
  numero_oec: "",
  clause_lcbft: true,
  clause_travail_dissimule: true,
  clause_rgpd: false,
  clause_responsabilite: false,
  plafond_responsabilite: 0,
  clauses_supplementaires: "",
  statut: "BROUILLON",
  wizard_step: 0,
};

export interface SavedLetter {
  id: string;
  numero: string;
  client_ref: string;
  raison_sociale: string;
  type_mission: string;
  statut: "BROUILLON" | "ENVOYEE" | "SIGNEE" | "ARCHIVEE";
  created_at: string;
  updated_at: string;
  wizard_data: LMWizardData;
}
