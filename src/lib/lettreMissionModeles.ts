import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { MISSION_TYPES, getMissionTypeConfig } from "./lettreMissionTypes";
import type { MissionTypeConfig } from "./lettreMissionTypes";

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

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
}

export interface LMModele {
  id: string;
  cabinet_id: string;
  nom: string;
  description?: string;
  mission_type?: string;
  sections: LMSection[];
  cgv_content: string;
  repartition_taches: any[];
  is_default: boolean;
  source: "grimy" | "import_docx" | "duplicate";
  original_filename?: string;
  created_at: string;
  updated_at: string;
}

export interface CnoecWarning {
  sectionId: string;
  reference: string;
  message: string;
  severity: "warning";
}

// ══════════════════════════════════════════════
// Modèle GRIMY par défaut — Sections
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
  },
  {
    id: "annexe_repartition",
    titre: "Annexe — Répartition des travaux",
    contenu: "TABLEAU_REPARTITION",
    type: "fixed",
    editable: false,
    cnoec_obligatoire: false,
    ordre: 19,
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
  },
];

// ══════════════════════════════════════════════
// CGV par défaut — conforme CNOEC
// ══════════════════════════════════════════════

export const GRIMY_DEFAULT_CGV = `Conditions générales d'intervention en vigueur au 15 mars 2026

1. Domaine d'application
Les présentes conditions sont applicables aux conventions portant sur les missions conclues entre notre société d'expertise comptable et son client.

2. Définition de la mission
Les travaux incombant au professionnel sont détaillés dans la lettre de mission et ses annexes. La mission sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable (décret n°2012-432 du 30 mars 2012), de la Norme Professionnelle de Maîtrise de la Qualité (NPMQ), et de la norme professionnelle applicable à la mission de présentation des comptes (NP 2300).

3. Résiliation de la mission
La mission sera tacitement renouvelée chaque année. Le client ou le professionnel peut y mettre fin par lettre recommandée dans un délai de 3 mois avant la fin de la période en cours.
Pour les clients ayant la qualité de consommateur ou de non-professionnel au sens de l'article liminaire du Code de la consommation : conformément à l'article L 215-1 du Code de la consommation, le professionnel informera le client par écrit, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat. À défaut, le client pourra mettre gratuitement un terme au contrat à tout moment à compter de la date de reconduction.

4. Suspension de la mission
Les délais de délivrance sont prolongés pour une durée égale à celle de la suspension.

5. Obligations du professionnel
Le professionnel effectue la mission conformément au Code de déontologie et aux normes NPMQ et NP 2300. Le responsable de la mission est un expert-comptable inscrit au tableau de l'Ordre, qui apporte personnellement son concours à la mission (NPMQ §30). Secret professionnel et discrétion assurés.

6. Obligations du client
Le client s'engage à fournir les documents d'identification KYC (CNI, Kbis, BE), à mettre à disposition les pièces comptables dans les délais, et à porter à connaissance tout fait nouveau. Le client reste responsable à l'égard des tiers de l'exhaustivité, de la fiabilité et de l'exactitude des informations comptables et financières concourant à la présentation des comptes (NP 2300 §8).

7. Honoraires
Les honoraires sont payés par prélèvement à leur échéance. Pénalités de retard au taux BCE + 10 points. Indemnité forfaitaire de 40 € pour frais de recouvrement.
Les honoraires sont révisables annuellement selon l'évolution de l'indice des prix hors taxes relatifs aux services comptables publié par l'INSEE. À défaut de publication de cet indice, les honoraires seront révisés avec un minimum forfaitaire de 3 % par an.
Conformément à l'article 24 de l'ordonnance du 19 septembre 1945 modifié par la loi PACTE, les missions relevant de la prérogative d'exercice exclusive ne peuvent donner lieu à des honoraires complémentaires de succès.

8. Responsabilité civile
Couverte par contrat MMA IARD. Prescription réduite à 1 an. Cet aménagement ne s'applique pas lorsque le client a la qualité de consommateur ou de non-professionnel au sens du Code de la consommation ; les délais de prescription de droit commun s'appliquent alors (article L 218-1 du Code de la consommation).

9. Clause résolutoire
Conformément aux dispositions de l'article 1225 du Code civil, en cas d'inexécution par le client de l'une des obligations visées à la lettre de mission (transmission des documents, paiement des honoraires, fourniture des informations LCB-FT), le contrat pourra être résolu de plein droit, après mise en demeure restée infructueuse pendant un délai de trente (30) jours, sans préjudice des honoraires dus pour les travaux déjà effectués.

10. Données personnelles
Traitement conforme RGPD. Conservation 5 ans après fin de mission.

11. Conservation des données LCB-FT
Le cabinet collecte des données d'identification pour respecter ses obligations LCB-FT. Il conserve pendant cinq (5) ans à compter de la fin de la relation d'affaires les documents relatifs à l'identité des clients, personnes agissant pour leur compte et bénéficiaires effectifs (art. L 561-12 CMF), et pendant cinq (5) ans à compter de leur exécution les documents relatifs aux opérations (art. L 561-10-2 CMF). Ces données peuvent être communiquées aux autorités compétentes.

12. Non-sollicitation des collaborateurs
Le client s'interdit tout acte de nature à porter atteinte à l'indépendance du professionnel ou de ses collaborateurs, notamment en s'abstenant de leur faire toutes offres d'exécuter des missions en leur nom propre ou de devenir salarié du client, pendant la durée du contrat et pendant douze (12) mois suivant la fin de la mission.

13. Différends
En cas de contestation des conditions d'exercice de la mission ou de différend sur les honoraires, les parties s'engagent, préalablement à toute action en justice, à saisir le président du CROEC compétent aux fins de conciliation ou d'arbitrage (art. 160 décret du 30 mars 2012). Pour les clients consommateurs, le recours à un médiateur de la consommation est proposé (art. L 611-1 et s. C. conso). Tribunal de commerce compétent.`;

// ══════════════════════════════════════════════
// Répartition des tâches par défaut
// ══════════════════════════════════════════════

export const GRIMY_DEFAULT_REPARTITION = [
  { id: "saisie", label: "Saisie des écritures comptables", cabinet: true, client: false, periodicite: "Mensuel" },
  { id: "pointage", label: "Pointage et lettrage des comptes", cabinet: true, client: false, periodicite: "Mensuel" },
  { id: "rapprochement", label: "Rapprochement bancaire", cabinet: true, client: false, periodicite: "Mensuel" },
  { id: "tva", label: "Déclaration de TVA", cabinet: true, client: false, periodicite: "Mensuel" },
  { id: "classement", label: "Classement des pièces justificatives", cabinet: false, client: true, periodicite: "Permanent" },
  { id: "factures", label: "Émission des factures clients", cabinet: false, client: true, periodicite: "Permanent" },
  { id: "relances", label: "Relances clients / suivi créances", cabinet: false, client: true, periodicite: "Permanent" },
  { id: "inventaire", label: "Inventaire physique des stocks", cabinet: false, client: true, periodicite: "Annuel" },
  { id: "bilan", label: "Établissement du bilan et compte de résultat", cabinet: true, client: false, periodicite: "Annuel" },
  { id: "liasse", label: "Établissement de la liasse fiscale", cabinet: true, client: false, periodicite: "Annuel" },
  { id: "plaquette", label: "Plaquette annuelle de présentation des comptes", cabinet: true, client: false, periodicite: "Annuel" },
  { id: "ag", label: "Procès-verbaux d'assemblée générale", cabinet: true, client: false, periodicite: "Annuel" },
];

// ══════════════════════════════════════════════
// Build sections for a specific mission type
// ══════════════════════════════════════════════

function createSpecificSection(sectionId: string, config: MissionTypeConfig): LMSection {
  const specificSections: Record<string, Partial<LMSection>> = {
    equipe_audit: {
      titre: "Composition de l'équipe d'audit",
      contenu: "L'équipe d'audit sera composée de :\n{{composition_equipe}}\n\nSi certains membres ne pouvaient intervenir, nous mettrions à votre disposition des intervenants de compétences comparables.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "ISA 210 §10",
    },
    planning_audit: {
      titre: "Planning d'intervention",
      contenu: "Le planning prévisionnel d'intervention est le suivant :\n{{planning_audit}}\n\nCe planning pourra être ajusté en fonction des contraintes opérationnelles.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "ISA 210 §10",
    },
    declarations_ecrites: {
      titre: "Déclarations écrites",
      contenu: "Conformément à la norme ISA 580, nous vous demanderons de nous fournir des déclarations écrites confirmant certaines des déclarations faites au cours de l'audit, notamment sur l'exhaustivité des informations fournies et la reconnaissance de votre responsabilité dans l'établissement des états financiers.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "ISA 210 §10",
    },
    objet_attestation: {
      titre: "Objet de l'attestation",
      contenu: "L'attestation portera sur l'information suivante : {{objet_attestation}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3100 §15",
    },
    nature_travaux_attestation: {
      titre: "Nature des travaux",
      contenu: "La nature de nos travaux comprend : {{nature_travaux_attestation}}.\n\nParticipation du responsable de mission à l'élaboration de l'information : {{participation_elaboration}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3100 §15",
    },
    utilisation_prevue: {
      titre: "Utilisation prévue des informations",
      contenu: "L'utilisation prévue des informations prévisionnelles est : {{utilisation_prevue}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3400 §11",
    },
    destinataires_info: {
      titre: "Destinataires",
      contenu: "Les destinataires des informations sont : {{destinataires_info}}.\nType de diffusion : {{type_diffusion}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3400 §11",
    },
    nature_hypotheses: {
      titre: "Nature des hypothèses",
      contenu: "Les hypothèses retenues sont de nature : {{nature_hypotheses}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3400 §11",
    },
    periode_couverte: {
      titre: "Période couverte",
      contenu: "Les informations prévisionnelles couvrent la période du {{periode_debut_prev}} au {{periode_fin_prev}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 3400 §11",
    },
    contexte_mission: {
      titre: "Contexte de la mission",
      contenu: "Le contexte de la mission est : {{contexte_mission}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 4400 §11",
    },
    informations_examinees: {
      titre: "Informations examinées",
      contenu: "Les informations sur lesquelles portent les procédures sont : {{informations_examinees}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 4400 §11",
    },
    procedures_detail: {
      titre: "Procédures à mettre en œuvre",
      contenu: "Les procédures définies d'un commun accord sont les suivantes :\n{{procedures_detail}}",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 4400 §11",
    },
    calendrier_procedures: {
      titre: "Calendrier",
      contenu: "Le calendrier des procédures est : {{calendrier_procedures}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 4400 §11",
    },
    diffusion_rapport: {
      titre: "Limites de diffusion du rapport",
      contenu: "La diffusion du rapport est limitée à : {{diffusion_rapport}}.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 4400 §11",
    },
    informations_client: {
      titre: "Informations à communiquer par le client",
      contenu: "Vous vous engagez à nous communiquer l'ensemble des informations nécessaires à la réalisation de notre mission, notamment : {{nature_informations_client}}.\n\nVous confirmez la fiabilité, l'exhaustivité et l'exactitude des informations fournies.",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 2400 §11 / NP 4410 §11",
    },
    referentiel_comptable: {
      titre: "Référentiel comptable",
      contenu: "",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 2300 §8",
    },
    forme_rapport: {
      titre: "Forme du rapport",
      contenu: "",
      type: "fixed",
      cnoec_obligatoire: true,
      cnoec_reference: "NP 2300 §8",
    },
  };

  const spec = specificSections[sectionId] || {};
  return {
    id: sectionId,
    titre: spec.titre || sectionId,
    contenu: spec.contenu || "",
    type: (spec.type || "fixed") as "fixed" | "conditional",
    editable: true,
    cnoec_obligatoire: spec.cnoec_obligatoire || false,
    cnoec_reference: spec.cnoec_reference,
    cnoec_warning: spec.cnoec_obligatoire
      ? `Section requise par ${spec.cnoec_reference || "le référentiel normatif"}`
      : undefined,
    ordre: 99,
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

  // 3. Mark hidden/required sections for this mission type
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
    .filter((s) => !(s as any).hidden)
    .map((s, i) => ({ ...s, ordre: i + 1 }));
}

// ══════════════════════════════════════════════
// CRUD Supabase
// ══════════════════════════════════════════════

export async function getModeles(cabinetId: string): Promise<LMModele[]> {
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
  return (data ?? []) as LMModele[];
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
  return data as LMModele;
}

export async function deleteModele(id: string): Promise<void> {
  const { error } = await supabase
    .from("lm_modeles")
    .delete()
    .eq("id", id);

  if (error) {
    logger.error("LM_MODELES", "deleteModele error", error);
    throw error;
  }
}

export async function duplicateModele(id: string, newName: string): Promise<LMModele> {
  const original = await getModeleById(id);
  return createModele({
    cabinet_id: original.cabinet_id,
    nom: newName,
    description: `Copie de « ${original.nom} »`,
    sections: original.sections,
    cgv_content: original.cgv_content,
    repartition_taches: original.repartition_taches,
    is_default: false,
    source: "duplicate",
  });
}

export async function setAsDefault(id: string, cabinetId: string): Promise<void> {
  // The DB trigger ensure_single_default_lm_modele handles unsetting other defaults
  const { error } = await supabase
    .from("lm_modeles")
    .update({ is_default: true })
    .eq("id", id)
    .eq("cabinet_id", cabinetId);

  if (error) {
    logger.error("LM_MODELES", "setAsDefault error", error);
    throw error;
  }
}

// ══════════════════════════════════════════════
// Initialisation du modèle par défaut
// ══════════════════════════════════════════════

export async function initCabinetDefaultModele(cabinetId: string): Promise<LMModele> {
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
    cgv_content: GRIMY_DEFAULT_CGV,
    repartition_taches: GRIMY_DEFAULT_REPARTITION,
    is_default: false,
    source: "grimy",
  });
}

// ══════════════════════════════════════════════
// Validation CNOEC
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
