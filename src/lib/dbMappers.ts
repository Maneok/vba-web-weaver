import type { Client, Collaborateur, AlerteRegistre, LogEntry, ControleQualite } from "./types";

// ===== DB row (snake_case) → Frontend (camelCase) =====

const VALID_ETATS = ["PROSPECT", "EN COURS", "VALIDE", "REFUSE", "ARCHIVE"] as const;
const VALID_VIGILANCE = ["SIMPLIFIEE", "STANDARD", "RENFORCEE"] as const;
const VALID_STATUTS = ["ACTIF", "RETARD", "INACTIF"] as const;
const VALID_OUI_NON = ["OUI", "NON"] as const;

/** Safely coerce a DB value to an allowed enum value */
function enumStr<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const s = value == null ? "" : String(value);
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

/** Safely coerce a DB value to string, handling null/undefined */
function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value) || fallback;
}

/** Safely coerce a DB value to number, handling null/undefined/NaN */
function num(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce to number but preserve null when value is absent — for fields where null ≠ 0 */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function mapDbClient(row: Record<string, unknown>): Client {
  return {
    ref: str(row.ref),
    etat: enumStr(row.etat, VALID_ETATS, "VALIDE"),
    comptable: str(row.comptable),
    mission: (str(row.mission, "TENUE COMPTABLE")) as Client["mission"],
    raisonSociale: str(row.raison_sociale),
    forme: str(row.forme, "SARL"),
    adresse: str(row.adresse),
    cp: str(row.cp),
    ville: str(row.ville),
    siren: str(row.siren),
    capital: numOrNull(row.capital),
    ape: str(row.ape),
    dirigeant: str(row.dirigeant),
    domaine: str(row.domaine),
    effectif: str(row.effectif),
    tel: str(row.tel),
    mail: str(row.mail),
    dateCreation: str(row.date_creation),
    dateReprise: str(row.date_reprise),
    honoraires: numOrNull(row.honoraires),
    reprise: num(row.reprise),
    juridique: num(row.juridique),
    frequence: str(row.frequence, "MENSUEL"),
    iban: str(row.iban_encrypted),
    bic: str(row.bic_encrypted),
    associe: str(row.associe),
    superviseur: str(row.superviseur),
    ppe: enumStr(row.ppe, VALID_OUI_NON, "NON"),
    paysRisque: enumStr(row.pays_risque, VALID_OUI_NON, "NON"),
    atypique: enumStr(row.atypique, VALID_OUI_NON, "NON"),
    distanciel: enumStr(row.distanciel, VALID_OUI_NON, "NON"),
    cash: enumStr(row.cash, VALID_OUI_NON, "NON"),
    pression: enumStr(row.pression, VALID_OUI_NON, "NON"),
    scoreActivite: num(row.score_activite),
    scorePays: num(row.score_pays),
    scoreMission: num(row.score_mission),
    scoreMaturite: num(row.score_maturite),
    scoreStructure: num(row.score_structure),
    malus: num(row.malus),
    scoreGlobal: num(row.score_global),
    nivVigilance: enumStr(row.niv_vigilance, VALID_VIGILANCE, "SIMPLIFIEE"),
    dateCreationLigne: str(row.date_creation_ligne),
    dateDerniereRevue: str(row.date_derniere_revue),
    dateButoir: str(row.date_butoir),
    etatPilotage: (str(row.etat_pilotage, "A JOUR")) as Client["etatPilotage"],
    dateExpCni: str(row.date_exp_cni),
    statut: enumStr(row.statut, VALID_STATUTS, "ACTIF"),
    be: str(row.be),
    dateFin: row.date_fin != null ? String(row.date_fin) : undefined,
    lienKbis: str(row.lien_kbis),
    lienStatuts: str(row.lien_statuts),
    lienCni: str(row.lien_cni),
  };
}

// ===== Frontend (camelCase) → DB row (snake_case) =====

export function mapClientToDb(client: Partial<Client>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (client.ref !== undefined) row.ref = client.ref;
  if (client.etat !== undefined) row.etat = client.etat;
  if (client.comptable !== undefined) row.comptable = client.comptable;
  if (client.mission !== undefined) row.mission = client.mission;
  if (client.raisonSociale !== undefined) row.raison_sociale = client.raisonSociale;
  if (client.forme !== undefined) row.forme = client.forme;
  if (client.adresse !== undefined) row.adresse = client.adresse;
  if (client.cp !== undefined) row.cp = client.cp;
  if (client.ville !== undefined) row.ville = client.ville;
  if (client.siren !== undefined) row.siren = client.siren?.replace(/\s/g, "");
  if (client.capital !== undefined) row.capital = client.capital;
  if (client.ape !== undefined) row.ape = client.ape;
  if (client.dirigeant !== undefined) row.dirigeant = client.dirigeant;
  if (client.domaine !== undefined) row.domaine = client.domaine;
  if (client.effectif !== undefined) row.effectif = client.effectif;
  if (client.tel !== undefined) row.tel = client.tel;
  if (client.mail !== undefined) row.mail = client.mail;
  if (client.dateCreation !== undefined) row.date_creation = client.dateCreation;
  if (client.dateReprise !== undefined) row.date_reprise = client.dateReprise;
  if (client.honoraires !== undefined) row.honoraires = client.honoraires;
  if (client.reprise !== undefined) row.reprise = num(client.reprise);
  if (client.juridique !== undefined) row.juridique = num(client.juridique);
  if (client.frequence !== undefined) row.frequence = client.frequence;
  if (client.iban !== undefined) row.iban_encrypted = client.iban;
  if (client.bic !== undefined) row.bic_encrypted = client.bic;
  if (client.associe !== undefined) row.associe = client.associe;
  if (client.superviseur !== undefined) row.superviseur = client.superviseur;
  if (client.ppe !== undefined) row.ppe = client.ppe;
  if (client.paysRisque !== undefined) row.pays_risque = client.paysRisque;
  if (client.atypique !== undefined) row.atypique = client.atypique;
  if (client.distanciel !== undefined) row.distanciel = client.distanciel;
  if (client.cash !== undefined) row.cash = client.cash;
  if (client.pression !== undefined) row.pression = client.pression;
  if (client.scoreActivite !== undefined) row.score_activite = client.scoreActivite;
  if (client.scorePays !== undefined) row.score_pays = client.scorePays;
  if (client.scoreMission !== undefined) row.score_mission = client.scoreMission;
  if (client.scoreMaturite !== undefined) row.score_maturite = client.scoreMaturite;
  if (client.scoreStructure !== undefined) row.score_structure = client.scoreStructure;
  if (client.malus !== undefined) row.malus = client.malus;
  if (client.scoreGlobal !== undefined) row.score_global = client.scoreGlobal;
  if (client.nivVigilance !== undefined) row.niv_vigilance = client.nivVigilance;
  if (client.dateCreationLigne !== undefined) row.date_creation_ligne = client.dateCreationLigne;
  if (client.dateDerniereRevue !== undefined) row.date_derniere_revue = client.dateDerniereRevue;
  if (client.dateButoir !== undefined) row.date_butoir = client.dateButoir;
  if (client.etatPilotage !== undefined) row.etat_pilotage = client.etatPilotage;
  if (client.dateExpCni !== undefined) row.date_exp_cni = client.dateExpCni;
  if (client.statut !== undefined) row.statut = client.statut;
  if (client.be !== undefined) row.be = client.be;
  if (client.dateFin !== undefined) row.date_fin = client.dateFin ?? null;
  if (client.lienKbis !== undefined) row.lien_kbis = client.lienKbis;
  if (client.lienStatuts !== undefined) row.lien_statuts = client.lienStatuts;
  if (client.lienCni !== undefined) row.lien_cni = client.lienCni;

  return row;
}

export function mapDbCollaborateur(row: Record<string, unknown>): Collaborateur {
  return {
    id: row.id != null ? String(row.id) : undefined,
    nom: str(row.nom),
    fonction: str(row.fonction),
    referentLcb: row.referent_lcb === true || row.referent_lcb === "OUI",
    suppleant: str(row.suppleant),
    niveauCompetence: str(row.niveau_competence),
    dateSignatureManuel: str(row.date_signature_manuel),
    derniereFormation: str(row.derniere_formation),
    statutFormation: str(row.statut_formation),
    email: str(row.email),
  };
}

export function mapDbAlerte(row: Record<string, unknown>): AlerteRegistre {
  return {
    id: row.id != null ? String(row.id) : undefined,
    date: str(row.date),
    clientConcerne: str(row.client_concerne),
    categorie: str(row.categorie),
    details: str(row.details),
    actionPrise: str(row.action_prise),
    responsable: str(row.responsable),
    qualification: str(row.qualification),
    statut: str(row.statut),
    dateButoir: str(row.date_butoir),
    typeDecision: str(row.type_decision),
    validateur: str(row.validateur),
  };
}

export function mapAlerteToDb(alerte: AlerteRegistre): Record<string, unknown> {
  return {
    date: alerte.date,
    client_concerne: alerte.clientConcerne,
    categorie: alerte.categorie,
    details: alerte.details,
    action_prise: alerte.actionPrise,
    responsable: alerte.responsable,
    qualification: alerte.qualification,
    statut: alerte.statut,
    date_butoir: alerte.dateButoir,
    type_decision: alerte.typeDecision,
    validateur: alerte.validateur,
  };
}

export function mapDbLog(row: Record<string, unknown>): LogEntry {
  const newData = (row.new_data != null && typeof row.new_data === "object") ? row.new_data as Record<string, unknown> : {};
  return {
    horodatage: (() => { const ts = str(row.created_at); return ts.includes("T") ? ts.replace("T", " ").slice(0, 16) : ts.slice(0, 16); })(),
    utilisateur: str(row.user_email),
    refClient: str(row.record_id),
    typeAction: str(row.action),
    details: str(newData.details),
  };
}
