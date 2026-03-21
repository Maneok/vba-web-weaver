// ══════════════════════════════════════════════
// Types for @react-pdf/renderer PDF generation
// ══════════════════════════════════════════════

export interface CabinetInfo {
  nom: string;
  adresse: string;
  cp: string;
  ville: string;
  telephone: string;
  email: string;
  siret: string;
  oec_numero: string;
  logo_base64?: string;
  assurance_nom: string;
  assurance_contrat: string;
  assurance_adresse: string;
  couleur_primaire: string;
  couleur_secondaire: string;
}

export interface ClientLmData {
  civilite: "M." | "Mme";
  nom_dirigeant: string;
  raison_sociale: string;
  nom_commercial?: string;
  forme_juridique: string;
  adresse: string;
  code_postal: string;
  ville: string;
  siren: string;
  siret: string;
  code_ape: string;
  activite_principale: string;
  capital_social?: string;
  date_creation?: string;
  regime_fiscal: string;
  exercice_debut: string;
  exercice_fin: string;
  tva: boolean;
  cac: boolean;
  effectif?: number;
  volume_comptable?: string;
}

export interface MissionConfig {
  type_principal: string;
  norme_applicable: string;
  mission_sociale: boolean;
  mission_juridique: boolean;
  controle_fiscal: boolean;
  controle_fiscal_option?: "A" | "B" | "aucune";
  missions_complementaires?: string[];
}

export interface HonorairesData {
  forfait_annuel_ht: number;
  constitution_dossier_ht: number;
  honoraires_ec_heure: number;
  honoraires_collab_heure: number;
  juridique_annuel_ht: number;
  frequence_facturation: "MENSUEL" | "TRIMESTRIEL" | "ANNUEL";
  social_bulletin_unite: number;
  social_fin_contrat: number;
  social_contrat_simple: number;
  social_entree_sans_contrat: number;
  social_attestation_maladie: number;
  /** Per-mission breakdown from wizard step 4 */
  detail?: Record<string, number>;
  mode_paiement?: string;
}

export interface LcbftData {
  score_risque: number;
  niveau_vigilance: "SIMPLIFIEE" | "STANDARD" | "RENFORCEE";
  statut_ppe: boolean;
  derniere_diligence_kyc?: string;
  prochaine_maj_kyc?: string;
}

export interface PdfRepartitionRow {
  tache: string;
  cabinet: boolean;
  client: boolean;
  periodicite: string;
  categorie?: string;
}

export interface LettreMissionPdfData {
  numero_lm: string;
  date_generation: string;
  cabinet: CabinetInfo;
  client: ClientLmData;
  mission: MissionConfig;
  honoraires: HonorairesData;
  lcbft: LcbftData;
  repartition: PdfRepartitionRow[];
  expert_responsable: string;
  periodicite_transmission: string;
  outil_transmission: string;
  is_brouillon: boolean;
  sections_visibles: string[];
  // Instance-based generation (modele system)
  sections_snapshot?: { id: string; titre: string; contenu: string; type: string; ordre: number }[];
  cgv_snapshot?: string;
  signature_expert?: string;
  signature_client?: string;
  // SEPA data from wizard
  iban?: string;
  bic?: string;
}
