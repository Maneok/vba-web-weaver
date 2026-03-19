import type { Client } from "@/lib/types";
import type { CabinetConfig, LettreMissionOptions } from "@/types/lettreMission";
import { formatDateFr } from "./dateUtils";

/** Escape regex metacharacters to prevent ReDoS */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ──────────────────────────────────────────────
// Textes LCB-FT dynamiques selon le niveau de vigilance
// ──────────────────────────────────────────────
const VIGILANCE_TEXTES: Record<string, string> = {
  SIMPLIFIEE: `Conformément aux articles L.561-2 et L.561-9 du Code monétaire et financier, notre cabinet est assujetti aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).

Dans le cadre de la vigilance simplifiée applicable à votre dossier, nous procédons à :
- L'identification du client et la vérification de son identité sur la base d'un document officiel en cours de validité ;
- L'identification du bénéficiaire effectif ;
- Le recueil d'informations sur l'objet et la nature de la relation d'affaires ;
- Un examen périodique du dossier tous les 3 ans.

Les mesures de vigilance simplifiée sont appliquées en l'absence de soupçon de blanchiment et compte tenu du faible niveau de risque identifié.`,

  STANDARD: `Conformément aux articles L.561-2 et L.561-5 à L.561-14-2 du Code monétaire et financier, notre cabinet est soumis aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).

Dans le cadre de la vigilance standard applicable à votre dossier, nous procédons à :
- L'identification et la vérification de l'identité du client et, le cas échéant, du bénéficiaire effectif ;
- Le recueil d'informations sur l'objet et la nature de la relation d'affaires ;
- L'exercice d'une vigilance constante sur la relation d'affaires, incluant un examen attentif des opérations ;
- Un examen périodique du dossier tous les 2 ans ;
- La mise à jour régulière des éléments d'identification.

En cas de soupçon, le cabinet est tenu de procéder à une déclaration de soupçon auprès de Tracfin (art. L.561-15 CMF).`,

  RENFORCEE: `Conformément aux articles L.561-2, L.561-10 et L.561-10-2 du Code monétaire et financier, notre cabinet est soumis aux obligations renforcées de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).

Votre dossier fait l'objet de mesures de vigilance renforcée en raison du niveau de risque identifié. À ce titre, nous procédons à :
- L'identification et la vérification approfondie de l'identité du client, du bénéficiaire effectif et de la structure de contrôle ;
- L'obtention d'informations complémentaires sur l'origine des fonds et du patrimoine ;
- L'examen renforcé de l'objet et de la nature de la relation d'affaires ;
- Un suivi renforcé et continu de la relation, avec un examen périodique au minimum annuel ;
- La mise en place d'un examen approfondi de toute opération complexe, d'un montant inhabituellement élevé ou ne paraissant pas avoir de justification économique ;
- L'information de l'associé signataire et, le cas échéant, du référent LCB-FT du cabinet.

Toute impossibilité de mettre en œuvre ces mesures pourra conduire le cabinet à mettre fin à la relation d'affaires (art. L.561-8 CMF). En cas de soupçon, une déclaration sera effectuée auprès de Tracfin (art. L.561-15 CMF).`,
};

// ──────────────────────────────────────────────
// Mapping colonnes BDD → variables {{...}}
// ──────────────────────────────────────────────
const CLIENT_VARIABLE_MAP: Record<string, (c: Client) => string> = {
  ref: (c) => c.ref ?? "",
  raison_sociale: (c) => c.raisonSociale ?? "",
  forme_juridique: (c) => c.forme ?? "",
  siren: (c) => c.siren ?? "",
  adresse: (c) => c.adresse ?? "",
  cp: (c) => c.cp ?? "",
  ville: (c) => c.ville ?? "",
  dirigeant: (c) => c.dirigeant ?? "",
  capital: (c) => (c.capital ?? 0).toLocaleString("fr-FR"),
  ape: (c) => c.ape ?? "",
  domaine: (c) => c.domaine ?? "",
  effectif: (c) => c.effectif ?? "",
  tel: (c) => c.tel ?? "",
  mail: (c) => c.mail ?? "",
  honoraires: (c) => (c.honoraires ?? 0).toLocaleString("fr-FR"),
  reprise: (c) => (c.reprise ?? 0).toLocaleString("fr-FR"),
  juridique: (c) => (c.juridique ?? 0).toLocaleString("fr-FR"),
  frequence: (c) => c.frequence ?? "",
  iban: (c) => c.iban ?? "",
  bic: (c) => c.bic ?? "",
  associe: (c) => c.associe ?? "",
  superviseur: (c) => c.superviseur ?? "",
  comptable: (c) => c.comptable ?? "",
  mission: (c) => c.mission ?? "",
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
  date_revue: (c) => c.dateDerniereRevue,
  date_butoir: (c) => c.dateButoir,
  date_exp_cni: (c) => c.dateExpCni,
  etat_pilotage: (c) => c.etatPilotage,
  statut: (c) => c.statut,
  beneficiaires_effectifs: (c) => c.be ?? "",
  date_fin: (c) => c.dateFin ?? "",
  type_personne: (c) => c.typePersonne ?? "",
  // ── CORRECTION 10 : Variables CNOEC manquantes ──
  responsable_mission: (c) => c.associe ?? "",
  referentiel_comptable: () => "PCG (règlement ANC n°2014-03)",
  forme_rapport: () => "Selon le type de mission",
  indice_revision: () => "Indice INSEE prix services comptables",
  delai_mise_en_demeure: () => "30 jours",
  code_postal: (c) => c.cp ?? "",
  adresse_complete: (c) => `${c.adresse}, ${c.cp} ${c.ville}`,
  honoraires_ttc: (c) => ((c.honoraires ?? 0) * (1 + (((c as any).taux_tva ?? 20) / 100))).toLocaleString("fr-FR"),
  hono: (c) => `${c.honoraires?.toLocaleString("fr-FR") ?? "0"} € HT`,
  honoraires_juridique: (c) => `${c.juridique?.toLocaleString("fr-FR") ?? "0"} € HT`,
  telephone: (c) => c.tel,
  email: (c) => c.mail,
  qualite_dirigeant: (c) => (c as any).qualiteDir ?? "Gérant",
  cp_ville: (c) => [c.cp, c.ville].filter(Boolean).join(" "),
};

const CABINET_VARIABLE_MAP: Record<string, (cab: CabinetConfig) => string> = {
  cabinet_nom: (cab) => cab.nom,
  nom_cabinet: (cab) => cab.nom ?? "",
  cabinet_adresse: (cab) => `${cab.adresse}, ${cab.cp} ${cab.ville}`,
  cabinet_siret: (cab) => cab.siret,
  cabinet_oec: (cab) => cab.numeroOEC,
  cabinet_email: (cab) => cab.email,
  cabinet_tel: (cab) => cab.telephone,
  cabinet_logo: (cab) => cab.logo ?? "",
  ville_cabinet: (cab) => cab.ville ?? "",
};

function getDateVariables(): Record<string, string> {
  const now = new Date();
  const fmt = (d: Date) => formatDateFr(d);
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  return {
    date_du_jour: fmt(now),
    date_jour: fmt(now),
    date_lettre: fmt(now),
    annee: String(year),
    date_debut_mission: fmt(startOfYear),
    date_fin_mission: fmt(endOfYear),
    date_cgv: fmt(now),
  };
}

function getOptionsVariables(options?: LettreMissionOptions): Record<string, string> {
  if (!options) return {};
  return {
    genre: options.genre === "F" ? "Mme" : "M.",
    formule_politesse: options.genre === "F" ? "Madame" : "Monsieur",
    setup: `${options.fraisConstitution?.toLocaleString("fr-FR") ?? "0"} € HT`,
    exercice_debut: options.exerciceDebut ?? "",
    exercice_fin: options.exerciceFin ?? "",
    regime_fiscal: options.regimeFiscal ?? "",
    tva_regime: options.tvaRegime ?? "",
    volume_comptable: options.volumeComptable ?? "",
    periodicite: options.periodicite ?? "",
    outil_comptable: options.outilComptable ?? "",
    honoraires_social: `${options.honorairesSocial?.toLocaleString("fr-FR") ?? "0"} € HT`,
    honoraires_controle_fiscal: `${options.honorairesControleFiscal?.toLocaleString("fr-FR") ?? "0"} € HT`,
  };
}

function getVigilanceVariable(nivVigilance: string): string {
  return VIGILANCE_TEXTES[nivVigilance] ?? VIGILANCE_TEXTES.STANDARD;
}

/**
 * Remplace toutes les {{variable}} dans un texte par les valeurs du client/cabinet.
 */
export function replaceVariables(
  text: string,
  client: Client,
  cabinet?: CabinetConfig,
  options?: LettreMissionOptions
): string {
  if (!text) return "";
  if (!client) return text;

  let result = text;
  const dateVars = getDateVariables();
  const optVars = getOptionsVariables(options);

  // Replace client variables
  for (const [key, getter] of Object.entries(CLIENT_VARIABLE_MAP)) {
    const regex = new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "gi");
    try {
      result = result.replace(regex, getter(client) ?? "");
    } catch {
      result = result.replace(regex, "");
    }
  }

  // Replace cabinet variables
  if (cabinet) {
    for (const [key, getter] of Object.entries(CABINET_VARIABLE_MAP)) {
      const regex = new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "gi");
      try {
        result = result.replace(regex, getter(cabinet) ?? "");
      } catch {
        result = result.replace(regex, "");
      }
    }
  }

  // Replace date variables
  for (const [key, value] of Object.entries(dateVars)) {
    const regex = new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "gi");
    result = result.replace(regex, value);
  }

  // Replace options variables
  for (const [key, value] of Object.entries(optVars)) {
    const regex = new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "gi");
    result = result.replace(regex, value);
  }

  // Special: bloc_vigilance_lab
  result = result.replace(
    /\{\{bloc_vigilance_lab\}\}/gi,
    getVigilanceVariable(client.nivVigilance)
  );

  // Final pass: replace any remaining unresolved {{variables}} with empty string
  result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    console.warn(`LM template: unresolved variable {{${varName}}}`);
    return "";
  });

  return result;
}

/**
 * Retourne la liste complète des variables disponibles avec descriptions.
 */
export function getAvailableVariables(): Array<{
  key: string;
  category: "client" | "cabinet" | "date" | "options";
  description: string;
}> {
  const vars: Array<{ key: string; category: "client" | "cabinet" | "date" | "options"; description: string }> = [];

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
    date_revue: "Date dernière revue LCB",
    date_butoir: "Date butoir prochaine revue KYC",
    date_exp_cni: "Date d'expiration CNI",
    etat_pilotage: "État de pilotage",
    statut: "Statut client",
    beneficiaires_effectifs: "Bénéficiaires effectifs",
    date_fin: "Date de fin de mission",
    type_personne: "Type de personne",
    adresse_complete: "Adresse complète (rue, CP, ville)",
    honoraires_ttc: "Honoraires TTC",
    hono: "Honoraires formatés (ex: 3 500 € HT)",
    honoraires_juridique: "Honoraires juridique formatés",
    telephone: "Téléphone client",
    email: "Email client",
    responsable_mission: "Nom de l'EC responsable de la mission",
    referentiel_comptable: "Référentiel comptable applicable (défaut: PCG ANC n°2014-03)",
    forme_rapport: "Forme du rapport émis (défaut: Attestation de présentation des comptes)",
    indice_revision: "Indice de révision des honoraires (défaut: INSEE services comptables)",
    delai_mise_en_demeure: "Délai de mise en demeure (défaut: 30 jours)",
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

  const optionsDescriptions: Record<string, string> = {
    genre: "Genre (M. ou Mme)",
    formule_politesse: "Formule de politesse (Cher Monsieur / Chère Madame)",
    setup: "Frais de constitution",
    exercice_debut: "Date début exercice social",
    exercice_fin: "Date fin exercice social",
    regime_fiscal: "Régime fiscal",
    tva_regime: "Régime de TVA",
    volume_comptable: "Volume comptable",
    periodicite: "Périodicité de remise des documents",
    outil_comptable: "Outil comptable utilisé",
    honoraires_social: "Honoraires mission sociale",
    honoraires_controle_fiscal: "Honoraires contrôle fiscal",
    bloc_vigilance_lab: "Texte LCB-FT complet selon niv_vigilance",
  };
  for (const [key, desc] of Object.entries(optionsDescriptions)) {
    vars.push({ key: `{{${key}}}`, category: "options", description: desc });
  }

  return vars;
}
