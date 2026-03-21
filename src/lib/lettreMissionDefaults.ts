import type { CabinetInfo, PdfRepartitionRow } from "@/types/lettreMissionPdf";

// ══════════════════════════════════════════════
// Répartition des travaux par défaut (modèle COMPTADEC — 27 lignes)
// ══════════════════════════════════════════════

export const DEFAULT_REPARTITION: PdfRepartitionRow[] = [
  // Comptabilité
  { tache: "Tenue des comptes", cabinet: true, client: false, periodicite: "Mensuel", categorie: "Comptabilité" },
  { tache: "Tenue de vos dépenses et recettes", cabinet: true, client: false, periodicite: "Mensuel", categorie: "Comptabilité" },
  { tache: "Éditions des journaux, grand livre, balance", cabinet: true, client: false, periodicite: "Annuel", categorie: "Comptabilité" },
  { tache: "Justification des comptes", cabinet: true, client: false, periodicite: "Mensuel", categorie: "Comptabilité" },
  // Fiscal
  { tache: "Établissement des déclarations fiscales périodiques", cabinet: true, client: false, periodicite: "Annuel", categorie: "Fiscal" },
  { tache: "Établissement des déclarations fiscales annuelles", cabinet: true, client: false, periodicite: "Annuel", categorie: "Fiscal" },
  // Inventaire
  { tache: "Préparation des éléments d'inventaire", cabinet: false, client: true, periodicite: "Annuel", categorie: "Inventaire" },
  { tache: "Inventaire physique des stocks et immobilisations", cabinet: false, client: true, periodicite: "Annuel", categorie: "Inventaire" },
  // Clôture
  { tache: "Établissement et présentation des comptes annuels", cabinet: true, client: false, periodicite: "Annuel", categorie: "Clôture" },
  { tache: "Tenue des registres légaux", cabinet: true, client: false, periodicite: "Annuel", categorie: "Clôture" },
  { tache: "Attestation de présentation", cabinet: true, client: false, periodicite: "Annuel", categorie: "Clôture" },
  // Social
  { tache: "Établissement des bulletins de paie", cabinet: true, client: false, periodicite: "Mensuel", categorie: "Social" },
  { tache: "Déclarations sociales périodiques (DSN)", cabinet: true, client: false, periodicite: "Mensuel", categorie: "Social" },
  { tache: "Gestion des entrées/sorties de personnel", cabinet: true, client: true, periodicite: "Par évènement", categorie: "Social" },
  // Juridique
  { tache: "Formalités juridiques ordinaires et annuelles", cabinet: false, client: true, periodicite: "Annuel", categorie: "Juridique" },
  { tache: "Secrétariat juridique annuel (AGO)", cabinet: true, client: false, periodicite: "Annuel", categorie: "Juridique" },
  // Obligations client
  { tache: "Conservation des archives", cabinet: false, client: true, periodicite: "Annuel", categorie: "Obligations client" },
  { tache: "Respect de la législation de votre activité", cabinet: false, client: true, periodicite: "Mensuel", categorie: "Obligations client" },
  { tache: "Devoir de vigilance en matière sociale", cabinet: false, client: true, periodicite: "Semestriel", categorie: "Obligations client" },
  { tache: "Attestation de vigilance en matière fiscale", cabinet: false, client: true, periodicite: "Semestriel", categorie: "Obligations client" },
  { tache: "Assurance \"métiers\" facultative", cabinet: false, client: true, periodicite: "Annuel", categorie: "Obligations client" },
  { tache: "Taxe sur la Valeur Ajoutée", cabinet: false, client: true, periodicite: "NA", categorie: "Obligations client" },
  { tache: "Conformité de vos mentions obligatoires sur vos factures de vente", cabinet: false, client: true, periodicite: "Mensuel", categorie: "Obligations client" },
  { tache: "Caisse enregistreuse certifiée", cabinet: false, client: true, periodicite: "Annuel", categorie: "Obligations client" },
  // Options
  { tache: "Établissement de documents prévisionnels — Si Option", cabinet: true, client: false, periodicite: "Annuel", categorie: "Options" },
  { tache: "Établissement de situations intermédiaires — Si Option", cabinet: true, client: false, periodicite: "Annuel", categorie: "Options" },
  { tache: "Assistance au contrôle fiscal — Si Option", cabinet: true, client: false, periodicite: "Sur demande", categorie: "Options" },
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
// Textes des sections juridiques — modèle COMPTADEC original
// ══════════════════════════════════════════════

export const TEXTES_SECTIONS: Record<string, string> = {
  introduction:
    "Nous vous remercions de la confiance que vous nous avez témoignée lors de notre dernier entretien, en envisageant de nous confier, en qualité d'expert-comptable, une mission de présentation des comptes annuels de votre entreprise.\n\nLa présente lettre de mission ainsi que les conditions générales d'intervention jointes en annexe forment un contrat entre les parties, conformément aux dispositions de l'article 151 du Code de déontologie intégré au décret du 30 mars 2012 relatif à l'exercice de l'activité d'expertise-comptable.",

  notre_mission:
    "La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable et des dispositions de la norme professionnelle du Conseil Supérieur de l'Ordre des Experts-Comptables applicable à la mission de présentation de comptes et des textes légaux et réglementaires applicables aux professionnels de l'expertise comptable que nous sommes tenus de respecter.\n\nNos relations contractuelles seront régies tant par les termes de cette lettre de mission que par les Conditions Générales d'Intervention ci-jointes. À cet effet, nous nous permettons de rappeler les points suivants :\n\nLa mission de présentation des comptes ne constitue ni un audit ni un examen limité des comptes de votre entreprise ;\n\nIls ne comportent ni le contrôle de la matérialité des opérations ni le contrôle des inventaires physiques des actifs de votre entreprise à la clôture de l'exercice comptable (stocks, immobilisations, espèces en caisse notamment) ;\n\nIls n'ont pas pour objectif de déceler les fraudes ou les actes illégaux pouvant ou ayant existé dans votre entreprise. Toutefois, nous vous en informerions si nous étions conduits à en avoir connaissance.\n\nNous nous permettons d'attirer votre attention sur le fait que conformément à l'article L 123-14 du Code de commerce, les comptes annuels doivent être réguliers, sincères et donner une image fidèle du patrimoine, de la situation financière et du résultat de votre entité. Vous restez ainsi responsables à l'égard des tiers de l'exhaustivité, de la fiabilité et de l'exactitude des informations comptables et financières concourant à la présentation des comptes ainsi que des procédures de contrôle interne concourant à l'élaboration de ces comptes. Cela implique notamment le respect des règles applicables à la tenue d'une comptabilité en France et du référentiel comptable applicable à votre secteur d'activité.\n\nNous comptons sur votre entière coopération afin qu'il soit mis à notre disposition dans un délai raisonnable tous les documents et autres informations nécessaires qui nous permettront de mener à bien notre mission. Les pièces comptables devront notamment être mises à la disposition du collaborateur en charge du dossier cinq jours ouvrés minimum avant la date de télétransmission de la déclaration de TVA.\n\nDans le cadre de cette mission, votre expert-comptable apportera personnellement son concours à la mission en suivant attentivement votre entreprise.",

  nature_limite:
    "Notre mission consiste à exprimer une opinion sur la cohérence et la vraisemblance des comptes de votre entité. Cette mission n'a pas pour objectif de déceler des actes illégaux ou autres irrégularités pouvant ou ayant eu lieu dans votre entité.\n\nNous vous précisons que nous sommes juridiquement redevables d'une simple obligation de moyens. Par conséquent, la vérification des écritures et leur rapprochement avec les pièces justificatives sont effectués par notre cabinet uniquement par épreuves, et ne portent donc pas sur l'appréciation de la légalité et de la fiabilité des documents présentés.",

  mission_sociale:
    "La mission sociale est conclue pour une durée correspondant à la mission comptable et nos travaux consisteront à :\n\nÉtablir les bulletins de salaire dans un délai de trois jours ouvrés à compter de la réception des éléments transmis ;\n\nÉtablir, télétransmettre et télé-payer les déclarations sociales périodiques liées (déclarations mensuelles ou trimestrielles et déclarations annuelles) ;\n\nTenir le journal des salaires ;\n\nMettre à disposition de l'entité, qui en assurera la conservation, les documents et états liés au traitement de la paie et des déclarations y afférentes ;\n\nFournir les données d'archivage ;\n\nAssurer la gestion administrative d'évènements occasionnels courants tels que les entrées et sorties de salariés, les arrêts maladie ou maternité, les accidents du travail.\n\nIl est rappelé que le cabinet n'a aucun lien direct avec les salariés de l'employeur. Ce dernier conserve la gestion et la formalisation de ses relations avec son personnel. En aucun cas le cabinet ne se substitue au pouvoir de direction de l'employeur. Sauf délégation particulière, l'employeur est le seul interlocuteur du cabinet.\n\nNous attirons enfin votre attention sur le fait que le code du travail fait obligation à tout employeur de tenir à jour au siège social et, le cas échéant, dans chaque établissement secondaire :\n— le registre des entrées et sorties du personnel quel que soit l'effectif salarié ;\n— le registre médical comprenant tous les documents relatifs à la médecine du travail et notamment les fiches d'aptitudes ;\n— le registre des délégués du personnel (pour les sociétés assujetties à l'obligation d'avoir des représentants du personnel) ;\n— les accusés réception des déclarations unique d'embauche ;\n— les doubles des bulletins de salaire ;\n— un éventuel registre des saisies arrêt sur salaire ;\n— le récépissé de déclaration CNIL pour le traitement automatisé de la paie ;\n— un registre de mise en demeure de l'inspection du travail.\n\nToutefois, nous vous rappelons qu'il vous appartient de nous adresser préalablement à toute embauche les éléments nécessaires à l'établissement de la DPAE. A défaut, nous ne pourrions les faire pour vous. Cette déclaration doit être faite auprès des services de l'URSSAF avant la prise de fonction effective du salarié et au plus tôt 8 jours avant l'embauche.\n\nDe plus, les employeurs doivent communiquer au moins 48 heures avant l'embauche les documents autorisant les ressortissants étrangers hors EU à travailler en France auprès des services compétents de la Préfecture ayant délivrés ces documents.\n\nIl convient donc de nous adresser les documents et informations nécessaire au moins 2 jours avant la date prévisible d'embauche pour les ressortissants français et EU et au moins 4 jours avant la date prévisible d'embauche pour les ressortissants d'autres pays.\n\nNous insistons sur le fait que le non-respect de ces procédures constitue un délit.",

  mission_juridique:
    "La mission de secrétariat juridique annuelle est réalisée à l'issue de la clôture de chaque exercice social et dans le respect des délais légaux.\n\nElle comprend la rédaction des actes relatifs à l'approbation des comptes annuels.",

  controle_fiscal:
    "Dans le cadre de cette mission, nous vous assisterons à chaque étape de la procédure de contrôle et notamment dans la préparation et la transmission des documents demandés et par notre présence aux différents entretiens avec les agents de l'administration fiscale. Nous participerons à la rédaction des réponses aux propositions de rectification et vous conseillerons, si la procédure le nécessite, sur l'opportunité de faire intervenir un avocat fiscaliste.\n\nAfin de mutualiser le risque et le coût que devrait supporter votre entreprise, nous mettons en place une garantie prenant en charge nos honoraires de défense fiscale. Ce dispositif comprend deux options :\n\n☐ Couverture de nos prestations dans la limite de 5 000 € HT par année civile moyennant un coût mensuel de 25 € HT ;\n\n☐ Couverture de nos prestations dans la limite de 2 500 € HT par année civile moyennant un coût mensuel de 10 € HT.\n\nSi vous ne souhaitez pas opter pour la mutualisation, les honoraires d'assistance au contrôle fiscal vous seront facturés en fonction du temps passé.\n\nCette mission d'assistance au contrôle fiscal ne soumet le professionnel de l'expertise-comptable à aucune obligation de résultat. La facturation et le règlement des honoraires, quelle que soit l'option choisie par le client, ne sauraient donc être subordonnés à l'absence de redressement fiscal.",

  clause_resolutoire:
    "Conformément aux dispositions de l'article 1225 du Code civil, en cas d'inexécution par le client de l'une des obligations suivantes : (i) transmission des documents comptables dans les délais convenus, (ii) paiement des honoraires à leur échéance, (iii) fourniture des informations d'identification requises au titre de la LCB-FT, la présente lettre de mission pourra être résolue de plein droit, après mise en demeure restée infructueuse pendant un délai de trente (30) jours, sans préjudice des honoraires dus pour les travaux déjà effectués.",

  mandat_administrations:
    "Le client mandate expressément le cabinet pour accomplir en son nom et pour son compte les formalités et démarches suivantes auprès de l'administration fiscale et des organismes de sécurité sociale :\n\n— Télétransmission des déclarations fiscales périodiques et annuelles (TVA, IS/IR, CVAE, CFE, liasses fiscales) ;\n— Télétransmission des déclarations sociales (DSN et déclarations connexes) ;\n— Relations courantes avec les services des impôts des entreprises (SIE) et les organismes sociaux.\n\nCe mandat est donné pour la durée de la mission. Il peut être révoqué à tout moment par lettre recommandée avec accusé de réception. Le cabinet conserve les mandats signés conformément à l'article 151 du Code de déontologie.",

  modalites:
    "Nos relations seront réglées sur le plan juridique par les termes de cette lettre, les conditions générales et le tableau de répartition des obligations respectives (voir annexes). Tout aménagement significatif fera l'objet d'un avenant.",

  lcbft_conservation:
    "Durée de conservation LCB-FT : Conformément à l'art. L.561-12 CMF, l'ensemble des pièces d'identification est conservé pendant cinq (5) ans à compter de la fin de la relation d'affaires, indépendamment des délais comptables.",

  lcbft_vigilance:
    "Conformément aux articles L.561-1 et suivants du Code monétaire et financier et à la norme professionnelle NPLAB (arrêté du 13.02.2019), le cabinet est soumis aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme.\n\nEngagements contractuels du client : Le client reconnaît avoir été informé des obligations de vigilance qui s'appliquent au cabinet en sa qualité de professionnel assujetti. Il s'engage à répondre sans délai à toute demande de justificatif émanant du cabinet dans ce cadre. Le non-respect de cet engagement constitue une cause légitime de suspension ou de résiliation de la mission, sans indemnité (art. L.561-8 CMF).",

  honoraires_intro:
    "Nos honoraires seront calculés sur la base des temps passés, augmentés des frais et débours divers. Les taux horaires varient en fonction de la mission, de l'expérience et des compétences requises.",

  honoraires_comptable:
    "Compte tenu des volumes que vous nous avez indiqués, les honoraires hors taxes seront de {{forfait_annuel}} HT pour un exercice de 12 mois.\n\nUn forfait de constitution de dossier correspondant à {{constitution_dossier}} d'honoraires.",

  honoraires_frais:
    "À ces honoraires s'ajouteront les frais de déplacements et débours, les taxes fiscales (TVA au taux en vigueur) et les frais de dossier et télétransmission (5 % des honoraires). Tout dépassement fera l'objet d'un accord complémentaire.",

  honoraires_facturation:
    "Nos honoraires seront facturés {{frequence_facturation}}, réglés par prélèvement automatique à au plus 30 jours et révisables annuellement avec un minimum forfaitaire de 3 %.",

  formule_cloture:
    "Nous vous serions obligés de bien vouloir nous retourner un exemplaire de la présente et des annexes jointes, revêtues d'un paraphe sur chacune des pages et de votre signature sur la dernière page.\n\nNous vous prions de croire, {{formule_civilite}} {{nom_dirigeant}}, à nos sentiments dévoués.",

  rgpd:
    "Le cabinet agit en qualité de responsable de traitement au sens du Règlement (UE) 2016/679 (RGPD) pour les données collectées dans le cadre de la mission. Les données sont traitées pour les seuls besoins de la mission et des obligations légales du cabinet.\n\nLe client dispose d'un droit d'accès, de rectification, d'effacement et de portabilité de ses données, ainsi que d'un droit d'opposition et de limitation du traitement, en s'adressant au cabinet.\n\nDurée de conservation : conformément aux obligations légales et professionnelles (10 ans pour les documents comptables, 5 ans pour les données LCB-FT).",
};

// ══════════════════════════════════════════════
// Articles des CGV — modèle COMPTADEC original (10 articles complets)
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
    contenu:
      "Les présentes conditions générales d'intervention sont applicables aux conventions portant sur les missions conclues entre notre société d'expertise comptable COMPTADEC et son client. Elles font partie intégrante du contrat. Si l'une quelconque des dispositions des présentes conditions générales est déclarée nulle ou inapplicable, les autres dispositions resteront en vigueur. Sauf modification notifiée par le professionnel comptable, la version applicable est celle qui est en vigueur au jour de la signature de la lettre de mission.",
  },
  {
    numero: 2,
    titre: "Définition de la mission",
    contenu:
      "Les travaux incombant au professionnel de l'expertise comptable sont strictement limités à ceux détaillés dans la lettre de mission et ses annexes. La mission sera effectuée dans le respect des dispositions du Code de déontologie des professionnels de l'expertise comptable et des dispositions de la norme professionnelle du Conseil Supérieur de l'Ordre des Experts-Comptables applicable à la mission concernée et des textes légaux et réglementaires applicables aux professionnels de l'expertise comptable que nous sommes tenus de respecter. Toute mission complémentaire qui viendrait à être confiée au professionnel fera l'objet d'un avenant ou d'une nouvelle lettre de mission.",
  },
  {
    numero: 3,
    titre: "Résiliation de la mission",
    contenu:
      "La mission sera tacitement reconduite chaque année. Le client ou le professionnel peut y mettre fin par lettre recommandée dans un délai de trois (3) mois avant la fin de la période en cours. Conformément à l'article L 215-1 du Code de la consommation, le professionnel informera le client par écrit, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat.\n\nEn cas de résiliation, le professionnel a droit à des honoraires au titre des travaux professionnels effectués, complétés le cas échéant par une indemnité conventionnelle en compensation du préjudice subi. Le client pourra également résilier de plein droit le contrat en cas de manquement du professionnel à ses obligations essentielles, après mise en demeure restée sans effet pendant un délai de trente (30) jours.",
  },
  {
    numero: 4,
    titre: "Suspension de la mission",
    contenu:
      "En cas de suspension de la mission pour quelque cause que ce soit, les délais de délivrance des travaux sont prolongés pour une durée égale à celle de la suspension. Les dispositions de la lettre de mission et des présentes conditions générales restent applicables pendant la durée de la suspension.",
  },
  {
    numero: 5,
    titre: "Obligations du professionnel",
    contenu:
      "Le professionnel effectue la mission qui lui est confiée conformément aux dispositions du Code de déontologie des professionnels de l'expertise comptable, de la Norme Professionnelle de Maîtrise de la Qualité (NPMQ) et de la norme professionnelle applicable au type de mission concerné.\n\nLe professionnel est soumis aux obligations relatives à la lutte contre le blanchiment de capitaux et le financement du terrorisme (LCB-FT) conformément aux articles L.561-1 et suivants du Code monétaire et financier.\n\nLe professionnel de l'expertise comptable et ses collaborateurs sont tenus au secret professionnel au sens des articles 226-13 et 226-14 du Code pénal, conformément à l'article 147 du Code de déontologie. Ils sont également astreints à une obligation de discrétion pour tous les faits, actes et renseignements dont ils ont pu avoir connaissance en raison de leurs fonctions.\n\nLe responsable de la mission est un expert-comptable inscrit au tableau de l'Ordre, qui apporte personnellement son concours à la mission et en garantit la bonne réalisation au nom de la structure d'exercice (NPMQ §30).",
  },
  {
    numero: 6,
    titre: "Obligations du client",
    contenu:
      "Le client s'interdit tout acte de nature à porter atteinte à l'indépendance du professionnel ou de ses collaborateurs, notamment en s'abstenant de leur faire toutes offres de mission ou d'emploi, pendant la durée du contrat et pendant les douze (12) mois suivant la fin de la mission.\n\nConformément aux obligations de vigilance LCB-FT, le client fournit au cabinet les documents d'identification suivants :\n— Pour les personnes physiques : pièce d'identité officielle en cours de validité (CNI, passeport), justificatif de domicile de moins de 3 mois ;\n— Pour les personnes morales : extrait Kbis de moins de 3 mois, statuts à jour, liste des bénéficiaires effectifs, composition du capital et des organes de direction ;\n— Le client s'engage à mettre à jour ces documents sans délai en cas de changement de situation.\n\nLe client s'engage à mettre à la disposition du cabinet, dans les délais convenus, l'ensemble des documents et informations nécessaires à l'exécution de la mission. Il s'engage à effectuer les travaux qui lui incombent conformément au tableau de répartition annexé à la lettre de mission et dans le respect du planning convenu.\n\nLe client porte sans délai à la connaissance du cabinet tout fait nouveau susceptible d'affecter l'exécution de la mission. Il confirme par écrit, sur demande du cabinet, les informations qu'il a fournies oralement et vérifie les documents de synthèse produits par le cabinet.\n\nLe non-respect par le client de ses obligations au titre du présent article constitue une cause légitime de suspension ou de résiliation de la mission, sans indemnité.",
  },
  {
    numero: 7,
    titre: "Honoraires et conditions de règlement",
    contenu:
      "Les honoraires sont librement convenus entre les parties conformément à l'article 24 de l'ordonnance du 19 septembre 1945. Des provisions sur honoraires pourront être demandées. Les honoraires sont payés par prélèvement automatique à leur échéance. Aucun escompte n'est accordé en cas de paiement anticipé.\n\nEn cas de retard de paiement, des pénalités seront exigibles de plein droit, sans mise en demeure préalable, au taux d'intérêt de la Banque Centrale Européenne majoré de 10 points (art. L 441-10 du Code de commerce). Une indemnité forfaitaire pour frais de recouvrement de 40 euros sera due (art. D 441-5 du Code de commerce). Toute contestation d'une facture devra être portée à la connaissance du cabinet dans un délai de 30 jours à compter de sa réception.\n\nLe non-paiement des honoraires à leur échéance pourra entraîner la suspension de la mission. En cas de changement de facturation lié à une évolution du dossier, le client en sera informé préalablement.\n\nEn cas de transfert du dossier à un confrère, le professionnel dispose d'un droit de rétention des documents, limité aux documents qu'il a lui-même établis, conformément à l'article 168 du Code de déontologie. Le règlement d'une facture vaut acceptation des prestations correspondantes.",
  },
  {
    numero: 8,
    titre: "Responsabilité civile professionnelle",
    contenu:
      "Le cabinet est assuré en responsabilité civile professionnelle auprès de MMA IARD, contrat n° 118 269 730, dont le siège social est sis 14 boulevard Marie et Alexandre Oyon, 72030 Le Mans Cedex 9. La couverture s'applique aux interventions réalisées sur le territoire français.\n\nSont exclues de la garantie les conséquences dommageables résultant : d'informations erronées ou incomplètes fournies par le client ; du retard du client dans la transmission des documents nécessaires ; des fautes commises par des tiers non mandatés par le cabinet.\n\nLa prescription applicable aux actions en responsabilité est réduite à un (1) an conformément à l'article 2254 du Code civil. Cet aménagement conventionnel ne s'applique pas lorsque le client a la qualité de consommateur ou de non-professionnel au sens du Code de la consommation. Le client dispose d'un délai de forclusion de trois (3) mois à compter de la remise des documents pour formuler toute réclamation auprès de COMPTADEC.",
  },
  {
    numero: 9,
    titre: "Données personnelles",
    contenu:
      "Le cabinet agit en qualité de responsable de traitement au sens de la loi n° 78-17 du 6 janvier 1978 modifiée et du Règlement (UE) 2016/679 du 27 avril 2016 (RGPD). Le cabinet met en œuvre les mesures techniques et organisationnelles appropriées pour assurer la sécurité des données personnelles.\n\nEn cas de violation de données à caractère personnel, le cabinet notifie l'autorité de contrôle compétente (CNIL) dans un délai de 72 heures conformément à l'article 33 du RGPD. Les sous-traitants éventuels sont soumis aux mêmes obligations de confidentialité et de sécurité.\n\nLes données sont traitées pour les finalités suivantes : exécution de la mission, respect des obligations légales et professionnelles, gestion de la relation commerciale. Le cabinet agit sur les instructions du client et assure la confidentialité des données traitées.\n\nLes personnes concernées disposent d'un droit d'accès, de rectification, d'effacement, de portabilité, d'opposition et de limitation du traitement, qu'elles peuvent exercer en s'adressant au cabinet.",
  },
  {
    numero: 10,
    titre: "Différends",
    contenu:
      "En cas de contestation portant sur l'exécution de la mission, les parties s'engagent, préalablement à toute action en justice, à saisir le Président du Conseil Régional de l'Ordre des Experts-Comptables (CROEC) compétent aux fins de conciliation ou d'arbitrage, conformément à l'article 160 du décret du 30 mars 2012.\n\nLe présent contrat est soumis au droit français. À défaut de conciliation, le Tribunal de Commerce compétent sera saisi de tout litige relatif à l'interprétation ou à l'exécution du contrat.",
  },
];
