import type { CabinetInfo, PdfRepartitionRow } from "@/types/lettreMissionPdf";

// ══════════════════════════════════════════════
// Répartition des travaux par défaut
// ══════════════════════════════════════════════

export const DEFAULT_REPARTITION: PdfRepartitionRow[] = [
  // Comptabilité
  { tache: "Tenue des comptes", cabinet: true, client: false, periodicite: "Mensuelle", categorie: "Comptabilité" },
  { tache: "Saisie des écritures comptables", cabinet: true, client: false, periodicite: "Mensuelle", categorie: "Comptabilité" },
  { tache: "Justification des comptes (pointage et lettrage)", cabinet: true, client: false, periodicite: "Mensuelle", categorie: "Comptabilité" },
  { tache: "Rapprochement bancaire", cabinet: true, client: false, periodicite: "Mensuelle", categorie: "Comptabilité" },
  { tache: "Édition des journaux comptables", cabinet: true, client: false, periodicite: "Mensuelle", categorie: "Comptabilité" },
  // Fiscal
  { tache: "Déclarations fiscales périodiques (TVA)", cabinet: true, client: false, periodicite: "Mensuelle", categorie: "Fiscal" },
  { tache: "Déclarations fiscales annuelles (liasse, IS/IR, CVAE, CFE)", cabinet: true, client: false, periodicite: "Annuelle", categorie: "Fiscal" },
  // Inventaire & Clôture
  { tache: "Préparation des éléments d'inventaire", cabinet: false, client: true, periodicite: "Annuelle", categorie: "Inventaire & Clôture" },
  { tache: "Éléments d'inventaire (stocks, immobilisations)", cabinet: false, client: true, periodicite: "Annuelle", categorie: "Inventaire & Clôture" },
  { tache: "Établissement des comptes annuels (bilan, CR, annexe)", cabinet: true, client: false, periodicite: "Annuelle", categorie: "Inventaire & Clôture" },
  { tache: "Attestation de présentation des comptes", cabinet: true, client: false, periodicite: "Annuelle", categorie: "Inventaire & Clôture" },
  // Juridique & Registres
  { tache: "Procès-verbaux d'assemblée générale", cabinet: true, client: false, periodicite: "Annuelle", categorie: "Juridique & Registres" },
  { tache: "Formalités juridiques annuelles", cabinet: true, client: false, periodicite: "Annuelle", categorie: "Juridique & Registres" },
  { tache: "Tenue des registres obligatoires", cabinet: false, client: true, periodicite: "Permanente", categorie: "Juridique & Registres" },
  // Obligations client
  { tache: "Classement des pièces justificatives", cabinet: false, client: true, periodicite: "Permanente", categorie: "Obligations client" },
  { tache: "Émission des factures clients", cabinet: false, client: true, periodicite: "Permanente", categorie: "Obligations client" },
  { tache: "Relances clients / suivi créances", cabinet: false, client: true, periodicite: "Permanente", categorie: "Obligations client" },
  { tache: "Conservation archives (documents comptables)", cabinet: true, client: true, periodicite: "Permanente", categorie: "Obligations client" },
  { tache: "Respect de la législation sociale et fiscale", cabinet: false, client: true, periodicite: "Permanente", categorie: "Obligations client" },
  { tache: "Vigilance sur les mentions obligatoires des factures", cabinet: false, client: true, periodicite: "Permanente", categorie: "Obligations client" },
  { tache: "Utilisation d'une caisse certifiée (si applicable)", cabinet: false, client: true, periodicite: "Permanente", categorie: "Obligations client" },
  // Options
  { tache: "Documents prévisionnels (sur option)", cabinet: true, client: false, periodicite: "Annuelle", categorie: "Options" },
  { tache: "Situations intermédiaires (sur option)", cabinet: true, client: false, periodicite: "Trimestrielle", categorie: "Options" },
];

// ══════════════════════════════════════════════
// Cabinet par défaut — COMPTADEC
// ══════════════════════════════════════════════

export const DEFAULT_CABINET: CabinetInfo = {
  nom: "COMPTADEC",
  adresse: "158 RUE DU ROUET",
  cp: "13008",
  ville: "MARSEILLE",
  telephone: "",
  email: "",
  siret: "98781957000019",
  oec_numero: "",
  couleur_primaire: "#2E75B6",
  couleur_secondaire: "#1B3A5C",
  assurance_nom: "MMA IARD",
  assurance_contrat: "118 269 730",
  assurance_adresse: "14 boulevard Marie et Alexandre Oyon, 72030 Le Mans Cedex 9",
};

// ══════════════════════════════════════════════
// Textes des sections juridiques
// ══════════════════════════════════════════════

export const TEXTES_SECTIONS: Record<string, string> = {
  introduction:
    "Nous vous remercions de la confiance que vous nous avez témoignée lors de notre dernier entretien, en envisageant de nous confier, en qualité d'expert-comptable, une mission de présentation des comptes annuels de votre entreprise.\n\nLa présente lettre de mission ainsi que les conditions générales d'intervention jointes en annexe forment un contrat entre les parties, conformément aux dispositions de l'article 151 du Code de déontologie intégré au décret du 30 mars 2012 relatif à l'exercice de l'activité d'expertise comptable.",

  notre_mission:
    "La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable (décret n°2012-432 du 30 mars 2012), de la Norme Professionnelle de Maîtrise de la Qualité (NPMQ), et de la norme professionnelle applicable à la mission de présentation des comptes (NP 2300).\n\nNos travaux seront réalisés conformément au référentiel normatif du Conseil Supérieur de l'Ordre des Experts-Comptables.\n\nÀ l'issue de notre mission, nous émettrons une attestation de présentation des comptes, document dans lequel nous exprimerons notre opinion sur la cohérence et la vraisemblance des comptes annuels de votre entité.\n\nNous nous permettons de rappeler les points suivants :\n\n▪ La mission de présentation des comptes ne constitue ni un audit ni un examen limité des comptes de votre entreprise ;\n▪ Ils ne comportent ni le contrôle de la matérialité des opérations ni le contrôle des inventaires physiques des actifs de votre entreprise à la clôture de l'exercice comptable (stocks, immobilisations, espèces…) ;\n▪ Ils n'ont pas pour objectif de déceler les fraudes ou les actes illégaux pouvant ou ayant existé dans votre entreprise. Toutefois, nous vous en informerions si nous étions conduits à en avoir connaissance.",

  nature_limite:
    "Notre mission consiste à exprimer une opinion sur la cohérence et la vraisemblance des comptes de votre entité. Cette mission n'a pas pour objectif de déceler des actes illégaux ou autres irrégularités, toutefois nous vous en informerions le cas échéant.\n\nNous vous précisons que nous sommes juridiquement redevables d'une simple obligation de moyens. Par conséquent, la vérification des écritures et leur rapprochement avec les pièces justificatives sont effectués par sondages.",

  mission_sociale:
    "La mission sociale est conclue pour une durée correspondant à la mission comptable et nos travaux consisteront à :\n\n▪ Établir les bulletins de salaire dans un délai de trois jours ouvrés à compter de la réception des éléments transmis ;\n▪ Établir, télétransmettre et télé-payer les déclarations sociales périodiques liées ;\n▪ Tenir le journal des salaires ;\n▪ Mettre à disposition de l'entité les documents et états liés au traitement de la paie ;\n▪ Fournir les données d'archivage ;\n▪ Assurer la gestion administrative d'évènements occasionnels courants.\n\nIl est rappelé que le cabinet n'a aucun lien direct avec les salariés de l'employeur.\n\nRegistres obligatoires : le client est tenu de disposer à jour du registre unique du personnel et du Document Unique d'Évaluation des Risques Professionnels (DUERP).\n\nDPAE : la Déclaration Préalable À l'Embauche doit être effectuée par le client avant toute embauche.\n\nTravailleurs étrangers : le client doit vérifier les autorisations de travail de tout salarié étranger.",

  mission_juridique:
    "La mission de secrétariat juridique annuelle est réalisée à l'issue de la clôture de chaque exercice social et dans le respect des délais légaux.\n\nElle comprend la rédaction des actes relatifs à l'approbation des comptes annuels.",

  controle_fiscal:
    "Dans le cadre de cette mission, nous vous assisterons à chaque étape de la procédure de contrôle.\n\nAfin de mutualiser le risque, nous mettons en place une garantie :\n\n☐ Option A : limite de 5 000 € HT/an — 25 € HT/mois\n☐ Option B : limite de 2 500 € HT/an — 10 € HT/mois\n☐ Renonce à la souscription",

  clause_resolutoire:
    "Conformément aux dispositions de l'article 1225 du Code civil, en cas d'inexécution par le client de l'une des obligations suivantes :\n\n(i) transmission des documents comptables dans les délais convenus,\n(ii) paiement des honoraires à leur échéance,\n(iii) fourniture des informations d'identification requises au titre de la LCB-FT,\n\nla présente lettre de mission pourra être résolue de plein droit, après mise en demeure restée infructueuse pendant un délai de trente (30) jours, sans préjudice des honoraires dus pour les travaux déjà effectués.",

  mandat_administrations:
    "Le client mandate expressément le cabinet pour accomplir en son nom et pour son compte les formalités et démarches suivantes auprès de l'administration fiscale et des organismes de sécurité sociale :\n\n▪ Télétransmission des déclarations fiscales périodiques et annuelles (TVA, IS/IR, CVAE, CFE, liasses fiscales) ;\n▪ Télétransmission des déclarations sociales (DSN et déclarations connexes) ;\n▪ Relations courantes avec les services des impôts des entreprises (SIE) et les organismes sociaux.\n\nCe mandat est donné pour la durée de la mission. Il peut être révoqué à tout moment par lettre recommandée avec accusé de réception.",

  rgpd:
    "Le cabinet agit en qualité de responsable de traitement au sens du Règlement (UE) 2016/679 (RGPD) pour les données collectées dans le cadre de la mission. Les données sont traitées pour les seuls besoins de la mission et des obligations légales du cabinet.\n\nLe client dispose d'un droit d'accès, de rectification, d'effacement et de portabilité de ses données, ainsi que d'un droit d'opposition et de limitation du traitement, en s'adressant au cabinet.\n\nDurée de conservation : conformément aux obligations légales et professionnelles (10 ans pour les documents comptables, 5 ans pour les données LCB-FT).",

  lcbft_conservation:
    "Conformément à l'article L.561-12 du Code monétaire et financier, le cabinet conserve pendant cinq (5) ans à compter de la fin de la relation d'affaires les documents relatifs à l'identité des clients, personnes agissant pour leur compte et bénéficiaires effectifs, et pendant cinq (5) ans à compter de leur exécution les documents relatifs aux caractéristiques des opérations (art. L.561-10-2 CMF).\n\nCes données peuvent être communiquées aux autorités compétentes.",
};

// ══════════════════════════════════════════════
// Articles des CGV
// ══════════════════════════════════════════════

export interface CgvArticle {
  numero: number;
  titre: string;
  contenu: string;
}

export const TEXTES_CGV: CgvArticle[] = [
  {
    numero: 1,
    titre: "Domaine d'application",
    contenu: "Les présentes conditions sont applicables aux conventions portant sur les missions conclues entre notre société d'expertise comptable et son client.",
  },
  {
    numero: 2,
    titre: "Définition de la mission",
    contenu: "Les travaux incombant au professionnel sont détaillés dans la lettre de mission et ses annexes. La mission sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable (décret n°2012-432 du 30 mars 2012), de la Norme Professionnelle de Maîtrise de la Qualité (NPMQ), et de la norme professionnelle applicable à la mission concernée.",
  },
  {
    numero: 3,
    titre: "Résiliation et reconduction",
    contenu: "La mission sera tacitement renouvelée chaque année. Le client ou le professionnel peut y mettre fin par lettre recommandée dans un délai de 3 mois avant la fin de la période en cours.\nConformément à l'article L 215-1 du Code de la consommation, le professionnel informera le client par écrit, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat.",
  },
  {
    numero: 4,
    titre: "Suspension de la mission",
    contenu: "Les délais de délivrance sont prolongés pour une durée égale à celle de la suspension.",
  },
  {
    numero: 5,
    titre: "Obligations du professionnel",
    contenu: "Le professionnel effectue la mission conformément au Code de déontologie et aux normes professionnelles applicables (NPMQ et norme applicable au type de mission). Le responsable de la mission est un expert-comptable inscrit au tableau de l'Ordre, qui apporte personnellement son concours à la mission (NPMQ §30). Secret professionnel et discrétion assurés conformément à l'article 147 du Code de déontologie.",
  },
  {
    numero: 6,
    titre: "Obligations du client",
    contenu: "Le client s'engage à :\n— fournir les documents d'identification KYC conformément aux obligations LCB-FT ;\n— mettre à disposition les pièces comptables dans les délais convenus ;\n— porter à connaissance du cabinet tout fait nouveau susceptible d'affecter la mission ;\n— coopérer pleinement avec le cabinet et répondre aux demandes d'information.\nLe client reste responsable à l'égard des tiers de l'exhaustivité, de la fiabilité et de l'exactitude des informations comptables et financières.",
  },
  {
    numero: 7,
    titre: "Honoraires et conditions de règlement",
    contenu: "Les honoraires sont payés par prélèvement à leur échéance. En cas de retard de paiement, des pénalités seront exigibles de plein droit au taux d'intérêt BCE majoré de 10 points (art. L 441-10 Code de commerce). Indemnité forfaitaire pour frais de recouvrement : 40 € (art. D 441-5 Code de commerce).\nLes honoraires sont révisables annuellement selon l'indice INSEE des prix des services comptables. À défaut, minimum forfaitaire de 3 % par an.\nConformément à l'article 24 de l'ordonnance du 19 septembre 1945 modifié par la loi PACTE, les missions relevant de la prérogative d'exercice exclusive ne peuvent donner lieu à des honoraires complémentaires de succès.",
  },
  {
    numero: 8,
    titre: "Responsabilité civile professionnelle",
    contenu: "Le cabinet est assuré en responsabilité civile professionnelle. La prescription est réduite à 1 an conformément à l'article 2254 du Code civil. Cet aménagement ne s'applique pas lorsque le client a la qualité de consommateur ou de non-professionnel.",
  },
  {
    numero: 9,
    titre: "Clause résolutoire",
    contenu: "Conformément à l'article 1225 du Code civil, en cas d'inexécution par le client de ses obligations (transmission des documents, paiement des honoraires, fourniture des informations LCB-FT), le contrat pourra être résolu de plein droit après mise en demeure restée infructueuse pendant 30 jours.",
  },
  {
    numero: 10,
    titre: "Données personnelles (RGPD)",
    contenu: "Le cabinet agit en qualité de responsable de traitement au sens du RGPD. Les données sont traitées pour les seuls besoins de la mission et des obligations légales. Le client dispose d'un droit d'accès, de rectification, d'effacement et de portabilité. Durée de conservation : 10 ans pour les documents comptables, 5 ans pour les données LCB-FT.",
  },
  {
    numero: 11,
    titre: "Conservation des données LCB-FT",
    contenu: "Le cabinet conserve pendant cinq (5) ans à compter de la fin de la relation d'affaires les documents relatifs à l'identité des clients (art. L 561-12 CMF), et pendant cinq (5) ans à compter de leur exécution les documents relatifs aux caractéristiques des opérations (art. L 561-10-2 CMF).",
  },
  {
    numero: 12,
    titre: "Non-sollicitation des collaborateurs",
    contenu: "Le client s'interdit tout acte de nature à porter atteinte à l'indépendance du professionnel ou de ses collaborateurs, notamment en s'abstenant de leur faire toutes offres de mission ou d'emploi, pendant la durée du contrat et pendant douze (12) mois suivant la fin de la mission.",
  },
  {
    numero: 13,
    titre: "Conciliation et différends",
    contenu: "En cas de contestation, les parties s'engagent, préalablement à toute action en justice, à saisir le président du Conseil Régional de l'Ordre des Experts-Comptables (CROEC) aux fins de conciliation ou d'arbitrage (art. 160 décret du 30 mars 2012). Pour les clients consommateurs, le recours à un médiateur de la consommation est proposé (art. L 611-1 et s. C. conso).",
  },
];
