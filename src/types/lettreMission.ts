import type { Client } from "@/lib/types";

export interface CabinetConfig {
  nom: string;
  adresse: string;
  cp: string;
  ville: string;
  siret: string;
  numeroOEC: string;
  email: string;
  telephone: string;
  logo?: string; // base64
  couleurPrimaire: string;
  couleurSecondaire: string;
  police: string;
}

export interface LettreMissionTemplate {
  id: string;
  nom: string;
  description: string;
  blocs: BlocTemplate[];
  createdAt: string;
  updatedAt: string;
}

export type BlocType =
  | "identification"
  | "mission"
  | "honoraires"
  | "paiement"
  | "lcbft"
  | "kyc"
  | "resiliation"
  | "rgpd"
  | "juridiction"
  | "signature"
  | "sepa"
  | "repartition"
  | "attestation_travail_dissimule"
  | "autorisation_liasse"
  | "conditions_generales"
  | "social"
  | "juridique_mission"
  | "controle_fiscal"
  | "custom";

export interface BlocTemplate {
  id: string;
  type: BlocType;
  titre: string;
  contenu: string; // avec variables {{...}}
  ordre: number;
  obligatoire: boolean;
  visible: boolean;
}

export interface EditorSectionSnapshot {
  id: string;
  title: string;
  visible: boolean;
  content: string;
}

export interface LettreMission {
  numero: string; // LM-2026-001
  date: string;
  client: Client;
  cabinet: CabinetConfig;
  template: LettreMissionTemplate;
  blocs: LettreMissionBloc[];
  metadata: LettreMissionMetadata;
  options: LettreMissionOptions;
  /** Editor sections with user-edited content (if available) */
  editorSections?: EditorSectionSnapshot[];
}

export interface LettreMissionOptions {
  genre: "M" | "F";
  missionSociale: boolean;
  missionJuridique: boolean;
  missionControleFiscal: boolean;
  honorairesSocial: number;
  honorairesJuridique: number;
  honorairesControleFiscal: number;
  fraisConstitution: number;
  exerciceDebut: string; // "01/01/2026"
  exerciceFin: string;   // "31/12/2026"
  regimeFiscal: string;
  tvaRegime: string;
  cac: boolean;
  volumeComptable: string;
  periodicite: string;
  outilComptable: string;
  controleFiscalOptions: string[];
}

export interface LettreMissionBloc {
  id: string;
  type: BlocType;
  titre: string;
  contenuBrut: string;
  contenuRendu: string;
  ordre: number;
  visible: boolean;
}

export interface LettreMissionMetadata {
  genereLe: string;
  genereParUser: string;
  version: number;
  statut: "brouillon" | "envoye" | "signe" | "archive";
  signatureCabinet?: string;
  signatureClient?: string;
  dateSignature?: string;
}

export interface HonoraireDetail {
  designation: string;
  montantHT: number;
  frequence: string;
}

export interface SepaMandat {
  iban: string;
  bic: string;
  titulaire: string;
  dateSignature: string;
  reference: string;
  ics: string;
}

export interface LettreMissionValidation {
  valid: boolean;
  champsManquants: string[];
}

export const DEFAULT_LM_OPTIONS: LettreMissionOptions = {
  genre: "M",
  missionSociale: false,
  missionJuridique: false,
  missionControleFiscal: false,
  honorairesSocial: 0,
  honorairesJuridique: 0,
  honorairesControleFiscal: 0,
  fraisConstitution: 0,
  exerciceDebut: "01/01/2026",
  exerciceFin: "31/12/2026",
  regimeFiscal: "IS — Impôt sur les Sociétés",
  tvaRegime: "Réel normal",
  cac: false,
  volumeComptable: "< 500 écritures/an",
  periodicite: "Mensuelle",
  outilComptable: "Non précisé",
  controleFiscalOptions: [],
};
