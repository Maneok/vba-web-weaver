import type { Client, Collaborateur, AlerteRegistre, LogEntry, ControleQualite } from "./types";

// ===== DB row (snake_case) → Frontend (camelCase) =====

export function mapDbClient(row: Record<string, unknown>): Client {
  return {
    ref: (row.ref as string) || "",
    etat: ((row.etat as string) || "VALIDE") as Client["etat"],
    comptable: (row.comptable as string) || "",
    mission: ((row.mission as string) || "TENUE COMPTABLE") as Client["mission"],
    raisonSociale: (row.raison_sociale as string) || "",
    forme: (row.forme as string) || "SARL",
    adresse: (row.adresse as string) || "",
    cp: (row.cp as string) || "",
    ville: (row.ville as string) || "",
    siren: (row.siren as string) || "",
    capital: (row.capital as number) || 0,
    ape: (row.ape as string) || "",
    dirigeant: (row.dirigeant as string) || "",
    domaine: (row.domaine as string) || "",
    effectif: (row.effectif as string) || "",
    tel: (row.tel as string) || "",
    mail: (row.mail as string) || "",
    dateCreation: (row.date_creation as string) || "",
    dateReprise: (row.date_reprise as string) || "",
    honoraires: (row.honoraires as number) || 0,
    reprise: (row.reprise as number) || 0,
    juridique: (row.juridique as number) || 0,
    frequence: (row.frequence as string) || "MENSUEL",
    iban: (row.iban_encrypted as string) || "",
    bic: (row.bic_encrypted as string) || "",
    associe: (row.associe as string) || "",
    superviseur: (row.superviseur as string) || "",
    ppe: ((row.ppe as string) || "NON") as "OUI" | "NON",
    paysRisque: ((row.pays_risque as string) || "NON") as "OUI" | "NON",
    atypique: ((row.atypique as string) || "NON") as "OUI" | "NON",
    distanciel: ((row.distanciel as string) || "NON") as "OUI" | "NON",
    cash: ((row.cash as string) || "NON") as "OUI" | "NON",
    pression: ((row.pression as string) || "NON") as "OUI" | "NON",
    scoreActivite: (row.score_activite as number) || 0,
    scorePays: (row.score_pays as number) || 0,
    scoreMission: (row.score_mission as number) || 0,
    scoreMaturite: (row.score_maturite as number) || 0,
    scoreStructure: (row.score_structure as number) || 0,
    malus: (row.malus as number) || 0,
    scoreGlobal: (row.score_global as number) || 0,
    nivVigilance: ((row.niv_vigilance as string) || "SIMPLIFIEE") as Client["nivVigilance"],
    dateCreationLigne: (row.date_creation_ligne as string) || "",
    dateDerniereRevue: (row.date_derniere_revue as string) || "",
    dateButoir: (row.date_butoir as string) || "",
    etatPilotage: ((row.etat_pilotage as string) || "A JOUR") as Client["etatPilotage"],
    dateExpCni: (row.date_exp_cni as string) || "",
    statut: ((row.statut as string) || "ACTIF") as Client["statut"],
    be: (row.be as string) || "",
    dateFin: (row.date_fin as string) || undefined,
    lienKbis: (row.lien_kbis as string) || "",
    lienStatuts: (row.lien_statuts as string) || "",
    lienCni: (row.lien_cni as string) || "",
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
  if (client.capital !== undefined) row.capital = Number(client.capital) || 0;
  if (client.ape !== undefined) row.ape = client.ape;
  if (client.dirigeant !== undefined) row.dirigeant = client.dirigeant;
  if (client.domaine !== undefined) row.domaine = client.domaine;
  if (client.effectif !== undefined) row.effectif = client.effectif;
  if (client.tel !== undefined) row.tel = client.tel;
  if (client.mail !== undefined) row.mail = client.mail;
  if (client.dateCreation !== undefined) row.date_creation = client.dateCreation;
  if (client.dateReprise !== undefined) row.date_reprise = client.dateReprise;
  if (client.honoraires !== undefined) row.honoraires = Number(client.honoraires) || 0;
  if (client.reprise !== undefined) row.reprise = Number(client.reprise) || 0;
  if (client.juridique !== undefined) row.juridique = Number(client.juridique) || 0;
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
  if (client.dateFin !== undefined) row.date_fin = client.dateFin;
  if (client.lienKbis !== undefined) row.lien_kbis = client.lienKbis;
  if (client.lienStatuts !== undefined) row.lien_statuts = client.lienStatuts;
  if (client.lienCni !== undefined) row.lien_cni = client.lienCni;

  return row;
}

export function mapDbCollaborateur(row: Record<string, unknown>): Collaborateur {
  return {
    id: (row.id as string) || undefined,
    nom: (row.nom as string) || "",
    fonction: (row.fonction as string) || "",
    referentLcb: row.referent_lcb === true || row.referent_lcb === "OUI" || row.referent_lcb === 1,
    suppleant: (row.suppleant as string) || "",
    niveauCompetence: (row.niveau_competence as string) || "",
    dateSignatureManuel: (row.date_signature_manuel as string) || "",
    derniereFormation: (row.derniere_formation as string) || "",
    statutFormation: (row.statut_formation as string) || "",
    email: (row.email as string) || "",
  };
}

export function mapDbAlerte(row: Record<string, unknown>): AlerteRegistre {
  return {
    date: (row.date as string) || "",
    clientConcerne: (row.client_concerne as string) || "",
    categorie: (row.categorie as string) || "",
    details: (row.details as string) || "",
    actionPrise: (row.action_prise as string) || "",
    responsable: (row.responsable as string) || "",
    qualification: (row.qualification as string) || "",
    statut: (row.statut as string) || "",
    dateButoir: (row.date_butoir as string) || "",
    typeDecision: (row.type_decision as string) || "",
    validateur: (row.validateur as string) || "",
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
  return {
    horodatage: ((row.created_at as string) || "").replace("T", " ").slice(0, 16),
    utilisateur: (row.user_email as string) || "",
    refClient: (row.record_id as string) || "",
    typeAction: (row.action as string) || "",
    details: ((row.new_data as Record<string, unknown>)?.details as string) || "",
  };
}
