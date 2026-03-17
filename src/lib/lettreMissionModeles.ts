import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { MISSION_TYPES, getMissionTypeConfig } from "./lettreMissionTypes";
import type { MissionTypeConfig, MissionCategory } from "./lettreMissionTypes";

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

// OPT-17: group field for editor grouping
export type SectionGroup = 'principales' | 'obligations' | 'complementaires' | 'clauses' | 'custom';

export interface LMSection {
  id: string;
  titre: string;
  contenu: string;
  type: "fixed" | "conditional";
  condition?: string;
  editable: boolean;
  cnoec_obligatoire: boolean;
  cnoec_reference?: string;
  cnoec_warning?: string;
  ordre: number;
  hidden?: boolean;
  group?: SectionGroup;
}

export interface LMModele {
  id: string;
  cabinet_id: string;
  nom: string;
  description?: string;
  mission_type?: string;
  sections: LMSection[];
  cgv_content: string;
  repartition_taches: RepartitionRow[];
  is_default: boolean;
  source: "grimy" | "import_docx" | "duplicate";
  original_filename?: string;
  created_at: string;
  updated_at: string;
}

// OPT-49: Typed repartition rows
export interface RepartitionRow {
  id: string;
  label: string;
  cabinet: boolean;
  client: boolean;
  periodicite: 'M' | 'T' | 'A' | 'P' | 'ND' | string;
}

export interface CnoecWarning {
  sectionId: string;
  reference: string;
  message: string;
  severity: "warning";
}

// ══════════════════════════════════════════════
// Modèle GRIMY par défaut — Sections
// OPT-18: Each section has a group assigned
// ══════════════════════════════════════════════

export const GRIMY_DEFAULT_SECTIONS: LMSection[] = [
  {
    id: "destinataire",
    titre: "Destinataire",
    contenu:
      "À l'attention de {{formule_politesse}} {{dirigeant}},\nMandataire social de la société\n{{forme_juridique}} {{raison_sociale}},\n{{adresse}} {{code_postal}} {{ville}}",
    type: "fixed",
    editable: false,
    cnoec_obligatoire: false,
    ordre: 1,
    group: 'principales',
  },
  {
    id: "introduction",
    titre: "Introduction",
    contenu:
      "Nous vous remercions de la confiance que vous nous avez témoignée lors de notre dernier entretien, en envisageant de nous confier, en qualité d'expert-comptable, une mission de présentation des comptes annuels de votre entreprise.\n\nLa présente lettre de mission ainsi que les conditions générales d'intervention jointes en annexe forment un contrat entre les parties, conformément aux dispositions de l'article 151 du Code de déontologie intégré au décret du 30 mars 2012 relatif à l'exercice de l'activité d'expertise comptable.",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: true,
    cnoec_reference: "Art. 151 Code de déontologie",
    cnoec_warning:
      "L'introduction référençant l'article 151 du Code de déontologie est obligatoire pour la validité de la lettre de mission.",
    ordre: 2,
    group: 'principales',
  },
  {
    id: "entite",
    titre: "Votre entité",
    contenu: "TABLEAU_ENTITE",
    type: "fixed",
    editable: false,
    cnoec_obligatoire: true,
    cnoec_reference: "NPMQ §30",
    cnoec_warning:
      "L'identification complète de l'entité cliente est requise par la NPMQ §30.",
    ordre: 3,
    group: 'principales',
  },
  {
    id: "organisation",
    titre: "Organisation et transmission",
    contenu:
      "Organisation et transmission des documents comptables :\n▪ Périodicité : {{frequence}} – Avant le J+10\n▪ Transmission via notre outil : GRIMY\n\nDurée de conservation LCB-FT : Conformément à l'art. L.561-12 CMF, l'ensemble des pièces d'identification est conservé pendant cinq (5) ans à compter de la fin de la relation d'affaires, indépendamment de la durée de conservation des documents comptables.",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 4,
    group: 'principales',
  },
  {
    id: "mission",
    titre: "Notre mission",
    contenu:
      "La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable (décret n°2012-432 du 30 mars 2012), de la Norme Professionnelle de Maîtrise de la Qualité (NPMQ), et de la norme professionnelle applicable à la mission de présentation des comptes (NP 2300). Nos travaux seront réalisés conformément au référentiel normatif du Conseil Supérieur de l'Ordre des Experts-Comptables.\n\nLes comptes annuels seront présentés conformément au référentiel comptable applicable, à savoir le Plan Comptable Général (PCG) tel que défini par le règlement ANC n°2014-03 modifié, et aux dispositions du Code de commerce relatives à la comptabilité des commerçants.\n\nÀ l'issue de notre mission, nous émettrons une attestation de présentation des comptes, document dans lequel nous exprimerons notre opinion sur la cohérence et la vraisemblance des comptes annuels de votre entité.\n\nNos relations contractuelles seront régies tant par les termes de cette lettre de mission que par les Conditions Générales d'Intervention ci-jointes. À cet effet, nous nous permettons de rappeler les points suivants :\n\nLa mission de présentation des comptes ne constitue ni un audit ni un examen limité des comptes de votre entreprise ;\n\nIls ne comportent ni le contrôle de la matérialité des opérations ni le contrôle des inventaires physiques des actifs de votre entreprise à la clôture de l'exercice comptable (stocks, immobilisations, espèces…) ;\n\nIls n'ont pas pour objectif de déceler les fraudes ou les actes illégaux pouvant ou ayant existé dans votre entreprise. Toutefois, nous vous en informerions si nous étions conduits à en avoir connaissance ;\n\nNous nous permettons d'attirer votre attention sur le fait que conformément à l'article L 123-14 du Code de commerce, les comptes annuels doivent être réguliers, sincères et donner une image fidèle du patrimoine, de la situation financière et du résultat de l'entreprise ;\n\nNous comptons sur votre entière coopération afin qu'il soit mis à notre disposition dans un délai raisonnable tous les documents et autres informations nécessaires qui nous permettront de mener à bien cette mission.\n\nVous restez responsable à l'égard des tiers de l'exhaustivité, de la fiabilité et de l'exactitude des informations comptables et financières concourant à la présentation des comptes, ainsi que des procédures de contrôle interne concourant à l'élaboration de ces comptes. Cela implique notamment le respect des règles applicables à la tenue d'une comptabilité en France et du référentiel comptable applicable à votre secteur d'activité.",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: true,
    cnoec_reference: "NP 2300 §8",
    cnoec_warning:
      "La section « Mission » doit inclure : référence normative complète, référentiel comptable, forme du rapport et responsabilité du client (NP 2300 §8).",
    ordre: 5,
    group: 'principales',
  },
  {
    id: "responsable_mission",
    titre: "Responsable de la mission",
    contenu:
      "Le responsable de la mission est {{responsable_mission}}, expert-comptable inscrit au tableau de l'Ordre, qui apportera personnellement son concours à la mission et en garantira la bonne réalisation au nom de notre structure d'exercice.",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: true,
    cnoec_reference: "NPMQ §30",
    cnoec_warning:
      "Le nom du responsable de mission doit figurer dans la lettre (NPMQ §30).",
    ordre: 6,
    group: 'obligations',
  },
  {
    id: "duree",
    titre: "Durée de la mission",
    contenu:
      "Notre mission prendra effet à la date de signature de la présente lettre de mission. Elle portera sur les comptes de l'exercice comptable commençant le {{date_du_jour}} et se terminant le {{date_cloture}}.\n\nCette lettre de mission restera en vigueur pour les exercices futurs, sauf en cas de résiliation, de modification ou de suspension de notre mission selon les modalités décrites dans les Conditions Générales d'Intervention.",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: true,
    cnoec_reference: "Art. 151 Code de déontologie",
    cnoec_warning:
      "La durée et les conditions de renouvellement de la mission doivent être précisées (art. 151 Code de déontologie).",
    ordre: 7,
    group: 'principales',
  },
  {
    id: "nature_limite",
    titre: "Nature et limite de la mission",
    contenu:
      "Notre mission consiste à exprimer une opinion sur la cohérence et la vraisemblance des comptes de votre entité. Cette mission n'a pas pour objectif de déceler des actes illégaux ou autres irrégularités, toutefois nous vous en informerions le cas échéant.\n\nNous vous précisons que nous sommes juridiquement redevables d'une simple obligation de moyens. Par conséquent, la vérification des écritures et leur rapprochement avec les pièces justificatives sont effectués par sondages.",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: true,
    cnoec_reference: "NP 2300 §8",
    cnoec_warning:
      "Les limites de la mission (obligation de moyens, absence de contrôle exhaustif) doivent être clairement exposées (NP 2300 §8).",
    ordre: 8,
    group: 'principales',
  },
  {
    id: "lcbft",
    titre: "Obligations LCB-FT",
    contenu: "{{bloc_vigilance_lab}}",
    type: "fixed",
    editable: false,
    cnoec_obligatoire: true,
    cnoec_reference: "Art. L.561-1 et suivants CMF",
    cnoec_warning:
      "Le bloc LCB-FT est obligatoire : le cabinet doit informer le client de ses obligations de vigilance (art. L.561-1 CMF).",
    ordre: 9,
    group: 'obligations',
  },
  {
    id: "missions_complementaires_intro",
    titre: "Missions complémentaires",
    contenu:
      "Vous avez souhaité également qu'en complément de cette mission nous assurions les prestations suivantes :",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 10,
    group: 'complementaires',
  },
  {
    id: "mission_sociale",
    titre: "Mission sociale",
    contenu:
      "La mission sociale est conclue pour une durée correspondant à la mission comptable et nos travaux consisteront à :\n\nÉtablir les bulletins de salaire dans un délai de trois jours ouvrés à compter de la réception des éléments transmis ;\nÉtablir, télétransmettre et télé-payer les déclarations sociales périodiques liées ;\nTenir le journal des salaires ;\nMettre à disposition de l'entité les documents et états liés au traitement de la paie ;\nFournir les données d'archivage ;\nAssurer la gestion administrative d'évènements occasionnels courants.\n\nIl est rappelé que le cabinet n'a aucun lien direct avec les salariés de l'employeur.",
    type: "conditional",
    condition: "sociale",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 11,
    group: 'complementaires',
  },
  {
    id: "mission_juridique",
    titre: "Mission juridique",
    contenu:
      "La mission de secrétariat juridique annuelle est réalisée à l'issue de la clôture de chaque exercice social et dans le respect des délais légaux.\n\nElle comprend la rédaction des actes relatifs à l'approbation des comptes annuels.",
    type: "conditional",
    condition: "juridique",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 12,
    group: 'complementaires',
  },
  {
    id: "mission_controle_fiscal",
    titre: "Mission d'assistance au contrôle fiscal (SUR OPTION)",
    contenu:
      "Dans le cadre de cette mission, nous vous assisterons à chaque étape de la procédure de contrôle.\n\nAfin de mutualiser le risque, nous mettons en place une garantie :\n☐ Option A : limite de 5 000 € HT/an — 25 € HT/mois\n☐ Option B : limite de 2 500 € HT/an — 10 € HT/mois\n☐ Renonce à la souscription",
    type: "conditional",
    condition: "fiscal",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 13,
    group: 'complementaires',
  },
  {
    id: "clause_resolutoire",
    titre: "Clause résolutoire",
    contenu:
      "Conformément aux dispositions de l'article 1225 du Code civil, en cas d'inexécution par le client de l'une des obligations suivantes : (i) transmission des documents comptables dans les délais convenus, (ii) paiement des honoraires à leur échéance, (iii) fourniture des informations d'identification requises au titre de la LCB-FT, la présente lettre de mission pourra être résolue de plein droit, après mise en demeure restée infructueuse pendant un délai de trente (30) jours, sans préjudice des honoraires dus pour les travaux déjà effectués.",
    type: "conditional",
    condition: "clause_resolutoire",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 14,
    group: 'clauses',
  },
  {
    id: "mandat_fiscal",
    titre: "Mandat pour agir auprès des administrations",
    contenu:
      "Le client mandate expressément le cabinet pour accomplir en son nom et pour son compte les formalités et démarches suivantes auprès de l'administration fiscale et des organismes de sécurité sociale :\n\n— Télétransmission des déclarations fiscales périodiques et annuelles (TVA, IS/IR, CVAE, CFE, liasses fiscales) ;\n— Télétransmission des déclarations sociales (DSN et déclarations connexes) ;\n— Relations courantes avec les services des impôts des entreprises (SIE) et les organismes sociaux.\n\nCe mandat est donné pour la durée de la mission. Il peut être révoqué à tout moment par lettre recommandée avec accusé de réception. Le cabinet conserve les mandats signés conformément à l'article 151 du Code de déontologie.",
    type: "conditional",
    condition: "mandat_fiscal",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 15,
    group: 'clauses',
  },
  {
    id: "modalites",
    titre: "Modalités relationnelles",
    contenu:
      "Nos relations seront réglées sur le plan juridique par les termes de cette lettre, les conditions générales et le tableau de répartition des obligations respectives (voir annexes).",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 16,
    group: 'principales',
  },
  {
    id: "honoraires",
    titre: "Honoraires",
    contenu:
      "TABLEAU_HONORAIRES\n\nLes honoraires prévus au présent contrat seront révisables annuellement à la date anniversaire de la lettre de mission, selon l'évolution de l'indice des prix hors taxes relatifs aux services comptables publié par l'INSEE (référence : Indice des prix de production des services aux entreprises — Services comptables). La formule de révision est : Honoraires révisés = Honoraires d'origine × (dernier indice publié / indice de référence à la date de signature). À défaut de publication de cet indice, les honoraires seront révisés avec un minimum forfaitaire de 3 % par an.\n\nConformément à l'article 24 de l'ordonnance du 19 septembre 1945 modifié par la loi PACTE, les missions relevant de la prérogative d'exercice exclusive (tenue de comptabilité, révision comptable, présentation des comptes) ou participant à l'établissement de l'assiette fiscale ou sociale du client ne peuvent donner lieu à des honoraires complémentaires de succès.",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: true,
    cnoec_reference: "Art. 158 Code de déontologie",
    cnoec_warning:
      "Les modalités de détermination et de révision des honoraires doivent figurer dans la lettre de mission (art. 158 Code de déontologie).",
    ordre: 17,
    group: 'principales',
  },
  {
    id: "signature",
    titre: "Signature",
    contenu:
      "Nous vous serions obligés de bien vouloir nous retourner un exemplaire de la présente et des annexes jointes, revêtues d'un paraphe sur chacune des pages et de votre signature sur la dernière page.\n\nNous vous prions de croire, {{formule_politesse}} {{dirigeant}}, à nos sentiments dévoués.\n\nFait à {{ville_cabinet}}, le {{date_du_jour}}\n\nL'Expert-comptable                    Le client\n{{associe}}                            {{dirigeant}}",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 18,
    group: 'principales',
  },
  {
    id: "annexe_repartition",
    titre: "Annexe — Répartition des travaux",
    contenu: "TABLEAU_REPARTITION",
    type: "fixed",
    editable: false,
    cnoec_obligatoire: false,
    ordre: 19,
    group: 'principales',
  },
  {
    id: "annexe_travail_dissimule",
    titre: "Annexe — Attestation travail dissimulé",
    contenu:
      "Je soussigné(e) {{dirigeant}} agissant en qualité de mandataire de la société {{raison_sociale}} immatriculée au RCS sous le n° {{siren}} et dont le siège social est situé {{adresse}} {{code_postal}} {{ville}} :\n\nAtteste sur l'honneur, en application des articles L.8222-1, L.8222-2, D.8222-5 et R.8222-1 du Code du Travail :\n▪ Avoir immatriculé mon entreprise au RCS\n▪ Employer régulièrement tous mes salariés\n▪ Ne pas employer de salariés étrangers démunis du titre les autorisant à travailler en France",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 20,
    group: 'principales',
  },
  {
    id: "annexe_sepa",
    titre: "Annexe — Mandat de prélèvement SEPA",
    contenu:
      "En signant ce formulaire de mandat, vous autorisez {{nom_cabinet}} à envoyer des instructions à votre banque pour débiter votre compte.\n\nIBAN : {{iban}}\nBIC : {{bic}}",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 21,
    group: 'principales',
  },
  {
    id: "annexe_liasse",
    titre: "Annexe — Autorisation de transmission de Liasse Fiscale",
    contenu:
      "{{raison_sociale}}, représentée par {{dirigeant}}, mandataire social ayant tous pouvoirs à cet effet, déclare autoriser {{nom_cabinet}} à télétransmettre chaque année sur le portail jedéclare.com la liasse fiscale qui la concerne.",
    type: "fixed",
    editable: true,
    cnoec_obligatoire: false,
    ordre: 22,
    group: 'principales',
  },
];

// ══════════════════════════════════════════════
// CGV par défaut — conforme CNOEC (OPT-40/41/42/43/44/45/46)
// ══════════════════════════════════════════════

export const GRIMY_DEFAULT_CGV = `Conditions générales d'intervention en vigueur au 15 mars 2026

1. Domaine d'application
Les présentes conditions sont applicables aux conventions portant sur les missions conclues entre notre société d'expertise comptable et son client.

2. Définition de la mission
Les travaux incombant au professionnel sont détaillés dans la lettre de mission et ses annexes. La mission sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable (décret n°2012-432 du 30 mars 2012), de la Norme Professionnelle de Maîtrise de la Qualité (NPMQ), et de la norme professionnelle applicable à la mission concernée.

3. Résiliation et reconduction
La mission sera tacitement renouvelée chaque année. Le client ou le professionnel peut y mettre fin par lettre recommandée dans un délai de 3 mois avant la fin de la période en cours.
Pour les clients ayant la qualité de consommateur ou de non-professionnel au sens de l'article liminaire du Code de la consommation : conformément à l'article L 215-1 du Code de la consommation, le professionnel informera le client par écrit, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat. À défaut, le client pourra mettre gratuitement un terme au contrat à tout moment à compter de la date de reconduction.

4. Suspension de la mission
Les délais de délivrance sont prolongés pour une durée égale à celle de la suspension.

5. Obligations du professionnel
Le professionnel effectue la mission conformément au Code de déontologie et aux normes professionnelles applicables (NPMQ et norme applicable au type de mission). Le responsable de la mission est un expert-comptable inscrit au tableau de l'Ordre, qui apporte personnellement son concours à la mission (NPMQ §30). Secret professionnel et discrétion assurés conformément à l'article 147 du Code de déontologie.

6. Obligations du client
Le client s'engage à :
— fournir les documents d'identification KYC (CNI, Kbis, registre des bénéficiaires effectifs) conformément aux obligations LCB-FT ;
— mettre à disposition les pièces comptables dans les délais convenus ;
— porter à connaissance du cabinet tout fait nouveau susceptible d'affecter la mission ;
— coopérer pleinement avec le cabinet et répondre aux demandes d'information.
Le client reste responsable à l'égard des tiers de l'exhaustivité, de la fiabilité et de l'exactitude des informations comptables et financières concourant à la présentation des comptes.

7. Honoraires et conditions de règlement
Les honoraires sont payés par prélèvement à leur échéance. En cas de retard de paiement, des pénalités seront exigibles de plein droit, sans qu'un rappel soit nécessaire, au taux d'intérêt égal à celui appliqué par la Banque Centrale Européenne à son opération de refinancement la plus récente, majoré de 10 points de pourcentage (art. L 441-10 Code de commerce). Une indemnité forfaitaire pour frais de recouvrement d'un montant de 40 euros est due de plein droit (art. D 441-5 Code de commerce).
Les honoraires sont révisables annuellement selon l'évolution de l'indice des prix hors taxes relatifs aux services comptables publié par l'INSEE. À défaut de publication de cet indice, les honoraires seront révisés avec un minimum forfaitaire de 3 % par an.
Conformément à l'article 24 de l'ordonnance du 19 septembre 1945 modifié par la loi PACTE, les missions relevant de la prérogative d'exercice exclusive ne peuvent donner lieu à des honoraires complémentaires de succès.

8. Responsabilité civile professionnelle
Le cabinet est assuré en responsabilité civile professionnelle auprès de {{assureur_nom}}, dont le siège est {{assureur_adresse}}. La prescription est réduite à 1 an conformément à l'article 2254 du Code civil. Cet aménagement ne s'applique pas lorsque le client a la qualité de consommateur ou de non-professionnel au sens du Code de la consommation ; les délais de prescription de droit commun s'appliquent alors (article L 218-1 du Code de la consommation).

9. Clause résolutoire
Conformément aux dispositions de l'article 1225 du Code civil, en cas d'inexécution par le client de l'une des obligations visées à la lettre de mission (transmission des documents, paiement des honoraires, fourniture des informations LCB-FT), le contrat pourra être résolu de plein droit, après mise en demeure restée infructueuse pendant un délai de trente (30) jours, sans préjudice des honoraires dus pour les travaux déjà effectués.

10. Données personnelles (RGPD)
Le cabinet agit en qualité de responsable de traitement au sens du Règlement (UE) 2016/679 (RGPD) pour les données collectées dans le cadre de la mission. Les données sont traitées pour les seuls besoins de la mission et des obligations légales du cabinet. Le client dispose d'un droit d'accès, de rectification, d'effacement et de portabilité de ses données, ainsi que d'un droit d'opposition et de limitation du traitement, en s'adressant au cabinet. Durée de conservation : conformément aux obligations légales et professionnelles (10 ans pour les documents comptables, 5 ans pour les données LCB-FT).

11. Conservation des données LCB-FT
Le cabinet collecte des données d'identification pour respecter ses obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme. Il conserve pendant cinq (5) ans à compter de la fin de la relation d'affaires les documents relatifs à l'identité des clients, personnes agissant pour leur compte et bénéficiaires effectifs (art. L 561-12 CMF), et pendant cinq (5) ans à compter de leur exécution les documents relatifs aux caractéristiques des opérations (art. L 561-10-2 CMF). Ces données peuvent être communiquées aux autorités compétentes.

12. Non-sollicitation des collaborateurs
Le client s'interdit tout acte de nature à porter atteinte à l'indépendance du professionnel ou de ses collaborateurs, notamment en s'abstenant de leur faire toutes offres d'exécuter des missions en leur nom propre ou de devenir salarié du client, pendant la durée du contrat et pendant douze (12) mois suivant la fin de la mission.

13. Conciliation et différends
En cas de contestation des conditions d'exercice de la mission ou de différend sur les honoraires, les parties s'engagent, préalablement à toute action en justice, à saisir le président du Conseil Régional de l'Ordre des Experts-Comptables (CROEC) compétent aux fins de conciliation ou d'arbitrage (art. 160 décret du 30 mars 2012). Pour les clients consommateurs, le recours à un médiateur de la consommation est proposé (art. L 611-1 et s. C. conso).

14. Droit applicable
Le présent contrat sera régi et interprété selon le droit français. Toute difficulté relative à l'interprétation ou l'exécution sera soumise, à défaut d'accord amiable et de conciliation devant le CROEC, au tribunal de commerce de {{ville_tribunal}}.`;

// ══════════════════════════════════════════════
// Répartition des tâches par défaut (OPT-48/49)
// ══════════════════════════════════════════════

export const GRIMY_DEFAULT_REPARTITION: RepartitionRow[] = [
  { id: "tenue", label: "Tenue des comptes", cabinet: true, client: false, periodicite: "M" },
  { id: "saisie", label: "Saisie des écritures comptables", cabinet: true, client: false, periodicite: "M" },
  { id: "pointage", label: "Justification des comptes (pointage et lettrage)", cabinet: true, client: false, periodicite: "M" },
  { id: "rapprochement", label: "Rapprochement bancaire", cabinet: true, client: false, periodicite: "M" },
  { id: "tva", label: "Déclarations fiscales périodiques (TVA)", cabinet: true, client: false, periodicite: "M" },
  { id: "decl_annuelles", label: "Déclarations fiscales annuelles (liasse, IS/IR, CVAE, CFE)", cabinet: true, client: false, periodicite: "A" },
  { id: "classement", label: "Classement des pièces justificatives", cabinet: false, client: true, periodicite: "P" },
  { id: "factures", label: "Émission des factures clients", cabinet: false, client: true, periodicite: "P" },
  { id: "relances", label: "Relances clients / suivi créances", cabinet: false, client: true, periodicite: "P" },
  { id: "inventaire", label: "Éléments d'inventaire (stocks, immobilisations)", cabinet: false, client: true, periodicite: "A" },
  { id: "bilan", label: "Comptes annuels (bilan, compte de résultat, annexe)", cabinet: true, client: false, periodicite: "A" },
  { id: "attestation", label: "Attestation de présentation des comptes", cabinet: true, client: false, periodicite: "A" },
  { id: "ag", label: "Procès-verbaux d'assemblée générale", cabinet: true, client: false, periodicite: "A" },
  { id: "archives", label: "Conservation archives (documents comptables)", cabinet: true, client: true, periodicite: "P" },
];

// ══════════════════════════════════════════════
// Build sections for a specific mission type (OPT-19/20/21/22)
// ══════════════════════════════════════════════

function createSpecificSection(sectionId: string, config: MissionTypeConfig): LMSection {
  const specificSections: Record<string, Partial<LMSection>> = {
    equipe_audit: {
      titre: "Composition de l'équipe d'audit",
      contenu: "L'équipe d'audit sera composée de :\n{{composition_equipe}}\n\nSi certains membres ne pouvaient intervenir, nous mettrions à votre disposition des intervenants de compétences comparables.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "ISA 210 §10",
      group: 'principales',
    },
    planning_audit: {
      titre: "Planning d'intervention",
      contenu: "Le planning prévisionnel d'intervention est le suivant :\n{{planning_audit}}\n\nCe planning pourra être ajusté en fonction des contraintes opérationnelles.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "ISA 210 §10",
      group: 'principales',
    },
    declarations_ecrites: {
      titre: "Déclarations écrites",
      contenu: "Conformément à la norme ISA 580, nous vous demanderons de nous fournir des déclarations écrites confirmant certaines des déclarations faites au cours de l'audit, notamment sur l'exhaustivité des informations fournies et la reconnaissance de votre responsabilité dans l'établissement des états financiers.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "ISA 210 §10",
      group: 'obligations',
    },
    objet_attestation: {
      titre: "Objet de l'attestation",
      contenu: "L'attestation portera sur l'information suivante : {{objet_attestation}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3100 §15",
      group: 'principales',
    },
    nature_travaux_attestation: {
      titre: "Nature des travaux",
      contenu: "La nature de nos travaux comprend : {{nature_travaux_attestation}}.\n\nParticipation du responsable de mission à l'élaboration de l'information : {{participation_elaboration}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3100 §15",
      group: 'principales',
    },
    utilisation_prevue: {
      titre: "Utilisation prévue des informations",
      contenu: "L'utilisation prévue des informations prévisionnelles est : {{utilisation_prevue}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3400 §11",
      group: 'principales',
    },
    destinataires_info: {
      titre: "Destinataires",
      contenu: "Les destinataires des informations sont : {{destinataires_info}}.\nType de diffusion : {{type_diffusion}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3400 §11",
      group: 'principales',
    },
    nature_hypotheses: {
      titre: "Nature des hypothèses",
      contenu: "Les hypothèses retenues sont de nature : {{nature_hypotheses}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3400 §11",
      group: 'principales',
    },
    periode_couverte: {
      titre: "Période couverte",
      contenu: "Les informations prévisionnelles couvrent la période du {{periode_debut_prev}} au {{periode_fin_prev}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3400 §11",
      group: 'principales',
    },
    contexte_mission: {
      titre: "Contexte de la mission",
      contenu: "Le contexte de la mission est : {{contexte_mission}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 4400 §11",
      group: 'principales',
    },
    informations_examinees: {
      titre: "Informations examinées",
      contenu: "Les informations sur lesquelles portent les procédures sont : {{informations_examinees}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 4400 §11",
      group: 'principales',
    },
    procedures_detail: {
      titre: "Procédures à mettre en œuvre",
      contenu: "Les procédures définies d'un commun accord sont les suivantes :\n{{procedures_detail}}",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 4400 §11",
      group: 'principales',
    },
    calendrier_procedures: {
      titre: "Calendrier",
      contenu: "Le calendrier des procédures est : {{calendrier_procedures}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 4400 §11",
      group: 'principales',
    },
    diffusion_rapport: {
      titre: "Limites de diffusion du rapport",
      contenu: "La diffusion du rapport est limitée à : {{diffusion_rapport}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 4400 §11",
      group: 'principales',
    },
    informations_client: {
      titre: "Informations à communiquer par le client",
      contenu: "Vous vous engagez à nous communiquer l'ensemble des informations nécessaires à la réalisation de notre mission, notamment : {{nature_informations_client}}.\n\nVous confirmez la fiabilité, l'exhaustivité et l'exactitude des informations fournies.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 2400 §11 / NP 4410 §11",
      group: 'obligations',
    },
    referentiel_comptable: {
      titre: "Référentiel comptable",
      contenu: "",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 2300 §8",
      group: 'obligations',
    },
    forme_rapport: {
      titre: "Forme du rapport",
      contenu: "",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 2300 §8",
      group: 'obligations',
    },
  };

  const spec = specificSections[sectionId] || {};
  // OPT-22: cnoec_warning with reference and category
  const warningText = spec.cnoec_obligatoire
    ? `Section requise par ${spec.cnoec_reference || "le référentiel normatif"} pour les missions de type « ${config.categoryLabel} ».`
    : undefined;

  return {
    id: sectionId,
    titre: spec.titre || sectionId,
    contenu: spec.contenu || "",
    type: (spec.type || "fixed") as "fixed" | "conditional",
    editable: true,
    cnoec_obligatoire: spec.cnoec_obligatoire || false,
    cnoec_reference: spec.cnoec_reference,
    cnoec_warning: warningText,
    ordre: 99,
    group: spec.group || 'custom',
  };
}

export function buildSectionsForMissionType(missionTypeId: string): LMSection[] {
  const config = getMissionTypeConfig(missionTypeId);

  // 1. Start with GRIMY default sections as the base
  const allSections = [...GRIMY_DEFAULT_SECTIONS];

  // 2. Add specific sections required by this mission type if not already present
  for (const sectionId of config.requiredSections) {
    if (!allSections.find((s) => s.id === sectionId)) {
      allSections.push(createSpecificSection(sectionId, config));
    }
  }
  for (const sectionId of config.optionalSections) {
    if (!allSections.find((s) => s.id === sectionId)) {
      allSections.push(createSpecificSection(sectionId, config));
    }
  }

  // 3. Mark hidden/required sections for this mission type + assign groups
  const result = allSections.map((section) => ({
    ...section,
    hidden: config.hiddenSections.includes(section.id),
    cnoec_obligatoire: config.requiredSections.includes(section.id)
      ? true
      : section.cnoec_obligatoire,
  }));

  // 4. Inject mission-type-specific normative text
  const missionSection = result.find((s) => s.id === "mission");
  if (missionSection) missionSection.contenu = config.missionText;

  const natureLimite = result.find((s) => s.id === "nature_limite");
  if (natureLimite && config.natureLimiteText)
    natureLimite.contenu = config.natureLimiteText;

  const formeRapport = result.find((s) => s.id === "forme_rapport");
  if (formeRapport)
    formeRapport.contenu =
      "À l'issue de notre mission, nous émettrons : " +
      config.formeRapport +
      ".";

  const refComptable = result.find((s) => s.id === "referentiel_comptable");
  if (refComptable)
    refComptable.contenu =
      "Les comptes seront présentés conformément au référentiel comptable applicable : " +
      config.referentielApplicable +
      ".";

  // 5. Filter hidden and reorder
  return result
    .filter((s) => !s.hidden)
    .map((s, i) => ({ ...s, ordre: i + 1 }));
}

// ══════════════════════════════════════════════
// OPT-24: Default CGV for a specific mission type
// ══════════════════════════════════════════════

export function getDefaultCgvForMissionType(missionTypeId: string): string {
  const config = getMissionTypeConfig(missionTypeId);
  let cgv = GRIMY_DEFAULT_CGV;

  if (config.cgvSpecificClauses.length > 0) {
    const specificBlock = "\n\n15. Clauses spécifiques à la mission de type « " + config.shortLabel + " »\n" +
      config.cgvSpecificClauses.map((c, i) => `${String.fromCharCode(97 + i)}) ${c}`).join("\n");
    cgv += specificBlock;
  }

  return cgv;
}

// ══════════════════════════════════════════════
// OPT-25: Default repartition for a mission type
// ══════════════════════════════════════════════

export function getDefaultRepartitionForMissionType(missionTypeId: string): RepartitionRow[] {
  if (missionTypeId === 'audit_contractuel') {
    return [
      { id: "programme_audit", label: "Programme d'audit", cabinet: true, client: false, periodicite: "A" },
      { id: "phase_interimaire", label: "Phase intérimaire", cabinet: true, client: false, periodicite: "A" },
      { id: "phase_finale", label: "Phase finale (contrôle des comptes)", cabinet: true, client: false, periodicite: "A" },
      { id: "rapport_audit", label: "Rapport d'audit", cabinet: true, client: false, periodicite: "A" },
      { id: "declarations_ecrites", label: "Déclarations écrites de la direction", cabinet: false, client: true, periodicite: "A" },
      { id: "acces_documents", label: "Accès aux documents et informations", cabinet: false, client: true, periodicite: "P" },
      { id: "archives", label: "Conservation archives", cabinet: true, client: true, periodicite: "P" },
    ];
  }
  if (missionTypeId === 'attestation_particuliere') {
    return [
      { id: "collecte_info", label: "Collecte des informations objet de l'attestation", cabinet: false, client: true, periodicite: "ND" },
      { id: "procedures_verif", label: "Procédures de vérification", cabinet: true, client: false, periodicite: "ND" },
      { id: "attestation", label: "Émission de l'attestation", cabinet: true, client: false, periodicite: "ND" },
    ];
  }
  // Default: presentation-style repartition
  return [...GRIMY_DEFAULT_REPARTITION];
}

// ══════════════════════════════════════════════
// CRUD Supabase
// ══════════════════════════════════════════════

// OPT-16: Module-level cache for getModeles
const _modelesCache = new Map<string, { data: LMModele[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateModelesCache(cabinetId?: string) {
  if (cabinetId) _modelesCache.delete(cabinetId);
  else _modelesCache.clear();
}

export async function getModeles(cabinetId: string): Promise<LMModele[]> {
  const cached = _modelesCache.get(cabinetId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const { data, error } = await supabase
    .from("lm_modeles")
    .select("*")
    .eq("cabinet_id", cabinetId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("LM_MODELES", "getModeles error", error);
    throw error;
  }
  const result = (data ?? []) as LMModele[];
  _modelesCache.set(cabinetId, { data: result, ts: Date.now() });
  return result;
}

export async function getModeleById(id: string): Promise<LMModele> {
  const { data, error } = await supabase
    .from("lm_modeles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logger.error("LM_MODELES", "getModeleById error", error);
    throw error;
  }
  return data as LMModele;
}

export async function getDefaultModele(cabinetId: string): Promise<LMModele | null> {
  const { data, error } = await supabase
    .from("lm_modeles")
    .select("*")
    .eq("cabinet_id", cabinetId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    logger.error("LM_MODELES", "getDefaultModele error", error);
    throw error;
  }
  return (data as LMModele) ?? null;
}

export async function createModele(modele: Partial<LMModele>): Promise<LMModele> {
  const { data, error } = await supabase
    .from("lm_modeles")
    .insert({
      cabinet_id: modele.cabinet_id,
      nom: modele.nom ?? "Modèle standard",
      description: modele.description,
      mission_type: modele.mission_type ?? "presentation",
      sections: modele.sections ?? GRIMY_DEFAULT_SECTIONS,
      cgv_content: modele.cgv_content ?? GRIMY_DEFAULT_CGV,
      repartition_taches: modele.repartition_taches ?? GRIMY_DEFAULT_REPARTITION,
      is_default: modele.is_default ?? false,
      source: modele.source ?? "grimy",
      original_filename: modele.original_filename,
    })
    .select()
    .single();

  if (error) {
    logger.error("LM_MODELES", "createModele error", error);
    throw error;
  }
  invalidateModelesCache(modele.cabinet_id);
  return data as LMModele;
}

export async function updateModele(
  id: string,
  updates: Partial<Pick<LMModele, "nom" | "description" | "sections" | "cgv_content" | "repartition_taches" | "is_default">>
): Promise<LMModele> {
  const { data, error } = await supabase
    .from("lm_modeles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("LM_MODELES", "updateModele error", error);
    throw error;
  }
  invalidateModelesCache(); // cabinet_id not available here, clear all
  return data as LMModele;
}

// OPT-31: Prevent deleting default modeles
export async function deleteModele(id: string): Promise<void> {
  const modele = await getModeleById(id);
  if (modele.is_default) {
    throw new Error("Impossible de supprimer un modèle par défaut. Désignez d'abord un autre modèle comme défaut.");
  }
  const { error } = await supabase
    .from("lm_modeles")
    .delete()
    .eq("id", id);

  if (error) {
    logger.error("LM_MODELES", "deleteModele error", error);
    throw error;
  }
  invalidateModelesCache(modele.cabinet_id);
}

// OPT-30: Duplicate with proper metadata
export async function duplicateModele(id: string, newName: string): Promise<LMModele> {
  const original = await getModeleById(id);
  return createModele({
    cabinet_id: original.cabinet_id,
    nom: newName || `Copie de ${original.nom}`,
    description: `Copie de « ${original.nom} »`,
    mission_type: original.mission_type,
    sections: original.sections,
    cgv_content: original.cgv_content,
    repartition_taches: original.repartition_taches,
    is_default: false,
    source: "duplicate",
  });
}

// OPT-32: setAsDefault — the DB trigger handles unsetting other defaults
export async function setAsDefault(id: string, cabinetId: string): Promise<void> {
  const { error } = await supabase
    .from("lm_modeles")
    .update({ is_default: true })
    .eq("id", id)
    .eq("cabinet_id", cabinetId);

  if (error) {
    logger.error("LM_MODELES", "setAsDefault error", error);
    throw error;
  }
  invalidateModelesCache(cabinetId);
}

// ══════════════════════════════════════════════
// OPT-28: Count modeles by category
// ══════════════════════════════════════════════

export function countModelesByCategory(modeles: LMModele[]): Record<MissionCategory, number> {
  const counts: Record<MissionCategory, number> = {
    assurance_comptes: 0,
    autres_assurance: 0,
    sans_assurance: 0,
    activites: 0,
  };
  for (const m of modeles) {
    const config = getMissionTypeConfig(m.mission_type || 'presentation');
    counts[config.category] = (counts[config.category] || 0) + 1;
  }
  return counts;
}

// ══════════════════════════════════════════════
// OPT-29: Get modele usage count
// ══════════════════════════════════════════════

export async function getModeleUsageCount(modeleId: string): Promise<number> {
  const { count, error } = await supabase
    .from("lettres_mission")
    .select("id", { count: "exact", head: true })
    .eq("modele_id", modeleId);

  if (error) {
    logger.error("LM_MODELES", "getModeleUsageCount error", error);
    return 0;
  }
  return count ?? 0;
}

// ══════════════════════════════════════════════
// OPT-33: Export modele as JSON
// ══════════════════════════════════════════════

export function exportModeleAsJson(modele: LMModele): string {
  return JSON.stringify({
    nom: modele.nom,
    description: modele.description,
    mission_type: modele.mission_type,
    sections: modele.sections.map(({ id, titre, contenu, type, condition, editable, cnoec_obligatoire, cnoec_reference, cnoec_warning, ordre, group }) => ({
      id, titre, contenu, type, condition, editable, cnoec_obligatoire, cnoec_reference, cnoec_warning, ordre, group,
    })),
    cgv_content: modele.cgv_content,
    repartition_taches: modele.repartition_taches,
    source: modele.source,
    exported_at: new Date().toISOString(),
    version: "1.0",
  }, null, 2);
}

// ══════════════════════════════════════════════
// OPT-34: Import modele from JSON
// ══════════════════════════════════════════════

export async function importModeleFromJson(json: string, cabinetId: string): Promise<LMModele> {
  const parsed = JSON.parse(json);
  if (!parsed.nom || !Array.isArray(parsed.sections)) {
    throw new Error("Format JSON invalide : 'nom' et 'sections' requis.");
  }
  return createModele({
    cabinet_id: cabinetId,
    nom: `Import — ${parsed.nom}`,
    description: parsed.description || `Importé le ${new Date().toLocaleDateString("fr-FR")}`,
    mission_type: parsed.mission_type || "presentation",
    sections: parsed.sections,
    cgv_content: parsed.cgv_content || GRIMY_DEFAULT_CGV,
    repartition_taches: parsed.repartition_taches || GRIMY_DEFAULT_REPARTITION,
    is_default: false,
    source: "import_docx",
  });
}

// ══════════════════════════════════════════════
// Initialisation du modèle par défaut (OPT-35: idempotent)
// ══════════════════════════════════════════════

export async function initCabinetDefaultModele(cabinetId: string): Promise<LMModele> {
  // Check existing default first — prevents duplicate creation
  const existing = await getDefaultModele(cabinetId);
  if (existing) return existing;

  return createModele({
    cabinet_id: cabinetId,
    nom: "Modèle GRIMY standard",
    description: "Modèle conforme CNOEC — Guide « La lettre de mission, en pratique » (sept. 2022)",
    mission_type: "presentation",
    sections: GRIMY_DEFAULT_SECTIONS,
    cgv_content: GRIMY_DEFAULT_CGV,
    repartition_taches: GRIMY_DEFAULT_REPARTITION,
    is_default: true,
    source: "grimy",
  });
}

// ══════════════════════════════════════════════
// Créer un modèle par défaut pour un type de mission donné
// ══════════════════════════════════════════════

export async function createDefaultModeleForType(
  cabinetId: string,
  missionType: string
): Promise<LMModele> {
  const config = getMissionTypeConfig(missionType);
  const sections = buildSectionsForMissionType(missionType);

  return createModele({
    cabinet_id: cabinetId,
    nom: `Modèle ${config.shortLabel}`,
    description: `Modèle conforme ${config.normeRef} — ${config.label}`,
    mission_type: missionType,
    sections,
    cgv_content: getDefaultCgvForMissionType(missionType),
    repartition_taches: getDefaultRepartitionForMissionType(missionType),
    is_default: false,
    source: "grimy",
  });
}

// ══════════════════════════════════════════════
// Validation CNOEC (OPT-23: enhanced)
// ══════════════════════════════════════════════

export function validateCnoecCompliance(sections: LMSection[], missionType?: string): {
  valid: boolean;
  warnings: CnoecWarning[];
} {
  const warnings: CnoecWarning[] = [];

  // If mission type specified, validate against its required sections
  if (missionType) {
    const config = getMissionTypeConfig(missionType);
    for (const reqId of config.requiredSections) {
      const found = sections.find((s) => s.id === reqId);
      if (!found) {
        warnings.push({
          sectionId: reqId,
          reference: config.normeRef,
          message: `Section « ${reqId} » requise par ${config.normeRef} pour une mission de type « ${config.shortLabel} ».`,
          severity: "warning",
        });
      } else if (!found.contenu || found.contenu.trim().length === 0) {
        warnings.push({
          sectionId: reqId,
          reference: config.normeRef,
          message: `La section « ${found.titre} » est vide (requise par ${config.normeRef}).`,
          severity: "warning",
        });
      }
    }
    return { valid: warnings.length === 0, warnings };
  }

  // Fallback: validate against GRIMY default obligatory sections
  const obligatoireSections = GRIMY_DEFAULT_SECTIONS.filter((s) => s.cnoec_obligatoire);

  for (const required of obligatoireSections) {
    const found = sections.find((s) => s.id === required.id);

    if (!found) {
      warnings.push({
        sectionId: required.id,
        reference: required.cnoec_reference ?? "",
        message: required.cnoec_warning ?? `La section « ${required.titre} » est obligatoire.`,
        severity: "warning",
      });
      continue;
    }

    if (!found.contenu || found.contenu.trim().length === 0) {
      warnings.push({
        sectionId: required.id,
        reference: required.cnoec_reference ?? "",
        message: `La section « ${required.titre} » est vide. ${required.cnoec_warning ?? ""}`.trim(),
        severity: "warning",
      });
    }
  }

  return { valid: warnings.length === 0, warnings };
}
