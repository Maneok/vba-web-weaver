export type VigilanceLevel = "SIMPLIFIEE" | "STANDARD" | "RENFORCEE";
export type EtatDossier = "PROSPECT" | "EN COURS" | "VALIDE" | "REFUSE" | "ARCHIVE";
export type EtatPilotage = "A JOUR" | "RETARD" | "BIENTÔT";
export type StatutClient = "ACTIF" | "RETARD" | "INACTIF";
export type OuiNon = "OUI" | "NON";
export type AlertPriority = "CRITIQUE" | "HAUTE" | "MOYENNE" | "BASSE";

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
  dateDerniereRevue: string;
  dateButoir: string;
  etatPilotage: EtatPilotage;
  dateExpCni: string;
  statut: StatutClient;
  be: string;
  dateFin?: string;
  lienKbis?: string;
  lienStatuts?: string;
  lienCni?: string;
  // CORRECTION 3: Data provenance
  dataProvenance?: Array<{
    field: string;
    value: unknown;
    source: "INPI" | "Pappers" | "AnnuaireEntreprises" | "BODACC" | "Manuel";
    retrievedAt: string;
    confidence: "verified" | "single_source" | "divergent";
  }>;
  // CORRECTION 6: RGPD non-diffusion
  nonDiffusible?: boolean;
  // CORRECTION 1: EI type
  typePersonne?: "morale" | "physique" | "exploitation" | "unknown";
}

export interface Collaborateur {
  id?: string;
  nom: string;
  fonction: string;
  referentLcb: boolean;
  suppleant: string;
  niveauCompetence: string;
  dateSignatureManuel: string;
  derniereFormation: string;
  statutFormation: string;
  email: string;
  telephone?: string;
  dateRecrutement?: string;
}

export interface AlerteRegistre {
  id?: string;
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
  priorite?: AlertPriority;
}

export interface ControleQualite {
  id?: string;
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
  controleur: string;
  actionCorrectrice: string;
  dateEcheance: string;
  suiviStatut: string;
  createdAt?: string;
}

export interface LogEntry {
  horodatage: string;
  utilisateur: string;
  refClient: string;
  typeAction: string;
  details: string;
}
