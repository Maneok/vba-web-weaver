import type { Client } from "@/lib/types";
import type { CabinetConfig } from "@/types/lettreMission";

// Mapping des 52 colonnes BDD vers variables {{...}}
const CLIENT_VARIABLE_MAP: Record<string, (c: Client) => string> = {
  ref: (c) => c.ref,
  raison_sociale: (c) => c.raisonSociale,
  forme_juridique: (c) => c.forme,
  siren: (c) => c.siren,
  adresse: (c) => c.adresse,
  cp: (c) => c.cp,
  ville: (c) => c.ville,
  dirigeant: (c) => c.dirigeant,
  capital: (c) => c.capital?.toLocaleString("fr-FR") ?? "",
  ape: (c) => c.ape,
  domaine: (c) => c.domaine,
  effectif: (c) => c.effectif,
  tel: (c) => c.tel,
  mail: (c) => c.mail,
  honoraires: (c) => c.honoraires?.toLocaleString("fr-FR") ?? "0",
  reprise: (c) => c.reprise?.toLocaleString("fr-FR") ?? "0",
  juridique: (c) => c.juridique?.toLocaleString("fr-FR") ?? "0",
  frequence: (c) => c.frequence,
  iban: (c) => c.iban,
  bic: (c) => c.bic,
  associe: (c) => c.associe,
  superviseur: (c) => c.superviseur,
  comptable: (c) => c.comptable,
  mission: (c) => c.mission,
  etat: (c) => c.etat,
  niv_vigilance: (c) => c.nivVigilance,
  score_global: (c) => String(c.scoreGlobal ?? 0),
  score_activite: (c) => String(c.scoreActivite ?? 0),
  score_pays: (c) => String(c.scorePays ?? 0),
  score_mission: (c) => String(c.scoreMission ?? 0),
  score_maturite: (c) => String(c.scoreMaturite ?? 0),
  score_structure: (c) => String(c.scoreStructure ?? 0),
  malus: (c) => String(c.malus ?? 0),
  ppe: (c) => c.ppe,
  pays_risque: (c) => c.paysRisque,
  atypique: (c) => c.atypique,
  distanciel: (c) => c.distanciel,
  cash: (c) => c.cash,
  pression: (c) => c.pression,
  date_creation: (c) => c.dateCreation,
  date_reprise: (c) => c.dateReprise,
  date_creation_ligne: (c) => c.dateCreationLigne,
  date_derniere_revue: (c) => c.dateDerniereRevue,
  date_butoir: (c) => c.dateButoir,
  date_exp_cni: (c) => c.dateExpCni,
  etat_pilotage: (c) => c.etatPilotage,
  statut: (c) => c.statut,
  beneficiaires_effectifs: (c) => c.be ?? "",
  date_fin: (c) => c.dateFin ?? "",
  type_personne: (c) => c.typePersonne ?? "",
  adresse_complete: (c) => `${c.adresse}, ${c.cp} ${c.ville}`,
  honoraires_ttc: (c) => (c.honoraires * 1.2)?.toLocaleString("fr-FR") ?? "0",
};

const CABINET_VARIABLE_MAP: Record<string, (cab: CabinetConfig) => string> = {
  cabinet_nom: (cab) => cab.nom,
  cabinet_adresse: (cab) => `${cab.adresse}, ${cab.cp} ${cab.ville}`,
  cabinet_siret: (cab) => cab.siret,
  cabinet_oec: (cab) => cab.numeroOEC,
  cabinet_email: (cab) => cab.email,
  cabinet_tel: (cab) => cab.telephone,
  cabinet_logo: (cab) => cab.logo ?? "",
};

function getDateVariables(): Record<string, string> {
  const now = new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  return {
    date_jour: fmt(now),
    date_lettre: fmt(now),
    annee: String(year),
    date_debut_mission: fmt(startOfYear),
    date_fin_mission: fmt(endOfYear),
  };
}

/**
 * Remplace toutes les {{variable}} dans un texte par les valeurs du client/cabinet.
 */
export function replaceVariables(
  text: string,
  client: Client,
  cabinet?: CabinetConfig
): string {
  if (!text) return "";

  let result = text;
  const dateVars = getDateVariables();

  // Replace client variables
  for (const [key, getter] of Object.entries(CLIENT_VARIABLE_MAP)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
    try {
      result = result.replace(regex, getter(client) ?? "");
    } catch {
      result = result.replace(regex, "");
    }
  }

  // Replace cabinet variables
  if (cabinet) {
    for (const [key, getter] of Object.entries(CABINET_VARIABLE_MAP)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
      try {
        result = result.replace(regex, getter(cabinet) ?? "");
      } catch {
        result = result.replace(regex, "");
      }
    }
  }

  // Replace date variables
  for (const [key, value] of Object.entries(dateVars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Retourne la liste complète des variables disponibles avec descriptions.
 */
export function getAvailableVariables(): Array<{
  key: string;
  category: "client" | "cabinet" | "date";
  description: string;
}> {
  const vars: Array<{ key: string; category: "client" | "cabinet" | "date"; description: string }> = [];

  const clientDescriptions: Record<string, string> = {
    ref: "Référence client",
    raison_sociale: "Raison sociale",
    forme_juridique: "Forme juridique (SARL, SAS...)",
    siren: "Numéro SIREN",
    adresse: "Adresse",
    cp: "Code postal",
    ville: "Ville",
    dirigeant: "Nom du dirigeant",
    capital: "Capital social",
    ape: "Code APE",
    domaine: "Domaine d'activité",
    effectif: "Effectif",
    tel: "Téléphone",
    mail: "Email",
    honoraires: "Honoraires HT",
    reprise: "Reprise comptable",
    juridique: "Frais juridiques",
    frequence: "Fréquence de facturation",
    iban: "IBAN",
    bic: "BIC",
    associe: "Associé signataire",
    superviseur: "Superviseur",
    comptable: "Comptable référent",
    mission: "Type de mission",
    etat: "État du dossier",
    niv_vigilance: "Niveau de vigilance LCB-FT",
    score_global: "Score de risque global",
    score_activite: "Score activité",
    score_pays: "Score pays",
    score_mission: "Score mission",
    score_maturite: "Score maturité",
    score_structure: "Score structure",
    malus: "Malus",
    ppe: "PPE (Personne Politiquement Exposée)",
    pays_risque: "Pays à risque",
    atypique: "Activité atypique",
    distanciel: "Relation à distance",
    cash: "Activité cash",
    pression: "Pression commerciale",
    date_creation: "Date de création",
    date_reprise: "Date de reprise",
    date_creation_ligne: "Date de création de la ligne",
    date_derniere_revue: "Date de dernière revue",
    date_butoir: "Date butoir",
    date_exp_cni: "Date d'expiration CNI",
    etat_pilotage: "État de pilotage",
    statut: "Statut client",
    beneficiaires_effectifs: "Bénéficiaires effectifs",
    date_fin: "Date de fin de mission",
    type_personne: "Type de personne",
    adresse_complete: "Adresse complète (rue, CP, ville)",
    honoraires_ttc: "Honoraires TTC",
  };

  for (const key of Object.keys(CLIENT_VARIABLE_MAP)) {
    vars.push({
      key: `{{${key}}}`,
      category: "client",
      description: clientDescriptions[key] ?? key,
    });
  }

  const cabinetDescriptions: Record<string, string> = {
    cabinet_nom: "Nom du cabinet",
    cabinet_adresse: "Adresse complète du cabinet",
    cabinet_siret: "SIRET du cabinet",
    cabinet_oec: "N° inscription OEC",
    cabinet_email: "Email du cabinet",
    cabinet_tel: "Téléphone du cabinet",
    cabinet_logo: "Logo du cabinet (base64)",
  };

  for (const key of Object.keys(CABINET_VARIABLE_MAP)) {
    vars.push({
      key: `{{${key}}}`,
      category: "cabinet",
      description: cabinetDescriptions[key] ?? key,
    });
  }

  const dateDescriptions: Record<string, string> = {
    date_jour: "Date du jour",
    date_lettre: "Date de la lettre",
    annee: "Année en cours",
    date_debut_mission: "Date de début de mission (1er janvier)",
    date_fin_mission: "Date de fin de mission (31 décembre)",
  };

  for (const [key, desc] of Object.entries(dateDescriptions)) {
    vars.push({ key: `{{${key}}}`, category: "date", description: desc });
  }

  return vars;
}
