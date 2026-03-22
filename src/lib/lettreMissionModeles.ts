import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { formatDateFr } from "./dateUtils";
import { MISSION_TYPES, getMissionTypeConfig, CLIENT_TYPES, CLIENT_TYPE_CATEGORIES } from "./lettreMissionTypes";
import type { MissionTypeConfig, MissionCategory, ClientTypeCategory } from "./lettreMissionTypes";
import { getSmartMissionText } from "./lmSmartDefaults";

// ══════════════════════════════════════════════
// OPT-42/48: Sanitization helpers
// ══════════════════════════════════════════════

/** Strip <script> tags from text to prevent XSS in HTML previews */
function stripScripts(text: string): string {
  if (!text) return "";
  return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

// ══════════════════════════════════════════════
// OPT-49: Sensitive content detection
// ══════════════════════════════════════════════

const SENSITIVE_PATTERNS = [
  /\b(?:password|mot_de_passe|api[_-]?key|secret[_-]?key|token)\s*[:=]/i,
  /\b(?:sk_live|pk_live|sk_test|pk_test)_[a-zA-Z0-9]+/,
  /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/,
];

function checkSensitiveContent(text: string): string[] {
  const warnings: string[] = [];
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push(`Contenu potentiellement sensible détecté (${pattern.source.slice(0, 30)}...)`);
    }
  }
  return warnings;
}

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
  client_type_id?: string; // ID de CLIENT_TYPES (ex: 'sas_is', 'sci_ir', 'lmnp')
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
      "À l'attention de {{formule_politesse}} {{dirigeant}},\nMandataire social de la société\n{{forme_juridique}} {{raison_sociale}}\n\n{{adresse}}\n{{code_postal}} {{ville}}",
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
      "Organisation et transmission des documents comptables :\n▪ Périodicité : {{frequence}} – Avant le J+10\n▪ Transmission via notre outil : {{outil_transmission}}",
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
      "La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable et des dispositions de la norme professionnelle du Conseil Supérieur de l'Ordre des Experts-Comptables applicable à la mission de présentation de comptes et des textes légaux et réglementaires applicables aux professionnels de l'expertise comptable que nous sommes tenus de respecter.\n\nNos relations contractuelles seront régies tant par les termes de cette lettre de mission que par les Conditions Générales d'Intervention ci-jointes. À cet effet, nous nous permettons de rappeler les points suivants :\n\nLa mission de présentation des comptes ne constitue ni un audit ni un examen limité des comptes de votre entreprise ;\n\nIls ne comportent ni le contrôle de la matérialité des opérations ni le contrôle des inventaires physiques des actifs de votre entreprise à la clôture de l'exercice comptable (stocks, immobilisations, espèces en caisse notamment) ;\n\nIls n'ont pas pour objectif de déceler les fraudes ou les actes illégaux pouvant ou ayant existé dans votre entreprise. Toutefois, nous vous en informerions si nous étions conduits à en avoir connaissance.\n\nNous nous permettons d'attirer votre attention sur le fait que conformément à l'article L 123-14 du Code de commerce, les comptes annuels doivent être réguliers, sincères et donner une image fidèle du patrimoine, de la situation financière et du résultat de votre entité. Vous restez ainsi responsables à l'égard des tiers de l'exhaustivité, de la fiabilité et de l'exactitude des informations comptables et financières concourant à la présentation des comptes ainsi que des procédures de contrôle interne concourant à l'élaboration de ces comptes. Cela implique notamment le respect des règles applicables à la tenue d'une comptabilité en France et du référentiel comptable applicable à votre secteur d'activité.\n\nNous comptons sur votre entière coopération afin qu'il soit mis à notre disposition dans un délai raisonnable tous les documents et autres informations nécessaires qui nous permettront de mener à bien notre mission. Les pièces comptables devront notamment être mises à la disposition du collaborateur en charge du dossier cinq jours ouvrés minimum avant la date de télétransmission de la déclaration de TVA.\n\nDans le cadre de cette mission, votre expert-comptable apportera personnellement son concours à la mission en suivant attentivement votre entreprise.",
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
      "Notre mission consiste à exprimer une opinion sur la cohérence et la vraisemblance des comptes de votre entité. Cette mission n'a pas pour objectif de déceler des actes illégaux ou autres irrégularités pouvant ou ayant eu lieu dans votre entité.\n\nNous vous précisons que nous sommes juridiquement redevables d'une simple obligation de moyens. Par conséquent, la vérification des écritures et leur rapprochement avec les pièces justificatives sont effectués par notre cabinet uniquement par épreuves, et ne portent donc pas sur l'appréciation de la légalité et de la fiabilité des documents présentés.",
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
    contenu: "Conformément aux articles L.561-1 et suivants du Code monétaire et financier, notre cabinet est assujetti aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT).\n\nDans le cadre de ces obligations, nous procédons notamment à :\n▪ L'identification et la vérification de l'identité du client et, le cas échéant, du bénéficiaire effectif ;\n▪ Le recueil d'informations sur l'objet et la nature de la relation d'affaires ;\n▪ L'exercice d'une vigilance constante sur la relation d'affaires.\n\nNiveau de vigilance appliqué à votre dossier : {{niv_vigilance}}\nScore de risque : {{score_global}} / 120\nStatut PPE : {{ppe}}\nDate de dernière revue KYC : {{date_derniere_revue}}\nDate de prochaine revue KYC : {{date_butoir}}\n\nConformément à l'art. L.561-12 CMF, l'ensemble des pièces d'identification est conservé pendant cinq (5) ans à compter de la fin de la relation d'affaires.\n\nEn cas de soupçon, le cabinet est tenu de procéder à une déclaration de soupçon auprès de Tracfin (art. L.561-15 CMF).",
    type: "fixed",
    editable: true,
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
      "La mission sociale est conclue pour une durée correspondant à la mission comptable et nos travaux consisteront à :\n\nÉtablir les bulletins de salaire dans un délai de trois jours ouvrés à compter de la réception des éléments transmis ;\n\nÉtablir, télétransmettre et télé-payer les déclarations sociales périodiques liées (déclarations mensuelles ou trimestrielles et déclarations annuelles) ;\n\nTenir le journal des salaires ;\n\nMettre à disposition de l'entité, qui en assurera la conservation, les documents et états liés au traitement de la paie et des déclarations y afférentes ;\n\nFournir les données d'archivage ;\n\nAssurer la gestion administrative d'évènements occasionnels courants tels que les entrées et sorties de salariés, les arrêts maladie ou maternité, les accidents du travail.\n\nIl est rappelé que le cabinet n'a aucun lien direct avec les salariés de l'employeur. Ce dernier conserve la gestion et la formalisation de ses relations avec son personnel. En aucun cas le cabinet ne se substitue au pouvoir de direction de l'employeur. Sauf délégation particulière, l'employeur est le seul interlocuteur du cabinet.\n\nNous attirons enfin votre attention sur le fait que le code du travail fait obligation à tout employeur de tenir à jour au siège social et, le cas échéant, dans chaque établissement secondaire :\n— le registre des entrées et sorties du personnel quel que soit l'effectif salarié ;\n— le registre médical comprenant tous les documents relatifs à la médecine du travail et notamment les fiches d'aptitudes ;\n— le registre des délégués du personnel (pour les sociétés assujetties à l'obligation d'avoir des représentants du personnel) ;\n— les accusés réception des déclarations unique d'embauche ;\n— les doubles des bulletins de salaire ;\n— un éventuel registre des saisies arrêt sur salaire ;\n— le récépissé de déclaration CNIL pour le traitement automatisé de la paie ;\n— un registre de mise en demeure de l'inspection du travail.\n\nToutefois, nous vous rappelons qu'il vous appartient de nous adresser préalablement à toute embauche les éléments nécessaires à l'établissement de la DPAE. A défaut, nous ne pourrions les faire pour vous. Cette déclaration doit être faite auprès des services de l'URSSAF avant la prise de fonction effective du salarié et au plus tôt 8 jours avant l'embauche.\n\nDe plus, les employeurs doivent communiquer au moins 48 heures avant l'embauche les documents autorisant les ressortissants étrangers hors EU à travailler en France auprès des services compétents de la Préfecture ayant délivrés ces documents.\n\nIl convient donc de nous adresser les documents et informations nécessaire au moins 2 jours avant la date prévisible d'embauche pour les ressortissants français et EU et au moins 4 jours avant la date prévisible d'embauche pour les ressortissants d'autres pays.\n\nNous insistons sur le fait que le non-respect de ces procédures constitue un délit.",
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
      "Dans le cadre de cette mission, nous vous assisterons à chaque étape de la procédure de contrôle et notamment dans la préparation et la transmission des documents demandés et par notre présence aux différents entretiens avec les agents de l'administration fiscale. Nous participerons à la rédaction des réponses aux propositions de rectification et vous conseillerons, si la procédure le nécessite, sur l'opportunité de faire intervenir un avocat fiscaliste.\n\nAfin de mutualiser le risque et le coût que devrait supporter votre entreprise, nous mettons en place une garantie prenant en charge nos honoraires de défense fiscale. Ce dispositif comprend deux options :\n\n☐ Couverture de nos prestations dans la limite de 5 000 € HT par année civile moyennant un coût mensuel de 25 € HT ;\n\n☐ Couverture de nos prestations dans la limite de 2 500 € HT par année civile moyennant un coût mensuel de 10 € HT.\n\nSi vous ne souhaitez pas opter pour la mutualisation, les honoraires d'assistance au contrôle fiscal vous seront facturés en fonction du temps passé.\n\nCette mission d'assistance au contrôle fiscal ne soumet le professionnel de l'expertise-comptable à aucune obligation de résultat. La facturation et le règlement des honoraires, quelle que soit l'option choisie par le client, ne sauraient donc être subordonnés à l'absence de redressement fiscal.",
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
      "Nos relations seront réglées sur le plan juridique par les termes de cette lettre, les conditions générales et le tableau de répartition des obligations respectives (voir annexes). Tout aménagement significatif fera l'objet d'un avenant.",
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
      "TABLEAU_HONORAIRES\n\nLes honoraires annuels de la mission comptable s'élèvent à {{honoraires}} € HT.\n\n{{bloc_honoraires_sociale}}{{bloc_honoraires_juridique}}{{bloc_honoraires_controle_fiscal}}Les frais de constitution du dossier s'élèvent à {{setup}}.\n\nLa facturation est effectuée selon une périodicité {{frequence_facturation}}. Le règlement s'effectue par {{mode_paiement}}.\n\nLes honoraires prévus au présent contrat seront révisables annuellement à la date anniversaire de la lettre de mission, selon l'évolution de l'indice des prix hors taxes relatifs aux services comptables publié par l'INSEE (référence : Indice des prix de production des services aux entreprises — Services comptables). La formule de révision est : Honoraires révisés = Honoraires d'origine × (dernier indice publié / indice de référence à la date de signature). À défaut de publication de cet indice, les honoraires seront révisés avec un minimum forfaitaire de 3 % par an.\n\nConformément à l'article 24 de l'ordonnance du 19 septembre 1945 modifié par la loi PACTE, les missions relevant de la prérogative d'exercice exclusive (tenue de comptabilité, révision comptable, présentation des comptes) ou participant à l'établissement de l'assiette fiscale ou sociale du client ne peuvent donner lieu à des honoraires complémentaires de succès.",
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
      "Nous vous serions obligés de bien vouloir nous retourner un exemplaire de la présente et des annexes jointes, revêtues d'un paraphe sur chacune des pages et de votre signature sur la dernière page.\n\nNous vous prions de croire, {{formule_politesse}} {{dirigeant}}, à nos sentiments dévoués.\n\nFait à {{ville_cabinet}}, le {{date_du_jour}}\n\nL'Expert-comptable                    Le Client\n{{associe}}                            {{dirigeant}}",
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
      "⚠ TRAVAIL DISSIMULÉ — Pénalités très lourdes et récemment aggravées\nEntraîne : sanctions civiles et pénales (prison avec sursis), contrôle fiscal.\nSi vous devez employer une personne, ne serait-ce qu'une minute, il faut préalablement la déclarer.\n\nJe soussigné(e) {{genre}} {{dirigeant}}, agissant en qualité de mandataire de la société {{raison_sociale}}, immatriculée au Registre du Commerce des Sociétés sous le n° {{siren}} et dont le siège social est situé {{adresse}}, {{code_postal}} {{ville}} :\n\nAtteste sur l'honneur, en application des articles L.8222-1, L.8222-2, D.8222-5 et R.8222-1 du Code du Travail et de l'article 46 du Code des Marchés Publics :\n▪ Avoir immatriculé mon entreprise au Registre du Commerce des Sociétés.\n▪ Employer régulièrement tous mes salariés au regard des articles L.1221-10, L.3243-2 et R.3243-1.\n▪ Ne pas employer de salariés étrangers démunis du titre les autorisant à exercer une activité salariée.\n\nM'engage à ce que ma société respecte ces obligations pendant toute la durée de nos relations contractuelles et à en justifier tous les 6 mois ou à tout moment sur demande.\n\nCommunique en annexe les documents suivants :\n▪ Extrait K-bis de moins de 3 mois\n▪ Attestation de versement de cotisations de moins de 6 mois (si marchés publics)",
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
      "En signant ce formulaire de mandat, vous autorisez {{nom_cabinet}} à envoyer des instructions à votre banque pour débiter votre compte conformément aux instructions de {{nom_cabinet}}. Vous bénéficiez du droit d'être remboursé par votre banque selon les conditions de la convention que vous avez passée avec elle. Une demande de remboursement doit être présentée dans les 8 semaines suivant la date de débit.\n\nVotre nom : {{raison_sociale}}\nVotre adresse : {{adresse}}, {{code_postal}} {{ville}}\nVotre pays : France\nCoordonnées bancaires (IBAN) : {{iban}}\nBIC : {{bic}}\nNom du créancier : {{nom_cabinet}}\nIdentification du créancier (ICS) : {{cabinet_ics}}\nAdresse du créancier : {{cabinet_adresse}}\nType de paiement : Paiement récurrent/répétitif\n\nVos droits concernant le mandat ci-dessus sont expliqués dans un document que vous pouvez obtenir auprès de votre banque.",
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
      "Dénomination de l'Entreprise : {{raison_sociale}}\nAdresse : {{adresse}}, {{code_postal}} {{ville}}\nSiren : {{siren}}\nForme Sociale : {{forme_juridique}}\n\nReprésentée par {{genre}} {{dirigeant}}, mandataire social ayant tous pouvoirs à cet effet, déclare autoriser :\n\n{{nom_cabinet}} — {{cabinet_adresse}}\n\nà télétransmettre chaque année sur le portail jedéclare.com, à destination de la Banque, la liasse fiscale qui la concerne (ensemble des formulaires fiscaux dûment renseignés répondant à l'obligation de déclaration annuelle d'activité de l'entreprise).\n\nCette autorisation est donnée pour la durée de la mission et peut être révoquée à tout moment par lettre recommandée avec accusé de réception.",
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
Les présentes conditions générales d'intervention sont applicables aux conventions portant sur les missions conclues entre notre société d'expertise comptable COMPTADEC et son client. Elles font partie intégrante du contrat. Si l'une quelconque des dispositions des présentes conditions générales est déclarée nulle ou inapplicable, les autres dispositions resteront en vigueur. Sauf modification notifiée par le professionnel comptable, la version applicable est celle qui est en vigueur au jour de la signature de la lettre de mission.

2. Définition de la mission
Les travaux incombant au professionnel de l'expertise comptable sont strictement limités à ceux détaillés dans la lettre de mission et ses annexes. La mission sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable et des dispositions de la norme professionnelle du Conseil Supérieur de l'Ordre des Experts-Comptables applicable à la mission concernée et des textes légaux et réglementaires applicables aux professionnels de l'expertise comptable que nous sommes tenus de respecter. Toute mission complémentaire qui viendrait à être confiée au professionnel fera l'objet d'un avenant ou d'une nouvelle lettre de mission.

3. Résiliation de la mission
La mission sera tacitement reconduite chaque année. Le client ou le professionnel peut y mettre fin par lettre recommandée dans un délai de trois (3) mois avant la fin de la période en cours. Conformément à l'article L 215-1 du Code de la consommation, le professionnel informera le client par écrit, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat.

En cas de résiliation, le professionnel a droit à des honoraires au titre des travaux professionnels effectués, complétés le cas échéant par une indemnité conventionnelle en compensation du préjudice subi. Le client pourra également résilier de plein droit le contrat en cas de manquement du professionnel à ses obligations essentielles, après mise en demeure restée sans effet pendant un délai de trente (30) jours.

4. Suspension de la mission
En cas de suspension de la mission pour quelque cause que ce soit, les délais de délivrance des travaux sont prolongés pour une durée égale à celle de la suspension. Les dispositions de la lettre de mission et des présentes conditions générales restent applicables pendant la durée de la suspension.

5. Obligations du professionnel
Le professionnel effectue la mission qui lui est confiée conformément aux dispositions du Code de déontologie des professionnels de l'expertise comptable, de la Norme Professionnelle de Maîtrise de la Qualité (NPMQ) et de la norme professionnelle applicable au type de mission concerné.

Le professionnel est soumis aux obligations relatives à la lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT) conformément aux articles L.561-1 et suivants du Code monétaire et financier.

Le professionnel de l'expertise comptable et ses collaborateurs sont tenus au secret professionnel au sens des articles 226-13 et 226-14 du Code pénal, conformément à l'article 147 du Code de déontologie. Ils sont également astreints à une obligation de discrétion pour tous les faits, actes et renseignements dont ils ont pu avoir connaissance en raison de leurs fonctions.

Le responsable de la mission est un expert-comptable inscrit au tableau de l'Ordre, qui apporte personnellement son concours à la mission et en garantit la bonne réalisation au nom de la structure d'exercice (NPMQ §30).

6. Obligations du client
Le client s'interdit tout acte de nature à porter atteinte à l'indépendance du professionnel ou de ses collaborateurs, notamment en s'abstenant de leur faire toutes offres de mission ou d'emploi, pendant la durée du contrat et pendant les douze (12) mois suivant la fin de la mission.

Conformément aux obligations de vigilance LCB-FT, le client fournit au cabinet les documents d'identification suivants :
— Pour les personnes physiques : pièce d'identité officielle en cours de validité (CNI, passeport), justificatif de domicile de moins de 3 mois ;
— Pour les personnes morales : extrait Kbis de moins de 3 mois, statuts à jour, liste des bénéficiaires effectifs, composition du capital et des organes de direction ;
— Le client s'engage à mettre à jour ces documents sans délai en cas de changement de situation.

Le client s'engage à mettre à la disposition du cabinet, dans les délais convenus, l'ensemble des documents et informations nécessaires à l'exécution de la mission. Il s'engage à effectuer les travaux qui lui incombent conformément au tableau de répartition annexé à la lettre de mission et dans le respect du planning convenu.

Le client porte sans délai à la connaissance du cabinet tout fait nouveau susceptible d'affecter l'exécution de la mission. Il confirme par écrit, sur demande du cabinet, les informations qu'il a fournies oralement et vérifie les documents de synthèse produits par le cabinet.

Le non-respect par le client de ses obligations au titre du présent article constitue une cause légitime de suspension ou de résiliation de la mission, sans indemnité.

7. Honoraires et conditions de règlement
Les honoraires sont librement convenus entre les parties conformément à l'article 24 de l'ordonnance du 19 septembre 1945. Des provisions sur honoraires pourront être demandées. Les honoraires sont payés par prélèvement automatique à leur échéance. Aucun escompte n'est accordé en cas de paiement anticipé.

En cas de retard de paiement, des pénalités seront exigibles de plein droit, sans mise en demeure préalable, au taux d'intérêt de la Banque Centrale Européenne majoré de 10 points (art. L 441-10 du Code de commerce). Une indemnité forfaitaire pour frais de recouvrement de 40 euros sera due (art. D 441-5 du Code de commerce). Toute contestation d'une facture devra être portée à la connaissance du cabinet dans un délai de 30 jours à compter de sa réception.

Le non-paiement des honoraires à leur échéance pourra entraîner la suspension de la mission. En cas de changement de facturation lié à une évolution du dossier, le client en sera informé préalablement.

En cas de transfert du dossier à un confrère, le professionnel dispose d'un droit de rétention des documents, limité aux documents qu'il a lui-même établis, conformément à l'article 168 du Code de déontologie. Le règlement d'une facture vaut acceptation des prestations correspondantes.

8. Responsabilité civile professionnelle
Le cabinet est assuré en responsabilité civile professionnelle auprès de MMA IARD, contrat n° 118 269 730, dont le siège social est sis 14 boulevard Marie et Alexandre Oyon, 72030 Le Mans Cedex 9. La couverture s'applique aux interventions réalisées sur le territoire français.

Sont exclues de la garantie les conséquences dommageables résultant : d'informations erronées ou incomplètes fournies par le client ; du retard du client dans la transmission des documents nécessaires ; des fautes commises par des tiers non mandatés par le cabinet.

La prescription applicable aux actions en responsabilité est réduite à un (1) an conformément à l'article 2254 du Code civil. Cet aménagement conventionnel ne s'applique pas lorsque le client a la qualité de consommateur ou de non-professionnel au sens du Code de la consommation. Le client dispose d'un délai de forclusion de trois (3) mois à compter de la remise des documents pour formuler toute réclamation auprès de COMPTADEC.

9. Données personnelles
Le cabinet agit en qualité de responsable de traitement au sens de la loi n° 78-17 du 6 janvier 1978 modifiée et du Règlement (UE) 2016/679 du 27 avril 2016 (RGPD). Le cabinet met en oeuvre les mesures techniques et organisationnelles appropriées pour assurer la sécurité des données personnelles.

En cas de violation de données à caractère personnel, le cabinet notifie l'autorité de contrôle compétente (CNIL) dans un délai de 72 heures conformément à l'article 33 du RGPD. Les sous-traitants éventuels sont soumis aux mêmes obligations de confidentialité et de sécurité.

Les données sont traitées pour les finalités suivantes : exécution de la mission, respect des obligations légales et professionnelles, gestion de la relation commerciale. Le cabinet agit sur les instructions du client et assure la confidentialité des données traitées.

Les personnes concernées disposent d'un droit d'accès, de rectification, d'effacement, de portabilité, d'opposition et de limitation du traitement, qu'elles peuvent exercer en s'adressant au cabinet.

10. Différends
En cas de contestation portant sur l'exécution de la mission, les parties s'engagent, préalablement à toute action en justice, à saisir le Président du Conseil Régional de l'Ordre des Experts-Comptables (CROEC) compétent aux fins de conciliation ou d'arbitrage, conformément à l'article 160 du décret du 30 mars 2012.

Le présent contrat est soumis au droit français. À défaut de conciliation, le Tribunal de Commerce compétent sera saisi de tout litige relatif à l'interprétation ou à l'exécution du contrat.

11. Conservation des données LCB-FT
Le cabinet collecte des données d'identification pour respecter ses obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme. Il conserve pendant cinq (5) ans à compter de la fin de la relation d'affaires les documents relatifs à l'identité des clients, personnes agissant pour leur compte et bénéficiaires effectifs (art. L 561-12 CMF), et pendant cinq (5) ans à compter de leur exécution les documents relatifs aux caractéristiques des opérations (art. L 561-10-2 CMF). Ces données peuvent être communiquées aux autorités compétentes.

12. Clause résolutoire
Conformément aux dispositions de l'article 1225 du Code civil, en cas d'inexécution par le client de l'une des obligations visées à la lettre de mission (transmission des documents, paiement des honoraires, fourniture des informations LCB-FT), le contrat pourra être résolu de plein droit, après mise en demeure restée infructueuse pendant un délai de trente (30) jours, sans préjudice des honoraires dus pour les travaux déjà effectués.`;

// ══════════════════════════════════════════════
// Répartition des tâches par défaut (OPT-48/49)
// ══════════════════════════════════════════════

export const GRIMY_DEFAULT_REPARTITION: RepartitionRow[] = [
  { id: "tenue", label: "Tenue des comptes", cabinet: true, client: false, periodicite: "M" },
  { id: "depenses_recettes", label: "Tenue de vos dépenses et recettes", cabinet: true, client: false, periodicite: "M" },
  { id: "editions", label: "Éditions des journaux, grand livre...", cabinet: true, client: false, periodicite: "A" },
  { id: "justification", label: "Justification des comptes", cabinet: true, client: false, periodicite: "M" },
  { id: "decl_periodiques", label: "Établissement des déclarations fiscales périodiques", cabinet: true, client: false, periodicite: "A" },
  { id: "decl_annuelles", label: "Établissement des déclarations fiscales annuelles", cabinet: true, client: false, periodicite: "A" },
  { id: "inventaire", label: "Préparation des éléments d'inventaire", cabinet: false, client: true, periodicite: "A" },
  { id: "comptes_annuels", label: "Établissement et présentation des comptes annuels", cabinet: true, client: false, periodicite: "A" },
  { id: "registres", label: "Tenue des registres légaux", cabinet: true, client: false, periodicite: "A" },
  { id: "attestation", label: "Attestation de présentation", cabinet: true, client: false, periodicite: "A" },
  { id: "formalites_jur", label: "Formalités juridiques ordinaires et annuelles", cabinet: false, client: true, periodicite: "A" },
  { id: "archives", label: "Conservation des archives", cabinet: false, client: true, periodicite: "A" },
  { id: "legislation", label: "Respect de la législation de votre activité", cabinet: false, client: true, periodicite: "M" },
  { id: "vigilance_sociale", label: "Devoir de vigilance en matière sociale", cabinet: false, client: true, periodicite: "S" },
  { id: "vigilance_fiscale", label: "Attestation de vigilance en matière fiscale", cabinet: false, client: true, periodicite: "S" },
  { id: "assurance", label: "Assurance \"métiers\" facultative", cabinet: false, client: true, periodicite: "A" },
  { id: "tva_client", label: "Taxe sur la Valeur Ajoutée", cabinet: false, client: true, periodicite: "NA" },
  { id: "mentions_factures", label: "Conformité de vos mentions obligatoires sur vos factures", cabinet: false, client: true, periodicite: "M" },
  { id: "caisse", label: "Caisse enregistreuse certifiée", cabinet: false, client: true, periodicite: "A" },
  { id: "previsionnels", label: "Établissement de documents prévisionnels \u2013 Si Option", cabinet: true, client: false, periodicite: "A" },
  { id: "situations", label: "Établissement de situations intermédiaires \u2013 Si Option", cabinet: true, client: false, periodicite: "A" },
  { id: "assistance_aga", label: "Assistance aux contrôles AGA/OMGA", cabinet: true, client: false, periodicite: "A" },
  { id: "comptabilite_mandants", label: "Comptabilité des mandants (SCI, LMNP...)", cabinet: true, client: false, periodicite: "A" },
  { id: "procedures_assurances", label: "Procédures assurances et sinistres", cabinet: false, client: true, periodicite: "A" },
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
  // OPT-42/48: Sanitize section content before insert
  const rawSections = (modele.sections ?? GRIMY_DEFAULT_SECTIONS) as LMSection[];
  const cleanSections = rawSections.map((s) => ({ ...s, contenu: stripScripts(s.contenu), titre: stripScripts(s.titre) }));
  // OPT-49: Warn on sensitive content
  for (const s of cleanSections) {
    const w = checkSensitiveContent(s.contenu);
    if (w.length > 0) logger.warn("LM_MODELES", `createModele — section « ${s.titre} »: ${w.join("; ")}`);
  }

  const { data, error } = await supabase
    .from("lm_modeles")
    .insert({
      cabinet_id: modele.cabinet_id,
      nom: stripScripts(modele.nom ?? "Modèle standard"),
      description: modele.description ? stripScripts(modele.description) : modele.description,
      mission_type: modele.mission_type ?? "presentation",
      client_type_id: modele.client_type_id ?? null,
      sections: cleanSections,
      cgv_content: stripScripts(modele.cgv_content ?? GRIMY_DEFAULT_CGV),
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
  // OPT-42/48: Sanitize before update
  const sanitized = { ...updates };
  if (sanitized.sections) {
    sanitized.sections = (sanitized.sections as LMSection[]).map((s) => ({ ...s, contenu: stripScripts(s.contenu), titre: stripScripts(s.titre) }));
    for (const s of sanitized.sections as LMSection[]) {
      const w = checkSensitiveContent(s.contenu);
      if (w.length > 0) logger.warn("LM_MODELES", `updateModele — section « ${s.titre} »: ${w.join("; ")}`);
    }
  }
  if (sanitized.nom) sanitized.nom = stripScripts(sanitized.nom);
  if (sanitized.description) sanitized.description = stripScripts(sanitized.description);
  if (sanitized.cgv_content) sanitized.cgv_content = stripScripts(sanitized.cgv_content);

  const { data, error } = await supabase
    .from("lm_modeles")
    .update(sanitized)
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
    client_type_id: original.client_type_id,
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
// OPT-28: Count modeles by category (legacy mission category)
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
// Count modeles by CLIENT TYPE category
// ══════════════════════════════════════════════

export function countModelesByClientCategory(modeles: LMModele[]): Record<ClientTypeCategory, number> {
  const counts: Record<ClientTypeCategory, number> = {
    societes_commerciales: 0,
    societes_civiles: 0,
    entreprises_individuelles: 0,
    immobilier_patrimoine: 0,
    particuliers: 0,
    autres: 0,
  };
  for (const m of modeles) {
    const ct = CLIENT_TYPES[m.client_type_id || ''];
    if (ct) counts[ct.category] = (counts[ct.category] || 0) + 1;
    else counts.autres = (counts.autres || 0) + 1;
  }
  return counts;
}

// ══════════════════════════════════════════════
// Filter modeles for a specific client type (with fallback)
// ══════════════════════════════════════════════

export function getModelesForClientType(modeles: LMModele[], clientTypeId: string): LMModele[] {
  // 1. Exact match
  const exact = modeles.filter(m => m.client_type_id === clientTypeId);
  if (exact.length > 0) return exact;

  // 2. Fallback: same category
  const config = CLIENT_TYPES[clientTypeId];
  if (config) {
    const sameCategory = modeles.filter(m => {
      const mConfig = CLIENT_TYPES[m.client_type_id || ''];
      return mConfig?.category === config.category;
    });
    if (sameCategory.length > 0) return sameCategory;
  }

  // 3. Ultimate fallback: all modeles
  return modeles;
}

// ══════════════════════════════════════════════
// Build sections adapted for a client type
// ══════════════════════════════════════════════

export function buildSectionsForClientType(clientTypeId: string): LMSection[] {
  const config = CLIENT_TYPES[clientTypeId];
  if (!config) return buildSectionsForMissionType('presentation');

  // 1. Base sections from the associated mission type
  let sections = buildSectionsForMissionType(config.defaultMissionType);

  // 2. Enrich mission section with client-type-specific text
  const missionSection = sections.find(s => s.id === 'mission');
  if (missionSection) {
    const enrichment = getSmartMissionText(clientTypeId);
    if (enrichment) {
      missionSection.contenu += '\n\n' + enrichment;
    }
  }

  // 3. Hide social section if not relevant
  if (!config.defaultMissions.social) {
    sections = sections.map(s => s.id === 'mission_sociale' ? { ...s, hidden: true } : s);
  }
  if (!config.defaultMissions.juridique) {
    sections = sections.map(s => s.id === 'mission_juridique' ? { ...s, hidden: true } : s);
  }

  // 4. Re-filter hidden and reorder
  return sections
    .filter(s => !s.hidden)
    .map((s, i) => ({ ...s, ordre: i + 1 }));
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
    client_type_id: modele.client_type_id,
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
    description: parsed.description || `Importé le ${formatDateFr(new Date())}`,
    mission_type: parsed.mission_type || "presentation",
    client_type_id: parsed.client_type_id || null,
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
    client_type_id: "sas_is",
    sections: GRIMY_DEFAULT_SECTIONS,
    cgv_content: GRIMY_DEFAULT_CGV,
    repartition_taches: GRIMY_DEFAULT_REPARTITION,
    is_default: true,
    source: "grimy",
  });
}

/** Create 4 default modeles (one per major category) if cabinet has none */
export async function initCabinetDefaultModeles(cabinetId: string): Promise<void> {
  const defaultModeles = [
    // Sociétés commerciales
    { client_type_id: 'sas_is', nom: 'Société commerciale IS (SAS/SASU)', mission_type: 'presentation', is_default: true, description: 'Modèle standard pour SAS, SASU, SA à l\'IS. Comptabilité d\'engagement, liasse 2050-2059.' },
    { client_type_id: 'sarl_is', nom: 'SARL / EURL à l\'IS', mission_type: 'presentation', is_default: false, description: 'Gérant majoritaire TNS. Inclut DSI et spécificités gérance majoritaire.' },

    // Sociétés civiles
    { client_type_id: 'sci_ir', nom: 'SCI à l\'IR (revenus fonciers)', mission_type: 'presentation', is_default: false, description: 'Déclaration 2072, aide 2044 associés, suivi loyers et emprunts.' },
    { client_type_id: 'sci_is', nom: 'SCI à l\'IS (amortissements)', mission_type: 'presentation', is_default: false, description: 'Comptabilité d\'engagement, amortissements immobiliers, liasse IS.' },

    // Entreprises individuelles
    { client_type_id: 'ei_reel', nom: 'Entreprise individuelle au réel', mission_type: 'presentation', is_default: false, description: 'BIC ou BNC selon activité. Liasse 2031 ou 2035.' },
    { client_type_id: 'profession_liberale', nom: 'Profession libérale (BNC)', mission_type: 'presentation', is_default: false, description: 'Déclaration contrôlée 2035, CIPAV/CARCDSF, suivi URSSAF.' },
    { client_type_id: 'micro', nom: 'Micro-entreprise / Auto-entrepreneur', mission_type: 'compilation', is_default: false, description: 'Mission de compilation. Suivi CA, seuils, franchise TVA.' },

    // Immobilier & patrimoine
    { client_type_id: 'lmnp', nom: 'LMNP au réel', mission_type: 'presentation', is_default: false, description: 'Amortissements, liasse 2031/2033, 2042 C PRO, déficits BIC.' },
    { client_type_id: 'lmp', nom: 'LMP (Loueur Meublé Professionnel)', mission_type: 'presentation', is_default: false, description: 'Cotisations SSI, plus-values professionnelles, art. 151 septies.' },

    // Particuliers
    { client_type_id: 'irpp', nom: 'IRPP — Déclaration de revenus', mission_type: 'autre_prestation', is_default: false, description: 'Déclaration 2042, revenus fonciers, capitaux mobiliers, IFI.' },

    // Autres structures
    { client_type_id: 'association', nom: 'Association loi 1901', mission_type: 'presentation', is_default: false, description: 'Plan comptable associatif, rapport financier, reçus fiscaux.' },
    { client_type_id: 'holding', nom: 'Holding', mission_type: 'presentation', is_default: false, description: 'Portefeuille participations, régime mère-fille, conventions réglementées.' },
    { client_type_id: 'creation', nom: 'Création d\'entreprise', mission_type: 'previsionnel', is_default: false, description: 'Business plan, prévisionnel, choix statut, formalités création.' },
    { client_type_id: 'syndicat_copro', nom: 'Syndicat de copropriété', mission_type: 'procedures_convenues', is_default: false, description: 'Vérification comptes, contrôle charges, rapport pour AG.' },
  ];

  const existing = await getModeles(cabinetId);
  const existingTypes = new Set(existing.map(m => m.client_type_id));

  for (const def of defaultModeles) {
    if (existingTypes.has(def.client_type_id)) continue;
    const sections = buildSectionsForClientType(def.client_type_id);
    await createModele({
      cabinet_id: cabinetId,
      nom: def.nom,
      description: def.description,
      client_type_id: def.client_type_id,
      mission_type: def.mission_type,
      sections,
      cgv_content: getDefaultCgvForMissionType(def.mission_type),
      repartition_taches: getDefaultRepartitionForMissionType(def.mission_type),
      is_default: def.is_default,
      source: 'grimy',
    });
  }
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
