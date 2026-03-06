/**
 * Load and transform JSON data files (clients_o90, param_o90, gouv_o90, registre_o90)
 * into the app's type system (camelCase).
 */
import type { Client, Collaborateur, AlerteRegistre, LogEntry } from "./types";
import { calculateRiskScore, calculateNextReviewDate, getPilotageStatus } from "./riskEngine";
import clientsRaw from "../../clients_o90.json";
import gouvRaw from "../../gouv_o90.json";
import registreRaw from "../../registre_o90.json";
import paramRaw from "../../param_o90.json";

// ====== PARAM DATA ======
export interface ParamData {
  apeScores: { code: string; score: number; description: string }[];
  paysRisque: { pays: string; score: number; categorie: string }[];
  missionScores: { mission: string; score: number; description: string }[];
  seuils: { SEUIL_BAS: number; SEUIL_HAUT: number; SEUIL_CRITIQUE: number };
  malus: { CTX_DISTANCIEL: number; CTX_CASH: number; CTX_PRESSION: number; MALUS_ATYPIQUE: number; SCORE_PPE: number };
  defScoreAct: number;
}

export function loadParamData(): ParamData {
  const p = paramRaw as any;
  return {
    apeScores: p.ape_scores || [],
    paysRisque: p.pays_risque || [],
    missionScores: p.mission_scores || [],
    seuils: p.seuils || { SEUIL_BAS: 25, SEUIL_HAUT: 60, SEUIL_CRITIQUE: 60 },
    malus: p.malus || {},
    defScoreAct: p.def_score_act ?? 25,
  };
}

// ====== CLIENT DATA ======
function mapClient(raw: any): Client {
  const dateReprise = raw.date_reprise || raw.date_creation || "";
  const dateDerniereRevue = raw.date_derniere_revue || raw.date_creation_ligne || "";

  // Recalculate risk scores for consistency
  const risk = calculateRiskScore({
    ape: raw.ape || "",
    paysRisque: raw.pays_risque === "OUI",
    mission: raw.mission || "TENUE COMPTABLE",
    dateCreation: raw.date_creation || "2020-01-01",
    dateReprise,
    effectif: raw.effectif || "",
    forme: raw.forme_juridique || "",
    ppe: raw.ppe === "OUI",
    atypique: raw.atypique === "OUI",
    distanciel: raw.distanciel === "OUI",
    cash: raw.cash === "OUI",
    pression: raw.pression === "OUI",
  });

  const dateButoir = raw.date_butoir_revue || calculateNextReviewDate(risk.nivVigilance, dateDerniereRevue);
  const etatPilotage = getPilotageStatus(dateButoir);

  return {
    ref: raw.ref || "",
    etat: raw.etat || "VALIDE",
    comptable: raw.comptable || "",
    mission: raw.mission || "TENUE COMPTABLE",
    raisonSociale: raw.raison_sociale || "",
    forme: raw.forme_juridique || "",
    adresse: raw.adresse || "",
    cp: raw.code_postal || "",
    ville: raw.ville || "",
    siren: raw.siren || "",
    capital: raw.capital ?? 0,
    ape: raw.ape || "",
    dirigeant: raw.dirigeant || "",
    domaine: raw.domaine || "",
    effectif: raw.effectif || "",
    tel: raw.telephone || "",
    mail: raw.email || "",
    dateCreation: raw.date_creation || "",
    dateReprise,
    honoraires: raw.honoraires ?? 0,
    reprise: raw.reprise ?? 0,
    juridique: raw.juridique ?? 0,
    frequence: raw.frequence || "MENSUEL",
    iban: raw.iban || "",
    bic: raw.bic || "",
    associe: raw.associe || "",
    superviseur: raw.superviseur || "",
    ppe: raw.ppe || "NON",
    paysRisque: raw.pays_risque || "NON",
    atypique: raw.atypique || "NON",
    distanciel: raw.distanciel || "NON",
    cash: raw.cash || "NON",
    pression: raw.pression || "NON",
    scoreActivite: risk.scoreActivite,
    scorePays: risk.scorePays,
    scoreMission: risk.scoreMission,
    scoreMaturite: risk.scoreMaturite,
    scoreStructure: risk.scoreStructure,
    malus: risk.malus,
    scoreGlobal: risk.scoreGlobal,
    nivVigilance: risk.nivVigilance,
    dateCreationLigne: raw.date_creation_ligne || "",
    lienKbis: raw.lien_kbis || "",
    lienStatuts: raw.lien_statuts || "",
    lienCni: raw.lien_cni || "",
    dateDerniereRevue,
    dateButoir,
    etatPilotage: etatPilotage as any,
    dateExpCni: raw.date_exp_cni || "",
    statut: raw.statut || "ACTIF",
    be: raw.beneficiaires_effectifs || "",
    dateFin: raw.date_fin || undefined,
    // GED & KYC fields
    documents: [],
    scoreHistory: [],
    kycCompleteness: 0,
  };
}

export function loadClients(): Client[] {
  return (clientsRaw as any[]).map(mapClient);
}

// ====== COLLABORATEURS ======
function mapCollaborateur(raw: any): Collaborateur {
  return {
    nom: raw.collaborateur || "",
    fonction: (raw.fonction || "").trim(),
    referentLcb: raw.referent_lcb === "OUI",
    suppleant: raw.suppleant || "",
    niveauCompetence: raw.niveau_competence || "",
    dateSignatureManuel: raw.date_signature_manuel || "",
    derniereFormation: raw.derniere_formation || "",
    statutFormation: raw.statut_formation || "",
    email: raw.email || "",
  };
}

export function loadCollaborateurs(): Collaborateur[] {
  return (gouvRaw as any[]).map(mapCollaborateur);
}

// ====== ALERTES ======
function mapAlerte(raw: any): AlerteRegistre {
  return {
    date: raw.date || "",
    clientConcerne: raw.client || "",
    categorie: raw.categorie || "",
    details: raw.details || "",
    actionPrise: raw.action || "",
    responsable: raw.responsable || "",
    qualification: "",
    statut: raw.statut || "EN COURS",
    dateButoir: raw.date_echeance || "",
    typeDecision: "",
    validateur: "",
  };
}

export function loadAlertes(): AlerteRegistre[] {
  return (registreRaw as any[]).map(mapAlerte);
}

// ====== LOGS (from JSON or default) ======
export function loadLogs(): LogEntry[] {
  return [
    { horodatage: "2026-03-06 09:00", utilisateur: "SYSTÈME", refClient: "—", typeAction: "INITIALISATION", details: "Chargement des 30 dossiers depuis clients_o90.json" },
    { horodatage: "2026-03-05 11:27", utilisateur: "alex", refClient: "CLI-26-011", typeAction: "LETTRE DE MISSION", details: "LDM générée" },
    { horodatage: "2026-03-04 10:22", utilisateur: "alex", refClient: "CLI-26-009", typeAction: "LETTRE DE MISSION", details: "LDM générée" },
    { horodatage: "2026-03-04 09:51", utilisateur: "alex", refClient: "CLI-26-014", typeAction: "LETTRE DE MISSION", details: "LDM générée" },
    { horodatage: "2026-02-24 20:01", utilisateur: "alex", refClient: "CLI-0039", typeAction: "CRÉATION", details: "Nouveau dossier créé" },
    { horodatage: "2026-02-23 22:50", utilisateur: "alex", refClient: "CLI-0036", typeAction: "CRÉATION", details: "Nouveau dossier créé" },
    { horodatage: "2026-02-21 10:50", utilisateur: "alex", refClient: "CLI-0027", typeAction: "CRÉATION", details: "Nouveau dossier créé" },
    { horodatage: "2026-02-07 17:52", utilisateur: "alex", refClient: "CLI-0022", typeAction: "GENERATION PDF", details: "Escroquerie Prestations Sociales" },
    { horodatage: "2026-02-03 15:32", utilisateur: "DAHAN Alexandre", refClient: "CLI-26-004", typeAction: "REVUE DOSSIER", details: "Mise à jour / Revue effectuée" },
  ];
}

// ====== KYC COMPLETENESS ======
export function calculateKycCompleteness(client: Client): number {
  const requiredFields: (keyof Client)[] = [
    "raisonSociale", "siren", "forme", "adresse", "cp", "ville",
    "ape", "dirigeant", "dateCreation", "mail", "tel", "iban",
    "be", "mission", "honoraires",
  ];
  const filled = requiredFields.filter(f => {
    const v = client[f];
    if (typeof v === "string") return v.length > 0;
    if (typeof v === "number") return v > 0;
    return !!v;
  });
  return Math.round((filled.length / requiredFields.length) * 100);
}
