export type VigilanceLevel = "SIMPLIFIEE" | "STANDARD" | "RENFORCEE";
export type EtatDossier = "PROSPECT" | "EN COURS" | "VALIDE" | "REFUSE" | "ARCHIVE";
export type EtatPilotage = "A JOUR" | "RETARD" | "BIENTÔT";
export type StatutClient = "ACTIF" | "RETARD" | "INACTIF";
export type OuiNon = "OUI" | "NON";

export type MissionType =
  | "TENUE COMPTABLE"
  | "REVISION / SURVEILLANCE"
  | "SOCIAL / PAIE SEULE"
  | "CONSEIL DE GESTION"
  | "CONSTITUTION / CESSION"
  | "DOMICILIATION"
  | "IRPP";

export type FormeJuridique =
  | "ENTREPRISE INDIVIDUELLE"
  | "SARL"
  | "EURL"
  | "SAS"
  | "SCI"
  | "SCP"
  | "SELAS"
  | "EARL"
  | "SA"
  | "ASSOCIATION"
  | string;

export type DocumentType = "KBIS" | "STATUTS" | "CNI" | "RIB" | "LETTRE_MISSION" | "FICHE_LCB" | "COMPTES_ANNUELS" | "AUTRE";

export interface ClientDocument {
  id: string;
  type: DocumentType;
  name: string;
  url: string;
  uploadDate: string;
  expiryDate?: string;
  version: number;
  previousVersions?: { url: string; uploadDate: string }[];
}

export interface ScoreHistoryEntry {
  date: string;
  scoreGlobal: number;
  nivVigilance: VigilanceLevel;
  motif: string;
  details?: {
    scoreActivite: number;
    scorePays: number;
    scoreMission: number;
    scoreMaturite: number;
    scoreStructure: number;
    malus: number;
  };
}

export interface Client {
  ref: string;
  etat: EtatDossier;
  comptable: string;
  mission: MissionType;
  raisonSociale: string;
  forme: FormeJuridique;
  adresse: string;
  cp: string;
  ville: string;
  siren: string;
  capital: number;
  ape: string;
  dirigeant: string;
  domaine: string;
  effectif: string;
  tel: string;
  mail: string;
  dateCreation: string;
  dateReprise: string;
  honoraires: number;
  reprise: number;
  juridique: number;
  frequence: string;
  iban: string;
  bic: string;
  associe: string;
  superviseur: string;
  ppe: OuiNon;
  paysRisque: OuiNon;
  atypique: OuiNon;
  distanciel: OuiNon;
  cash: OuiNon;
  pression: OuiNon;
  scoreActivite: number;
  scorePays: number;
  scoreMission: number;
  scoreMaturite: number;
  scoreStructure: number;
  malus: number;
  scoreGlobal: number;
  nivVigilance: VigilanceLevel;
  dateCreationLigne: string;
  lienKbis?: string;
  lienStatuts?: string;
  lienCni?: string;
  dateDerniereRevue: string;
  dateButoir: string;
  etatPilotage: EtatPilotage;
  dateExpCni: string;
  statut: StatutClient;
  be: string;
  dateFin?: string;
  documents?: ClientDocument[];
  scoreHistory?: ScoreHistoryEntry[];
  kycCompleteness?: number;
  ppeDetails?: string;
  gelAvoirs?: "CLEAN" | "FLAGGED" | "UNKNOWN";
}

export interface Collaborateur {
  nom: string;
  fonction: string;
  referentLcb: boolean;
  suppleant: string;
  niveauCompetence: string;
  dateSignatureManuel: string;
  derniereFormation: string;
  statutFormation: string;
  email: string;
}

export interface AlerteRegistre {
  date: string;
  clientConcerne: string;
  categorie: string;
  details: string;
  actionPrise: string;
  responsable: string;
  qualification: string;
  statut: string;
  dateButoir: string;
  typeDecision: string;
  validateur: string;
}

export interface ControleQualite {
  dateTirage: string;
  dossierAudite: string;
  siren: string;
  forme: string;
  ppe: OuiNon;
  paysRisque: OuiNon;
  atypique: OuiNon;
  distanciel: OuiNon;
  cash: OuiNon;
  pression: OuiNon;
  scoreGlobal: number;
  nivVigilance: VigilanceLevel;
  point1: string;
  point2: string;
  point3: string;
  resultatGlobal: string;
  incident: string;
  commentaire: string;
}

export interface LogEntry {
  horodatage: string;
  utilisateur: string;
  refClient: string;
  typeAction: string;
  details: string;
}

export interface CockpitAlert {
  type: "retard" | "cni_expire" | "incoherence" | "kyc_incomplet" | "formation" | "fantome";
  severity: "critical" | "warning" | "info";
  message: string;
  clientRef?: string;
  clientName?: string;
}
