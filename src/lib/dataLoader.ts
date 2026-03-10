import type { Client, Collaborateur, AlerteRegistre, LogEntry } from "./types";
import clientsRaw from "../../clients_o90.json";
import gouvRaw from "../../gouv_o90.json";
import registreRaw from "../../registre_o90.json";
import paramRaw from "../../param_o90.json";

// ====== PARAM DATA ======
export const PARAM_DATA = paramRaw as {
  ape_scores: Array<{ code: string; score: number; description: string }>;
  pays_risque: Array<{ pays: string; score: number; categorie: string }>;
  mission_scores: Array<{ mission: string; score: number; description: string }>;
  seuils: { SEUIL_BAS: number; SEUIL_HAUT: number; SEUIL_CRITIQUE: number };
  malus: Record<string, number>;
  def_score_act: number;
};

// ====== MAP JSON snake_case → Client camelCase ======
function mapClient(raw: Record<string, unknown>): Client {
  return {
    ref: raw.ref as string,
    etat: (raw.etat as string) || "VALIDE",
    comptable: (raw.comptable as string) || "",
    mission: (raw.mission as string) || "TENUE COMPTABLE",
    raisonSociale: (raw.raison_sociale as string) || "",
    forme: (raw.forme_juridique as string) || "SARL",
    adresse: (raw.adresse as string) || "",
    cp: (raw.code_postal as string) || "",
    ville: (raw.ville as string) || "",
    siren: (raw.siren as string) || "",
    capital: (raw.capital as number) || 0,
    ape: (raw.ape as string) || "",
    dirigeant: (raw.dirigeant as string) || "",
    domaine: (raw.domaine as string) || "",
    effectif: (raw.effectif as string) || "",
    tel: (raw.telephone as string) || "",
    mail: (raw.email as string) || "",
    dateCreation: (raw.date_creation as string) || "",
    dateReprise: (raw.date_reprise as string) || "",
    honoraires: (raw.honoraires as number) || 0,
    reprise: (raw.reprise as number) || 0,
    juridique: (raw.juridique as number) || 0,
    frequence: (raw.frequence as string) || "MENSUEL",
    iban: (raw.iban as string) || "",
    bic: (raw.bic as string) || "",
    associe: (raw.associe as string) || "",
    superviseur: (raw.superviseur as string) || "",
    ppe: ((raw.ppe as string) || "NON") as "OUI" | "NON",
    paysRisque: ((raw.pays_risque as string) || "NON") as "OUI" | "NON",
    atypique: ((raw.atypique as string) || "NON") as "OUI" | "NON",
    distanciel: ((raw.distanciel as string) || "NON") as "OUI" | "NON",
    cash: ((raw.cash as string) || "NON") as "OUI" | "NON",
    pression: ((raw.pression as string) || "NON") as "OUI" | "NON",
    scoreActivite: (raw.score_activite as number) || 0,
    scorePays: (raw.score_pays as number) || 0,
    scoreMission: (raw.score_mission as number) || 0,
    scoreMaturite: (raw.score_maturite as number) || 0,
    scoreStructure: (raw.score_structure as number) || 0,
    malus: (raw.malus as number) || 0,
    scoreGlobal: (raw.score_global as number) || 0,
    nivVigilance: ((raw.niv_vigilance as string) || "SIMPLIFIEE") as "SIMPLIFIEE" | "STANDARD" | "RENFORCEE",
    dateCreationLigne: (raw.date_creation_ligne as string) || "",
    dateDerniereRevue: (raw.date_derniere_revue as string) || "",
    dateButoir: (raw.date_butoir_revue as string) || "",
    etatPilotage: ((raw.etat_pilotage as string) || "A JOUR") as "A JOUR" | "RETARD" | "BIENTÔT",
    dateExpCni: (raw.date_exp_cni as string) || "",
    statut: ((raw.statut as string) || "ACTIF") as "ACTIF" | "RETARD" | "INACTIF",
    be: (raw.beneficiaires_effectifs as string) || "",
    dateFin: (raw.date_fin as string) || undefined,
    lienKbis: (raw.lien_kbis as string) || "",
    lienStatuts: (raw.lien_statuts as string) || "",
    lienCni: (raw.lien_cni as string) || "",
  };
}

function mapCollaborateur(raw: Record<string, unknown>): Collaborateur {
  return {
    nom: (raw.collaborateur as string) || "",
    fonction: ((raw.fonction as string) || "").trim(),
    referentLcb: (raw.referent_lcb as string) === "OUI",
    suppleant: (raw.suppleant as string) || "",
    niveauCompetence: (raw.niveau_competence as string) || "",
    dateSignatureManuel: (raw.date_signature_manuel as string) || "",
    derniereFormation: (raw.derniere_formation as string) || "",
    statutFormation: (raw.statut_formation as string) || "",
    email: (raw.email as string) || "",
  };
}

function mapAlerte(raw: Record<string, unknown>): AlerteRegistre {
  return {
    date: (raw.date as string) || "",
    clientConcerne: (raw.client as string) || "",
    categorie: (raw.categorie as string) || "",
    details: (raw.details as string) || "",
    actionPrise: (raw.action as string) || "",
    responsable: (raw.responsable as string) || "",
    qualification: "",
    statut: (raw.statut as string) || "",
    dateButoir: (raw.date_echeance as string) || "",
    typeDecision: "",
    validateur: "",
  };
}

// ====== EXPORTED DATA ======
export const O90_CLIENTS: Client[] = Array.isArray(clientsRaw) ? (clientsRaw as Record<string, unknown>[]).map(mapClient) : [];

export const O90_COLLABORATEURS: Collaborateur[] = Array.isArray(gouvRaw) ? (gouvRaw as Record<string, unknown>[]).map(mapCollaborateur) : [];

export const O90_ALERTES: AlerteRegistre[] = Array.isArray(registreRaw) ? (registreRaw as Record<string, unknown>[]).map(mapAlerte) : [];

export const O90_LOGS: LogEntry[] = [
  {
    horodatage: "2026-01-15 09:00",
    utilisateur: "SYSTEME",
    refClient: "GLOBAL",
    typeAction: "IMPORT",
    details: "Import initial des 30 clients depuis O90",
  },
];
