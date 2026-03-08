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

export interface LettreMission {
  numero: string; // LM-2026-001
  date: string;
  client: Client;
  cabinet: CabinetConfig;
  template: LettreMissionTemplate;
  blocs: LettreMissionBloc[];
  metadata: LettreMissionMetadata;
}

export interface LettreMissionBloc {
  id: string;
  type: BlocType;
  titre: string;
  contenuBrut: string; // avant remplacement variables
  contenuRendu: string; // après remplacement variables
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
  ics: string; // Identifiant Créancier SEPA du cabinet
}
