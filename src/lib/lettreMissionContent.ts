// Contenu textuel complet de la Lettre de Mission — Présentation des comptes annuels
// Chaque mot est juridiquement significatif — NE PAS MODIFIER sans validation juridique

export type Genre = "M" | "Mme";

export function getFormulePolitesse(genre: Genre): string {
  return genre === "M" ? "Monsieur" : "Madame";
}

export function getCherGenre(genre: Genre): string {
  return genre === "M" ? "Cher Monsieur" : "Chère Madame";
}

export interface ControleFiscalOption {
  id: "A" | "B" | "RENONCE";
  label: string;
  montant: number | null;
  texte: string;
}

export const CONTROLE_FISCAL_OPTIONS: ControleFiscalOption[] = [
  {
    id: "A",
    label: "Option A",
    montant: 5000,
    texte: "Couverture dans la limite de 5 000 € HT par année civile — 25 € HT/mois",
  },
  {
    id: "B",
    label: "Option B",
    montant: 2500,
    texte: "Couverture dans la limite de 2 500 € HT par année civile — 10 € HT/mois",
  },
  {
    id: "RENONCE",
    label: "Renonce",
    montant: null,
    texte: "Renonce à la souscription de la garantie",
  },
];

export interface SectionLettreMission {
  id: string;
  titre: string;
  contenu: string;
  soustitre?: string;
  obligatoire: boolean;
}

export const LETTRE_MISSION_CONTENT: Record<string, SectionLettreMission> = {
  introduction: {
    id: "introduction",
    titre: "Introduction",
    contenu: `{{formule_politesse}} {{dirigeant}},

Nous vous remercions de la confiance que vous nous avez témoignée lors de notre dernier entretien, en envisageant de nous confier, en qualité d'expert-comptable, une mission de présentation des comptes annuels de votre entreprise.
La présente lettre de mission ainsi que les conditions générales d'intervention jointes en annexe forment un contrat entre les parties, conformément aux dispositions de l'article 151 du Code de déontologie intégré au décret du 30 mars 2012 relatif à l'exercice de l'activité d'expertise comptable.`,
    obligatoire: true,
  },

  entite: {
    id: "entite",
    titre: "VOTRE ENTITÉ",
    contenu: `Les caractéristiques de votre entreprise sont :
Raison sociale : {{raison_sociale}}
Forme juridique : {{forme_juridique}}
Activité(s) principale(s) : {{domaine}}
Code APE : {{ape}}
Siren : {{siren}}
Capital social : {{capital}}
Date de création : {{date_creation}}
Expert-comptable responsable : {{associe}}
Effectif du personnel : {{effectif}}
Type de mission : {{mission}}

Organisation et transmission des documents comptables :
Périodicité : {{frequence}} – Avant le J+10`,
    obligatoire: true,
  },

  lcbft: {
    id: "lcbft",
    titre: "OBLIGATIONS DE VIGILANCE – LUTTE CONTRE LE BLANCHIMENT",
    soustitre: "CMF art. L.561-1 et s. | NPLAB (arr. 13.02.2019) | Paquet AML 2024-2026",
    contenu: `Score de risque client : {{score_global}} / 100
Niveau de vigilance retenu : {{niv_vigilance}}
Statut PPE : {{ppe}}
Dernière diligence KYC : {{date_revue}}
Prochaine mise à jour KYC : {{date_butoir}}

{{bloc_vigilance_lab}}

Engagements contractuels du client : Le client reconnaît avoir été informé des obligations de vigilance qui s'appliquent au cabinet en sa qualité de professionnel assujetti. Il s'engage à répondre sans délai à toute demande de justificatif émanant du cabinet dans ce cadre. Le non-respect de cet engagement constitue une cause légitime de suspension ou de résiliation de la mission, sans indemnité (art. L.561-8 CMF).

Durée de conservation LCB-FT : Conformément à l'art. L.561-12 CMF, l'ensemble des pièces d'identification est conservé pendant cinq (5) ans à compter de la fin de la relation d'affaires, indépendamment des délais comptables.`,
    obligatoire: true,
  },

  mission: {
    id: "mission",
    titre: "Notre mission",
    contenu: `La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable et des dispositions de la norme professionnelle du Conseil Supérieur de l'Ordre des Experts-Comptables applicable à la mission de présentation de comptes et des textes légaux et réglementaires applicables aux professionnels de l'expertise comptable que nous sommes tenus de respecter.

Nos relations contractuelles seront régies tant par les termes de cette lettre de mission que par les Conditions Générales d'Intervention ci-jointes. À cet effet, nous nous permettons de rappeler les points suivants :
- La mission de présentation des comptes ne constitue ni un audit ni un examen limité des comptes de votre entreprise ;
- Ils ne comportent ni le contrôle de la matérialité des opérations ni le contrôle des inventaires physiques des actifs de votre entreprise à la clôture de l'exercice comptable (stocks, immobilisations, espèces en caisse notamment) ;
- Ils n'ont pas pour objectif de déceler les fraudes ou les actes illégaux pouvant ou ayant existé dans votre entreprise. Toutefois, nous vous en informerions si nous étions conduits à en avoir connaissance.

Nous comptons sur votre entière coopération afin qu'il soit mis à notre disposition dans un délai raisonnable tous les documents et autres informations nécessaires qui nous permettront de mener à bien notre mission.`,
    obligatoire: true,
  },

  duree: {
    id: "duree",
    titre: "Durée de la mission",
    contenu: `Notre mission prendra effet à la date de signature de la présente lettre de mission. Elle portera sur les comptes de l'exercice comptable commençant le {{exercice_debut}} et se terminant le {{exercice_fin}}.
Cette lettre de mission restera en vigueur pour les exercices futurs, sauf en cas de résiliation, de modification ou de suspension de notre mission selon les modalités décrites dans les Conditions Générales d'Intervention.`,
    obligatoire: true,
  },

  missionSociale: {
    id: "mission_sociale",
    titre: "Mission sociale",
    contenu: `La mission sociale est conclue pour une durée correspondant à la mission comptable et nos travaux consisteront à :
- Établir les bulletins de salaire dans un délai de trois jours ouvrés à compter de la réception des éléments transmis ;
- Établir, télétransmettre et télé-payer les déclarations sociales périodiques liées ;
- Tenir le journal des salaires ;
- Mettre à disposition de l'entité les documents et états liés au traitement de la paie ;
- Fournir les données d'archivage ;
- Assurer la gestion administrative d'évènements occasionnels courants.

Il est rappelé que le cabinet n'a aucun lien direct avec les salariés de l'employeur.`,
    obligatoire: false,
  },

  missionJuridique: {
    id: "mission_juridique",
    titre: "Mission juridique",
    contenu: `La mission de secrétariat juridique annuelle est réalisée à l'issue de la clôture de chaque exercice social et dans le respect des délais légaux.
Elle comprend la rédaction des actes relatifs à l'approbation des comptes annuels.`,
    obligatoire: false,
  },

  missionControleFiscal: {
    id: "mission_controle_fiscal",
    titre: "Mission d'assistance au contrôle fiscal (SUR OPTION)",
    contenu: `Dans le cadre de cette mission, nous vous assisterons à chaque étape de la procédure de contrôle et notamment dans la préparation et la transmission des documents demandés et par notre présence aux différents entretiens avec les agents de l'administration fiscale.

Options :
☐ Option A : Couverture dans la limite de 5 000 € HT par année civile — 25 € HT/mois
☐ Option B : Couverture dans la limite de 2 500 € HT par année civile — 10 € HT/mois
☐ Renonce à la souscription de la garantie`,
    obligatoire: false,
  },

  honoraires: {
    id: "honoraires",
    titre: "HONORAIRES",
    contenu: `Mission de tenue comptable :
Forfait annuel (12 mois) : {{honoraires}} HT
Constitution de dossier : {{setup}}
Honoraires exceptionnels Expert-Comptable : 200 € HT / heure
Honoraires exceptionnels Collaborateur : 100 € HT / heure

Mission juridique : {{honoraires_juridique}} HT

Nos honoraires seront facturés {{frequence}}LEMENT, réglés par prélèvement automatique à 30 jours et révisables annuellement avec un minimum forfaitaire de 3 %.`,
    obligatoire: true,
  },

  signature: {
    id: "signature",
    titre: "Signatures",
    contenu: `Nous vous prions de croire, {{formule_politesse_fin}} {{dirigeant}}, à nos sentiments dévoués.

L'Expert-comptable : {{associe}}
Le Client : {{dirigeant}}`,
    obligatoire: true,
  },
};

/**
 * Retourne les sections dans l'ordre d'affichage de la lettre
 */
export function getSectionsOrdonnees(): SectionLettreMission[] {
  return [
    LETTRE_MISSION_CONTENT.introduction,
    LETTRE_MISSION_CONTENT.entite,
    LETTRE_MISSION_CONTENT.lcbft,
    LETTRE_MISSION_CONTENT.mission,
    LETTRE_MISSION_CONTENT.duree,
    LETTRE_MISSION_CONTENT.missionSociale,
    LETTRE_MISSION_CONTENT.missionJuridique,
    LETTRE_MISSION_CONTENT.missionControleFiscal,
    LETTRE_MISSION_CONTENT.honoraires,
    LETTRE_MISSION_CONTENT.signature,
  ];
}

/**
 * Retourne uniquement les sections obligatoires
 */
export function getSectionsObligatoires(): SectionLettreMission[] {
  return getSectionsOrdonnees().filter((s) => s.obligatoire);
}
